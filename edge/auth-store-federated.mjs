// Durable Object federation layer: one authoritative account/identity registry,
// independent of D1 and without storing OAuth access or refresh tokens.
import {AuthStore as SecureAuthStore} from "./auth-store-secure.mjs";
import {randomToken,randomSalt,passwordHash,sha256,normalizedEmail,PASSWORD_ITERATIONS} from "./auth-core.mjs";
import {FEDERATION_LIMITS} from "./auth-federation.mjs";
const now=()=>Math.floor(Date.now()/1000);
const permittedProvider=p=>Object.hasOwn(FEDERATION_LIMITS,p);
const secureToken=t=>typeof t==="string"&&/^[A-Za-z0-9_-]{43}$/.test(t);

export class AuthStore extends SecureAuthStore {
  constructor(ctx,env) {
    super(ctx,env);
    this.sql.exec("CREATE TABLE IF NOT EXISTS account_methods (user_id TEXT PRIMARY KEY,has_password INTEGER NOT NULL CHECK(has_password IN(0,1)))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS federated_identities (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,provider TEXT NOT NULL,issuer TEXT NOT NULL,client_id TEXT NOT NULL,subject TEXT NOT NULL,email TEXT,display_name TEXT,linked_at INTEGER NOT NULL,UNIQUE(provider,issuer,subject))");
    this.sql.exec("CREATE INDEX IF NOT EXISTS idx_federated_user ON federated_identities(user_id,provider)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS federation_transactions (state_hash TEXT PRIMARY KEY,provider TEXT NOT NULL,intent TEXT NOT NULL,session_hash TEXT,verifier TEXT NOT NULL,nonce TEXT NOT NULL,expires_at INTEGER NOT NULL)");
  }
  hasPassword(userId) {
    const row=this.sql.exec("SELECT has_password FROM account_methods WHERE user_id=?",userId).toArray()[0];
    return row?row.has_password===1:true; // pre-federation accounts retain passwords
  }
  async beginFederation({state,verifier,nonce,provider,intent,sessionToken,ipKey}){
    if(!secureToken(state)||!secureToken(verifier)||!secureToken(nonce)||
       !permittedProvider(provider)||!["signin","link"].includes(intent))
      return {status:400,error:"Invalid sign-in request."};
    const bucket="federation-start:"+String(ipKey||"unknown");
    if(this.limited(bucket,30,900))return {status:429,error:"Too many sign-in attempts."};
    let sessionHash=null;
    if(intent==="link"){
      const user=await this.session(sessionToken);
      if(!user)return {status:401,error:"Sign in before linking an account."};
      sessionHash=await sha256(sessionToken);
    }
    this.hit(bucket,900);
    this.sql.exec("DELETE FROM federation_transactions WHERE expires_at<?",now());
    this.sql.exec("INSERT INTO federation_transactions(state_hash,provider,intent,session_hash,verifier,nonce,expires_at) VALUES(?,?,?,?,?,?,?)",
      await sha256(state),provider,intent,sessionHash,verifier,nonce,now()+600);
    return {status:200,ok:true};
  }
  async consumeFederation({state,provider,sessionToken}){
    if(!secureToken(state)||!permittedProvider(provider))
      return {status:400,error:"Invalid sign-in state."};
    const rows=this.sql.exec("DELETE FROM federation_transactions WHERE state_hash=? RETURNING provider,intent,session_hash,verifier,nonce,expires_at",await sha256(state)).toArray();
    const txn=rows[0];
    if(!txn||txn.provider!==provider||txn.expires_at<=now())
      return {status:400,error:"Expired or mismatched sign-in state."};
    if(txn.intent==="link"){
      const current=await this.session(sessionToken);
      if(!current||!secureToken(sessionToken)||
         txn.session_hash!==await sha256(sessionToken))
        return {status:401,error:"Linking session expired."};
    }
    return {status:200,intent:txn.intent,verifier:txn.verifier,nonce:txn.nonce};
  }
  async federatedAccounts(token){
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    const rows=this.sql.exec("SELECT id,provider,email,display_name,linked_at FROM federated_identities WHERE user_id=? ORDER BY linked_at,id",user.id).toArray();
    return {status:200,hasPassword:this.hasPassword(user.id),
      identities:rows.map(r=>({id:r.id,provider:r.provider,email:r.email,displayName:r.display_name,linkedAt:r.linked_at})),
      limits:FEDERATION_LIMITS};
  }
  async completeFederation({intent,identity,sessionToken}){
    const {provider,issuer,clientId,subject}=identity||{};
    if(!["signin","link"].includes(intent)||!permittedProvider(provider)||
      typeof issuer!=="string"||!issuer||typeof clientId!=="string"||!clientId||
      typeof subject!=="string"||!subject||subject.length>256)
      return {status:400,error:"Invalid verified identity."};
    const email=normalizedEmail(identity.email);
    const owner=intent==="link"?await this.session(sessionToken):null;
    if(intent==="link"&&!owner)return {status:401,error:"Linking session expired."};

    // A new OAuth-only account gets a random unusable password hash; its
    // separate password-method flag is authoritative. Legacy schema stays intact.
    const prior=this.sql.exec("SELECT user_id FROM federated_identities WHERE provider=? AND issuer=? AND subject=?",provider,issuer,subject).toArray()[0];
    const needsPlaceholder=intent==="signin"&&!prior;
    const salt=needsPlaceholder?randomSalt():null;
    const hash=needsPlaceholder?await passwordHash(randomToken()+randomToken(),salt):null;
    const result=this.ctx.storage.transactionSync(()=>{
      const existing=this.sql.exec("SELECT user_id FROM federated_identities WHERE provider=? AND issuer=? AND subject=?",
        provider,issuer,subject).toArray()[0];
      if(intent==="link"){
        if(existing&&existing.user_id!==owner.id)
          return {status:409,error:"This external account belongs to another user.",code:"identity_used"};
        if(existing)return {status:200,linked:true,alreadyLinked:true};
        const count=this.sql.exec("SELECT COUNT(*) AS n FROM federated_identities WHERE user_id=? AND provider=?",owner.id,provider).toArray()[0].n;
        if(count>=FEDERATION_LIMITS[provider])
          return {status:409,error:"Provider link limit reached.",code:"limit"};
        this.sql.exec("INSERT INTO federated_identities(id,user_id,provider,issuer,client_id,subject,email,display_name,linked_at) VALUES(?,?,?,?,?,?,?,?,?)",
          crypto.randomUUID(),owner.id,provider,issuer,clientId,subject,email,identity.displayName||null,now());
        return {status:200,linked:true};
      }
      if(existing)return {status:200,userId:existing.user_id,existing:true};
      if(!email)return {status:400,error:"Provider must supply an email address for account creation.",code:"email_required"};
      if(this.sql.exec("SELECT id FROM users WHERE email=?",email).toArray().length)
        return {status:409,error:"An account with this email already exists. Sign in to it first, then link this provider.",code:"link_required"};
      const id=crypto.randomUUID();
      this.sql.exec("INSERT INTO users(id,email,salt,password_hash,iterations,created_at) VALUES(?,?,?,?,?,?)",
        id,email,salt,hash,PASSWORD_ITERATIONS,now());
      this.sql.exec("INSERT INTO account_methods(user_id,has_password) VALUES(?,0)",id);
      this.sql.exec("INSERT INTO account_security(user_id,verified_at,legacy) VALUES(?,?,0)",
        id,identity.verified?now():0);
      this.sql.exec("INSERT INTO federated_identities(id,user_id,provider,issuer,client_id,subject,email,display_name,linked_at) VALUES(?,?,?,?,?,?,?,?,?)",
        crypto.randomUUID(),id,provider,issuer,clientId,subject,email,identity.displayName||null,now());
      return {status:200,userId:id,created:true};
    });
    if(result.error||intent==="link")return result;

    const user=this.sql.exec("SELECT id,email FROM users WHERE id=?",result.userId).toArray()[0];
    if(!user)return {status:401,error:"Account unavailable.",code:"unavailable"};
    const security=this.security(user.id);
    if(security&&!security.verified_at&&!security.legacy){
      if(result.created&&!identity.verified) {
        const token=await this.issueLink(user.id,"verify");
        return {status:202,pending:true,delivery:{kind:"verify",to:user.email,token}};
      }
      return {status:403,error:"Verify the account email before signing in.",code:"email_unverified"};
    }
    if(security?.mfa_secret){
      const challenge=randomToken();
      this.sql.exec("INSERT INTO mfa_challenges(hash,user_id,expires_at) VALUES(?,?,?)",
        await sha256(challenge),user.id,now()+300);
      return {status:200,mfa_required:true,challenge};
    }
    const token=await this.makeSession(user.id);
    return {status:200,token,user:{...user,verified:!!security?.verified_at,mfaEnabled:false}};
  }
  async unlinkFederation({token,id}){
    const user=await this.session(token);
    if(!user)return {status:401,error:"Not authenticated."};
    if(typeof id!=="string"||!/^[-a-f0-9]{36}$/.test(id))
      return {status:400,error:"Invalid linked identity."};
    const result=this.ctx.storage.transactionSync(()=>{
      const record=this.sql.exec("SELECT user_id FROM federated_identities WHERE id=?",id).toArray()[0];
      if(!record||record.user_id!==user.id)return {status:404,error:"Linked identity not found."};
      const count=this.sql.exec("SELECT COUNT(*) AS n FROM federated_identities WHERE user_id=?",user.id).toArray()[0].n;
      if(!this.hasPassword(user.id)&&count<=1)
        return {status:409,error:"Keep at least one sign-in method linked."};
      this.sql.exec("DELETE FROM federated_identities WHERE id=? AND user_id=?",id,user.id);
      // Other sessions could have authenticated using the removed identity.
      this.sql.exec("DELETE FROM sessions WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM mfa_challenges WHERE user_id=?",user.id);
      return {status:200,unlinked:true,reauthenticate:true};
    });
    return result;
  }
  async resetPassword(args){
    const token=args?.token;
    const row=secureToken(token)?this.sql.exec(
      "SELECT user_id FROM mail_tokens WHERE hash=? AND kind='reset' AND expires_at>?",
      await sha256(token),now()).toArray()[0]:null;
    const result=await super.resetPassword(args);
    if(result.status===200&&row){
      this.sql.exec("INSERT INTO account_methods(user_id,has_password) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET has_password=1",row.user_id);
    }
    return result;
  }
  async deleteAccount(args) {
    const user=await this.session(args?.token);
    const result=await super.deleteAccount(args);
    if(result.status===204&&user) {
      this.ctx.storage.transactionSync(()=>{
        this.sql.exec("DELETE FROM federated_identities WHERE user_id=?",user.id);
        this.sql.exec("DELETE FROM account_methods WHERE user_id=?",user.id);
      });
    }
    return result;
  }
}
