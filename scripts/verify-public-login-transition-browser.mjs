/* DOM-only headless Chromium test of one persistent document and a
 * reversible lazy-loaded /login card. No screenshots or screen recording.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";

const repo=resolve(fileURLToPath(new URL("../",import.meta.url)));
const apex=join(repo,"sites/_apex");
const dist=join(repo,"dist");
assert.ok(existsSync(join(dist,"assets","public-login-manifest.json")),"Build and package the login route first");
const mime={".html":"text/html; charset=utf-8",".json":"application/json",".css":"text/css",
  ".js":"text/javascript",".avif":"image/avif",".svg":"image/svg+xml",
  ".wgsl":"text/plain"};
const misses=[];
const server=createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  let target;
  if(pathname==="/login"||pathname==="/login/"||pathname==="/"){
    target=join(apex,"index.html");
  }else{
    const apexCandidate=resolve(apex,"."+pathname);
    const builtCandidate=resolve(dist,"."+pathname);
    target=existsSync(apexCandidate)?apexCandidate:builtCandidate;
  }
  if(!target.startsWith(apex+"/")&&!target.startsWith(dist+"/")){
    res.writeHead(403);res.end();return;
  }
  try{
    let body=readFileSync(target);
    if(pathname==="/login"||pathname==="/login/")body=Buffer.from(body.toString("utf8").replace('<body class="public-home">','<body class="public-home" data-public-route="leaving" data-direct-login="true">'));
    res.writeHead(200,{"Content-Type":mime[extname(target)]||"application/octet-stream",
      "Cache-Control":"no-store"});
    res.end(body);
  }catch{
    if(pathname!=="/favicon.ico")misses.push(pathname);
    res.writeHead(pathname==="/favicon.ico"?204:404);res.end();
  }
});
await new Promise((ok,fail)=>{
  server.once("error",fail);server.listen(0,"127.0.0.1",ok);
});
let binary;
for(const name of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
  try{binary=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(binary,"Chromium required");
const profile=mkdtempSync(join(tmpdir(),"dof-login-handoff-"));
let chrome,socket;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  chrome=spawn(binary,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--disable-gpu","--no-first-run","--remote-debugging-port=0",
    "--window-size=1400,880","--user-data-dir="+profile,"about:blank"],{stdio:"ignore"});
  let port;
  for(let i=0;i<120;i++){
    const path=join(profile,"DevToolsActivePort");
    if(existsSync(path)){port=+readFileSync(path,"utf8").split("\n")[0];break;}
    if(chrome.exitCode!==null)throw Error("Chrome exited early");
    await sleep(100);
  }
  assert.ok(port,"No Chrome DevTools port");
  const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",
    {method:"PUT"}).then(r=>r.json());
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.onopen=ok;socket.onerror=fail;});
  let seq=0;const pending=new Map();
  socket.onmessage=event=>{
    const response=JSON.parse(event.data),entry=pending.get(response.id);
    if(!entry)return;
    pending.delete(response.id);
    response.error?entry.fail(Error(JSON.stringify(response.error))):entry.ok(response.result);
  };
  const send=(method,params={})=>new Promise((ok,fail)=>{
    const id=++seq;pending.set(id,{ok,fail});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send("Runtime.evaluate",
      {expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument",{source:
    "window.__routeErrors=[];"+
    "const oldError=console.error.bind(console);"+
    "console.error=(...args)=>{window.__routeErrors.push(args.map(String).join(' '));oldError(...args);};"+
    "addEventListener('error',e=>window.__routeErrors.push('error: '+e.message));"+
    "addEventListener('unhandledrejection',e=>window.__routeErrors.push('rejection: '+String(e.reason)));"
  });
  await send("Emulation.setEmulatedMedia",
    {features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
  const origin="http://127.0.0.1:"+server.address().port;
  await send("Page.navigate",{url:origin+"/"});
  const until=async(expression,limit=120,interval=70)=>{
    let value;
    for(let i=0;i<limit;i++){
      value=await evaluate(expression);
      if(value)return value;
      await sleep(interval);
    }
    throw Error("Timed out: "+expression);
  };
  await until("document.querySelectorAll('#cta6-mosaic>.cta6-tile').length===66");
  // Measure the normal settled homepage, not the logo's 16px introduction.
  await sleep(1050);
  const home=await evaluate("(()=>{window.__persistedShell={"+
    "mosaic:document.querySelector('#cta6-mosaic'),"+
    "logo:document.querySelector('#dashboard-title'),"+
    "bar:document.querySelector('#global-menu'),"+
    "theme:document.querySelector('#public-theme-toggle')};"+
    "const r=window.__persistedShell.logo.getBoundingClientRect();"+
    "const buttons=document.querySelector('.cta6-bottom-action');"+
    "const b=buttons.getBoundingClientRect();"+
    "window.__persistedShell.bottomTop=b.top;"+
    "return {homeY:(r.top+r.bottom)/2,bottomTop:b.top,"+
    "barBottom:window.__persistedShell.bar.getBoundingClientRect().bottom};})()");
  assert.equal(home.barBottom,44);
  await evaluate("document.querySelector('.cta6-bottom-action a[href=\"/login\"]').click()");
  // Browser compositor may defer the first painted transition frames
  // while WebGPU initializes. Assert the shell's transition is armed here,
  // then verify the buttons actually finish offscreen once /login mounts.
  const falling=await evaluate("(()=>{const b=document.querySelector('.cta6-bottom-action');"+
    "const st=getComputedStyle(b);return {route:document.body.dataset.publicRoute,"+
    "transition:st.transitionProperty};})()");
  assert.equal(falling.route,"leaving",
    "Main page must own the buttons' exit transition");
  assert.match(falling.transition,/transform/);
  assert.match(falling.transition,/opacity/);
  assert.equal(await evaluate("location.pathname"),"/",
    "The shell dismisses its squares before changing history");
  try{
    await until("location.pathname==='/login'&&!!document.querySelector('.auth3-root form')",170);
  }catch(error){
    const context=await evaluate("(()=>({"+
      "pathname:location.pathname,route:window.__dofPublicRouter,"+
      "outlet:document.querySelector('#public-route-content')?.innerText,"+
      "errors:window.__routeErrors,"+
      "links:[...document.querySelectorAll('link[data-public-route-css]')].map(e=>e.href),"+
      "scripts:performance.getEntriesByType('resource').filter(e=>e.name.includes('login')||e.name.includes('styles-')).map(e=>({name:e.name,status:e.responseStatus}))"+
      "}))()");
    throw Error(error.message+"; diagnostics="+JSON.stringify(context)+"; missing="+JSON.stringify(misses));
  }
  await sleep(800);
  const active=await evaluate("(()=>{"+
    "const r=window.__persistedShell,l=document.querySelector('.auth3-root .max-w-md');"+
    "const c=l.getBoundingClientRect(),brand=r.logo.getBoundingClientRect();"+
    "return {sameMosaic:document.querySelector('#cta6-mosaic')===r.mosaic,"+
    "sameBrand:document.querySelector('#dashboard-title')===r.logo,"+
    "sameBar:document.querySelector('#global-menu')===r.bar,"+
    "sameTheme:document.querySelector('#public-theme-toggle')===r.theme,"+
    "center:(c.left+c.right)/2,viewport:innerWidth/2,"+
    "logoY:(brand.top+brand.bottom)/2,scale:getComputedStyle(r.logo).transform,"+
    "caption:document.body.textContent.includes('A clearer view of what comes next.'),"+
    "back:document.querySelector('.auth3-back-link')?.getAttribute('href'),"+
    "buttonsTop:document.querySelector('.cta6-bottom-action').getBoundingClientRect().top,"+
    "buttonsOpacity:getComputedStyle(document.querySelector('.cta6-bottom-action')).opacity,"+
    "state:window.__dofPublicRouter.state,route:location.pathname};})()");
  for(const field of ["sameMosaic","sameBrand","sameBar","sameTheme"])
    assert.equal(active[field],true,"Persistent shell lost: "+field);
  assert.equal(active.state,"login");
  assert.equal(active.route,"/login");
  assert.equal(active.back,"/");
  assert.equal(active.caption,false);
  assert.ok(active.buttonsTop>=await evaluate("innerHeight"),
    "Bottom buttons must move completely below the viewport on /login");
  assert.equal(active.buttonsOpacity,"0");
  assert.ok(Math.abs(active.center-active.viewport)<1,
    "Sign-in card must be horizontally centered; actual "+active.center+" versus "+active.viewport);
  assert.ok(Math.abs(active.logoY-(home.barBottom+46))<1,
    "Same doof logo compact Y: "+active.logoY+" expected "+(home.barBottom+46)+
    "; home Y "+home.homeY+"; computed transform "+active.scale);
  assert.match(active.scale,/matrix\(0\.6, 0, 0, 0\.6,/);
  const material=()=> "(()=>{"+
    "const card=document.querySelector('[data-auth-glass-card]');"+
    "const input=card.querySelector('[data-auth-glass-input]');"+
    "const primary=card.querySelector('[data-auth-glass-submit]');"+
    "const face=getComputedStyle(card);"+
    "return {mode:card.closest('.auth3-root').classList.contains('dark')?'dark':'light',"+
    "background:face.backgroundColor,blur:face.backdropFilter,"+
    "transform:face.transform,ink:getComputedStyle(input).color,"+
    "actionInk:getComputedStyle(primary).color,"+
    "cardHover:getComputedStyle(card,'::after').content,"+
    "gpu:document.body.dataset.gpuScene,"+
    "authGpu:document.body.dataset.authGpuScene,"+
    "audit:window.__dashboardWebGPU?.authGlass??null};})()";
  // Provider icons and divider are real route-owned DOM presentation, not
  // replacements for glass GPU pixels or the original dark/light palettes.
  const accents=()=> "(()=>{"+
    "const rules=[...document.querySelectorAll('.auth3-or-rule')];"+
    "const logos=[...document.querySelectorAll('.auth3-provider-icon')];"+
    "return {ruleCount:rules.length,rule:rules[0]?getComputedStyle(rules[0]).backgroundColor:null,"+
    "iconCount:logos.length,logoOpacity:logos.map(e=>getComputedStyle(e).opacity),"+
    "googleColors:[...document.querySelectorAll('svg.auth3-provider-icon[viewBox=\\\"0 0 48 48\\\"] path')].map(p=>p.getAttribute('fill')),"+
    "googleAlpha:[...document.querySelectorAll('svg.auth3-provider-icon[viewBox=\\\"0 0 48 48\\\"] path')].map(p=>p.getAttribute('opacity')),"+
    "githubColor:document.querySelector('svg.auth3-provider-icon[viewBox=\\\"0 0 24 24\\\"] path')?.getAttribute('fill'),"+
    "githubStops:[...document.querySelectorAll('#auth3-github-mono-gradient stop')].map(s=>({color:s.getAttribute('stop-color')||s.getAttribute('stopColor'),opacity:s.getAttribute('stop-opacity')||s.getAttribute('stopOpacity')})),"+
    "githubGradient:!!document.querySelector('#auth3-github-mono-gradient')};})()";
  const darkAccent=await evaluate(accents());
  assert.equal(darkAccent.ruleCount,2);
  assert.ok(darkAccent.rule,"Divider line must have a computed color");
  assert.equal(darkAccent.iconCount,2);
  assert.deepEqual(darkAccent.logoOpacity,["0.82","0.82"]);
  assert.deepEqual(darkAccent.googleColors,Array(4).fill("#FFFFFF"));
  assert.deepEqual(darkAccent.googleAlpha,[".49952",".55426",".87488",".6481"]);
  assert.equal(darkAccent.githubColor,"url(#auth3-github-mono-gradient)");
  assert.equal(darkAccent.githubGradient,true);
  assert.deepEqual(darkAccent.githubStops,[
    {color:"#FFFFFF",opacity:".73412"},
    {color:"#FFFFFF",opacity:".52298"}
  ]);
  assert.ok([...darkAccent.googleAlpha,...darkAccent.githubStops.map(s=>s.opacity)]
    .every(v=>Number(v)>.3&&Number(v)<.9),
    "Monochrome logo alphas remain strictly intermediate");
  assert.ok(Number(darkAccent.googleAlpha[2])-Number(darkAccent.googleAlpha[0])>.37,
    "Google yellow and red segments retain luminance contrast");
  assert.ok(Number(darkAccent.githubStops[0].opacity)-Number(darkAccent.githubStops[1].opacity)>.20,
    "GitHub keeps an expanded white-only luminance gradient");
  const ornaments=()=> "(()=>{"+
    "const group=document.querySelector('[data-auth-or-separator]');"+
    "const back=document.querySelector('.auth3-back-link');"+
    "const footer=document.querySelector('.auth3-root p.text-sm.text-center');"+
    "const note=document.querySelector('.auth3-root p.text-xs.text-neutral-500');"+
    "const css=getComputedStyle(back);"+
    "const rgbRed=c=>{const canvas=document.createElement('canvas');"+
    "canvas.width=1;canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});"+
    "ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[0];};"+
    "const route=document.querySelector('#public-route-content');"+
    "return {opacity:getComputedStyle(group).opacity,"+
    "noteColor:getComputedStyle(note).color,"+
    "routeOverscroll:getComputedStyle(route).overscrollBehaviorY,"+
    "routeOverflow:getComputedStyle(route).overflowY,"+
    "rootOverscroll:getComputedStyle(document.documentElement).overscrollBehaviorY,"+
    "footerRed:rgbRed(getComputedStyle(footer).color),"+
    "labelRed:rgbRed(getComputedStyle(group.querySelector('span')).color),"+
    "label:getComputedStyle(group.querySelector('span')).color,"+
    "line:getComputedStyle(group.querySelector('.auth3-or-rule')).backgroundColor,"+
    "footer:getComputedStyle(footer).color,"+
    "backTint:css.getPropertyValue('--auth-control-tint').trim(),"+
    "backInk:css.color,backBackground:css.backgroundColor,backTransform:css.transform,"+
    "backStroke:[...back.querySelectorAll('svg path')].map(p=>getComputedStyle(p).stroke),"+
    "backSize:[back.getBoundingClientRect().width,back.getBoundingClientRect().height]};})()";
  const darkOrnaments=await evaluate(ornaments());
  assert.equal(darkOrnaments.opacity,"1");
  assert.equal(darkOrnaments.label,darkOrnaments.noteColor,
    "Or text exactly matches account-linking note in dark mode");
  assert.equal(darkOrnaments.line,darkOrnaments.noteColor,
    "Both Or lines share the note's exact theme color");
  assert.equal(darkOrnaments.routeOverscroll,"auto",
    "Native vertical rubberbanding restored on the real login scroll container");
  assert.equal(darkOrnaments.rootOverscroll,"auto",
    "Viewport overscroll must not be suppressed on the login route");
  assert.equal(darkOrnaments.routeOverflow,"auto",
    "Legitimate short-viewport form scrolling remains enabled");
  assert.ok(darkOrnaments.noteColor,"Account-linking note has a computed color");
  assert.equal(darkOrnaments.backTint,"transparent");
  assert.equal(darkOrnaments.backInk,"rgb(255, 255, 255)");
  assert.equal(darkOrnaments.backTransform,"none");
  assert.deepEqual(darkOrnaments.backStroke,["rgb(255, 255, 255)"],
    "The back arrow has one neutral stroke, not a lighter outline");
  assert.deepEqual(darkOrnaments.backSize,[34,34]);

  // The scrolling form and its WebGPU face must occupy the SAME scroll tree.
  // Test a genuinely short viewport without screenshots or native recordings.
  const normalMetrics=await evaluate("({width:innerWidth,height:innerHeight})");
  await send("Emulation.setDeviceMetricsOverride",
    {width:900,height:315,deviceScaleFactor:1,mobile:false});
  await until("document.querySelector('#public-route-content').scrollHeight > "+
    "document.querySelector('#public-route-content').clientHeight + 150",70);
  await sleep(140);
  const shortStart=await evaluate("(()=>{const route=document.querySelector('#public-route-content');"+
    "const stage=document.querySelector('#public-route-stage');"+
    "const card=document.querySelector('[data-auth-glass-card]');"+
    "const input=card.querySelector('input');"+
    "const glass=document.querySelector('#dashboard-auth-glass-scene');"+
    "const bounds=n=>n?.getBoundingClientRect().top;"+
    "return {overflow:getComputedStyle(route).overflowY,scrollTop:route.scrollTop,"+
    "cardTop:bounds(card),inputTop:bounds(input),stageTop:bounds(stage),"+
    "glassTop:bounds(glass),glassParent:glass?.parentElement?.id,"+
    "glassHeight:glass?.getBoundingClientRect().height,"+
    "stageHeight:stage.scrollHeight,available:route.clientHeight};})()");
  assert.equal(shortStart.overflow,"auto");
  if(shortStart.glassParent){
    assert.equal(shortStart.glassParent,"public-route-content",
      "Glass surface belongs to the very same native scrollport as the card");
    assert.ok(shortStart.glassHeight>=shortStart.stageHeight-2,
      "Glass covers the entire form, not just the short viewport");
  }
  const gpuScrolling=await evaluate("document.body.dataset.authGpuScene==='ready'");
  const authFramesBefore=await evaluate("window.__dashboardWebGPU?.authOnlyFrames||0");
  await evaluate("document.querySelector('#public-route-content').scrollTop=190");
  await until("document.querySelector('#public-route-content').scrollTop >= 100",50);
  if(gpuScrolling){
    await until("window.__dashboardWebGPU?.authOnlyFrames>"+authFramesBefore,60,35);
    const scrollAudit=await evaluate("({top:window.__dashboardWebGPU?.lastAuthScrollTop,"+
      "frameAt:window.__dashboardWebGPU?.lastAuthFrameAt,now:performance.now()})");
    assert.ok(Math.abs(scrollAudit.top-190)<2,
      "GPU refraction must sample the current native scroll offset");
    assert.ok(scrollAudit.now-scrollAudit.frameAt<500,
      "Glass-only GPU presentation must update promptly during scroll");
  }
  await sleep(100);
  const shortEnd=await evaluate("(()=>{const route=document.querySelector('#public-route-content');"+
    "const card=document.querySelector('[data-auth-glass-card]');"+
    "const stage=document.querySelector('#public-route-stage');"+
    "const glass=document.querySelector('#dashboard-auth-glass-scene');"+
    "return {scrollTop:route.scrollTop,cardTop:card.getBoundingClientRect().top,"+
    "inputTop:card.querySelector('input').getBoundingClientRect().top,"+
    "stageTop:stage.getBoundingClientRect().top,"+
    "glassTop:glass?.getBoundingClientRect().top};})()");
  const scrolled=shortEnd.scrollTop-shortStart.scrollTop;
  assert.ok(scrolled>90,"Short viewport must actually scroll");
  assert.ok(Math.abs((shortEnd.cardTop-shortStart.cardTop)+scrolled)<2,
    "Card travels with the scroll rather than getting pinned to viewport");
  assert.ok(Math.abs((shortEnd.inputTop-shortStart.inputTop)+scrolled)<2,
    "Form contents travel by precisely the same scroll delta as the card");
  if(shortStart.glassParent){
    assert.ok(Math.abs((shortEnd.glassTop-shortStart.glassTop)+scrolled)<2,
      "GPU glass travels by precisely the same scroll delta as the form");
  }
  await evaluate("document.querySelector('#public-route-content').scrollTop=0");
  // A headless Chrome --window-size includes browser chrome: innerHeight is
  // not necessarily 880. Clear emulation rather than assuming the restored
  // viewport matches the CLI outer-window dimensions.
  await send("Emulation.clearDeviceMetricsOverride");
  await until("innerHeight==="+normalMetrics.height+" && innerWidth==="+normalMetrics.width+
    " && document.querySelector('#public-route-content').scrollTop===0",60);

  const neutralTints=()=> "(()=>{const card=document.querySelector('[data-auth-glass-card]');"+
    "const value=el=>getComputedStyle(el).getPropertyValue('--auth-control-tint').trim();"+
    "const input=card.querySelector('[data-auth-glass-input]');"+
    "const providers=[...card.querySelectorAll('[data-auth-glass-provider]:not(.auth3-back-link)')];"+
    "return {input:value(input),providers:providers.map(value),"+
    "primary:value(card.querySelector('[data-auth-glass-submit]'))};})()";
  const darkNeutral=await evaluate(neutralTints());
  const tintAlpha=value=>value.length===5?parseInt(value.slice(-1),16)/15:
    value.length===9?parseInt(value.slice(-2),16)/255:
    Number(value.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/)?.[1]??NaN);
  assert.ok(darkNeutral.providers.length===2&&darkNeutral.providers.every(v=>Math.abs(tintAlpha(v)-.62)<.01),
    "Google and GitHub use 0.62 dark neutral tint");
  assert.equal(darkNeutral.input,"#0006",
    "Email and password share the 0.40 dark tint");
  assert.equal(darkNeutral.primary,"#ffffffd1",
    "Primary sign-in brightness stays unchanged");
  const darkGlass=await evaluate(material());
  assert.equal(darkGlass.mode,"dark");
  assert.equal(darkGlass.ink,"rgb(255, 255, 255)",
    "Original dark mode: neutral dark inputs and white text");
  assert.notEqual(darkGlass.actionInk,darkGlass.ink,
    "Original dark mode: neutral white primary action with dark text");
  assert.equal(darkGlass.cardHover,"none",
    "No extra CSS hover spotlight; use the squares' shared GPU hover");
  if(darkGlass.gpu==="ready"){
    assert.equal(darkGlass.background,"rgba(0, 0, 0, 0)",
      "WebGPU glass must be visible through a transparent DOM card");
    assert.equal(darkGlass.blur,"none",
      "No second CSS backdrop filter over the exact square shader");
    assert.equal(darkGlass.audit?.renderer,"shared-webgpu-glassPipeline");
    assert.ok(darkGlass.audit?.count>=6,
      "The same WebGPU material renders the card, inputs and buttons");
    assert.equal(darkGlass.authGpu,"ready");
    // A renderer-ready flag alone was not sufficient: interaction.writeTo()
    // previously reset each route pane's motion.z after paintAuthPanes(),
    // leaving the composited auth canvas ENTIRELY transparent. Prove actual
    // pixel alpha from the canvas without taking a DOM screenshot.
    await until("window.__dashboardWebGPU?.authGlass?.opacity>=0.99",70);
    const authPixels=await evaluate("(async()=>{"+
      "const canvas=document.querySelector('#dashboard-auth-glass-scene');"+
      "const img=new Image();img.src=canvas.toDataURL('image/png');await img.decode();"+
      "const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;"+
      "const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);"+
      "const origin=canvas.getBoundingClientRect();"+
      "const sample=sel=>{const r=document.querySelector(sel).getBoundingClientRect();"+
      "const x=Math.floor((r.left+r.width*.5-origin.left)*canvas.width/origin.width);"+
      "const y=Math.floor((r.top+Math.min(35,r.height*.5)-origin.top)*canvas.height/origin.height);"+
      "return Array.from(cx.getImageData(x,y,1,1).data);};"+
      "return {card:sample('[data-auth-glass-card]'),"+
      "back:sample('.auth3-back-link'),"+
      "input:sample('[data-auth-glass-input]'),"+
      "submit:sample('[data-auth-glass-submit]')};})()");
    for(const [role,pixel] of Object.entries(authPixels))
      assert.ok(pixel[3]>=200,
        "The "+role+" glass MUST have real nontransparent WebGPU fill, got "+pixel);
    assert.equal(darkGlass.audit?.cardTint,"none");
    assert.equal(darkGlass.audit?.backTint,"none",
      "The separate back glass chip has zero tint");
    assert.equal(darkOrnaments.backBackground,"rgba(0, 0, 0, 0)",
      "GPU-ready back glass has no CSS paint hiding its untinted glass");
    assert.equal(darkGlass.audit?.faceScheme,"dark",
      "The untinted card uses the same dark glass face as the squares");
    assert.equal(darkGlass.audit?.materialReference,"first-home-square",
      "The larger card and buttons retain the same optical material as the squares");
    assert.equal(darkGlass.audit?.scheme,"dark");
    assert.equal(darkGlass.audit?.neutralControlTints,"black / white primary");
  }
  const bounds=await evaluate("(()=>{const r=document.querySelector('[data-auth-glass-card]').getBoundingClientRect();"+
    "return {left:r.left,top:r.top,width:r.width,height:r.height};})()");
  await send("Input.dispatchMouseEvent",{
    type:"mouseMoved",x:bounds.left+bounds.width*.50,y:bounds.top+20
  });
  await sleep(210);
  const hoverGlass=await evaluate(material());
  assert.equal(hoverGlass.transform,darkGlass.transform,
    "Card hover must not cause a scaled transform");
  assert.equal(hoverGlass.cardHover,"none",
    "Card hover must use the SAME GPU spring, not a CSS glow");
  if(darkGlass.gpu==="ready"){
    await until("window.__dashboardWebGPU?.authGlass?.hovered===true",30,40);
    const state=await evaluate("({focus:window.__dashboardWebGPU.focusedTile,"+
      "squareCount:window.__dashboardWebGPU.tiles})");
    assert.ok(state.focus>=state.squareCount,
      "Hover targets route glass panes within the shared tile interaction controller");
  }
  // The card has independent hover ownership from its nested glass buttons.
  // The squares continue using the original shared interaction controller.
  if(darkGlass.gpu==="ready"){
    const buttonBounds=await evaluate("(()=>{const r=document.querySelector('[data-auth-glass-submit]').getBoundingClientRect();"+
      "return {x:r.left+r.width*.5,y:r.top+r.height*.5};})()");
    await send("Input.dispatchMouseEvent",{
      type:"mouseMoved",x:buttonBounds.x,y:buttonBounds.y
    });
    await until("window.__dashboardWebGPU?.authGlass?.cardHovered===true&&"+
      "window.__dashboardWebGPU?.authGlass?.controlHovered===true",70,40);
    await until("window.__dashboardWebGPU?.authGlass?.cardHover?.hover>.5&&"+
      "window.__dashboardWebGPU?.authGlass?.controlHover?.hover>.5",70,40);
    const onControl=await evaluate("window.__dashboardWebGPU.authGlass");
    assert.equal(onControl.cardHover.active,true,
      "Entering a nested button must keep the parent card hovered");
    assert.equal(onControl.controlHover.active,true,
      "Nested button must also have its own independent glass hover");

    // Exit the entire card. Its glow fades at the last position, without
    // racing backward to center (or pulling across the background).
    await send("Input.dispatchMouseEvent",{
      type:"mouseMoved",x:bounds.left+bounds.width+42,y:bounds.top+40
    });
    await until("window.__dashboardWebGPU?.authGlass?.cardHovered===false",70,40);
    await sleep(115);
    const onExit=await evaluate("window.__dashboardWebGPU.authGlass");
    assert.equal(onExit.cardHover.active,false);
    assert.equal(onExit.controlHovered,false);
    assert.ok(onExit.cardHover.hover<onControl.cardHover.hover,
      "Card hover intensity should fade after the cursor leaves");
    // Compare TWO frames after exit. The last on-card frame may still be
    // following a fast cursor; it must stop moving once outside the card.
    await sleep(130);
    const laterExit=await evaluate("window.__dashboardWebGPU.authGlass");
    assert.ok(Math.abs(laterExit.cardHover.x-onExit.cardHover.x)<.01&&
      Math.abs(laterExit.cardHover.y-onExit.cardHover.y)<.01,
      "Card hotspot must remain motionless while it fades outside the card");
    assert.ok(laterExit.cardHover.hover<onExit.cardHover.hover,
      "Frozen hotspot must continue fading, not linger indefinitely");
    assert.ok(Math.abs(onExit.cardHover.vx)<.001&&
      Math.abs(onExit.cardHover.vy)<.001,
      "Leaving the card must stop velocity-driven opposite-direction travel");
  }
  // Toggling the site mode only changes the existing neutral tint presets
  // and the original form text palette, never the untinted card tint name.
  await evaluate("document.getElementById('public-theme-toggle').click()");
  await until("document.documentElement.dataset.dofTheme==='light'&&"+
    "!!document.querySelector('.auth3-root:not(.dark)')",50);
  // Tailwind preserves 200ms color transitions. A headless browser under
  // software rendering can defer animation frames despite elapsed wall time;
  // wait for the ACTUAL computed neutral palette instead of assuming that
  // sleeping 290ms guarantees visual style settlement.
  await until("getComputedStyle(document.querySelector('[data-auth-glass-input]')).color==='rgb(23, 23, 23)'",100,60);
  await until("getComputedStyle(document.querySelector('[data-auth-glass-submit]')).color==='rgb(255, 255, 255)'",100,60);
  const lightAccent=await evaluate(accents());
  assert.ok(lightAccent.rule,"Divider line must remain visible");
  assert.deepEqual(lightAccent.logoOpacity,["0.86","0.86"]);
  const lightOrnaments=await evaluate(ornaments());
  assert.equal(lightOrnaments.opacity,"1");
  assert.equal(lightOrnaments.label,lightOrnaments.noteColor,
    "Or label matches the account-linking note in light mode");
  assert.equal(lightOrnaments.line,lightOrnaments.noteColor,
    "Both Or lines use the note's light theme color");
  assert.equal(lightOrnaments.routeOverscroll,"auto");
  assert.equal(lightOrnaments.routeOverflow,"auto");
  assert.ok(lightOrnaments.noteColor,"Light-mode account-linking color must exist");
  assert.equal(lightOrnaments.backTint,"transparent");
  assert.equal(lightOrnaments.backInk,"rgb(23, 23, 23)");
  assert.deepEqual(lightOrnaments.backStroke,["rgb(23, 23, 23)"]);
  assert.equal(lightOrnaments.backTransform,"none");
  const lightNeutral=await evaluate(neutralTints());
  assert.ok(lightNeutral.providers.length===2&&lightNeutral.providers.every(v=>Math.abs(tintAlpha(v)-.62)<.01),
    "Google and GitHub use 0.62 in light UI mode");
  assert.equal(lightNeutral.input,"#fff6",
    "Email and password use 0.40 in light UI mode");
  assert.equal(lightNeutral.primary,"#000000d1",
    "Primary sign-in tint is unaffected in light mode");
  const lightGlass=await evaluate(material());
  assert.equal(lightGlass.mode,"light");
  assert.notEqual(lightGlass.ink,darkGlass.ink,
    "Original light mode must restore dark field text");
  assert.ok(Number.parseFloat(lightGlass.actionInk.match(/[0-9]+/)?.[0]??0)>225,
    "Original light mode must restore the dark primary action / near-white text; computed "+lightGlass.actionInk);
  if(lightGlass.gpu==="ready"){
    await until("window.__dashboardWebGPU?.authGlass?.scheme==='light'",30);
    const audit=await evaluate("window.__dashboardWebGPU.authGlass");
    assert.equal(audit.cardTint,"none");
    assert.equal(audit.faceScheme,"dark",
      "Light UI mode must not turn the unchanged square glass into a light face");
    assert.equal(audit.neutralControlTints,"white / black primary");
  }
  const focused=await evaluate("(()=>{const i=document.querySelector('[data-auth-glass-input]');"+
    "i.focus();return {focused:document.activeElement===i,"+
    "outline:getComputedStyle(i).outlineWidth};})()");
  assert.equal(focused.focused,true);
  assert.ok(Number.parseFloat(focused.outline)>=2,
    "Focused neutral-glass inputs retain an accessible ring");
  await evaluate("document.getElementById('public-theme-toggle').click()");
  await until("document.documentElement.dataset.dofTheme==='dark'&&"+
    "!!document.querySelector('.auth3-root.dark')",50);
  // Clicking the card-owned back arrow uses a 420ms compositor-friendly exit.
  // entry first. The route remains active until that exit finishes.
  await evaluate("window.__trackResumeEvents=0;"+
    "addEventListener('dofinances:home-track-resume',()=>{"+
    "window.__trackResumeEvents++;window.__trackResumeAt=performance.now()})");
  await evaluate("document.querySelector('.auth3-back-link').click()");
  await sleep(130);
  const exit=await evaluate("({route:location.pathname,"+
    "state:window.__dofPublicRouter.state,card:!!document.querySelector('.auth3-root form'),"+
    "shell:document.body.dataset.publicRoute,resume:window.__trackResumeEvents,"+
    "buttonsOpacity:getComputedStyle(document.querySelector('.cta6-bottom-action')).opacity,"+
    "gpuReady:document.body.dataset.gpuScene==='ready',"+
    "track:window.__dashboardWebGPU?.track||null})");
  assert.equal(exit.route,"/login");
  assert.equal(exit.state,"exiting");
  assert.equal(exit.card,true);
  assert.equal(exit.shell,"leaving");
  assert.equal(exit.buttonsOpacity,"0",
    "Bottom buttons remain offscreen during the route-owned card exit");
  assert.equal(exit.resume,1,"Back arrow immediately signals the shared renderer");
  if(exit.gpuReady){
    assert.equal(exit.track?.running,true,
      "WebGPU track animation must be running during card exit without pointer movement");
    const first=exit.track?.elapsed;
    await sleep(150);
    const next=await evaluate("window.__dashboardWebGPU?.track?.elapsed");
    assert.ok(next>first+0.02,
      "Track phase must advance continuously while the card exits, without pointer events");
  }
  await until("location.pathname==='/'&&window.__dofPublicRouter.state==='home'",85);
  // CSS transition completion depends on presented animation frames, not
  // just elapsed time. Assert the fully restored state after it actually
  // settles; a late frame must not turn 99.8% opacity into a false failure.
  await until("!document.body.dataset.publicRoute&&getComputedStyle(document.querySelector('.cta6-bottom-action')).opacity==='1'",100,60);
  const returned=await evaluate("(()=>{const r=window.__persistedShell;"+
    "const b=r.logo.getBoundingClientRect();return {"+
    "mosaic:document.querySelector('#cta6-mosaic')===r.mosaic,"+
    "logo:document.querySelector('#dashboard-title')===r.logo,"+
    "topbar:document.querySelector('#global-menu')===r.bar,"+
    "card:!!document.querySelector('.auth3-root'),"+
    "buttonsTop:document.querySelector('.cta6-bottom-action').getBoundingClientRect().top,"+
    "buttonsOpacity:getComputedStyle(document.querySelector('.cta6-bottom-action')).opacity,"+
    "shell:document.body.dataset.publicRoute||'home',"+
    "logoY:(b.top+b.bottom)/2};})()");
  assert.equal(returned.mosaic,true);
  assert.equal(returned.logo,true);
  assert.equal(returned.topbar,true);
  assert.equal(returned.card,false);
  assert.equal(returned.shell,"home");
  assert.ok(Math.abs(returned.buttonsTop-home.bottomTop)<1,
    "The same bottom button row must slide back to its original home position");
  assert.equal(returned.buttonsOpacity,"1",
    "Buttons must finish fading in after their upward return");
  if(await evaluate("document.body.dataset.gpuScene==='ready'")){
    const before=await evaluate("window.__dashboardWebGPU?.track?.elapsed");
    await sleep(140);
    const after=await evaluate("window.__dashboardWebGPU?.track");
    assert.equal(after?.running,true,
      "Track RAF must remain active after square restoration finishes");
    assert.ok(after?.elapsed>before+0.02,
      "Track lanes must keep moving after returning home without pointer input");
  }
  assert.ok(Math.abs(returned.logoY-home.homeY)<1,
    "Reversing the route restores the original full-size doof position");
  // Browser Forward also uses the persistent route registry.
  await evaluate("history.forward()");
  await until("location.pathname==='/login'&&window.__dofPublicRouter.state==='login'",170);
  assert.equal(await evaluate("document.querySelector('#cta6-mosaic')===window.__persistedShell.mosaic"),true);
  // A cold direct visit serves the same shell, initially in compact state.
  await send("Page.navigate",{url:origin+"/login"});
  await until("location.pathname==='/login'&&!!document.querySelector('.auth3-root form')",170);
  await sleep(740);
  const direct=await evaluate("({"+
    "shell:!!document.querySelector('#workspace-shell #cta6-mosaic'),"+
    "topbar:!!document.querySelector('#global-menu'),"+
    "logoCount:document.querySelectorAll('#dashboard-title').length,"+
    "routeState:window.__dofPublicRouter.state,"+
    "direct:document.body.dataset.directLogin})");
  assert.equal(direct.shell,true);
  assert.equal(direct.topbar,true);
  assert.equal(direct.logoCount,1);
  assert.equal(direct.routeState,"login");
  assert.equal(direct.direct,"true");
  await evaluate("document.querySelector('.auth3-back-link').click()");
  await until("location.pathname==='/'&&window.__dofPublicRouter.state==='home'",85);
  assert.deepEqual(misses,[],"No missing shell or lazy login assets");
  process.stdout.write("Persistent shell, lazy login card, reverse exit, browser history and direct entry verified.\\n");
}finally{
  try{socket?.close();}catch{}
  try{chrome?.kill("SIGKILL");}catch{}
  await new Promise(resolve=>server.close(resolve));
  try{rmSync(profile,{force:true,recursive:true,maxRetries:12,retryDelay:150});}
  catch(cleanupError){process.stderr.write("Chrome profile cleanup: "+String(cleanupError)+"\n");}
}
