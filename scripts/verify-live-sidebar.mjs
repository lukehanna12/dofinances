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
        // A real full-rail button must win blank-space hit testing,
        // even though the icon links above it remain independently clickable.
        if(el?.id==="sidebar-rail-expand-target")
          return {x,y,cursor:getComputedStyle(el).cursor,tag:el.tagName,id:el.id};
      }
    }
    return null;
  })()`);
  assert.ok(blank,"No hit-testable unoccupied rail space found");
  assert.equal(blank.tag,"BUTTON","Blank rail must be an actual button hit target");
  assert.equal(blank.cursor,"e-resize","The hovered rail button must show the native expand cursor");
  const noCustomCursors=await evaluate(String.raw`(()=>{
    const css=[...document.styleSheets].flatMap(s=>{
      try{return [...s.cssRules].map(r=>r.cssText)}catch{return []}
    }).filter(rule=>rule.includes("sidebar-rail-expand-target")||rule.includes("sidebar-resize-handle"));
    return !css.some(rule=>rule.includes("data:image/png;base64"));
  })()`);
  assert.equal(noCustomCursors,true,"No custom mouse pointer graphics should be installed");
  // The rail's icon and row should both center on the actual pane, not an
  // asymmetrically padded grid track.
  const railAlignment=await evaluate(String.raw`(()=>{
    const side=document.querySelector(".sidebar").getBoundingClientRect();
    const row=document.querySelector(".nav-link:not([hidden])");
    const r=row.getBoundingClientRect(),i=row.querySelector(".nav-icon").getBoundingClientRect();
    return {rowX:r.left+r.width/2,iconX:i.left+i.width/2,
      sidebarX:side.left+side.width/2,rowY:r.top+r.height/2,
      iconY:i.top+i.height/2};
  })()`);
  assert.ok(Math.abs(railAlignment.rowX-railAlignment.sidebarX)<2,
    "Collapsed nav button is not horizontally centered: "+JSON.stringify(railAlignment));
  assert.ok(Math.abs(railAlignment.iconX-railAlignment.rowX)<2,
    "Collapsed icon is not centered in its button: "+JSON.stringify(railAlignment));
  assert.ok(Math.abs(railAlignment.iconY-railAlignment.rowY)<2,
    "Collapsed icon is not vertically centered: "+JSON.stringify(railAlignment));
  // This specifically tests the user's observed regression: a hand cursor
  // should apply to a real link, then revert to the rail's right-arrow cursor
  // when the pointer returns to blank space after the click.
  const linkCenter=await evaluate(String.raw`(()=>{
    const link=document.querySelector('#main-navigation .nav-link[data-route="projects"]');
    const r=link.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  await move(linkCenter.x,linkCenter.y);
  const linkCursor=await evaluate(String.raw`(()=>{
    const p=document.elementFromPoint(0,0);
    return getComputedStyle(document.querySelector('#main-navigation .nav-link[data-route="projects"]')).cursor;
  })()`);
  assert.equal(linkCursor,"pointer","Real nav links should retain the hand cursor");
  await down(linkCenter.x,linkCenter.y);await up(linkCenter.x,linkCenter.y);
  await move(blank.x,blank.y);
  const afterLinkCursor=await evaluate(`getComputedStyle(document.elementFromPoint(${blank.x},${blank.y})).cursor`);
  assert.equal(afterLinkCursor,"e-resize",
    "After clicking a link, blank rail space must return to the expand cursor");
  await until('document.querySelector(".sidebar-interaction-tooltip")?.dataset.visible==="true"',"expand hover tooltip after link navigation");
  const beforeClick=await evaluate(String.raw`(()=>{
    const e=document.elementFromPoint(0,0);
    return {target:e?.id,outer:e?.outerHTML?.slice(0,200),
      collapsed:document.getElementById("workspace-shell").classList.contains("is-collapsed"),
      expanded:document.getElementById("workspace-shell").classList.contains("is-rail-expanded"),
      overlayHidden:document.getElementById("sidebar-rail-expand-target").hidden};
  })()`);
  await evaluate(`window.__railEvents=[];for(const k of ["pointerdown","pointerup","mousedown","mouseup","click"]){document.addEventListener(k,e=>window.__railEvents.push({type:k,id:e.target.id,tag:e.target.tagName,phase:e.eventPhase}),{capture:true,once:true})}`);
  await down(blank.x,blank.y);await up(blank.x,blank.y);
  await pause(120);
  const afterClick=await evaluate('({events:window.__railEvents,classes:document.querySelector("#workspace-shell").className,overlayHidden:document.querySelector("#sidebar-rail-expand-target").hidden})');
  console.log("RAIL DEBUG before",JSON.stringify(beforeClick),"after",JSON.stringify(afterClick));
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
  const linkGeometry=await evaluate(String.raw`(()=>{
    const shell=document.querySelector(".sidebar").getBoundingClientRect();
    return [...document.querySelectorAll(".sidebar-navigation .nav-link")]
      .filter(link=>link.getClientRects().length).map(link=>{
        const row=link.getBoundingClientRect();
        const icon=link.querySelector(".nav-icon").getBoundingClientRect();
        return {route:link.getAttribute("data-route"),
          rowX:row.left+row.width/2,sidebarX:shell.left+shell.width/2,
          iconY:icon.top+icon.height/2,rowY:row.top+row.height/2};
      });
  })()`);
  assert.ok(linkGeometry.length>=3,"No visible sidebar links");
  for(const item of linkGeometry){
    assert.ok(Math.abs(item.rowX-item.sidebarX)<2,
      "Row not centered in sidebar: "+JSON.stringify(item));
    assert.ok(Math.abs(item.iconY-item.rowY)<2,
      "Icon not vertically centered in its button: "+JSON.stringify(item));
  }
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
