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
 // The prebuild Home probe uses a tiny on-demand route stub. The
 // production-built React card is verified separately after Vite runs.
 if(pathname==="/assets/public-login-manifest.json"){
  res.writeHead(200,{"Content-Type":"application/json"});
  res.end(JSON.stringify({js:"/assets/public-login-test-card.js",css:[]}));return;
 }
 if(pathname==="/assets/public-login-test-card.js"){
  res.writeHead(200,{"Content-Type":"text/javascript"});
  res.end('export function mountLogin(host,{onExitComplete}){const card=document.createElement("h2");card.textContent="Sign in";host.append(card);return {exit(){onExitComplete()},unmount(){card.remove()}}}');return;
 }
 if(pathname==="/login"||pathname==="/login/"){
  res.writeHead(200,{"Content-Type":"text/html"});
  res.end(readFileSync(resolve(root,"index.html"),"utf8").replace(
    '<body class="public-home">',
    '<body class="public-home" data-public-route="leaving" data-direct-login="true">'));return;
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
 'items:actions.map(e=>({name:e.textContent.trim(),tag:e.tagName,href:e.getAttribute("href"),rect:box(e),glass:e.hasAttribute("data-home-cta-glass"),radius:getComputedStyle(e).borderTopLeftRadius,background:getComputedStyle(e).backgroundColor,tint:Number(getComputedStyle(e).getPropertyValue("--home-cta-tint"))})),',
 'nav:nav.map(e=>e.textContent.trim()),',
 'navDisplay:getComputedStyle(document.getElementById("global-menu-links")).display,',
 'hamburgerDisplay:getComputedStyle(document.getElementById("public-menu-toggle")).display,',
 'search:box(document.querySelector(".global-menu-actions>button[aria-label=Search]")),',
 'hamburger:box(document.getElementById("public-menu-toggle")),',
 'panelHidden:document.getElementById("public-menu-panel").hidden,',
 'themeRemoved:!document.getElementById("public-theme-toggle"),',
 'themeMode:document.documentElement.dataset.dofTheme,',
 'footer:box(document.querySelector("body>.workspace-footer")),',
 'footerOpacity:getComputedStyle(document.querySelector("body>.workspace-footer")).opacity,',
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
  assert.deepEqual(g.nav,["Quick Downloads","Projects","FAQs","Settings"]);
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
  assert.equal(g.themeRemoved,true,"No public theme toggle");
  assert.equal(g.themeMode,"dark","Public shell is dark-only");
  near(g.footer.center,width/2,"Copyright horizontal center",width);
  assert.equal(g.footerOpacity,"0.07","Public copyright must be 7% opaque");
  assert.ok(g.footer.top+g.footer.height<=height-12 &&
    g.footer.top+g.footer.height>=height-42,
    "Copyright must stay near viewport bottom");
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
   ["BUTTON","About",null],["BUTTON","See Projects",null],["A","Sign in","/login"]]);
  for(let i=1;i<g.items.length;i++){
   near(g.items[i].rect.top,g.items[0].rect.top,"Button-row alignment",width);
   near(g.items[i].rect.height,g.items[0].rect.height,"Button-row height",width);
  }
  assert.ok(g.items.every(item=>item.glass),"All three CTAs share the WebGPU glass contract");
  assert.ok(g.items.every(item=>parseFloat(item.radius)>100),"All three CTAs are capsules");
  assert.ok(g.items.every(item=>item.background==="rgb(0, 0, 0)"&&item.tint===0),
    "Every button must be solid opaque black at rest, including with GPU ready");
  const [about,projects,signIn]=g.items.map(item=>item.rect);
  near(about.height,width<=760?48:58.5,"CTA 50%-increased capsule height",width);
  near(about.width,signIn.width,"About/Sign in matching widths",width);
  near(projects.width,about.width*1.5,"See Projects 50% wider",width);
  const left=g.items[0].rect.left;
  const right=g.items[2].rect.left+g.items[2].rect.width;
  near((left+right)/2,width/2,"Bottom action group center",width);
  assert.ok(left>=0&&right<=width,"All three buttons must fit the viewport at "+width);
  assert.ok(g.scrollWidth<=width+1,"No horizontal page scrolling at "+width);
  process.stdout.write("Public Home geometry passed at "+width+"x"+height+"\n");
 }
 // This browser script deliberately runs its baseline layout matrix with
 // reduced motion. Temporarily opt IN to motion before measuring a 180ms
 // transition, then restore the original emulation for other checks.
 await send("Emulation.setEmulatedMedia",{
   features:[{name:"prefers-reduced-motion",value:"no-preference"}]
 });
 // Verify the capsule's tint and scale interpolate through the SAME
 // 180ms CSS transition, with GPU geometry tracking transformed bounds.
 await send("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 const ctaCenter=selector=>evaluate("(()=>{const e=document.querySelector("+JSON.stringify(selector)+
   ");const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
 const projectsCta=await ctaCenter('.cta6-bottom-action [data-public-target="/projects"]');
 await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:projectsCta.x,y:projectsCta.y});
 await sleep(255);
 const hoveredCta=await evaluate("(()=>{const e=document.querySelector('.cta6-bottom-action [data-public-target=\"/projects\"]'),s=getComputedStyle(e);return {scale:e.getBoundingClientRect().width/e.offsetWidth,tint:Number(s.getPropertyValue('--home-cta-tint')),background:s.backgroundColor,transition:s.transitionProperty,ready:document.body.dataset.gpuScene==='ready',glass:window.__dashboardWebGPU?.homeCtaGlass||null};})()");
 assert.ok(Math.abs(hoveredCta.scale-1.039)<.004,
   "Hover growth must increase 30% from 3% to 3.9%");
 assert.ok(hoveredCta.tint>.98,"Green glass tint must finish with hover growth");
 if(hoveredCta.ready)
   assert.equal(hoveredCta.background,"rgba(0, 0, 0, 0)",
     "At full hover the black pigment must disappear, revealing the shared green glass");
 else assert.match(hoveredCta.background,/rgba?\(/,
   "Fallback hover must remain visible and dark green");
 assert.ok(hoveredCta.transition.includes("transform")&&hoveredCta.transition.includes("--home-cta-tint"),
   "Growth and tint must share the 180ms interpolator");
 if(hoveredCta.ready){
   assert.equal(hoveredCta.glass?.renderer,"shared-webgpu-glassPipeline");
   assert.equal(hoveredCta.glass.count,3);
   assert.equal(hoveredCta.glass.tintModel,"shared-square-film");
   assert.equal(hoveredCta.glass.tintFilmStrength,0.25,
     "Capsule tint film strength must be identical to the squares");
   assert.equal(hoveredCta.glass.pressLightGain,0.06,
     "Capsule press lighting must use the square's interaction strength");
   assert.equal(hoveredCta.glass.backdrop,"GPU-composited-moving-squares");
   assert.equal(hoveredCta.glass.geometry,"oracle-finite-per-surface-min-dimension");
   assert.deepEqual(hoveredCta.glass.layers.map(x=>x.layer),[0,1]);
   assert.ok(hoveredCta.glass.capsules.every(x=>x.renderMode===6),
     "Three capsules must use true CSS round-ended SDF geometry");
   assert.ok(hoveredCta.glass.capsules.every(x=>x.content==="text"),
     "Button text should remain live content over the glass");
   assert.ok(hoveredCta.glass.capsules.every(x=>
     x.nativeClear?.innerHeight===20&&
     x.nativeClear?.outerAmount===0&&
     x.nativeClear?.innerAmount<=-58.5),
     "Homepage capsules use per-surface native Clear scalar geometry");
   assert.ok(hoveredCta.glass.capsules.every(x=>
     x.nativeClear?.evidenceId==="E-P-SWIFTUI-SHAPE-GEOMETRY-FINITE"),
     "Optical inputs are explicitly bound to retained target-native evidence");
   assert.ok(hoveredCta.glass.compositeFrames>0,
     "The live GPU square animation must be composed before glass capsule sampling");
   near(hoveredCta.glass.capsules[1].width,150*1.039,
     "GPU rectangle follows the actually scaled capsule",1440);
   near(hoveredCta.glass.capsules[1].radius,58.5*1.039/2,
     "GPU SDF radius follows scaled capsule height",1440);
 }
 // About is intentionally inert, so hold its press without navigating.
 const aboutCta=await ctaCenter('.cta6-bottom-action [data-home-cta-glass]');
 await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:aboutCta.x,y:aboutCta.y});
 // A click MUST be tested from an established hover state. Headless
 // Chromium can delay style/transition advancement while WebGPU is busy:
 // a fixed sleep after mouseMoved did not guarantee the new capsule had
 // completed its own 180ms 0->1 green-tint transition.
 let aboutHovered=false;
 for(let i=0;i<35;i++){
   aboutHovered=await evaluate("(()=>{const e=document.querySelector('.cta6-bottom-action [data-home-cta-glass]');"+
     "return e.matches(':hover')&&Number(getComputedStyle(e).getPropertyValue('--home-cta-tint'))>.98;})()");
   if(aboutHovered)break;
   await sleep(35);
 }
 assert.ok(aboutHovered,"Click fixture must start from a fully green hovered capsule");
 await send("Input.dispatchMouseEvent",{type:"mousePressed",x:aboutCta.x,y:aboutCta.y,button:"left",clickCount:1});
 await sleep(135);
 const heldClick=await evaluate("(()=>{const e=document.querySelector('.cta6-bottom-action [data-home-cta-glass]'),c=getComputedStyle(e),a=window.__dashboardWebGPU?.homeCtaGlass;return {scale:e.getBoundingClientRect().width/e.offsetWidth,tint:Number(c.getPropertyValue('--home-cta-tint')),pane:a?.activePane,hover:a?.hover,press:a?.press,ready:document.body.dataset.gpuScene==='ready'};})()");
 assert.ok(Math.abs(heldClick.scale-1.00783)<.017,
   "Press contracts 3% relative to the already-enlarged hovered capsule");
 assert.ok(heldClick.tint>.98,
   "The green hover tint persists through the click: "+JSON.stringify(heldClick));
 if(heldClick.ready){
   assert.equal(heldClick.pane,0,"About alone owns its press spring");
   assert.ok(heldClick.hover>.85,"Click must not reset the hover glass");
   assert.ok(heldClick.press>.15,"Shared shader press light must rise during click");
 }
 await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:aboutCta.x,y:aboutCta.y,button:"left",clickCount:1});
 await sleep(345);
 const beforeTap=await evaluate("window.__dashboardWebGPU?.homeCtaGlass?.press||0");
 await send("Input.dispatchMouseEvent",{type:"mousePressed",x:aboutCta.x,y:aboutCta.y,button:"left",clickCount:1});
 await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:aboutCta.x,y:aboutCta.y,button:"left",clickCount:1});
 await sleep(65);
 if(await evaluate('document.body.dataset.gpuScene==="ready"')){
   const tap=await evaluate("(()=>{const a=window.__dashboardWebGPU.homeCtaGlass;return {hover:a?.hover,press:a?.press,pane:a?.activePane}})()");
   assert.equal(tap.pane,0);
   assert.ok(tap.hover>.85,"A quick click cannot interrupt persistent hover");
   assert.ok(tap.press>Math.max(.08,beforeTap+.06),
     "Even down/up between GPU frames must leave a visible press pulse");
 }
 await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:500,y:160});
 await sleep(255);
 const restedCta=await evaluate("(()=>{const e=document.querySelector('.cta6-bottom-action [data-public-target=\"/projects\"]'),s=getComputedStyle(e);return {scale:e.getBoundingClientRect().width/e.offsetWidth,tint:Number(s.getPropertyValue('--home-cta-tint')),background:s.backgroundColor};})()");
 assert.ok(Math.abs(restedCta.scale-1)<.004&&restedCta.tint<.02,
   "Green tint and scale return together after hover leave");
 assert.equal(restedCta.background,"rgb(0, 0, 0)",
   "Hover exit must restore a fully opaque BLACK capsule, not translucent glass");
 await send("Emulation.setEmulatedMedia",{
   features:[{name:"prefers-reduced-motion",value:"reduce"}]
 });
 // Compare the actual desktop text-button hover/press rendering to the
 // authenticated /app bar: only glyph color changes, never a button box.
 await send("Emulation.setDeviceMetricsOverride",{
   width:1440,height:900,deviceScaleFactor:1,mobile:false
 });
 const topText=await evaluate("(()=>{const r=document.querySelector('#global-menu-links>button').getBoundingClientRect();"+
   "return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
 await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:topText.x,y:topText.y});
 await sleep(165);
 const hoverText=await evaluate("(()=>{const s=getComputedStyle(document.querySelector('#global-menu-links>button'));"+
   "return {color:s.color,bg:s.backgroundColor,border:s.borderTopWidth,transform:s.transform};})()");
 assert.equal(hoverText.bg,"rgba(0, 0, 0, 0)",
   "Hovering public top-bar text must not draw a rounded button backing");
 assert.equal(hoverText.border,"0px");
 assert.equal(hoverText.color,"rgb(255, 255, 255)");
 assert.equal(hoverText.transform,"none");
 await send("Input.dispatchMouseEvent",{type:"mousePressed",x:topText.x,y:topText.y,button:"left",clickCount:1});
 const pressedText=await evaluate("(()=>{const s=getComputedStyle(document.querySelector('#global-menu-links>button'));"+
   "return {bg:s.backgroundColor,transform:s.transform};})()");
 assert.equal(pressedText.bg,"rgba(0, 0, 0, 0)",
   "Pressing public top-bar text must not create a button outline or fill");
 assert.equal(pressedText.transform,"none");
 await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:topText.x,y:topText.y,button:"left",clickCount:1});
 // A legacy local preference must not switch the site to light mode.
 await evaluate('localStorage.setItem("dofinances-theme","light")');
 assert.equal(await evaluate('document.documentElement.dataset.dofTheme'),"dark");
 assert.equal(await evaluate('document.getElementById("public-theme-toggle")'),null);
 // Verify disclosure open/close, inert entries, Escape and breakpoint reset.
 await send("Emulation.setDeviceMetricsOverride",{
  width:500,height:670,deviceScaleFactor:1,mobile:false
 });
 // CDP viewport changes and matchMedia change-events can be processed
 // in different compositor frames. The menu intentionally refuses to open
 // until compact.matches is true, so wait for the real mobile breakpoint.
 let compactReady=false;
 for(let i=0;i<40;i++){
  compactReady=await evaluate("matchMedia('(max-width:748px)').matches && "+
    "getComputedStyle(document.getElementById('public-menu-toggle')).display!=='none'");
  if(compactReady)break;
  await sleep(25);
 }
 assert.equal(compactReady,true,"Mobile navigation breakpoint must settle before menu interaction");
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
 assert.deepEqual(openPanel.labels,["Quick Downloads","Projects","FAQs","Settings"]);
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
  '...document.querySelectorAll(".cta6-bottom-action button")]){',
  'if(!b.matches("[data-public-target]"))b.click();}',
  'return {before,after:location.href};})()'
 ].join(""));
 assert.equal(inert.before,inert.after,"Non-Projects placeholders remain inert");
 assert.equal(await evaluate('document.querySelectorAll("[data-public-target]").length'),3,"Three public Projects triggers available");
 // The EXACT same h1 must stay viewport-pinned throughout horizontal and
 // vertical resizing. The route owns its opacity on native scroll only.
 await evaluate('document.querySelector("#global-menu-links [data-public-target=\\\"/projects\\\"]").click()');
 let projectsReady=false;
 for(let i=0;i<90;i++){
  if(await evaluate('location.pathname==="/projects" && !!document.querySelector(".public-projects-root") && document.getElementById("dashboard-title").parentElement===document.body')){
   projectsReady=true;break;
  }
  await sleep(50);
 }
 assert.ok(projectsReady,"Public Projects must mount the original doof in the viewport layer");
 const projectLogo=()=>evaluate('(()=>{const e=document.getElementById("dashboard-title");const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,position:getComputedStyle(e).position,pinned:document.body.dataset.projectsLogoPinned,hidden:document.body.hasAttribute("data-projects-logo-hidden")};})()');
 for(const [width,height] of [[1440,900],[1440,480],[1440,1120],[900,1120],[1600,580],[640,760]]){
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
  await evaluate("new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))");
  const rect=await projectLogo();
  assert.equal(rect.position,"fixed","Projects wordmark must be viewport-fixed");
  assert.equal(rect.pinned,"true");
  near(rect.y,90,"Projects doof fixed 90px from viewport top",width);
  near(rect.x,width/2,"Projects doof centered across viewport widths",width);
  assert.equal(rect.hidden,false,"Resizing without scrolling must not hide doof");
 }
 const projectsScroll=await evaluate('(()=>{const s=document.getElementById("public-route-content");s.scrollTop=300;return s.scrollTop;})()');
 assert.ok(projectsScroll>0,"Projects grid must scroll when viewport is short");
 let logoFaded=false;
 for(let i=0;i<40;i++){
  if(await evaluate('document.body.hasAttribute("data-projects-logo-hidden")')){logoFaded=true;break;}
  await sleep(25);
 }
 assert.ok(logoFaded,"Native Projects scroll must still fade doof near search");
 await evaluate('document.querySelector(".public-projects-back").click()');
 let returnedHome=false;
 for(let i=0;i<90;i++){
  if(await evaluate('location.pathname==="/" && !document.body.hasAttribute("data-projects-logo-pinned") && document.querySelector(".cta6-center > #dashboard-title")')){
   returnedHome=true;break;
  }
  await sleep(50);
 }
 assert.ok(returnedHome,"Back must restore original h1 to the homepage mosaic");
 await send("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate("new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))");
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
     themeRemoved:!document.getElementById("public-theme-toggle")};
 })()`);
 assert.equal(duringDismiss.route,"leaving","Sign in starts the X-close poof");
 assert.equal(duringDismiss.path,"/","Route changes only after the poof");
 assert.equal(duringDismiss.themeRemoved,true,"No theme switch during transition");
 assert.ok(!duringDismiss.style.includes("600px"),
   "Tiles must not use the old right-swipe transform");
 let loginReached=false;
 for(let i=0;i<50;i++){
  if(await evaluate('location.pathname==="/login" && window.__dofPublicRouter?.state==="login" && !!document.querySelector("#public-route-content h2")')){loginReached=true;break;}
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
