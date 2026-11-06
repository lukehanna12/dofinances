// Host-isolated static assets and D1-free, server-enforced session routing.
import {parseCookie, sessionCookie, expireCookie, sha256} from "./auth-core.mjs";
import {mailReady,sendAccountEmail} from "./auth-mail.mjs";
const ROOT="dofinances.com";
const RESERVED=new Set(["stu","pay","zb30895346","_domainconnect","_dmarc","zmail","gd-origin"]);
const LABEL=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NO_STORE={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"};

export function siteFolder(hostname) {
  const host=hostname.toLowerCase();
  if (host===ROOT) return "_apex";
  if (host==="www."+ROOT) return "_www";
  if (!host.endsWith("."+ROOT)) return null;
  const label=host.slice(0,-(ROOT.length+1));
  return LABEL.test(label) && !RESERVED.has(label) ? label : null;
}
export function assetCandidates(folder,pathname) {
  if(!pathname.startsWith("/")) return [];
  const base="/"+folder+pathname;
  if(pathname==="/") return ["/"+folder+"/index.html"];
  if(pathname.endsWith("/")) return [base+"index.html"];
  const leaf=pathname.slice(pathname.lastIndexOf("/")+1);
  if(leaf.includes(".")) return [base];
  return [base,base+".html",base+"/index.html"];
}
function json(body,status=200,other={}) {
  return Response.json(body,{status,headers:{...NO_STORE,...other}});
}
function redirect(path,status=302) {
  return new Response(null,{status,headers:{...NO_STORE,Location:path}});
}
function store(env) {
  return env.AUTH_STORE?.get(env.AUTH_STORE.idFromName("primary"));
}
async function getUser(request,env) {
  const token=parseCookie(request.headers.get("Cookie"));
  if(!token) return null;
  const stub=store(env);
  if(!stub) return null;
  return stub.session(token);
}
async function api(request,env,pathname) {
  const method=request.method;
  const token=parseCookie(request.headers.get("Cookie"));
  const stub=store(env);
  if(!stub)return json({error:"Authentication temporarily unavailable."},503);
  if(pathname==="/api/auth/config" && method==="GET")
    return json({emailAvailable:mailReady(env),mfaAvailable:!!env.MFA_ENCRYPTION_KEY});
  if(pathname==="/api/auth/me" && method==="GET"){
    const user=token?await stub.session(token):null;
    return user?json({user}):json({error:"Not authenticated."},401);
  }
  if(pathname==="/api/auth/mfa/status" && method==="GET"){
    const result=await stub.mfaStatus(token);
    return json(result.error?{error:result.error}:result,result.status);
  }
  const actions={
    "/api/auth/signup":"signup", "/api/auth/login":"login",
    "/api/auth/logout":"logout", "/api/auth/account":"account",
    "/api/auth/verification/request":"verificationRequest",
    "/api/auth/verification/confirm":"verifyEmail",
    "/api/auth/password/forgot":"passwordRecoveryRequest",
    "/api/auth/password/reset":"resetPassword",
    "/api/auth/mfa/finish":"finishMfa",
    "/api/auth/mfa/setup":"mfaSetup",
    "/api/auth/mfa/confirm":"mfaConfirm",
    "/api/auth/mfa/disable":"mfaDisable"
  };
  const action=actions[pathname];
  if(!action)return json({error:"Not found."},404);
  const expected=action==="account"?"DELETE":"POST";
  if(method!==expected)return json({error:"Method not allowed."},405,{Allow:expected});
  if(request.headers.get("Origin")!=="https://dofinances.com")
    return json({error:"Forbidden origin."},403);
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    return json({error:"Expected JSON."},415);
  const length=Number(request.headers.get("Content-Length")||"0");
  if(!Number.isFinite(length)||length>4096)return json({error:"Request too large."},413);
  let body;
  try{
    const raw=await request.text();
    if(raw.length>4096)return json({error:"Request too large."},413);
    body=JSON.parse(raw);
    if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Invalid payload");
  }catch{return json({error:"Invalid JSON."},400);}
  if(action==="logout"){
    await stub.logout(token);
    return json({ok:true},200,{"Set-Cookie":expireCookie()});
  }
  if(action==="signup"||action==="verificationRequest"||action==="passwordRecoveryRequest"){
    if(!mailReady(env))return json({error:"Email delivery is not configured. Account email features are temporarily unavailable."},503);
  }
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const ipKey=await sha256(ip);
  const args={...body,ipKey};
  let result;
  switch(action){
    case "signup": result=await stub.signup(args); break;
    case "login": result=await stub.login(args); break;
    case "verificationRequest": result=await stub.verificationRequest(args); break;
    case "verifyEmail": result=await stub.verifyEmail(body.token); break;
    case "passwordRecoveryRequest": result=await stub.passwordRecoveryRequest(args); break;
    case "resetPassword": result=await stub.resetPassword(args); break;
    case "finishMfa": result=await stub.finishMfa(args); break;
    case "mfaSetup": result=await stub.mfaSetup({...args,token}); break;
    case "mfaConfirm": result=await stub.mfaConfirm({...args,token}); break;
    case "mfaStatus": result=await stub.mfaStatus(token); break;
    case "mfaDisable": result=await stub.mfaDisable({...args,token}); break;
    case "account": result=await stub.deleteAccount({...args,token}); break;
  }
  if(result.delivery){
    try{await sendAccountEmail(env,result.delivery);}
    catch{
      if(action==="verificationRequest"||action==="passwordRecoveryRequest")
        return json({ok:true,message:"If this address is eligible, check your email for instructions."});
      return json({error:"We could not send the email. Please request another verification link later."},503);
    }
  }
  if(result.status===204)return new Response(null,{status:204,headers:{...NO_STORE,"Set-Cookie":expireCookie()}});
  if(result.error)return json({
    error:result.error,
    ...(result.verification_required?{verification_required:true}:{})
  },result.status);
  if(result.token&&action==="login"||result.token&&action==="finishMfa")
    return json({user:result.user},result.status,{"Set-Cookie":sessionCookie(result.token)});
  if(action==="mfaConfirm"||action==="mfaDisable")
    return json(result,result.status,action==="mfaDisable"?{"Set-Cookie":expireCookie()}:{});
  if(action==="signup"||action==="verificationRequest"||action==="passwordRecoveryRequest")
    return json({ok:true,pending:!!result.pending,message:"If this address is eligible, check your email for instructions."},result.status);
  if(action==="login"&&result.mfa_required)
    return json({mfa_required:true,challenge:result.challenge},result.status);
  const safe={...result};
  delete safe.delivery;delete safe.token;delete safe.status;
  return json(safe,result.status);
}
async function serveAsset(request,env,folder,path,privatePage=false) {
  if(!env.ASSETS?.fetch) return new Response("Static assets not configured",{status:503,headers:NO_STORE});
  for(const file of assetCandidates(folder,path)){
    const asset=await env.ASSETS.fetch(new Request("https://assets.invalid"+file,{method:"GET"}));
    if(asset.status===404) continue;
    if(asset.status<200||asset.status>=300) return asset;
    const headers=new Headers(asset.headers);
    headers.set("X-Content-Type-Options","nosniff");
    if(privatePage||file.endsWith(".html")) headers.set("Cache-Control","no-store");
    if(privatePage) {
      headers.set("Vary","Cookie");
      headers.set("X-Frame-Options","DENY");
    }
    return new Response(request.method==="HEAD"?null:asset.body,{
      status:asset.status,statusText:asset.statusText,headers
    });
  }
  return null;
}
export async function handleRequest(request,env={}) {
  const url=new URL(request.url);
  const folder=siteFolder(url.hostname);
  if(folder===null) return new Response("Unknown host",{status:404,headers:NO_STORE});
  // www has no authentication cookies; preserve canonical apex origin for all auth routes.
  if(folder==="_www" && (/^\/(login|app|dashboard|verify|reset)(\/|$)/.test(url.pathname)||url.pathname.startsWith("/api/auth/"))) {
    url.hostname=ROOT;
    return redirect(url.href,301);
  }
  if(folder==="_apex" && url.pathname.startsWith("/api/auth/")) {
    try{return await api(request,env,url.pathname);}
    catch{return json({error:"Authentication service unavailable."},503);}
  }
  if(request.method!=="GET" && request.method!=="HEAD")
    return new Response("Method not allowed",{status:405,headers:{...NO_STORE,Allow:"GET, HEAD"}});
  if(folder==="_apex" && /^\/(app|dashboard)(\/|$)/.test(url.pathname)) {
    try {
      const user=await getUser(request,env);
      if(!user) return redirect("/login");
      const path=url.pathname.replace(/^\/dashboard(?=\/|$)/,"/app");
      const asset=await serveAsset(request,env,folder,path,true);
      return asset||new Response("Not found",{status:404,headers:NO_STORE});
    } catch{return new Response("Authentication service unavailable",{status:503,headers:NO_STORE});}
  }
  const asset=await serveAsset(request,env,folder,url.pathname);
  if(asset) return asset;
  if(folder==="_www"){url.hostname=ROOT;return redirect(url.href,301);}
  return new Response("Not found",{status:404,headers:NO_STORE});
}
