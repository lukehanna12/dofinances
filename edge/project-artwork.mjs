import {PROJECT_CARD_IMAGES} from "../sites/_apex/assets/public-projects-catalog.js";
const SOURCES=new Map(Object.entries(PROJECT_CARD_IMAGES).filter(([,v])=>v.startsWith("https://")));
const HOSTS=new Set([...SOURCES.values()].map(v=>new URL(v).hostname));
const MIME=/^image\/(?:jpeg|png|webp|avif|gif)(?:;|$)/i;
const LIMIT=16*1024*1024;
// No client URL, cookies, credentials, custom upstream headers or arbitrary
// redirects are accepted. Limit both declared and streamed response size.
export async function serveProjectArtwork(request,pathname,fetcher=fetch){
 const slug=pathname.slice("/project-artwork/".length);
 const source=SOURCES.get(slug);
 const fail=(status)=>new Response("Artwork unavailable",{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 if(!source||new URL(request.url).search)return fail(404);
 if(!["GET","HEAD"].includes(request.method))return fail(405);
 try{
  let url=new URL(source),res;
  for(let i=0;i<4;i++){
   if(url.protocol!=="https:"||!HOSTS.has(url.hostname)||url.username||url.password||url.port)return fail(502);
   res=await fetcher(url.href,{method:request.method,redirect:"manual",
    headers:{"Accept":"image/avif,image/webp,image/png,image/jpeg,image/gif","User-Agent":"Dofinances project artwork/1.0 (https://dofinances.com/projects)"}});
   if(res.status<300||res.status>=400)break;
   const next=res.headers.get("Location");
   if(!next)return fail(502);
   url=new URL(next,url);
  }
  if(!res?.ok||!MIME.test(res.headers.get("Content-Type")||""))return fail(502);
  const size=Number(res.headers.get("Content-Length"));
  if(size>LIMIT)return fail(502);
  const headers={"Content-Type":res.headers.get("Content-Type"),"Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"};
  if(request.method==="HEAD")return new Response(null,{headers});
  if(!res.body)return fail(502);
  let total=0;
  const capped=res.body.pipeThrough(new TransformStream({transform(chunk,controller){
    total+=chunk.byteLength;if(total>LIMIT){controller.error(new Error("Artwork size limit"));return;}
    controller.enqueue(chunk);
  }}));
  return new Response(capped,{headers});
 }catch{return fail(502);}
}
