/* WebGPU-owned backdrop and Oracle-constrained Liquid Glass preview.
 * 25F80/M2/G14G reference; all stages are replaceable proof interfaces.
 * No baked-in backdrop samples, DOM screenshot, CPU-side mipmap generator,
 * per-square Canvas2D or precomputed displacement PNG. The photo is uploaded
 * ONCE as a GPU source, composed into a viewport texture, and downsampled
 * into ACTUAL GPU mip levels. Every square reads the same texture pyramid.
 *
 * Re-rendering squares never re-uploads the scene or rebuilds mipmaps.
 * Scene invalidation is separate: resize/source change regenerates the
 * backdrop; pointer motion/animation updates only a tiny uniforms buffer.
 * Future freely moving tiles can update one GPU tile buffer (or vertex
 * shader motion formula) without changing the backdrop.
 *
 * GAP PUBLIC-SCENE: this GPU scene currently contains the original photograph
 * and overlay, not arbitrary external HTML/DOM. Future refractable content
 * must be added as a GPU scene layer; normal DOM above the canvas remains UI.
 * GAP R-MIP-KERNEL: authored 2x2 explicit reduction awaits native proof.
 * GAP Q: browser presentation/color/EDR not Apple's output pipeline.
 */
import "./dashboard-mosaic.js";
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";
import {createInteractionController,TILE_FLOATS} from "./dashboard-interaction.js";
import {createTintControls,tintForTile,tintParameters,SHOWCASE_TINTS,SHOWCASE_OPACITIES} from "./dashboard-tint.js";
import {TRACK_SECONDS,phaseAtSeconds,trackPosition,trackSideOpacity} from "./dashboard-track.js";
import {publicIconSpatialAlpha} from "./dashboard-public-icon-fade.js";
import {DISMISS_MS,tileDismissProgress,tileDismissIconOpacity,tileDismissScale,tileDismissDrift,tileDismissBlur} from "./dashboard-public-dismiss.js";

const OFFSCREEN_CI=typeof location!=="undefined" &&
  new URLSearchParams(location.search).get("webgpu-offscreen-ci")==="1";
const root=document.getElementById("cta6-mosaic");
if(root)root.dataset.gpuStatus="module-loaded";
const canvas=document.createElement("canvas");
const homeActive=()=>!!root&&!root.closest(".dashboard-home")?.hidden;
// A user may navigate away while the AVIF decodes or WGSL compiles.
// Defer first layout measurement until Home is visible again, rather than
// interpreting zero-size hidden geometry as an unrecoverable GPU failure.
async function waitForVisibleHome(){
  if(homeActive())return;
  await new Promise(resolve=>{
    const check=()=>queueMicrotask(()=>{
      if(!homeActive())return;
      window.removeEventListener("hashchange",check);
      window.removeEventListener("popstate",check);
      resolve();
    });
    window.addEventListener("hashchange",check);
    window.addEventListener("popstate",check);
    check();
  });
}

const activeTiles=()=>root?[...root.querySelectorAll(
  ".cta6-tile--plain, .cta6-tile--icon")]:[];
// Route-owned sign-in panes are drawn as extra instances of this SAME
// Oracle-derived shader, tint film and hover/press spring pipeline.
const AUTH_PANE_CAPACITY=10;
function authPaneElements(){
  const card=document.querySelector(".auth3-root [data-auth-glass-card]");
  if(!card)return [];
  return [card,...card.querySelectorAll(
    '[data-auth-glass-input],[data-auth-glass-submit],[data-auth-glass-provider]'
  )].slice(0,AUTH_PANE_CAPACITY);
}
const authGlassScheme=()=>document.documentElement.dataset.dofTheme==="light"?
  "light":"dark";
function authPaneTint(node,scheme){
  if(node.hasAttribute("data-auth-glass-card"))
    return tintParameters("none",undefined,scheme);
  // Original neutral form palette, never added blue/saturated hues:
  // white primary + dark controls in dark; black primary + light in light.
  const primary=node.hasAttribute("data-auth-glass-submit");
  const name=primary?(scheme==="dark"?"white":"black"):
    (scheme==="dark"?"black":"white");
  return tintParameters(name,.99,scheme);
}
const audit={
  path:"webgpu",status:"initializing",oracleTarget:"25F80/M2/G14G",
  scene:"GPU-owned centered photograph + 12% authored veil",
  sceneCapture:"No DOM screenshot/readback. Arbitrary external DOM is NOT included.",
  backend:"WebGPU",presentation:OFFSCREEN_CI?"offscreen-ci":"GPUCanvasContext",mipKernel:"explicit 2x2 RGBA16Float compute reduction",
  mipSampling:"WGSL manual bilinear + trilinear textureLoad",
  oracleMath:"AIR mode4/mode5 SDF, half-boundary refraction, distribution and LOD; finite scope",
  mipCount:0,sceneBuilds:0,frameCount:0,tiles:0,errors:[]
};
Object.defineProperty(window,"__dashboardWebGPU",{
  configurable:true,get:()=>Object.freeze({...audit,errors:[...audit.errors]})
});
const start=performance.now();
const pointer={x:-1e6,y:-1e6,enabled:0};
let stopped=false,raf=0,engine=null,scenePending=false;
const interaction=createInteractionController();
const tint=createTintControls(requestRender);
const reducedMotion=typeof window.matchMedia==="function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : {matches:false};
let activePointerId=null,lastFrameTime=performance.now();
let trackSeconds=0,trackRunning=false,lastMotionSubmission=0;
let dismissStart=document.body.dataset.publicRoute==="leaving"
  ? performance.now()-DISMISS_MS : null;
let restoreStart=null;
// Independent of tile visibility: resume the track clock immediately when
// the route-owned sign-in card begins its reversed exit.
let trackResumeRequested=false;
const TRACK_FRAME_INTERVAL=1000/30;
// A single event starts the transition even while first GPU initialization
// is pending; the CSS-only fallback remains available if GPU never starts.
window.addEventListener("dofinances:home-dismiss",event=>{
  if(dismissStart!==null&&restoreStart===null)return;
  dismissStart=performance.now()-(event.detail?.durationMs===0?DISMISS_MS:0);
  restoreStart=null;trackResumeRequested=false;trackRunning=false;
  requestRender();
});
window.addEventListener("dofinances:home-track-resume",()=>{
  // Sent by the shared router before /login starts its 600ms exit Motion.
  // A pointer event must never be necessary to restart the RAF scheduler.
  trackResumeRequested=true;
  trackRunning=!reducedMotion.matches;
  lastFrameTime=performance.now();
  lastMotionSubmission=0;
  requestRender();
});
window.addEventListener("dofinances:home-restore",event=>{
  if(dismissStart===null&&restoreStart===null)return;
  dismissStart=null;
  restoreStart=performance.now()-(event.detail?.durationMs===0?DISMISS_MS:0);
  trackResumeRequested=true;
  trackRunning=!reducedMotion.matches;
  lastFrameTime=performance.now();
  lastMotionSubmission=0;
  requestRender();
});
function requestRender(){
  if(!homeActive()||!engine||stopped||raf)return;
  raf=requestAnimationFrame(()=>{
    raf=0;
    if(trackRunning&&performance.now()-lastMotionSubmission<TRACK_FRAME_INTERVAL){
      requestRender();return;
    }
    lastMotionSubmission=performance.now();
    let animating=false;
    try{animating=engine.render()}catch(e){fallback(e);}
    if(!stopped&&(animating||trackRunning||
      (dismissStart!==null&&performance.now()-dismissStart<DISMISS_MS+90)||
      (restoreStart!==null&&performance.now()-restoreStart<DISMISS_MS+90)||
      performance.now()-start<1250))
      requestRender();
  });
}
async function fallback(reason){
  if(stopped)return;
  stopped=true;
  if(raf)cancelAnimationFrame(raf);
  trackRunning=false;
  if(root)for(const tile of root.querySelectorAll(".cta6-tile--plain,.cta6-tile--icon")){
    tile.style.transform="";tile.style.opacity="";
  }
  audit.status="fallback";
  audit.resizePending=false;
  audit.errors.push(String(reason));
  if(root){
    root.dataset.gpuStatus="fallback";
    root.dataset.gpuError=String(reason).slice(0,700);
  }
  document.body.dataset.gpuScene="fallback";
  canvas.remove();
  try{engine?.dispose()}catch{}
  // Avoid a blank preview where WebGPU is not available (e.g. a disabled
  // enterprise GPU or software adapter). Live DOM sampling still works.
  // The fallback is the EXISTING earlier SVG glass, not a fake GPU result.
  try{await import("./dashboard-optics.js")}catch(error){
    audit.errors.push("SVG fallback: "+String(error));
  }
}
function compileCheck(module,label){
  return module.getCompilationInfo().then(info=>{
    const problems=info.messages.filter(x=>x.type==="error");
    if(problems.length)throw new Error(label+" WGSL: "+
       problems.map(x=>x.lineNum+":"+x.linePos+" "+x.message).join("; "));
  });
}
function rgba16Texture(device,width,height){
  return device.createTexture({
    label:"One GPU-owned scene with real RGBA16F mip levels",
    size:[width,height,1],
    mipLevelCount:Math.floor(Math.log2(Math.max(width,height)))+1,
    format:"rgba16float",
    usage:GPUTextureUsage.TEXTURE_BINDING|
          GPUTextureUsage.RENDER_ATTACHMENT|
          GPUTextureUsage.STORAGE_BINDING
  });
}
// Canvas-local scene: cover image begins at the visible global-bar bottom.
export function sceneViewportHeight(viewportHeight,headerBottom){
  if(!Number.isFinite(viewportHeight)||viewportHeight<=0)
    throw new TypeError("Positive viewport height required");
  if(!Number.isFinite(headerBottom))
    throw new TypeError("Finite header bottom required");
  const top=Math.min(Math.max(0,headerBottom),viewportHeight-1);
  return {top,height:Math.max(1,viewportHeight-top)};
}
function actualSceneViewport(){
  const bar=document.getElementById("global-menu");
  return sceneViewportHeight(window.innerHeight,
    bar?.getBoundingClientRect().bottom ?? 44);
}
function makeLayoutData(tile,scale,sceneTop=0){
  // Reading DOM positions only establishes the INITIAL user-selected layout.
  // Future translations are GPU-side parameters, not wallpaper captures.
  const b=tile.getBoundingClientRect();
  const w=tile.offsetWidth,h=tile.offsetHeight;
  const x=b.left+b.width*.5-w*.5;
  const y=b.top+b.height*.5-h*.5-sceneTop;
  const style=getComputedStyle(tile);
  const radii=[
    style.borderTopLeftRadius,style.borderTopRightRadius,
    style.borderBottomRightRadius,style.borderBottomLeftRadius
  ].map(v=>Number.parseFloat(v)||0);
  const radius=radii[0];
  const nativeMode=selectModeForNormalizedCorners(radii);
  // The retained native writer compares FOUR NORMALIZED PRIVATE LANES.
  // CSS radii are NOT a proved public-to-private writer. For this uniformly
  // rounded square, exact equality is at least the source-backed selection.
  const delay=Number.parseFloat(style.getPropertyValue("--cta6-delay"))||0;
  const r=nativePublicBlurRadius("clear",w,h);
  // Finite native f32 selected factor, NOT universal scale-selection proof.
  const word=observedBlurWord(r,1,.25);
  return [x*scale,y*scale,w*scale,h*scale,
    radius*scale,delay,word,nativeMode,
    ...radii.map(v=>-Math.max(.009999999776482582,v*scale)),
    0,0,w*scale*.5,h*scale*.5,0,0,0,0];
}
// Mirrors the native AArch64 FCMP/FCCMP mode gate; the caller is responsible
// for supplying correctly normalized private lanes. CSS -> private producer
// remains unproved, and is never silently identified with this comparator.
export function selectModeForNormalizedCorners(lanes){
  if(!Array.isArray(lanes)||lanes.length!==4)
    throw new TypeError("Four native corner lanes required");
  return lanes[0]===lanes[1] && lanes[1]===lanes[2] &&
    lanes[2]===lanes[3] ? 4 : 5;
}
export function makeTileFloatData(elements,dpr,sceneTop=0){
  const out=new Float32Array(elements.length*TILE_FLOATS);
  elements.forEach((tile,i)=>out.set(makeLayoutData(tile,dpr,sceneTop),i*TILE_FLOATS));
  return out;
}
function geometry(width,height,imgWidth,imgHeight){
  const drawScale=Math.max(width/imgWidth,height/imgHeight);
  const drawn=[imgWidth*drawScale,imgHeight*drawScale];
  return [width/drawn[0],height/drawn[1]];
}
export function coverUVScale(width,height,imgWidth,imgHeight){
  return geometry(width,height,imgWidth,imgHeight);
}

async function initialize(){
  if(!root)return;
  if(root)root.dataset.gpuPhase="request-adapter";
  if(!navigator.gpu)throw new Error("WebGPU API not available");
  const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});
  if(!adapter)throw new Error("No WebGPU adapter available");
  if(root)root.dataset.gpuPhase="request-device";
  const nativeF16=adapter.features.has("shader-f16");
  const device=await adapter.requestDevice({
    requiredFeatures:nativeF16?["shader-f16"]:[]
  });
  audit.nativeHalfConversion=nativeF16?"shader-f16 at selected AIR half arithmetic/conversion sites":
    "f32 fallback; native LPH half conversion not matched";
  if(root)root.dataset.gpuPhase="device-ready";
  const context=OFFSCREEN_CI?null:canvas.getContext("webgpu");
  if(!OFFSCREEN_CI&&!context)throw new Error("No GPUCanvasContext");
  const format=navigator.gpu.getPreferredCanvasFormat();
  if(context)context.configure({device,format,alphaMode:"opaque"});
  canvas.id="dashboard-webgpu-scene";
  canvas.setAttribute("aria-hidden","true");
  document.body.insertBefore(canvas,document.getElementById("workspace-shell"));
  const url="/assets/home-dashboard/dashboard-cloud-veiled-colorful-fields.avif";
  // HTMLImageElement onload works without a CPU-side Blob/ImageBitmap
  // re-encode. The GPU still owns all downstream scene/mip operations.
  if(root)root.dataset.gpuPhase="load-scene-image";
  const img=new Image();
  img.decoding="sync";
  const ready=new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=()=>reject(new Error("Backdrop image load failed"));
  });
  img.src=url;
  await ready;
  const photoWidth=img.naturalWidth,photoHeight=img.naturalHeight;
  if(!photoWidth||!photoHeight)throw new Error("Empty decoded backdrop");
  // The untouched Colosseum original is decoded at its intrinsic size.
  // AVIF source: cloud-veiled-colorful-fields.avif, 2400×1600,
  // SHA-256 80006c73c633b57a9a2e63d17df9bbf35e8c86bc6d23491a12600eb8911842f2. No image scaling occurs before GPU upload.
  if(photoWidth!==2400||photoHeight!==1600)
    throw new Error("Unexpected source image dimensions: "+photoWidth+"x"+photoHeight);
  audit.sourceImage=url;
  audit.sourcePixels=[photoWidth,photoHeight];
  const photo=device.createTexture({
    size:[photoWidth,photoHeight,1],format:"rgba8unorm",
    usage:GPUTextureUsage.TEXTURE_BINDING|
          GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT
  });
  if(root)root.dataset.gpuPhase="upload-scene-image";
  try{
    // Preferred path: browser decodes original AVIF directly into GPU pixels.
    device.queue.copyExternalImageToTexture({source:img},
      {texture:photo},[photoWidth,photoHeight]);
    audit.sourceUpload="direct-image";
  }catch(directError){
    let bitmap=null,bitmapError=null;
    try{
      bitmap=await createImageBitmap(img);
      device.queue.copyExternalImageToTexture({source:bitmap},
        {texture:photo},[photoWidth,photoHeight]);
      audit.sourceUpload="image-bitmap";
    }catch(error){
      bitmapError=error;
    }finally{
      bitmap?.close();
    }
    if(bitmapError){
      // Some Chrome/SwiftShader combinations decode AVIF correctly but
      // reject BOTH external-image GPU imports. Decode the same original
      // pixels, at exactly native dimensions, into a temporary 2D surface
      // and upload uncompressed RGBA8 pixels with correctly padded rows.
      // This is NOT a screenshot of the DOM or a resized/re-encoded image.
      // The AVIF source is still served unchanged, with its full 2400x1600
      // raster preserved; GPU source texture was RGBA8 in either path.
      const staging=document.createElement("canvas");
      staging.width=photoWidth;staging.height=photoHeight;
      const ctx=staging.getContext("2d",{willReadFrequently:true});
      if(!ctx)throw new Error("AVIF GPU import unavailable and 2D staging unsupported: "+
        String(directError)+" / "+String(bitmapError));
      ctx.drawImage(img,0,0,photoWidth,photoHeight);
      const rgba=ctx.getImageData(0,0,photoWidth,photoHeight).data;
      const rowBytes=photoWidth*4;
      const bytesPerRow=Math.ceil(rowBytes/256)*256;
      const pixels=bytesPerRow===rowBytes?rgba:new Uint8Array(bytesPerRow*photoHeight);
      if(bytesPerRow!==rowBytes){
        for(let row=0;row<photoHeight;row++)
          pixels.set(rgba.subarray(row*rowBytes,(row+1)*rowBytes),row*bytesPerRow);
      }
      device.queue.writeTexture({texture:photo},pixels,
        {bytesPerRow,rowsPerImage:photoHeight},
        [photoWidth,photoHeight,1]);
      audit.sourceUpload="native-size-rgba8-staging";
      staging.width=0;staging.height=0;
    }
  }

  const base="/assets/home-dashboard/";
  const sources=await Promise.all([
    "dashboard-gpu-scene.wgsl",
    "dashboard-gpu-mipmap.wgsl",
    "dashboard-gpu-glass.wgsl"
  ].map(async name=>{
    const r=await fetch(base+name);
    if(!r.ok)throw new Error(name+" HTTP "+r.status);
    return r.text();
  }));
  if(root)root.dataset.gpuPhase="compile-wgsl";
  sources[2]=(nativeF16?"enable f16;\n":"")+sources[2].replaceAll(
    "__ORACLE_HALF_BODY__",
    nativeF16?"return vec3<f32>(vec3<f16>(v));":"return v;");
  if(sources[2].includes("__ORACLE_HALF_BODY__"))
    throw Error("Native half-conversion shader specialization did not apply");
  const modules=sources.map((code,i)=>device.createShaderModule({
    label:["background","explicit mip reduction","oracle glass"][i],code
  }));
  await Promise.all(modules.map((x,i)=>compileCheck(x,["scene","mips","glass"][i])));
  device.pushErrorScope("validation");
  const backdropPipeline=device.createRenderPipeline({
    label:"GPU-owned scene -> mip0",
    layout:"auto",
    vertex:{module:modules[0],entryPoint:"vsScene"},
    fragment:{module:modules[0],entryPoint:"fsScene",
      targets:[{format:"rgba16float"}]},
    primitive:{topology:"triangle-list"}
  });
  const mipPipeline=device.createComputePipeline({
    label:"Explicit 2x2 real GPU mip level",
    layout:"auto",compute:{module:modules[1],entryPoint:"mip2x2"}
  });
  const copyPipeline=device.createRenderPipeline({
    label:"Mip0 scene -> display canvas",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsCopy"},
    fragment:{module:modules[2],entryPoint:"fsCopy",
      targets:[{format}]},primitive:{topology:"triangle-list"}
  });
  const glassPipeline=device.createRenderPipeline({
    label:"Oracle refraction per instanced tile; manual trilinear mip sampling",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsGlass"},
    fragment:{module:modules[2],entryPoint:"fsGlass",targets:[{
      format,blend:{
        color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},
        alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}
      }
    }]},primitive:{topology:"triangle-list"}
  });
  if(root)root.dataset.gpuPhase="validate-pipelines";
  const pipelineError=await device.popErrorScope();
  if(pipelineError)throw Error("GPU pipeline validation: "+pipelineError.message);
  const sampler=device.createSampler({
    magFilter:"linear",minFilter:"linear",mipmapFilter:"nearest",
    addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"
  });
  const globalsBuffer=device.createBuffer({
    size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
  });
  let tileBuffer=null,tintTileBuffer=null,scene=null,sceneView=null,mipGroups=[],copyGroup=null,
    glassGroup=null,backgroundGroup=null,offscreenFrame=null,
    tileCount=0,instanceCount=0,physicalWidth=0,physicalHeight=0,
    dpr=1,sceneTop=0;
  let tintData=new Float32Array(0),lastTintKey="";
  let trackTiles=[],trackIcons=[],trackRows=[],trackColumns=[],
    baseTileX=new Float32Array(0),baseTileY=new Float32Array(0),
    pitchCSS=0,trackOpacity=new Float32Array(0),
    dismissProgress=new Float32Array(0),cornerInert=new Uint8Array(0);
  const uniform=new Float32Array(20);
  let tileData=new Float32Array(0);
  function writeUniform(){
    uniform[0]=physicalWidth;
    uniform[1]=physicalHeight;
    uniform[2]=(performance.now()-start)/1000;
    uniform[3]=dpr;
    const fit=coverUVScale(physicalWidth,physicalHeight,photoWidth,photoHeight);
    uniform[4]=fit[0];uniform[5]=fit[1];uniform[6]=.12;uniform[7]=0;
    uniform[8]=pointer.x*dpr;uniform[9]=(pointer.y-sceneTop)*dpr;
    uniform[10]=pointer.enabled;uniform[11]=0;
    const t=tint.state;
    // Authored tint RGB; scheme-specific native vibrantColorMatrix is NOT a hue transform.\n    uniform[12]=t.rgb[0];uniform[13]=t.rgb[1];uniform[14]=t.rgb[2];uniform[15]=t.opacity;
    uniform[16]=t.active?1:0;uniform[17]=t.scheme==="dark"?1:0;
    uniform[18]=0;uniform[19]=0;
    device.queue.writeBuffer(globalsBuffer,0,uniform);
  }
  function syncTileTints(force=false){
    const value=tint.state,panes=authPaneElements(),scheme=authGlassScheme();
    const roles=panes.map(node=>node.hasAttribute("data-auth-glass-card")?
      "card":node.hasAttribute("data-auth-glass-submit")?"submit":"neutral");
    const key=value.name+"|"+value.opacity+"|"+value.scheme+"|"+tileCount+
      "|"+scheme+"|"+roles.join(",");
    if(!force&&key===lastTintKey)return;
    lastTintKey=key;
    const counts={};
    for(let i=0;i<tileCount;i++){
      const m=tintForTile(value,i),at=4*i;
      tintData[at]=m.rgb[0];tintData[at+1]=m.rgb[1];
      tintData[at+2]=m.rgb[2];tintData[at+3]=m.active?m.opacity:0;
      counts[m.name]=(counts[m.name]||0)+1;
    }
    for(let i=0;i<AUTH_PANE_CAPACITY;i++){
      const pane=panes[i],at=4*(tileCount+i);
      const m=pane?authPaneTint(pane,scheme):tintParameters("none",0,scheme);
      tintData[at]=m.rgb[0];tintData[at+1]=m.rgb[1];
      tintData[at+2]=m.rgb[2];tintData[at+3]=m.active?m.opacity:0;
    }
    if(tintData.length)device.queue.writeBuffer(tintTileBuffer,0,tintData);
    audit.tintCounts=counts;
    audit.tintShowcase=value.name==="showcase"?
      {hues:[...SHOWCASE_TINTS],opacityTiers:[...SHOWCASE_OPACITIES]}:null;
  }
  function paintAuthPanes(){
    const panes=authPaneElements(),scheme=authGlassScheme();
    const card=panes[0];
    const opacity=card?Math.max(0,Math.min(1,
      Number.parseFloat(getComputedStyle(card).opacity)||0)):0;
    const roles=[];
    // Read the live Framer Motion rect, not an image capture. The shader
    // handles geometry optics, tint and interaction for all instances.
    for(let i=0;i<AUTH_PANE_CAPACITY;i++){
      const slot=tileCount+i,p=slot*TILE_FLOATS,node=panes[i];
      if(!node){
        tileData.fill(0,p,p+TILE_FLOATS);
        tileData[p]=-100000;tileData[p+1]=-100000;
        tileData[p+2]=1;tileData[p+3]=1;
        tileData[p+5]=-2;tileData[p+7]=4;
        cornerInert[slot]=1;
        continue;
      }
      tileData.set(makeLayoutData(node,dpr,sceneTop),p);
      // -2 dark / -3 light selects the identical shader's auth-pane path.
      tileData[p+5]=scheme==="dark"?-2:-3;
      tileData[p+18]=opacity;tileData[p+19]=0;
      cornerInert[slot]=opacity<.025?1:0;
      roles.push(node.hasAttribute("data-auth-glass-card")?
        "card":node.hasAttribute("data-auth-glass-submit")?"submit":"control");
    }
    interaction.retargetRects(tileData,cornerInert);
    audit.authGlass={renderer:"shared-webgpu-glassPipeline",count:roles.length,
      roles,scheme,cardTint:"none",
      neutralControlTints:scheme==="dark"?"black / white primary":"white / black primary",
      hovered:interaction.focusedTile>=tileCount,opacity};
    return Boolean(card&&opacity<.999);
  }
  function rebuild(){
    if(stopped)return;
    const viewport=actualSceneViewport();
    sceneTop=viewport.top;
    dpr=window.devicePixelRatio||1;
    const w=Math.max(1,Math.floor(window.innerWidth*dpr));
    const h=Math.max(1,Math.floor(viewport.height*dpr));
    if(w>device.limits.maxTextureDimension2D||h>device.limits.maxTextureDimension2D)
      throw new Error("Visible image region exceeds GPU maxTextureDimension2D");
    const sized=w!==physicalWidth||h!==physicalHeight||!scene;
    physicalWidth=w;physicalHeight=h;
    document.body.style.setProperty("--dashboard-scene-top",sceneTop+"px");
    audit.sceneTopCSS=sceneTop;
    audit.sceneCSSHeight=viewport.height;
    canvas.style.top=sceneTop+"px";
    canvas.style.width=window.innerWidth+"px";
    canvas.style.height=viewport.height+"px";
    if(sized){
      canvas.width=w;canvas.height=h;
      scene?.destroy();
      offscreenFrame?.destroy();
      if(OFFSCREEN_CI){
        // CI-only: Linux SwiftShader GPU can compute/render correctly yet
        // cannot create a headless WebGPU swapchain SharedImage. Exercise
        // actual GPU draw+compute passes using a physical offscreen texture.
        // This does NOT validate OS window presentation on Apple hardware.
        offscreenFrame=device.createTexture({
          size:[w,h,1],format,
          usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC
        });
      }
      scene=rgba16Texture(device,w,h);
      sceneView=scene.createView();
      audit.mipCount=scene.mipLevelCount;
      backgroundGroup=device.createBindGroup({
        layout:backdropPipeline.getBindGroupLayout(0),
        entries:[
          {binding:0,resource:photo.createView()},
          {binding:1,resource:sampler},
          {binding:2,resource:{buffer:globalsBuffer}}
        ]
      });
      mipGroups=[];
      for(let level=1;level<scene.mipLevelCount;level++){
        mipGroups.push(device.createBindGroup({
          layout:mipPipeline.getBindGroupLayout(0),
          entries:[
            {binding:0,resource:scene.createView({
              baseMipLevel:level-1,mipLevelCount:1})},
            {binding:1,resource:scene.createView({
              baseMipLevel:level,mipLevelCount:1})}
          ]
        }));
      }
      copyGroup=device.createBindGroup({
        layout:copyPipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:sceneView}]
      });
      scenePending=true;
    }
    // Reset only compositor transforms for truthful baseline grid metrics.
    // A resize synchronously reapplies track motion in the same GPU frame.
    const all=activeTiles();
    for(const tile of all){tile.style.transform="";tile.style.opacity="";}
    const cells=[...root.querySelectorAll(".cta6-tile")];
    const rowIndex=new Map(cells.map((cell,i)=>[cell,Math.floor(i/11)]));
    const columnIndex=new Map(cells.map((cell,i)=>[cell,i%11]));
    // offsetTop is invariant under CSS transform and entrance animations.
    pitchCSS=cells[11]?.offsetTop-cells[0]?.offsetTop;
    if(!(pitchCSS>0))throw new Error("Original six-row pitch unavailable");
    trackTiles=all;
    trackIcons=all.map(cell=>cell.querySelector(".cta6-icon"));
    trackRows=all.map(cell=>rowIndex.get(cell));
    trackColumns=all.map(cell=>columnIndex.get(cell));
    if(trackRows.some(row=>row===undefined||row<0||row>6)||
        trackColumns.some(column=>column===undefined||column<0||column>10))
      throw new Error("Invalid seven-row, eleven-column moving glass geometry");
    const source=makeTileFloatData(all,dpr,sceneTop);
    instanceCount=all.length+AUTH_PANE_CAPACITY;
    const data=new Float32Array(instanceCount*TILE_FLOATS);
    data.set(source);
    baseTileX=new Float32Array(all.map((_,i)=>data[i*TILE_FLOATS]));
    baseTileY=new Float32Array(all.map((_,i)=>data[i*TILE_FLOATS+1]));
    trackOpacity=new Float32Array(all.length);
    dismissProgress=new Float32Array(all.length);
    cornerInert=new Uint8Array(instanceCount);
    cornerInert.fill(1,all.length);
    tileCount=all.length;audit.tiles=tileCount;
    interaction.configure([
      ...all.map((_,i)=>Array.from(data.subarray(i*TILE_FLOATS,i*TILE_FLOATS+4))),
      ...Array.from({length:AUTH_PANE_CAPACITY},()=>[-100000,-100000,1,1])
    ]);
    interaction.writeTo(data);
    tileData=data;
    tintData=new Float32Array(instanceCount*4);
    audit.sdfModes={
      mode4:all.filter(t=>selectModeForNormalizedCorners([
        getComputedStyle(t).borderTopLeftRadius,
        getComputedStyle(t).borderTopRightRadius,
        getComputedStyle(t).borderBottomRightRadius,
        getComputedStyle(t).borderBottomLeftRadius
      ])===4).length
    };
    audit.sdfModes.mode5=tileCount-audit.sdfModes.mode4;
    tileBuffer?.destroy();
    tileBuffer=device.createBuffer({
      size:Math.max(48,data.byteLength),
      usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST
    });
    if(data.length)device.queue.writeBuffer(tileBuffer,0,data);
    tintTileBuffer?.destroy();
    tintTileBuffer=device.createBuffer({
      size:Math.max(16,tintData.byteLength),
      usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST
    });
    lastTintKey="";
    syncTileTints(true);
    glassGroup=device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:sceneView},
        {binding:1,resource:{buffer:tileBuffer}},
        {binding:2,resource:{buffer:globalsBuffer}},
        {binding:3,resource:{buffer:tintTileBuffer}}
      ]
    });
  }
  function buildScene(){
    const encoder=device.createCommandEncoder({label:"Scene & full real mip chain"});
    const pass=encoder.beginRenderPass({colorAttachments:[{
      view:scene.createView({baseMipLevel:0,mipLevelCount:1}),
      loadOp:"clear",clearValue:[0.04,0.04,0.04,1],storeOp:"store"
    }]});
    pass.setPipeline(backdropPipeline);
    pass.setBindGroup(0,backgroundGroup);
    pass.draw(3);
    pass.end();
    for(let level=1;level<scene.mipLevelCount;level++){
      const next=encoder.beginComputePass({label:"mip level "+level});
      next.setPipeline(mipPipeline);
      next.setBindGroup(0,mipGroups[level-1]);
      next.dispatchWorkgroups(Math.ceil(Math.max(1,physicalWidth>>level)/8),
        Math.ceil(Math.max(1,physicalHeight>>level)/8),1);
      next.end();
    }
    device.queue.submit([encoder.finish()]);
    scenePending=false;
    audit.sceneBuilds++;
  }
  function paintTrack(deltaSeconds){
    if(trackRunning)
      trackSeconds+=Math.max(0,Math.min(.05,deltaSeconds));
    const phase=phaseAtSeconds(trackSeconds);
    const elapsedDismiss=restoreStart!==null
      ? Math.max(0,DISMISS_MS-(performance.now()-restoreStart))
      : dismissStart===null?-1:performance.now()-dismissStart;
    if(restoreStart!==null&&elapsedDismiss<=0){
      restoreStart=null;
      trackResumeRequested=false;
    }
    let fading=0;
    for(let i=0;i<trackTiles.length;i++){
      const pos=trackPosition(trackRows[i],phase,trackColumns[i]);
      const dy=pos.deltaRows*pitchCSS;
      const dissolving=elapsedDismiss<0?0:
        tileDismissProgress(elapsedDismiss,trackRows[i],trackColumns[i]);
      const p=i*TILE_FLOATS;
      const drift=tileDismissDrift(dissolving,trackRows[i],trackColumns[i],
        baseTileX[i],tileData[p+2],physicalWidth,dpr);
      const shrink=tileDismissScale(dissolving);
      dismissProgress[i]=dissolving;
      tileData[i*TILE_FLOATS]=baseTileX[i]+drift.x*dpr;
      tileData[i*TILE_FLOATS+1]=baseTileY[i]+(dy+drift.y)*dpr;
      const sideOpacity=trackSideOpacity(pos.slot,trackColumns[i]);
      const combinedOpacity=pos.opacity*sideOpacity;
      trackOpacity[i]=combinedOpacity;
      // Only nearly imperceptible squares in the deep side corners stop
      // receiving cursor hits. Everywhere else, hover/press stays unchanged.
      cornerInert[i]=sideOpacity<0.9999&&combinedOpacity<0.025?1:0;
      // Actual DOM SVG icons and GPU glass share the same CPU frame.
      // The tile parent's opacity is the very same combined track opacity
      // the fragment shader uses. For WebGPU presentation the DOM mosaic
      // mask is removed (it hard-clipped translating icons at the grid
      // bounds), so the SVG additionally needs only the shader's spatial
      // side-edge + oval alpha, evaluated at its current scene position.
      trackTiles[i].style.transform="translate3d("+drift.x.toFixed(3)+"px,"+
        (dy+drift.y).toFixed(3)+"px,0) scale("+
        shrink.x.toFixed(5)+","+shrink.y.toFixed(5)+")";
      trackTiles[i].style.opacity=(combinedOpacity*
        tileDismissIconOpacity(dissolving)).toFixed(5);
      // The DOM icon follows its own refracting square's brief local
      // fade and softening. No synthetic gray smoke replaces the glass.
      if(dissolving>0&&trackIcons[i]){
        trackIcons[i].style.filter="blur("+tileDismissBlur(dissolving).toFixed(3)+"px)";
      }
      else if(trackIcons[i])trackIcons[i].style.filter="";
      if(trackIcons[i]){
        const glyphAlpha=publicIconSpatialAlpha(
          tileData[p]+tileData[p+2]*0.5,
          tileData[p+1]+tileData[p+3]*0.5,
          tileData[p+2],physicalWidth,physicalHeight,dpr);
        trackTiles[i].style.setProperty("--public-icon-spatial-alpha",
          glyphAlpha.toFixed(5));
      }
      if(combinedOpacity<.9999)fading++;
    }
    // Hover targets follow the moving glass instead of static grid slots.
    interaction.retargetRects(tileData,cornerInert);
    audit.track={
      running:trackRunning,phase,elapsed:trackSeconds,
      cycleSeconds:TRACK_SECONDS,pitchCSS,rows:7,columns:11,
      fadeContours:"upper convex, lower concave; permanent outward-bowed left/right",
      dismissal:"X-close local optical decoherence, provisional; no smoke or swipe",
      dismissElapsed:elapsedDismiss,dismissed:elapsedDismiss>=DISMISS_MS,
      fadedTiles:fading
    };
  }
  function render(){
    // Also sample reduced-motion preference on every active frame. Some
    // headless/host browsers do not dispatch a MediaQueryList change event
    // when system preferences are changed while WebGPU is already active.
    const allowTrack=homeActive()&&root?.dataset.gpuStatus==="ready"&&
      !reducedMotion.matches&&(trackResumeRequested||
        (dismissStart===null&&restoreStart===null));
    if(trackRunning!==allowTrack){
      trackRunning=allowTrack;
      if(!allowTrack&&dismissStart===null&&restoreStart===null)trackSeconds=0;
    }
    writeUniform();
    if(scenePending)buildScene();
    const now=performance.now();
    const dt=Math.max(0,(now-lastFrameTime)/1000);
    lastFrameTime=now;
    if(tileCount)paintTrack(dt);
    const authAnimating=paintAuthPanes();
    syncTileTints();
    const animating=interaction.advance(dt,reducedMotion.matches);
    if(instanceCount){
      interaction.writeTo(tileData);
      // motion.z is the independent end-of-track transparency; the
      // interaction adapter owns only hover/press, not track opacity.
      for(let i=0;i<tileCount;i++){
        tileData[i*TILE_FLOATS+18]=trackOpacity[i];
        tileData[i*TILE_FLOATS+19]=dismissProgress[i];
      }
      device.queue.writeBuffer(tileBuffer,0,tileData);
    }
    const encoder=device.createCommandEncoder({label:"Glass only frame"});
    const pass=encoder.beginRenderPass({
      colorAttachments:[{view:OFFSCREEN_CI?
          offscreenFrame.createView():context.getCurrentTexture().createView(),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]
    });
    pass.setPipeline(copyPipeline);pass.setBindGroup(0,copyGroup);
    pass.draw(3);
    if(instanceCount){
      pass.setPipeline(glassPipeline);pass.setBindGroup(0,glassGroup);
      pass.draw(6,instanceCount);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
    audit.frameCount++;
    audit.focusedTile=interaction.focusedTile;
    audit.pressed=interaction.isPressed;
    audit.tint=tint.state;
    return animating||authAnimating;
  }
  function dispose(){
    tileBuffer?.destroy();tintTileBuffer?.destroy();
    scene?.destroy();offscreenFrame?.destroy();photo.destroy();
    globalsBuffer.destroy();
  }
  await waitForVisibleHome();
  engine={rebuild,render,dispose,device};
  if(root)root.dataset.gpuPhase="submit-first-gpu-frame";
  rebuild();
  render();
  // A valid initial command buffer has been submitted. Reject GPU pipeline
  // errors before removing the CSS fallback background.
  if(root)root.dataset.gpuPhase="wait-first-gpu-frame";
  await device.queue.onSubmittedWorkDone();
  if(OFFSCREEN_CI){
    // CI-only GPU byte-level output proof (NOT screenshot acceptance and
    // NOT a CPU backdrop copy). Verify that the actual fragment result
    // reaches a nontransparent output attachment on a software GPU.
    const readback=device.createBuffer({
      size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ
    });
    const encoder=device.createCommandEncoder({label:"One-pixel CI byte proof"});
    encoder.copyTextureToBuffer(
      {texture:offscreenFrame,
       origin:{x:Math.floor(physicalWidth/2),y:Math.floor(physicalHeight/2),z:0}},
      {buffer:readback,bytesPerRow:256,rowsPerImage:1},
      {width:1,height:1,depthOrArrayLayers:1}
    );
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const rgba=Array.from(new Uint8Array(readback.getMappedRange()).slice(0,4));
    readback.unmap();
    readback.destroy();
    if(rgba[3]!==255)throw Error("GPU offscreen output alpha proof failed: "+rgba);
    audit.offscreenPixelProof=rgba;
  }
  document.body.dataset.gpuScene=OFFSCREEN_CI?"offscreen-proof":"ready";
  audit.status="ready";
  root.dataset.gpuRenderer="webgpu";
  root.dataset.gpuPresentation=OFFSCREEN_CI?"offscreen-ci":"visible-canvas";
  root.dataset.gpuStatus="ready";
  root.dataset.gpuPhase="ready";
  root.dataset.gpuMipLevels=String(audit.mipCount);
  root.dataset.gpuSdfModes=JSON.stringify(audit.sdfModes);
  root.dataset.gpuTileCount=String(audit.tiles);
  document.querySelectorAll(".cta6-tile--plain,.cta6-tile--icon")
    .forEach(tile=>tile.classList.add("cta6-tile--webgpu"));
  trackRunning=!reducedMotion.matches&&(trackResumeRequested||
    (dismissStart===null&&restoreStart===null));
  lastFrameTime=performance.now();
  reducedMotion.addEventListener?.("change",()=>{
    if(stopped)return;
    trackRunning=!reducedMotion.matches&&(trackResumeRequested||
      (dismissStart===null&&restoreStart===null));
    if(reducedMotion.matches&&dismissStart===null&&restoreStart===null)trackSeconds=0;
    requestRender();
  });
  // Browser-only interaction model. No DOM screenshot, no scene/mip rebuild,
  // no global mutable native material. Each tile keeps independent spring state.
  const movePointer=event=>{
    if(activePointerId!==null&&event.pointerId!==activePointerId)return;
    if(event.pointerType==="touch"&&activePointerId===null)return;
    pointer.x=event.clientX;pointer.y=event.clientY;pointer.enabled=1;
    interaction.move(event.clientX*dpr,(event.clientY-sceneTop)*dpr);
    requestRender();
  };
  const downPointer=event=>{
    if(event.isPrimary===false||event.button>0 ||
       (activePointerId!==null&&activePointerId!==event.pointerId))return;
    activePointerId=event.pointerId;
    interaction.move(event.clientX*dpr,(event.clientY-sceneTop)*dpr);
    interaction.setPressed(true);
    requestRender();
  };
  const upPointer=event=>{
    if(activePointerId!==event.pointerId)return;
    activePointerId=null;interaction.setPressed(false);
    if(event.pointerType==="touch"){pointer.enabled=0;interaction.clear();}
    else interaction.move(event.clientX*dpr,(event.clientY-sceneTop)*dpr);
    requestRender();
  };
  const cancelPointer=event=>{
    if(activePointerId!==null&&event.pointerId!==activePointerId)return;
    activePointerId=null;pointer.enabled=0;interaction.clear();requestRender();
  };
  window.addEventListener("pointermove",movePointer,{passive:true});
  window.addEventListener("pointerdown",downPointer,{passive:true});
  window.addEventListener("pointerup",upPointer,{passive:true});
  window.addEventListener("pointercancel",cancelPointer,{passive:true});
  window.addEventListener("pointerout",event=>{
    if(event.relatedTarget)return;
    cancelPointer(event);
  },{passive:true});
  window.addEventListener("blur",()=>{
    activePointerId=null;pointer.enabled=0;interaction.clear();requestRender();
  });
  audit.interaction="per-tile browser-only hover/press spring, pointer/touch/pen";
  audit.iconFade="track-alpha inherited + shader-matched per-glyph spatial alpha; no DOM mosaic clipping";
  // Continuous-GPU resize contract:
  // CSS glass and WebGPU glass use DIFFERENT face/color models. Switching
  // to CSS glass during resize caused the user-visible tint/scheme flash.
  // Never change the presentation mode when the window is resized.
  // The resize event (or pre-paint ResizeObserver delivery) synchronously
  // updates the backing dimensions, scene, mip pyramid and tile geometry,
  // then submits a matching GPU frame before returning to the browser.
  // An older GPU canvas is never laid out at the new CSS size for a paint.
  // GPU completion is recorded for telemetry, never used as a color swap.
  // React mounts/unmounts and animates route panes independently.
  // Wake this same GPU frame loop without ever capturing DOM pixels.
  const routeOutlet=document.getElementById("public-route-content");
  const authObserver=routeOutlet?new MutationObserver(()=>requestRender()):null;
  if(routeOutlet)authObserver.observe(routeOutlet,{
    childList:true,subtree:true,attributes:true,
    attributeFilter:["style","class","disabled"]
  });
  let resizeGeneration=0;
  const layoutKey=()=>{
    const viewport=actualSceneViewport(),b=root.getBoundingClientRect();
    return [innerWidth,innerHeight,devicePixelRatio||1,viewport.top,
      viewport.height,b.left,b.top,b.width,b.height].join("|");
  };
  let lastLayoutKey=layoutKey();
  audit.resizePresentation="continuous-webgpu";
  audit.resizePending=false;
  const onSize=()=>{
    if(stopped||!homeActive())return;
    const nextKey=layoutKey();
    if(nextKey===lastLayoutKey)return;
    lastLayoutKey=nextKey;
    const generation=++resizeGeneration;
    audit.resizeEvents=(audit.resizeEvents||0)+1;
    audit.resizePending=true;
    try{
      // Do not defer this with requestAnimationFrame: the browser must never
      // paint the old GPU backing pixels stretched to the new CSS viewport.
      engine.rebuild();
      engine.render();
      audit.resizeSubmissions=(audit.resizeSubmissions||0)+1;
      audit.resizeSubmittedFrame=audit.frameCount;
      audit.resizePending=false;
      device.queue.onSubmittedWorkDone().then(()=>{
        if(stopped||generation!==resizeGeneration)return;
        audit.resizeCompletions=(audit.resizeCompletions||0)+1;
      }).catch(fallback);
    }catch(error){fallback(error);}
  };
  // The explicit invalidation contract for future moving squares/content:
  // reflowTiles rewrites only tile positions; invalidateBackdrop triggers
  // the scene+mip rebuild. Neither action reads rendered DOM pixels.
  window.__dashboardGpuControls=Object.freeze({
    reflowTiles:()=>{if(!stopped){engine.rebuild();requestRender()}},
    invalidateBackdrop:()=>{if(!stopped){scenePending=true;requestRender()}}
  });
  window.addEventListener("resize",onSize,{passive:true});
  const resizeObserver=new ResizeObserver(onSize);
  resizeObserver.observe(root);
  device.lost.then(reason=>{
    authObserver?.disconnect();
    resizeObserver.disconnect();
    fallback("GPU device lost: "+reason.message);
  });
  requestRender();
}
// The production workspace keeps all other screens mounted but hidden.
// Suspend GPU animation outside Home, then revalidate dimensions on reentry.
function syncDashboardRoute(){
  if(!engine||stopped)return;
  if(!homeActive()){
    trackRunning=false;
    if(raf){cancelAnimationFrame(raf);raf=0;}
    return;
  }
  try{
    engine.rebuild();
    engine.render();
    trackRunning=!reducedMotion.matches;
    lastFrameTime=performance.now();
    requestRender();
  }catch(error){void fallback(error);}
}
window.addEventListener?.("hashchange",()=>queueMicrotask(syncDashboardRoute));
window.addEventListener?.("popstate",()=>queueMicrotask(syncDashboardRoute));
initialize().catch(fallback);
