/* Browser-level proof without screenshots or private/authenticated APIs. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {join,extname} from "node:path";
import {tmpdir} from "node:os";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sourceRoot=new URL("../sites/_apex/app/assets/",import.meta.url);
const html=[
 '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<link rel="stylesheet" href="/app/assets/collections.css">',
 '<style>:root{--workspace-banner-height:202.65625px;--workspace-top-overpull:96px}',
 'html,body{margin:0;background:#0a0a0a}',
 '#workspace-shell{position:relative;width:100%;min-height:1900px;background:#0a0a0a}',
 '#workspace-sidebar{width:260px;position:fixed;z-index:12;top:30px;height:300px}',
 '#cs-summary{position:absolute;top:calc(202.65625px + 43.2px);left:285px;height:16px;line-height:16px;white-space:nowrap}',
 '</style></head><body data-wallpaper-route="colosseum/collections">',
 '<div id="workspace-shell" class="shell liquid-glass-preview">',
 '<aside id="workspace-sidebar"></aside>',
 '<section class="view project-view" data-view="colosseum/collections">',
 '<div id="cs-root"><span id="cs-summary" class="cs-eyebrow">TOTAL 23 / UPDATED 6:45 AM</span></div>',
 '</section></div><script type="module" src="/bootstrap.js"></script></body></html>'
].join("");
const bootstrap=[
 'import {initCollectionsWebGPUStrip} from "/app/assets/collections-webgpu-strip.js";',
 'const image=document.createElement("canvas");image.width=144;image.height=144;',
 'const context=image.getContext("2d");',
 'const gradient=context.createLinearGradient(0,0,144,144);',
 'gradient.addColorStop(0,"#eeae63");gradient.addColorStop(1,"#488aca");',
 'context.fillStyle=gradient;context.fillRect(0,0,144,144);',
 'window.__stripFixture=initCollectionsWebGPUStrip({wallpaperURL:image.toDataURL("image/png")});'
].join("\n");
const types={".js":"text/javascript",".wgsl":"text/plain",".css":"text/css"};
const server=createServer((req,res)=>{
 const path=req.url?.split("?")[0]||"/";
 if(path==="/bootstrap.js"){
  res.writeHead(200,{"Content-Type":"text/javascript"});res.end(bootstrap);return;
 }
 if(path.startsWith("/app/assets/")&&!path.slice("/app/assets/".length).includes("/")){
  const name=path.slice("/app/assets/".length);
  try{
   const asset=new URL(name,sourceRoot);
   res.writeHead(200,{"Content-Type":types[extname(name)]||"application/octet-stream","Cache-Control":"no-store"});
   res.end(readFileSync(asset));return;
  }catch{
   res.writeHead(404);res.end("Missing asset "+name);return;
  }
 }
 res.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});res.end(html);
});
await new Promise((resolve,reject)=>{
 server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
});
let executable;
for(const candidate of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
 try{executable=execFileSync("which",[candidate],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(executable,"Chromium required for WebGPU glass proof");
const profile=mkdtempSync(join(tmpdir(),"collections-gpu-strip-"));
const chrome=spawn(executable,[
 "--headless=new","--no-sandbox","--disable-dev-shm-usage","--no-first-run",
 "--enable-unsafe-webgpu","--enable-features=Vulkan",
 "--use-gl=angle","--use-angle=swiftshader",
 "--enable-dawn-features=allow_unsafe_apis",
 "--remote-debugging-port=0","--window-size=1200,850",
 "--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe"]});
let stderr="",socket;
chrome.stderr?.on("data",chunk=>{stderr=(stderr+String(chunk)).slice(-5000);});
try{
 let port;
 for(let i=0;i<150;i++){
  if(existsSync(join(profile,"DevToolsActivePort"))){
   port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
  }
  if(chrome.exitCode!==null)throw Error("Chrome failed: "+stderr);
  await pause(100);
 }
 assert.ok(port,"Chrome debugging port did not appear "+stderr);
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",
   {method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let serial=0;const waiting=new Map();
 socket.onmessage=e=>{
  const msg=JSON.parse(e.data);
  if(!msg.id)return;
  const w=waiting.get(msg.id);if(!w)return;
  waiting.delete(msg.id);
  msg.error?w.reject(Error(JSON.stringify(msg.error))):w.resolve(msg.result);
 };
 const cmd=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++serial;waiting.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expr=>{
  const out=await cmd("Runtime.evaluate",
    {expression:expr,returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw Error(JSON.stringify(out.exceptionDetails));
  return out.result.value;
 };
 const probe='(()=>{const a=window.__collectionsWebGPUStrip,c=document.getElementById("cs-top-webgpu-strip"),s=document.getElementById("cs-summary"),r=c?.getBoundingClientRect(),sr=s?.getBoundingClientRect(),sh=document.getElementById("workspace-shell")?.getBoundingClientRect();return {gpu:!!navigator.gpu,a,visible:!!c&&!c.hidden,bounds:r&&{x:r.x,y:r.y,w:r.width,h:r.height},summaryTop:sr?.top,shellTop:sh?.top}})()';
 await cmd("Runtime.enable");await cmd("Page.enable");
 await cmd("Page.navigate",
   {url:"http://127.0.0.1:"+server.address().port+"/?collections-glass-ci=1"});
 let state;
 for(let n=0;n<300;n++){
  state=await evaluate(probe);
  if(["fallback","device-lost"].includes(state?.a?.status))
    throw Error("WebGPU fallback: "+JSON.stringify(state));
  if(state?.a?.status==="ready"&&state.a.frames>0&&state.a.gpuPixel)break;
  if(n===299)throw Error("No real submitted WebGPU pixels: "+JSON.stringify(state)+" "+stderr.slice(-1800));
  await pause(100);
 }
 assert.equal(state.gpu,true);
 assert.equal(state.visible,true);
 assert.equal(state.bounds.x,0);
 assert.ok(Math.abs(state.bounds.w-1200)<20,"Strip spans the viewport");
 assert.ok(Math.abs(state.bounds.y-state.shellTop-202.65625)<.5,
   "Strip aligns to the black surface boundary");
 const gap=state.summaryTop-state.bounds.y;
 assert.ok(Math.abs(state.bounds.h-gap*7/16)<.5,
   "Strip must occupy exactly 43.75% of measured summary gap");
 assert.ok(state.a.gpuPixel.slice(0,3).some(channel=>channel>36),
   "Rendered pixel must sample the colored wallpaper, not black");
 assert.ok(state.a.gpuPixel[3]>=200,"WebGPU strip interior must be opaque");
 const old=state.bounds;
 await evaluate('(()=>{const sh=document.getElementById("workspace-shell");sh.classList.add("is-collapsed");document.getElementById("workspace-sidebar").style.width="74px";return 1;})()');
 await pause(150);
 state=await evaluate(probe);
 assert.ok(Math.abs(state.bounds.h-old.h)<.01);
 assert.ok(Math.abs(state.bounds.w-old.w)<.01);
 await evaluate('window.scrollTo(0,60)');
 await pause(140);
 state=await evaluate(probe);
 assert.ok(Math.abs(state.bounds.y-(old.y-60))<1,"Strip moves with scrolled document");
 assert.ok(Math.abs(state.a.lastCrop.canvasViewportTop-state.bounds.y)<1,
   "GPU image sample coordinates follow canvas scroll position");
 await evaluate('document.querySelector("[data-view=\\"colosseum/collections\\"]").hidden=true');
 await pause(100);state=await evaluate(probe);
 assert.equal(state.visible,false,"Other views do not expose Collections glass");
 console.log("Collections WebGPU pixel/7-16-height/scroll/sidebar/route proofs passed.");
}finally{
 socket?.close();chrome.kill("SIGTERM");
 await new Promise(resolve=>server.close(resolve));
 try{rmSync(profile,{recursive:true,force:true});}catch{}
}