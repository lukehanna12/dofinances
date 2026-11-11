import {AuthStore as BaseAuthStore} from "./auth-store.mjs";
import {validPassword,normalizedEmail,randomToken,randomSalt,passwordHash,sha256,constantTimeEqual,PASSWORD_ITERATIONS} from "./auth-core.mjs";
import {newTotpSecret,totpAt,matchTotp,sealTotp,openTotp,makeRecoveryCodes,recoveryHash,authenticatorUri} from "./auth-mfa.mjs";

const now=()=>Math.floor(Date.now()/1000);
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;

// Keep the existing Durable Object namespace and users table intact.
// Legacy users are allowed to continue signing in; new registrations require
// verified email before any session can access /app.
export class AuthStore extends BaseAuthStore {
  constructor(ctx,env){
    super(ctx,env);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS account_security (
      user_id TEXT PRIMARY KEY, verified_at INTEGER NOT NULL DEFAULT 0,
      legacy INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT, mfa_pending TEXT, mfa_setup_at INTEGER NOT NULL DEFAULT 0,
      mfa_last_step INTEGER NOT NULL DEFAULT -1
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mail_tokens (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mfa_challenges (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
      failures INTEGER NOT NULL DEFAULT 0
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mfa_recovery (
      user_id TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(user_id,hash)
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS cloudflare_account_connection (
      singleton TEXT PRIMARY KEY CHECK(singleton='owner'),
      user_id TEXT NOT NULL, cloudflare_user_id TEXT NOT NULL,
      email TEXT NOT NULL, token_ciphertext TEXT,
      token_id TEXT, expires_on TEXT, policy_json TEXT NOT NULL,
      connected_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      disconnected_at INTEGER NOT NULL DEFAULT 0
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS colosseum_owner (
      singleton TEXT PRIMARY KEY CHECK(singleton='colosseum'),
      user_id TEXT NOT NULL, access_subject TEXT NOT NULL, created_at INTEGER NOT NULL
    )`);
  }
  colosseumOwnerStatus({userId,accessSubject}){
    const owner=this.sql.exec("SELECT user_id,access_subject FROM colosseum_owner WHERE singleton='colosseum'").toArray()[0];
    return {linked:!!owner,owner:!!owner&&owner.user_id===userId&&owner.access_subject===accessSubject};
  }
  colosseumOwnerBind({userId,accessSubject}){
    if(typeof userId!=="string"||!userId||typeof accessSubject!=="string"||!accessSubject)
      return {linked:false,owner:false};
    // A single SQLite-Durable-Object primary key prevents concurrent first-owner
    // enrollment from ever assigning a second account.
    this.sql.exec("INSERT OR IGNORE INTO colosseum_owner(singleton,user_id,access_subject,created_at) VALUES('colosseum',?,?,?)",
      userId,accessSubject,now());
    return this.colosseumOwnerStatus({userId,accessSubject});
  }

  cloudflareConnectionState({userId,includeCredential=false}){
    if(typeof userId!=="string"||!userId)return {status:401,error:"Sign-in required."};
    // This account-wide owner claim is independent of project-specific ownership.
    // Only the first verified owner may claim it; a disconnected claim persists.    const record=this.sql.exec("SELECT * FROM cloudflare_account_connection WHERE singleton='owner'").toArray()[0];
    if(record && record.user_id!==userId)
      return {status:403,error:"Cloudflare access is already assigned to a different DoFinances user."};
    if(!record)return {status:200,connected:false,policy:{mode:"read",accounts:"*",zones:"*",user:false}};
    const result={status:200,connected:!!record.token_ciphertext,
      email:record.email,cloudflareUserId:record.cloudflare_user_id,
      tokenId:record.token_id,expiresOn:record.expires_on,
      connectedAt:record.connected_at,updatedAt:record.updated_at,
      disconnectedAt:record.disconnected_at,policy:JSON.parse(record.policy_json)};
    if(includeCredential)result.ciphertext=record.token_ciphertext||null;
    return result;
  }
  cloudflareConnectionSave({userId,cloudflareUserId,email,tokenId,expiresOn,ciphertext,policy}){
    const current=this.cloudflareConnectionState({userId});
    if(current.status!==200)return current;
    if(typeof cloudflareUserId!=="string"||!cloudflareUserId||
       typeof ciphertext!=="string"||ciphertext.length<60 ||
       typeof email!=="string"||!email||typeof policy!=="object")
      return {status:400,error:"Invalid Cloudflare connection."};
    const existing=this.sql.exec("SELECT cloudflare_user_id FROM cloudflare_account_connection WHERE singleton='owner'").toArray()[0];
    if(existing && existing.cloudflare_user_id!==cloudflareUserId)
      return {status:403,error:"A different Cloudflare owner cannot replace this connection."};
    const timestamp=Math.floor(Date.now()/1000);
    this.sql.exec(`INSERT INTO cloudflare_account_connection(
      singleton,user_id,cloudflare_user_id,email,token_ciphertext,token_id,expires_on,
      policy_json,connected_at,updated_at,disconnected_at)
      VALUES('owner',?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(singleton) DO UPDATE SET
        token_ciphertext=excluded.token_ciphertext,
        token_id=excluded.token_id,expires_on=excluded.expires_on,
        policy_json=excluded.policy_json,connected_at=excluded.connected_at,
        updated_at=excluded.updated_at,disconnected_at=0
      WHERE cloudflare_account_connection.user_id=excluded.user_id
        AND cloudflare_account_connection.cloudflare_user_id=excluded.cloudflare_user_id`,
      userId,cloudflareUserId,email,ciphertext,tokenId,expiresOn,
      JSON.stringify(policy),timestamp,timestamp);
    return this.cloudflareConnectionState({userId});
  }
  cloudflareConnectionSetPolicy({userId,policy}){
    const state=this.cloudflareConnectionState({userId});
    if(state.status!==200)return state;
    if(!state.connected)return {status:409,error:"Connect Cloudflare before changing permissions."};
    this.sql.exec("UPDATE cloudflare_account_connection SET policy_json=?,updated_at=? WHERE singleton='owner' AND user_id=? AND token_ciphertext IS NOT NULL",
      JSON.stringify(policy),Math.floor(Date.now()/1000),userId);
    return this.cloudflareConnectionState({userId});
  }
  cloudflareConnectionRemove({userId}){
    const state=this.cloudflareConnectionState({userId});
    if(state.status!==200)return state;
    if(!state.connected)return {status:409,error:"Cloudflare is not connected."};
    const timestamp=Math.floor(Date.now()/1000);
    this.sql.exec("UPDATE cloudflare_account_connection SET token_ciphertext=NULL,token_id=NULL,expires_on=NULL,updated_at=?,disconnected_at=? WHERE singleton='owner' AND user_id=?",
      timestamp,timestamp,userId);
    return this.cloudflareConnectionState({userId});
  }
  security(userId){
    return this.sql.exec("SELECT * FROM account_security WHERE user_id=?",userId).toArray()[0];
  }
  ensureSecurity(userId){
    if(!this.security(userId))
      this.sql.exec("INSERT INTO account_security(user_id,verified_at,legacy) VALUES(?,0,1)",userId);
    return this.security(userId);
  }
  async issueLink(userId,kind){
    const token=randomToken(), hash=await sha256(token);
    const ttl=kind==="verify"?86400:1800;
    this.ctx.storage.transactionSync(()=>{
      this.sql.exec("DELETE FROM mail_tokens WHERE user_id=? AND kind=?",userId,kind);
      this.sql.exec("INSERT INTO mail_tokens(hash,user_id,kind,expires_at) VALUES(?,?,?,?)",hash,userId,kind,now()+ttl);
    });
    return token;
  }
  async signup(args){
    const result=await super.signup(args);
    if(result.error)return result;
    await super.logout(result.token);
    this.sql.exec("INSERT INTO account_security(user_id,verified_at,legacy) VALUES(?,0,0)",result.user.id);
    const verificationToken=await this.issueLink(result.user.id,"verify");
    return {status:202,pending:true,delivery:{kind:"verify",to:result.user.email,token:verificationToken}};
  }
  async login(args){
    const result=await super.login(args);
    if(result.error)return result;
    const security=this.security(result.user.id);
    if(security && !security.verified_at && !security.legacy){
      await super.logout(result.token);
      return {status:403,error:"Verify your email address before signing in.",verification_required:true};
    }
    if(security?.mfa_secret){
      await super.logout(result.token);
      const challenge=randomToken(),hash=await sha256(challenge);
      this.sql.exec("INSERT INTO mfa_challenges(hash,user_id,expires_at) VALUES(?,?,?)",
        hash,result.user.id,now()+300);
      return {status:200,mfa_required:true,challenge};
    }
    return {...result,user:{...result.user,verified:!!security?.verified_at,mfaEnabled:false}};
  }
  async session(token){
    const user=await super.session(token);
    if(!user)return null;
    const security=this.security(user.id);
    if(security && !security.verified_at && !security.legacy)return null;
    return {...user,verified:!!security?.verified_at,mfaEnabled:!!security?.mfa_secret};
  }
  async verificationRequest({email,ipKey}){
    const normalized=normalizedEmail(email);
    const bucket="email-send:"+String(ipKey||"unknown");
    if(this.limited(bucket,8,3600))return {status:429,error:"Too many requests. Try again later."};
    this.hit(bucket,3600);
    if(!normalized)return {status:200};
    const user=this.sql.exec("SELECT id,email FROM users WHERE email=?",normalized).toArray()[0];
    if(!user)return {status:200};
    const security=this.ensureSecurity(user.id);
    if(security.verified_at)return {status:200};
    const token=await this.issueLink(user.id,"verify");
    return {status:200,delivery:{kind:"verify",to:user.email,token}};
  }
  async verifyEmail(token){
    if(typeof token!=="string"||!tokenPattern.test(token))return {status:400,error:"Invalid or expired verification link."};
    const hash=await sha256(token);
    const result=this.sql.exec("DELETE FROM mail_tokens WHERE hash=? AND kind='verify' AND expires_at>? RETURNING user_id",hash,now()).toArray()[0];
    if(!result)return {status:400,error:"Invalid or expired verification link."};
    this.ensureSecurity(result.user_id);
    this.sql.exec("UPDATE account_security SET verified_at=? WHERE user_id=?",now(),result.user_id);
    return {status:200,verified:true};
  }
  async passwordRecoveryRequest({email,ipKey}){
    const normalized=normalizedEmail(email);
    const bucket="pwreset:"+String(ipKey||"unknown");
    if(this.limited(bucket,8,3600))return {status:429,error:"Too many requests. Try again later."};
    this.hit(bucket,3600);
    if(!normalized)return {status:200};
    const user=this.sql.exec("SELECT id,email FROM users WHERE email=?",normalized).toArray()[0];
    if(!user)return {status:200};
    const token=await this.issueLink(user.id,"reset");
    return {status:200,delivery:{kind:"reset",to:user.email,token}};
  }
  async verifyFactor(userId,code){
    const security=this.security(userId);
    if(!security?.mfa_secret)return false;
    if(typeof code!=="string"||code.length>48)return false;
    const backupHash=await recoveryHash(code,userId);
    if(backupHash)
      return this.sql.exec("DELETE FROM mfa_recovery WHERE user_id=? AND hash=? RETURNING hash",userId,backupHash).toArray().length===1;
    if(!this.env.MFA_ENCRYPTION_KEY)return false;
    if(/^[0-9]{6}$/.test(code)){
      const secret=await openTotp(security.mfa_secret,this.env.MFA_ENCRYPTION_KEY,userId);
      const step=await matchTotp(secret,code,security.mfa_last_step);
      if(step===null)return false;
      const accepted=this.sql.exec(
        "UPDATE account_security SET mfa_last_step=? WHERE user_id=? AND mfa_last_step<? RETURNING user_id",
        step,userId,step).toArray();
      return accepted.length===1;
    }
    return false;
  }
  async finishMfa({challenge,code,ipKey}){
    if(typeof challenge!=="string"||!tokenPattern.test(challenge))
      return {status:401,error:"Invalid or expired authentication challenge."};
    const bucket="mfa:"+String(ipKey||"unknown");
    if(this.limited(bucket,20,900))return {status:429,error:"Too many attempts. Try again later."};
    const hash=await sha256(challenge);
    const record=this.sql.exec("SELECT user_id,failures FROM mfa_challenges WHERE hash=? AND expires_at>?",hash,now()).toArray()[0];
    if(!record)return {status:401,error:"Invalid or expired authentication challenge."};
    if(record.failures>=5)return {status:429,error:"Challenge attempt limit exceeded. Sign in again."};
    const valid=await this.verifyFactor(record.user_id,code);
    if(!valid){
      this.hit(bucket,900);
      this.sql.exec("UPDATE mfa_challenges SET failures=failures+1 WHERE hash=?",hash);
      return {status:401,error:"Incorrect or already-used authentication code."};
    }
    // Atomic consume prevents a challenge being redeemed twice.
    const consumed=this.sql.exec("DELETE FROM mfa_challenges WHERE hash=? AND expires_at>? RETURNING user_id",hash,now()).toArray();
    if(!consumed.length)return {status:401,error:"Authentication challenge already used."};
    const user=this.sql.exec("SELECT id,email FROM users WHERE id=?",record.user_id).toArray()[0];
    if(!user)return {status:401,error:"Account unavailable."};
    const token=await this.makeSession(user.id);
    return {status:200,token,user:{...user,verified:!!this.security(user.id)?.verified_at,mfaEnabled:true}};
  }
  async mfaSetup({token,password}){
    if(!this.env.MFA_ENCRYPTION_KEY)return {status:503,error:"MFA encryption is not configured."};
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    const creds=this.sql.exec("SELECT salt,password_hash,iterations FROM users WHERE id=?",user.id).toArray()[0];
    if(typeof password!=="string"||!creds||
       !constantTimeEqual(await passwordHash(password,creds.salt,creds.iterations),creds.password_hash))
      return {status:403,error:"Current password required to enroll MFA."};
    const record=this.ensureSecurity(user.id);
    if(record.mfa_secret)return {status:409,error:"MFA is already enabled."};
    const secret=newTotpSecret();
    const encrypted=await sealTotp(secret,this.env.MFA_ENCRYPTION_KEY,user.id);
    this.sql.exec("UPDATE account_security SET mfa_pending=?,mfa_setup_at=? WHERE user_id=?",
      encrypted,now(),user.id);
    return {status:200,secret,uri:authenticatorUri(secret,user.email)};
  }
  async mfaConfirm({token,code}){
    if(!this.env.MFA_ENCRYPTION_KEY)return {status:503,error:"MFA encryption is not configured."};
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    const record=this.security(user.id);
    if(!record?.mfa_pending||record.mfa_secret||now()-record.mfa_setup_at>600)
      return {status:400,error:"MFA setup expired. Start again."};
    const secret=await openTotp(record.mfa_pending,this.env.MFA_ENCRYPTION_KEY,user.id);
    const step=await matchTotp(secret,code,-1);
    if(step===null)return {status:401,error:"Invalid authenticator code."};
    const codes=makeRecoveryCodes(),hashes=await Promise.all(codes.map(x=>recoveryHash(x,user.id)));
    this.ctx.storage.transactionSync(()=>{
      this.sql.exec("UPDATE account_security SET mfa_secret=?,mfa_pending=NULL,mfa_setup_at=0,mfa_last_step=? WHERE user_id=? AND mfa_secret IS NULL",
        record.mfa_pending,step,user.id);
      this.sql.exec("DELETE FROM mfa_recovery WHERE user_id=?",user.id);
      for(const hash of hashes)this.sql.exec("INSERT INTO mfa_recovery(user_id,hash) VALUES(?,?)",user.id,hash);
      this.sql.exec("DELETE FROM sessions WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mfa_challenges WHERE user_id=?",user.id);
    });
    return {status:200,enabled:true,recoveryCodes:codes,reauthenticate:true};
  }
  async mfaStatus(token){
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    const record=this.security(user.id);
    const backupCount=record?.mfa_secret?this.sql.exec("SELECT COUNT(*) AS n FROM mfa_recovery WHERE user_id=?",user.id).toArray()[0].n:0;
    return {status:200,enabled:!!record?.mfa_secret,verified:user.verified,backupCount};
  }
  async mfaDisable({token,password,code}){
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    const record=this.security(user.id);
    if(!record?.mfa_secret)return {status:400,error:"MFA is not enabled."};
    const creds=this.sql.exec("SELECT salt,password_hash,iterations FROM users WHERE id=?",user.id).toArray()[0];
    if(typeof password!=="string"||!creds||!constantTimeEqual(await passwordHash(password,creds.salt,creds.iterations),creds.password_hash))
      return {status:403,error:"Incorrect password."};
    if(!await this.verifyFactor(user.id,code))return {status:403,error:"Invalid authentication code."};
    this.ctx.storage.transactionSync(()=>{
      this.sql.exec("UPDATE account_security SET mfa_secret=NULL,mfa_pending=NULL,mfa_last_step=-1 WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mfa_recovery WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM sessions WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mfa_challenges WHERE user_id=?",user.id);
    });
    return {status:200,disabled:true};
  }
  async resetPassword({token,password,code}){
    if(!validPassword(password)||typeof token!=="string"||!tokenPattern.test(token))
      return {status:400,error:"Invalid reset link or password (12–128 characters required)."};
    const hash=await sha256(token);
    const record=this.sql.exec("SELECT user_id FROM mail_tokens WHERE hash=? AND kind='reset' AND expires_at>?",hash,now()).toArray()[0];
    if(!record)return {status:400,error:"Reset link expired or already used."};
    const security=this.security(record.user_id);
    const resetBucket="reset-factor:"+hash;
    if(security?.mfa_secret&&this.limited(resetBucket,5,1800))
      return {status:429,error:"Too many reset attempts. Request a fresh link later."};
    if(security?.mfa_secret && !await this.verifyFactor(record.user_id,code)){
      this.hit(resetBucket,1800);
      return {status:403,error:"Authenticator or recovery code required."};
    }
    const salt=randomSalt(),derived=await passwordHash(password,salt);
    this.ctx.storage.transactionSync(()=>{
      const consumed=this.sql.exec("DELETE FROM mail_tokens WHERE hash=? AND kind='reset' AND expires_at>? RETURNING user_id",hash,now()).toArray();
      if(!consumed.length)throw Error("Reset token already consumed");
      this.sql.exec("UPDATE users SET salt=?,password_hash=?,iterations=? WHERE id=?",salt,derived,PASSWORD_ITERATIONS,record.user_id);
      this.sql.exec("DELETE FROM sessions WHERE user_id=?",record.user_id);
      this.sql.exec("DELETE FROM mfa_challenges WHERE user_id=?",record.user_id);
      this.sql.exec("DELETE FROM mail_tokens WHERE user_id=?",record.user_id);
    });
    return {status:200,reset:true};
  }
  async deleteAccount({token,password,code}){
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    const creds=this.sql.exec("SELECT salt,password_hash,iterations FROM users WHERE id=?",user.id).toArray()[0];
    if(typeof password!=="string"||!creds||!constantTimeEqual(await passwordHash(password,creds.salt,creds.iterations),creds.password_hash))
      return {status:403,error:"Incorrect password."};
    if(this.security(user.id)?.mfa_secret && !await this.verifyFactor(user.id,code))
      return {status:403,error:"Authenticator or recovery code required."};
    const result=await super.deleteAccount({token,password});
    if(result.status!==204)return result;
    this.ctx.storage.transactionSync(()=>{
      this.sql.exec("DELETE FROM cloudflare_account_connection WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM account_security WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mail_tokens WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mfa_challenges WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mfa_recovery WHERE user_id=?",user.id);
    });
    return result;
  }
}
