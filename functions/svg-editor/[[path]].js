// DoFinances-specific account gate for the entire SVGOMG editor tree.
// The apex account's __Host- cookie cannot cross to this host. A one-time grant
// is exchanged for a separate HttpOnly cookie; every asset is checked against
// the live Durable Object owner binding and the original (revocable) login.
const APEX="https://dofinances.com";
const HOME="/svg-editor/";
const COOKIE="__Host-studio_svg";
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const BASE_HEADERS={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
function redirect(location,extra={}){
  return new Response(null,{status:303,headers:{...BASE_HEADERS,Location:location,...extra}});
}
function tokenCookie(request){
  const entry=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(COOKIE+"="));
  const token=entry?.slice(COOKIE.length+1);
  return TOKEN.test(token||"")?token:null;
}
async function upstream(path,data){
  try{
    const response=await fetch(APEX+"/api/studio/"+path,{
      method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(data),redirect:"manual"});
    if(!response.ok)return null;
    return await response.json();
  }catch{return null;}
}
export async function onRequest({request,env}){
  const url=new URL(request.url);
  if(!["GET","HEAD"].includes(request.method))
    return new Response("Method not allowed",{status:405,headers:{...BASE_HEADERS,Allow:"GET, HEAD"}});
  if(url.pathname==="/svg-editor/accept"){
    if(request.method!=="GET")return new Response("Not found",{status:404,headers:BASE_HEADERS});
    const grant=url.searchParams.get("grant");
    if(!TOKEN.test(grant||""))return redirect(APEX+"/api/studio/start");
    const result=await upstream("exchange",{grant});
    if(!TOKEN.test(result?.session||""))return redirect(APEX+"/api/studio/start");
    const seconds=Math.min(1200,Math.max(1,Number(result.expiresIn)||0));
    return redirect(HOME,{"Set-Cookie":COOKIE+"="+result.session+
      "; Path=/; Max-Age="+seconds+"; HttpOnly; Secure; SameSite=Lax"});
  }
  const token=tokenCookie(request);
  const valid=token?await upstream("verify",{session:token}):null;
  if(!valid?.ok){
    const isDocument=url.pathname==="/svg-editor"||url.pathname===HOME||
      url.pathname==="/svg-editor/index.html";
    if(isDocument)return redirect(APEX+"/api/studio/start",{
      "Set-Cookie":COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"});
    return new Response("Not found",{status:404,headers:BASE_HEADERS});
  }
  if(url.pathname==="/svg-editor"||url.pathname===HOME)
    url.pathname="/svg-editor/index.html";
  const asset=await env.ASSETS.fetch(new Request(url.toString(),request));
  const headers=new Headers(asset.headers);
  for(const [key,value] of Object.entries(BASE_HEADERS))headers.set(key,value);
  if((headers.get("Content-Type")||"").includes("text/html"))
    headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
      "img-src 'self' data: blob:; worker-src 'self'; font-src 'self'; connect-src 'self'; "+
      "object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return new Response(request.method==="HEAD"?null:asset.body,{status:asset.status,headers});
}
