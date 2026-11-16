import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {join} from "node:path";
import {tmpdir} from "node:os";
const pause=t=>new Promise(r=>setTimeout(r,t));
const styles=["/app/assets/dashboard.css","/assets/site-foundation.css",
"/app/assets/workspace-theme.css","/app/assets/workspace-wallpapers.css",
"/app/assets/workspace-enhancements.css","/app/assets/diagnostics.css",
"/app/assets/providers.css"];
const html=['<!doctype html><html><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
...styles.map(s=>'<link rel="stylesheet" href="'+s+'">'),
'</head><body><div id="workspace-shell" class="shell liquid-glass-preview">',
'<aside id="workspace-sidebar" class="sidebar"><div class="sidebar-head"></div>',
'<div class="sidebar-navigation"><nav id="project-navigation" class="nav-stack">',
'<a id="regular" class="nav-link" href="#collections"><span class="nav-icon"></span><span class="nav-label">Collections</span></a>',
'<a class="nav-link" data-providers-toggle href="#providers" aria-expanded="true"><span class="nav-icon"></span><span class="nav-label">Providers</span></a>',
'<div id="providers-subnavigation" class="pv-provider-subnav">',
...["Local","External","Credentials"].map(x=>'<a class="nav-link pv-provider-child" href="#'+x+'">'+x+'</a>'),
'</div></nav></div></aside><div class="main"><div class="content">',
'<div id="diagnostics-root"><span class="dg-status" id="dg-health" data-health="healthy" data-checking="true">',
'<span class="dg-dot"></span><span>Checking...</span></span></div>',
'<div id="pv-root" data-mode="local"><span class="pv-provider-mark" data-state="available"></span>',
'<div class="pv-provision-mcp" data-kind="skills"><div class="pv-provision-protocol-item">',
'<code>skills/android-emulator/SKILL.md</code></div></div></div>',
'</div></div></div></body></html>'].join("");
const server=createServer((req,res)=>{
 const path=req.url?.split("?")[0]||"/";
 if(path==="/"){res.writeHead(200,{"Content-Type":"text/html"});res.end(html);return;}
 if(!styles.includes(path)){res.writeHead(404);res.end();return;}
 const base=path.startsWith("/app/assets/")?
 new URL("../sites/_apex/app/assets/",import.meta.url):
 new URL("../sites/_apex/assets/",import.meta.url);
 res.writeHead(200,{"Content-Type":"text/css","Cache-Control":"no-store"});
 res.end(readFileSync(new URL(path.split("/").at(-1),base)));
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
let chromeExe;
for(const n of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
 try{chromeExe=execFileSync("which",[n],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(chromeExe,"Chromium required");
const profile=mkdtempSync(join(tmpdir(),"sidebar-olive-pulse-"));
const chrome=spawn(chromeExe,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
"--no-first-run","--remote-debugging-port=0","--window-size=1440,900",
"--user-data-dir="+profile,"about:blank"],{stdio:["ignore","ignore","pipe"]});
let stderr="",socket;
chrome.stderr.on("data",d=>{stderr=(stderr+String(d)).slice(-4000);});
try{
 let port=0;
 for(let i=0;i<150;i++){
  if(existsSync(join(profile,"DevToolsActivePort"))){
   port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
  }
  if(chrome.exitCode!==null)throw Error("Chrome exited "+stderr);
  await pause(100);
 }
 assert.ok(port,"Chromium debugging port unavailable: "+stderr);
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const jobs=new Map();
 socket.onmessage=e=>{
  const value=JSON.parse(e.data);if(!value.id)return;
  const job=jobs.get(value.id);if(!job)return;jobs.delete(value.id);
  value.error?job.reject(Error(JSON.stringify(value.error))):job.resolve(value.result);
 };
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const key=++id;jobs.set(key,{resolve,reject});
  socket.send(JSON.stringify({id:key,method,params}));
 });
 const evaluate=async expression=>{
  const out=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw Error(JSON.stringify(out.exceptionDetails));
  return out.result.value;
 };
 const probe='(()=>{const sb=document.getElementById("workspace-sidebar"),r=document.getElementById("regular"),sub=document.getElementById("providers-subnavigation"),dot=document.querySelector("#dg-health .dg-dot"),line=sub.getBoundingClientRect().left+parseFloat(getComputedStyle(sub,"::before").left);return {regularInset:r.getBoundingClientRect().left-sb.getBoundingClientRect().left,gaps:[...sub.querySelectorAll(".pv-provider-child")].map(x=>x.getBoundingClientRect().left-line),animation:getComputedStyle(dot).animationName,health:getComputedStyle(dot).backgroundColor,provider:getComputedStyle(document.querySelector(".pv-provider-mark")).backgroundColor,skill:getComputedStyle(document.querySelector(".pv-provision-protocol-item code")).color}})()';
 await call("Runtime.enable");await call("Page.enable");
 await call("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/"});
 for(const [width,state] of [[1440,"desktop"],[1000,"tablet"],[600,"mobile"]]){
  await call("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
  const flags=state==="tablet"?" is-compact-rail is-rail-expanded":state==="mobile"?" is-mobile-open":"";
  await evaluate('document.getElementById("workspace-shell").className='+JSON.stringify("shell liquid-glass-preview"+flags));
  await pause(80);
  const result=await evaluate(probe);
  assert.equal(result.gaps.length,3);
  for(const g of result.gaps)assert.ok(Math.abs(g-result.regularInset)<=.7,
   state+" left inset "+g+" vs "+result.regularInset);
  assert.equal(result.animation,"dg-health-pulse");
  assert.equal(result.health,"rgb(48, 209, 88)");
  assert.equal(result.provider,result.health);
  assert.equal(result.skill,"rgb(85, 164, 123)");
  await evaluate('document.getElementById("dg-health").dataset.checking="false"');
  assert.equal((await evaluate(probe)).animation,"none");
  await evaluate('document.getElementById("dg-health").dataset.checking="true"');
  assert.equal((await evaluate(probe)).animation,"dg-health-pulse");
  console.log(state+" inset, three child links, evergreen palette, and loading-only pulse PASS",JSON.stringify(result));
 }
}finally{
 socket?.close();chrome.kill("SIGTERM");
 await new Promise(r=>server.close(r));
 try{rmSync(profile,{recursive:true,force:true});}catch{}
}