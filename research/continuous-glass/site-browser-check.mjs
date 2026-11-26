// Actual public shell smoke/performance on the reference browser.
// Local same-origin fixture artwork is used instead of remote library photos.
// No browser screenshot or rendered-page capture.
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {resolve,join,extname} from "node:path";
import {tmpdir} from "node:os";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../sites/_apex/",import.meta.url))),profile=mkdtempSync(join(tmpdir(),"lg-site-browser-"));
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
  if(path.startsWith("/project-artwork/")||path.startsWith("/wallpapers/"))target=join(root,"assets/project-art/terminal-scalars-liquid-symmetry.v2.webp");
  if(path==="/assets/public-login-manifest.json"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({js:"/assets/fixture-login.js",css:[]}));}
  if(path==="/assets/fixture-login.js"){res.writeHead(200,{"content-type":"text/javascript"});return res.end('export function mountLogin(host,{onExitComplete}){const card=document.createElement("h2");card.textContent="Sign in";host.append(card);return {exit(){onExitComplete()},unmount(){card.remove()}}}');}
  if(!target.startsWith(root+"/")||!existsSync(target)){res.writeHead(404);return res.end();}
  res.writeHead(200,{"content-type":mime[extname(target)]||"application/octet-stream","cache-control":"no-store"});res.end(readFileSync(target));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const proc=spawn(process.env.CHROME_BIN??"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless=new","--enable-unsafe-webgpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=0","--user-data-dir="+profile,"--window-size=1400,880","about:blank"],{stdio:["ignore","ignore","pipe"]});
let ws;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const port=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error("Chrome startup timeout")),10000);let s="";proc.stderr.on("data",b=>{s+=b;const m=s.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve(+m[1]);}});proc.once("exit",c=>reject(Error("Chrome exit "+c)));});
 const tab=(await(await fetch("http://127.0.0.1:"+port+"/json/list")).json()).find(x=>x.type==="page");
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
 let seq=0;const pending=new Map(),events=[];
 ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);}else if(m.method==="Runtime.exceptionThrown")events.push(m.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((r,j)=>{const id=++seq;pending.set(id,[r,j]);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const v=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;};
 const wait=async(expression,label)=>{for(let i=0;i<100;i++){const r=await ev(expression).catch(()=>null);if(r)return r;await sleep(100);}throw Error(label+" "+JSON.stringify(await ev("window.__dashboardWebGPU??null").catch(()=>null)));};
 await send("Page.enable");await send("Runtime.enable");await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
 const origin="http://127.0.0.1:"+server.address().port,results=[];
 const state=()=>ev(`(()=>{const a=window.__dashboardWebGPU;return {status:a?.status,renderer:a?.glassRenderer,errors:a?.errors,frame:a?.frameCount,sceneBuilds:a?.sceneBuilds,route:window.__dofPublicRouter?.state,icons:a?.glassSilhouettes?.icons?.map(x=>({slug:x.slug,vector:x.continuousVector,coverage:x.vectorCoverage})),title:a?.projectTitleMask,lattice:a?.sourceLattice,maskSize:a?.glassSilhouettes?.maskSize,atlasBytes:a?.glassSilhouettes?.atlasBytes,cache:a?.glassSilhouettes?.continuousSampleCache,panes:a?.projectGlass?.count,canvas:[innerWidth,innerHeight,devicePixelRatio]}})()`);
 for(const mode of (process.env.LG_SITE_MODE?[process.env.LG_SITE_MODE]:["baseline","continuous"])){
  await send("Emulation.setDeviceMetricsOverride",{width:1400,height:880,deviceScaleFactor:2,mobile:false});
  const t=Date.now();await send("Page.navigate",{url:origin+"/?glass-renderer="+mode+(process.env.LG_TITLE_OUTLINE?"&glass-title-vector=1":"")+(process.env.LG_DENSITY_CHECK?"&glass-source-proof":"")});
  await wait('window.__dashboardWebGPU?.status==="ready"',"Home renderer not ready");
  const home=await state();
  if(process.env.LG_DENSITY_CHECK){
   const cases=[];
   for(const density of [2,1,1.5,3,2]){
    await send("Emulation.setDeviceMetricsOverride",{width:1400,height:880,deviceScaleFactor:density,mobile:false});
    await wait("devicePixelRatio==="+density+"&&window.__dashboardWebGPU?.status==='ready'&&typeof window.__dashboardGpuControls?.sourceRegionDigest==='function'","DPR not ready");
    await sleep(250);
    const automatic=await ev("document.querySelector('#dashboard-webgpu-scene').width==="+Math.floor(1400*density));
    // CDP can change the emulated DPR without a real screen/resize event.
    // Exercise the public explicit reflow contract in that case, and report it.
    if(!automatic)await ev("window.__dashboardGpuControls.reflowTiles()");
    await wait("document.querySelector('#dashboard-webgpu-scene').width==="+Math.floor(1400*density),"DPR output not ready");
    await sleep(250);
    const snapshot=await state(),digest=await ev('window.__dashboardGpuControls.sourceRegionDigest("base",[100,150,35,30])');
    cases.push({density,automatic,sceneBuilds:snapshot.sceneBuilds,lattice:snapshot.lattice,errors:snapshot.errors,digest});
   }
   if(mode==="continuous"&&new Set(cases.map(x=>x.digest)).size!==1)throw Error("Fixed source changed across DPR "+JSON.stringify(cases));
   results.push({mode,cases});continue;
  }
  if(home.renderer!==(mode==="continuous"?"continuous-candidate":"baseline"))throw Error("Wrong renderer "+JSON.stringify(home));
  await ev('Array.from(document.querySelectorAll("[data-public-target]")).find(n=>n.dataset.publicTarget==="/projects").click()');
  await wait('window.__dofPublicRouter?.state==="projects"&&document.querySelectorAll(".project-showcase-card").length>=16&&window.__dashboardWebGPU?.glassSilhouettes?.icons?.length>0',"Projects not rendered");
  await sleep(400);
  const projects=await state();if(mode==="continuous"&&process.env.LG_TITLE_OUTLINE&&!projects.title?.vectorOptics)throw Error("Title vector optics not enabled "+JSON.stringify(projects.title));
  await send("DOM.enable");await send("CSS.enable");const doc=await send("DOM.getDocument");const title=await send("DOM.querySelector",{nodeId:doc.root.nodeId,selector:".public-projects-title"});const font=await send("CSS.getPlatformFontsForNode",{nodeId:title.nodeId});const fontMetrics=await ev(`(()=>{const n=document.querySelector(".public-projects-title"),s=getComputedStyle(n),c=document.createElement("canvas").getContext("2d");c.font=s.fontStyle+" "+s.fontWeight+" "+s.fontSize+" "+s.fontFamily;c.letterSpacing=s.letterSpacing;let m=c.measureText(n.textContent);return {font:c.font,spacing:c.letterSpacing,rect:[n.offsetWidth,n.offsetHeight],width:m.width,ascent:m.fontBoundingBoxAscent,descent:m.fontBoundingBoxDescent,actual:[m.actualBoundingBoxLeft,m.actualBoundingBoxRight,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent]};})()`);
  if(mode==="continuous"&&(projects.maskSize!==0||projects.icons.some(x=>!x.vector||!x.coverage)))throw Error("Candidate optical mask regression "+JSON.stringify(projects));
  if(process.env.LG_TITLE_SMOKE){results.push({mode,home,projects,font,fontMetrics});continue;}
  const scroll=await ev(`(async()=>{const outlet=document.querySelector("#public-route-content"),a=window.__dashboardWebGPU.frameCount,t=performance.now(),frames=[];for(let i=0;i<12;i++){outlet.scrollTop=Math.max(0,Math.min(outlet.scrollHeight-outlet.clientHeight,i*17.25));await new Promise(r=>requestAnimationFrame(r));frames.push(performance.now());}return {ms:performance.now()-t,frameDelta:window.__dashboardWebGPU.frameCount-a,scroll:outlet.scrollTop,intervals:frames.slice(1).map((v,i)=>v-frames[i])};})()`);
  const afterScroll=await state();
  await send("Emulation.setDeviceMetricsOverride",{width:1024,height:720,deviceScaleFactor:2,mobile:false});await sleep(600);
  const resized=await state();
  results.push({mode,home,projects,font,fontMetrics,scroll,afterScroll,resized,elapsedMs:Date.now()-t});
 }
 console.log(JSON.stringify({results,exceptions:events},null,2));
}finally{ws?.close();proc.kill();await new Promise(r=>proc.exitCode!==null||proc.signalCode!==null?r():proc.once("exit",r));server.close();rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
