import {WORKSPACE_WALLPAPERS} from "../sites/_apex/app/assets/workspace-wallpapers.js";
// Host-isolated static assets and D1-free, server-enforced session routing.
import {parseCookie, sessionCookie, expireCookie, sha256} from "./auth-core.mjs";
import {verifyColosseumOwnerJwt} from "./colosseum-owner.mjs";
import {cloudflareRequest,verifyCloudflareIdentity,normalizedCloudflarePolicy,DEFAULT_CLOUDFLARE_POLICY,sealCloudflareToken,openCloudflareToken} from "./cloudflare-connection.mjs";
import {mailReady,sendAccountEmail} from "./auth-mail.mjs";
import {federationAvailability} from "./auth-federation.mjs";
import {handleFederation,readFederatedMfaCookie,expireFederatedMfaCookie} from "./auth-federation-routes.mjs";
const ROOT="dofinances.com";
const RESERVED=new Set(["stu","pay","zb30895346","_domainconnect","_dmarc","zmail","gd-origin"]);
const LABEL=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NO_STORE={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"};
// A deliberately small public allowlist: the website only exposes the eight
// wallpaper images selected from private Colosseum library-iii (0001b9).
// All other private library objects remain inaccessible through Dofinances.
const WALLPAPER_ALLOWLIST=new Map(Object.values(WORKSPACE_WALLPAPERS).map(w=>[
  w.sha+"."+w.ext,w
]));
const WALLPAPER_MIME={jpg:"image/jpeg",png:"image/png",webp:"image/webp",avif:"image/avif"};
async function serveWallpaper(request,env,pathname){
  const key=pathname.startsWith("/wallpapers/")?pathname.slice("/wallpapers/".length):"";
  const wallpaper=WALLPAPER_ALLOWLIST.get(key);
  if(!wallpaper)return new Response("Not found",{status:404,headers:NO_STORE});
  if(!env.LIBRARY_III?.fetch)
    return new Response("Wallpaper library unavailable",{status:503,headers:NO_STORE});
  let response;
  try {
    response=await env.LIBRARY_III.fetch(new Request(
      "https://library-iii.internal/objects/"+wallpaper.sha+".bin",
      {method:request.method}
    ));
  } catch {return new Response("Wallpaper library unavailable",{status:502,headers:NO_STORE});}
  if(!response.ok)return new Response("Wallpaper unavailable",{status:502,headers:NO_STORE});
  const headers=new Headers({
    "Content-Type":WALLPAPER_MIME[wallpaper.ext],
    "Cache-Control":"public, max-age=31536000, immutable",
    "X-Content-Type-Options":"nosniff",
    "X-Robots-Tag":"noindex",
    "Access-Control-Allow-Origin":"*"
  });
  return new Response(request.method==="HEAD"?null:response.body,{status:200,headers});
}


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
    return json({emailAvailable:mailReady(env),mfaAvailable:!!env.MFA_ENCRYPTION_KEY,federation:federationAvailability(env)});
  if(pathname==="/api/auth/federation/accounts" && method==="GET"){
    const result=await stub.federatedAccounts(token);
    return json(result.error?{error:result.error}:result,result.status);
  }
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
    "/api/auth/mfa/disable":"mfaDisable",
    "/api/auth/federation/unlink":"unlinkFederation"
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
    case "finishMfa": result=await stub.finishMfa({...args,challenge:body.challenge||readFederatedMfaCookie(request.headers.get("Cookie"))}); break;
    case "mfaSetup": result=await stub.mfaSetup({...args,token}); break;
    case "mfaConfirm": result=await stub.mfaConfirm({...args,token}); break;
    case "mfaStatus": result=await stub.mfaStatus(token); break;
    case "mfaDisable": result=await stub.mfaDisable({...args,token}); break;
    case "account": result=await stub.deleteAccount({...args,token}); break;
    case "unlinkFederation": result=await stub.unlinkFederation({...args,token}); break;
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
  if(action==="unlinkFederation"&&result.unlinked)return json({unlinked:true,reauthenticate:true},200,{"Set-Cookie":expireCookie()});
  if(result.error)return json({
    error:result.error,
    ...(result.verification_required?{verification_required:true}:{})
  },result.status);
  if(result.token&&(action==="login"||action==="finishMfa")){
    const headers=new Headers(NO_STORE);headers.append("Set-Cookie",sessionCookie(result.token));
    if(action==="finishMfa")headers.append("Set-Cookie",expireFederatedMfaCookie());
    return Response.json({user:result.user},{status:result.status,headers});
  }
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

// Direct owner-to-Colosseum administration. Cloudflare Access JWT and the
// immutable DoFinances user ID are verified BEFORE any request is signed.
// The signed assertion is valid for two minutes, never contains credentials,
// and cannot be generated by a different registered DoFinances user.
async function colosseumCatalogForward(request,env,name){
  if(!["catalog.add","catalog.update","catalog.remove","system.status","provider.admin","permissions.manage","collection.manage"].includes(name))
    return json({error:"Not found."},404);
  if(request.method!=="POST")return json({error:"Method not allowed."},405,{Allow:"POST"});
  if((request.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase()!=="application/json")
    return json({error:"Expected JSON."},415);
  if(!env.COLOSSEUM_ROUTER?.fetch||!env.COLOSSEUM_ADMIN_CALL_SECRET)
    return json({error:"Colosseum administration is not connected."},503);
  const body=await request.text();
  if(body.length>(name==="system.status"?4096:name==="provider.admin"?20000:name==="permissions.manage"||name==="collection.manage"?40960:11500000))return json({error:"Request too large."},413);
  let argumentsObject;
  try{argumentsObject=JSON.parse(body);}
  catch{return json({error:"Invalid JSON."},400);}
  if(!argumentsObject||typeof argumentsObject!=="object"||Array.isArray(argumentsObject))
    return json({error:"Invalid request arguments."},400);
  if(name==="system.status"){
    const allowedSections=new Set(["workers","kv","d1","durable_objects","rate_limiting","static_assets","configuration","api_limits","local"]);
    const allowedChecks=new Set(["ping","gateway","oauth","ingress","registry","providers","browser","filesystem","execution","policy","sync","artifacts","full"]);
    if(Object.keys(argumentsObject).some(k=>!["sections","check","depth"].includes(k))||
      (argumentsObject.sections!==undefined&&(!Array.isArray(argumentsObject.sections)||!argumentsObject.sections.length||argumentsObject.sections.length>9||new Set(argumentsObject.sections).size!==argumentsObject.sections.length||argumentsObject.sections.some(x=>!allowedSections.has(x))))||
      (argumentsObject.check!==undefined&&!allowedChecks.has(argumentsObject.check))||
      (argumentsObject.depth!==undefined&&!["quick","standard","deep"].includes(argumentsObject.depth)))
      return json({error:"Invalid diagnostics query."},400);
  }
  const payload=JSON.stringify({name,arguments:argumentsObject});
  const timestamp=Date.now(),nonce=crypto.randomUUID(),digest=await sha256(payload);
  const stringToSign=timestamp+"."+nonce+"."+digest;
  const key=await crypto.subtle.importKey("raw",
    new TextEncoder().encode(env.COLOSSEUM_ADMIN_CALL_SECRET),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(stringToSign)));
  const binary=String.fromCharCode(...sig);
  const signature=btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  let response;
  try{
    response=await env.COLOSSEUM_ROUTER.fetch(new Request(
      "https://router.colosseum.workers.dev/internal/catalog",{
        method:"POST",headers:{"Content-Type":"application/json","X-Colosseum-Time":String(timestamp),
          "X-Colosseum-Nonce":nonce,"X-Colosseum-Signature":signature},
        body:payload
      }));
  }catch{return json({error:"Colosseum router temporarily unavailable."},502);}
  let result;
  try{result=await response.json();}
  catch{return json({error:"Colosseum router returned an invalid response."},502);}
  return json(result,response.status);
}

// Only this narrow path is protected by the sole-owner Cloudflare Access app.
// Every request also requires the existing signed-in DoFinances account cookie.
// No catalog or resource mutation operation is exposed here.
async function colosseumOwnerApi(request,env,pathname) {
  const method=request.method;
  const catalogMatch=/^\/api\/colosseum\/catalog\/(add|update|remove)$/.exec(pathname);
  const diagnostics=pathname==="/api/colosseum/diagnostics";
  const providers=pathname==="/api/colosseum/providers";
  const permissions=pathname==="/api/colosseum/permissions";
  const collections=pathname==="/api/colosseum/collections";
  const providerCallback=pathname==="/api/colosseum/providers/callback";
  const allowed=pathname==="/api/colosseum/connect"||pathname==="/api/colosseum/status"||!!catalogMatch||diagnostics||providers||providerCallback||permissions||collections;
  if(!allowed)return json({error:"Not found."},404);
  if(diagnostics&&method!=="POST")return json({error:"Method not allowed."},405,{Allow:"POST"});
  if(collections&&!["GET","POST"].includes(method))return json({error:"Method not allowed."},405,{Allow:"GET, POST"});
  if(permissions&&!["GET","POST"].includes(method))return json({error:"Method not allowed."},405,{Allow:"GET, POST"});
  if(providers&&!["GET","POST"].includes(method))return json({error:"Method not allowed."},405,{Allow:"GET, POST"});
  if(providerCallback&&method!=="GET")return json({error:"Method not allowed."},405,{Allow:"GET"});
  if(!catalogMatch&&!diagnostics&&!providers&&!providerCallback&&!permissions&&!collections && method!=="GET"&&!(method==="POST"&&pathname==="/api/colosseum/connect"))
    return json({error:"Method not allowed."},405,{Allow:pathname.endsWith("/connect")?"GET, POST":"GET"});
  const user=await getUser(request,env);
  if(!user)return pathname.endsWith("/connect")&&method==="GET"?
    redirect("/login"):json({error:"DoFinances sign-in required."},401);
  if(method==="POST"&&request.headers.get("Origin")!=="https://dofinances.com")
    return json({error:"Forbidden origin."},403);
  let identity;
  try {
    // During the Access app cutover, accept either signed owner assertion:
    // shared Cloudflare app (30 days) or legacy Colosseum app (24h max).
    // Both are still signature-, audience-, issuer-, email- and owner-bound.
    const jwt=request.headers.get("Cf-Access-Jwt-Assertion");
    const sharedEnv={...env,COLOSSEUM_ACCESS_AUD:env.CLOUDFLARE_CONNECTION_ACCESS_AUD};
    identity=await verifyColosseumOwnerJwt(jwt,sharedEnv,fetch,30*24*60*60);
    if(!identity)identity=await verifyColosseumOwnerJwt(jwt,env);
  }catch {return json({error:"Colosseum owner authentication is not configured."},503);}
  if(!identity)return json({error:"Cloudflare owner verification required."},403);
  const stub=store(env);
  if(!stub)return json({error:"Account store unavailable."},503);
  const argument={userId:user.id,accessSubject:identity.subject};
  if(collections){
    const state=await stub.colosseumOwnerStatus(argument);
    if(!state.owner)return json({error:"Only the connected Colosseum administrator may manage collections."},403);
    if(method==="POST"&&request.headers.get("Sec-Fetch-Site")&&request.headers.get("Sec-Fetch-Site")!=="same-origin")
      return json({error:"Cross-site collection management request denied."},403);
    if(method==="GET"){
      const liveList=new Request("https://dofinances.com/api/colosseum/collections",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"list",page_size:100})});
      return colosseumCatalogForward(liveList,env,"collection.manage");
    }
    return colosseumCatalogForward(request,env,"collection.manage");
  }
  if(permissions){
    const state=await stub.colosseumOwnerStatus(argument);
    if(!state.owner)return json({error:"Only the connected Colosseum administrator may manage permissions."},403);
    if(method==="POST"&&request.headers.get("Sec-Fetch-Site")&&request.headers.get("Sec-Fetch-Site")!=="same-origin")
      return json({error:"Cross-site permission request denied."},403);
    if(method==="GET"){
      const status=new Request("https://dofinances.com/api/colosseum/permissions",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status"})});
      return colosseumCatalogForward(status,env,"permissions.manage");
    }
    return colosseumCatalogForward(request,env,"permissions.manage");
  }
  if(providers||providerCallback){
    const state=await stub.colosseumOwnerStatus(argument);
    if(!state.owner)return json({error:"Only the connected Colosseum administrator may manage providers."},403);
    if(providerCallback){
      const u=new URL(request.url),q=u.searchParams;
      const errorPage=code=>redirect("https://dofinances.com/app/?providers_error="+encodeURIComponent(code)+"#colosseum/providers",303);
      const val=(key,maximum)=>{const values=q.getAll(key);
        if(values.length>1)return null;
        const v=values[0]||"";return v.length<=maximum?v:null;};
      const code=val("code",8192),stateValue=val("state",128),
        error=val("error",200),issuer=val("iss",1024);
      if(!stateValue||code===null||error===null||issuer===null)
        return errorPage("invalid_oauth_callback");
      const payload={action:"oauth_finish",uid:"000008",config:{
        state:stateValue,code:code||"",error:error||"",iss:issuer||""}};
      const bridgeRequest=new Request("https://dofinances.com/api/colosseum/providers",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await colosseumCatalogForward(bridgeRequest,env,"provider.admin");
      const parsed=await result.json();
      if(!result.ok||parsed.status!=="connected"&&parsed.status!=="cancelled")
        return errorPage(String(parsed.error||"authorization_failed").slice(0,96));
      return redirect("https://dofinances.com/app/?providers_result="+encodeURIComponent(parsed.status)+"#colosseum/providers",303);
    }
    if(method==="POST"&&request.headers.get("Sec-Fetch-Site")&&request.headers.get("Sec-Fetch-Site")!=="same-origin")
      return json({error:"Cross-site provider management request denied."},403);
    if(method==="GET"){
      const inventory=new Request("https://dofinances.com/api/colosseum/providers",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"list"})});
      return colosseumCatalogForward(inventory,env,"provider.admin");
    }
    return colosseumCatalogForward(request,env,"provider.admin");
  }
  if(catalogMatch||diagnostics){
    const state=await stub.colosseumOwnerStatus(argument);
    if(!state.owner)return json({error:"Only the connected Colosseum administrator may access this operation."},403);
    return colosseumCatalogForward(request,env,diagnostics?"system.status":"catalog."+catalogMatch[1]);
  }
  if(pathname==="/api/colosseum/status"){
    const state=await stub.colosseumOwnerStatus(argument);
    return json({authenticated:true,owner:state.owner,linked:state.linked});
  }
  if(method==="POST"){
    const state=await stub.colosseumOwnerBind(argument);
    if(!state.owner)return json({error:"Colosseum ownership is already bound to a different identity."},409);
    return redirect("/app/?colosseum=connected#settings",303);
  }
  const state=await stub.colosseumOwnerStatus(argument);
  // Renew the separate Cloudflare Access API session via explicit navigation.
  // Only the already-bound owner may return directly to Collections.
  if(state.owner&&new URL(request.url).searchParams.get("return")==="collections")
    return redirect("/app/#colosseum/collections",303);
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Colosseum owner authorization</title>
<style>body{margin:0;min-height:100vh;background:#0c1018;color:#f2f4f9;display:grid;place-items:center;font-family:system-ui,sans-serif}
main{width:min(420px,calc(100% - 40px));padding:30px;border:1px solid #354056;border-radius:16px;background:#141b29}
p{color:#bac5d5;line-height:1.6;font-size:14px}button,a{border-radius:10px;padding:11px 17px;font:inherit}
button{background:#a7c6f6;border:0;color:#101827;cursor:pointer;font-weight:650}
a{color:#c5d9fa}form{margin-top:24px}</style></head>
<body><main><h1>Colosseum administrator</h1>
<p>Cloudflare has verified your owner identity. Bind this DoFinances account as Colosseum's sole administrator. This cannot be claimed by another registered user.</p>
${state.owner?'<p>This account is already connected.</p><a href="/app/#settings">Return to Settings</a>':
  state.linked?'<p>This administrator is already linked to a different account. No changes were made.</p>':
  '<form action="/api/colosseum/connect" method="post"><button type="submit">Authorize this account</button></form>'}
</main></body></html>`;
  return new Response(html,{status:200,headers:{...NO_STORE,"Content-Type":"text/html; charset=utf-8",
    "X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}


// Account-level Cloudflare access is distinct from project authorization.
// Cloudflare Access validates the owner identity, the DoFinances session binds
// the immutable user ID, and the stored user-issued token is encrypted in DO SQLite.
async function cloudflareAccountApi(request,env,pathname){
  const allowed=new Set(["/api/cloudflare/connect","/api/cloudflare/connection",
    "/api/cloudflare/scope","/api/cloudflare/request"]);
  if(!allowed.has(pathname))return json({error:"Not found."},404);
  const method=request.method;
  if(pathname==="/api/cloudflare/connect"&&method!=="GET"||
     pathname==="/api/cloudflare/connection"&&!["GET","POST","DELETE"].includes(method)||
     pathname==="/api/cloudflare/scope"&&method!=="PUT"||
     pathname==="/api/cloudflare/request"&&method!=="POST")
    return json({error:"Method not allowed."},405);
  const user=await getUser(request,env);
  if(!user)return pathname.endsWith("/connect")?redirect("/login"):json({error:"DoFinances sign-in required."},401);
  const ownerEmail=env.CLOUDFLARE_OWNER_ACCESS_EMAIL||env.COLOSSEUM_OWNER_ACCESS_EMAIL;
  if(!env.CLOUDFLARE_CONNECTION_ACCESS_AUD||!ownerEmail)
    return json({error:"Cloudflare owner access is not configured."},503);
  const accessEnv={...env,COLOSSEUM_ACCESS_AUD:env.CLOUDFLARE_CONNECTION_ACCESS_AUD,
    COLOSSEUM_OWNER_ACCESS_EMAIL:ownerEmail};
  let owner;
  try{owner=await verifyColosseumOwnerJwt(request.headers.get("Cf-Access-Jwt-Assertion"),accessEnv,fetch,30*24*60*60);}
  catch{return json({error:"Cloudflare authentication is unavailable."},503);}
  if(!owner)return json({error:"Cloudflare owner verification required."},403);
  const stub=store(env);
  if(!stub)return json({error:"Account store unavailable."},503);
  const state=await stub.cloudflareConnectionState({userId:user.id});
  if(state.status!==200)return json({error:state.error},state.status);
  if(pathname==="/api/cloudflare/connect")
    return redirect("/app/?cloudflare=verified#settings",303);
  // Access authentication establishes identity, not an API credential.
  // Return separate signals so Settings never presents verification as a completed connection.
  const withIdentity=connection=>({...connection,authenticated:true,verifiedEmail:ownerEmail});
  if(method==="GET")return json(withIdentity(state));
  if(request.headers.get("Origin")!=="https://dofinances.com"||
     request.headers.get("Sec-Fetch-Site")&&!["same-origin","none"].includes(request.headers.get("Sec-Fetch-Site")))
    return json({error:"Forbidden request origin."},403);
  if(method==="DELETE") {
    const outcome=await stub.cloudflareConnectionRemove({userId:user.id});
    return json(outcome.status===200?withIdentity(outcome):{error:outcome.error},outcome.status);
  }
  if((request.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase()!=="application/json")
    return json({error:"Expected JSON."},415);
  const length=Number(request.headers.get("Content-Length")||"0");
  if(!Number.isFinite(length)||length>100000)return json({error:"Request too large."},413);
  let body;
  try {
    const raw=await request.text();
    if(raw.length>100000)throw Error("too large");
    body=JSON.parse(raw);
    if(!body||typeof body!=="object"||Array.isArray(body))throw Error("invalid body");
  }catch{return json({error:"Invalid JSON payload."},400);}
  if(pathname==="/api/cloudflare/connection"){
    if(Object.keys(body).some(k=>!["token","policy"].includes(k)))
      return json({error:"Unrecognized connection field."},400);
    if(!env.MFA_ENCRYPTION_KEY)
      return json({error:"Encrypted connection storage is not configured."},503);
    let policy,verified,ciphertext;
    try {
      policy=normalizedCloudflarePolicy(body.policy||DEFAULT_CLOUDFLARE_POLICY);
      verified=await verifyCloudflareIdentity(body.token,ownerEmail);
      ciphertext=await sealCloudflareToken(body.token,env.MFA_ENCRYPTION_KEY,user.id);
    }catch(error){return json({error:error.message||"Cloudflare verification failed."},400);}
    const outcome=await stub.cloudflareConnectionSave({
      userId:user.id,cloudflareUserId:verified.cloudflareUserId,email:verified.email,
      tokenId:verified.tokenId,expiresOn:verified.expiresOn,
      ciphertext,policy
    });
    return json(outcome.status===200?withIdentity(outcome):{error:outcome.error},outcome.status);
  }
  if(pathname==="/api/cloudflare/scope"){
    let policy;
    try{policy=normalizedCloudflarePolicy(body);}
    catch(error){return json({error:error.message},400);}
    const outcome=await stub.cloudflareConnectionSetPolicy({userId:user.id,policy});
    return json(outcome.status===200?withIdentity(outcome):{error:outcome.error},outcome.status);
  }
  if(pathname==="/api/cloudflare/request"){
    if(Object.keys(body).some(k=>!["method","path","body"].includes(k)))
      return json({error:"Unrecognized Cloudflare API argument."},400);
    if(!state.connected)return json({error:"Connect Cloudflare first."},409);
    if(!env.MFA_ENCRYPTION_KEY)return json({error:"Connection encryption unavailable."},503);
    const credential=await stub.cloudflareConnectionState({userId:user.id,includeCredential:true});
    if(credential.status!==200||!credential.ciphertext)return json({error:"Connection is no longer available."},409);
    if(credential.expiresOn&&Date.parse(credential.expiresOn)<=Date.now())
      return json({error:"The Cloudflare token has expired. Reconnect using a new token."},401);
    try {
      const token=await openCloudflareToken(credential.ciphertext,env.MFA_ENCRYPTION_KEY,user.id);
      const result=await cloudflareRequest(token,{method:body.method,path:body.path,body:body.body},credential.policy);
      return json({status:result.status,result:result.body},result.ok?200:result.status>=400&&result.status<=599?result.status:502);
    }catch(error){return json({error:error.message||"Cloudflare request failed."},400);}
  }
  return json({error:"Not found."},404);
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
// Deep workspace URLs are exact allowlisted views; static assets remain distinct.
const WORKSPACE_VIEW_PATHS = new Set([
  "/app/home", "/app/projects", "/app/settings", "/app/account",
  "/app/colosseum", "/app/colosseum/utilities", "/app/colosseum/capabilities",
  "/app/colosseum/collections", "/app/colosseum/providers",
  "/app/colosseum/permissions", "/app/colosseum/diagnostics",
  "/app/colosseum/settings",
  "/app/apple-hig-reader", "/app/apple-hig-reader/overview",
]);

export async function handleRequest(request,env={}) {
  const url=new URL(request.url);
  const folder=siteFolder(url.hostname);
  if(folder===null) return new Response("Unknown host",{status:404,headers:NO_STORE});
  // www has no authentication cookies; preserve canonical apex origin for all auth routes.
  if(folder==="_www" && (/^\/(login|app|dashboard|verify|reset)(\/|$)/.test(url.pathname)||(url.pathname.startsWith("/api/auth/")||url.pathname.startsWith("/api/colosseum/")||url.pathname.startsWith("/api/cloudflare/")))) {
    url.hostname=ROOT;
    return redirect(url.href,301);
  }
  if(folder==="_apex" && url.pathname.startsWith("/api/auth/")) {
    try{
      if(url.pathname==="/api/auth/oauth/start"||url.pathname.startsWith("/api/auth/oauth/callback/"))
        return await handleFederation(request,env,url.pathname);
      return await api(request,env,url.pathname);
    }
    catch{return json({error:"Authentication service unavailable."},503);}
  }
  if(folder==="_apex" && url.pathname.startsWith("/api/cloudflare/")) {
    try{return await cloudflareAccountApi(request,env,url.pathname);}
    catch{return json({error:"Cloudflare account service unavailable."},503);}
  }
  if(folder==="_apex" && url.pathname.startsWith("/api/colosseum/")) {
    try {return await colosseumOwnerApi(request,env,url.pathname);}
    catch {return json({error:"Colosseum owner service unavailable."},503);}
  }
  if(request.method!=="GET" && request.method!=="HEAD")
    return new Response("Method not allowed",{status:405,headers:{...NO_STORE,Allow:"GET, HEAD"}});
  if(folder==="_apex" && url.pathname.startsWith("/wallpapers/"))
    return serveWallpaper(request,env,url.pathname);
  if(folder==="_apex" && /^\/(app|dashboard)(\/|$)/.test(url.pathname)) {
    try {
      const user=await getUser(request,env);
      if(!user) return redirect("/login");
      const path=url.pathname.replace(/^\/dashboard(?=\/|$)/,"/app");
      const viewPath=path.replace(/\/+$/,"");
      const asset=await serveAsset(request,env,folder,
        WORKSPACE_VIEW_PATHS.has(viewPath)?"/app/":path,true);
      return asset||new Response("Not found",{status:404,headers:NO_STORE});
    } catch{return new Response("Authentication service unavailable",{status:503,headers:NO_STORE});}
  }
  const asset=await serveAsset(request,env,folder,url.pathname);
  if(asset) return asset;
  if(folder==="_www"){url.hostname=ROOT;return redirect(url.href,301);}
  return new Response("Not found",{status:404,headers:NO_STORE});
}
