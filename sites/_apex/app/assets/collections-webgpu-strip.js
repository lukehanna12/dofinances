/* Collections: route-scoped, viewport-wide WebGPU Clear-glass transition.
 * The strip starts at the REAL black surface boundary and occupies exactly
 * 7/16 (43.75%) of the measured gap to the TOTAL/UPDATED line box. It is
 * never positioned from, sized by, or composited through the sidebar.
 *
 * The only sampled content is the existing Collections wallpaper image
 * (same cover crop + 12% authored veil as body::before). It is not a DOM
 * screenshot, a duplicate visible wallpaper element or a fake CSS backdrop.
 *
 * Evidence: liquid-plexiglass-oracle @58a83a8f68392f8004981c9b42ab308b3874f543,
 * finite SwiftUI public Clear CAFilter inputs and reachable AIR SDF/refraction
 * formula, via collections-glass-public-clear.js. Browser image mips, output
 * gamma, complete dark scheme and interactive light dynamics remain open.
 */
import {workspaceWallpaperForRoute} from "./workspace-wallpapers.js";
import {projectPublicClearInputs} from "./collections-glass-public-clear.js";
import {airTextureMipLOD} from "./sidebar-glass-oracle.js";

export const COLLECTIONS_STRIP_FRACTION=7/16; // 43.75%, exactly.
export function collectionsStripGeometry(shellTop,summaryTop,bannerHeight){
  if(![shellTop,summaryTop,bannerHeight].every(Number.isFinite)||bannerHeight<0)
    throw new TypeError("Finite shell, line-box and banner coordinates required");
  const gap=Math.max(0,summaryTop-shellTop-bannerHeight);
  return {top:bannerHeight,gap,height:gap*COLLECTIONS_STRIP_FRACTION};
}
export function wallpaperCover(viewWidth,planeHeight,imageWidth,imageHeight,positionY=.45){
  if(![viewWidth,planeHeight,imageWidth,imageHeight,positionY].every(Number.isFinite)||
     Math.min(viewWidth,planeHeight,imageWidth,imageHeight)<=0||
     positionY<0||positionY>1)throw new TypeError("Invalid CSS background-cover inputs");
  const scale=Math.max(viewWidth/imageWidth,planeHeight/imageHeight);
  const w=imageWidth*scale,h=imageHeight*scale;
  return {left:(viewWidth-w)/2,top:(planeHeight-h)*positionY,width:w,height:h};
}
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const shaderURL=new URL("./collections-webgpu-strip.wgsl",import.meta.url);
const mipURL=new URL("./collections-webgpu-mipmap.wgsl",import.meta.url);
async function shaderText(url){
  const response=await fetch(url);
  if(!response.ok)throw Error("Collections glass shader failed to load: "+url.pathname);
  return response.text();
}
async function decodeRGBA(doc,win,url){
  const image=new win.Image();image.decoding="async";
  image.crossOrigin="anonymous";
  image.src=url;
  if(typeof image.decode==="function")await image.decode();
  else await new Promise((resolve,reject)=>{
    image.onload=resolve;image.onerror=()=>reject(Error("Collections wallpaper decode failed"));
  });
  const w=image.naturalWidth,h=image.naturalHeight;
  if(!(w>0&&h>0&&w<=8192&&h<=8192))throw Error("Unsupported wallpaper dimensions");
  const staging=doc.createElement("canvas");
  staging.width=w;staging.height=h;
  const context=staging.getContext("2d",{willReadFrequently:true});
  if(!context)throw Error("Wallpaper RGBA decode unavailable");
  context.drawImage(image,0,0);
  const rgba=context.getImageData(0,0,w,h).data;
  // An explicit RGBA transfer avoids the silently transparent WebGPU
  // external-image upload encountered on the previous Home logo experiment.
  const stride=Math.ceil(w*4/256)*256;
  const pixels=new Uint8Array(stride*h);
  for(let row=0;row<h;row++)
    pixels.set(rgba.subarray(row*w*4,(row+1)*w*4),row*stride);
  staging.width=staging.height=0;
  return {w,h,pixels,stride};
}
export function initCollectionsWebGPUStrip({doc=document,win=window,wallpaperURL=null}={}){
  const shell=doc.getElementById("workspace-shell");
  const view=doc.querySelector('[data-view="colosseum/collections"]');
  const summary=doc.getElementById("cs-summary");
  if(!shell||!view||!summary)return {status:"not-mounted",dispose(){}};
  const canvas=doc.createElement("canvas");
  const pixelCI=new URLSearchParams(win.location?.search||"").get("collections-glass-ci")==="1";
  canvas.id="cs-top-webgpu-strip";
  canvas.className="cs-top-webgpu-strip";
  canvas.setAttribute("aria-hidden","true");
  canvas.hidden=true;
  shell.insertBefore(canvas,shell.firstChild);
  const audit={status:"idle",fraction:COLLECTIONS_STRIP_FRACTION,
    underlay:"Collections wallpaper only",usesSidebarGeometry:false,
    oracleScope:"finite-public-Clear-25F80-M2-G14G",
    tint:"none",mipKernel:"authored-2x2-browser-approximation",
    geometry:null,frames:0};
  Object.defineProperty(win,"__collectionsWebGPUStrip",{
    configurable:true,get:()=>Object.freeze({...audit,geometry:audit.geometry&&{...audit.geometry}})
  });
  const active=()=>!view.hidden&&!doc.hidden;
  let disposed=false,device=null,context=null,pipeline=null,texture=null,group=null;
  let offscreen=null;
  let uniform=null,imageData=null,booting=false,frame=0,dpr=1,lastPxW=0,lastPxH=0;
  let userX=-1e6,userHover=0,hoverGoal=0,pressed=0,readbackBusy=false;
  let geometry=null;
  const viewportWidth=()=>Math.max(1,doc.documentElement.clientWidth||win.innerWidth);
  const banner=()=>parseFloat(win.getComputedStyle(shell).getPropertyValue("--workspace-banner-height"))||202.65625;
  const overpull=()=>parseFloat(win.getComputedStyle(shell).getPropertyValue("--workspace-top-overpull"))||96;
  function measure(){
    const shellRect=shell.getBoundingClientRect();
    const textRect=summary.getBoundingClientRect();
    return collectionsStripGeometry(shellRect.top,textRect.top,banner());
  }
  const request=()=>{
    if(frame||!device||!active()||disposed)return;
    frame=win.requestAnimationFrame(draw);
  };
  function sync(){
    if(disposed)return;
    if(!active()){
      canvas.hidden=true;
      if(frame)win.cancelAnimationFrame(frame);
      frame=0;
      audit.status=booting?"loading":"suspended";
      return;
    }
    geometry=measure();
    audit.geometry={...geometry};
    if(geometry.height<1){
      canvas.hidden=true;return;
    }
    canvas.style.height=geometry.height+"px";
    canvas.style.setProperty("--cs-strip-top",geometry.top+"px");
    if(!device&&!booting){void boot();return;}
    if(device){
      const width=viewportWidth();
      dpr=clamp(win.devicePixelRatio||1,1,2);
      const pxWidth=Math.max(1,Math.round(width*dpr));
      const pxHeight=Math.max(1,Math.round(geometry.height*dpr));
      if(pxWidth!==lastPxW||pxHeight!==lastPxH){
        canvas.width=lastPxW=pxWidth;
        canvas.height=lastPxH=pxHeight;
        canvas.style.width=width+"px";
        // Headless SwiftShader cannot reliably export GPUCanvasContext pixels.
        // CI validates the identical shader on a direct texture attachment.
        if(pixelCI){
          offscreen?.destroy();
          offscreen=device.createTexture({
            label:"Collections strip WebGPU CI pixel target",
            size:[pxWidth,pxHeight,1],format:"rgba8unorm",
            usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC
          });
        }
      }
      canvas.hidden=false;
      request();
    }
  }
  async function boot(){
    booting=true;audit.status="loading";
    try{
      if(win.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches||
         win.matchMedia?.("(forced-colors: active)")?.matches||
         win.matchMedia?.("(prefers-contrast: more)")?.matches)
        throw Error("Transparency disabled by accessibility preference");
      if(!win.navigator?.gpu)throw Error("WebGPU not supported");
      const wallpaper=workspaceWallpaperForRoute("colosseum/collections");
      const url=wallpaperURL||wallpaper.path||
        "/wallpapers/"+wallpaper.sha+"."+wallpaper.ext;
      const [adapter,photo,shaders]=await Promise.all([
        win.navigator.gpu.requestAdapter(),
        decodeRGBA(doc,win,url),
        Promise.all([shaderText(shaderURL),shaderText(mipURL)])
      ]);
      if(!adapter)throw Error("WebGPU adapter unavailable");
      if(disposed)return;
      device=await adapter.requestDevice();
      imageData={w:photo.w,h:photo.h};
      audit.photoDimensions=[photo.w,photo.h];
      if(!pixelCI){
        context=canvas.getContext("webgpu");
        if(!context)throw Error("WebGPU canvas context unavailable");
        context.configure({device,format:win.navigator.gpu.getPreferredCanvasFormat(),
          alphaMode:"premultiplied"});
      }
      device.addEventListener?.("uncapturederror",event=>{
        (audit.gpuErrors??=[]).push(String(event.error?.message||event.error||"unknown"));
        audit.status="fallback";
        canvas.hidden=true;
      });
      device.pushErrorScope("validation");
      const renderModule=device.createShaderModule({label:"Oracle-bounded Clear strip",code:shaders[0]});
      const mipModule=device.createShaderModule({label:"Browser image mip reduction",code:shaders[1]});
      // A successful createShaderModule call does NOT certify valid WGSL.
      // Check the actual browser compiler before attempting any GPU render.
      for(const module of [renderModule,mipModule]){
        if(typeof module.getCompilationInfo!=="function")continue;
        const info=await module.getCompilationInfo();
        const issues=info.messages.filter(item=>item.type==="error");
        if(issues.length)throw Error("WebGPU shader failed to compile: "+
          issues.map(item=>item.message).join("; "));
      }
      pipeline=device.createRenderPipeline({
        layout:"auto",vertex:{module:renderModule,entryPoint:"vs"},
        fragment:{module:renderModule,entryPoint:"fs",
          targets:[{format:pixelCI?"rgba8unorm":win.navigator.gpu.getPreferredCanvasFormat(),
            blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha"},
                   alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},
        primitive:{topology:"triangle-list"}
      });
      const mipPipeline=device.createComputePipeline({
        layout:"auto",compute:{module:mipModule,entryPoint:"downsample"}
      });
      const levels=1+Math.floor(Math.log2(Math.max(photo.w,photo.h)));
      texture=device.createTexture({
        label:"One original Collections wallpaper - no DOM or sidebar",
        size:[photo.w,photo.h,1],mipLevelCount:levels,
        format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|
          GPUTextureUsage.COPY_DST|GPUTextureUsage.STORAGE_BINDING
      });
      device.queue.writeTexture({texture},photo.pixels,
        {bytesPerRow:photo.stride,rowsPerImage:photo.h},[photo.w,photo.h,1]);
      const encoder=device.createCommandEncoder();
      for(let level=1;level<levels;level++){
        const bind=device.createBindGroup({
          layout:mipPipeline.getBindGroupLayout(0),
          entries:[
            {binding:0,resource:texture.createView({baseMipLevel:level-1,mipLevelCount:1})},
            {binding:1,resource:texture.createView({baseMipLevel:level,mipLevelCount:1})}
          ]
        });
        const pass=encoder.beginComputePass();
        pass.setPipeline(mipPipeline);pass.setBindGroup(0,bind);
        pass.dispatchWorkgroups(Math.ceil(Math.max(1,photo.w>>level)/8),
          Math.ceil(Math.max(1,photo.h>>level)/8));
        pass.end();
      }
      device.queue.submit([encoder.finish()]);
      const gpuValidation=await device.popErrorScope();
      if(gpuValidation)throw Error("WebGPU mip generation failed: "+
        gpuValidation.message);
      const sampler=device.createSampler({
        magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",
        addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"
      });
      uniform=device.createBuffer({size:64,
        usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      group=device.createBindGroup({
        layout:pipeline.getBindGroupLayout(0),entries:[
          {binding:0,resource:texture.createView()},
          {binding:1,resource:sampler},
          {binding:2,resource:{buffer:uniform}}
        ]
      });
      audit.mipCount=levels;
      // Run-time source evidence, never an unconditional success claim.
      if(audit.gpuErrors?.length)
        throw Error("WebGPU initialization emitted validation errors: "+audit.gpuErrors.join("; "));
      audit.status="ready";
      device.lost.then(info=>{if(!disposed){
        audit.status="device-lost";
        audit.deviceLostReason=info?.reason||"unknown";
        audit.deviceLostMessage=info?.message||"";
        canvas.hidden=true;
      }});
    }catch(error){
      audit.status="fallback";audit.error=String(error);
      canvas.hidden=true;
      texture?.destroy();texture=null;
      uniform?.destroy();uniform=null;
      device?.destroy();device=null;
    }finally{
      booting=false;
      if(!disposed&&device&&active())sync();
    }
  }
  function draw(){
    frame=0;
    if(!device||disposed||!active()||!geometry||!pipeline||!group)return;
    const width=viewportWidth(),rect=canvas.getBoundingClientRect();
    if(rect.bottom<=0||rect.top>=win.innerHeight)return;
    const cssBanner=banner(),upper=overpull();
    const planeHeight=cssBanner+upper;
    const crop=wallpaperCover(width,planeHeight,imageData.w,imageData.h,.45);
    const projected=projectPublicClearInputs(width,geometry.height);
    // Native blur input path is finite; browser's texture footprint and
    // extended-sRGB/EDR output remain explicitly unproved.
    const lod=Math.max(0,airTextureMipLOD(projected.word,1)+
      Math.log2(imageData.w/crop.width));
    userHover+=(hoverGoal-userHover)*.24;
    const data=new Float32Array([
      crop.left,crop.top,crop.width,crop.height,
      rect.top,upper,dpr,geometry.height,
      projected.amount,projected.height,lod,.12,
      userX,userHover,pressed,0
    ]);
    device.queue.writeBuffer(uniform,0,data);
    const encoder=device.createCommandEncoder();
    const output=pixelCI?offscreen:context.getCurrentTexture();
    if(!output)return;
    const pass=encoder.beginRenderPass({colorAttachments:[{
      view:output.createView(),
      clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"
    }]});
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();
    // Explicit GPU-to-CPU center pixel proof in the auth-free CI fixture:
    // a check of real submitted pixels, not a CSS/source-only assertion.
    let buffer=null;
    if(pixelCI&&!readbackBusy&&!audit.gpuPixel){
      readbackBusy=true;
      buffer=device.createBuffer({size:256,
        usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      encoder.copyTextureToBuffer(
        {texture:output,origin:{x:Math.floor(lastPxW/2),
          y:Math.floor(lastPxH/2),z:0}},
        {buffer,bytesPerRow:256,rowsPerImage:1},
        {width:1,height:1,depthOrArrayLayers:1}
      );
    }
    device.queue.submit([encoder.finish()]);
    if(buffer){
      buffer.mapAsync(GPUMapMode.READ).then(()=>{
        audit.gpuPixel=Array.from(new Uint8Array(buffer.getMappedRange()).slice(0,4));
        buffer.unmap();buffer.destroy();
        readbackBusy=false;
      }).catch(error=>{
        audit.gpuReadbackError=String(error);
        buffer.destroy();readbackBusy=false;
      });
    }
    audit.frames++;
    audit.lastCrop={...crop,canvasViewportTop:rect.top,
      stripHeight:geometry.height,lod};
    if(Math.abs(userHover-hoverGoal)>.008)request();
  }
  const onPointerMove=e=>{userX=e.clientX;hoverGoal=1;request();};
  const onPointerExit=()=>{hoverGoal=0;pressed=0;request();};
  const onDown=()=>{pressed=1;request();};
  const onUp=()=>{pressed=0;request();};
  canvas.addEventListener("pointerenter",onPointerMove);
  canvas.addEventListener("pointermove",onPointerMove);
  canvas.addEventListener("pointerleave",onPointerExit);
  canvas.addEventListener("pointerdown",onDown);
  canvas.addEventListener("pointerup",onUp);
  canvas.addEventListener("pointercancel",onPointerExit);
  const onScroll=()=>request();
  const onResize=()=>sync();
  win.addEventListener("scroll",onScroll,{passive:true});
  win.addEventListener("resize",onResize,{passive:true});
  win.addEventListener("hashchange",onResize,{passive:true});
  const mo=new win.MutationObserver(sync);
  mo.observe(view,{attributes:true,attributeFilter:["hidden"]});
  const ro=typeof win.ResizeObserver==="function"?new win.ResizeObserver(sync):null;
  ro?.observe(summary);
  ro?.observe(shell);
  sync();
  return {get status(){return audit.status;},refresh:sync,dispose(){
    disposed=true;
    if(frame)win.cancelAnimationFrame(frame);
    mo.disconnect();ro?.disconnect();
    win.removeEventListener("scroll",onScroll);
    win.removeEventListener("resize",onResize);
    win.removeEventListener("hashchange",onResize);
    offscreen?.destroy();texture?.destroy();uniform?.destroy();device?.destroy();
    canvas.remove();
    try{delete win.__collectionsWebGPUStrip;}catch{}
  }};
}
