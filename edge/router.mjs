// Host-isolated static assets and D1-free, server-enforced session routing.
import {parseCookie, sessionCookie, expireCookie, sha256} from "./auth-core.mjs";
const ROOT="dofinances.com";
const RESERVED=new Set(["stu","pay","em5386","zb30895346","_domainconnect","_dmarc","s1","s2","zmail","gd-origin"]);
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
  if(!stub) return json({error:"Authentication temporarily unavailable."},503);
  if(pathname==="/api/auth/me") {
    if(method!=="GET") return json({error:"Method not allowed."},405,{Allow:"GET"});
    const user=token?await stub.session(token):null;
    return user?json({user}):json({error:"Not authenticated."},401);
  }
  const actions={"/api/auth/signup":"signup","/api/auth/login":"login","/api/auth/logout":"logout","/api/auth/account":"account"};
  const action=actions[pathname];
  if(!action) return json({error:"Not found."},404);
  const expected=action==="account"?"DELETE":"POST";
  if(method!==expected) return json({error:"Method not allowed."},405,{Allow:expected});
  // Origin + JSON are mandatory for state-changing browser requests.
  if(request.headers.get("Origin")!=="https://dofinances.com")
    return json({error:"Forbidden origin."},403);
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    return json({error:"Expected JSON."},415);
  const length=Number(request.headers.get("Content-Length")||"0");
  if(length>4096) return json({error:"Request too large."},413);
  let body;
  try {
    const raw=await request.text();
    if(raw.length>4096) return json({error:"Request too large."},413);
    body=JSON.parse(raw);
    if(!body || typeof body!=="object" || Array.isArray(body)) throw new Error("bad body");
  } catch {
    return json({error:"Invalid JSON."},400);
  }
  if(action==="logout") {
    await stub.logout(token);
    return json({ok:true},200,{"Set-Cookie":expireCookie()});
  }
  if(action==="account") {
    const result=await stub.deleteAccount({token,password:body.password});
    return result.status===204?new Response(null,{status:204,headers:{...NO_STORE,"Set-Cookie":expireCookie()}})
      :json({error:result.error},result.status);
  }
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const ipKey=await sha256(ip);
  const result=await stub[action]({email:body.email,password:body.password,ipKey});
  if(result.error) return json({error:result.error},result.status);
  return json({user:result.user},result.status,{"Set-Cookie":sessionCookie(result.token)});
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
  if(folder==="_www" && (/^\/(login|app|dashboard)(\/|$)/.test(url.pathname)||url.pathname.startsWith("/api/auth/"))) {
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
