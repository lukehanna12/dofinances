/* Public Studio gallery interaction smoke; no authentication or screenshots. */
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {existsSync,readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const pause=ms=>new Promise(r=>setTimeout(r,ms));
let binary=null;
for(const name of ["google-chrome-stable","google-chrome","chromium","chromium-browser"]){
  try{binary=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(binary,"Chrome/Chromium is required for gallery smoke");
const profile=mkdtempSync(join(tmpdir(),"dofinances-gallery-"));
const chrome=spawn(binary,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--remote-debugging-port=0","--window-size=1280,940",
  "--user-data-dir="+profile,"about:blank"],{stdio:"ignore"});
let socket;
try{
  let port=null;
  for(let i=0;i<110;i++){
    if(existsSync(join(profile,"DevToolsActivePort"))){
      port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
    }
    if(chrome.exitCode!==null)throw Error("Chrome exited unexpectedly");
    await pause(100);
  }
  assert.ok(port,"Chrome DevTools unavailable");
  const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;
  const pending=new Map();
  socket.onmessage=event=>{
    const response=JSON.parse(event.data);
    if(!response.id)return;
    const item=pending.get(response.id);
    if(!item)return;
    pending.delete(response.id);
    response.error?item.reject(Error(JSON.stringify(response.error))):item.resolve(response.result);
  };
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evalJS=async code=>{
    const r=await cmd("Runtime.evaluate",{expression:code,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error("Page script exception: "+JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const until=async(code,label)=>{
    for(let i=0;i<130;i++){
      try{if(await evalJS(code))return;}catch{}
      await pause(140);
    }
    throw Error("Timeout verifying "+label);
  };
  await cmd("Runtime.enable");
  await cmd("Page.enable");
  await cmd("Emulation.setDeviceMetricsOverride",{width:1280,height:940,deviceScaleFactor:1,mobile:false});
  await cmd("Page.navigate",{url:process.env.STUDIO_GALLERY_URL||"https://stu.dofinances.com/"});
  await until('document.readyState==="complete" && document.querySelectorAll("[data-oracle-surface]").length===5',"gallery content");
  const baseline=await evalJS('(()=>({title:document.title,scene:document.body.dataset.scene,backgroundCount:document.querySelectorAll("[data-background]").length,link:document.querySelector(".workspace-link")?.getAttribute("href"),dimensions:[...document.querySelectorAll("[data-oracle-surface]")].map(x=>[x.getBoundingClientRect().width,x.getBoundingClientRect().height])}))()');
  assert.match(baseline.title,/Liquid Glass Gallery/);
  assert.equal(baseline.scene,"design");
  assert.equal(baseline.backgroundCount,3);
  assert.equal(baseline.link,"/app/");
  assert.ok(baseline.dimensions.every(([w,h])=>w>70&&h>30));
  const changed=await evalJS('(()=>{for(const mode of ["flat","photo","design"]){document.querySelector("[data-background="+mode+"]").click();if(document.body.dataset.scene!==mode)throw Error("Scene mismatch");}document.getElementById("panel-control").click();document.getElementById("action-button").click();document.querySelector("[data-period=Week]").click();const r=document.getElementById("diffusion-range");r.value="73";r.dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("clarity-switch").click();return {expanded:document.getElementById("panel-control").getAttribute("aria-expanded"),presses:document.getElementById("action-button").dataset.presses,period:document.getElementById("period-readout").textContent,slider:document.getElementById("diffusion-output").textContent,toggle:document.getElementById("clarity-switch").getAttribute("aria-checked"),clarity:document.body.dataset.clarity,selected:document.querySelectorAll(".environment-option.is-active").length};})()');
  assert.deepEqual(changed,{expanded:"true",presses:"1",period:"This week",slider:"73%",toggle:"true",clarity:"on",selected:1});
  console.log("PASS: gallery, background modes, and all five interactive specimens");
  await cmd("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const mobile=await evalJS('(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,widths:[...document.querySelectorAll("[data-oracle-surface]")].map(x=>x.getBoundingClientRect().width)}))()');
  assert.ok(mobile.widths.every(w=>w>175&&w<=390),JSON.stringify(mobile));
  assert.ok(mobile.scroll<=mobile.viewport+2,JSON.stringify(mobile));
  console.log("PASS: responsive 390px viewport without overflow");
}finally{
  try{socket?.close();}catch{}
  try{chrome.kill("SIGTERM");}catch{}
  rmSync(profile,{recursive:true,force:true});
}
