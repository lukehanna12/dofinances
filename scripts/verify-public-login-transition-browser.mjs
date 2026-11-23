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
  ".js":"text/javascript",".avif":"image/avif",".webp":"image/webp",".svg":"image/svg+xml",
  ".wgsl":"text/plain"};
const misses=[];
const server=createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  let target;
  if(pathname==="/login"||pathname==="/login/"||pathname==="/projects"||pathname==="/projects/"||pathname==="/"){
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
    if(pathname==="/login"||pathname==="/login/"||pathname==="/projects"||pathname==="/projects/")body=Buffer.from(body.toString("utf8").replace('<body class="public-home">','<body class="public-home" data-public-route="leaving" data-direct-login="true">'));
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
    // A navigation or reload can invalidate the old CDP execution context
    // between the browser's event and our next assertion. This is a test
    // harness race, not an app error. Retry only those transient CDP errors;
    // do not repeat the reload action itself.
    for(let attempt=0;attempt<9;attempt++){
      try{
        const result=await send("Runtime.evaluate",
          {expression,returnByValue:true,awaitPromise:true});
        if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      }catch(error){
        if(!/Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id/i.test(String(error))||
           attempt===8)throw error;
        if(expression.includes("location.reload()"))return undefined;
        await sleep(45);
      }
    }
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
  // A former saved light preference must not restore light mode on reload.
  await evaluate("localStorage.setItem('dofinances-theme','light');location.reload()");
  await until("document.querySelectorAll('#cta6-mosaic>.cta6-tile').length===66");
  // Measure the normal settled homepage, not the logo's 16px introduction.
  await sleep(1050);
  const home=await evaluate("(()=>{window.__persistedShell={"+
    "mosaic:document.querySelector('#cta6-mosaic'),"+
    "logo:document.querySelector('#dashboard-title'),"+
    "bar:document.querySelector('#global-menu'),"+
    "themeAbsent:!document.querySelector('#public-theme-toggle')};"+
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
    "themeAbsent:!document.querySelector('#public-theme-toggle'),"+
    "center:(c.left+c.right)/2,viewport:innerWidth/2,"+
    "logoY:(brand.top+brand.bottom)/2,scale:getComputedStyle(r.logo).transform,"+
    "caption:document.body.textContent.includes('A clearer view of what comes next.'),"+
    "back:document.querySelector('.auth3-back-link')?.getAttribute('href'),"+
    "buttonsTop:document.querySelector('.cta6-bottom-action').getBoundingClientRect().top,"+
    "buttonsOpacity:getComputedStyle(document.querySelector('.cta6-bottom-action')).opacity,"+
    "state:window.__dofPublicRouter.state,route:location.pathname};})()");
  for(const field of ["sameMosaic","sameBrand","sameBar","themeAbsent"])
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
  assert.equal(darkOrnaments.routeOverscroll,"none",
    "Sign-in content must stop elastically bouncing at native scroll boundaries");
  assert.equal(darkOrnaments.rootOverscroll,"none",
    "Login-scoped root must not rubberband or chain wheel/touch overscroll");
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
  // The scroll container must remain scrollable in short viewports, while
  // attempting to push beyond its actual bounds cannot translate the DOM.
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#public-route-content')).overscrollBehaviorY"),"none");
  if(shortStart.glassParent){
    assert.equal(shortStart.glassParent,"public-route-content",
      "Glass surface belongs to the very same native scrollport as the card");
    assert.ok(shortStart.glassHeight>=shortStart.stageHeight-2,
      "Glass covers the entire form, not just the short viewport");
  }
  await evaluate("document.querySelector('#public-route-content').scrollTop=190");
  await until("document.querySelector('#public-route-content').scrollTop >= 100",50);
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
  // Synthetic compositor displacement: move the entire card AND canvas by
  // the same 23 CSS px without changing scrollTop (the macOS elastic case).
  // The glass shader must sample the fixed background from the *measured*
  // viewport relationship and submit BEFORE a later animation frame.
  if(shortStart.glassParent&&await evaluate("document.body.dataset.authGlassMode==='webgpu'&&document.body.dataset.authGpuScene==='ready'")){
    const elastic=await evaluate("(()=>{"+
      "const route=document.querySelector('#public-route-content');"+
      "const glass=document.querySelector('#dashboard-auth-glass-scene');"+
      "const stage=document.querySelector('#public-route-stage');"+
      "const before=window.__dashboardWebGPU;"+
      "const sync0=before.authSynchronousScrollFrames||0;"+
      "const frames0=before.authOnlyFrames||0;"+
      "glass.style.translate='0 23px';stage.style.translate='0 23px';"+
      "route.dispatchEvent(new Event('scroll'));"+
      "const a=window.__dashboardWebGPU;"+
      "return {scrollTop:route.scrollTop,offset:a.authBackdropOffsetCSS,"+
      "actualTop:glass.getBoundingClientRect().top,sceneTop:a.sceneTopCSS,"+
      "sync:(a.authSynchronousScrollFrames||0)-sync0,"+
      "frames:(a.authOnlyFrames||0)-frames0};})()");
    assert.ok(elastic.sync>=1&&elastic.frames>=1,
      "Scroll submits a glass WebGPU frame immediately, not one RAF later");
    assert.ok(Math.abs(elastic.offset-(elastic.sceneTop-elastic.actualTop))<0.5,
      "Glass uses the actual composited canvas/scene coordinate delta");
    assert.ok(Math.abs(elastic.offset-(elastic.scrollTop-23))<1,
      "Elastic translation corrects the background while scrollTop stays unchanged");
    await evaluate("(()=>{const route=document.querySelector('#public-route-content');"+
      "document.querySelector('#dashboard-auth-glass-scene').style.translate='';"+
      "document.querySelector('#public-route-stage').style.translate='';"+
      "route.dispatchEvent(new Event('scroll'));})()");
  }
  // Confirm top/bottom bounds without disabling the scrollport. Real native
  // elastic overscroll is compositor-controlled and cannot be reproduced by
  // a synthetic scrollTop assignment; CSS boundary policy is asserted above.
  const boundaries=await evaluate("(()=>{const r=document.querySelector('#public-route-content');"+
    "const max=r.scrollHeight-r.clientHeight;"+
    "r.scrollTop=-1000;const top=r.scrollTop;"+
    "r.scrollTop=max+1000;const bottom=r.scrollTop;"+
    "return {top,bottom,max,overflow:getComputedStyle(r).overflowY,"+
    "overscroll:getComputedStyle(r).overscrollBehaviorY};})()");
  assert.equal(boundaries.top,0);
  assert.ok(Math.abs(boundaries.bottom-boundaries.max)<1);
  assert.equal(boundaries.overflow,"auto");
  assert.equal(boundaries.overscroll,"none");
  await evaluate("document.querySelector('#public-route-content').scrollTop=0");
  // A headless Chrome --window-size includes browser chrome: innerHeight is
  // not necessarily 880. Clear emulation rather than assuming the restored
  // viewport matches the CLI outer-window dimensions.
  await send("Emulation.clearDeviceMetricsOverride");
  await until("innerHeight==="+normalMetrics.height+" && innerWidth==="+normalMetrics.width+
    " && document.querySelector('#public-route-content').scrollTop===0",60);

  const compositorMode=await evaluate("document.body.dataset.authGlassMode==='compositor'");
  assert.equal(compositorMode,false,"Default sign-in must use the ORIGINAL full WebGPU material");
  const scrollComposite=await evaluate("(()=>{const card=document.querySelector('[data-auth-glass-card]');"+
    "const control=document.querySelector('[data-auth-glass-input]');"+
    "const glass=document.querySelector('#dashboard-auth-glass-scene');"+
    "return {cardFilter:getComputedStyle(card).backdropFilter,"+
    "controlFilter:getComputedStyle(control).backdropFilter,"+
    "canvasOpacity:glass?getComputedStyle(glass).opacity:null,"+
    "canvasVisibility:glass?getComputedStyle(glass).visibility:null,"+
    "gpuHome:document.body.dataset.gpuScene,"+
    "mode:window.__dashboardWebGPU?.authPresentation};})()");
  if(scrollComposite.gpuHome==="ready"){
    assert.equal(scrollComposite.cardFilter,"none",
      "Original full WebGPU glass must NOT be replaced with CSS backdrop blur");
    assert.equal(scrollComposite.controlFilter,"none",
      "Original tinted controls must use their WebGPU materials");
    assert.equal(scrollComposite.canvasOpacity,"1");
    assert.equal(scrollComposite.canvasVisibility,"visible");
    assert.equal(scrollComposite.mode,"shared-pipeline-transparent-overlay",
      "Full refractive WebGPU shader is the production default, not a partial overlay");
  }else{
    assert.match(scrollComposite.cardFilter,/blur\(/,
      "Only browsers without WebGPU should use the accessible CSS fallback");
  }

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
    "No artificial pointer spotlight or enlarged hover effect");
  if(darkGlass.gpu==="ready"&&!compositorMode){
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
    "No newly painted CSS pointer spotlight");
  if(darkGlass.gpu==="ready"&&!compositorMode){
    await until("window.__dashboardWebGPU?.authGlass?.hovered===true",30,40);
    const state=await evaluate("({focus:window.__dashboardWebGPU.focusedTile,"+
      "squareCount:window.__dashboardWebGPU.tiles})");
    assert.ok(state.focus>=state.squareCount,
      "Hover targets route glass panes within the shared tile interaction controller");
  }
  // The card has independent hover ownership from its nested glass buttons.
  // The squares continue using the original shared interaction controller.
  if(darkGlass.gpu==="ready"&&!compositorMode){
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
  // The former preference must not affect the card, controls or GPU material.
  assert.equal(await evaluate("document.documentElement.dataset.dofTheme"),"dark");
  assert.equal(await evaluate("document.getElementById('public-theme-toggle')"),null);
  assert.equal(await evaluate("document.querySelector('.auth3-root').classList.contains('dark')"),true);
  const focused=await evaluate("(()=>{const i=document.querySelector('[data-auth-glass-input]');"+
    "i.focus();return {focused:document.activeElement===i,"+
    "outline:getComputedStyle(i).outlineWidth};})()");
  assert.equal(focused.focused,true);
  assert.ok(Number.parseFloat(focused.outline)>=2,
    "Focused neutral-glass inputs retain an accessible ring");
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
  // Full original WebGPU material remains, but its canvas is fixed to
  // the wallpaper by DEFAULT. No capture and no shader/mipmap substitution.
  await send("Page.navigate",{url:origin+"/login"});
  await until("document.body.dataset.authScrollMode==='fixed'&&"+
    "!!document.querySelector('[data-auth-glass-card]')",170);
  assert.equal(await evaluate("document.body.dataset.authGlassMode"),"webgpu");
  if(await evaluate("document.body.dataset.authGpuScene==='ready'")){
    const sample=await evaluate("(()=>{"+
      "const r=document.querySelector('#public-route-content'),"+
      "card=document.querySelector('[data-auth-glass-card]'),"+
      "canvas=document.querySelector('#dashboard-auth-glass-scene');"+
      "const css=getComputedStyle(canvas),oldHeight=r.style.height,old=r.scrollTop;"+
      "const cardBefore=card.getBoundingClientRect().top,"+
      "canvasBefore=canvas.getBoundingClientRect().top;"+
      "r.style.height='340px';r.scrollTop=190;"+
      "const deltaCard=card.getBoundingClientRect().top-cardBefore,"+
      "deltaCanvas=canvas.getBoundingClientRect().top-canvasBefore;"+
      "r.scrollTop=old;r.style.height=oldHeight;"+
      "return {deltaCard,deltaCanvas,mode:window.__dashboardWebGPU.authScrollPresentation,"+
      "mips:window.__dashboardWebGPU.mipCount,"+
      "fullShader:window.__dashboardWebGPU.authPresentation,"+
      "canvasHeight:canvas.height,clientHeight:canvas.clientHeight,position:css.position};})()");
    assert.equal(sample.position,"fixed");
    assert.equal(sample.mode,"fixed-viewport");
    assert.equal(sample.fullShader,"shared-pipeline-transparent-overlay");
    assert.ok(sample.mips>=5,"Full original WebGPU mip chain is preserved");
    assert.ok(Math.abs(sample.deltaCard+190)<2);
    assert.ok(Math.abs(sample.deltaCanvas)<1,
      "Existing WebGPU background pixels must not be dragged by native scroll");
  }
  // The original native-content canvas remains a reversible one-parameter
  // rollback if Mac compositor behavior differs from Chromium's.
  await send("Page.navigate",{url:origin+"/login?auth-scroll=native"});
  await until("document.body?.dataset?.authScrollMode==='native'&&"+
    "!!document.querySelector('[data-auth-glass-card]')",170);
  if(await evaluate("document.body.dataset.authGpuScene==='ready'")){
    const fallback=await evaluate("(()=>{"+
      "const r=document.querySelector('#public-route-content'),"+
      "canvas=document.querySelector('#dashboard-auth-glass-scene');"+
      "const before=canvas.getBoundingClientRect().top,prior=r.style.height;"+
      "r.style.height='340px';r.scrollTop=190;"+
      "const delta=canvas.getBoundingClientRect().top-before;"+
      "r.scrollTop=0;r.style.height=prior;"+
      "return {delta,mode:window.__dashboardWebGPU.authScrollPresentation};})()");
    assert.equal(fallback.mode,"native-content");
    assert.ok(Math.abs(fallback.delta+190)<1,
      "One-parameter rollback restores the previous scroll-attached canvas");
  }
  // The same persistent shell exposes public Projects as an independent
  // route with the original staggered cards and EXACT shared WebGPU glass.
  await send("Page.navigate",{url:origin+"/"});
  await until("document.querySelectorAll('#cta6-mosaic>.cta6-tile').length===66");
  await sleep(1050);
  await evaluate("document.querySelector('.cta6-bottom-action [data-public-target]').click()");
  await until("location.pathname==='/projects'&&"+
    "document.querySelectorAll('.public-projects-root .project-showcase-card').length===16",190);
  // The glass back arrow enters at 0ms, then the glyph-shaped title and
  // all three right-hand glass chips together at 165ms, before any card
  // enters at 330ms. Check each pane's OWN animation, not a parent fade
  // (the shared WebGPU renderer reads each individual pane's opacity).
  const entranceOrder=await evaluate("(()=>{"+
    "const selectors=['.public-projects-back','.public-projects-title',"+
      "'.public-projects-search-button','.public-projects-filter-button',"+
      "'.public-projects-github-button','.project-showcase-card',"+
      "'.project-showcase-card:nth-child(2)'];"+
    "const value=sel=>{const el=document.querySelector(sel),css=getComputedStyle(el);"+
      "const raw=css.animationDelay;"+
      "return {name:css.animationName,delayMs:parseFloat(raw)*(raw.endsWith('ms')?1:1000),"+
        "durationMs:parseFloat(css.animationDuration)*1000}};"+
    "return selectors.map(value);})()");
  assert.deepEqual(entranceOrder.map(x=>x.name),
    Array(7).fill("project-showcase-enter"),
    "Every stage uses the original project entrance, not a new glass effect");
  assert.deepEqual(entranceOrder.map(x=>Math.round(x.delayMs)),
    [0,165,165,165,165,330,395],
    "Back → title and three glass controls together → first card → remaining cards");
  assert.ok(entranceOrder.every(x=>x.durationMs===500));
  await sleep(1740);
  // The Projects logo is fixed to the top bar, not the viewport-height-
  // centered homepage mosaic. Width changes must never rewrite its animated
  // transform, and height changes must not move it or change visibility.
  // No screenshots: compare DOM geometry across live CDP viewport changes.
  const projectLogoBaseline=await evaluate("(()=>{"+
    "const b=document.querySelector('#dashboard-title').getBoundingClientRect();"+
    "return {width:innerWidth,height:innerHeight,x:(b.left+b.right)/2,"+
    "y:(b.top+b.bottom)/2,navBottom:document.querySelector('#global-menu').getBoundingClientRect().bottom,"+
    "cssTransform:getComputedStyle(document.querySelector('#dashboard-title')).transform,"+
    "exitY:document.querySelector('#dashboard-title').style.getPropertyValue('--doof-exit-y'),"+
    "hidden:document.body.hasAttribute('data-projects-logo-hidden')};})()");
  assert.ok(Math.abs(projectLogoBaseline.y-(projectLogoBaseline.navBottom+46))<1,
    "Projects doof must already be anchored 46px beneath the nav at entry");
  assert.ok(Math.abs(projectLogoBaseline.x-projectLogoBaseline.width/2)<1,
    "Projects logo must remain horizontally centered");
  assert.equal(projectLogoBaseline.hidden,false);
  assert.equal(await evaluate("document.body.dataset.projectsLogoPinned"),"true",
    "Projects must own an explicit viewport-anchored doof, not its animated home offset");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#dashboard-title')).transitionProperty"),
    "opacity","Projects must never animate logo transforms during viewport resizes");
  const checkProjectLogoResize=async(width,height,label,expectedHidden=false)=>{
    await send("Emulation.setDeviceMetricsOverride",
      {width,height,deviceScaleFactor:1,mobile:false});
    await until("innerWidth==="+width+"&&innerHeight==="+height,60,25);
    await sleep(90);
    const actual=await evaluate("(()=>{"+
      "const logo=document.querySelector('#dashboard-title');"+
      "const r=logo.getBoundingClientRect();"+
      "const scene=document.querySelector('.dashboard-home').getBoundingClientRect();"+
      "const css=getComputedStyle(logo),body=getComputedStyle(document.body);"+
      "return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,"+
      "bodyChild:logo.parentElement===document.body,position:css.position,"+
      "sceneTop:scene.top,sceneHeight:scene.height,"+
      "sceneVar:body.getPropertyValue('--dashboard-scene-height'),"+
      "sceneTopVar:body.getPropertyValue('--dashboard-scene-top'),"+
      "logoTransform:css.transform,logoTranslate:css.translate,"+
      "logoInlineTransform:logo.style.getPropertyValue('transform'),"+
      "logoInlinePriority:logo.style.getPropertyPriority('transform'),"+
      "pinAttr:document.body.dataset.projectsLogoPinned,"+
      "pinMatches:logo.matches('body.public-home[data-projects-logo-pinned=\"true\"] > #dashboard-title'),"+
      "matchingTransformRules:[...document.styleSheets].flatMap(sheet=>{"+
      "try{return [...sheet.cssRules].filter(rule=>rule.style?.transform&&"+
      "logo.matches(rule.selectorText||':not(*)')).map(rule=>({selector:rule.selectorText,"+
      "transform:rule.style.transform,priority:rule.style.getPropertyPriority('transform'),"+
      "href:sheet.href}));}catch{return []}}),"+
      "hidden:document.body.hasAttribute('data-projects-logo-hidden'),"+
      "exitY:logo.style.getPropertyValue('--doof-exit-y')};})()");
    assert.equal(actual.bodyChild,true,
      label+": original doof must escape the homepage mosaic containing block");
    assert.equal(actual.position,"fixed",
      label+": doof must be truly fixed to the viewport");
    assert.equal(actual.pinMatches,true,
      label+": Projects-only pinned CSS selector must remain active");
    assert.ok(Math.abs(actual.x-width/2)<1,
      label+": width resize must keep doof horizontally centered");
    assert.ok(Math.abs(actual.y-projectLogoBaseline.y)<1,
      label+": doof must not react to viewport height or width changes ("+
      actual.y+" vs "+projectLogoBaseline.y+"; "+JSON.stringify(actual)+")");
    assert.equal(actual.exitY,projectLogoBaseline.exitY,
      label+": Projects resize must never rewrite --doof-exit-y");
    assert.equal(actual.hidden,expectedHidden,
      label+": resize must not trigger the scroll-only logo fade");
  };
  await checkProjectLogoResize(850,projectLogoBaseline.height,"width shrunk");
  await checkProjectLogoResize(1400,projectLogoBaseline.height,"width expanded");
  await checkProjectLogoResize(projectLogoBaseline.width,590,"height shrunk");
  await checkProjectLogoResize(projectLogoBaseline.width,1060,"height expanded");
  await checkProjectLogoResize(projectLogoBaseline.width,projectLogoBaseline.height,
    "restored viewport");
  const projectState=await evaluate("(()=>{"+
    "const root=document.querySelector('.public-projects-root');"+
    "const cards=[...root.querySelectorAll('.project-showcase-card')];"+
    "const first=cards[0];"+
    "return {state:window.__dofPublicRouter.state,route:location.pathname,"+
    "count:cards.length,icons:cards.filter(c=>!!c.querySelector('.project-showcase-lucide')).length,"+
    "back:!!root.querySelector('[data-public-project-glass=back]'),"+
    "glass:cards.every(c=>c.dataset.publicProjectGlass==='card'),"+
    "allButtons:cards.every(c=>c.tagName==='BUTTON'&&!c.hasAttribute('href')),"+
    "firstImageLazy:!first.querySelector('.project-showcase-photo').hasAttribute('src'),"+
    "backTop:root.querySelector('.public-projects-back').getBoundingClientRect().top,"+
    "backBottom:root.querySelector('.public-projects-back').getBoundingClientRect().bottom,"+
    "headingTop:root.querySelector('.public-projects-title').getBoundingClientRect().top,"+
    "headingBottom:root.querySelector('.public-projects-title').getBoundingClientRect().bottom,"+
    "titleSize:parseFloat(getComputedStyle(root.querySelector('.public-projects-title')).fontSize),"+
    "tools:[...root.querySelector('.public-projects-toolbar').children].map(node=>({x:node.getBoundingClientRect().x,w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})),"+
    "github:(()=>{const a=root.querySelector('.public-projects-github-button');return {href:a.href,target:a.target,rel:a.rel}})(),"+
    "gridTop:root.querySelector('.project-showcase-grid').getBoundingClientRect().top,"+
    "shell:!!document.querySelector('#cta6-mosaic'),"+
    "transparent: getComputedStyle(first).backgroundColor};})()");
  assert.equal(projectState.state,"projects");
  assert.equal(projectState.route,"/projects");
  assert.equal(projectState.count,16);
  assert.equal(projectState.icons,16);
  const newCards=await evaluate("(()=>['hidden-functions','latexcel'].map(slug=>{"+
    "const card=document.querySelector('.public-projects-root [data-project-slug=\"'+slug+'\"]');"+
    "const icon=card?.querySelector('.project-showcase-lucide');"+
    "return {slug,name:card?.querySelector('.project-showcase-title')?.textContent,"+
    "badge:card?.querySelector('.project-showcase-badge')?.textContent,"+
    "coming:card?.classList.contains('is-coming-soon'),"+
    "src:icon?.getAttribute('src')};}))()");
  assert.deepEqual(newCards,[
    {slug:"hidden-functions",name:"Hidden Functions",badge:"Coming Soon",
      coming:true,src:"/assets/project-icons/hidden-functions.svg"},
    {slug:"latexcel",name:"LaTeXceL",badge:"Coming Soon",
      coming:true,src:"/assets/project-icons/latexcel.svg"}
  ],"The two additional Coming Soon cards must use the original SVG paths");
  const newIconAssets=await evaluate("(async()=>Promise.all("+
    "['hidden-functions','latexcel'].map(async slug=>{"+
    "const response=await fetch('/assets/project-icons/'+slug+'.svg');"+
    "return {slug,ok:response.ok,contentType:response.headers.get('content-type'),"+
    "body:(await response.text()).includes('stroke-width=\"2\"')};})))()");
  assert.ok(newIconAssets.every(asset=>asset.ok&&
    asset.contentType?.startsWith("image/svg+xml")&&asset.body),
    "Both new icons must be served as real SVG image assets");
  const updatedArt=await evaluate("(()=>{"+
    "const terminal=document.querySelector('[data-project-slug=\"terminal-scalars\"]');"+
    "terminal.dispatchEvent(new Event('pointerenter'));"+
    "const apple=document.querySelector('[data-project-slug=\"apple-hig-reader\"]');"+
    "return {image:terminal.querySelector('.project-showcase-photo').getAttribute('src'),"+
    "appleIcon:apple.querySelector('.project-showcase-lucide').getAttribute('src')};})()");
  assert.equal(updatedArt.image,"/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp",
    "Terminal Scalars must reveal the exact attached artwork instead of a wallpaper");
  assert.equal(updatedArt.appleIcon,"/assets/project-icons/apple-higs-reader.v4.svg",
    "Apple HIGs Reader must use the new supplied icon");
  const artAssets=await evaluate("(async()=>{const [art,icon]=await Promise.all(["+
    "fetch('/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp'),"+
    "fetch('/assets/project-icons/apple-higs-reader.v4.svg')]);"+
    "const bytes=new Uint8Array(await art.arrayBuffer());const svg=await icon.text();"+
    "return {artOk:art.ok,mime:art.headers.get('content-type'),size:bytes.length,"+
    "webp:String.fromCharCode(...bytes.slice(8,12))==='WEBP',"+
    "iconOk:icon.ok,hasCircle:svg.includes('circle cx=\"18\" cy=\"15\" r=\"2\"')};})()");
  assert.equal(artAssets.artOk,true);
  assert.ok(artAssets.mime?.includes('image/webp'));
  assert.ok(artAssets.size>5000&&artAssets.webp,
    "The attached image must arrive as actual WebP binary data");
  assert.equal(artAssets.iconOk,true);
  assert.equal(artAssets.hasCircle,true);
  assert.equal(projectState.back,true);
  assert.equal(projectState.glass,true);
  assert.equal(projectState.allButtons,true);
  assert.equal(projectState.firstImageLazy,true);
  assert.equal(projectState.shell,true);
  assert.ok(Math.abs(projectState.titleSize-42)<1,
    "Projects title is 50% larger than its prior 28px desktop size");
  assert.equal(projectState.tools.length,3,"Search, filter and GitHub are three equal chips");
  for(const tool of projectState.tools){
    assert.equal(tool.w,40);assert.equal(tool.h,40);
  }
  assert.ok(Math.abs((projectState.tools[1].x-projectState.tools[0].x)-
    (projectState.tools[2].x-projectState.tools[1].x))<1,
    "All three toolbar chips are equally spaced");
  assert.equal(projectState.github.href,"https://github.com/lukehanna12");
  assert.equal(projectState.github.target,"_blank");
  assert.match(projectState.github.rel,/noopener/);
  assert.match(projectState.github.rel,/noreferrer/);
  assert.ok(projectState.headingTop>=projectState.backBottom+8,
    "Projects heading must sit clearly below the back glass button");
  assert.ok(projectState.gridTop>=projectState.headingBottom+16,
    "Project cards must start below the stacked page header");
  // Reuse the sign-in page's native scroll contract: both the route
  // scrollport and viewport boundary reject elastic rubberbanding without
  // disabling ordinary wheel/trackpad/touch scrolling.
  const projectScrollPolicy=await evaluate("(()=>{"+
    "const route=document.querySelector('#public-route-content');"+
    "const first=document.querySelector('.project-showcase-card');"+
    "const back=document.querySelector('.public-projects-back');"+
    "const filter=document.querySelector('.public-projects-filter-panel');"+
    "return {route:getComputedStyle(route).overscrollBehaviorY,"+
    "html:getComputedStyle(document.documentElement).overscrollBehaviorY,"+
    "body:getComputedStyle(document.body).overscrollBehaviorY,"+
    "scroll:getComputedStyle(route).overflowY,"+
    "canvas:(()=>{const canvas=document.querySelector('#dashboard-auth-glass-scene');return canvas?getComputedStyle(canvas).position:null})(),"+
    "card:getComputedStyle(first).overflowX,"+
    "back:getComputedStyle(back).overflowX,"+
    "filter:getComputedStyle(filter).overflowX};})()");
  assert.equal(projectScrollPolicy.route,"none");
  assert.equal(projectScrollPolicy.html,"none");
  assert.equal(projectScrollPolicy.body,"none");
  assert.equal(projectScrollPolicy.scroll,"auto",
    "Projects preserves native scrolling instead of canceling wheel/touch events");
  if(await evaluate("document.body.dataset.authGpuScene==='ready'"))
    assert.equal(projectScrollPolicy.canvas,"fixed",
      "Projects shares the sign-in fix: viewport-fixed true WebGPU glass");
  assert.equal(projectScrollPolicy.card,"hidden");
  assert.equal(projectScrollPolicy.back,"hidden");
  assert.equal(projectScrollPolicy.filter,"hidden");
  const projectsScrollMotion=await evaluate("(()=>{"+
    "const route=document.querySelector('#public-route-content');"+
    "const card=document.querySelector('.project-showcase-card');"+
    "const icon=card.querySelector('.project-showcase-lucide');"+
    "const glass=document.querySelector('#dashboard-auth-glass-scene');"+
    "const oldHeight=route.style.height,oldScroll=route.scrollTop;"+
    "route.style.height='300px';"+
    "const before={card:card.getBoundingClientRect().top,"+
    "icon:icon.getBoundingClientRect().top,"+
    "canvas:glass?.getBoundingClientRect().top??0};"+
    "route.scrollTop=160;"+
    "const result={dy:route.scrollTop-oldScroll,"+
    "cardDelta:card.getBoundingClientRect().top-before.card,"+
    "iconDelta:icon.getBoundingClientRect().top-before.icon,"+
    "canvasDelta:(glass?.getBoundingClientRect().top??0)-before.canvas};"+
    "route.scrollTop=oldScroll;route.style.height=oldHeight;"+
    "return result;})()");
  assert.ok(projectsScrollMotion.dy>80,
    "Short viewports must scroll the project cards natively");
  assert.ok(Math.abs(projectsScrollMotion.cardDelta+projectsScrollMotion.dy)<2);
  assert.ok(Math.abs(projectsScrollMotion.iconDelta-projectsScrollMotion.cardDelta)<2,
    "Card artwork/icon and glass geometry remain in the same scroll tree");
  assert.ok(Math.abs(projectsScrollMotion.canvasDelta)<1,
    "The actual WebGPU canvas remains fixed against elastic scroll");
  // The expanded capsule is not required for the visibility trigger: its
  // inert DOM box remains positioned above the search button when closed.
  // Position is measured against the compact logo's actual bottom edge,
  // with precisely a 5px separation, not an arbitrary scrollTop constant.
  const logoThreshold=await evaluate("(()=>{"+
    "const route=document.querySelector('#public-route-content');"+
    "const logo=document.querySelector('#dashboard-title');"+
    "const field=document.querySelector('.public-projects-search-field');"+
    "const inactive=!document.querySelector('.public-projects-search-wrap').classList.contains('is-expanded');"+
    "const oldHeight=route.style.height;route.style.height='300px';"+
    "route.scrollTop=0;route.dispatchEvent(new Event('scroll'));"+
    "const startTop=field.getBoundingClientRect().top;"+
    "const logoBottom=logo.getBoundingClientRect().bottom;"+
    "return {oldHeight,inactive,startTop,logoBottom,"+
      "distance:startTop-logoBottom-5,hidden:document.body.hasAttribute('data-projects-logo-hidden')};})()");
  assert.equal(logoThreshold.inactive,true,
    "Scroll-triggered doof fade must work before search is ever opened");
  assert.equal(logoThreshold.hidden,false,
    "The logo stays visible at the top of the Projects scrollport");
  const crossingScroll=Math.max(12,Math.ceil(logoThreshold.distance)+9);
  await evaluate("(()=>{const route=document.querySelector('#public-route-content');"+
    "route.scrollTop="+crossingScroll+";route.dispatchEvent(new Event('scroll'));})()");
  await until("document.body.hasAttribute('data-projects-logo-hidden')",25,30);
  const crossed=await evaluate("(()=>{const route=document.querySelector('#public-route-content');"+
    "return {scrollTop:route.scrollTop,"+
    "searchTop:document.querySelector('.public-projects-search-field').getBoundingClientRect().top,"+
    "logoBottom:document.querySelector('#dashboard-title').getBoundingClientRect().bottom}})()");
  assert.ok(crossed.scrollTop>0);
  assert.ok(crossed.searchTop<=crossed.logoBottom+5,
    "Fade starts only when the would-be search bar top crosses 5px below doof");
  await until("Number(getComputedStyle(document.querySelector('#dashboard-title')).opacity)<.06",20,35);
  await checkProjectLogoResize(projectLogoBaseline.width,630,
    "height resized while scrolled and faded",true);
  await checkProjectLogoResize(projectLogoBaseline.width,projectLogoBaseline.height,
    "height restored while scrolled and faded",true);
  await evaluate("(()=>{const r=document.querySelector('#public-route-content');"+
    "r.scrollTop=0;r.dispatchEvent(new Event('scroll'));})()");
  await until("!document.body.hasAttribute('data-projects-logo-hidden')",25,30);
  await until("Number(getComputedStyle(document.querySelector('#dashboard-title')).opacity)>.95",20,35);
  await evaluate("(()=>{const r=document.querySelector('#public-route-content');"+
    "r.style.height="+JSON.stringify(logoThreshold.oldHeight)+";})()");
  const pathBefore=await evaluate("location.pathname");
  await evaluate("document.querySelector('.public-projects-root .project-showcase-card').click()");
  assert.equal(await evaluate("location.pathname"),pathBefore,"Public project cards are not links"); 
  // All panels—including side dissolves, downstream shifts, row wraps and
  // the attached glass X—must start on the SAME no-delay, linear timeline.
  const expansionClocks=await evaluate("(()=>{"+
    "const grid=document.querySelector('.project-showcase-grid');"+
    "const cards=[...grid.querySelectorAll('.project-showcase-card')];"+
    "const panes=[cards[0],cards[1],cards[6],cards[7],"+
      "grid.querySelector('.project-showcase-expand-close')];"+
    "return panes.map(node=>{const animation=[...node.getAnimations()].find(a=>"+
      "a.effect?.getTiming().duration===760);"+
      "const t=animation?.effect?.getTiming();"+
      "return {duration:t?.duration,delay:t?.delay,easing:t?.easing,"+
        "time:animation?.currentTime,rate:animation?.playbackRate};});})()");
  assert.equal(expansionClocks.length,5);
  for(const clock of expansionClocks){
    assert.equal(clock.duration,760,"All animated panes use one 760ms timeline");
    assert.equal(clock.delay,0,"No card or row waits before starting");
    assert.equal(clock.easing,"linear","Movement cannot accelerate differently per panel");
    assert.equal(clock.rate,1);
  }
  assert.ok(Math.max(...expansionClocks.map(x=>x.time))-
    Math.min(...expansionClocks.map(x=>x.time))<35,
    "All panel and close-button animations must share the same start time");

  // Actual non-screenshot browser proof: the real button expands both
  // directions across its ORIGINAL row, pushing all its peers to the next.
  await until("(()=>{const grid=document.querySelector('.project-showcase-grid');"+
    "const selected=grid.querySelector('.project-showcase-card.is-expanded');"+
    "return !!selected&&Math.abs(selected.getBoundingClientRect().width-grid.getBoundingClientRect().width)<2;})()",100,30);
  await until("[...document.querySelectorAll('.project-showcase-card')].every("+
    "card=>card.getAnimations().every(animation=>animation.playState!=='running'))",100,30);
  const expandedFirst=await evaluate("(()=>{"+
    "const grid=document.querySelector('.project-showcase-grid');"+
    "const cards=[...grid.querySelectorAll('.project-showcase-card')];"+
    "const selected=cards[0].getBoundingClientRect();"+
    "const firstPushed=cards[1].getBoundingClientRect();"+
    "const close=grid.querySelector('.project-showcase-expand-close');"+
    "return {selectedTop:selected.top,selectedBottom:selected.bottom,"+
      "selectedWidth:selected.width,gridWidth:grid.getBoundingClientRect().width,"+
      "pushedTop:firstPushed.top,pushedLeft:firstPushed.left,"+
      "gridLeft:grid.getBoundingClientRect().left,closeGlass:close.dataset.publicProjectGlass,"+
      "closeVisible:!close.hidden,expanded:cards[0].getAttribute('aria-expanded')};})()");
  assert.equal(expandedFirst.expanded,"true");
  assert.equal(expandedFirst.closeVisible,true);
  assert.equal(expandedFirst.closeGlass,"expand-close");
  assert.ok(expandedFirst.pushedTop>=expandedFirst.selectedBottom-3,
    "Rowmate must wrap to the row BELOW the expanded first card");
  assert.ok(Math.abs(expandedFirst.pushedLeft-expandedFirst.gridLeft)<2,
    "Displaced panels must enter at the left side of the next row");
  await evaluate("document.querySelector('.project-showcase-expand-close').click()");
  // WAAPI applies the pending reversed playback rate at its next timeline
  // sample. Wait for that sample rather than inspecting the stale forward
  // rate in the very same JavaScript turn as the click.
  await until("(()=>{const g=document.querySelector('.project-showcase-grid');"+
    "const c=[...g.querySelectorAll('.project-showcase-card')];"+
    "return [c[0],c[1],c[6],c[7],g.querySelector('.project-showcase-expand-close')]"+
      ".every(node=>[...node.getAnimations()].some(a=>"+
      "a.effect?.getTiming().duration===760&&a.playbackRate===-1));})()",30,20);
  const reverseClocks=await evaluate("(()=>{"+
    "const grid=document.querySelector('.project-showcase-grid');"+
    "const cards=[...grid.querySelectorAll('.project-showcase-card')];"+
    "const panes=[cards[0],cards[1],cards[6],cards[7],"+
      "grid.querySelector('.project-showcase-expand-close')];"+
    "return panes.map(node=>{const a=[...node.getAnimations()].find(x=>"+
      "x.effect?.getTiming().duration===760);"+
      "return {rate:a?.playbackRate,time:a?.currentTime};});})()");
  assert.ok(reverseClocks.every(clock=>clock.rate===-1),
    "The X reverses all panels with the same constant-speed playback rate");
  assert.ok(Math.max(...reverseClocks.map(x=>x.time))-
    Math.min(...reverseClocks.map(x=>x.time))<35,
    "Every return motion must start together—not accelerate at different times");
  await until("!document.querySelector('.public-projects-root').classList.contains('has-project-expansion')",100,30);
  assert.equal(await evaluate("document.querySelector('.project-showcase-expand-close').hidden"),true,
    "The X fully reverses the expansion and hides its glass pane");
  const resetFirst=await evaluate("(()=>{"+
    "const grid=document.querySelector('.project-showcase-grid');"+
    "const cards=[...grid.querySelectorAll('.project-showcase-card')];"+
    "const first=cards[0].getBoundingClientRect(),second=cards[1].getBoundingClientRect();"+
    "return {oneRow:Math.abs(first.top-second.top)<2,"+
      "firstWidth:first.width,secondWidth:second.width,"+
      "hasOverlay:!!grid.querySelector('.project-showcase-expanded-slot')};})()");
  assert.equal(resetFirst.oneRow,true,"Reversal restores the original row");
  assert.ok(Math.abs(resetFirst.firstWidth-resetFirst.secondWidth)<2);
  assert.equal(resetFirst.hasOverlay,false,"Reversal removes the spacer");
  // A middle-row click must take BOTH its left and right neighbors with it.
  await evaluate("document.querySelectorAll('.project-showcase-card')[2].click()");
  await until("(()=>{const g=document.querySelector('.project-showcase-grid');"+
    "const c=g.querySelectorAll('.project-showcase-card');"+
    "return c[2].classList.contains('is-expanded')&&"+
    "Math.abs(c[2].getBoundingClientRect().width-g.getBoundingClientRect().width)<2;})()",100,30);
  await until("[...document.querySelectorAll('.project-showcase-card')].every("+
    "card=>card.getAnimations().every(animation=>animation.playState!=='running'))",100,30);
  const expandedMiddle=await evaluate("(()=>{const c=document.querySelectorAll('.project-showcase-card');"+
    "const selected=c[2].getBoundingClientRect();"+
    "return {left:c[0].getBoundingClientRect().top,right:c[3].getBoundingClientRect().top,"+
      "bottom:selected.bottom};})()");
  assert.ok(expandedMiddle.left>=expandedMiddle.bottom-3&&
    expandedMiddle.right>=expandedMiddle.bottom-3,
    "Both sides of the clicked card must be displaced together");
  await evaluate("document.querySelector('.project-showcase-expand-close').click()");
  await until("!document.querySelector('.public-projects-root').classList.contains('has-project-expansion')",100,30);
  // Closing during the forward movement must reverse its CURRENT progress
  // and finish cleanly, rather than replaying a long, accelerated reset.
  await evaluate("document.querySelectorAll('.project-showcase-card')[5].click()");
  await sleep(160);
  await evaluate("document.querySelector('.project-showcase-expand-close').click()");
  await until("!document.querySelector('.public-projects-root').classList.contains('has-project-expansion')",100,30);
  assert.equal(await evaluate("document.querySelectorAll('[data-project-card-dismiss-at],[data-project-card-restore-at],[data-project-card-restore-from]').length"),0,
    "Mid-motion reverse must clean all square-dissolve optical timestamps");
  await evaluate("document.querySelector('.public-projects-root .project-showcase-card').dispatchEvent(new Event('pointerenter'))");
  assert.equal(await evaluate("document.querySelector('.public-projects-root .project-showcase-photo').hasAttribute('src')"),true,
    "Hover begins loading the exact curated project artwork");
  if(await evaluate("document.body.dataset.authGpuScene==='ready'")){
    await until("window.__dashboardWebGPU?.projectGlass?.count===25",70);
    const gpu=await evaluate("window.__dashboardWebGPU.projectGlass");
    assert.equal(gpu.renderer,"shared-webgpu-glassPipeline");
    assert.equal(gpu.tint,"none");
    assert.equal(gpu.titleGlyphGlass,true,
      "Projects heading must share the actual WebGPU glassPipeline as a glyph pane");
    assert.ok(gpu.roles.includes("title"));
    assert.ok(gpu.titleMaskPixels[0]>100&&gpu.titleMaskPixels[1]>30,
      "Font-shape texture must cover the title's native glyph bounds");
    const textMask=await evaluate("window.__dashboardWebGPU.projectTitleMask");
    assert.equal(textMask.pipeline,"shared-webgpu-glassPipeline");
    assert.ok(textMask.nonzeroPixels>300,"Text alpha mask must contain visible glyph pixels");
    const titlePaint=await evaluate("(()=>{const t=document.querySelector('.public-projects-title');"+
      "return {text:t.textContent,role:t.dataset.publicProjectGlass,"+
      "color:getComputedStyle(t).color,fill:getComputedStyle(t).webkitTextFillColor}})()");
    assert.equal(titlePaint.text,"Projects");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.public-projects-title')).userSelect"),"none",
      "The glass title remains semantic but its text cannot be selected");
    assert.equal(titlePaint.role,"title");
    assert.equal(titlePaint.color,"rgba(0, 0, 0, 0)",
      "DOM text ink must not cover the letter-shaped WebGPU material");
    assert.equal(titlePaint.fill,"rgba(0, 0, 0, 0)");
    assert.equal(projectState.transparent,"rgba(0, 0, 0, 0)",
      "Public projects use the genuine transparent WebGPU glass layer");
  }
  // The search pill extends LEFT of the original square, then reveals its
  // own separate circular untinted-glass cancel button and focuses typing.
  await evaluate("document.querySelector('.public-projects-search-button').click()");
  await until("document.querySelector('.public-projects-search-wrap').classList.contains('is-ready')&&"+
    "document.activeElement===document.querySelector('.public-projects-search-input')",50);
  // is-ready is the focus gate at SEARCH_EXPAND_MS; the CSS capsule has a
  // longer 320ms geometry transition. Never measure halfway through the
  // transform and misreport a correctly expanding 390px glass surface.
  await until("(()=>{const p=document.querySelector('.public-projects-search-field');"+
    "if(!p)return false;const r=p.getBoundingClientRect();"+
    "return r.width>300&&Math.abs(r.width-p.offsetWidth)<2;})()",60,25);
  const searchState=await evaluate("(()=>{"+
    "const pill=document.querySelector('.public-projects-search-field').getBoundingClientRect(),"+
    "cancel=document.querySelector('.public-projects-search-cancel'),"+
    "button=document.querySelector('.public-projects-search-button').getBoundingClientRect();"+
    "return {pillLeft:pill.left,pillRight:pill.right,pillWidth:pill.width,"+
    "buttonLeft:button.left,cancelRadius:getComputedStyle(cancel).borderTopLeftRadius,"+
    "cancelVisible:getComputedStyle(cancel).visibility,"+
    "inputActive:document.activeElement?.classList.contains('public-projects-search-input')};})()");
  assert.ok(searchState.pillRight<searchState.buttonLeft,
    "The long capsule expands strictly to the left of the original search button");
  assert.ok(searchState.pillWidth>300,"Desktop search capsule is a long glass input");
  assert.equal(searchState.cancelRadius,"999px");
  assert.equal(searchState.cancelVisible,"visible");
  assert.equal(searchState.inputActive,true);
  if(await evaluate("document.body.dataset.authGpuScene==='ready'")){
    // A transparent CSS face is insufficient: a 999px radius previously
    // discarded even the center of the capsule in the WebGPU shader.
    await until("window.__dashboardWebGPU?.projectGlass?.searchGlass?.opacity>=.99&&"+
      "window.__dashboardWebGPU.projectGlass.searchGlass.widthPx>300",60,35);
    const pane=await evaluate("window.__dashboardWebGPU.projectGlass.searchGlass");
    assert.equal(pane.materialTag,-2,
      "Search capsule shares the untinted card/home-square glass material");
    assert.ok(Math.abs(pane.radiusPx-20)<1,
      "Capsule must have a 20px GPU corner radius, not the authored CSS 999px");
    assert.ok(Math.abs(pane.heightPx-40)<1);
    assert.ok(Math.abs(pane.widthPx-searchState.pillWidth)<2,
      "The actual GPU pane follows the presented capsule size");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.public-projects-search-field')).backgroundColor"),
      "rgba(0, 0, 0, 0)");
    const pixel=await evaluate("(async()=>{"+
      "const canvas=document.querySelector('#dashboard-auth-glass-scene');"+
      "const image=new Image();image.src=canvas.toDataURL('image/png');await image.decode();"+
      "const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;"+
      "const context=copy.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);"+
      "const origin=canvas.getBoundingClientRect();"+
      "const bounds=document.querySelector('.public-projects-search-field').getBoundingClientRect();"+
      "const x=Math.floor((bounds.left+bounds.width*.5-origin.left)*canvas.width/origin.width);"+
      "const y=Math.floor((bounds.top+bounds.height*.5-origin.top)*canvas.height/origin.height);"+
      "return Array.from(context.getImageData(x,y,1,1).data);})()");
    assert.ok(pixel[3]>=200,
      "Expanded search MUST have a real WebGPU glass pixel in its center, got "+pixel);
  }
  await evaluate("(()=>{const input=document.querySelector('.public-projects-search-input');"+
    "input.value='ReadMe';input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  assert.equal(await evaluate("document.querySelectorAll('.public-projects-root .project-showcase-card:not([hidden])').length"),1,
    "Search filters existing cards immediately without navigation");
  assert.equal(await evaluate("document.querySelector('.public-projects-root .project-showcase-card:not([hidden])').dataset.projectSlug"),
    "github-readme-chrome-extension");
  await evaluate("(()=>{const input=document.querySelector('.public-projects-search-input');"+
    "input.value='unmatchable-phrase-964752';input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  assert.equal(await evaluate("document.querySelectorAll('.public-projects-root .project-showcase-card:not([hidden])').length"),0);
  assert.equal(await evaluate("document.querySelector('.public-projects-empty').hidden"),false);
  await evaluate("(()=>{const input=document.querySelector('.public-projects-search-input');"+
    "input.value='ReadMe';input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  assert.equal(await evaluate("document.querySelector('.public-projects-empty').hidden"),true);

  // Multiselect filters and the downward overlay are independently owned
  // by Projects; the search term and the selected type chips compose.
  // The filter icon changes via continuous three-stroke geometry, with
  // no overlay/crossfade between two SVGs.
  const closedFilter=await evaluate("(()=>{const b=document.querySelector('.public-projects-filter-button');"+
    "return {svgCount:b.querySelectorAll('svg').length,pathCount:b.querySelectorAll('svg path').length,"+
    "left:getComputedStyle(b.querySelector('.public-projects-filter-morph-left')).transform,"+
    "tail:Number(getComputedStyle(b.querySelector('.public-projects-filter-morph-tail')).opacity)};})()");
  assert.equal(closedFilter.svgCount,1);
  assert.equal(closedFilter.pathCount,3);
  assert.equal(closedFilter.left,"none");
  assert.equal(closedFilter.tail,1);
  await evaluate("document.querySelector('.public-projects-filter-button').click()");
  await until("document.querySelector('.public-projects-filter-wrap').classList.contains('is-open')",30);
  await sleep(100);
  await until("Number(getComputedStyle(document.querySelector('.public-projects-filter-morph-tail')).opacity)<.99",45,30);
  const duringMorph=await evaluate("(()=>{const b=document.querySelector('.public-projects-filter-button');"+
    "return {left:getComputedStyle(b.querySelector('.public-projects-filter-morph-left')).transform,"+
    "tail:Number(getComputedStyle(b.querySelector('.public-projects-filter-morph-tail')).opacity)};})()");
  assert.notEqual(duringMorph.left,"none",
    "The actual filter stroke must move; no SVG icon replacement");
  assert.ok(duringMorph.tail<1,"The third stroke recedes into the upward chevron");
  await sleep(255);
  const dropdown=await evaluate("(()=>{const p=document.querySelector('.public-projects-filter-panel');"+
    "return {names:[...p.querySelectorAll('.public-projects-filter-label')].map(x=>x.textContent),"+
    "top:p.getBoundingClientRect().top,bottom:p.getBoundingClientRect().bottom,"+
    "firstCardTop:document.querySelector('.project-showcase-grid').getBoundingClientRect().top,"+
    "glass:p.dataset.publicProjectGlass,expanded:document.querySelector('.public-projects-filter-button').getAttribute('aria-expanded'),"+
    "leftTransform:getComputedStyle(document.querySelector('.public-projects-filter-morph-left')).transform,"+
    "rightTransform:getComputedStyle(document.querySelector('.public-projects-filter-morph-right')).transform,"+
    "tailOpacity:Number(getComputedStyle(document.querySelector('.public-projects-filter-morph-tail')).opacity)};})()");
  assert.deepEqual(dropdown.names,["Applications","Extensions","Plugins","Add-ons","CLIs"]);
  assert.equal(dropdown.glass,"filter-dropdown");
  assert.equal(dropdown.expanded,"true");
  assert.notEqual(dropdown.leftTransform,"none");
  assert.notEqual(dropdown.rightTransform,"none");
  assert.equal(dropdown.tailOpacity,0,
    "Arrowhead has two strokes and no overlaid SVG to crossfade");
  assert.ok(dropdown.top<dropdown.firstCardTop&&dropdown.bottom>dropdown.firstCardTop,
    "The glass menu must drop over project cards, not push the grid down");
  await evaluate("document.querySelector('.public-projects-filter-option[data-category=Extensions]').click()");
  assert.equal(await evaluate("document.querySelector('.public-projects-filter-option[data-category=Extensions]').getAttribute('aria-pressed')"),"true");
  assert.equal(await evaluate("document.querySelectorAll('.project-showcase-card:not([hidden])').length"),1);
  await evaluate("document.querySelector('.public-projects-filter-option[data-category=CLIs]').click()");
  assert.equal(await evaluate("document.querySelector('.public-projects-filter-option[data-category=CLIs]').getAttribute('aria-pressed')"),"true");
  assert.equal(await evaluate("document.querySelectorAll('.project-showcase-card:not([hidden])').length"),1);
  await evaluate("(()=>{const input=document.querySelector('.public-projects-search-input');"+
    "input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  assert.equal(await evaluate("document.querySelectorAll('.project-showcase-card:not([hidden])').length"),5,
    "Selected types are combined with OR while search uses AND");

  // Clicking outside collapses (rather than unmounting) the glass menu,
  // then reopening shows persistent checkmarks.
  await evaluate("document.querySelector('.public-projects-title').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await until("!document.querySelector('.public-projects-filter-wrap').classList.contains('is-open')",20);
  await until("getComputedStyle(document.querySelector('.public-projects-filter-panel')).visibility==='hidden'",30,75);
  await until("getComputedStyle(document.querySelector('.public-projects-filter-morph-left')).transform==='none'&&"+
    "Number(getComputedStyle(document.querySelector('.public-projects-filter-morph-tail')).opacity)>.99",30,75);
  assert.ok(Number(await evaluate("getComputedStyle(document.querySelector('.public-projects-filter-panel')).opacity"))<.02,
    "The outside-click collapse must finish its reverse opacity and geometry");
  assert.equal(await evaluate("document.querySelector('.public-projects-filter-button').getAttribute('aria-expanded')"),"false");
  await evaluate("document.querySelector('.public-projects-filter-button').click()");
  assert.equal(await evaluate("document.querySelector('.public-projects-filter-option[data-category=Extensions]').classList.contains('is-selected')"),true);
  assert.equal(await evaluate("document.querySelector('.public-projects-filter-option[data-category=CLIs]').classList.contains('is-selected')"),true);
  await evaluate("document.querySelector('.public-projects-filter-option[data-category=Extensions]').click()");
  await evaluate("document.querySelector('.public-projects-filter-option[data-category=CLIs]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.project-showcase-card:not([hidden])').length"),16);
  await evaluate("document.querySelector('.public-projects-filter-button').click()");
  await until("!document.querySelector('.public-projects-filter-wrap').classList.contains('is-open')",20);
  // Cancel reverses the expansion and restores the original search chip.
  await evaluate("document.querySelector('.public-projects-search-cancel').click()");
  await until("!document.querySelector('.public-projects-search-wrap').classList.contains('is-expanded')",20);
  await until("Number(getComputedStyle(document.querySelector('.public-projects-search-field')).opacity)<.01",30,75);
  assert.ok(Number(await evaluate("getComputedStyle(document.querySelector('.public-projects-search-field')).opacity"))<.01,
    "The reversed search capsule must be visually fully collapsed");
  assert.equal(await evaluate("document.querySelector('.public-projects-search-input').disabled"),true);
  assert.equal(await evaluate("document.querySelectorAll('.project-showcase-card:not([hidden])').length"),16);
  if(await evaluate("document.body.dataset.authGpuScene==='ready'")){
    const controlAudit=await evaluate("window.__dashboardWebGPU.projectGlass");
    assert.equal(controlAudit.materialReference,"first-home-square");
    for(const name of [".public-projects-search-button",".public-projects-filter-button",
      ".public-projects-github-button"]){
      assert.equal(await evaluate("getComputedStyle(document.querySelector("+JSON.stringify(name)+")).backgroundColor"),
        "rgba(0, 0, 0, 0)","Real GPU glass is visible behind the "+name+" surface");
    }
  }
  await evaluate("document.querySelector('.public-projects-back').click()");
  assert.equal(await evaluate("window.__dofPublicRouter.state"),"exiting");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.public-projects-root .public-projects-back')).animationName"),"none",
    "Back arrow must not use a second DOM fade/slide in place of square dissolution");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.public-projects-root .project-showcase-card')).animationName"),"project-showcase-exit");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.public-projects-root .project-showcase-card')).animationDuration"),"0.42s",
    "Project card reverse motion should be slightly quicker than entrance");
  await until("document.querySelector('.public-projects-root.is-dissolving-header')",30,30);
  const dismissal=await evaluate("(()=>{const p=document.querySelector('.public-projects-root');"+
    "return {stamp:Number(p.dataset.projectHeaderDismissAt),"+
    "backAnimation:getComputedStyle(p.querySelector('.public-projects-back')).animationName,"+
    "titleAnimation:getComputedStyle(p.querySelector('.public-projects-title')).animationName,"+
    "toolbarAnimation:getComputedStyle(p.querySelector('.public-projects-toolbar')).animationName};})()");
  assert.ok(Number.isFinite(dismissal.stamp)&&dismissal.stamp>0);
  assert.equal(dismissal.backAnimation,"none");
  assert.equal(dismissal.titleAnimation,"none");
  assert.equal(dismissal.toolbarAnimation,"none");
  if(await evaluate("document.body.dataset.authGpuScene==='ready'")){
    await until("window.__dashboardWebGPU?.projectGlass?.headerDissolve?.progress>0.42",16,30);
    const decay=await evaluate("(()=>{const audit=window.__dashboardWebGPU.projectGlass;"+
      "const back=document.querySelector('.public-projects-back svg');"+
      "const filter=document.querySelector('.public-projects-filter-button svg');"+
      "return {source:audit.headerDissolve.source,progress:audit.headerDissolve.progress,"+
      "backAlpha:parseFloat(back.style.opacity),filterAlpha:parseFloat(filter.style.opacity),"+
      "canvas:document.querySelector('#dashboard-auth-glass-scene')?.isConnected};})()");
    assert.match(decay.source,/dashboard-public-dismiss\.js \/ shared WGSL optical decoherence/);
    assert.ok(decay.progress>0.42&&decay.progress<1,
      "The header's GPU material is actually dissolving before route unmount");
    assert.ok(decay.backAlpha<.95&&decay.filterAlpha<.95,
      "Back arrow and filter SVGs inherit the SAME fading icon curve as the home squares");
    assert.equal(decay.canvas,true);
  }
  await until("location.pathname==='/'&&window.__dofPublicRouter.state==='home'",190);
  assert.equal(await evaluate("document.querySelector('.public-projects-root')"),null);
  assert.equal(await evaluate("document.body.hasAttribute('data-projects-logo-hidden')"),false,
    "Unmount must clear Projects-only logo fading before the homepage returns");
  assert.equal(await evaluate("document.body.hasAttribute('data-projects-logo-pinned')"),false,
    "Unmount must remove the Projects-specific fixed logo anchor");
  await sleep(560);
  assert.ok(Number(await evaluate("getComputedStyle(document.querySelector('.cta6-bottom-action')).opacity"))>.995,
    "Bottom buttons return visibly fully opaque after the Projects reverse transition");
  // Cold /projects refresh serves the same homepage document (no clone of
  // wallpaper, logo, upper GPU canvas or global navigation).
  await send("Page.navigate",{url:origin+"/projects"});
  await until("location.pathname==='/projects'&&"+
    "document.querySelectorAll('.public-projects-root .project-showcase-card').length===16",190);
  assert.equal(await evaluate("document.body.dataset.directLogin"),"true");
  await evaluate("document.querySelector('.public-projects-back').click()");
  await until("location.pathname==='/'&&window.__dofPublicRouter.state==='home'",190);
  assert.deepEqual(misses,[],"No missing shell or lazy login assets");
  process.stdout.write("Persistent shell, lazy login card, reverse exit, browser history and direct entry verified.\\n");
}finally{
  try{socket?.close();}catch{}
  try{chrome?.kill("SIGKILL");}catch{}
  await new Promise(resolve=>server.close(resolve));
  try{rmSync(profile,{force:true,recursive:true,maxRetries:12,retryDelay:150});}
  catch(cleanupError){process.stderr.write("Chrome profile cleanup: "+String(cleanupError)+"\n");}
}
