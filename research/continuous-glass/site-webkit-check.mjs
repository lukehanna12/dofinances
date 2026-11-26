// Actual public shell smoke/performance on the reference browser.
// Local same-origin fixture artwork is used instead of remote library photos.
// No browser screenshot or rendered-page capture.
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {resolve,join,extname} from "node:path";
import {tmpdir} from "node:os";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../sites/_apex/",import.meta.url)));
const dist=resolve(root,"../../dist");
const mime={".js":"text/javascript",".css":"text/css",".html":"text/html",".svg":"image/svg+xml",".json":"application/json",".webp":"image/webp",".avif":"image/avif",".wgsl":"text/plain"};
const server=createServer((req,res)=>{
 const path=new URL(req.url,"http://127.0.0.1").pathname;
 try{
  let target=resolve(root,"."+path);
  if(path==="/assets/home-dashboard/continuous-title-outline.json"&&process.env.LG_TITLE_OUTLINE){res.writeHead(200,{"content-type":"application/json"});return res.end(readFileSync(process.env.LG_TITLE_OUTLINE));}
  if(path==="/"||path==="/projects"||path==="/projects/"||path==="/login"||path==="/login/"){
   let html=readFileSync(join(root,"index.html"),"utf8");
   if(path!=="/")html=html.replace('<body class="public-home">','<body class="public-home" data-public-route="leaving" data-direct-login="true">');
   res.writeHead(200,{"content-type":"text/html"});return res.end(html);
  }
  if(path.startsWith("/project-artwork/")||path.startsWith("/wallpapers/")){
   if(process.env.LG_REAL_ART_DIR){const dir=resolve(process.env.LG_REAL_ART_DIR),file=resolve(dir,"."+path);if(!file.startsWith(dir+"/")||!existsSync(file)||!existsSync(file+".type")){res.writeHead(404);return res.end();}const type=readFileSync(file+".type","utf8").trim();if(!type.startsWith("image/"))throw Error("Invalid test asset MIME");res.writeHead(200,{"content-type":type,"cache-control":"no-store"});return res.end(readFileSync(file));}
   target=join(root,"assets/project-art/terminal-scalars-liquid-symmetry.v2.webp");
  }
  if(process.env.LG_REAL_LOGIN&&path.startsWith("/assets/")&&existsSync(resolve(dist,"."+path))){const file=resolve(dist,"."+path);if(!file.startsWith(dist+"/"))throw Error("Invalid dist path");res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream"});return res.end(readFileSync(file));}
  if(path==="/assets/public-login-manifest.json"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({js:"/assets/fixture-login.js",css:[]}));}
  if(path==="/assets/fixture-login.js"){res.writeHead(200,{"content-type":"text/javascript"});return res.end('export function mountLogin(host,{onExitComplete}){const card=document.createElement("h2");card.textContent="Sign in";host.append(card);return {exit(){onExitComplete()},unmount(){card.remove()}}}');}
  if(!target.startsWith(root+"/")||!existsSync(target)){res.writeHead(404);return res.end();}
  res.writeHead(200,{"content-type":mime[extname(target)]||"application/octet-stream","cache-control":"no-store"});res.end(readFileSync(target));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const origin="http://127.0.0.1:"+server.address().port;
const proc=spawn(process.env.LG_WEBKIT_DRIVER,[origin+"/?glass-renderer="+(process.env.LG_SITE_MODE||"continuous")+"&glass-source-proof"],{stdio:"inherit"});
try{const status=await new Promise((r,j)=>{proc.on("error",j);proc.on("exit",(c,s)=>r(c??1));});process.exitCode=status;}finally{server.close();}
