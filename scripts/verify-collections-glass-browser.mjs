/*
 * Actual Chromium geometry/interaction test for the fixed Collections dock.
 * Renders the REAL control markup and production CSS/optical modules, using
 * arbitrary DOM scenery to ensure that backdrop pixels are never stored.
 * It does not contact the authenticated Collections API or any real account.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,existsSync,rmSync} from "node:fs";
import {createServer} from "node:http";
import {spawn,execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const read=path=>readFileSync(new URL("../"+path,import.meta.url));
const original=read("sites/_apex/app/index.html").toString();
const start=original.indexOf('<div class="cs-control-center" role="group"');
const stop=original.indexOf("</div>",start);
assert.ok(start>=0&&stop>start);
const panel=original.slice(start,stop+6);
const page=[
 '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<link rel="stylesheet" href="/app/assets/dashboard.css">',
 '<link rel="stylesheet" href="/app/assets/workspace-theme.css">',
 '<link rel="stylesheet" href="/app/assets/workspace-enhancements.css">',
 '<link rel="stylesheet" href="/app/assets/collections.css">',
 '<style>body{margin:0;min-height:3000px;color:#fff;background:linear-gradient(40deg,#131920,#252a32)}',
 '.test-scenery{position:absolute;inset:0;min-height:3000px;pointer-events:none;',
 'background:repeating-linear-gradient(45deg,transparent 0 8px,rgba(245,250,255,.12) 8px 12px,transparent 12px 31px)}',
 '#cs-root{min-height:2600px}.content{max-width:none}</style></head><body>',
 '<div class="test-scenery"></div>',
 '<div id="workspace-shell" class="shell liquid-glass-preview">',
 '<main class="main"><div class="content">',
 '<section class="view project-view" data-view="colosseum/collections">',
 '<div id="cs-root" class="cs-screen"><div class="cs-wrap"><header class="cs-head"><div class="cs-head-copy">',
 '<span class="cs-eyebrow">TOTAL 12 / UPDATED 4:32</span>',panel,
 '</div></header></div></div></section>',
 '</div></main></div>',
 '<script type="module">import {mountCollectionsGlass} from "/app/assets/collections-glass.js";',
 'window.__glass=mountCollectionsGlass(document.getElementById("cs-root"));',
 'window.__ready=true;</script></body></html>'
].join("");
const files=new Map([
 ["dashboard.css","sites/_apex/app/assets/dashboard.css"],
 ["workspace-theme.css","sites/_apex/app/assets/workspace-theme.css"],
 ["workspace-enhancements.css","sites/_apex/app/assets/workspace-enhancements.css"],
 ["collections.css","sites/_apex/app/assets/collections.css"],
 ["collections-glass.js","sites/_apex/app/assets/collections-glass.js"],
 ["collections-glass-public-clear.js","sites/_apex/app/assets/collections-glass-public-clear.js"],
 ["collections-glass-field-worker.js","sites/_apex/app/assets/collections-glass-field-worker.js"],
 ["sidebar-glass-oracle.js","sites/_apex/app/assets/sidebar-glass-oracle.js"],
 ["add-collection.v3.svg","sites/_apex/app/assets/add-collection.v3.svg"],
 ["edit-collections.v1.svg","sites/_apex/app/assets/edit-collections.v1.svg"],
 ["select-collections.v3.svg","sites/_apex/app/assets/select-collections.v3.svg"]
]);
const server=createServer((request,response)=>{
 const name=request.url?.split("/").pop();
 if(files.has(name)){
  const type=name.endsWith(".js")?"text/javascript":name.endsWith(".svg")?"image/svg+xml":"text/css";
  response.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});
  response.end(read(files.get(name)));return;
 }
 response.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
 response.end(page);
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
const binaries=["google-chrome-stable","google-chrome","chromium","chromium-browser"];
let executable;
for(const name of binaries){try{executable=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}}
assert.ok(executable,"Chromium is required for the Collections dock regression");
const profile=mkdtempSync(join(tmpdir(),"dofinances-dock-"));
const chrome=spawn(executable,[
 "--headless=new","--no-sandbox","--disable-dev-shm-usage","--no-first-run",
 "--remote-debugging-port=0","--window-size=1120,850",
 "--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe"]});
let stderr="",socket=null;
chrome.stderr?.on("data",part=>{stderr=(stderr+String(part)).slice(-5000);});
try{
 let port;
 for(let n=0;n<120;n++){
  if(existsSync(join(profile,"DevToolsActivePort"))){
   port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
  }
  if(chrome.exitCode!==null)throw Error("Chrome quit: "+stderr);
  await pause(100);
 }
 assert.ok(port,"Chromium remote-debugging port unavailable: "+stderr);
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const waiting=new Map();
 socket.onmessage=event=>{
  const result=JSON.parse(event.data);
  if(!result.id)return;
  const request=waiting.get(result.id);if(!request)return;
  waiting.delete(result.id);
  result.error?request.reject(Error(JSON.stringify(result.error))):request.resolve(result.result);
 };
 const command=(method,params={})=>new Promise((resolve,reject)=>{
  const seq=++id;waiting.set(seq,{resolve,reject});
  socket.send(JSON.stringify({id:seq,method,params}));
 });
 const evaluate=async expression=>{
  const result=await command("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error("Browser: "+JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 const until=async(expression,message)=>{
  for(let n=0;n<125;n++){
   if(await evaluate(expression))return;
   await pause(50);
  }
  throw Error("Collections dock: "+message+"; "+JSON.stringify(await evaluate('document.querySelector("#cs-root .cs-control-center")?.outerHTML?.slice(0,400)')));
 };
 await command("Runtime.enable");await command("Page.enable");
 await command("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/"});
 await until("window.__ready===true","module initialized");
 const metrics='(()=>{const p=document.querySelector(".cs-control-center"),r=p.getBoundingClientRect(),s=getComputedStyle(p),'+
  'b=[...p.querySelectorAll("button")].map(x=>{const q=x.getBoundingClientRect();return {w:q.width,h:q.height,id:x.id}});'+
  'return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,'+
  'viewport:[document.documentElement.clientWidth,document.documentElement.clientHeight],position:s.position,filter:s.backdropFilter||s.webkitBackdropFilter,'+
  'buttons:b,visible:!!p.offsetWidth,ready:p.classList.contains("cs-oracle-ready")};})()';
 const before=await evaluate(metrics);
 assert.equal(before.position,"fixed");
 assert.ok(before.width>=195&&before.width<=218,"Desktop dock should be 150% of original");
 assert.ok(before.height>=76&&before.height<=85);
 assert.ok(before.buttons.every(b=>b.w>=47&&b.h>=47&&b.w<52&&b.h<52));
 assert.ok(Math.abs(innerNumber(before.viewport[0])-24-before.right)<2);
 assert.ok(Math.abs(before.viewport[1]-24-before.bottom)<2);
 assert.equal(await evaluate('(()=>{const b=document.getElementById("cs-create"),r=b.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest("button")?.id})()'),"cs-create");
 await evaluate('scrollTo(0,1250);true');
 await pause(240);
 const after=await evaluate(metrics);
 assert.ok(Math.abs(after.top-before.top)<1&&Math.abs(after.left-before.left)<1,
   "Dock moves with the viewport, never the scrolling document");
 const overlay=await evaluate('(()=>{const p=document.querySelector(".cs-control-center"),r=p.getBoundingClientRect();return {count:document.querySelectorAll(".cs-control-center").length,top:document.querySelector(".cs-control-center .cs-create-tooltip").getBoundingClientRect().top,panelTop:r.top,buttons:[...p.querySelectorAll("button")].map(x=>x.id)}})()');
 assert.equal(overlay.count,1,"No duplicate buttons or overlay clone");
 assert.ok(overlay.top<overlay.panelTop,"Tooltips open upward above bottom dock");
 assert.deepEqual(overlay.buttons,["cs-create","cs-edit","cs-select-collections"]);
 const svg=await evaluate('CSS.supports("backdrop-filter",\'url("#collections-oracle-live-glass")\')');
 if(svg){
  await until('window.__glass?.active===true',"SVG geometry maps available");
  const widths=await evaluate('(()=>{const p=document.querySelector(".cs-control-center"),r=p.getBoundingClientRect();return [...document.querySelectorAll("#collections-oracle-live-glass feImage")].map(x=>({w:+x.getAttribute("width"),h:+x.getAttribute("height"),png:x.getAttribute("href")?.startsWith("data:image/png")}))})()');
  assert.equal(widths.length,1);
  assert.ok(widths.every(x=>x.w===Math.round(before.width)+40&&x.h===Math.round(before.height)+40&&x.png),
   "Actual optical PNG must contain 20px on every circular and straight edge");
  const actualLens=await evaluate('(()=>{const p=document.querySelector(".cs-control-center"),q=getComputedStyle(p,"::before");return {filter:q.backdropFilter||q.webkitBackdropFilter,mask:q.maskImage||q.webkitMaskImage,box:[q.width,q.height],over:p.style.getPropertyValue("--cs-optical-overscan")}})()');
  assert.ok(actualLens.filter.includes("collections-oracle-live-glass"),"Actual curved pseudo lens must use live SVG");
  assert.ok(actualLens.mask.includes("data:image/png"),"Curved edge must use exact alpha mask");
  assert.equal(actualLens.over,"20px");
  const old=await evaluate('[...document.querySelectorAll("#collections-oracle-live-glass feImage")].map(x=>x.getAttribute("href"))');
  await evaluate('(()=>{document.querySelector(".test-scenery").style.background="repeating-linear-gradient(95deg,red 0 8px,blue 8px 16px)";scrollTo(0,1800);return true})()');
  await pause(250);
  const current=await evaluate('[...document.querySelectorAll("#collections-oracle-live-glass feImage")].map(x=>x.getAttribute("href"))');
  assert.deepEqual(current,old,"Changing real backdrop pixels must not regenerate geometry");

  // A measurement on the REAL CSS pseudo-lens, including the same capsule
  // alpha mask, border radius, and overscan as production. Earlier tests
  // used a stand-alone rectangular lens and MISSED the circular clipping.
  // This is a numerical browser test on controlled source scenery, NOT a
  // screenshot comparison to native Apple output.
  await evaluate(`(()=>{
   const root=document.getElementById("cs-root");
   const original=document.querySelector(".cs-control-center");
   const r=original.getBoundingClientRect();
   const scene=document.createElement("div");
   scene.id="optical-fiducial";
   scene.style.cssText="position:fixed;left:37px;top:109px;width:395px;height:245px;z-index:400;pointer-events:none;background:repeating-linear-gradient(111deg,#f5f5f5 0 26px,#171717 26px 56px)";
   const lens=document.createElement("div");
   lens.id="optical-probe";lens.className="cs-control-center cs-oracle-ready";
   lens.style.cssText="position:fixed;left:62px;top:152px;right:auto;bottom:auto;z-index:401;width:"+Math.round(r.width)+"px;height:"+Math.round(r.height)+"px;min-height:0;max-width:none;padding:0;gap:0;pointer-events:none";
   for(const name of ["--cs-optical-mask","--cs-optical-overscan",
     "--cs-optical-width","--cs-optical-height","--cs-oracle-blur"])
    lens.style.setProperty(name,original.style.getPropertyValue(name));
   const style=document.createElement("style");style.id="optical-probe-rules";
   style.textContent='#cs-root .cs-control-center.cs-oracle-ready.probe-native::before{-webkit-backdrop-filter:blur(12px)!important;backdrop-filter:blur(12px)!important}'+
    '#cs-root .cs-control-center.cs-oracle-ready.probe-off::before{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}';
   root.append(scene,lens,style);
  })()
 `);
  const readScreenshot=async(mode)=>{
   await evaluate('(()=>{const p=document.getElementById("optical-probe");p.classList.remove("probe-native","probe-off");if('+JSON.stringify(mode)+'==="native")p.classList.add("probe-native");if('+JSON.stringify(mode)+'==="off")p.classList.add("probe-off");return true})()');
   await pause(180);
   return (await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data;
  };
  const plain=await readScreenshot("off");
  const native=await readScreenshot("native");
  const refracted=await readScreenshot("oracle");
  const images=JSON.stringify([plain,native,refracted]);
  const optics=await evaluate('(async()=>{const images='+images+';const frames=await Promise.all(images.map(async b64=>{const img=new Image();img.src="data:image/png;base64,"+b64;await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height)}));const gray=(frame,x,y)=>{const i=(y*frame.width+x)*4;return (frame.data[i]+frame.data[i+1]+frame.data[i+2])/3};const avg=(a,b,pts)=>pts.reduce((s,[x,y])=>s+Math.abs(gray(a,x,y)-gray(b,x,y)),0)/pts.length;const region=(x0,x1,y0,y1)=>{const out=[];for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)out.push([x,y]);return out};const [off,blur,warp]=frames;const left=region(53,73,179,203),right=region(262,284,179,203),inner=region(130,196,176,208),outer=region(49,62,184,196);const mean=(a)=>a.reduce((s,v)=>s+v,0)/a.length;const std=(frame,pts)=>{const a=pts.map(([x,y])=>gray(frame,x,y)),m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};const rounded=region(68,85,158,178);return {innerOffStd:std(off,inner),innerBlurStd:std(blur,inner),innerWarpStd:std(warp,inner),leftBlur:avg(off,blur,left),rightBlur:avg(off,blur,right),leftWarp:avg(blur,warp,left),rightWarp:avg(blur,warp,right),outerBlur:avg(off,blur,outer),outerWarp:avg(blur,warp,outer),cornerBlur:avg(off,blur,rounded),cornerWarp:avg(blur,warp,rounded)}})()');
  console.log("Actual capsule curved-edge browser optical metrics:",JSON.stringify(optics));
  assert.ok(optics.innerBlurStd<optics.innerOffStd*.87,
   "CSS pseudo lens must really blur the backdrop, not just report a URL");
  assert.ok(optics.leftBlur>1.5&&optics.rightBlur>1.5,
   "BOTH semicircular ends must exhibit blurred live backdrop");
  assert.ok(optics.leftWarp>2&&optics.rightWarp>2,
   "BOTH semicircular ends must actually warp differently from pure blur");
  assert.ok(optics.outerBlur>1&&optics.outerWarp>1,
   "Outside the left circular rim the overscan must remain optically active");
  assert.ok(optics.cornerBlur>1&&optics.cornerWarp>1,
   "Quarter-circle regions must warp and blur, not be rectangularly clipped");
  await evaluate('(()=>{for(const id of ["optical-probe","optical-fiducial","optical-probe-rules"])document.getElementById(id)?.remove();return true})()');


 }
 await command("Emulation.setDeviceMetricsOverride",{width:365,height:740,deviceScaleFactor:2,mobile:true});
 await pause(300);
 const narrow=await evaluate(metrics);
 assert.ok(narrow.right<=narrow.viewport[0]-10,"Floating glass dock stays within small viewport");
 assert.ok(narrow.width<narrow.viewport[0]-20,"Pill is not clipped on mobile");
 assert.ok(narrow.buttons.every(b=>b.w>=47&&b.h>=47));
 assert.ok(Math.abs(narrow.viewport[1]-12-narrow.bottom)<2);
 await evaluate('document.querySelector(".view").hidden=true;true');
 assert.equal(await evaluate('document.querySelector(".cs-control-center").getBoundingClientRect().width'),0);
 console.log("Public Clear Collections: 1.5x fixed dock, exact-size one-pass warp, live backdrop, hit testing and mobile layout passed.");
}finally{
 try{socket?.close();}catch{}
 chrome.kill("SIGTERM");
 await new Promise(resolve=>server.close(resolve));
 try{rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 catch(error){console.warn("Chrome profile cleanup:",error.message);}
}
function innerNumber(v){return Number(v)}
