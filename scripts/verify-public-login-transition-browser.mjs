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
  const material=()=>{
    return "(()=>{const card=document.querySelector('[data-auth-glass-card]');"+
      "const input=card.querySelector('[data-auth-glass-input]');"+
      "const primary=card.querySelector('[data-auth-glass-submit]');"+
      "const provider=card.querySelector('[data-auth-glass-provider]');"+
      "const face=getComputedStyle(card);"+
      "return {mode:card.closest('.auth3-root').classList.contains('dark')?'dark':'light',"+
      "face:face.backgroundImage,blur:face.backdropFilter,border:face.borderTopColor,"+
      "input:getComputedStyle(input).backgroundColor,inputInk:getComputedStyle(input).color,"+
      "primary:getComputedStyle(primary).backgroundColor,"+
      "provider:getComputedStyle(provider).backgroundColor,"+
      "placeholder:getComputedStyle(input,'::placeholder').color};})()";
  };
  const darkGlass=await evaluate(material());
  assert.equal(darkGlass.mode,"dark");
  assert.equal(darkGlass.blur,"blur(8px)",
    "Clear card must sample the actual live backdrop, like the square fallback");
  assert.match(darkGlass.face,/linear-gradient/,
    "Card surface must be a neutral translucent face, not an opaque box");
  assert.ok(darkGlass.input!==darkGlass.primary &&
    darkGlass.input!==darkGlass.provider,
    "Tinted glass inputs and actions must have distinct readable roles");
  // Verify the native browser pointer actually moves the route-owned glint;
  // no image capture and no GPU wallpaper re-creation.
  const bounds=await evaluate("(()=>{const r=document.querySelector('[data-auth-glass-card]').getBoundingClientRect();"+
    "return {left:r.left,top:r.top,width:r.width,height:r.height};})()");
  await send("Input.dispatchMouseEvent",{
    type:"mouseMoved",x:bounds.left+bounds.width*.20,y:bounds.top+32
  });
  await sleep(160);
  const firstGlint=await evaluate("(()=>{const c=document.querySelector('[data-auth-glass-card]');"+
    "return {x:c.style.getPropertyValue('--auth-glass-pointer-x'),"+
    "opacity:Number(getComputedStyle(c,'::after').opacity)};})()");
  assert.ok(firstGlint.x.endsWith("%"),
    "The card's pointer-responsive glass highlight must receive real pointer coordinates");
  assert.ok(firstGlint.opacity>.1,
    "Hover must activate the card's specular light");
  await send("Input.dispatchMouseEvent",{
    type:"mouseMoved",x:bounds.left+bounds.width*.80,y:bounds.top+40
  });
  const secondGlint=await evaluate("document.querySelector('[data-auth-glass-card]')"+
    ".style.getPropertyValue('--auth-glass-pointer-x')");
  assert.ok(Number.parseFloat(secondGlint)>Number.parseFloat(firstGlint.x)+40,
    "Specular hotspot must follow pointer travel, as on the glass tiles");
  // Dark/light changes control tint and ink, NOT the clear outer face.
  await evaluate("document.getElementById('public-theme-toggle').click()");
  await until("document.documentElement.dataset.dofTheme==='light'&&"+
    "!!document.querySelector('.auth3-root:not(.dark)')",50);
  // Glass control tints crossfade for 180ms. Compare their fully settled
  // appearance instead of the first style flush after React updates mode.
  await sleep(260);
  const lightGlass=await evaluate(material());
  assert.equal(lightGlass.face,darkGlass.face,
    "Dark and light modes must have the identical untinted card face");
  assert.equal(lightGlass.blur,darkGlass.blur);
  for(const field of ["input","primary","provider","inputInk","placeholder"]){
    assert.notEqual(lightGlass[field],darkGlass[field],
      "Mode toggle must change the tinted control "+field);
  }
  const focused=await evaluate("(()=>{const i=document.querySelector('[data-auth-glass-input]');"+
    "i.focus();return {focused:document.activeElement===i,"+
    "outline:getComputedStyle(i).outlineWidth,bg:getComputedStyle(i).backgroundColor};})()");
  assert.equal(focused.focused,true);
  assert.ok(Number.parseFloat(focused.outline)>=2,
    "Focused tinted inputs retain an accessible ring");
  await evaluate("document.getElementById('public-theme-toggle').click()");
  await until("document.documentElement.dataset.dofTheme==='dark'&&"+
    "!!document.querySelector('.auth3-root.dark')",50);
  // Clicking the card-owned back arrow reverses the card's 600ms Motion
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
  await sleep(570);
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
