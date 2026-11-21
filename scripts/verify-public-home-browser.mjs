/*
 * Browser regression for the standalone, public Dashboard-based homepage.
 * Tests real HTML/CSS/module behavior, not images, accounts or screenshots.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,mkdtempSync,existsSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../sites/_apex/",import.meta.url)));
const mime={".html":"text/html; charset=utf-8",".css":"text/css",
 ".js":"text/javascript",".avif":"image/avif",".wgsl":"text/plain",".svg":"image/svg+xml"};
const misses=new Set();
const server=createServer((req,res)=>{
 const pathname=new URL(req.url||"/","http://127.0.0.1").pathname;
 if(pathname==="/login"){
  res.writeHead(200,{"Content-Type":"text/html"});
  res.end("<!doctype html><title>Sign in route</title><h1>Login test target</h1>");return;
 }
 if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
 const filename=resolve(root,"."+(pathname==="/"?"/index.html":pathname));
 if(!filename.startsWith(root+"/")){res.writeHead(403);res.end();return;}
 try{
  const bytes=readFileSync(filename);
  res.writeHead(200,{"Content-Type":mime[extname(filename)]||"application/octet-stream",
   "Cache-Control":"no-store"});
  res.end(bytes);
 }catch{misses.add(pathname);res.writeHead(404);res.end("Not found");}
});
await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
let binary;
for(const name of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
 try{binary=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
const profile=mkdtempSync(join(tmpdir(),"dof-public-home-"));
let chrome=null,socket=null;
try{
 assert.ok(binary,"Chromium is required to verify public Home");
 chrome=spawn(binary,[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--no-default-browser-check","--disable-gpu",
  "--remote-debugging-port=0","--window-size=1400,880",
  "--user-data-dir="+profile,"about:blank"
 ],{stdio:"ignore"});
 let port;
 for(let i=0;i<120;i++){
  const name=join(profile,"DevToolsActivePort");
  if(existsSync(name)){port=Number(readFileSync(name,"utf8").split("\n")[0]);break;}
  if(chrome.exitCode!==null)throw Error("Chromium exited before DevTools started");
  await sleep(100);
 }
 assert.ok(port,"Chrome DevTools did not become ready");
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{socket.onopen=ok;socket.onerror=fail;});
 let seq=0;const pending=new Map();
 socket.onmessage=event=>{
  const m=JSON.parse(event.data),p=pending.get(m.id);
  if(!p)return;pending.delete(m.id);
  m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
 };
 const send=(method,params={})=>new Promise((ok,fail)=>{
  const id=++seq;pending.set(id,{resolve:ok,reject:fail});
  socket.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 await send("Page.enable");
 await send("Runtime.enable");
 await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
 const origin="http://127.0.0.1:"+server.address().port;
 await send("Page.navigate",{url:origin+"/"});
 let ready=false;
 for(let i=0;i<120;i++){
  if(await evaluate('document.readyState==="complete" && document.querySelectorAll("#cta6-mosaic>.cta6-tile").length===66 && document.styleSheets.length>=3')){ready=true;break;}
  await sleep(80);
 }
 assert.ok(ready,"Public Home did not create its 66 Dashboard squares");
 const expression=[
 '(()=>{const grid=document.getElementById("cta6-mosaic");',
 'const logo=document.getElementById("dashboard-title");',
 'const tiles=grid.querySelectorAll(":scope>.cta6-tile");',
 'const actions=[...document.querySelectorAll(".cta6-bottom-action>.cta6-action")];',
 'const nav=[...document.querySelectorAll("#global-menu-links>button")];',
 'const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,center:r.left+r.width/2,centerY:r.top+r.height/2};};',
 'const occupied=[...grid.querySelectorAll(":scope>.cta6-tile--plain,:scope>.cta6-tile--icon")];',
 'const center=box(logo);const normalized=(tile,rx,ry)=>{const p=box(tile);return Math.hypot((p.center-center.center)/rx,(p.centerY-center.centerY)/ry);};',
 'const inOldOval=occupied.filter(tile=>normalized(tile,65,40)<1).length;',
 'const visiblyFaded=occupied.filter(tile=>{const r=normalized(tile,140,100);return 0.6+0.4*Math.min(1,r)**2<=.86;}).length;',
 'return {viewport:innerWidth,grid:box(grid),logo:box(logo),square:box(tiles[0]),',
 'gap:getComputedStyle(grid).columnGap,font:getComputedStyle(logo).fontSize,',
 'inOldOval,visiblyFaded,occupiedCount:occupied.length,',
 'items:actions.map(e=>({name:e.textContent.trim(),tag:e.tagName,href:e.getAttribute("href"),rect:box(e)})),',
 'nav:nav.map(e=>e.textContent.trim()),',
 'navDisplay:getComputedStyle(document.getElementById("global-menu-links")).display,',
 'hamburgerDisplay:getComputedStyle(document.getElementById("public-menu-toggle")).display,',
 'search:box(document.querySelector(".global-menu-actions>button[aria-label=Search]")),',
 'hamburger:box(document.getElementById("public-menu-toggle")),',
 'panelHidden:document.getElementById("public-menu-panel").hidden,',
 'themeButton:box(document.getElementById("public-theme-toggle")),',
 'themeLabel:document.getElementById("public-theme-toggle").getAttribute("aria-label"),',
 'edgeMask:getComputedStyle(grid).maskImage,',
 'gpuReady:document.body.dataset.gpuScene==="ready",',
 'firstIconFade:getComputedStyle(document.querySelector(".cta6-tile--icon .cta6-icon")).opacity,',
 'firstIconRaw:document.querySelector(".cta6-tile--icon").style.getPropertyValue("--public-icon-spatial-alpha"),',
 'edgeMaskSize:getComputedStyle(grid).maskSize,',
 'edgeMaskPosition:getComputedStyle(grid).maskPosition,',
 'logoFill:getComputedStyle(logo).backgroundColor,',
 'logoPaddingX:getComputedStyle(logo).paddingLeft,',
 'logoPaddingY:getComputedStyle(logo).paddingTop,',
 'logoOvalX:getComputedStyle(grid).getPropertyValue("--public-logo-oval-x").trim(),',
 'logoOvalY:getComputedStyle(grid).getPropertyValue("--public-logo-oval-y").trim(),',
 'logoOffset:getComputedStyle(grid).getPropertyValue("--public-logo-shift").trim(),',
 'maskComposite:getComputedStyle(grid).maskComposite,',
 'github:box(document.querySelector(".public-github")),',
 'githubHref:document.querySelector(".public-github").href,',
 'githubTarget:document.querySelector(".public-github").target,',
 'githubRel:document.querySelector(".public-github").rel,',
 'firstLink:box(nav[0]),scrollWidth:document.documentElement.scrollWidth};})()'
 ].join("");
 // Fail early if a fixture selector breaks the generated browser expression.
 new Function("return "+expression);
 const near=(actual,expected,label,width)=>assert.ok(Math.abs(actual-expected)<.8,
  label+" at "+width+"px: "+actual+" vs "+expected);
 for(const [width,height] of [[1440,900],[1123,780],[1122,780],[1024,740],[760,680],[749,700],[748,700],[747,700],[500,670],[390,610],[320,560]]){
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
  await evaluate("new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))");
  const g=await evaluate(expression);
  assert.equal(g.viewport,width);
  near(g.grid.width,1080,"Full mosaic width",width);
  near(g.grid.center,width/2,"Mosaic center",width);
  near(g.logo.center,width/2,"Doof center",width);
  near(g.logo.centerY,g.grid.centerY-2.5*(950/11),
    "Doof and oval raised another 86px (2.5 tiles above lattice center)",width);
  assert.ok(g.inOldOval>=0,"Former small-oval coverage can change after elevating the logo");
  assert.ok(g.visiblyFaded>=2,
    "Expanded oval must significantly attenuate at least two occupied squares");
  near(g.square.width,(1080-130)/11,"Fixed square size",width);
  assert.equal(g.gap,"13px");assert.equal(g.font,"45px");
  assert.deepEqual(g.nav,["Projects","Quick Downloads","Collections","Contact"]);
  if(width>748){
   assert.equal(g.navDisplay,"flex","Desktop navigation must remain visible");
   assert.equal(g.hamburgerDisplay,"none","No hamburger on desktop");
   assert.ok(g.github.left<g.firstLink.left,"GitHub must lead desktop navigation");
  }else{
   assert.equal(g.navDisplay,"none","Collapse desktop items below 2x action width");
   assert.notEqual(g.hamburgerDisplay,"none","Hamburger appears beside Search");
   assert.ok(g.search.left+g.search.width<=g.hamburger.left+1,"Hamburger follows Search");
   near(g.search.top,g.hamburger.top,"Toolbar icon alignment",width);
  }
  assert.equal(g.panelHidden,true,"Dropdown defaults closed");
  assert.ok(g.themeButton.left>=0&&g.themeButton.left+g.themeButton.width<=width);
  assert.equal(g.themeButton.width,43,"Persistent theme switch is a compact rounded square");
  if(g.gpuReady){
    assert.equal(g.edgeMask,"none","GPU icons must not be cropped by the DOM mosaic");
    assert.ok(Number(g.firstIconFade)>0&&Number(g.firstIconFade)<=1,
      "Glyph alpha must be in the shader range");
    assert.ok(Number(g.firstIconRaw)>0&&Number(g.firstIconRaw)<=1,
      "GPU renderer must provide the matching SVG alpha every frame");
  }else{
    assert.match(g.edgeMask,/linear-gradient\(to right/,"Fallback mosaic is masked");
  assert.match(g.edgeMask,/rgba\(0, 0, 0, 0\.25\)/,
    "Square mask opacity is 25% at both viewport edges");
    assert.equal(g.edgeMaskSize,[width+"px 100%",width+"px 100%"].join(", "),
      "Both mask layers must match viewport width, not the 1080px lattice");
    assert.equal(g.edgeMaskPosition,"50% 0%, 50% 0%",
      "Both alpha masks center within the oversized lattice");
  assert.equal(g.logoFill,"rgba(0, 0, 0, 0)","Doof text has no backing fill");
  assert.equal(g.logoPaddingX,"0px","Doof text has no new padding");
  assert.equal(g.logoPaddingY,"0px","Doof text has no new padding");
  assert.equal(g.logoOvalX,"140px","Oval reaches surrounding populated squares");
  assert.equal(g.logoOvalY,"100px","Oval reaches surrounding populated squares");
  assert.equal(g.logoOffset,"215.90909px","Oval matches raised Doof center");
  assert.match(g.edgeMask,/radial-gradient/,"DOM squares have elliptical opacity dip");
  assert.match(g.edgeMask,/rgba\(0, 0, 0, 0\.6\)/,
    "Square opacity reduces to 60% at the logo");
    assert.ok(g.maskComposite.split(",").every(mode=>mode.trim()==="intersect"),
      "Both fallback masks must intersect, never form a union");
  }
  assert.equal(g.githubHref,"https://github.com/lukehanna12");
  assert.equal(g.githubTarget,"_blank","GitHub opens a new tab");
  assert.ok(g.githubRel.split(/\s+/).includes("noopener"));
  assert.ok(g.githubRel.split(/\s+/).includes("noreferrer"));
  assert.deepEqual(g.items.map(e=>[e.tag,e.name,e.href]),[
   ["BUTTON","Projects",null],["A","Sign in","/login"],["BUTTON","Settings",null]]);
  for(let i=1;i<g.items.length;i++){
   near(g.items[i].rect.top,g.items[0].rect.top,"Button-row alignment",width);
   near(g.items[i].rect.height,g.items[0].rect.height,"Button-row height",width);
  }
  const [projects,signIn,contact]=g.items.map(item=>item.rect);
  near(projects.width,contact.width,"Projects/Contact matching widths",width);
  near(signIn.width,projects.width*1.5,"Sign in 50% wider",width);
  const left=g.items[0].rect.left;
  const right=g.items[2].rect.left+g.items[2].rect.width;
  near((left+right)/2,width/2,"Bottom action group center",width);
  assert.ok(left>=0&&right<=width,"All three buttons must fit the viewport at "+width);
  assert.ok(g.scrollWidth<=width+1,"No horizontal page scrolling at "+width);
  process.stdout.write("Public Home geometry passed at "+width+"x"+height+"\n");
 }
 // Verify shared theme preference without affecting layout or the route.
 assert.equal(await evaluate('document.getElementById("public-theme-toggle").getAttribute("aria-label")'),
  "Switch to light mode");
 await evaluate('document.getElementById("public-theme-toggle").click()');
 assert.equal(await evaluate('document.documentElement.dataset.dofTheme'),"light");
 assert.equal(await evaluate('localStorage.getItem("dofinances-theme")'),"light");
 assert.equal(await evaluate('document.getElementById("public-theme-toggle").getAttribute("aria-pressed")'),"false");
 // Verify disclosure open/close, inert entries, Escape and breakpoint reset.
 await send("Emulation.setDeviceMetricsOverride",{
  width:500,height:670,deviceScaleFactor:1,mobile:false
 });
 await evaluate("document.getElementById('public-menu-toggle').click()");
 const openPanel=await evaluate(`(()=>{
  const toggle=document.getElementById("public-menu-toggle");
  const panel=document.getElementById("public-menu-panel");
  const r=panel.getBoundingClientRect();
  return {expanded:toggle.getAttribute("aria-expanded"),hidden:panel.hidden,
   labels:[...panel.querySelectorAll("button")].map(e=>e.textContent.trim()),
   right:r.right,top:r.top,width:r.width};
 })()`);
 assert.equal(openPanel.expanded,"true");
 assert.equal(openPanel.hidden,false);
 assert.deepEqual(openPanel.labels,["Projects","Quick Downloads","Collections","Contact"]);
 assert.ok(openPanel.right<=501&&openPanel.width<=500,"Dropdown within viewport");
 await evaluate('document.querySelector(".public-menu-panel button").click()');
 assert.equal(await evaluate('document.getElementById("public-menu-panel").hidden'),true,
  "Inert option should dismiss the dropdown");
 await evaluate("document.getElementById('public-menu-toggle').click()");
 await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
 assert.equal(await evaluate('document.getElementById("public-menu-panel").hidden'),true,
  "Escape should close the dropdown");
 await evaluate("document.getElementById('public-menu-toggle').click()");
 await evaluate('document.querySelector(".public-github").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');
 assert.equal(await evaluate('document.getElementById("public-menu-panel").hidden'),true,
  "Clicking outside should dismiss the dropdown");
 await evaluate("document.getElementById('public-menu-toggle').click()");
 await send("Emulation.setDeviceMetricsOverride",{
  width:1440,height:900,deviceScaleFactor:1,mobile:false
 });
 await evaluate("new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))");
 assert.equal(await evaluate('document.getElementById("public-menu-panel").hidden'),true,
  "Resizing to desktop should close the dropdown");
 const inert=await evaluate([
  '(()=>{const before=location.href;',
  'for(const b of [...document.querySelectorAll(".global-menu button"),',
  '...document.querySelectorAll(".cta6-bottom-action button")])b.click();',
  'return {before,after:location.href};})()'
 ].join(""));
 assert.equal(inert.before,inert.after,"Placeholder buttons must not navigate");
 // Non-reduced-motion is essential here: an X-close poof must have a
 // visible intermediate state before the legitimate /login navigation.
 await send("Emulation.setEmulatedMedia",{
   features:[{name:"prefers-reduced-motion",value:"no-preference"}]
 });
 await evaluate('document.querySelector(".cta6-bottom-action a").click()');
 const duringDismiss=await evaluate(`(()=>{
   const tile=document.querySelector(".cta6-tile--icon");
   return {route:document.body.dataset.publicRoute,
     path:location.pathname,
     style:getComputedStyle(tile).transform,
     target:getComputedStyle(document.querySelector(".cta6-bottom-action")).opacity,
     theme:!!document.getElementById("public-theme-toggle")};
 })()`);
 assert.equal(duringDismiss.route,"leaving","Sign in starts the X-close poof");
 assert.equal(duringDismiss.path,"/","Route changes only after the poof");
 assert.equal(duringDismiss.theme,true,"Theme switch remains present during transition");
 assert.ok(!duringDismiss.style.includes("600px"),
   "Tiles must not use the old right-swipe transform");
 let loginReached=false;
 for(let i=0;i<50;i++){
  if(await evaluate('location.pathname==="/login" && !!document.querySelector("h1")')){loginReached=true;break;}
  await sleep(60);
 }
 assert.ok(loginReached,"Sign in must reach /login");
 assert.deepEqual([...misses],[],"Homepage must load its own public assets");
 process.stdout.write("Public Home CTA and inert navigation verified.\n");
}finally{
 try{socket?.close();}catch{}
 if(chrome&&chrome.exitCode===null&&chrome.signalCode===null){
  await new Promise(ok=>{chrome.once("exit",ok);try{chrome.kill("SIGTERM");}catch{ok();}setTimeout(ok,3000);});
 }
 server.close();
 try{rmSync(profile,{recursive:true,force:true,maxRetries:15,retryDelay:200});}
 catch(err){process.stderr.write("Chromium cleanup: "+err.message+"\n");}
}
