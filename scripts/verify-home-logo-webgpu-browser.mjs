/* End-to-end, auth-free WebGPU proof for the Home mosaic. Verifies shader
 * compilation, actual GPU scene passes, and logo-vs-clean pixel readback.
 * No public screenshot, browser account, or production APIs are required. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {join,extname} from "node:path";
import {tmpdir} from "node:os";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assetRoot=new URL("../sites/_apex/app/assets/",import.meta.url);
const html=[
 '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<link rel="stylesheet" href="/app/assets/dashboard-home.css">',
 '<style>body{margin:0;background:#111;color:#fff}.global-menu{position:fixed;top:0;left:0;width:100%;height:44px}',
 '.dashboard-home .cta6{width:min(calc(100vw - 32px),1080px)}',
 '</style></head><body>',
 '<nav id="global-menu" class="global-menu"></nav>',
 '<div id="workspace-shell" class="shell"><main class="main"><div class="content">',
 '<section class="view dashboard-home" data-view="home"><div class="cta6">',
 '<div id="cta6-mosaic" class="cta6-mosaic"></div>',
 '<div class="cta6-center"><h1 id="home-title">Workspace</h1></div>',
 '</div></section></div></main></div>',
 '<script type="module" src="/app/assets/dashboard-gpu-renderer.js"></script>',
 '</body></html>'
].join("");
const types={".js":"text/javascript",".wgsl":"text/plain",".avif":"image/avif",".webp":"image/webp",".css":"text/css",".svg":"image/svg+xml"};
const server=createServer((req,res)=>{
 const path=req.url?.split("?")[0]||"/";
 if(path.startsWith("/app/assets/")&&!path.slice(12).includes("/")&&!path.includes("..")){
  const filename=path.slice("/app/assets/".length);
  try{
   const url=new URL(filename,assetRoot);
   res.writeHead(200,{"Content-Type":types[extname(filename)]||"application/octet-stream","Cache-Control":"no-store"});
   res.end(readFileSync(url));return;
  }catch{
   res.writeHead(404);res.end("Missing test asset: "+filename);return;
  }
 }
 res.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
 res.end(html);
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
let executable;
for(const name of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
 try{executable=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(executable,"Chromium is required for WebGPU lens proof");
const profile=mkdtempSync(join(tmpdir(),"dofinances-home-webgpu-"));
const chrome=spawn(executable,[
 "--headless=new","--no-sandbox","--disable-dev-shm-usage","--no-first-run",
 "--enable-unsafe-webgpu","--enable-features=Vulkan",
 "--use-gl=angle","--use-angle=swiftshader",
 "--enable-dawn-features=allow_unsafe_apis",
 "--remote-debugging-port=0","--window-size=1280,880",
 "--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe"]});
let stderr="",socket;
chrome.stderr?.on("data",data=>{stderr=(stderr+String(data)).slice(-8000);});
try{
 let port;
 for(let n=0;n<150;n++){
  if(existsSync(join(profile,"DevToolsActivePort"))){
   port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
  }
  if(chrome.exitCode!==null)throw Error("Chrome exited: "+stderr);
  await pause(100);
 }
 assert.ok(port,"Chrome debugging port unavailable "+stderr);
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const waiting=new Map();
 socket.onmessage=e=>{
  const result=JSON.parse(e.data);
  if(!result.id)return;
  const request=waiting.get(result.id);if(!request)return;
  waiting.delete(result.id);
  result.error?request.reject(Error(JSON.stringify(result.error))):request.resolve(result.result);
 };
 const cmd=(method,params={})=>new Promise((resolve,reject)=>{
  const key=++id;waiting.set(key,{resolve,reject});
  socket.send(JSON.stringify({id:key,method,params}));
 });
 const evalJS=async expression=>{
  const result=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 await cmd("Runtime.enable");await cmd("Page.enable");
 await cmd("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/?webgpu-offscreen-ci=1"});
 for(let n=0;n<300;n++){
  const status=await evalJS('({gpu:!!navigator.gpu,phase:document.querySelector("#cta6-mosaic")?.dataset.gpuPhase,status:window.__dashboardWebGPU?.status,errors:window.__dashboardWebGPU?.errors,proof:window.__dashboardWebGPU?.logoGpuPixelProof})');
  if(n===30)console.log("WebGPU progress:",JSON.stringify(status));
  if(status?.status==="ready"){
   assert.equal(status.proof?.changed,true,"Pixel proof must find logo in lens texture but not visible background");
   console.log("WebGPU logo source separation validated:",JSON.stringify(status.proof));
   break;
  }
  if(status?.status==="fallback")throw Error("GPU fallback: "+JSON.stringify(status));
  if(n===299)throw Error("GPU did not reach READY: "+JSON.stringify(status)+"; Chrome: "+stderr.slice(-1200));
  await pause(100);
 }
}finally{
 socket?.close();chrome.kill("SIGTERM");
 await new Promise(resolve=>server.close(resolve));
 try{rmSync(profile,{recursive:true,force:true});}catch{}
}