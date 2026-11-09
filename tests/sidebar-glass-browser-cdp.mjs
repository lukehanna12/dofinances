// CI-only Chrome DevTools Protocol: verify actual backdrop pixels, not CSS declarations.
// Test captures are kept in memory and are never published or retained.
import {spawn} from "node:child_process";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {inflateSync} from "node:zlib";
import {setTimeout as sleep} from "node:timers/promises";

const profile=mkdtempSync(join(process.env.RUNNER_TEMP||tmpdir(),"sidebar-cdp-"));
const chrome=spawn("google-chrome",[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--disable-background-networking","--no-first-run","--no-default-browser-check",
  "--enable-webgl","--enable-unsafe-swiftshader","--ignore-gpu-blocklist",
  "--disable-background-timer-throttling","--disable-renderer-backgrounding",
  "--remote-allow-origins=*","--remote-debugging-port=0",
  "--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let socket=null,nextId=0,lastProbe=null;
const pending=new Map();
function assert(condition,message){if(!condition)throw Error(message);}
async function until(fn,ms=30000){
  const deadline=Date.now()+ms;
  let error;
  while(Date.now()<deadline){
    try{const v=await fn();if(v)return v;}catch(e){error=e;}
    await sleep(160);
  }
  throw Error("Timeout: "+(error?.message||JSON.stringify(lastProbe)||"no result"));
}
async function connect(url){
  return new Promise((resolve,reject)=>{
    const w=new WebSocket(url);
    const timer=setTimeout(()=>reject(Error("CDP connection timeout")),12000);
    w.addEventListener("open",()=>{clearTimeout(timer);resolve(w);},{once:true});
    w.addEventListener("error",()=>{
      clearTimeout(timer);reject(Error("CDP websocket connection error"));
    },{once:true});
  });
}
function initCDP(w){
  w.addEventListener("message",event=>{
    let j;
    try{j=JSON.parse(event.data);}catch{return;}
    if(!j.id)return;
    const p=pending.get(j.id);
    if(!p)return;
    pending.delete(j.id);clearTimeout(p.timer);
    if(j.error)p.reject(Error(j.error.message||JSON.stringify(j.error)));
    else p.resolve(j.result||{});
  });
}
function send(method,params={},timeout=45000){
  const id=++nextId;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      pending.delete(id);reject(Error("CDP "+method+" timed out"));
    },timeout);
    pending.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const response=await send("Runtime.evaluate",{expression,returnByValue:true},60000);
  if(response.exceptionDetails)throw Error("Browser JS: "+
    (response.exceptionDetails.text||JSON.stringify(response.exceptionDetails)));
  return response.result?.value;
}
function decodePNG(base64){
  const b=Buffer.from(base64,"base64");
  assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),"PNG signature");
  let w,h,depth,kind;const parts=[];
  for(let i=8;i<b.length;){
    const len=b.readUInt32BE(i),type=b.toString("ascii",i+4,i+8);
    const value=b.subarray(i+8,i+8+len);
    if(type==="IHDR"){w=value.readUInt32BE(0);h=value.readUInt32BE(4);depth=value[8];kind=value[9];}
    if(type==="IDAT")parts.push(value);
    if(type==="IEND")break;
    i+=len+12;
  }
  assert(depth===8&&(kind===2||kind===6),"Unexpected Chrome PNG encoding "+kind);
  const channels=kind===2?3:4,stride=w*channels,raw=inflateSync(Buffer.concat(parts));
  const decoded=Buffer.alloc(stride*h);
  const paeth=(a,b,c)=>{
    const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
    return da<=db&&da<=dc?a:db<=dc?b:c;
  };
  let cursor=0;
  for(let y=0;y<h;y++){
    const filter=raw[cursor++],pos=y*stride,prev=(y-1)*stride;
    for(let i=0;i<stride;i++){
      const value=raw[cursor++];
      const a=i>=channels?decoded[pos+i-channels]:0;
      const up=y?decoded[prev+i]:0;
      const c=y&&i>=channels?decoded[prev+i-channels]:0;
      const add=filter===0?0:filter===1?a:filter===2?up:
        filter===3?Math.floor((a+up)/2):filter===4?paeth(a,up,c):NaN;
      assert(Number.isFinite(add),"Unsupported PNG filter "+filter);
      decoded[pos+i]=(value+add)&255;
    }
  }
  return {w,h,channels,pixels:decoded};
}
function comparePixels(a,b,left,right,top,bottom){
  assert(a.w===b.w&&a.h===b.h&&a.channels===b.channels,"Pixel shapes differ");
  let total=0,different=0,sum=0,max=0;
  for(let y=top;y<Math.min(bottom,a.h);y++)for(let x=left;x<Math.min(right,a.w);x++){
    const offset=(y*a.w+x)*a.channels;
    const delta=(Math.abs(a.pixels[offset]-b.pixels[offset])+
      Math.abs(a.pixels[offset+1]-b.pixels[offset+1])+
      Math.abs(a.pixels[offset+2]-b.pixels[offset+2]))/3;
    sum+=delta;max=Math.max(max,delta);total++;
    if(delta>=2)different++;
  }
  return {total,different,mean:sum/total,max};
}
try{
  assert(typeof WebSocket==="function","Node 22 WebSocket not available");
  const portFile=join(profile,"DevToolsActivePort");
  const port=await until(()=>existsSync(portFile)&&
    readFileSync(portFile,"utf8").split("\n")[0],22000);
  const tab=await until(async()=>{
    const response=await fetch("http://127.0.0.1:"+port+"/json/list");
    const tabs=await response.json();
    return tabs.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
  });
  socket=await connect(tab.webSocketDebuggerUrl);
  initCDP(socket);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia",{
    features:[{name:"prefers-reduced-motion",value:"reduce"}]
  });
  for(const [width,height]of [[1440,900],[980,760],[390,844]]){
    await send("Emulation.setDeviceMetricsOverride",{
      width,height,deviceScaleFactor:1,mobile:false
    });
    await send("Page.navigate",{url:"http://127.0.0.1:8765/app/"});
    const state=await until(async()=>{
      const r=await evaluate('(()=>{'+
        'const root=document.documentElement;if(!root)return null;'+
        'return {status:root.getAttribute("data-glass-browser-smoke"),'+
        'info:root.getAttribute("data-glass-browser-info"),'+
        'ready:document.readyState,'+
        'wall:getComputedStyle(document.body,"::before").backgroundImage,'+
        'filter:document.getElementById("workspace-shell")?.classList.contains("has-oracle-backdrop")};'+
        '})()');
      if(r)lastProbe=r;
      return r&&(r.status==="pass"||r.status==="fail")?r:null;
    },90000);
    assert(state.status==="pass","Browser smoke failed: "+JSON.stringify(state));
    assert(state.filter,"Advanced backdrop inactive at "+width);
    assert(state.wall&&state.wall!=="none","Shared page wallpaper missing at "+width);
    console.log("CDP viewport verified",width,height,state.info);
    if(width===1440){
      // Performance baseline only. Preserve the exact oracle filter and
      // compare against blur-only as a diagnostic, not a promoted fallback.
      await send("Performance.enable");
      for(const mode of ["oracle","blur-only"]){
        await evaluate('document.getElementById("ci-perf-filter")?.remove()');
        if(mode==="blur-only"){
          await evaluate('(()=>{const s=document.createElement("style");'+
            's.id="ci-perf-filter";'+
            's.textContent=".shell.liquid-glass-preview.has-oracle-backdrop .sidebar {'+
            'backdrop-filter:blur(var(--oracle-backdrop-blur)) !important;'+
            '-webkit-backdrop-filter:blur(var(--oracle-backdrop-blur)) !important;}";'+
            'document.head.append(s);return true;})()');
        }
        await sleep(240);
        await evaluate(`(()=>{
          const gaps=[];let last=0;const start=performance.now();
          const toggle=document.getElementById("sidebar-toggle");
          const shell=document.getElementById("workspace-shell");
          function frame(t){
            if(last)gaps.push(t-last);last=t;
            if(t-start<1200)requestAnimationFrame(frame);
            else{
              const sorted=gaps.toSorted((a,b)=>a-b);
              window.__glassPerf={
                frames:gaps.length,
                median:sorted[Math.floor(sorted.length*.5)],
                p95:sorted[Math.floor(sorted.length*.95)],
                worst:sorted.at(-1),
                stalls34:gaps.filter(x=>x>34).length,
                stalls50:gaps.filter(x=>x>50).length,
                fieldBuilds:Number(shell.dataset.oracleFieldBuilds||0),
                cacheHits:Number(shell.dataset.oracleFieldCacheHits||0)
              };
            }
          }
          window.__glassPerf=null;
          requestAnimationFrame(frame);
          setTimeout(()=>toggle.click(),60);
          setTimeout(()=>toggle.click(),390);
          return true;
        })()`);
        const result=await until(()=>evaluate("window.__glassPerf||null"),10000);
        assert(await evaluate('document.getElementById("workspace-sidebar").getBoundingClientRect().width>250'),
          "Desktop performance test must restore expanded width");
        console.log("SIDEBAR_MOTION_CONTROL",JSON.stringify({mode,...result}));
      }
      await evaluate('document.getElementById("ci-perf-filter")?.remove()');
      await send("Emulation.setEmulatedMedia",{features:[
        {name:"prefers-reduced-motion",value:"reduce"}]});
      await sleep(180);
    }
    if(width===390){
      // CDP pointer events expose hit-testing and disabled overlays that
      // programmatic .click() cannot detect.
      async function physicalClick(selector){
        const expression="(()=>{const e=document.querySelector("+JSON.stringify(selector)+");"+
          "if(!e)return null;const r=e.getBoundingClientRect();"+
          "const x=e.id==='sidebar-scrim'?Math.round((274+innerWidth)/2):Math.round(r.left+r.width/2);const y=Math.round(r.top+r.height/2);"+
          "const h=document.elementFromPoint(x,y);"+
          "return {x,y,hit:h?.id||h?.className?.baseVal||h?.className||h?.tagName,"+
          "onTarget:h===e||e.contains(h),disabled:!!e.disabled};})()";
        const p=await evaluate(expression);
        assert(p&&p.onTarget&&!p.disabled,"Pointer target blocked: "+selector+" "+JSON.stringify(p));
        await send("Input.dispatchMouseEvent",{type:"mousePressed",x:p.x,y:p.y,button:"left",clickCount:1});
        await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:p.x,y:p.y,button:"left",clickCount:1});
        await sleep(300);
      }
      const open=await evaluate('document.getElementById("workspace-shell").classList.contains("is-mobile-open")');
      assert(!open,"Smoke leaves mobile drawer closed");
      await physicalClick("#mobile-nav-toggle");
      assert(await evaluate('document.getElementById("workspace-shell").classList.contains("is-mobile-open")'),
        "Real pointer must open mobile drawer");
      const mask=await evaluate('(()=>{const s=document.getElementById("sidebar-scrim");const css=getComputedStyle(s);return {hidden:s.hidden,disabled:s.disabled,opacity:css.opacity,clip:css.clipPath};})()');
      assert(!mask.hidden&&!mask.disabled&&mask.opacity==="1"&&mask.clip.includes("274px"),
        "Scrim must be enabled, opaque to pointer events, and excluded from sampled sidebar "+JSON.stringify(mask));
      // Compare actual rendered backdrop pixels with the dismissal scrim
      // confined outside the pane versus incorrectly painted beneath it.
      // This checks mobile darkening as an integration effect, not as
      // scientific evidence for Apple's final output-color operator.
      const clipped=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      await evaluate('(()=>{const s=document.getElementById("sidebar-scrim");s.style.clipPath="none";s.style.webkitClipPath="none";return true;})()');
      await sleep(260);
      const overlapped=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      const dimming=comparePixels(clipped,overlapped,45,260,140,730);
      console.log("MOBILE_SCRIM_BACKDROP_OVERLAP_DIFF",JSON.stringify(dimming));
      await evaluate('(()=>{const s=document.getElementById("sidebar-scrim");s.style.removeProperty("clip-path");s.style.removeProperty("-webkit-clip-path");return true;})()');
      assert(dimming.different>250,
        "Removing scrim overlap must measurably affect actual glass pixels");
      await physicalClick('#main-navigation .nav-link[data-route="settings"]');
      assert(await evaluate('location.hash==="#settings"&& !document.getElementById("workspace-shell").classList.contains("is-mobile-open")'),
        "Real pointer must navigate and close mobile drawer");
      await physicalClick("#mobile-nav-toggle");
      await physicalClick("#sidebar-toggle");
      assert(!await evaluate('document.getElementById("workspace-shell").classList.contains("is-mobile-open")'),
        "Real pointer on sidebar close button must dismiss mobile drawer");
      await physicalClick("#mobile-nav-toggle");
      await physicalClick("#sidebar-scrim");
      assert(!await evaluate('document.getElementById("workspace-shell").classList.contains("is-mobile-open")'),
        "Real pointer outside drawer must dismiss via scrim");
      console.log("MOBILE_PHYSICAL_POINTER_NAV_CLOSE_AND_SCRIM_PASSED");
    }
    if(width===1440){
      const full=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      await evaluate('(()=>{'+
        'const s=document.createElement("style");'+
        's.id="ci-compare-blur";'+
        's.textContent=".shell.liquid-glass-preview.has-oracle-backdrop .sidebar {'+
        'backdrop-filter:blur(var(--oracle-backdrop-blur)) !important;'+
        '-webkit-backdrop-filter:blur(var(--oracle-backdrop-blur)) !important;}";'+
        'document.head.append(s);return true;'+
        '})()');
      await sleep(400);
      const blur=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      const diff=comparePixels(full,blur,190,260,70,820);
      console.log("ACTUAL_GLASS_VS_BLUR_PIXEL_DIFF",JSON.stringify(diff));
      assert(diff.different>=200&&diff.max>=4,
        "Real scene: refraction must be visibly distinct from a blur-only control");
      /*
       * The real page is deliberately subdued, so it is not a good
       * independent test of optical displacement strength. Apply a sharp
       * high-contrast grid to the PAGE backdrop ONLY, never inside the
       * sidebar, and compare the live SVG glass with a blur-only control.
       * This catches filters that parse successfully but do not refract.
       */
      await evaluate('(()=>{'+
        'document.getElementById("ci-compare-blur")?.remove();'+
        'const s=document.createElement("style");s.id="ci-refractive-target";'+
        's.textContent="body:has(> #workspace-shell.liquid-glass-preview)::after {'+
        'background:repeating-linear-gradient(90deg,transparent 0 9px,'+
        'rgba(255,255,255,.95) 9px 12px,transparent 12px 28px),'+
        'repeating-linear-gradient(0deg,transparent 0 15px,'+
        'rgba(255,255,255,.60) 15px 18px,transparent 18px 36px) !important;}";'+
        'document.head.append(s);return true;})()');
      await sleep(500);
      const glassGrid=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      await evaluate('(()=>{'+
        'const s=document.createElement("style");s.id="ci-compare-blur";'+
        's.textContent=".shell.liquid-glass-preview.has-oracle-backdrop .sidebar {'+
        'backdrop-filter:blur(var(--oracle-backdrop-blur)) !important;'+
        '-webkit-backdrop-filter:blur(var(--oracle-backdrop-blur)) !important;}";'+
        'document.head.append(s);return true;})()');
      await sleep(500);
      const blurGrid=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      const patternDiff=comparePixels(glassGrid,blurGrid,190,260,70,820);
      console.log("CONTROLLED_PAGE_GRID_REFRACTION_DIFF",JSON.stringify(patternDiff));
      assert(patternDiff.different>=1400&&patternDiff.mean>=2,
        "Controlled PAGE backdrop: glass must bend a high-contrast grid, not just blur it");
    }
  }
  console.log("BROWSER_BACKDROP_PIXEL_AND_RESPONSIVE_VALIDATION_PASSED");
}finally{
  try{socket?.close();}catch{}
  // Chrome's renderer children can still be writing the profile after the
  // top-level process receives SIGTERM. Wait for exit and retry removal;
  // ENOTEMPTY here was a CI CLEANUP race, not an optical test failure.
  const exit=chrome.exitCode===null?
    new Promise(resolve=>chrome.once("exit",resolve)):Promise.resolve();
  try{if(chrome.exitCode===null)chrome.kill("SIGTERM");}catch{}
  await Promise.race([exit,sleep(3500)]);
  if(chrome.exitCode===null){
    try{chrome.kill("SIGKILL");}catch{}
    await Promise.race([exit,sleep(2000)]);
  }
  await sleep(300);
  let removed=false;
  for(let attempt=0;attempt<8&&!removed;attempt++){
    try{
      rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:150});
      removed=!existsSync(profile);
    }catch(e){
      if(attempt===7){
        console.error("CDP profile cleanup failed",e.message);
        process.exitCode=1;
      }else await sleep(250);
    }
  }
  if(!removed){console.error("CDP profile remains:",profile);process.exitCode=1;}
}