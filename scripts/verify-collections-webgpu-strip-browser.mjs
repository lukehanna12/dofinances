/* Browser-level proof without screenshots or private/authenticated APIs. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {join,extname} from "node:path";
import {tmpdir} from "node:os";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sourceRoot=new URL("../sites/_apex/app/assets/",import.meta.url);
// Fetch the exact wallpaper served to real Collections (no synthetic color
// field in this regression). Use the same image bytes for headless GPU checks.
const liveWallpaperURL="https://dofinances.com/wallpapers/"+
  "dcb3d4f1e42bf3aebab2186768a598d17a8aad76e9620a150e268938eee01441.jpg";
const wallpaperResponse=await fetch(liveWallpaperURL,{signal:AbortSignal.timeout(15000)});
assert.equal(wallpaperResponse.status,200,"Collections production wallpaper must be reachable");
assert.ok((wallpaperResponse.headers.get("content-type")||"").includes("image/"),
  "Collections production wallpaper must return an image");
const wallpaper=Buffer.from(await wallpaperResponse.arrayBuffer());
assert.ok(wallpaper.length>10000,"Collections wallpaper unexpectedly small");
console.log("Real Collections wallpaper source",wallpaper.length,"bytes");
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
 'window.__stripFixture=initCollectionsWebGPUStrip({wallpaperURL:"/wallpaper-test.jpg"});'
].join("\n");
const types={".js":"text/javascript",".wgsl":"text/plain",".css":"text/css"};
const server=createServer((req,res)=>{
 const path=req.url?.split("?")[0]||"/";
 if(path==="/wallpaper-test.jpg"){
  res.writeHead(200,{"Content-Type":"image/jpeg","Cache-Control":"no-store"});
  res.end(wallpaper);return;
 }
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
 const probe='(()=>{const a=window.__collectionsWebGPUStrip,c=document.getElementById("cs-top-webgpu-strip"),s=document.getElementById("cs-summary"),r=c?.getBoundingClientRect(),sr=s?.getBoundingClientRect(),sh=document.getElementById("workspace-shell")?.getBoundingClientRect(),front=r&&document.elementFromPoint(r.left+r.width*.7,r.top+r.height*.5);return {gpu:!!navigator.gpu,a,visible:!!c&&!c.hidden,bounds:r&&{x:r.x,y:r.y,w:r.width,h:r.height},summaryTop:sr?.top,shellTop:sh?.top,frontTag:front?.tagName,frontId:front?.id}})()';
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
 assert.deepEqual(state.a.gpuErrors||[],[],
   "No WGSL compilation, pipeline or command-submission errors are acceptable");
 assert.equal(state.visible,true);
 assert.equal(state.bounds.x,0);
 assert.ok(Math.abs(state.bounds.w-1200)<20,"Strip spans the viewport");
 assert.ok(Math.abs(state.bounds.y-state.shellTop-202.65625)<.5,
   "Strip aligns to the black surface boundary");
 const gap=state.summaryTop-state.bounds.y;
 assert.ok(Math.abs(state.bounds.h-gap*7/16)<.5,
   "Strip must occupy exactly 43.75% of measured summary gap");
 console.log("Real-wallpaper strip WebGPU measurement:",JSON.stringify(state));
 assert.ok(state.a.gpuPixel.slice(0,3).some(channel=>channel>36),
   "Rendered pixel must sample the real Collections wallpaper instead of black");
 assert.ok(state.a.gpuPixel[3]>=200,"WebGPU strip interior must be opaque");
 assert.equal(state.a.gpuSamples?.length,3,
   "Inspect three real wallpaper regions, not just one center pixel");
 for(const pixel of state.a.gpuSamples)
   assert.equal(pixel[3],255,"Clear interior must be opaque at each checked position");
 const distinctRGB=new Set(state.a.gpuSamples.map(p=>p.slice(0,3).join(",")));
 assert.ok(distinctRGB.size>=2,
   "Lens field must retain the real wallpaper's horizontal image detail");

 // This temporary panel must work in real Chromium, not only in source tests.
 const tuningProbe='(()=>{const p=document.getElementById("cs-glass-tuner"),b=p?.querySelector("[data-cs-output=brightness]"),c=p?.querySelector("[data-cs-output=contrast]"),t=p?.querySelector("[data-cs-output=tintStrength]"),hex=p?.querySelector("[data-cs-hex]"),picker=p?.querySelector("[data-cs-picker]"),preset=p?.querySelector("[data-cs-preset]");return {present:!!p,visible:!!p&&!p.hidden,brightness:b?.textContent,contrast:c?.textContent,tintStrength:t?.textContent,hex:hex?.value,pickerType:picker?.type,preset:preset?.value}})()';
 let tune=await evaluate(tuningProbe);
 assert.equal(tune.visible,true,"Temporary glass editor must appear on Collections");
 assert.equal(tune.pickerType,"color","Browser must expose full native color picker");
 assert.equal(tune.brightness,"100.00%");
 assert.equal(tune.contrast,"100.00%");
 assert.equal(tune.tintStrength,"0.00%");
 assert.equal(tune.hex,"#ffffff");
 assert.equal(JSON.parse(tune.preset).tintStrengthPercent,0);
 const baselineRGB=state.a.gpuPixel.slice(0,3);
 async function awaitTuningPixel(expected){
   for(let attempt=0;attempt<90;attempt++){
     const measured=await evaluate(probe);
     if(measured?.a?.gpuPixel&&expected(measured.a.tuning))return measured;
     await pause(70);
   }
   throw Error("No submitted WebGPU pixel after tuning update");
 }
 // An exact brightness edit must darken actual GPU readback, not CSS elsewhere.
 await evaluate('(()=>{const x=document.querySelector("[data-cs-range=brightness]");x.value="60";x.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
 state=await awaitTuningPixel(t=>t?.brightness===60);
 assert.ok(state.a.gpuPixel.slice(0,3).every((v,i)=>v<=baselineRGB[i]),
   "Brightness 60% must not increase any actual GPU pixel channel");
 assert.ok(state.a.gpuPixel.slice(0,3).some((v,i)=>v<baselineRGB[i]),
   "Brightness 60% must visibly darken the actual GPU output");
 tune=await evaluate(tuningProbe);
 assert.equal(tune.brightness,"60.00%");
 assert.equal(JSON.parse(tune.preset).brightnessPercent,60);
 // Full RGB picker + 100% tint strength must produce exact color independently
 // of the wallpaper; editing contrast demonstrates the separate control.
 await evaluate('(()=>{const panel=document.getElementById("cs-glass-tuner");const color=panel.querySelector("[data-cs-picker]");color.value="#3366cc";color.dispatchEvent(new Event("input",{bubbles:true}));const contrast=panel.querySelector("[data-cs-number=contrast]");contrast.value="142.75";contrast.dispatchEvent(new Event("input",{bubbles:true}));const strength=panel.querySelector("[data-cs-range=tintStrength]");strength.value="100";strength.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
 state=await awaitTuningPixel(t=>t?.tint==="#3366cc"&&t?.contrast===142.75&&t?.tintStrength===100);
 assert.ok(state.a.gpuPixel.slice(0,3).every((v,i)=>Math.abs(v-[51,102,204][i])<=2),
   "Tint at 100% must set actual GPU output to selected full RGB color");
 tune=await evaluate(tuningProbe);
 assert.equal(tune.contrast,"142.75%");
 assert.equal(tune.tintStrength,"100.00%");
 assert.equal(tune.hex,"#3366cc");
 assert.deepEqual(JSON.parse(tune.preset).tintRGB,[51,102,204]);
 // Reset removes the previous fixed 20% darkening AND all preview adjustments.
 await evaluate('document.querySelector("#cs-glass-tuner [data-cs-reset]").click()');
 state=await awaitTuningPixel(t=>t?.brightness===100&&t?.contrast===100&&t?.tintStrength===0);
 assert.ok(state.a.gpuPixel.slice(0,3).every((v,i)=>Math.abs(v-baselineRGB[i])<=2),
   "Reset must reproduce original, untuned WebGPU output");
 assert.equal((await evaluate(tuningProbe)).brightness,"100.00%");

 const beforeInteraction=state.a.frames;
 await evaluate('(()=>{const c=document.getElementById("cs-top-webgpu-strip");c.dispatchEvent(new PointerEvent("pointermove",{clientX:600,clientY:c.getBoundingClientRect().top+9,bubbles:true}));return true;})()');
 await pause(125);
 state=await evaluate(probe);
 assert.ok(state.a.frames>beforeInteraction,
   "Pointer motion must trigger WebGPU repaint without coupling to sidebar");
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
 assert.equal((await evaluate(tuningProbe)).visible,false,
   "Temporary tuning panel must disappear outside Collections");
 console.log("Collections WebGPU pixel/7-16-height/scroll/sidebar/route proofs passed.");
}finally{
 socket?.close();chrome.kill("SIGTERM");
 await new Promise(resolve=>server.close(resolve));
 try{rmSync(profile,{recursive:true,force:true});}catch{}
}