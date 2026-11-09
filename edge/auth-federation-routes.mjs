// First-party authorization-code callback handler. No OAuth credentials reach the browser.
import {parseCookie,sha256,sessionCookie} from "./auth-core.mjs";
import {mailReady,sendAccountEmail} from "./auth-mail.mjs";
import {federationProvider,newOAuthTransaction,oauthAuthorizeUrl,exchangeFederatedIdentity,
  oauthCookie,expiredOAuthCookie,readOAuthCookie,FederationFailure} from "./auth-federation.mjs";
const ORIGIN="https://dofinances.com";
const MFA_COOKIE="__Host-dofinances_oauth_mfa";
const BASE_HEADERS={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const errorCodes=["link_required","identity_used","limit","email_required","email_unverified"];
function safeError(result){return errorCodes.includes(result?.code)?result.code:"unavailable";}
function resultRedirect(intent,error,cookies=[]){
  const url=new URL(intent==="link"?"/app":"/login",ORIGIN);
  if(error)url.searchParams.set("federation_error",error);
  const h=new Headers({...BASE_HEADERS,Location:url.pathname+url.search});
  for(const c of cookies)h.append("Set-Cookie",c);
  return new Response(null,{status:303,headers:h});
}
export function readFederatedMfaCookie(header){
  const p=(header||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(MFA_COOKIE+"="));
  const token=p?.slice(MFA_COOKIE.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(token||"")?token:null;
}
export function expireFederatedMfaCookie(){
  return MFA_COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}
export async function handleFederation(request,env,pathname){
  if(request.method!=="GET")return Response.json({error:"Method not allowed."},{status:405,headers:BASE_HEADERS});
  const url=new URL(request.url);
  const callback=pathname.startsWith("/api/auth/oauth/callback/");
  const provider=callback?pathname.slice("/api/auth/oauth/callback/".length):url.searchParams.get("provider");
  const intent=url.searchParams.get("intent")==="link"?"link":"signin";
  const conf=federationProvider(env,provider);
  const sessionToken=parseCookie(request.headers.get("Cookie"));
  const stub=env.AUTH_STORE?.get(env.AUTH_STORE.idFromName("primary"));
  if(!stub)return resultRedirect(intent,"unavailable");
  if(!callback){
    if(!conf)return resultRedirect(intent,"unavailable");
    const txn=newOAuthTransaction();
    const ipKey=await sha256(request.headers.get("CF-Connecting-IP")||"unknown");
    const begun=await stub.beginFederation({...txn,provider,intent,sessionToken,ipKey});
    if(begun.status!==200)return resultRedirect(intent,safeError(begun));
    return new Response(null,{status:302,
      headers:{...BASE_HEADERS,Location:await oauthAuthorizeUrl(conf,txn),"Set-Cookie":oauthCookie(txn.state)}});
  }
  const state=url.searchParams.get("state"),cookieState=readOAuthCookie(request.headers.get("Cookie"));
  const clear=expiredOAuthCookie();
  if(!conf||!state||state!==cookieState||!/^[A-Za-z0-9_-]{43}$/.test(state))
    return resultRedirect("signin","invalid",[clear]);
  const consumed=await stub.consumeFederation({state,provider,sessionToken});
  if(consumed.status!==200)return resultRedirect("signin","invalid",[clear]);
  const operation=consumed.intent;
  if(url.searchParams.has("error"))return resultRedirect(operation,"cancelled",[clear]);
  // Distinguish failed provider exchange/verification from account persistence,
  // without returning provider responses or any user data to the browser.
  let stage="provider";
  try{
    const identity=await exchangeFederatedIdentity(conf,url.searchParams.get("code"),consumed);
    stage="account";
    const done=await stub.completeFederation({intent:operation,identity,sessionToken});
    if(done.error)return resultRedirect(operation,safeError(done),[clear]);
    stage="mail";
    if(done.delivery){
      if(!mailReady(env))return resultRedirect("signin","unavailable",[clear]);
      await sendAccountEmail(env,done.delivery);
    }
    if(done.mfa_required){
      const h=new Headers({...BASE_HEADERS,Location:"/login?oauth_mfa=1"});
      h.append("Set-Cookie",clear);
      h.append("Set-Cookie",MFA_COOKIE+"="+done.challenge+"; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Lax");
      return new Response(null,{status:303,headers:h});
    }
    const target=operation==="link"?"/app?federation_linked=1":
      done.pending?"/login?federation_pending=1":"/app";
    const h=new Headers({...BASE_HEADERS,Location:target});
    h.append("Set-Cookie",clear);
    if(done.token)h.append("Set-Cookie",sessionCookie(done.token));
    return new Response(null,{status:303,headers:h});
  } catch (error) {
    const code=stage==="provider"
      ? error instanceof FederationFailure?error.code:"oauth_provider_network_error"
      : stage==="account"?"oauth_account_store_failed":"oauth_mail_unavailable";
    return resultRedirect(operation,code,[clear]);
  }
}
