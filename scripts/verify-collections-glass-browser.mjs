/*
 * Chromium geometry/interaction test for the flat fixed Collections dock.
 * Renders the real controls with production CSS on arbitrary page scenery,
 * verifying that no shader, backdrop-filter, or optical overlay is active.
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
 '<script>window.__ready=true;</script></body></html>'
].join("");
const files=new Map([
 ["dashboard.css","sites/_apex/app/assets/dashboard.css"],
 ["workspace-theme.css","sites/_apex/app/assets/workspace-theme.css"],
 ["workspace-enhancements.css","sites/_apex/app/assets/workspace-enhancements.css"],
 ["collections.css","sites/_apex/app/assets/collections.css"],
 ["workspace-rail-tooltips.js","sites/_apex/app/assets/workspace-rail-tooltips.js"],
 ["cloud-utility-mask.v1.svg","sites/_apex/app/assets/cloud-utility-mask.v1.svg"],
 ["direct-utility-mask.v1.svg","sites/_apex/app/assets/direct-utility-mask.v1.svg"],
 ["local-provider-mask.v1.svg","sites/_apex/app/assets/local-provider-mask.v1.svg"],
 ["external-provider-mask.v2.svg","sites/_apex/app/assets/external-provider-mask.v2.svg"],
 ["collections-glass.js","sites/_apex/app/assets/collections-glass.js"],
 ["collections-glass-public-clear.js","sites/_apex/app/assets/collections-glass-public-clear.js"],
 ["collections-glass-field-worker.js","sites/_apex/app/assets/collections-glass-field-worker.js"],
 ["sidebar-glass-oracle.js","sites/_apex/app/assets/sidebar-glass-oracle.js"],
 ["add-collection.v3.svg","sites/_apex/app/assets/add-collection.v3.svg"],
 ["add-utilities.v1.svg","sites/_apex/app/assets/add-utilities.v1.svg"],
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
 // The Add utilities SVG must fill the rounded-square button pixel for pixel.
 // Probe the actual production CSS rather than assuming icon dimensions.
 await evaluate('(()=>{const el=document.createElement("div");el.id="utility-square-probe";el.innerHTML=\'<span class="cs-utility-action-control"><button class="cs-utility-action cs-utility-action--add" type="button" data-cs-action="admit" disabled aria-label="Add utilities (coming later)"><img src="/app/assets/add-utilities.v1.svg" alt="" aria-hidden="true"></button></span>\';document.getElementById("cs-root").append(el);return true})()');
 await until('document.querySelector("#utility-square-probe img")?.complete===true',
   "Full-size utility icon asset downloaded");
 const squareMetrics='(()=>{const p=document.getElementById("utility-square-probe"),b=p.querySelector("button"),img=p.querySelector("img"),r=b.getBoundingClientRect(),i=img.getBoundingClientRect(),bs=getComputedStyle(b),is=getComputedStyle(img);return {button:[r.x,r.y,r.width,r.height],icon:[i.x,i.y,i.width,i.height],buttonRadius:bs.borderRadius,iconRadius:is.borderRadius,iconFit:is.objectFit,clip:bs.overflow,disabled:b.disabled,natural:[img.naturalWidth,img.naturalHeight]}})()';
 const desktopSquare=await evaluate(squareMetrics);
 assert.equal(desktopSquare.buttonRadius,"7px");
 assert.equal(desktopSquare.iconRadius,desktopSquare.buttonRadius);
 assert.equal(desktopSquare.iconFit,"fill");
 assert.equal(desktopSquare.clip,"hidden");
 assert.equal(desktopSquare.disabled,true,"Add utilities stays non-operational");
 assert.ok(desktopSquare.natural.every(n=>n>0),"Full-bleed SVG should decode");
 assert.deepEqual(desktopSquare.icon,desktopSquare.button,"Icon must touch each edge of the actual 24px rounded-square button");
 assert.equal(desktopSquare.button[2],24);
 assert.equal(desktopSquare.button[3],24);

 const surface=await evaluate('(()=>{const p=document.querySelector(".cs-control-center"),s=getComputedStyle(p),a=getComputedStyle(p,"::before"),b=getComputedStyle(p,"::after");return {background:s.backgroundColor,filter:s.backdropFilter||s.webkitBackdropFilter,box:s.boxShadow,before:a.content,after:b.content,svgFilters:document.querySelectorAll("#collections-oracle-live-glass").length,ready:p.classList.contains("cs-oracle-ready"),inlineMask:p.style.getPropertyValue("--cs-optical-mask")}})()');
 assert.equal(surface.background,"rgb(22, 22, 22)","The dock is solid dark charcoal");
 assert.equal(surface.filter,"none","No CSS blur, SVG refraction or backdrop sampling");
 assert.equal(surface.box,"none","No inset fake-glass outline or shadow");
 assert.equal(surface.before,"none","No optical overlay pseudo-element");
 assert.equal(surface.after,"none","No optical tint/lighting pseudo-element");
 assert.equal(surface.svgFilters,0,"No glass SVG filter should mount");
 assert.equal(surface.ready,false,"The oracle readiness class must not appear");
 assert.equal(surface.inlineMask,"","No optical displacement texture should be generated");
 const originalSurface=surface;
 await evaluate('(()=>{document.querySelector(".test-scenery").style.background="repeating-linear-gradient(95deg,red 0 8px,blue 8px 16px)";scrollTo(0,1800);return true})()');
 await pause(160);
 const later=await evaluate('(()=>{const p=document.querySelector(".cs-control-center"),s=getComputedStyle(p);return {background:s.backgroundColor,filter:s.backdropFilter||s.webkitBackdropFilter,box:s.boxShadow}})()');
 assert.deepEqual(later,{background:originalSurface.background,filter:"none",box:"none"},
  "The panel remains flat and unchanged above arbitrary scrolling page content");


 // Real source sidebar markup and actual Collections utility route silhouettes.
 // Probe the LAYOUT geometry of all titles/UIDs rather than eyeballing icons.
 const sidebarStart=original.indexOf('<aside class="sidebar" id="workspace-sidebar"');
 const sidebarEnd=original.indexOf("</aside>",sidebarStart);
 assert.ok(sidebarStart>=0&&sidebarEnd>sidebarStart);
 const sidebarMarkup=original.slice(sidebarStart,sidebarEnd+8);
 const fixtureSetup='(async()=>{'+
  'const shell=document.getElementById("workspace-shell");'+
  'shell.insertAdjacentHTML("afterbegin",'+JSON.stringify(sidebarMarkup)+');'+
  'shell.classList.add("is-collapsed");'+
  'const holder=document.createElement("section");holder.id="route-fixture";'+
  'holder.style.cssText="position:absolute;left:35px;top:320px;width:440px;z-index:0";'+
  'for(const mode of ["cloud","direct","local","ported","unknown"]){'+
  'const row=document.createElement("div");row.className="cs-utility-row";row.dataset.mode=mode;'+
  'row.innerHTML="<span class=cs-utility-route-slot>"+'+
  '(mode!=="unknown"?"<span class=\\"cs-utility-route-icon cs-utility-route-icon--"+mode+"\\" role=img aria-label=\\""+mode+"\\"></span>":"")+'+
  '"</span><span class=cs-utility-info><span class=cs-utility-name>"+mode+"</span><span class=cs-utility-uid>uid-"+mode+"</span></span><span class=cs-utility-trailing></span>";'+
  'holder.append(row)};document.getElementById("cs-root").append(holder);'+
  'const m=await import("/app/assets/workspace-rail-tooltips.js");'+
  'window.__rail=m.initCollapsedRailTooltips(document,window,shell,document.getElementById("workspace-sidebar"));'+
  'return !!window.__rail;})()';
 assert.equal(await evaluate(fixtureSetup),true,"Collapsed rail tooltips must initialize");
 const utilityMetrics= '(()=>[...document.querySelectorAll("#route-fixture .cs-utility-row")].map(row=>{'+
  'const slot=row.querySelector(".cs-utility-route-slot"),info=row.querySelector(".cs-utility-info"),'+
  'name=row.querySelector(".cs-utility-name"),uid=row.querySelector(".cs-utility-uid"),icon=row.querySelector(".cs-utility-route-icon");'+
  'const rr=row.getBoundingClientRect(),sr=slot.getBoundingClientRect(),ir=info.getBoundingClientRect();'+
  'const nr=name.getBoundingClientRect(),ur=uid.getBoundingClientRect();'+
  'return {mode:row.dataset.mode,relativeX:ir.left-rr.left,uidX:ur.left,nameX:nr.left,'+
  'slotWidth:sr.width,iconHeight:icon?.getBoundingClientRect().height,rawHeight:icon?parseFloat(getComputedStyle(icon).height):null,scale:icon?getComputedStyle(icon).transform:null}}))()';
 const rows=await evaluate(utilityMetrics);
 assert.equal(rows.length,5);
 assert.ok(rows.every(r=>Math.abs(r.relativeX-rows[0].relativeX)<.06),
  "Every title, including an unknown route, must share one fixed left inset");
 assert.ok(rows.every(r=>Math.abs(r.uidX-r.nameX)<.06),
  "Each UID must begin on the same axis as its title");
 assert.ok(rows.every(r=>Math.abs(r.slotWidth-24)<.06),
  "All desktop icon slots must be exactly 24px regardless of route");
 for(const r of rows.filter(r=>r.mode!=="unknown")){
  assert.ok(Math.abs(r.iconHeight/r.rawHeight-.6)<.003,
   "Exact 60% optical scale of "+r.mode+" while preserving mask geometry");
  assert.ok(r.scale.startsWith("matrix(0.6, 0, 0, 0.6, 0, 0)"));
 }
 console.log("Desktop utility left icons: fixed 24px slot, exact 60% per-route scaling, aligned name/UID",JSON.stringify(rows));

 const tooltipProbe='(async()=>{const sidebar=document.getElementById("workspace-sidebar");'+
  'const toTry=[["main-navigation",["Home","Projects","Settings"]],["project-navigation",["README","Utilities","Collections","Providers","Permissions","Diagnostics","Settings"]],["apple-hig-navigation",["README","Apple HIG Reader overview"]],["custom-project-navigation",["README"]]];'+
  'const seen=[];for(const [navId,labels] of toTry){'+
  'for(const node of sidebar.querySelectorAll(".nav-stack"))node.hidden=node.id!==navId;'+
  'for(const label of labels){const nav=document.getElementById(navId);'+
  'const a=[...nav.querySelectorAll(".nav-link")].find(x=>x.getAttribute("aria-label")===label);'+
  'if(!a)throw Error("Missing nav screen link "+navId+":"+label);'+
  'a.dispatchEvent(new PointerEvent("pointerenter",{pointerType:"mouse"}));'+
  'const t=document.getElementById("workspace-rail-tooltip"),r=a.getBoundingClientRect();'+
  'seen.push({nav:navId,label,rendered:t.textContent,role:t.getAttribute("role"),parent:t.parentElement===document.body,position:t.style.left,described:a.getAttribute("aria-describedby"),visible:t.classList.contains("is-visible"),gap:parseFloat(t.style.left)-r.right});'+
  'a.dispatchEvent(new PointerEvent("pointerleave",{pointerType:"mouse"}));'+
  '}}return seen})()';
 const tips=await evaluate(tooltipProbe);
 assert.equal(tips.length,13,"Every screen button across all four sidebar groups is covered");
 assert.ok(tips.every(t=>t.label===t.rendered&&t.role==="tooltip"&&t.parent&&
  t.described==="workspace-rail-tooltip"&&t.visible&&t.gap>=7),
  "Each tooltip must be correctly named, un-clipped, and anchored right of its button");
 const focused=await evaluate('(()=>{const sidebar=document.getElementById("workspace-sidebar");'+
  'for(const n of sidebar.querySelectorAll(".nav-stack"))n.hidden=n.id!=="main-navigation";'+
  'const a=sidebar.querySelector("#main-navigation .nav-link");a.focus();'+
  'const t=document.getElementById("workspace-rail-tooltip");'+
  'return {keyboard:t.classList.contains("is-keyboard"),visible:t.classList.contains("is-visible"),delay:getComputedStyle(t).transitionDelay,desc:a.getAttribute("aria-describedby"),active:document.activeElement===a,text:t.textContent,rectCount:a.getClientRects().length}})()');
 console.log("Collapsed rail focus diagnostics:",JSON.stringify(focused));
 assert.equal(focused.keyboard,true,"Keyboard focus should bypass hover delay");
 assert.equal(focused.visible,true);
 assert.equal(focused.desc,"workspace-rail-tooltip");
 assert.ok(focused.delay.split(",").every(x=>parseFloat(x)===0),"Keyboard tooltip must appear immediately");
 const hiddenExpanded=await evaluate('(()=>{const shell=document.getElementById("workspace-shell"),a=document.querySelector("#main-navigation .nav-link");'+
  'a.blur();shell.classList.remove("is-collapsed");window.__rail.hide();'+
  'a.dispatchEvent(new PointerEvent("pointerenter",{pointerType:"mouse"}));'+
  'const visible=document.getElementById("workspace-rail-tooltip").classList.contains("is-visible");'+
  'shell.classList.add("is-collapsed");return visible})()');
 assert.equal(hiddenExpanded,false,"Expanded sidebar must never display rail tooltips");

 await command("Emulation.setDeviceMetricsOverride",{width:365,height:740,deviceScaleFactor:2,mobile:true});
 await pause(300);
 const narrow=await evaluate(metrics);
 assert.ok(narrow.right<=narrow.viewport[0]-10,"Floating glass dock stays within small viewport");
 assert.ok(narrow.width<narrow.viewport[0]-20,"Pill is not clipped on mobile");
 assert.ok(narrow.buttons.every(b=>b.w>=47&&b.h>=47));
 assert.ok(Math.abs(narrow.viewport[1]-24-narrow.bottom)<2);
 const mobileRoutes=await evaluate(utilityMetrics);
 assert.ok(mobileRoutes.every(r=>Math.abs(r.slotWidth-21)<.06),
  "All mobile route slots must be exactly 21px");
 assert.ok(mobileRoutes.every(r=>Math.abs(r.relativeX-mobileRoutes[0].relativeX)<.06));
 for(const r of mobileRoutes.filter(r=>r.mode!=="unknown"))
  assert.ok(Math.abs(r.iconHeight/r.rawHeight-.6)<.003,
   "Every mobile icon must retain the 60% scale");
 const mobileRailTip=await evaluate('(()=>{const link=document.querySelector("#main-navigation .nav-link");'+
  'link.dispatchEvent(new PointerEvent("pointerenter",{pointerType:"mouse"}));'+
  'const t=document.getElementById("workspace-rail-tooltip");'+
  'return {visible:t.classList.contains("is-visible"),display:getComputedStyle(t).display}})()');
 assert.equal(mobileRailTip.visible,false);
 assert.equal(mobileRailTip.display,"none","Never show collapsed-desktop rail labels in the mobile drawer");

 const mobileSquare=await evaluate(squareMetrics);
 assert.equal(mobileSquare.buttonRadius,"6px");
 assert.equal(mobileSquare.iconRadius,mobileSquare.buttonRadius,"Mobile corners must match exactly, not approximately");
 assert.deepEqual(mobileSquare.icon,mobileSquare.button);
 assert.equal(mobileSquare.button[2],20);
 assert.equal(mobileSquare.button[3],20);
 assert.equal(mobileSquare.disabled,true);

 const mobileSurface=await evaluate('(()=>{const p=document.querySelector(".cs-control-center"),s=getComputedStyle(p);return {background:s.backgroundColor,filter:s.backdropFilter||s.webkitBackdropFilter}})()');
 assert.deepEqual(mobileSurface,{background:"rgb(22, 22, 22)",filter:"none"},
   "Mobile must render the same flat panel without optical filters");
 await evaluate('document.querySelector(".view").hidden=true;true');
 assert.equal(await evaluate('document.querySelector(".cs-control-center").getBoundingClientRect().width'),0);
 console.log("Collections flat dark dock: fixed 1.5x size, unchanged hit testing, no optical shader/filter/blur, and mobile layout passed.");
}finally{
 try{socket?.close();}catch{}
 chrome.kill("SIGTERM");
 await new Promise(resolve=>server.close(resolve));
 try{rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 catch(error){console.warn("Chrome profile cleanup:",error.message);}
}
function innerNumber(v){return Number(v)}
