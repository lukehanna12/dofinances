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
import {createAuthGlassHoverController} from "./dashboard-auth-hover.js";
import {authBackdropOffsetCSS} from "./dashboard-scroll-optics.js";
import {normalizeGlassCornerRadii,glassPaneNeedsLiveTransform,
 resolveGlassSurface,selectGlassSdfMode,surfaceContentFromElement,
 planGlassLayers,GLASS_INTERACTION,projectFiniteNativeClearGlass}
 from "./dashboard-glass-model.js";
import {createTintControls,tintForTile,tintParameters,SHOWCASE_TINTS,SHOWCASE_OPACITIES} from "./dashboard-tint.js";
import {TRACK_SECONDS,phaseAtSeconds,trackPosition,trackSideOpacity} from "./dashboard-track.js";
import {publicIconSpatialAlpha} from "./dashboard-public-icon-fade.js";
import {DISMISS_MS,tileDismissProgress,tileDismissIconOpacity,tileDismissScale,tileDismissDrift,tileDismissBlur} from "./dashboard-public-dismiss.js";

// Layer zero is the live mosaic. Layer one samples its completed GPU
// composite. A layer never samples the texture it is writing.
const PUBLIC_HOME_GLASS_LAYERS=planGlassLayers([
 {id:"mosaic",layer:0,backdrop:"scene"},
 {id:"home-cta",layer:1,backdrop:"previous-layer"}
]);
const OFFSCREEN_CI=typeof location!=="undefined" &&
  new URLSearchParams(location.search).get("webgpu-offscreen-ci")==="1";
const root=document.getElementById("cta6-mosaic");
if(root)root.dataset.gpuStatus="module-loaded";
const canvas=document.createElement("canvas");
const authCanvas=document.createElement("canvas");
const authUsesCompositor=()=>document.body.dataset.authGlassMode==="compositor";
const authCanvasFixed=()=>document.body.dataset.authScrollMode==="fixed";
const routeOutlet=document.getElementById("public-route-content");
const routeMount=document.getElementById("public-route-stage");
// Native (legacy rollback): the canvas scrolls with the document-sized card.
// Fixed (default): the very same WebGPU surface stays fixed to the
// wallpaper; only the live pane rectangles follow the native scroll. This
// prevents a compositor-scrolled stale photo. Pane geometry continues to
// update using native scrolling positions when each WebGPU frame is submitted.
const authOriginTop=()=>authCanvasFixed()
  ? (authCanvas.isConnected?authCanvas.getBoundingClientRect().top:44)
  : (routeMount?.getBoundingClientRect().top ?? 44);
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
// Login and Projects reuse the exact homepage WebGPU material.
// Up to 16 live cards, 8 header controls, one X, and five temporary
// dissolving rowmates share this EXACT WebGPU glass pipeline.
const AUTH_PANE_CAPACITY=32;
const HOME_CTA_SELECTOR=".cta6-bottom-action > [data-home-cta-glass]";
// The Projects header and individually displaced project cards share the
// homepage squares' actual shader dismissal; login and original tiles stay intact.
const PROJECT_HEADER_DISMISS_ROLES=new Set([
  "back","title","search","search-field","search-cancel",
  "filter","filter-dropdown","github"
]);
function authPaneElements(){
  const card=document.querySelector(".auth3-root [data-auth-glass-card]");
  if(card)return [card,...card.querySelectorAll(
    '[data-auth-glass-input],[data-auth-glass-submit],[data-auth-glass-provider]'
  )].slice(0,AUTH_PANE_CAPACITY);
  const projects=document.querySelector(".public-projects-root");
  if(!projects)return [...document.querySelectorAll(HOME_CTA_SELECTOR)].slice(0,3);
  const all=[...projects.querySelectorAll("[data-public-project-glass]")];
  // The dropdown overlays the cards in the route-owned DOM stack; draw its
  // very same glass pane LAST so the GPU material obeys that stacking order.
  const top=all.filter(node=>
    ["filter-dropdown","expand-close"].includes(node.dataset.publicProjectGlass));
  // The route's CSS z-order cannot reorder instances inside one WebGPU
  // draw call. Disappearing old-row silhouettes must be composited BEHIND
  // the widening selected pane, or their glass looks like it reappears
  // above that pane while the real DOM is already behind it.
  const ghosts=all.filter(node=>
    node.classList.contains("project-showcase-dissolve-ghost"));
  const expanded=all.filter(node=>node.classList.contains("is-expanded"));
  const base=all.filter(node=>
    !["filter-dropdown","expand-close"].includes(node.dataset.publicProjectGlass)&&
    !node.classList.contains("project-showcase-dissolve-ghost")&&
    !node.classList.contains("is-expanded"));
  return [...ghosts,...base,...expanded,...top].slice(0,AUTH_PANE_CAPACITY);
}
const authGlassScheme=()=>document.documentElement.dataset.dofTheme==="light"?
  "light":"dark";
// Negative route markers select only route-owned material variants.
// -2 is the untinted card; -7 is the separate untinted back chip,
// -4 primary, -5 social sign-in and -6 text input. Squares are unchanged.
function authPaneMaterialTag(node){
  if(node.hasAttribute("data-home-cta-glass"))return -9;
  if(node.dataset.publicProjectGlass==="title")return -8;
  if(node.classList.contains("auth3-back-link")||
     node.dataset.publicProjectGlass==="back"||
     node.dataset.publicProjectGlass==="expand-close")return -7;
  if(node.hasAttribute("data-auth-glass-submit"))return -4;
  if(node.hasAttribute("data-auth-glass-input"))return -6;
  if(node.hasAttribute("data-auth-glass-provider")&&
     !node.classList.contains("auth3-back-link"))return -5;
  return -2;
}
function authPaneTint(node,scheme){
  if(node.hasAttribute("data-home-cta-glass")){
    // The same computed CSS transition value drives tint and scale timing.
    const raw=Number.parseFloat(getComputedStyle(node).getPropertyValue("--home-cta-tint"));
    const t=Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):0;
    return tintParameters("#061b10",t*.95,scheme);
  }
  if(node.hasAttribute("data-public-project-glass")||
     node.hasAttribute("data-auth-glass-card")||
     node.classList.contains("auth3-back-link"))
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
  mipCount:0,sceneBuilds:0,frameCount:0,tiles:0,errors:[],
  authScrollPresentation:authCanvasFixed()?"fixed-viewport":"native-content"
};
Object.defineProperty(window,"__dashboardWebGPU",{
  configurable:true,get:()=>Object.freeze({...audit,errors:[...audit.errors]})
});
const start=performance.now();
const pointer={x:-1e6,y:-1e6,enabled:0};
let stopped=false,raf=0,engine=null,scenePending=false;
let pointerPressFramePending=false;
const interaction=createInteractionController();
// Auth-only nested hover; all homepage square lanes remain owned by interaction.
const authHover=createAuthGlassHoverController(AUTH_PANE_CAPACITY);
const tint=createTintControls(requestRender);
const reducedMotion=typeof window.matchMedia==="function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : {matches:false};
let activePointerId=null,lastFrameTime=performance.now(),lastAuthFrameTime=lastFrameTime;
let trackSeconds=0,trackRunning=false,lastMotionSubmission=0;
let dismissStart=document.body.dataset.publicRoute==="leaving"
  ? performance.now()-DISMISS_MS : null;
let restoreStart=null;
// Independent of tile visibility: resume the track clock immediately when
// the route-owned sign-in card begins its reversed exit.
let trackResumeRequested=false;
const TRACK_FRAME_INTERVAL=1000/30;
// Elastic overscroll can continue after the last scrollTop event. Keep
// sampling the actual on-screen glass position through its decay.
let authScrollRefreshUntil=0;
const AUTH_ELASTIC_SETTLE_MS=900;
// A single event starts the transition even while first GPU initialization
// is pending; the CSS-only fallback remains available if GPU never starts.
window.addEventListener("dofinances:home-dismiss",event=>{
  if(dismissStart!==null&&restoreStart===null)return;
  dismissStart=performance.now()-(event.detail?.durationMs===0?DISMISS_MS:0);
  restoreStart=null;trackResumeRequested=false;trackRunning=false;
  requestRender();
});
window.addEventListener("dofinances:home-track-resume",()=>{
  // Sent by the shared router before the sign-in card's shortened exit Motion.
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
    if(trackRunning&&!pointerPressFramePending&&
       performance.now()-lastMotionSubmission<TRACK_FRAME_INTERVAL&&
       performance.now()>=authScrollRefreshUntil){
      // Maintain the original 30fps square track clock, while allowing the
      // exiting sign-in glass to follow Motion between those heavy full-scene
      // submissions. This pass never draws/advances a square.
      if(["exiting","login","projects"].includes(window.__dofPublicRouter?.state)&&
         document.body.dataset.authGpuScene==="ready"){
        try{engine.renderAuthOnly()}catch(error){void fallback(error);return;}
      }
      requestRender();return;
    }
    // A CTA pointer-down/up deserves the next available RAF even when
    // the moving-square scene is throttled to 30fps. This prioritizes
    // only discrete press edges, not every mousemove or full animation.
    pointerPressFramePending=false;
    lastMotionSubmission=performance.now();
    let animating=false;
    try{
      // The native backdrop remains synchronized independently of GPU
      // scroll frames; render only the original local optical response.
      if(["login","projects"].includes(window.__dofPublicRouter?.state)&&
         document.body.dataset.authGpuScene==="ready"&&
         (authUsesCompositor()||performance.now()<authScrollRefreshUntil)){
        animating=engine.renderAuthOnly();
      }else{
        animating=engine.render();
      }
    }catch(e){void fallback(e);return;}
    if(!stopped&&(animating||trackRunning||
      (!authUsesCompositor()&&performance.now()<authScrollRefreshUntil)||
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
  document.body.dataset.authGpuScene="fallback";
  authCanvas.remove();
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
  // Shared public geometry: one resolver for squares, cards, capsules,
  // rectangles, circles and foreground content.
  const b=tile.getBoundingClientRect();
  const live=tile.hasAttribute("data-home-cta-glass")||
    glassPaneNeedsLiveTransform(tile.dataset?.publicProjectGlass);
  const layoutW=Math.max(1,tile.offsetWidth),layoutH=Math.max(1,tile.offsetHeight);
  const w=live?Math.max(1,b.width):layoutW;
  const h=live?Math.max(1,b.height):layoutH;
  const x=live?b.left:b.left+b.width*.5-w*.5;
  const y=(live?b.top:b.top+b.height*.5-h*.5)-sceneTop;
  const style=getComputedStyle(tile);
  // Isotropic min-axis radius scaling of an anisotropic CSS transform
  // is an explicit browser adapter, not an Oracle-proved native route.
  const s=live?Math.min(w/layoutW,h/layoutH):1;
  const corners=normalizeGlassCornerRadii([
    style.borderTopLeftRadius,style.borderTopRightRadius,
    style.borderBottomRightRadius,style.borderBottomLeftRadius
  ],layoutW,layoutH).map(v=>v*s);
  const surface=resolveGlassSurface({
    width:w,height:h,scale,radii:corners,
    content:surfaceContentFromElement(tile)
  });
  const delay=Number.parseFloat(style.getPropertyValue("--cta6-delay"))||0;
  const radius=nativePublicBlurRadius("clear",w,h);
  const blurWord=observedBlurWord(radius,1,.25);
  return [x*scale,y*scale,surface.width,surface.height,
    surface.radius,delay,blurWord,surface.renderMode,
    ...surface.cornerLanes,
    0,0,surface.width*.5,surface.height*.5,0,0,0,0];
}
// Mirrors the native AArch64 FCMP/FCCMP mode gate; the caller is responsible
// for supplying correctly normalized private lanes. CSS -> private producer
// remains unproved, and is never silently identified with this comparator.
export function selectModeForNormalizedCorners(lanes){
  if(!Array.isArray(lanes)||lanes.length!==4)
    throw new TypeError("Four native corner lanes required");
  return selectGlassSdfMode(lanes);
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
  const authContext=OFFSCREEN_CI?null:authCanvas.getContext("webgpu");
  if(!OFFSCREEN_CI&&!context)throw new Error("No GPUCanvasContext");
  if(!OFFSCREEN_CI&&!authContext)throw new Error("No sign-in GPUCanvasContext");
  const format=navigator.gpu.getPreferredCanvasFormat();
  if(context)context.configure({device,format,alphaMode:"opaque"});
  if(authContext)authContext.configure({device,format,alphaMode:"premultiplied"});
  canvas.id="dashboard-webgpu-scene";
  canvas.setAttribute("aria-hidden","true");
  document.body.insertBefore(canvas,document.getElementById("workspace-shell"));
  // The same shader renders auth panes on a transparent upper surface.
  // The opaque wallpaper canvas is BELOW #workspace-shell; without this
  // overlay, DOM compositing can hide every otherwise valid auth GPU pane.
  authCanvas.id="dashboard-auth-glass-scene";
  authCanvas.setAttribute("aria-hidden","true");
  routeOutlet?.insertBefore(authCanvas,routeMount||routeOutlet.firstChild);
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
  // Same shader and blend law for on-screen squares and their live,
  // GPU-only backdrop surface. No separate color/glass implementation.
  const glassBlend={
    color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},
    alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}
  };
  const glassPipeline=device.createRenderPipeline({
    label:"Oracle refraction per instanced tile; manual trilinear mip sampling",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsGlass"},
    fragment:{module:modules[2],entryPoint:"fsGlass",targets:[{
      format,blend:glassBlend
    }]},primitive:{topology:"triangle-list"}
  });
  const compositeBackdropPipeline=device.createRenderPipeline({
    label:"Static backdrop -> live Home glass underlay",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsCopy"},
    fragment:{module:modules[2],entryPoint:"fsCopy",
      targets:[{format:"rgba16float"}]},
    primitive:{topology:"triangle-list"}
  });
  const compositeGlassPipeline=device.createRenderPipeline({
    label:"Original moving squares -> live Home glass underlay",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsGlass"},
    fragment:{module:modules[2],entryPoint:"fsGlass",targets:[{
      format:"rgba16float",blend:glassBlend
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
  const authGlobalsBuffer=device.createBuffer({
    size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
  });
  let tileBuffer=null,tintTileBuffer=null,scene=null,sceneView=null,mipGroups=[],copyGroup=null,
    glassGroup=null,authGlassGroup=null,backgroundGroup=null,offscreenFrame=null,
    // Home-only background texture: same GPU-owned photograph + each
    // PRESENTED moving square, composited in the current frame before
    // capsules refract it. Never captures browser/DOM/screen pixels.
    compositeScene=null,compositeSceneView=null,compositeMips=[],
    compositeBackdropGroup=null,compositeGlassGroup=null,homeCapsuleGroup=null,
    homeCompositeFrames=0,
    tileCount=0,instanceCount=0,physicalWidth=0,physicalHeight=0,physicalAuthHeight=0,
    dpr=1,sceneTop=0;
  // A shape-only texture for the *letterforms* of route-owned glass text.
  // It contains font alpha, never photographic pixels, optics or captured DOM.
  // The one shared glassPipeline consumes it only for the title material tag.
  const glyphUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST;
  let glyphMaskTexture=device.createTexture({
    label:"Placeholder alpha for glyph-shaped WebGPU glass",
    size:[1,1,1],format:"r8unorm",usage:glyphUsage
  });
  let glyphMaskKey="",glyphMaskDimensions=[1,1];
  let tintData=new Float32Array(0),lastTintKey="";
  let trackTiles=[],trackIcons=[],trackRows=[],trackColumns=[],
    baseTileX=new Float32Array(0),baseTileY=new Float32Array(0),
    pitchCSS=0,trackOpacity=new Float32Array(0),
    dismissProgress=new Float32Array(0),cornerInert=new Uint8Array(0);
  const uniform=new Float32Array(20);
  const authUniform=new Float32Array(20);
  let tileData=new Float32Array(0);
  function syncAuthCanvasSize(){
    if(!authContext)return;
    // The GLASS framebuffer spans the form's full scrollable height. Its
    // immutable document coordinates cannot be clipped to the viewport when
    // the user scrolls through sign-up, recovery or short-window layouts.
    const cssHeight=authCanvasFixed()
      ? Math.max(1,routeOutlet?.clientHeight||0)
      : Math.max(1,routeMount?.scrollHeight||0,routeOutlet?.clientHeight||0);
    const height=Math.max(1,Math.ceil(cssHeight*dpr));
    if(height>device.limits.maxTextureDimension2D)
      throw Error("Sign-in glass scroll height exceeds GPU limit");
    const desiredTop=authCanvasFixed()?sceneTop+"px":"0px";
    if(authCanvas.style.top!==desiredTop)authCanvas.style.top=desiredTop;
    const cssWidth=window.innerWidth+"px",cssH=cssHeight+"px";
    if(authCanvas.style.width!==cssWidth)authCanvas.style.width=cssWidth;
    if(authCanvas.style.height!==cssH)authCanvas.style.height=cssH;
    if(authCanvas.width!==physicalWidth||authCanvas.height!==height){
      authCanvas.width=physicalWidth;authCanvas.height=height;
    }
    physicalAuthHeight=height;
    audit.authScrollCanvasHeight=cssHeight;
    audit.authPresentationPixelArea=physicalWidth*physicalAuthHeight;
    audit.authScrollPresentation=authCanvasFixed()
      ?"fixed-viewport":"native-content";
  }
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
    if(authContext){
      authUniform.set(uniform);
      authUniform[1]=physicalAuthHeight;
      // The canvas and wallpaper are in different compositor layers.
      // A scrollTop subtraction can be WRONG during elastic rubberbanding:
      // the compositor can translate the canvas without changing scrollTop.
      // Always project using the actual on-screen canvas bounds.
      const actualCanvasTop=authCanvas.getBoundingClientRect().top;
      const offsetCSS=authBackdropOffsetCSS(sceneTop,actualCanvasTop);
      authUniform[7]=physicalHeight;
      authUniform[9]=(pointer.y-authOriginTop())*dpr;
      authUniform[11]=offsetCSS*dpr;
      authUniform[18]=authUsesCompositor()?1:0;
      audit.authBackdropOffsetCSS=offsetCSS;
      audit.authBackdropCanvasTopCSS=actualCanvasTop;
      audit.authBackdropScrollTopCSS=routeOutlet?.scrollTop||0;
      audit.authBackdropDisplacementCSS=offsetCSS-audit.authBackdropScrollTopCSS;
      device.queue.writeBuffer(authGlobalsBuffer,0,authUniform);
    }
  }
  function syncTileTints(force=false){
    const value=tint.state,panes=authPaneElements(),scheme=authGlassScheme();
    const roles=panes.map(node=>node.hasAttribute("data-home-cta-glass")?
      "home-cta":node.dataset.publicProjectGlass?
      "project-"+node.dataset.publicProjectGlass:node.hasAttribute("data-auth-glass-card")?
      "card":node.hasAttribute("data-auth-glass-submit")?"submit":"neutral");
    const liveTints=panes.map(node=>node.hasAttribute("data-home-cta-glass")?
      getComputedStyle(node).getPropertyValue("--home-cta-tint").trim():"").join(",");
    const key=value.name+"|"+value.opacity+"|"+value.scheme+"|"+tileCount+
      "|"+scheme+"|"+roles.join(",")+"|"+liveTints;
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
  function rebindGlassGroups(){
    if(!sceneView||!tileBuffer||!tintTileBuffer)return;
    const entries=(buffer,source=sceneView)=>[
      {binding:0,resource:source},
      {binding:1,resource:{buffer:tileBuffer}},
      {binding:2,resource:{buffer}},
      {binding:3,resource:{buffer:tintTileBuffer}},
      {binding:4,resource:glyphMaskTexture.createView()}
    ];
    glassGroup=device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),entries:entries(globalsBuffer)
    });
    authGlassGroup=device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),entries:entries(authGlobalsBuffer)
    });
    // Offscreen squares read the existing STATIC wallpaper, as always.
    compositeGlassGroup=device.createBindGroup({
      layout:compositeGlassPipeline.getBindGroupLayout(0),
      entries:entries(globalsBuffer)
    });
    // Only HOME CAPSULES read this frame's composited moving glass.
    homeCapsuleGroup=compositeSceneView?device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),
      entries:entries(globalsBuffer,compositeSceneView)
    }):null;
  }
  function syncProjectTitleMask(panes){
    const title=panes.find(node=>node.dataset.publicProjectGlass==="title");
    if(!title)return;
    const style=getComputedStyle(title),rect=title.getBoundingClientRect();
    const width=Math.max(1,Math.ceil(rect.width*dpr));
    const height=Math.max(1,Math.ceil(rect.height*dpr));
    const text=title.textContent||"";
    const signature=[text,width,height,dpr,style.fontFamily,style.fontSize,
      style.fontWeight,style.fontStyle,style.letterSpacing,style.lineHeight].join("|");
    if(signature===glyphMaskKey)return;
    if(width>device.limits.maxTextureDimension2D||
       height>device.limits.maxTextureDimension2D)
      throw Error("Project title glyph mask exceeds GPU texture dimensions");
    const scratch=document.createElement("canvas");
    scratch.width=width;scratch.height=height;
    const ctx=scratch.getContext("2d",{willReadFrequently:true});
    if(!ctx)throw Error("Project title font mask context unavailable");
    ctx.scale(dpr,dpr);
    ctx.font=style.fontStyle+" "+style.fontWeight+" "+style.fontSize+" "+style.fontFamily;
    ctx.fillStyle="#fff";
    ctx.textBaseline="alphabetic";
    // Use the DOM's computed font, letter spacing and line box. This draws
    // only authored glyph geometry into an ephemeral alpha mask, not any
    // underlying page pixels. The actual glass still comes from WGSL.
    const letterSpacing=Number.parseFloat(style.letterSpacing)||0;
    const supportsLetterSpacing="letterSpacing" in ctx;
    if(supportsLetterSpacing)ctx.letterSpacing=style.letterSpacing;
    const metrics=ctx.measureText(text);
    const ascent=metrics.fontBoundingBoxAscent||metrics.actualBoundingBoxAscent||0;
    const descent=metrics.fontBoundingBoxDescent||metrics.actualBoundingBoxDescent||0;
    const baseline=(rect.height-ascent-descent)*0.5+ascent;
    if(supportsLetterSpacing){
      ctx.fillText(text,0,baseline);
    }else{
      let cursor=0;
      for(const char of text){
        ctx.fillText(char,cursor,baseline);
        cursor+=ctx.measureText(char).width+letterSpacing;
      }
    }
    const rgba=ctx.getImageData(0,0,width,height).data;
    const rowBytes=Math.ceil(width/256)*256;
    const pixels=new Uint8Array(rowBytes*height);
    let filled=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const alpha=rgba[(y*width+x)*4+3];
      pixels[y*rowBytes+x]=alpha;
      if(alpha>0)filled++;
    }
    scratch.width=0;scratch.height=0;
    if(!filled)throw Error("Project title glyph raster is empty");
    const texture=device.createTexture({
      label:"Projects font alpha, shape-only, original Liquid Glass shader",
      size:[width,height,1],format:"r8unorm",usage:glyphUsage
    });
    device.queue.writeTexture({texture},pixels,
      {offset:0,bytesPerRow:rowBytes,rowsPerImage:height},
      {width,height,depthOrArrayLayers:1});
    const previous=glyphMaskTexture;
    glyphMaskTexture=texture;
    glyphMaskKey=signature;
    glyphMaskDimensions=[width,height];
    rebindGlassGroups();
    previous.destroy();
    audit.projectTitleMask={
      source:"computed-font alpha silhouette, no DOM or wallpaper capture",
      width,height,nonzeroPixels:filled,shaderTag:-8,
      pipeline:"shared-webgpu-glassPipeline"
    };
  }
  function paintAuthPanes(){
    const panes=authPaneElements(),scheme=authGlassScheme();
    const projectRoot=document.querySelector(".public-projects-root");
    const projects=Boolean(projectRoot);
    const homeCtas=panes[0]?.hasAttribute("data-home-cta-glass")===true;
    const homeGroupOpacity=homeCtas?Math.max(0,Math.min(1,
      Number.parseFloat(getComputedStyle(panes[0].parentElement).opacity)||0)):1;
    if(projects)syncProjectTitleMask(panes);
    const dismissAt=Number.parseFloat(projectRoot?.dataset.projectHeaderDismissAt);
    const projectDismissElapsed=Number.isFinite(dismissAt)?
      Math.max(0,performance.now()-dismissAt):-1;
    let projectHeaderDissolve=0;
    const card=panes[0];
    const opacity=card?Math.max(0,Math.min(1,
      Number.parseFloat(getComputedStyle(card).opacity)||0)):0;
    const roles=[];
    // Read the live Framer Motion rect, not an image capture. The shader
    // handles geometry optics, tint and interaction for all instances.
    for(let i=0;i<AUTH_PANE_CAPACITY;i++){
      const slot=tileCount+i,p=slot*TILE_FLOATS,node=panes[i];
      // Filtering uses the genuine HTML hidden state. Skip these panes
      // rather than emitting stray 1px refracting quads at the origin.
      if(!node||node.hidden||getComputedStyle(node).display==="none"){
        tileData.fill(0,p,p+TILE_FLOATS);
        tileData[p]=-100000;tileData[p+1]=-100000;
        tileData[p+2]=1;tileData[p+3]=1;
        tileData[p+5]=-2;tileData[p+7]=4;
        cornerInert[slot]=1;
        continue;
      }
      tileData.set(makeLayoutData(node,dpr,homeCtas?sceneTop:authOriginTop()),p);
      // Per-surface finite Blur/LOD word is owned by makeLayoutData.
      // Never override a capsule/card with the first square's word.
      // A negative delay selects the route pane's Motion-owned geometry.
      // Face color MUST remain the squares' material, controlled by the
      // shared tint state rather than the page's unrelated UI color mode.
      // Only the sign-in controls' neutral pigment film varies by role.
      // Every pane retains the exact shared square glass optics and hover.
      tileData[p+5]=authPaneMaterialTag(node);
      const paneOpacity=homeCtas?
        homeGroupOpacity*Math.max(0,Math.min(1,
          Number.parseFloat(getComputedStyle(node).opacity)||0)):
        projects?Math.max(0,Math.min(1,
          Number.parseFloat(getComputedStyle(node).opacity)||0)):opacity;
      tileData[p+18]=paneOpacity;tileData[p+19]=0;
      const projectRole=node.dataset.publicProjectGlass;
      if(projects&&projectDismissElapsed>=0&&
         PROJECT_HEADER_DISMISS_ROLES.has(projectRole)){
        // Reuse the HOMEPAGE SQUARES' exact finite optical dissipation
        // progress, local drift, expansion, icon fade and blur. The shader
        // consumes motion.w and its existing SDF/noise/fringe math unchanged.
        const col=i%11;
        const progress=reducedMotion.matches?1:
          tileDismissProgress(projectDismissElapsed,0,col);
        const drift=tileDismissDrift(progress,0,col,
          tileData[p],tileData[p+2],physicalWidth,dpr);
        tileData[p]+=drift.x*dpr;
        tileData[p+1]+=drift.y*dpr;
        tileData[p+19]=progress;
        projectHeaderDissolve=Math.max(projectHeaderDissolve,progress);
        const alpha=tileDismissIconOpacity(progress);
        const blur=tileDismissBlur(progress);
        const scale=tileDismissScale(progress);
        for(const glyph of node.querySelectorAll("svg")){
          // A closed filter's up-arrow must STAY hidden. Capture its
          // pre-dismiss base alpha before touching any inline style.
          if(!glyph.hasAttribute("data-project-dismiss-base-alpha")){
            const base=Number.parseFloat(getComputedStyle(glyph).opacity);
            glyph.dataset.projectDismissBaseAlpha=String(Number.isFinite(base)?base:1);
          }
          const base=Number.parseFloat(glyph.dataset.projectDismissBaseAlpha);
          const nextOpacity=(base*alpha).toFixed(5);
          const nextBlur=progress>0?"blur("+blur.toFixed(3)+"px)":"";
          const nextScale="scale("+scale.x.toFixed(5)+","+scale.y.toFixed(5)+")";
          if(glyph.style.opacity!==nextOpacity)glyph.style.opacity=nextOpacity;
          if(glyph.style.filter!==nextBlur)glyph.style.filter=nextBlur;
          if(glyph.style.transform!==nextScale)glyph.style.transform=nextScale;
        }
      }
      if(projects&&projectRole==="card"){
        const cardDismissStart=Number.parseFloat(node.dataset.projectCardDismissAt);
        const cardRestoreStart=Number.parseFloat(node.dataset.projectCardRestoreAt);
        const cardRestoreFrom=Number.parseFloat(node.dataset.projectCardRestoreFrom);
        const cardAppearStart=Number.parseFloat(node.dataset.projectCardAppearAt);
        const cardDisappearStart=Number.parseFloat(node.dataset.projectCardDisappearAt);
        const cardDisappearFrom=Number.parseFloat(node.dataset.projectCardDisappearFrom);
        const opticalColumn=Number.parseInt(node.dataset.projectCardOpticalColumn,10);
        // Paired outgoing and incoming panes MUST use the same slight
        // per-column optical jitter; list-index jitter differs after ghosts
        // are appended and otherwise causes visible reappearance asynchrony.
        const col=Number.isInteger(opticalColumn)&&opticalColumn>=0&&
          opticalColumn<=10?opticalColumn:i%11;
        const now=performance.now();
        // A pending restore remains optically invisible until its clock
        // starts; never expose a solid ghost before the X reversal reaches it.
        const restoring=Number.isFinite(cardRestoreStart);
        const dismissing=!restoring&&Number.isFinite(cardDismissStart)&&now>=cardDismissStart;
        const foreground=node.querySelector(".project-showcase-content");
        if(restoring||dismissing){
          const elapsed=now-(restoring?cardRestoreStart:cardDismissStart);
          const progress=reducedMotion.matches?(restoring?0:1):
            restoring?tileDismissProgress(Math.max(0,
              (Number.isFinite(cardRestoreFrom)?cardRestoreFrom:DISMISS_MS)-
              Math.max(0,elapsed)),0,col):
              tileDismissProgress(elapsed,0,col);
          // Project cards use precisely the square's WGSL decoherence and
          // tile.motion.w, with no copied shader or CSS optical layer.
          const drift=tileDismissDrift(progress,0,col,
            tileData[p],tileData[p+2],physicalWidth,dpr);
          tileData[p]+=drift.x*dpr;
          tileData[p+1]+=drift.y*dpr;
          tileData[p+19]=progress;
          if(foreground){
            foreground.style.opacity=String(tileDismissIconOpacity(progress));
            foreground.style.filter=progress>0?
              "blur("+tileDismissBlur(progress).toFixed(3)+"px)":"";
          }
        }else if(Number.isFinite(cardAppearStart)||
                 Number.isFinite(cardDisappearStart)){
          // Old-row silhouette and next-row live pane are two placements of
          // ONE card. Their common square-optics clock is complementary:
          // incoming opacity is precisely 1 minus the outgoing glyph alpha.
          // WAAPI's boundary clipping still multiplies this for entrance at
          // the left edge, avoiding both duplicate cards and premature light.
          const returning=Number.isFinite(cardDisappearStart);
          const elapsed=now-(returning?cardDisappearStart:cardAppearStart);
          const progress=reducedMotion.matches?(returning?0:1):
            returning?tileDismissProgress(Math.max(0,
              (Number.isFinite(cardDisappearFrom)?cardDisappearFrom:DISMISS_MS)-
              Math.max(0,elapsed)),0,col):
              tileDismissProgress(Math.max(0,elapsed),0,col);
          const appearance=Math.max(0,Math.min(1,
            1-tileDismissIconOpacity(progress)));
          tileData[p+18]*=appearance;
          if(foreground){
            foreground.style.opacity=appearance.toFixed(5);
            foreground.style.removeProperty("filter");
          }
        }else if(foreground){
          // The same DOM card is recycled after every cascade. No inline
          // optical artifacts may survive its arrival or a route exit.
          foreground.style.removeProperty("opacity");
          foreground.style.removeProperty("filter");
        }
      }
      cornerInert[slot]=paneOpacity<.025||tileData[p+19]>=1?1:0;
      roles.push(homeCtas?"home-cta-"+i:
        projects?node.dataset.publicProjectGlass:
        node.hasAttribute("data-auth-glass-card")?"card":
        node.classList.contains("auth3-back-link")?"back":
        node.hasAttribute("data-auth-glass-submit")?"submit":"control");
    }
    interaction.retargetRects(tileData,cornerInert);
    authHover.retargetRects(tileData,tileCount,cornerInert,
      projects||homeCtas?"independent":"nested");
    if(homeCtas){
      audit.homeCtaGlass={renderer:"shared-webgpu-glassPipeline",
        materialTag:-9,face:"shared-per-surface-Clear",count:panes.length,roles,
        tintModel:"shared-square-film",tintFilmStrength:0.25,
        pressLightGain:GLASS_INTERACTION.pressLight,
        geometry:"oracle-finite-per-surface-min-dimension",
        layers:PUBLIC_HOME_GLASS_LAYERS.map(x=>({...x})),
        backdrop:"GPU-composited-moving-squares",
        compositeFrames:homeCompositeFrames,
        liveGeometry:true,capsules:panes.map((node,i)=>{
          const p=(tileCount+i)*TILE_FLOATS;
          return {width:tileData[p+2]/dpr,height:tileData[p+3]/dpr,
            radius:tileData[p+4]/dpr,renderMode:tileData[p+7],
            nativeClear:projectFiniteNativeClearGlass(
              tileData[p+2]/dpr,tileData[p+3]/dpr),
            content:surfaceContentFromElement(node),opacity:tileData[p+18],
            tint:Number.parseFloat(getComputedStyle(node).getPropertyValue("--home-cta-tint"))||0};
        })};
      audit.authGlass=null;audit.projectGlass=null;
      return homeGroupOpacity>.001&&homeGroupOpacity<.999;
    }
    audit.homeCtaGlass=null;
    if(projects){
      const searchIndex=panes.findIndex(node=>
        node.dataset.publicProjectGlass==="search-field");
      const searchOffset=searchIndex<0?-1:(tileCount+searchIndex)*TILE_FLOATS;
      const searchGlass=searchOffset<0?null:{
        widthPx:tileData[searchOffset+2]/dpr,
        heightPx:tileData[searchOffset+3]/dpr,
        radiusPx:tileData[searchOffset+4]/dpr,
        opacity:tileData[searchOffset+18],
        // The exact same material tag as the untinted square/card.
        materialTag:tileData[searchOffset+5]
      };
      audit.projectGlass={renderer:"shared-webgpu-glassPipeline",
        count:roles.length,roles,faceScheme:tint.state.scheme,
        materialReference:"shared-per-surface-Clear",tint:"none",searchGlass,
        titleGlyphGlass:roles.includes("title"),
        titleMaskPixels:[...glyphMaskDimensions],
        headerDissolve:projectDismissElapsed>=0?{
          source:"dashboard-public-dismiss.js / shared WGSL optical decoherence",
          elapsedMs:projectDismissElapsed,progress:projectHeaderDissolve
        }:null,
        hovered:authHover.activeControl>=0};
      audit.authGlass=null;
      return Boolean(card&&(!document.querySelector(".public-projects-root.is-settled")||
        panes.some(node=>{
          const value=Number.parseFloat(getComputedStyle(node).opacity);
          return value>.001&&value<.999;
        })||document.querySelector(".public-projects-root.is-exiting")));
    }
    audit.projectGlass=null;
    audit.authGlass={renderer:authUsesCompositor()?
      "native-backdrop+webgpu-material-highlights":"shared-webgpu-glassPipeline",count:roles.length,
      roles,scheme,cardTint:"none",backTint:"none",faceScheme:tint.state.scheme,
      materialReference:"shared-per-surface-Clear",
      neutralControlTints:scheme==="dark"?"black / white primary":"white / black primary",
      hovered:authHover.cardHovered||authHover.controlHovered,
      cardHovered:authHover.cardHovered,controlHovered:authHover.controlHovered,
      activeControl:authHover.activeControl,opacity};
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
    syncAuthCanvasSize();
    if(sized){
      canvas.width=w;canvas.height=h;
      // The scroll-anchored auth canvas has a separate, content-sized height.
      scene?.destroy();
      compositeScene?.destroy();
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
      // Maintain a distinct, true GPU mip chain for the live mosaic
      // backdrop. Its source is built only when a capsule exposes glass.
      compositeScene=rgba16Texture(device,w,h);
      compositeSceneView=compositeScene.createView();
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
      compositeMips=[];
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
        compositeMips.push(device.createBindGroup({
          layout:mipPipeline.getBindGroupLayout(0),
          entries:[
            {binding:0,resource:compositeScene.createView({
              baseMipLevel:level-1,mipLevelCount:1})},
            {binding:1,resource:compositeScene.createView({
              baseMipLevel:level,mipLevelCount:1})}
          ]
        }));
      }
      copyGroup=device.createBindGroup({
        layout:copyPipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:sceneView}]
      });
      compositeBackdropGroup=device.createBindGroup({
        layout:compositeBackdropPipeline.getBindGroupLayout(0),
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
    rebindGlassGroups();
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
        trackIcons[i].style.filter="brightness(0) blur("+tileDismissBlur(dissolving).toFixed(3)+"px)";
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
    syncAuthCanvasSize();
    writeUniform();
    if(scenePending)buildScene();
    const now=performance.now();
    const dt=Math.max(0,(now-lastFrameTime)/1000);
    const authDt=Math.max(0,(now-lastAuthFrameTime)/1000);
    lastFrameTime=now;
    lastAuthFrameTime=now;
    if(tileCount)paintTrack(dt);
    const authAnimating=paintAuthPanes();
    syncTileTints();
    const animating=interaction.advance(dt,reducedMotion.matches);
    const authHoverAnimating=authHover.advance(authDt,reducedMotion.matches);
    if(instanceCount){
      interaction.writeTo(tileData);
      // Override only route-owned pane lanes AFTER the original squares.
      authHover.writeTo(tileData,tileCount);
      // motion.z is the independent end-of-track transparency; the
      // interaction adapter owns only hover/press, not track opacity.
      for(let i=0;i<tileCount;i++){
        tileData[i*TILE_FLOATS+18]=trackOpacity[i];
        tileData[i*TILE_FLOATS+19]=dismissProgress[i];
      }
      device.queue.writeBuffer(tileBuffer,0,tileData);
    }
    const encoder=device.createCommandEncoder({label:"Glass only frame"});
    // No CSS/DOM capture: directly re-render the CURRENT GPU square tiles
    // into a separate RGBA16F surface atop the original GPU photo. Build
    // its real mip levels in this same submission before the capsule draw.
    // The backdrop is dynamic ONLY while any black capsule is transitioning
    // toward/away from transparent green glass, avoiding idle GPU overhead.
    const homeCompositeActive=Boolean(audit.homeCtaGlass?.count)&&
      audit.homeCtaGlass.capsules.some(c=>c.opacity>.002&&c.tint>.002);
    if(homeCompositeActive&&compositeScene&&homeCapsuleGroup){
      const underlay=encoder.beginRenderPass({colorAttachments:[{
        view:compositeScene.createView({baseMipLevel:0,mipLevelCount:1}),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"
      }]});
      underlay.setPipeline(compositeBackdropPipeline);
      underlay.setBindGroup(0,compositeBackdropGroup);
      underlay.draw(3);
      if(tileCount){
        underlay.setPipeline(compositeGlassPipeline);
        underlay.setBindGroup(0,compositeGlassGroup);
        underlay.draw(6,tileCount);
      }
      underlay.end();
      for(let level=1;level<compositeScene.mipLevelCount;level++){
        const mip=encoder.beginComputePass({label:"live square underlay mip "+level});
        mip.setPipeline(mipPipeline);
        mip.setBindGroup(0,compositeMips[level-1]);
        mip.dispatchWorkgroups(Math.ceil(Math.max(1,physicalWidth>>level)/8),
          Math.ceil(Math.max(1,physicalHeight>>level)/8),1);
        mip.end();
      }
      homeCompositeFrames++;
      audit.homeCtaGlass.compositeFrames=homeCompositeFrames;
    }
    const pass=encoder.beginRenderPass({
      colorAttachments:[{view:OFFSCREEN_CI?
          offscreenFrame.createView():context.getCurrentTexture().createView(),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]
    });
    pass.setPipeline(copyPipeline);pass.setBindGroup(0,copyGroup);
    pass.draw(3);
    if(tileCount){
      pass.setPipeline(glassPipeline);pass.setBindGroup(0,glassGroup);
      pass.draw(6,tileCount);
      // The three scaled capsules are separate instances of the same
      // shader on the HOMEPAGE canvas, under their real DOM text.
      if(audit.homeCtaGlass?.count){
        // Square refraction still reads the original scene; only the three
        // capsules sample the GPU frame including live moving squares.
        pass.setBindGroup(0,homeCompositeActive?homeCapsuleGroup:glassGroup);
        pass.draw(6,audit.homeCtaGlass.count,0,tileCount);
      }
    }
    pass.end();
    // Draw only the route panes above the persistent homepage DOM. This is
    // the very same glassPipeline, bind group, per-pane tint and spring data
    // as the mosaic squares, not a second approximation or CSS overlay.
    if(authContext){
      const authPass=encoder.beginRenderPass({
        colorAttachments:[{view:authContext.getCurrentTexture().createView(),
          loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]
      });
      authPass.setPipeline(glassPipeline);authPass.setBindGroup(0,authGlassGroup);
      authPass.draw(6,AUTH_PANE_CAPACITY,0,tileCount);
      authPass.end();
    }
    device.queue.submit([encoder.finish()]);
    audit.frameCount++;
    audit.focusedTile=interaction.focusedTile;
    audit.pressed=interaction.isPressed;
    audit.tint=tint.state;
    if(audit.homeCtaGlass){
      const active=authHover.activeControl;
      audit.homeCtaGlass.activePane=active;
      audit.homeCtaGlass.hover=active>=0?authHover.snapshot(active).hover:0;
      audit.homeCtaGlass.press=active>=0?authHover.snapshot(active).press:0;
    }
    if(audit.projectGlass){
      audit.projectGlass.hovered=authHover.activeControl>=0;
      audit.projectGlass.activePane=authHover.activeControl;
    }
    if(audit.authGlass){
      audit.authGlass.cardHover=authHover.snapshot(0);
      audit.authGlass.controlHover=authHover.activeControl>=1?
        authHover.snapshot(authHover.activeControl):null;
    }
    return animating||authHoverAnimating||authAnimating;
  }
  // Auth-only submission for the card's exit Motion and native scroll.
  // Every route pane shares the unchanged homepage WebGPU shader
  // and material. Scroll events submit this pass before their next RAF. 
  function renderAuthOnly(){
    if(!authContext||!instanceCount||stopped)return false;
    const now=performance.now();
    const dt=Math.max(0,(now-lastAuthFrameTime)/1000);
    lastAuthFrameTime=now;
    syncAuthCanvasSize();
    writeUniform();
    const authAnimating=paintAuthPanes();
    syncTileTints();
    const hoverAnimating=authHover.advance(dt,reducedMotion.matches);
    authHover.writeTo(tileData,tileCount);
    device.queue.writeBuffer(tileBuffer,0,tileData);
    const encoder=device.createCommandEncoder({label:"Public-route-only glass frame"});
    const pass=encoder.beginRenderPass({
      colorAttachments:[{view:authContext.getCurrentTexture().createView(),
        loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]
    });
    pass.setPipeline(glassPipeline);pass.setBindGroup(0,authGlassGroup);
    pass.draw(6,AUTH_PANE_CAPACITY,0,tileCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
    audit.frameCount++;
    audit.authOnlyFrames=(audit.authOnlyFrames||0)+1;
    if(audit.projectGlass){
      audit.projectGlass.hovered=authHover.activeControl>=0;
      audit.projectGlass.activePane=authHover.activeControl;
    }
    if(audit.authGlass){
      audit.authGlass.cardHover=authHover.snapshot(0);
      audit.authGlass.controlHover=authHover.activeControl>=1?
        authHover.snapshot(authHover.activeControl):null;
    }
    return authAnimating||hoverAnimating;
  }
  function dispose(){
    tileBuffer?.destroy();tintTileBuffer?.destroy();
    glyphMaskTexture.destroy();
    scene?.destroy();compositeScene?.destroy();
    offscreenFrame?.destroy();photo.destroy();
    globalsBuffer.destroy();authGlobalsBuffer.destroy();
  }
  await waitForVisibleHome();
  engine={rebuild,render,renderAuthOnly,dispose,device};
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
  if(authContext)document.body.dataset.authGpuScene="ready";
  audit.authPresentation=authUsesCompositor()?
    "native-backdrop+WebGPU-material-highlights":
    authContext?"shared-pipeline-transparent-overlay":"offscreen-ci";
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
  const panePointerOrigin=()=>authPaneElements()[0]?.hasAttribute("data-home-cta-glass")?
    sceneTop:authOriginTop();
  const movePointer=event=>{
    if(activePointerId!==null&&event.pointerId!==activePointerId)return;
    if(event.pointerType==="touch"&&activePointerId===null)return;
    pointer.x=event.clientX;pointer.y=event.clientY;pointer.enabled=1;
    interaction.move(event.clientX*dpr,(event.clientY-sceneTop)*dpr);
    authHover.move(event.clientX*dpr,(event.clientY-panePointerOrigin())*dpr);
    requestRender();
  };
  const downPointer=event=>{
    if(event.isPrimary===false||event.button>0 ||
       (activePointerId!==null&&activePointerId!==event.pointerId))return;
    activePointerId=event.pointerId;
    interaction.move(event.clientX*dpr,(event.clientY-sceneTop)*dpr);
    authHover.move(event.clientX*dpr,(event.clientY-panePointerOrigin())*dpr);
    const homePress=authPaneElements()[0]?.hasAttribute("data-home-cta-glass")===true
      &&authHover.activeControl>=0;
    interaction.setPressed(true);
    authHover.setPressed(true,{tapImpulse:homePress});
    if(homePress)pointerPressFramePending=true;
    requestRender();
  };
  const upPointer=event=>{
    if(activePointerId!==event.pointerId)return;
    const homeRelease=authPaneElements()[0]?.hasAttribute("data-home-cta-glass")===true
      &&authHover.activeControl>=0;
    activePointerId=null;interaction.setPressed(false);authHover.setPressed(false);
    if(homeRelease)pointerPressFramePending=true;
    if(event.pointerType==="touch"){
      pointer.enabled=0;interaction.clear();authHover.clear();
    }else{
      interaction.move(event.clientX*dpr,(event.clientY-sceneTop)*dpr);
      authHover.move(event.clientX*dpr,(event.clientY-panePointerOrigin())*dpr);
    }
    requestRender();
  };
  const cancelPointer=event=>{
    if(activePointerId!==null&&event.pointerId!==activePointerId)return;
    activePointerId=null;pointer.enabled=0;
    interaction.clear();authHover.clear();requestRender();
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
    activePointerId=null;pointer.enabled=0;
    interaction.clear();authHover.clear();requestRender();
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
  const authObserver=routeOutlet?new MutationObserver(()=>requestRender()):null;
  if(routeOutlet)authObserver.observe(routeOutlet,{
    childList:true,subtree:true,attributes:true,
    attributeFilter:["style","class","disabled"]
  });
  // Native scroll can be composited ahead of requestAnimationFrame. Submit
  // the glass-only GPU pass immediately inside the real scroll event, using
  // the canvas's actual viewport rect, not a predictive scrollTop value.
  const onAuthScroll=()=>{
    if(authUsesCompositor()||stopped||!engine||!homeActive())return;
    authScrollRefreshUntil=performance.now()+AUTH_ELASTIC_SETTLE_MS;
    if(["login","projects"].includes(window.__dofPublicRouter?.state)&&
       document.body.dataset.authGpuScene==="ready"){
      try{
        engine.renderAuthOnly();
        audit.authSynchronousScrollFrames=(audit.authSynchronousScrollFrames||0)+1;
        audit.authSynchronousScrollAt=performance.now();
      }catch(error){void fallback(error);return;}
    }
    requestRender();
  };
  // Wheel/touch can initiate native elastic motion before (or even without)
  // scrollTop changing. Keep checking the observed compositor displacement.
  const armElasticRefresh=()=>{
    if(authUsesCompositor()||!["login","projects"].includes(window.__dofPublicRouter?.state))return;
    authScrollRefreshUntil=performance.now()+AUTH_ELASTIC_SETTLE_MS;
    requestRender();
  };
  routeOutlet?.addEventListener("scroll",onAuthScroll,{passive:true});
  routeOutlet?.addEventListener("wheel",armElasticRefresh,{passive:true});
  routeOutlet?.addEventListener("touchmove",armElasticRefresh,{passive:true});
  const authSizeObserver=routeMount?new ResizeObserver(()=>requestRender()):null;
  if(routeMount)authSizeObserver.observe(routeMount);
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
    authObserver?.disconnect();authSizeObserver?.disconnect();
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
