import {createServer} from "node:http";
import {readFile,readdir,mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname,basename,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
const root=dirname(fileURLToPath(import.meta.url)),profile=await mkdtemp(join(tmpdir(),"lg-webgpu-profile-"));
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,"http://localhost").pathname;
  if(path==="/"){res.writeHead(200,{"content-type":"text/html"});return res.end("<!doctype html><title>Owned continuous GPU test</title>");}
  if(path==="/title-outline"&&process.env.LG_TITLE_OUTLINE){res.writeHead(200,{"content-type":"application/json"});return res.end(await readFile(process.env.LG_TITLE_OUTLINE));}
  if(path.startsWith("/site/")&&/^[\w.-]+\.(js|json|wgsl)$/.test(basename(path))){const name=basename(path);res.writeHead(200,{"content-type":name.endsWith(".js")?"text/javascript":name.endsWith(".json")?"application/json":"text/plain"});return res.end(await readFile(resolve(root,"../../sites/_apex/assets/home-dashboard",name)));}
  if(/^\/original\/[\w.-]+\.svg$/.test(path)){res.writeHead(200,{"content-type":"image/svg+xml"});return res.end(await readFile(resolve(root,"../../sites/_apex/assets/project-icons",basename(path))));}
  if(process.env.LG_VECTOR_ASSETS){
   if(path==="/icon-list"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify((await readdir(process.env.LG_VECTOR_ASSETS)).filter(n=>/^[\w.-]+\.json$/.test(n)).map(n=>n.slice(0,-5))));}
   if(/^\/outline\/[\w.-]+\.json$/.test(path)){res.writeHead(200,{"content-type":"application/json"});return res.end(await readFile(join(process.env.LG_VECTOR_ASSETS,basename(path))));}
   if(/^\/original\/[\w.-]+\.svg$/.test(path)){res.writeHead(200,{"content-type":"image/svg+xml"});return res.end(await readFile(resolve(root,"../../sites/_apex/assets/project-icons",basename(path))));}
   if(path==="/production-vector-coverage.js"){res.writeHead(200,{"content-type":"text/javascript"});return res.end(await readFile(resolve(root,"../../sites/_apex/assets/home-dashboard/dashboard-glass-vector-coverage.js")));}
  }
  const name=basename(path);if(!/^[\w.-]+\.(mjs|wgsl)$/.test(name)){res.writeHead(404);return res.end();}
  res.writeHead(200,{"content-type":name.endsWith(".mjs")?"text/javascript":"text/plain"});res.end(await readFile(join(root,name)));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const chrome=process.env.CHROME_BIN??"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const p=spawn(chrome,["--headless=new","--enable-unsafe-webgpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=0","--user-data-dir="+profile,"about:blank"],{stdio:["ignore","ignore","pipe"]});
let ws,timer;
try{
 const port=await new Promise((resolve,reject)=>{
  const t=setTimeout(()=>reject(new Error("Chrome CDP startup timeout")),15000);
  let text="";p.stderr.on("data",b=>{text+=b;const m=text.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve(+m[1]);}});p.once("error",e=>{clearTimeout(t);reject(e);});p.once("exit",c=>{clearTimeout(t);reject(new Error("Chrome exited "+c+" "+text.slice(-1000)));});
 });
 const list=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json(),target=list.find(x=>x.type==="page");
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
 let id=0;const pending=new Map(),events=new Map();
 ws.addEventListener("message",e=>{const x=JSON.parse(e.data);if(x.id&&pending.has(x.id)){const [r,j]=pending.get(x.id);pending.delete(x.id);x.error?j(new Error(JSON.stringify(x.error))):r(x.result);}else if(events.has(x.method)){events.get(x.method)(x.params);events.delete(x.method);}});
 const send=(method,params={})=>new Promise((r,j)=>{const k=++id;pending.set(k,[r,j]);ws.send(JSON.stringify({id:k,method,params}));});
 await send("Page.enable");const load=new Promise(r=>events.set("Page.loadEventFired",r));
 await send("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/"});await load;
 const result=await Promise.race([send("Runtime.evaluate",{expression:process.env.LG_GPU_TEST==="portable-title"?"import('./portable-title-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="site-density-output"?"import('./site-density-output-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="title-coverage"?"import('./title-coverage-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="site-field"?"import('./site-field-check.mjs').then(m=>m.run())":process.env.LG_VECTOR_ASSETS?"import('./icon-gpu-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="site-compare"?"import('./site-compare.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="site-shader"?"import('./site-shader-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="bgra8-lod"?"import('./bgra8-trilinear-gpu-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="bgra8"?"import('./bgra8-gpu-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="diamond"?"import('./diamond-gpu-check.mjs').then(m=>m.run())":process.env.LG_GPU_TEST==="prefix"?"import('./prefix-gpu-check.mjs').then(m=>m.run())":"import('./gpu-check.mjs').then(m=>m.run())",awaitPromise:true,returnByValue:true}),new Promise((_,j)=>timer=setTimeout(()=>j(new Error("GPU evaluation timeout")),90000))]);
 if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
 console.log(JSON.stringify(result.result.value,null,2));
}finally{
 clearTimeout(timer);ws?.close();p.kill();await new Promise(r=>{if(p.exitCode!==null||p.signalCode!==null)r();else p.once("exit",r);});server.close();await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
