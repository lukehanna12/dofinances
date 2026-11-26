// Actual public shell smoke/performance on the reference browser.
// Local same-origin fixture artwork is used instead of remote library photos.
// No browser screenshot or rendered-page capture.
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,join,extname} from "node:path";
import {tmpdir} from "node:os";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../sites/_apex/",import.meta.url))),profile=mkdtempSync(join(tmpdir(),"lg-site-browser-"));
const dist=resolve(root,"../../dist");
const mime={".js":"text/javascript",".css":"text/css",".html":"text/html",".svg":"image/svg+xml",".json":"application/json",".webp":"image/webp",".avif":"image/avif",".wgsl":"text/plain"};
const server=createServer((req,res)=>{
 const path=new URL(req.url,"http://127.0.0.1").pathname;
 try{
  let target=resolve(root,"."+path);
  if(process.env.LG_SITE_MODE==="fallback"&&path==="/assets/home-dashboard/continuous-icon-vectors.json"){res.writeHead(503);return res.end("Controlled candidate asset failure");}
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
const nativeZoom=process.env.LG_NATIVE_ZOOM==="1",extension=join(profile,"zoom-extension");
if(nativeZoom){mkdirSync(extension);writeFileSync(join(extension,"manifest.json"),JSON.stringify({manifest_version:3,name:"Isolated glass zoom verification",version:"1.0",permissions:["tabs"],background:{service_worker:"worker.js"},content_scripts:[{matches:["http://127.0.0.1/*"],js:["content.js"],run_at:"document_idle"}]}));writeFileSync(join(extension,"worker.js"),'chrome.runtime.onMessage.addListener((message,sender,reply)=>{chrome.tabs.setZoom(sender.tab.id,message.zoom).then(()=>reply({ok:true}),e=>reply({error:String(e)}));return true;});');writeFileSync(join(extension,"content.js"),'window.addEventListener("lg-zoom-request",e=>{chrome.runtime.sendMessage({zoom:Number(e.detail)},r=>window.dispatchEvent(new CustomEvent("lg-zoom-result",{detail:JSON.stringify(r||{error:String(chrome.runtime.lastError)})})));});document.documentElement.dataset.lgZoomReady="1";');}
const proc=spawn(process.env.CHROME_BIN??"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless=new","--enable-unsafe-webgpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=0","--user-data-dir="+profile,"--window-size=1400,880",...(nativeZoom?["--load-extension="+extension,"--disable-extensions-except="+extension]:[]),"about:blank"],{stdio:["ignore","ignore","pipe"]});
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
 await send("Page.enable");await send("Runtime.enable");await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:process.env.LG_INTERACTIONS?"no-preference":"reduce"}]});
 const origin="http://127.0.0.1:"+server.address().port,results=[];
 const state=()=>ev(`(()=>{const a=window.__dashboardWebGPU;return {status:a?.status,renderer:a?.glassRenderer,errors:a?.errors,frame:a?.frameCount,sceneBuilds:a?.sceneBuilds,route:window.__dofPublicRouter?.state,icons:a?.glassSilhouettes?.icons?.map(x=>({slug:x.slug,vector:x.continuousVector,coverage:x.vectorCoverage})),title:a?.projectTitleMask,lattice:a?.sourceLattice,maskSize:a?.glassSilhouettes?.maskSize,atlasBytes:a?.glassSilhouettes?.atlasBytes,cache:a?.glassSilhouettes?.continuousSampleCache,panes:a?.projectGlass?.count,canvas:[innerWidth,innerHeight,devicePixelRatio]}})()`);
 for(const mode of (process.env.LG_SITE_MODE?[process.env.LG_SITE_MODE]:process.env.LG_PERFORMANCE?(process.env.LG_PERFORMANCE==="reverse"?["continuous","baseline"]:["baseline","continuous"]):["baseline","continuous"])){
  if(!nativeZoom)await send("Emulation.setDeviceMetricsOverride",{width:1400,height:880,deviceScaleFactor:2,mobile:false});
  const t=Date.now();await send("Page.navigate",{url:origin+"/?"+(["default","fallback"].includes(mode)?"":"glass-renderer="+mode)+(process.env.LG_TITLE_OUTLINE?"&glass-title-vector=1":process.env.LG_PORTABLE_TITLE?"&glass-title-vector=portable":process.env.LG_LOCAL_TITLE?"&glass-title-vector="+(process.env.LG_LOCAL_TITLE==="reuse"?"local-reuse":"local"):"")+(process.env.LG_DENSITY_CHECK||process.env.LG_ROUTE_UNDERLAY?"&glass-source-proof":"")});
  await wait('window.__dashboardWebGPU?.status==="ready"',"Home renderer not ready");
  await wait('window.__dashboardWebGPU?.glassSilhouettes?.homeIcons?.length>0',"Home icon glass not rendered");
  const home=await state(),homeReadyMs=Date.now()-t;
  const homeIcons=await ev(`(()=>{const a=window.__dashboardWebGPU,icons=a.glassSilhouettes.homeIcons;
    return {icons,errors:a.errors,owned:[...document.querySelectorAll(".cta6-icon[data-glass-icon-owned]")].every(img=>getComputedStyle(img).clipPath!=="none")};})()`);
  if(!homeIcons.icons.length||homeIcons.errors.length||!homeIcons.owned||homeIcons.icons.some(i=>i.tint!=="black"||i.tintOpacity!==1||((mode==="continuous"||mode==="default")&&(!i.continuousVector||!i.vectorCoverage))))throw Error("Home silhouette regression "+JSON.stringify(homeIcons));
  if(process.env.LG_HOME_ONLY){
    await ev(`matchMedia("(prefers-reduced-motion: reduce)").matches`);
    const before=await ev("window.__dashboardWebGPU.frameCount");const start=Date.now();
    await sleep(1500);
    const after=await ev("window.__dashboardWebGPU.frameCount");
    const result=await ev(`(()=>{const a=window.__dashboardWebGPU;return {homeIcons:a.glassSilhouettes.homeIcons,errors:a.errors,cache:a.glassSilhouettes.continuousSampleCache,track:a.track};})()`);
    if(result.errors.length)throw Error(JSON.stringify(result.errors));
    results.push({mode,homeReadyMs,frames:after-before,elapsedMs:Date.now()-start,...result});continue;
  }
  if(mode==="default"&&home.renderer!=="continuous-candidate")throw Error("Default renderer did not activate "+JSON.stringify(home));
  if(mode==="fallback"){const reason=await ev("window.__dashboardWebGPU.continuousStartupFallback");if(home.renderer!=="baseline"||!reason||home.errors.length)throw Error("Candidate startup did not preserve baseline "+JSON.stringify({home,reason}));results.push({mode,home,reason});continue;}
  if(nativeZoom){
   await wait(`document.documentElement.dataset.lgZoomReady==="1"`,"Native zoom extension not loaded");
   const cases=[];
   await ev(`(()=>{window.__lgResolutionEvents={resize:0,media:0};addEventListener("resize",()=>window.__lgResolutionEvents.resize++);let q;const arm=()=>{q=matchMedia("(resolution: "+devicePixelRatio+"dppx)");q.addEventListener("change",()=>{window.__lgResolutionEvents.media++;arm()},{once:true});};arm();return true;})()`);
   const zoom=async factor=>{
    const old=await ev(`({dpr:devicePixelRatio,resize:window.__dashboardWebGPU.resizeSubmissions||0})`);
    const ack=await ev(`new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error("Zoom extension timeout")),3000);window.addEventListener("lg-zoom-result",e=>{clearTimeout(t);resolve(JSON.parse(e.detail));},{once:true});window.dispatchEvent(new CustomEvent("lg-zoom-request",{detail:${factor}}));})`);
    if(!ack.ok)throw Error(JSON.stringify(ack));
    await wait(`devicePixelRatio!==${old.dpr}&&window.__dashboardWebGPU.status==="ready"&&window.__dashboardWebGPU.resizeSubmissions>${old.resize}&&document.querySelector("#dashboard-webgpu-scene").width===Math.floor(innerWidth*devicePixelRatio)`,"Browser zoom not automatically applied "+factor);
    await sleep(180);const snapshot=await state(),events=await ev("window.__lgResolutionEvents"),submissions=await ev("window.__dashboardWebGPU.resizeSubmissions");
    if(snapshot.errors.length)throw Error(JSON.stringify(snapshot.errors));cases.push({factor,events,submissions,...snapshot});
   };
   for(const factor of [1.25,.8,1])await zoom(factor);
   await ev(`document.querySelector("[data-public-target='/projects']").click()`);
   await wait(`window.__dofPublicRouter.state==="projects"&&document.querySelector(".public-projects-root.is-settled")&&window.__dashboardWebGPU?.projectTitleMask?.vectorOptics`,"Projects after native zoom");
   for(const factor of [1.25,.8,1])await zoom(factor);
   results.push({mode,cases});continue;
  }
  if(process.env.LG_REAL_LOGIN){
   await ev(`document.querySelector(".cta6-bottom-action a[href='/login']").click()`);
   await wait(`location.pathname==="/login"&&document.querySelector(".auth3-root form")&&window.__dashboardWebGPU?.authGlass?.opacity>=.99`,"Actual login not rendered");
   const target=await ev(`(()=>{const r=document.querySelector("[data-auth-glass-input]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
   await send("Input.dispatchMouseEvent",{type:"mouseMoved",...target});
   await wait("window.__dashboardWebGPU?.authGlass?.cardHovered&&window.__dashboardWebGPU?.authGlass?.controlHovered","Login hover not reflected");
   await send("Input.dispatchMouseEvent",{type:"mousePressed",...target,button:"left",clickCount:1});await sleep(200);
   const pressed=await ev(`(()=>{const a=window.__dashboardWebGPU;return {status:a.status,errors:a.errors,glass:a.authGlass,mode:document.body.dataset.authGlassMode,scene:document.body.dataset.authGpuScene};})()`);
   await send("Input.dispatchMouseEvent",{type:"mouseReleased",...target,button:"left",clickCount:1});
   await ev(`document.querySelector(".auth3-back-link").click()`);
   await wait(`location.pathname==="/"&&window.__dofPublicRouter?.state==="home"&&!document.querySelector(".auth3-root")`,"Return to Home failed");
   if(pressed.status!=="ready"||pressed.errors.length||pressed.mode!=="webgpu"||pressed.scene!=="ready")throw Error("Login GPU regression "+JSON.stringify(pressed));
   results.push({mode,home,pressed,returned:await state()});continue;
  }
  if(process.env.LG_ROUTE_UNDERLAY){
   const cases=[];
   for(const density of (process.env.LG_ROUTE_DPR?[Number(process.env.LG_ROUTE_DPR)]:[2,1,3])){
    await send("Emulation.setDeviceMetricsOverride",{width:1400,height:880,deviceScaleFactor:density,mobile:false});
    await ev("window.__dashboardGpuControls.reflowTiles()");
    await wait("document.querySelector('#dashboard-webgpu-scene').width==="+Math.floor(1400*density),"Route output not ready");
    if(await ev("window.__dofPublicRouter.state")!=="projects"){
     await ev(`document.querySelector("[data-public-target='/projects']").click()`);
     await wait(`window.__dofPublicRouter.state==="projects"&&document.querySelectorAll(".project-showcase-card").length>=16`,"Projects not ready");
    }
    await wait(`window.__dashboardWebGPU?.glassSilhouettes?.icons?.length>0`,"Icons not ready");
    if(!await ev(`document.querySelector("[data-public-project-glass='filter']").getAttribute("aria-expanded")==="true"`))await ev(`document.querySelector("[data-public-project-glass='filter']").click()`);
    await wait(`window.__dashboardWebGPU?.sourceComposition?.completedLayers?.length>0&&!!window.__dashboardWebGPU?.routeCompositeLattice`,"Route optical layer not composed");
    await sleep(250);
    const result=await ev(`(()=>{const a=window.__dashboardWebGPU;return {status:a.status,errors:a.errors,source:a.sourceLattice,route:a.routeCompositeLattice,composition:a.sourceComposition,cache:a.glassSilhouettes?.continuousSampleCache};})()`);
    if(result.status!=="ready"||result.errors.length||result.route.width!==result.source.width||result.route.height!==result.source.height||!result.route.referenceIcons||!result.route.referenceGlyph)throw Error("Reference route underlay failure "+JSON.stringify(result));
    // Capture bounded owned optical input arrays, never displayed pixels.
    const regions=await ev(`(()=>{const icon=document.querySelector(".project-showcase-card [data-glass-silhouette-source]").getBoundingClientRect(),title=document.querySelector(".public-projects-title").getBoundingClientRect(),card=document.querySelector(".project-showcase-card").getBoundingClientRect();return [[Math.floor(icon.x+8),Math.floor(icon.y+8),24,24],[Math.floor(title.x+15),Math.floor(title.y+12),24,24],[Math.floor(card.x+8),Math.floor(card.y+8),24,24],[100,150,24,24]]})()`);
    const samples=[];
    for(const region of regions)samples.push(await ev("window.__dashboardGpuControls.sourceRegionDigest('underlay',"+JSON.stringify(region)+",'numeric')"));
    cases.push({density,...result,regions,samples});
   }
   results.push({mode,cases});continue;
  }
  if(process.env.LG_HOME_UNDERLAY){
   const cases=[];
   for(const density of [1,3]){
    await send("Emulation.setDeviceMetricsOverride",{width:1400,height:880,deviceScaleFactor:density,mobile:false});
    await ev("window.__dashboardGpuControls.reflowTiles()");
    await wait("document.querySelector('#dashboard-webgpu-scene').width==="+Math.floor(1400*density),"Underlay output not ready");
    const target=await ev(`(()=>{const r=document.querySelector(".cta6-bottom-action > [data-home-cta-glass]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    const before=await ev("window.__dashboardWebGPU.homeCtaGlass?.compositeFrames||0");
    await send("Input.dispatchMouseEvent",{type:"mouseMoved",...target});
    await wait("window.__dashboardWebGPU.homeCtaGlass?.compositeFrames>"+before,"Hover underlay not rendered");
    await send("Input.dispatchMouseEvent",{type:"mousePressed",...target,button:"left",clickCount:1});
    await sleep(250);
    const result=await ev(`(()=>{const a=window.__dashboardWebGPU;return {status:a.status,errors:a.errors,lattice:a.sourceLattice,underlay:a.homeCompositeLattice,cta:a.homeCtaGlass};})()`);
    await send("Input.dispatchMouseEvent",{type:"mouseReleased",...target,button:"left",clickCount:1});
    await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:10,y:50});
    if(result.status!=="ready"||result.errors.length||result.underlay[0]!==result.lattice.width||result.underlay[1]!==result.lattice.height)throw Error("Fixed Home underlay failure "+JSON.stringify(result));
    cases.push({density,...result});
   }
   results.push({mode,cases});continue;
  }
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
  if(home.renderer!==(["continuous","default"].includes(mode)?"continuous-candidate":"baseline"))throw Error("Wrong renderer "+JSON.stringify(home));
  const entryStart=Date.now();
  await ev('Array.from(document.querySelectorAll("[data-public-target]")).find(n=>n.dataset.publicTarget==="/projects").click()');
  await wait('window.__dofPublicRouter?.state==="projects"&&document.querySelectorAll(".project-showcase-card").length>=16&&window.__dashboardWebGPU?.glassSilhouettes?.icons?.length>0',"Projects not rendered");
  const firstProjectFrameMs=Date.now()-entryStart;
  if(process.env.LG_COLD_ENTRY)await wait(`document.querySelector(".public-projects-root.is-settled")&&window.__dashboardWebGPU?.glassSilhouettes?.icons?.length>=15`,"Complete Projects entry not ready");
  const projectEntryMs=Date.now()-entryStart;
  await sleep(400);
  const projects=await state();if(process.env.LG_REAL_ART_DIR){
   // Artwork is intentionally not assigned a source until user interaction.
   // Invoke each authored reveal event in this test, and force eager decode
   // only in the isolated browser to verify the complete catalog.
   const decoded=await ev(`(async()=>{const cards=[...document.querySelectorAll(".project-showcase-card")];return Promise.all(cards.map(async c=>{const img=c.querySelector(".project-showcase-photo");img.loading="eager";c.dispatchEvent(new PointerEvent("pointerenter"));try{await img.decode();return {slug:c.dataset.projectSlug,src:img.getAttribute("src"),width:img.naturalWidth,height:img.naturalHeight};}catch{return {slug:c.dataset.projectSlug,src:img.getAttribute("src"),width:0};}}));})()`);
   if(decoded.some(x=>!x.width))throw Error("Production artwork decode failed "+JSON.stringify(decoded.filter(x=>!x.width)));projects.realArtwork=decoded;
  }
  if(mode==="continuous"&&(process.env.LG_TITLE_OUTLINE||process.env.LG_PORTABLE_TITLE||process.env.LG_LOCAL_TITLE)&&!projects.title?.vectorOptics)throw Error("Title vector optics not enabled "+JSON.stringify(projects.title));
  await send("DOM.enable");await send("CSS.enable");const doc=await send("DOM.getDocument");const title=await send("DOM.querySelector",{nodeId:doc.root.nodeId,selector:".public-projects-title"});const font=await send("CSS.getPlatformFontsForNode",{nodeId:title.nodeId});const fontMetrics=await ev(`(()=>{const n=document.querySelector(".public-projects-title"),s=getComputedStyle(n),c=document.createElement("canvas").getContext("2d");c.font=s.fontStyle+" "+s.fontWeight+" "+s.fontSize+" "+s.fontFamily;c.letterSpacing=s.letterSpacing;let m=c.measureText(n.textContent);return {font:c.font,spacing:c.letterSpacing,rect:[n.offsetWidth,n.offsetHeight],width:m.width,ascent:m.fontBoundingBoxAscent,descent:m.fontBoundingBoxDescent,actual:[m.actualBoundingBoxLeft,m.actualBoundingBoxRight,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent]};})()`);
  if(["continuous","default"].includes(mode)&&(projects.maskSize!==0||projects.icons.some(x=>!x.vector||!x.coverage)))throw Error("Candidate optical mask regression "+JSON.stringify(projects));
  if(process.env.LG_PERFORMANCE){
   await send("Performance.enable");
   const readMetrics=async()=>Object.fromEntries((await send("Performance.getMetrics")).metrics.map(x=>[x.name,x.value]));
   const runs=[];
   for(let trial=0;trial<4;trial++){
    await ev(`document.querySelector("#public-route-content").scrollTop=0`);await sleep(150);
    const before=await readMetrics(),b=await state();
    const scroll=await ev(`(async()=>{const outlet=document.querySelector("#public-route-content"),a=window.__dashboardWebGPU.frameCount,t=performance.now(),frames=[];for(let i=0;i<24;i++){outlet.scrollTop=Math.max(0,Math.min(outlet.scrollHeight-outlet.clientHeight,(i<=12?i:24-i)*15.5));await new Promise(r=>requestAnimationFrame(r));frames.push(performance.now());}return {ms:performance.now()-t,frameDelta:window.__dashboardWebGPU.frameCount-a,intervals:frames.slice(1).map((v,i)=>v-frames[i])};})()`);
    await sleep(100);const after=await readMetrics(),a=await state();
    const metrics=Object.fromEntries(["TaskDuration","ScriptDuration","LayoutDuration","RecalcStyleDuration","LayoutCount","RecalcStyleCount"].map(k=>[k,after[k]-before[k]]));
    runs.push({scroll,metrics,cacheBefore:b.cache,cacheAfter:a.cache,errors:a.errors});
   }
   results.push({mode,initialMs:Date.now()-t,projects,runs});continue;
  }
  if(process.env.LG_INTERACTIONS){
   await wait(`document.querySelector(".public-projects-root.is-settled")`,"Entry not settled");
   const steps=[];
   const capture=async name=>{const x=await ev(`(()=>{const a=window.__dashboardWebGPU,root=document.querySelector(".public-projects-root");return {status:a.status,errors:a.errors,frame:a.frameCount,route:window.__dofPublicRouter.state,expanded:root?.querySelector(".project-showcase-card.is-expanded")?.dataset.projectSlug,visible:root?[...root.querySelectorAll(".project-showcase-card")].filter(n=>!n.hidden).length:0,roles:a.projectGlass?.roles,composition:a.sourceComposition?.completedLayers,iconHover:a.glassSilhouettes?.icons?.map(x=>[x.slug,x.hover]),title:a.projectTitleMask?.vectorOptics};})()`);if(x.errors.length||x.status!=="ready")throw Error(name+" "+JSON.stringify(x));steps.push({name,...x});};
   const target=await ev(`(()=>{const c=document.querySelector(".project-showcase-card"),r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,slug:c.dataset.projectSlug};})()`);
   await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:target.x,y:target.y});
   await wait(`window.__dashboardWebGPU.glassSilhouettes.icons.some(x=>x.slug===${JSON.stringify(target.slug)}&&x.hover>.95)`,"Project hover not reflected");await capture("hover");
   await send("Input.dispatchMouseEvent",{type:"mousePressed",x:target.x,y:target.y,button:"left",clickCount:1});await sleep(100);await capture("pressed");
   await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:target.x,y:target.y,button:"left",clickCount:1});
   await wait(`document.querySelector(".project-showcase-card.is-expanded")?.dataset.projectSlug===${JSON.stringify(target.slug)}`,"Expansion not activated");await sleep(700);await capture("expanded");
   const next=await ev(`(()=>{const c=[...document.querySelectorAll(".project-showcase-card")].find(n=>!n.hidden&&!n.classList.contains("is-expanded")&&n.getBoundingClientRect().width>10);const id=c.dataset.projectSlug;c.click();return id;})()`);
   await wait(`document.querySelector(".project-showcase-card.is-expanded")?.dataset.projectSlug===${JSON.stringify(next)}&&!document.querySelector(".public-projects-root.is-project-retargeting")`,"Direct switch not settled");await capture("retargeted");
   await ev(`document.querySelector(".public-projects-filter-button").click()`);await wait(`document.querySelector(".public-projects-filter-button").getAttribute("aria-expanded")==="true"&&window.__dashboardWebGPU.sourceComposition?.completedLayers?.length>0`,"Filter overlap not rendered");await sleep(300);await capture("overlap");
   await ev(`document.querySelector(".public-projects-filter-option").click()`);await sleep(500);await capture("filtered");
   await ev(`document.querySelector(".public-projects-filter-option").click();document.querySelector(".public-projects-filter-button").click()`);await sleep(350);await capture("restored");
   await ev(`document.querySelector(".public-projects-back").click()`);await wait(`window.__dofPublicRouter.state==="home"&&!document.querySelector(".public-projects-root")`,"Return to Home not complete");await capture("home");
   results.push({mode,steps});continue;
  }
  if(process.env.LG_TITLE_SMOKE){results.push({mode,home,projects,font,fontMetrics,homeReadyMs,firstProjectFrameMs,projectEntryMs});continue;}
  const scroll=await ev(`(async()=>{const outlet=document.querySelector("#public-route-content"),a=window.__dashboardWebGPU.frameCount,t=performance.now(),frames=[];for(let i=0;i<12;i++){outlet.scrollTop=Math.max(0,Math.min(outlet.scrollHeight-outlet.clientHeight,i*17.25));await new Promise(r=>requestAnimationFrame(r));frames.push(performance.now());}return {ms:performance.now()-t,frameDelta:window.__dashboardWebGPU.frameCount-a,scroll:outlet.scrollTop,intervals:frames.slice(1).map((v,i)=>v-frames[i])};})()`);
  const afterScroll=await state();
  await send("Emulation.setDeviceMetricsOverride",{width:1024,height:720,deviceScaleFactor:2,mobile:false});await sleep(600);
  const resized=await state();
  results.push({mode,home,projects,font,fontMetrics,scroll,afterScroll,resized,elapsedMs:Date.now()-t});
 }
 console.log(JSON.stringify({results,exceptions:events},null,2));
}finally{ws?.close();proc.kill();await new Promise(r=>proc.exitCode!==null||proc.signalCode!==null?r():proc.once("exit",r));server.close();rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
