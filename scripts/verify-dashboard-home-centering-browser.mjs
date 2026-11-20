/*
 * Actual browser geometry regression for the Dashboard Home composition.
 * Uses the production CSS and a public structural fixture (no login data).
 * A fixed-size grid must be centered, cropped, and never scaled on resize.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,mkdtempSync,existsSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";

const css=readFileSync(new URL("../sites/_apex/app/assets/dashboard-home.css",import.meta.url),"utf8");
const cells=Array.from({length:66},()=>'<div class="cta6-tile cta6-tile--plain"></div>').join("");
const html=[
 '<!doctype html><html><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1">',
 '<link rel="stylesheet" href="/dashboard-home.css">',
 '<style>html,body{margin:0;padding:0;min-height:100%;background:#0a0a0a}</style>',
 '</head><body><div id="workspace-shell"><div class="main"><div class="workspace-scroll">',
 '<main class="content"><section class="view dashboard-home" data-view="dashboard">',
 '<div class="cta6"><div id="cta6-mosaic" class="cta6-mosaic" aria-hidden="true">',
 cells,'</div><div class="cta6-center"><h1 id="dashboard-title">doof</h1></div></div>',
 '<div class="cta6-bottom-action"><a class="cta6-action" href="#projects">See Projects</a></div>',
 '</section></main></div></div></div></body></html>'
].join("");
const server=createServer((req,res)=>{
 if(req.url==="/dashboard-home.css"){
  res.writeHead(200,{"Content-Type":"text/css","Cache-Control":"no-store"});res.end(css);
 }else{
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);
 }
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
let binary;
for(const name of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
 try{binary=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=mkdtempSync(join(tmpdir(),"dof-dashboard-center-"));
let chrome=null,socket=null;
try{
 assert.ok(binary,"Chromium is required for Dashboard centering verification");
 chrome=spawn(binary,[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--no-default-browser-check",
  "--remote-debugging-port=0","--window-size=1400,900",
  "--user-data-dir="+profile,"about:blank"
 ],{stdio:"ignore"});
 let port;
 for(let i=0;i<120;i++){
  const file=join(profile,"DevToolsActivePort");
  if(existsSync(file)){port=Number(readFileSync(file,"utf8").split("\n")[0]);break;}
  if(chrome.exitCode!==null)throw Error("Chromium exited before starting");
  await delay(100);
 }
 assert.ok(port,"Chromium failed to expose DevTools");
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;
 const pending=new Map();
 socket.onmessage=event=>{
  const msg=JSON.parse(event.data),p=pending.get(msg.id);
  if(!p)return;pending.delete(msg.id);
  msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
 };
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));
 });
 const evaluate=async expression=>{
  const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error("Browser evaluation failed: "+JSON.stringify(r.exceptionDetails));
  return r.result.value;
 };
 await send("Page.enable");await send("Runtime.enable");
 // Prevent the intentional 0.85-to-1 entrance scale from contaminating
 // settled tile geometry; reduced-motion uses the production CSS fallback.
 await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
 await send("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/"});
 let ready=false;
 for(let i=0;i<120;i++){
  if(await evaluate('document.readyState==="complete" && !!document.getElementById("cta6-mosaic") && document.styleSheets.length>0')){ready=true;break;}
  await delay(50);
 }
 assert.ok(ready,"Dashboard fixture did not load");
 const expression=[
 '(()=>{',
 'const g=document.getElementById("cta6-mosaic");',
 'const t=document.getElementById("dashboard-title");',
 'const f=document.querySelector(".dashboard-home");',
 'const c=g.querySelector(".cta6-tile");',
 'const b=g.getBoundingClientRect(),r=t.getBoundingClientRect(),',
 'v=f.getBoundingClientRect(),q=c.getBoundingClientRect();',
 'return {width:innerWidth,height:innerHeight,gridWidth:b.width,gridLeft:b.left,',
 'gridCenter:b.left+b.width/2,logoCenter:r.left+r.width/2,',
 'frameCenter:v.left+v.width/2,tileWidth:q.width,tileHeight:q.height,',
 'titleFont:getComputedStyle(t).fontSize,gap:getComputedStyle(g).columnGap,',
 'radius:getComputedStyle(c).borderTopLeftRadius,scrollWidth:document.documentElement.scrollWidth};',
 '})()'
 ].join("");
 const expectedTile=(1080-10*13)/11;
 for(const [width,height] of [[1600,900],[1200,740],[1024,650],[760,680],[500,620],[360,560]]){
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const g=await evaluate(expression);
  const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<0.6,
   label+" at "+width+"x"+height+": "+actual+" vs "+expected);
  assert.equal(g.width,width);assert.equal(g.height,height);
  near(g.frameCenter,width/2,"Viewport frame center");
  near(g.gridCenter,width/2,"Mosaic center");
  near(g.logoCenter,width/2,"Doof logo center");
  near(g.gridLeft,(width-1080)/2,"Oversized grid left edge");
  near(g.gridWidth,1080,"Grid fixed width");
  near(g.tileWidth,expectedTile,"Tile width");
  near(g.tileHeight,expectedTile,"Tile height");
  assert.equal(g.titleFont,"45px","Doof must stay maximum size");
  assert.equal(g.gap,"13px","Gap must stay maximum size");
  assert.equal(g.radius,"17px","Corner radius must stay maximum size");
  assert.ok(g.scrollWidth<=width+1,"Grid must crop instead of page scrolling: "+JSON.stringify(g));
  process.stdout.write("Dashboard verified at "+width+"x"+height+"\n");
 }
}finally{
 try{socket?.close();}catch{}
 if(chrome&&chrome.exitCode===null&&chrome.signalCode===null){
  await new Promise(resolve=>{
   chrome.once("exit",resolve);
   try{chrome.kill("SIGTERM");}catch{resolve();}
   setTimeout(resolve,3000);
  });
 }
 server.close();
 // Chrome may still flush profile files after exiting. Cleanup must never
 // hide a genuine geometry assertion or fail the build by itself.
 try{rmSync(profile,{recursive:true,force:true,maxRetries:15,retryDelay:200});}
 catch(error){process.stderr.write("Dashboard Chrome profile cleanup: "+error.message+"\\n");}
}
