// Identity-only federation for Dofinances. No provider OAuth tokens are persisted.
// Fixed upstream endpoints prevent an OAuth configuration from becoming an SSRF proxy.
// Cloudflare Workers rejects the fetch redirect mode "error"; use "manual" and
// reject all non-2xx responses, including 3xx, before reading provider data.
import {randomToken, normalizedEmail} from "./auth-core.mjs";

export const FEDERATION_LIMITS = Object.freeze({google:5, github:3});
export const OAUTH_COOKIE = "__Host-dofinances_oauth";
export const OAUTH_TTL = 600;
const CALLBACK = "https://dofinances.com/api/auth/oauth/callback/";
const textEncoder = new TextEncoder();

export function federationProvider(env, provider) {
  if (provider === "google") {
    const clientId=env.GOOGLE_OAUTH_CLIENT_ID,secret=env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !secret) return null;
    return {provider,clientId,secret,issuer:"https://accounts.google.com",
      authorize:"https://accounts.google.com/o/oauth2/v2/auth",
      token:"https://oauth2.googleapis.com/token",
      jwks:"https://www.googleapis.com/oauth2/v3/certs",
      scope:"openid profile email",method:"post"};
  }
  if (provider === "github") {
    const clientId=env.GITHUB_OAUTH_CLIENT_ID,secret=env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !secret) return null;
    return {provider,clientId,secret,issuer:"https://github.com",
      authorize:"https://github.com/login/oauth/authorize",
      token:"https://github.com/login/oauth/access_token",
      scope:"read:user user:email",method:"post"};
  }
  return null;
}
export function federationAvailability(env) {
  return Object.fromEntries(Object.entries(FEDERATION_LIMITS).map(([provider,max])=>
    [provider,{enabled:!!federationProvider(env,provider),max}]));
}
function b64u(bytes){
  return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function fromB64u(value){
  if(typeof value!=="string"||!/^[A-Za-z0-9_-]+$/.test(value))throw Error("Invalid identity encoding");
  const s=atob(value.replaceAll("-","+").replaceAll("_","/"));
  return Uint8Array.from(s,x=>x.charCodeAt(0));
}
export async function pkceChallenge(verifier){
  const b=await crypto.subtle.digest("SHA-256",textEncoder.encode(verifier));
  return b64u(new Uint8Array(b));
}
export function newOAuthTransaction(){
  return {state:randomToken(),verifier:randomToken(),nonce:randomToken()};
}
export function oauthCookie(state){
  return OAUTH_COOKIE+"="+state+"; Path=/; Max-Age="+OAUTH_TTL+"; HttpOnly; Secure; SameSite=Lax";
}
export function expiredOAuthCookie(){
  return OAUTH_COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}
export function readOAuthCookie(header){
  const p=(header||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(OAUTH_COOKIE+"="));
  const v=p?.slice(OAUTH_COOKIE.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(v||"")?v:null;
}
export async function oauthAuthorizeUrl(config,txn){
  const u=new URL(config.authorize);
  const v={client_id:config.clientId,redirect_uri:CALLBACK+config.provider,
    response_type:"code",scope:config.scope,state:txn.state,
    code_challenge:await pkceChallenge(txn.verifier),code_challenge_method:"S256"};
  if(config.provider!=="github")v.nonce=txn.nonce;
  for(const [k,value] of Object.entries(v))u.searchParams.set(k,value);
  if(config.provider==="google"){u.searchParams.set("prompt","select_account");}
  if(config.provider==="github"){u.searchParams.set("prompt","select_account");}
  return u.toString();
}
// Only closed, non-sensitive failure categories reach first-party redirects.
// Never return provider response bodies, codes, tokens, emails, or client secrets.
export class FederationFailure extends Error {
  constructor(code){super("OAuth operation failed");this.code=code;}
}
// Closed, non-sensitive failure codes only. OAuth tokens, secrets, provider
// descriptions and arbitrary upstream response strings are never exposed.
const TOKEN_ERROR_CODES=Object.freeze({
  invalid_client:"oauth_client_rejected",
  unauthorized_client:"oauth_client_rejected",
  incorrect_client_credentials:"oauth_client_rejected",
  redirect_uri_mismatch:"oauth_callback_mismatch",
  bad_verification_code:"oauth_code_rejected",
  invalid_grant:"oauth_code_rejected",
  unverified_user_email:"oauth_github_email_unverified",
  slow_down:"oauth_provider_rate_limited",
  rate_limit_exceeded:"oauth_provider_rate_limited",
  unsupported_grant_type:"oauth_grant_rejected",
  invalid_request:"oauth_request_rejected"
});
function tokenErrorCode(data,status){
  const upstream=typeof data?.error==="string"?data.error:"";
  if(Object.hasOwn(TOKEN_ERROR_CODES,upstream))return TOKEN_ERROR_CODES[upstream];
  if(status===429)return "oauth_provider_rate_limited";
  if(status===403)return "oauth_provider_forbidden";
  if(status===401)return "oauth_client_rejected";
  if(status>=500)return "oauth_provider_unavailable";
  if(status>=300&&status<400)return "oauth_provider_redirected";
  return "oauth_token_rejected";
}
async function jsonFromResponse(res,stage="profile"){
  if(stage==="token"){
    // GitHub's token endpoint may return OAuth error JSON with HTTP 200.
    // Examine the status and allowlisted error code, never error_description.
    const body=await res.text();
    let parsed=null;
    if(body.length<=4096){try{parsed=JSON.parse(body);}catch{}}
    if(!res.ok||parsed?.error)
      throw new FederationFailure(tokenErrorCode(parsed,res.status));
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
      throw new FederationFailure("oauth_response_invalid");
    return parsed;
  }
  if(!res.ok)
    throw new FederationFailure(stage==="jwks"?"oauth_jwks_unavailable":"oauth_profile_unavailable");
  const body=await res.text();
  if(body.length>200000)throw new FederationFailure("oauth_response_invalid");
  try{return JSON.parse(body);}
  catch{throw new FederationFailure("oauth_response_invalid");}
}
async function verifyIdToken(jwt,config,txn) {
  if(typeof jwt!=="string"||jwt.length>20000)throw Error("Invalid identity token");
  const pieces=jwt.split(".");
  if(pieces.length!==3)throw Error("Malformed identity token");
  const header=JSON.parse(new TextDecoder().decode(fromB64u(pieces[0])));
  const payload=JSON.parse(new TextDecoder().decode(fromB64u(pieces[1])));
  if(header.alg!=="RS256"||typeof header.kid!=="string"||!header.kid||
     typeof payload.sub!=="string"||!payload.sub||payload.sub.length>256)
    throw Error("Unsupported identity token");
  const jwks=await jsonFromResponse(await fetch(config.jwks,{headers:{Accept:"application/json"},
    redirect:"manual",signal:AbortSignal.timeout(10000)},"jwks"));
  const key=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA"&&
    (!k.use||k.use==="sig")&&(!k.alg||k.alg==="RS256"));
  if(!key)throw Error("Unknown identity signing key");
  const cryptoKey=await crypto.subtle.importKey("jwk",{kty:key.kty,n:key.n,e:key.e,
    alg:"RS256",ext:true}, {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const verified=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",cryptoKey,
    fromB64u(pieces[2]),textEncoder.encode(pieces[0]+"."+pieces[1]));
  if(!verified)throw Error("Identity signature invalid");
  const now=Math.floor(Date.now()/1000);
  const issuerOk=payload.iss===config.issuer ||
    (config.provider==="google"&&payload.iss==="accounts.google.com");
  const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(!issuerOk||!audience.includes(config.clientId)||
     ((audience.length>1||payload.azp!==undefined)&&payload.azp!==config.clientId)||
     !Number.isFinite(payload.exp)||payload.exp<=now-60||
     !Number.isFinite(payload.iat)||payload.iat>now+60||
     payload.nonce!==txn.nonce)
    throw Error("Identity token claims invalid");
  return {provider:config.provider,issuer:config.issuer,clientId:config.clientId,
    subject:payload.sub,email:normalizedEmail(payload.email),
    verified:payload.email_verified===true,displayName:typeof payload.name==="string"?
      payload.name.slice(0,140):null};
}
export async function exchangeFederatedIdentity(config,code,txn){
  if(typeof code!=="string"||!code||code.length>4096)throw Error("Invalid authorization code");
  const body=new URLSearchParams({code,redirect_uri:CALLBACK+config.provider,
    client_id:config.clientId,code_verifier:txn.verifier});
  // GitHub documents the exact code, client and PKCE parameters, but not
  // grant_type for this endpoint. Google follows the standard OAuth grant.
  if(config.provider!=="github")body.set("grant_type","authorization_code");
  const headers={"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"};
  if(config.provider==="github")headers["User-Agent"]="DoFinances-OAuth/1.0";
  if(config.method==="basic"){
    const encoded=x=>new URLSearchParams({value:x}).toString().slice("value=".length);
    headers.Authorization="Basic "+btoa(encoded(config.clientId)+":"+encoded(config.secret));
  } else if(config.method==="post")body.set("client_secret",config.secret);
  const res=await fetch(config.token,{method:"POST",headers,body,redirect:"manual",
    signal:AbortSignal.timeout(10000)});
  const result=await jsonFromResponse(res,"token");
  if(config.provider!=="github"){
    try{return await verifyIdToken(result.id_token,config,txn);}
    catch{throw new FederationFailure("oauth_identity_invalid");}
  }
  const token=result.access_token;
  if(typeof token!=="string"||token.length>4096||!token)throw Error("No provider access token");
  const apiHeaders={"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,
    "X-GitHub-Api-Version":"2022-11-28","User-Agent":"Dofinances-Identity"};
  const [profile,emails]=await Promise.all([
    fetch("https://api.github.com/user",{headers:apiHeaders,redirect:"manual",
      signal:AbortSignal.timeout(10000)}).then(jsonFromResponse),
    fetch("https://api.github.com/user/emails",{headers:apiHeaders,redirect:"manual",
      signal:AbortSignal.timeout(10000)}).then(jsonFromResponse)
  ]);
  if(!Number.isSafeInteger(profile.id)||profile.id<=0||!Array.isArray(emails))
    throw Error("Invalid GitHub identity");
  const verified=emails.filter(x=>x.verified===true&&normalizedEmail(x.email));
  const selected=verified.find(x=>x.primary===true)||verified[0]||null;
  return {provider:"github",issuer:config.issuer,clientId:config.clientId,
    subject:String(profile.id),email:selected?normalizedEmail(selected.email):null,
    verified:!!selected,displayName:typeof profile.login==="string"?
      profile.login.slice(0,140):null};
}
