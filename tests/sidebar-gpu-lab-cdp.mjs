/* Read-only browser GPU feasibility and controlled scene comparison.
 * Never stores screenshots or visits production. Browser/profile are ephemeral.
 */
import {spawn} from "node:child_process";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {inflateSync} from "node:zlib";
import {setTimeout as sleep} from "node:timers/promises";
const profile=mkdtempSync(join(process.env.RUNNER_TEMP||tmpdir(),"gpu-lab-cdp-"));
const chrome=spawn("google-chrome",[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--disable-background-networking","--no-first-run","--no-default-browser-check",
  "--enable-webgl","--enable-unsafe-webgpu","--enable-unsafe-swiftshader",
  "--use-angle=swiftshader","--ignore-gpu-blocklist",
  "--remote-allow-origins=*","--remote-debugging-port=0",
  "--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let ws=null,id=0;const pending=new Map();
async function until(fn,timeout=40000){
  const end=Date.now()+timeout;let last;
  while(Date.now()<end){try{let v=await fn();if(v)return v;}catch(e){last=e;}
    await sleep(180);}
  throw Error("Browser timeout "+String(last||""));
}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const current=++id;
    const timeout=setTimeout(()=>{pending.delete(current);reject(Error("CDP timeout "+method));},90000);
    pending.set(current,{resolve,reject,timeout});
    ws.send(JSON.stringify({id:current,method,params}));
  });
}
async function evaluate(expression){
  const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error("Browser expression "+JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
function decodePNG(b64){
  const raw=Buffer.from(b64,"base64");
  if(!raw.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error("PNG header");
  let width,height,channels=0;const chunks=[];
  for(let i=8;i<raw.length;){let n=raw.readUInt32BE(i),type=raw.toString("ascii",i+4,i+8),v=raw.subarray(i+8,i+8+n);
    if(type==="IHDR"){width=v.readUInt32BE(0);height=v.readUInt32BE(4);channels=v[9]===6?4:v[9]===2?3:0;}
    if(type==="IDAT")chunks.push(v);
    if(type==="IEND")break;
    i+=n+12;
  }
  if(!channels)throw Error("Unexpected PNG channel format");
  const stream=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height);
  let j=0;
  for(let y=0;y<height;y++){
    const filter=stream[j++];
    for(let x=0;x<stride;x++){
      const a=x>=channels?pixels[y*stride+x-channels]:0;
      const b=y?pixels[(y-1)*stride+x]:0;
      const c=x>=channels&&y?pixels[(y-1)*stride+x-channels]:0;
      const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
      const add=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?(da<=db&&da<=dc?a:db<=dc?b:c):NaN;
      if(!Number.isFinite(add))throw Error("Invalid PNG filter "+filter);
      pixels[y*stride+x]=(stream[j++]+add)&255;
    }
  }
  return {width,height,channels,pixels};
}
function compareRegions(image,a,b,w,h){
  let total=0,different=0,sum=0,max=0;
  for(let y=25;y<h-25;y++)for(let x=25;x<w-25;x++){
    const i=((a.y+y)*image.width+a.x+x)*image.channels;
    const k=((b.y+y)*image.width+b.x+x)*image.channels;
    let d=0;
    for(let c=0;c<3;c++)d+=Math.abs(image.pixels[i+c]-image.pixels[k+c]);
    d/=3;sum+=d;max=Math.max(d,max);total++;
    if(d>=2)different++;
  }
  return {total,different,meanAbsRGB8:sum/total,maxAbsRGB8:max};
}
try{
  const port=await until(()=>{
    const f=join(profile,"DevToolsActivePort");return existsSync(f)&&readFileSync(f,"utf8").split("\n")[0];
  });
  const tab=await until(async()=>{
    const pages=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
    return pages.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
  });
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ws.addEventListener("open",ok,{once:true});ws.addEventListener("error",fail,{once:true});});
  ws.addEventListener("message",e=>{
    let m;try{m=JSON.parse(e.data);}catch{return;}
    const p=pending.get(m.id);if(!p)return;
    pending.delete(m.id);clearTimeout(p.timeout);
    if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result||{});
  });
  await send("Runtime.enable");await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1100,height:1600,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:"http://127.0.0.1:8765/gpu-lab/"});
  const state=await until(()=>evaluate('(()=>{const r=document.documentElement.dataset.gpuLabReady;return r?{ready:r,status:document.querySelector("#status")?.textContent}:null;})()'),90000);
  console.log("GPU_LAB_READY",JSON.stringify(state));
  if(state.ready==="unavailable"){
    // CI SwiftShader availability is informative. Never claim GPU speed/visual
    // parity from this environment when the GPU adapter is unavailable.
    console.log("GPU_LAB_ADAPTER_UNAVAILABLE: candidate unverified on this runner");
  }else if(state.ready==="true"){
    const backgrounds=await evaluate('(()=>{const s=getComputedStyle(document.querySelector("#svg-scene")).backgroundImage;const g=getComputedStyle(document.querySelector("#gpu-scene")).backgroundImage;return {same:s===g,one:s.slice(0,35),canvas:document.querySelector("#gpu-canvas").width};})()');
    if(!backgrounds.same||backgrounds.canvas!==260)throw Error("GPU and SVG do not share exact controlled input");
    const box=await evaluate('(()=>{const a=document.querySelector("#svg-scene").getBoundingClientRect();const b=document.querySelector("#gpu-scene").getBoundingClientRect();return {a:{x:Math.round(a.left),y:Math.round(a.top)},b:{x:Math.round(b.left),y:Math.round(b.top)}};})()');
    const photo=decodePNG((await send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false})).data);
    if(Math.max(box.a.y,box.b.y)+640>photo.height)
      throw Error("Page screenshot is shorter than the compared glass panes");
    const diff=compareRegions(photo,box.a,box.b,260,640);
    console.log("GPU_LAB_CONTROLLED_BACKDROP_PIXEL_DELTA",JSON.stringify(diff));
    if(!Number.isFinite(diff.meanAbsRGB8))throw Error("Invalid GPU / SVG screenshot comparison");
    await evaluate('document.querySelector("#benchmark-button").click()');
    const benchmark=await until(()=>evaluate('(()=>{const r=document.documentElement.dataset.gpuLabBenchmark;return r?JSON.parse(r):null;})()'),90000);
    console.log("GPU_LAB_RENDER_SUBMISSION_BENCHMARK",JSON.stringify(benchmark));
    if(!(benchmark.samples===80&&Number.isFinite(benchmark.medianMs)))throw Error("GPU benchmark missing");
    // Reporting a delta does not establish a pixel-fidelity pass threshold.
    // No replacement/promotions are performed from these exploratory values.
  }else throw Error("Unexpected GPU lab state: "+JSON.stringify(state));
}finally{
  try{ws?.close()}catch{}
  const done=chrome.exitCode===null?new Promise(r=>chrome.once("exit",r)):Promise.resolve();
  if(chrome.exitCode===null)chrome.kill("SIGTERM");
  await Promise.race([done,sleep(3000)]);
  if(chrome.exitCode===null){try{chrome.kill("SIGKILL")}catch{};await Promise.race([done,sleep(1500)]);}
  await sleep(250);
  for(let attempt=0;attempt<6;attempt++){
    try{rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:120});break;}
    catch(e){if(attempt===5)throw e;await sleep(200);}
  }
}
