/*
 * Browser-level smoke for the PUBLIC, static Studio preview.
 * Unlike source-regex tests, this checks the real computed cursor and
 * header geometry after the Cloudflare Pages deployment.
 * No account operations; Chrome's temporary profile is deleted.
 */
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {existsSync,readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const binaries=["google-chrome-stable","google-chrome","chromium","chromium-browser"];
let executable=null;
for(const name of binaries){
  try{executable=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(executable,"Chromium or Chrome is required to validate computed hover cursors");
const profile=mkdtempSync(join(tmpdir(),"dofinances-sidebar-check-"));
const chrome=spawn(executable,[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
  "--window-size=1000,860","--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let socket=null;
try{
  let port=null;
  for(let attempt=0;attempt<120;attempt++){
    if(existsSync(join(profile,"DevToolsActivePort"))){
      port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);
      break;
    }
    if(chrome.exitCode!==null)throw Error("Chrome exited before starting");
    await pause(100);
  }
  assert.ok(port,"Chrome DevTools did not become ready");
  const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;
  const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(!message.id)return;
    const handlers=pending.get(message.id);
    if(!handlers)return;
    pending.delete(message.id);
    message.error?handlers.reject(new Error(JSON.stringify(message.error))):handlers.resolve(message.result);
  };
  const command=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;
    pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await command("Runtime.evaluate",{
      expression,returnByValue:true,awaitPromise:true
    });
    if(result.exceptionDetails)throw new Error("Page script failed: "+JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until=async(expression,label,limit=18000)=>{
    const start=Date.now();
    while(Date.now()-start<limit){
      try{const value=await evaluate(expression);if(value)return value;}catch{}
      await pause(130);
    }
    throw new Error("Timed out waiting for "+label);
  };
  const metrics=async(width,height)=>command("Emulation.setDeviceMetricsOverride",{
    width,height,deviceScaleFactor:1,mobile:false
  });
  const move=async(x,y)=>command("Input.dispatchMouseEvent",{type:"mouseMoved",x,y});
  const down=async(x,y)=>command("Input.dispatchMouseEvent",{
    type:"mousePressed",x,y,button:"left",clickCount:1
  });
  const up=async(x,y)=>command("Input.dispatchMouseEvent",{
    type:"mouseReleased",x,y,button:"left",clickCount:1
  });

  await command("Runtime.enable");
  await command("Page.enable");
  await metrics(900,820);
  await command("Page.navigate",{url:"https://stu.dofinances.com/app/"});
  await until('document.readyState==="complete" && !!document.querySelector("#workspace-shell.liquid-glass-preview")',"Studio glass initialization",25000);
  await until('document.querySelector("#workspace-shell").classList.contains("is-compact-rail")',"responsive compact rail");
  const blank=await evaluate(String.raw`(()=>{
    const sidebar=document.getElementById("workspace-sidebar");
    const r=sidebar.getBoundingClientRect();
    for(const dy of [210,260,320,400,500]){
      for(const dx of [20,37,55]){
        const x=r.left+dx,y=r.top+dy;
        if(y>=r.bottom-10)continue;
        const el=document.elementFromPoint(x,y);
        if(el && sidebar.contains(el) && !el.closest("a,button,input,[role=separator]"))
          return {x,y,cursor:getComputedStyle(el).cursor,tag:el.tagName};
      }
    }
    return null;
  })()`);
  assert.ok(blank,"No hit-testable unoccupied rail space found");
  assert.equal(blank.cursor,"e-resize","Empty collapsed rail must show the expand cursor");
  await move(blank.x,blank.y);
  await until('document.querySelector(".sidebar-interaction-tooltip")?.dataset.visible==="true"',"expand hover tooltip");
  await down(blank.x,blank.y);await up(blank.x,blank.y);
  await until('document.querySelector("#workspace-shell").classList.contains("is-rail-expanded")',"click expansion");
  await until('!document.querySelector("#workspace-shell").classList.contains("is-sidebar-toggling")',"expanded header settle");
  const header=await evaluate(String.raw`(()=>{
    const head=document.querySelector(".sidebar-head");
    const logo=document.querySelector(".sidebar-head .mark").getBoundingClientRect();
    const toggle=document.querySelector(".sidebar-head .sidebar-toggle").getBoundingClientRect();
    const grip=document.getElementById("sidebar-resize-handle");
    const g=grip.getBoundingClientRect(),s=document.querySelector(".sidebar").getBoundingClientRect();
    return {
      layout:getComputedStyle(head).display,
      logoRight:logo.right,toggleLeft:toggle.left,
      gripCursor:getComputedStyle(grip).cursor,
      gripDisplay:getComputedStyle(grip).display,
      gripCenter:g.left+g.width/2,gripY:g.top+Math.min(110,g.height/2),
      sidebarRight:s.right,sidebarHeight:s.height
    };
  })()`);
  assert.equal(header.layout,"grid","Expanded logo/toggle must use separate grid cells");
  assert.ok(header.toggleLeft-header.logoRight>=6,
    "D logo and expanded toggle overlap: "+JSON.stringify(header));
  assert.equal(header.gripCursor,"ew-resize","Visible grip must have two-way resize cursor");
  assert.notEqual(header.gripDisplay,"none","Resize grip should be visible in expanded compact rail");
  assert.ok(Math.abs(header.gripCenter-header.sidebarRight)<2,
    "The 28px hover target must straddle the actual sidebar edge");
  await move(header.gripCenter,header.gripY);
  await until('document.querySelector(".sidebar-interaction-tooltip")?.textContent?.includes("Drag to resize")',"grip hover tooltip");
  const startWidth=await evaluate('Math.round(document.querySelector(".sidebar").getBoundingClientRect().width)');
  await down(header.gripCenter,header.gripY);
  for(let step=1;step<=5;step++){
    await move(header.gripCenter+step*10,header.gripY);
    await pause(35);
  }
  await up(header.gripCenter+50,header.gripY);
  await until('Math.round(document.querySelector(".sidebar").getBoundingClientRect().width)>='+String(startWidth+40),"dragged width response");
  const before=await evaluate('Math.round(document.querySelector(".sidebar").getBoundingClientRect().height)');
  await metrics(900,680);
  await until('Math.round(document.querySelector(".sidebar").getBoundingClientRect().height)<'+String(before-100),"vertical sidebar resizing");
  console.log("PASS: rail expand cursor, hover tooltip, external drag cursor, no D/toggle overlap, horizontal and vertical resizing");
} finally {
  try{socket?.close();}catch{}
  chrome.kill("SIGKILL");
  await pause(300);
  try{rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:200});}
  catch(error){console.warn("Temporary Chrome profile cleanup:",String(error));}
}
