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
    if(width===1440){
      // Give geometry-only anticipation an idle opportunity to complete
      // before assessing an EXPANSION. It does not snapshot any page pixels.
      const warming=await until(async()=>{
        const p=await evaluate('(()=>{const s=document.getElementById("workspace-shell");return {'+
          'count:Number(s.dataset.oracleWarmFieldCount||0),'+
          'hits:Number(s.dataset.oracleAnticipatedFieldHits||0)};})()');
        return p.count>=10?p:null;
      },20000);
      console.log("EXACT_GEOMETRY_ONLY_IDLE_PREFETCH",JSON.stringify(warming));
      assert(warming.count<=24,
        "Bound geometry warmup count; avoid background-independent CPU waste");
      await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
      // Record actual width versus installed SVG field width at every frame,
      // including the interval between layout transition and worker response.
      await evaluate(`(()=>{
        const shell=document.getElementById("workspace-shell");
        const sidebar=document.getElementById("workspace-sidebar");
        const map=document.querySelector('#oracle-glass-native-backdrop [result="innerMap"]');
        const toggle=document.getElementById("sidebar-toggle");
        const list=[];const start=performance.now();
        // Start with explicitly expanded sidebar (known CI state).
        function sample(t){
          const w=sidebar.getBoundingClientRect().width;
          const active=sidebar.querySelector('.nav-stack:not([hidden]) .nav-link.active');
          const selected=sidebar.querySelector('.glass-selection');
          list.push({ms:Math.round(t-start),width:Math.round(w),
            rowWidth:active?.getBoundingClientRect().width||0,
            selectionWidth:selected?.getBoundingClientRect().width||0,
            mapWidth:Number(map.getAttribute("width")),
            builds:Number(shell.dataset.oracleFieldBuilds||0),
            cacheHits:Number(shell.dataset.oracleFieldCacheHits||0)});
          if(t-start<850)requestAnimationFrame(sample);
          else window.__glassGeometryTimeline=list;
        }
        requestAnimationFrame(sample);
        setTimeout(()=>toggle.click(),80); // expanded -> collapsed
        setTimeout(()=>toggle.click(),440); // collapsed -> expanded
        return true;
      })()`);
      const trace=await until(()=>evaluate("window.__glassGeometryTimeline||null"),12000);
      const compact=trace.filter((s,i,all)=>i===0||s.width!==all[i-1].width||
        s.mapWidth!==all[i-1].mapWidth||s.builds!==all[i-1].builds);
      console.log("SIDEBAR_FIELD_TRANSITION_TIMELINE",JSON.stringify(compact));
      const visibleFrames=trace.filter(s=>s.rowWidth>0&&s.selectionWidth>0);
      assert(visibleFrames.length>10,"Measure active selection across normal-motion transition");
      const worstSelectionMismatch=Math.max(...visibleFrames.map(s=>Math.abs(s.rowWidth-s.selectionWidth)));
      console.log("SIDEBAR_SELECTION_WIDTH_FRAME_DELTA",worstSelectionMismatch);
      const anticipation=await evaluate('Number(document.getElementById("workspace-shell").dataset.oracleAnticipatedFieldHits||0)');
      console.log("EXACT_GEOMETRY_ANIMATION_CACHE_HITS",anticipation);
      assert(anticipation>=1,
        "At least one intermediate animation width must use its byte-exact idle-prepared field");
      assert(worstSelectionMismatch<=1,
        "Active button highlight must morph WITH its own nav row, not after width settles");
      assert(await evaluate('!document.getElementById("workspace-shell").classList.contains("is-collapsed")'),
        "Transition trace must restore expanded state");
      await sleep(100);
      await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
    }
    if(width===390){
      await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
      await evaluate(`(()=>{
        const shell=document.getElementById("workspace-shell");
        const nav=document.getElementById("mobile-nav-toggle");
        const side=document.getElementById("workspace-sidebar");
        const scrim=document.getElementById("sidebar-scrim");
        const records=[];const start=performance.now();
        function sample(t){
          const cs=getComputedStyle(scrim);
          const r=side.getBoundingClientRect();
          records.push({ms:Math.round(t-start),left:Math.round(r.left),
            visible:!scrim.hidden,background:cs.backgroundColor,
            opacity:cs.opacity,backdrop:cs.backdropFilter,
            clip:cs.clipPath});
          if(t-start<420)requestAnimationFrame(sample);
          else window.__glassMobileTimeline=records;
        }
        requestAnimationFrame(sample);
        setTimeout(()=>nav.click(),75);
        return true;
      })()`);
      const trace=await until(()=>evaluate("window.__glassMobileTimeline||null"),10000);
      console.log("MOBILE_DRAWER_SCRIM_TIMELINE",JSON.stringify(
        trace.filter((s,i,all)=>i===0||s.visible!==all[i-1].visible||
          Math.abs(s.left-all[i-1].left)>12||s.opacity!==all[i-1].opacity)));
      await evaluate('document.getElementById("sidebar-toggle").click()');
      await sleep(250);
      await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
    }
    if(width===390){
      // CDP pointer events expose hit-testing and disabled overlays that
      // programmatic .click() cannot detect.
      async function physicalClick(selector){
        const expression="(()=>{const e=document.querySelector("+JSON.stringify(selector)+");"+
          "if(!e)return null;const r=e.getBoundingClientRect();"+
          "const x=e.id==='sidebar-scrim'?Math.round((282+innerWidth)/2):Math.round(r.left+r.width/2);const y=Math.round(r.top+r.height/2);"+
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
      const paneMobile=await evaluate('(()=>{const p=document.getElementById("workspace-sidebar").getBoundingClientRect();'+
        'return {x:Math.round(p.left),y:Math.round(p.top),width:Math.round(p.width),height:Math.round(p.height)};})()');
      assert(paneMobile.x===8&&paneMobile.y===8&&paneMobile.width===274&&paneMobile.height===828,
        "Mobile drawer must float 8px within viewport, without scaling its oracle map "+JSON.stringify(paneMobile));
      const mask=await evaluate('(()=>{const s=document.getElementById("sidebar-scrim");const css=getComputedStyle(s);return {hidden:s.hidden,disabled:s.disabled,opacity:css.opacity,clip:css.clipPath,background:css.backgroundColor,backdrop:css.backdropFilter};})()');
      assert(!mask.hidden&&!mask.disabled&&mask.opacity==="1"&&mask.clip.includes("282px")&&
        mask.backdrop==="none"&&mask.background==="rgba(0, 0, 0, 0)",
        "Transparent click-away scrim must be interactive and visually absent "+JSON.stringify(mask));
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
      assert(dimming.different<=10 && dimming.max<=1,
        "Clear scrim must not change live glass pixels when unclipped "+JSON.stringify(dimming));
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
      const pane=await evaluate('(()=>{const p=document.getElementById("workspace-sidebar").getBoundingClientRect();'+
        'const banner=getComputedStyle(document.querySelector(".topbar"),"::before");'+
        'return {x:Math.round(p.left),y:Math.round(p.top),width:Math.round(p.width),'+
        'height:Math.round(p.height),bannerWidth:parseFloat(banner.width),'+
        'layoutWidth:document.documentElement.clientWidth,bannerPosition:banner.position};})()');
      assert(pane.x===8&&pane.y===8&&pane.width===260&&pane.height===884,
        "Pane must keep exact optical dimensions with 8px outer inset "+JSON.stringify(pane));
      assert(pane.bannerPosition==="fixed"&&pane.bannerWidth>=pane.layoutWidth-16&&pane.bannerWidth<=pane.layoutWidth,
        "Top blur banner must extend across viewport behind sidebar "+JSON.stringify(pane));
      const glassSample=[pane.x+190,pane.x+260,pane.y+70,pane.y+820];
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
      const diff=comparePixels(full,blur,...glassSample);
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
      const patternDiff=comparePixels(glassGrid,blurGrid,...glassSample);
      console.log("CONTROLLED_PAGE_GRID_REFRACTION_DIFF",JSON.stringify(patternDiff));
      // The previous >=2 mean gate was calibrated to a wrong source-over
      // compositing step that attenuated the alternate branch twice.
      // Correct source-derived linear mixing still bends the grid distinctly.
      assert(patternDiff.different>=1400&&patternDiff.mean>=1.5,
        "Controlled PAGE backdrop: source-consistent glass must bend a high-contrast grid");
      // Optical-compositing candidate: the current 'over' on two
      // COMPLEMENTARY premultiplied-alpha branches is not the source
      // shader's linear image interpolation. Test W3C arithmetic sum
      // k2=1,k3=1 without changing any optical parameter or page input.
      await evaluate('document.getElementById("ci-compare-blur")?.remove()');
      await sleep(360);
      const overPicture=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      const changes=await evaluate(`(()=>{
        const filter=document.getElementById("oracle-glass-native-backdrop");
        const nodes=["innerBlurred","outerBlurred","composited"].map(
          key=>filter.querySelector('feComposite[result="'+key+'"]'));
        if(nodes.some(n=>!n))return {error:"Missing SVG mix joins"};
        const original=nodes.map(n=>({op:n.getAttribute("operator"),k2:n.getAttribute("k2"),
          k3:n.getAttribute("k3")}));
        nodes.forEach(n=>{
          n.setAttribute("operator","over");
          n.removeAttribute("k2");n.removeAttribute("k3");
        });
        return {count:nodes.length,original};
      })()`);
      assert(changes.count===3,"Missing candidate operator stages "+JSON.stringify(changes));
      await sleep(360);
      const oldOverPicture=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      const changed=comparePixels(overPicture,oldOverPicture,0,260,0,880);
      console.log("COMPLEMENTARY_WEIGHTED_BRANCH_ARITHMETIC_VS_OVER",
        JSON.stringify(changed));
      assert(changed.different>1000 && changed.max>2,
        "Complementary source-derived blend fix must be visible against the prior Porter-Duff over");
      assert(changes.original.every(o=>o.op==="arithmetic"&&o.k2==="1"&&o.k3==="1"),
        "Production graph must use additive linear joins");
      await evaluate(`(()=>{
        const filter=document.getElementById("oracle-glass-native-backdrop");
        ["innerBlurred","outerBlurred","composited"].forEach(key=>{
          const node=filter.querySelector('feComposite[result="'+key+'"]');
          node.setAttribute("operator","arithmetic");
          node.setAttribute("k2","1");
          node.setAttribute("k3","1");
        });
        return true;
      })()`);
      await sleep(200);
      const aligned=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      await evaluate(`(()=>{
        const f=document.getElementById("oracle-glass-native-backdrop");
        f.querySelector('feDisplacementMap[result="innerShift"]').setAttribute("in2","innerMap");
        f.querySelector('feDisplacementMap[result="outerShift"]').setAttribute("in2","outerMap");
        return true;
      })()`);
      await sleep(280);
      const oldBias=decodePNG((await send("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      },90000)).data);
      const biasDelta=comparePixels(aligned,oldBias,0,260,0,880);
      console.log("NEUTRAL_DISPLACEMENT_CORRECTION_PIXEL_DIFF",JSON.stringify(biasDelta));
      await evaluate(`(()=>{
        const f=document.getElementById("oracle-glass-native-backdrop");
        f.querySelector('feDisplacementMap[result="innerShift"]').setAttribute("in2","innerCentered");
        f.querySelector('feDisplacementMap[result="outerShift"]').setAttribute("in2","outerCentered");
        return true;
      })()`);


      // Test the SECOND reported path: tablet rail -> xl expanded sidebar.
      // This is a breakpoint transition, not an explicit sidebar toggle.
      await send("Emulation.setDeviceMetricsOverride",{
        width:980,height:900,deviceScaleFactor:1,mobile:false
      });
      await sleep(700);
      const beforeResize=await evaluate(`(()=>{
        const shell=document.getElementById("workspace-shell");
        const side=document.getElementById("workspace-sidebar");
        const map=document.querySelector('#oracle-glass-native-backdrop [result="innerMap"]');
        return {w:side.getBoundingClientRect().width,mw:Number(map.getAttribute("width")),
          rail:shell.classList.contains("is-compact-rail"),
          collapsed:shell.classList.contains("is-collapsed")};
      })()`);
      assert(beforeResize.rail&&beforeResize.w<=75,
        "Responsive test must start on compact exact-width rail "+JSON.stringify(beforeResize));
      await evaluate(`(()=>{
        const shell=document.getElementById("workspace-shell");
        const side=document.getElementById("workspace-sidebar");
        const main=document.querySelector(".main");
        const map=document.querySelector('#oracle-glass-native-backdrop [result="innerMap"]');
        const snapshots=[];const start=performance.now();
        const observe=t=>{
          const bounds=side.getBoundingClientRect();
          snapshots.push({ms:Math.round(t-start),w:Math.round(bounds.width),
            map:Number(map.getAttribute("width")),
            x:Math.round(bounds.x),mainX:Math.round(main.getBoundingClientRect().x),
            entering:shell.classList.contains("is-rail-entering"),
            collapsed:shell.classList.contains("is-collapsed"),
            updated:Number(shell.dataset.oracleFieldBuilds||0),
            hits:Number(shell.dataset.oracleFieldCacheHits||0)});
          if(t-start<1000)requestAnimationFrame(observe);
          else window.__responsiveGlassTrace=snapshots;
        };
        window.__responsiveGlassTrace=null;
        requestAnimationFrame(observe);
        return true;
      })()`);
      await sleep(90);
      await send("Emulation.setDeviceMetricsOverride",{
        width:1440,height:900,deviceScaleFactor:1,mobile:false
      });
      const responsive=await until(()=>evaluate("window.__responsiveGlassTrace||null"),12000);
      const compactResponsive=responsive.filter((p,i)=>i===0||
        p.w!==responsive[i-1].w||p.map!==responsive[i-1].map||
        p.entering!==responsive[i-1].entering||p.collapsed!==responsive[i-1].collapsed);
      console.log("RESPONSIVE_WIDEN_GLASS_TIMELINE",JSON.stringify(compactResponsive));
      assert(responsive.at(-1)?.w===260&&responsive.at(-1)?.map===260,
        "Widening must restore exact expanded 260px geometry");
      const staleWide=responsive.filter(p=>p.w===260&&p.map!==260);
      assert(staleWide.length===0,
        "After widening, the 260px pane must never paint with the old rail map: "+
        JSON.stringify(staleWide));


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