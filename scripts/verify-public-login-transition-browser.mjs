/*
 * DOM-only cross-document handoff probe. No screenshot/recording.
 * Runs on the production Vite output after npm run build. Checks that the
 * browser keeps the departing page painted during navigation and that the
 * incoming image, overlay and viewport crop align with WebGPU Home.
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
assert.ok(existsSync(join(dist,"index.html")),"Build the Vite login first");
const mime={".html":"text/html; charset=utf-8",".css":"text/css",
  ".js":"text/javascript",".avif":"image/avif",".svg":"image/svg+xml",
  ".wgsl":"text/plain"};
const misses=[];
const server=createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  let target;
  if(pathname==="/login"||pathname==="/login/")target=join(dist,"index.html");
  else if(pathname==="/")target=join(apex,"index.html");
  else if(pathname.startsWith("/assets/home-dashboard/")||
      pathname==="/assets/site-foundation.css"||
      pathname.startsWith("/assets/public-"))target=resolve(apex,"."+pathname);
  else if(pathname.startsWith("/assets/"))target=resolve(dist,"."+pathname);
  else target=resolve(apex,"."+pathname);
  if(!target.startsWith(apex+"/")&&!target.startsWith(dist+"/")){
    res.writeHead(403);res.end();return;
  }
  try{
    const body=readFileSync(target);
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
    "window.__handoff={seen:false,hasTransition:false};"+
    "addEventListener('pagereveal',e=>{window.__handoff.seen=true;"+
    "window.__handoff.hasTransition=!!e.viewTransition;});"});
  await send("Emulation.setEmulatedMedia",
    {features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
  const origin="http://127.0.0.1:"+server.address().port;
  await send("Page.navigate",{url:origin+"/"});
  let ready=false;
  for(let i=0;i<150;i++){
    ready=await evaluate("document.querySelectorAll('#cta6-mosaic>.cta6-tile').length===66");
    if(ready)break;
    await sleep(60);
  }
  assert.ok(ready,"Homepage squares did not mount");
  const homeTop=await evaluate("document.querySelector('#global-menu').getBoundingClientRect().bottom");
  assert.equal(homeTop,44,"Public WebGPU scene begins below the 44px bar");
  await evaluate("document.querySelector('.cta6-bottom-action a[href=\"/login\"]').click()");
  let entered=false;
  for(let i=0;i<160;i++){
    entered=await evaluate("location.pathname==='/login' && !!document.querySelector('.auth3-root form')");
    if(entered)break;
    await sleep(70);
  }
  assert.ok(entered,"Sign in card did not mount on /login");
  const scene=await evaluate("(()=>{"+
    "const image=document.querySelector('[data-auth-scene=photo]');"+
    "const veil=document.querySelector('[data-auth-scene=veil]');"+
    "const rect=image.getBoundingClientRect();"+
    "const underlay=getComputedStyle(document.body,'::before');"+
    "const imageStyle=getComputedStyle(image);"+
    "return {viewportHeight:innerHeight,rect:{top:rect.top,bottom:rect.bottom,width:rect.width},"+
    "veilTop:veil.getBoundingClientRect().top,"+
    "veilBackground:getComputedStyle(veil).backgroundColor,"+
    "image: imageStyle.backgroundImage,cover:imageStyle.backgroundSize,"+
    "underlayTop:underlay.top,underlayImage:underlay.backgroundImage,"+
    "underlayCover:underlay.backgroundSize,"+
    "preload:!!document.querySelector('link[rel=preload][as=image]'),"+
    "handoff:window.__handoff};})()");
  assert.equal(scene.rect.top,homeTop,"Photo must not reframe on sign-in");
  assert.equal(scene.rect.bottom,scene.viewportHeight,"Photo must extend to viewport bottom");
  assert.equal(scene.veilTop,homeTop,"12% overlay must share the same crop");
  assert.match(scene.image,/dashboard-cloud-veiled-colorful-fields\.avif/);
  assert.equal(scene.cover,"cover");
  assert.equal(scene.underlayTop,"44px");
  assert.equal(scene.underlayCover,"cover, cover");
  assert.match(scene.underlayImage,/dashboard-cloud-veiled-colorful-fields\.avif/);
  assert.equal(scene.preload,true,"Image must begin loading before React");
  assert.equal(scene.handoff.seen,true,"Incoming page must receive pagereveal");
  assert.equal(scene.handoff.hasTransition,true,
    "Cross-document view transition must hold outgoing frame");
  assert.deepEqual(misses,[],"No missing transition or login assets");
  process.stdout.write("Home -> sign-in route handoff, photo crop and view transition verified.\n");
}finally{
  try{socket?.close();}catch{}
  try{chrome?.kill("SIGKILL");}catch{}
  await new Promise(resolve=>server.close(resolve));
  rmSync(profile,{force:true,recursive:true});
}
