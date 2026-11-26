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
 * Authored backdrop/foreground primitives are composed at their owner layer.
 * Arbitrary unregistered external HTML remains DOM UI, not captured pixels.
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
 planGlassLayers,GLASS_INTERACTION,projectFiniteNativeClearGlass,glassEntrance,glassPaneIntersectsViewport}
 from "./dashboard-glass-model.js";
import {REGION_FLOATS,artworkCoverTransform,artworkCSSAlignment,createGlassArtworkAtlas} from "./dashboard-glass-artwork.js";
import {MATERIAL_FLOATS,glassMaterialFromElement,resolveRegularMaterial,regularMaterialLanes,validateGlassMaterial,resolveInactiveClearRegion}
 from "./dashboard-glass-material.js";
import {createTintControls,tintForTile,tintParameters,SHOWCASE_TINTS,SHOWCASE_OPACITIES} from "./dashboard-tint.js";
import {TRACK_SECONDS,phaseAtSeconds,trackPosition,trackSideOpacity} from "./dashboard-track.js";
import {publicIconSpatialAlpha} from "./dashboard-public-icon-fade.js";
import {resolveDropdownMaterial,dropdownMaterialLanes,dropdownRowBounds} from "./dashboard-glass-dropdown.js";
import {createGlassSourcePainter,sourceNodesForPane} from "./dashboard-glass-source-paint.js";
import {createNativeForegroundOcclusion} from "./dashboard-glass-native-occlusion.js";
import {createVectorCoverageAtlas} from "./dashboard-glass-vector-coverage.js";
import {createGlassSilhouetteAtlas,projectIconHazeProgress,GLASS_ICON_FLOATS} from "./dashboard-glass-silhouette.js";
import {continuousRequested,loadContinuousGlass,specializeContinuousGlass} from "./dashboard-glass-continuous.js";
import {CLOCK_TEXT_PROFILE,clockTextMaterialLanes,rasterClockText} from "./dashboard-glass-text.js";
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
// Projects uses the SAME fixed glass framebuffer as Sign in. The native
// scrollport remains real; its foreground is held in a sticky viewport and
// presented at the exact scroll offset of the submitted GPU frame.
let projectScrollSpacer=null,projectPresentedRoot=null,projectPresentedScroll=0;
const fixedProjectRoot=()=>authCanvasFixed()&&!authUsesCompositor()&&
  document.body.dataset.authGpuScene==="ready"?
    routeMount?.querySelector(".public-projects-root"):null;
function resetProjectScrollPresentation(){
  projectPresentedRoot?.style.removeProperty("--project-presented-scroll");
  projectPresentedRoot=null;projectPresentedScroll=0;
  routeOutlet?.removeAttribute("data-project-scroll-sync");
  projectScrollSpacer?.remove();projectScrollSpacer=null;
}
function syncProjectScrollPresentation(){
  const project=fixedProjectRoot();
  if(!project||!routeOutlet){
    if(projectPresentedRoot)resetProjectScrollPresentation();
    return;
  }
  if(projectPresentedRoot!==project){
    resetProjectScrollPresentation();
    projectPresentedRoot=project;
    projectScrollSpacer=document.createElement("div");
    projectScrollSpacer.className="project-scroll-spacer";
    projectScrollSpacer.setAttribute("aria-hidden","true");
    routeOutlet.append(projectScrollSpacer);
    projectScrollSpacer.style.height=Math.max(0,project.offsetHeight-routeOutlet.clientHeight)+"px";
    routeOutlet.dataset.projectScrollSync="true";
  }
  const extent=Math.max(0,project.offsetHeight-routeOutlet.clientHeight);
  const height=extent+"px";
  if(projectScrollSpacer.style.height!==height)projectScrollSpacer.style.height=height;
  const y=Math.min(extent,Math.max(0,routeOutlet.scrollTop));
  const offset=y+"px";
  const changed=project.style.getPropertyValue("--project-presented-scroll")!==offset;
  if(changed)project.style.setProperty("--project-presented-scroll",offset);
  projectPresentedScroll=y;
  if(changed)routeOutlet.dispatchEvent(new Event("project-scroll-presented"));
}
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
  // Any future route in the persistent public shell may register a dropdown.
  // Existing Projects role selectors are retained for their layout/animation.
  const dropdowns=[...(routeMount?.querySelectorAll("[data-glass-dropdown]")??[])];
  const texts=[...(routeMount?.querySelectorAll("[data-glass-text]")??[])].filter(n=>!n.hidden).slice(0,1);
  const card=document.querySelector(".auth3-root [data-auth-glass-card]");
  if(card)return [card,...card.querySelectorAll(
    '[data-auth-glass-input],[data-auth-glass-submit],[data-auth-glass-provider]'
  ),...texts,...dropdowns].slice(0,AUTH_PANE_CAPACITY);
  const projects=document.querySelector(".public-projects-root");
  if(!projects){
    if(texts.length||dropdowns.length)return [...texts,...dropdowns].slice(0,AUTH_PANE_CAPACITY);
    const ctas=[...document.querySelectorAll(HOME_CTA_SELECTOR)].slice(0,3);
    const brand=document.querySelector(".cta6-center > #dashboard-title[data-glass-text]");
    // Preserve the Home glyphs through dismissal and its reverse.
    if(brand&&homeActive()&&routeOutlet?.hidden&&!document.body.dataset.directLogin)ctas.push(brand);
    return ctas;
  }
  const all=[...new Set([...projects.querySelectorAll("[data-public-project-glass]"),...texts,...dropdowns])];
  // The dropdown overlays the cards in the route-owned DOM stack; draw its
  // very same glass pane LAST so the GPU material obeys that stacking order.
  const top=all.filter(node=>
    ["filter-dropdown","expand-close"].includes(node.dataset.publicProjectGlass)||node.hasAttribute("data-glass-dropdown")||node.hasAttribute("data-project-detail-back"));
  // The route's CSS z-order cannot reorder instances inside one WebGPU
  // draw call. Disappearing old-row silhouettes must be composited BEHIND
  // the widening selected pane, or their glass looks like it reappears
  // above that pane while the real DOM is already behind it.
  const ghosts=all.filter(node=>
    node.classList.contains("project-showcase-dissolve-ghost"));
  const expanded=all.filter(node=>node.classList.contains("is-expanded"));
  const contracting=all.filter(node=>node.classList.contains("is-contracting"));
  const base=all.filter(node=>
    !["filter-dropdown","expand-close"].includes(node.dataset.publicProjectGlass)&&!node.hasAttribute("data-glass-dropdown")&&
    !node.hasAttribute("data-project-detail-back")&&
    !node.classList.contains("project-showcase-dissolve-ghost")&&
    !node.classList.contains("is-expanded")&&!node.classList.contains("is-contracting"));
  return [...ghosts,...base,...contracting,...expanded,...top].slice(0,AUTH_PANE_CAPACITY);
}
const authGlassScheme=()=>document.documentElement.dataset.dofTheme==="light"?
  "light":"dark";
// Negative route markers select only route-owned material variants.
// -2 is the untinted card; -7 is the separate untinted back chip,
// -4 primary, -5 social sign-in and -6 text input. Squares are unchanged.
function authPaneMaterialTag(node){
  if(node.hasAttribute("data-home-cta-glass"))return -9;
  if(node.hasAttribute("data-glass-text"))return -8;
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
  if(node.hasAttribute("data-glass-dropdown")||node.hasAttribute("data-glass-text"))return tintParameters("none",undefined,scheme);
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
  sceneCapture:"Owned wallpaper + registered authored glyph/vector/image sources. No DOM/screen capture.",
  backend:"WebGPU",presentation:OFFSCREEN_CI?"offscreen-ci":"GPUCanvasContext",mipKernel:"explicit 2x2 RGBA16Float compute reduction",
  mipSampling:"WGSL manual bilinear + trilinear textureLoad",
  oracleMath:"AIR mode4/mode5 SDF, half-boundary refraction, distribution and LOD; finite scope",
  mipCount:0,sceneBuilds:0,frameCount:0,tiles:0,errors:[],
  authScrollPresentation:authCanvasFixed()?"fixed-viewport":"native-content"
};
Object.defineProperty(window,"__dashboardWebGPU",{
  configurable:true,get:()=>Object.freeze({...audit,errors:[...audit.errors]})
});
// Start the entrance only after the first GPU frame has actually completed.
let introStart=null;
const introActive=()=>introStart!==null&&!reducedMotion.matches&&performance.now()-introStart<900;
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
    const resizing=audit.resizePending===true;
    if(!resizing&&trackRunning&&!pointerPressFramePending&&
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
      // Resize is a full-resolution, pre-paint submission, not a second
      // independent render loop. A same-size notification can be a no-op.
      const resized=resizing?engine.flushResize():null;
      if(resized!==null){
        animating=resized;
      }else if(["login","projects"].includes(window.__dofPublicRouter?.state)&&
         document.body.dataset.authGpuScene==="ready"&&
         (authUsesCompositor()||fixedProjectRoot()||performance.now()<authScrollRefreshUntil)){
        animating=engine.renderAuthOnly();
      }else{
        animating=engine.render();
      }
    }catch(e){void fallback(e);return;}
    if(!stopped&&(animating||trackRunning||
      (!authUsesCompositor()&&performance.now()<authScrollRefreshUntil)||
      (dismissStart!==null&&performance.now()-dismissStart<DISMISS_MS+90)||
      (restoreStart!==null&&performance.now()-restoreStart<DISMISS_MS+90)||
      introActive()))
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
  resetProjectScrollPresentation();
  authCanvas.remove();
  canvas.remove();
  try{engine?.dispose()}catch{}
  // Avoid a blank preview where WebGPU is not available (e.g. a disabled
  // enterprise GPU or software adapter). Live DOM sampling still works.
  // The fallback is the EXISTING earlier SVG glass, not a fake GPU result.
  try{await import("./dashboard-optics.js")}catch(error){
    audit.errors.push("SVG fallback: "+String(error));
  }finally{if(root)root.dataset.glassStartup="fallback";}
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
          GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_SRC
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
function projectHeadingScale(node){
  return node?.dataset.publicProjectGlass==="title"?
    Math.max(.7,Math.min(1,Number.parseFloat(getComputedStyle(node).getPropertyValue("--project-heading-scale"))||1)):1;
}
function makeLayoutData(tile,scale,sceneTop=0){
  // Shared public geometry: one resolver for squares, cards, capsules,
  // rectangles, circles and foreground content.
  const b=tile.getBoundingClientRect();
  const live=tile.hasAttribute("data-home-cta-glass")||
    glassPaneNeedsLiveTransform(tile.dataset?.publicProjectGlass)||tile.hasAttribute("data-glass-dropdown")||projectHeadingScale(tile)<1;
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
    content:surfaceContentFromElement(tile),material:glassMaterialFromElement(tile)
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
  const base="/assets/home-dashboard/";
  const url="/assets/home-dashboard/dashboard-cloud-veiled-colorful-fields.avif";
  // Start independent cold-cache I/O and decoding before requesting the GPU.
  const img=new Image();
  img.decoding="async";
  const ready=new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=()=>reject(new Error("Backdrop image load failed"));
  });
  img.src=url;
  const sourcesReady=Promise.all([
    "dashboard-gpu-scene.wgsl",
    "dashboard-gpu-mipmap.wgsl",
    "dashboard-gpu-glass.wgsl"
  ].map(async name=>{
    const r=await fetch(base+name);
    if(!r.ok)throw new Error(name+" HTTP "+r.status);
    return r.text();
  }));
  // Decode canonical SVGs before entry, so a late icon cannot pop in.
  const iconsReady=Promise.allSettled([...root.querySelectorAll("img.cta6-icon")].map(icon=>icon.decode()));
  const deviceReady=(async()=>{
    const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});
    if(!adapter)throw new Error("No WebGPU adapter available");
    root.dataset.gpuPhase="request-device";
    const nativeF16=adapter.features.has("shader-f16");
    const device=await adapter.requestDevice({requiredFeatures:nativeF16?["shader-f16"]:[]});
    return {device,nativeF16};
  })();
  const [{device,nativeF16},,sources]=await Promise.all([deviceReady,ready,sourcesReady]);
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

  // A failed optional vector asset or candidate pipeline must not force a
  // visitor onto a less faithful CSS renderer. The original WebGPU program
  // is still available on the very same device, before any scene is shown.
  async function createPublicPipelines(candidate){
  if(root)root.dataset.gpuPhase="compile-wgsl";
  const glassSource=(nativeF16?"enable f16;\n":"")+(candidate?specializeContinuousGlass(sources[2],candidate.code):sources[2]).replaceAll(
    "__ORACLE_HALF_BODY__",
    nativeF16?"return vec3<f32>(vec3<f16>(v));":"return v;");
  if(glassSource.includes("__ORACLE_HALF_BODY__"))
    throw Error("Native half-conversion shader specialization did not apply");
  const modules=[sources[0],sources[1],glassSource].map((code,i)=>device.createShaderModule({
    label:["background","explicit mip reduction","oracle glass"][i],code
  }));
  await Promise.all(modules.map((x,i)=>compileCheck(x,["scene","mips","glass"][i])));
  device.pushErrorScope("validation");
  let result;try{
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
  // Detail textures preserve original aspect and available display detail;
  // use the same deterministic 2x2 kernel in compact RGBA8 storage.
  const detailMipModule=device.createShaderModule({label:"Artwork detail mip reduction",
    code:sources[1].replace("rgba16float,write","rgba8unorm,write")});
  await compileCheck(detailMipModule,"artwork detail mips");
  const detailMipPipeline=device.createComputePipeline({layout:"auto",
    compute:{module:detailMipModule,entryPoint:"mip2x2"}});
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
  const projectRegionCapturePipeline=device.createRenderPipeline({
    label:"Raw project artwork -> half-resolution Clear backdrop (no glass)",
    layout:"auto",vertex:{module:modules[2],entryPoint:"vsProjectRegionCapture"},
    fragment:{module:modules[2],entryPoint:"fsProjectRegionCapture",
      targets:[{format:"rgba16float",blend:glassBlend}]},
    primitive:{topology:"triangle-list"}
  });
  if(root)root.dataset.gpuPhase="validate-pipelines";

  result={backdropPipeline,mipPipeline,detailMipPipeline,copyPipeline,glassPipeline,compositeBackdropPipeline,compositeGlassPipeline,projectRegionCapturePipeline};
  }finally{
   const pipelineError=await device.popErrorScope();
   if(pipelineError)throw Error("GPU pipeline validation: "+pipelineError.message);
  }
  return result;
  }
  let continuous=null,pipelines;
  const requested=continuousRequested(location.search,nativeF16,device.limits,innerWidth,innerHeight);
  if(requested){
    try{continuous=await loadContinuousGlass(device,base);pipelines=await createPublicPipelines(continuous);}
    catch(error){
      continuous?.dispose();continuous=null;
      audit.continuousStartupFallback=String(error);
      console.warn("Continuous glass startup compatibility fallback:",error);
    }
  }
  if(!pipelines)pipelines=await createPublicPipelines(null);
  audit.glassRenderer=continuous?"continuous-candidate":"baseline";
  if(continuous)audit.continuousVectors={curveCount:continuous.curveCount,bytes:continuous.bytes};
  const {backdropPipeline,mipPipeline,detailMipPipeline,copyPipeline,glassPipeline,compositeBackdropPipeline,compositeGlassPipeline,projectRegionCapturePipeline}=pipelines;
  const sampler=device.createSampler({
    magFilter:"linear",minFilter:"linear",mipmapFilter:"nearest",
    addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"
  });
  const globalsBuffer=device.createBuffer({
    size:continuous?96:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
  });
  const authGlobalsBuffer=device.createBuffer({
    size:continuous?96:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
  });
  const sourcePainter=createGlassSourcePainter(device,format);
  const nativeOcclusion=createNativeForegroundOcclusion(document);
  const silhouetteAtlas=createGlassSilhouetteAtlas(device,requestRender,continuous?{vectorOnly:true,hasVector:img=>Boolean(continuous.indexFor(img))}:{});
  let iconData=new Float32Array(0),iconBuffer=null,referenceIconData=new Float32Array(0),referenceIconBuffer=null;
  let referenceCoverage=null,referenceBindingView=null,referenceFieldBinding=null;
  const routeCompositeGlobalsBuffer=device.createBuffer({size:continuous?96:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const homeCompositeGlobalsBuffer=continuous?device.createBuffer({size:96,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}):globalsBuffer;
  let routeCompositeBaseGroup=null,routeMenuGroup=null,routeCompositeEntries=null;
  const routeCompositeDetailGroups=new Map();
  let dropdownSlots=[],dropdownCompositeFrames=0;
  let routeSourceEntries=[],baseSourceEntries=[],baseSourceKey="";
  let routeLayerSlots=[],routeActiveLayers=[],routeLayerSources=new Map();
  let secondRouteScene=null,secondRouteMips=[],secondRouteCopyGroup=null;
  let tileBuffer=null,tintTileBuffer=null,materialBuffer=null,scene=null,sceneView=null,mipGroups=[],copyGroup=null,
    glassGroup=null,authGlassGroup=null,backgroundGroup=null,offscreenFrame=null,
    // Home-only background texture: same GPU-owned photograph + each
    // PRESENTED moving square, composited in the current frame before
    // capsules refract it. Never captures browser/DOM/screen pixels.
    compositeScene=null,compositeSceneView=null,compositeMips=[],
    compositeBackdropGroup=null,compositeGlassGroup=null,homeCapsuleGroup=null,
    homeCompositeFrames=0,
    tileCount=0,instanceCount=0,physicalWidth=0,physicalHeight=0,physicalAuthHeight=0,sourceWidth=0,sourceHeight=0,sourceDpr=1,
    dpr=1,sceneTop=0;
  // A shape-only texture for the *letterforms* of route-owned glass text.
  // It contains font alpha, never photographic pixels, optics or captured DOM.
  // The one shared glassPipeline consumes it only for the title material tag.
  const glyphUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST;
  let glyphMaskTexture=device.createTexture({
    label:"Placeholder alpha for glyph-shaped WebGPU glass",
    size:[1,1,1],format:"rgba16float",usage:glyphUsage
  });
  let referenceGlyphTexture=null,referenceGlyphKey="";
  let glyphAlphaTexture=null,glyphAlphaKey="";
  let glyphMaskKey="",glyphMaskDimensions=[1,1],glyphMaskOwner=null,glyphVectorIndex=0,glyphVectorPhase=[.5,.5];
  let tintData=new Float32Array(0),lastTintKey="";
  let materialData=new Float32Array(0);
  let regionData=new Float32Array(0),regionBuffer=null;
  let projectRegionScene=null,projectRegionSceneView=null,projectRegionCopyGroup=null,projectRegionCaptureGroup=null,
    projectRegionMips=[],projectRegionWidth=1,projectRegionHeight=1,projectRegionCaptureFrames=0,projectRegionCaptureKey=null;
  const artworkAtlas=createGlassArtworkAtlas(device,mipPipeline,()=>requestRender(),detailMipPipeline);
  const detailSampler=device.createSampler({magFilter:"linear",minFilter:"linear",
    mipmapFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});
  const emptyDetail=device.createTexture({size:[1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING});
  const emptyDetailView=emptyDetail.createView();
  let paneDetailViews=[],detailGroups=new Map(),authDetailEntries=null,routeLayerEntries=null;
  let trackTiles=[],trackIcons=[],trackIconBounds=[],trackRows=[],trackColumns=[],
    baseTileX=new Float32Array(0),baseTileY=new Float32Array(0),
    pitchCSS=0,trackOpacity=new Float32Array(0),
    dismissProgress=new Float32Array(0),cornerInert=new Uint8Array(0);
  const uniform=new Float32Array(continuous?24:20);
  const authUniform=new Float32Array(continuous?24:20);
  let tileData=new Float32Array(0),mosaicLayoutDirty=false;
  const mosaicCanDefer=()=>Boolean(audit.track?.dismissed)&&dismissStart!==null&&
    restoreStart===null&&!trackResumeRequested&&["login","projects"].includes(window.__dofPublicRouter?.state);
  function storageBuffer(previous,size){
    // Geometry changes do not change the storage ABI or instance count.
    // Keep buffers and their capacity until the actual byte size changes.
    if(previous?.size===size)return previous;
    previous?.destroy();
    audit.storageBufferAllocations=(audit.storageBufferAllocations||0)+1;
    return device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  }
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
    // The same frame clock drives the GPU quad and authored icon.
    uniform[2]=reducedMotion.matches?1:introStart===null?0:Math.min(1,(performance.now()-introStart)/1000);
    uniform[3]=dpr;
    const fit=coverUVScale(continuous?sourceWidth:physicalWidth,continuous?sourceHeight:physicalHeight,photoWidth,photoHeight);
    uniform[4]=fit[0];uniform[5]=fit[1];uniform[6]=.12;uniform[7]=0;
    uniform[8]=pointer.x*dpr;uniform[9]=(pointer.y-sceneTop)*dpr;
    uniform[10]=pointer.enabled;uniform[11]=0;
    const t=tint.state;
    // Authored tint RGB; scheme-specific native vibrantColorMatrix is NOT a hue transform.\n    uniform[12]=t.rgb[0];uniform[13]=t.rgb[1];uniform[14]=t.rgb[2];uniform[15]=t.opacity;
    uniform[16]=t.active?1:0;uniform[17]=t.scheme==="dark"?1:0;
    uniform[18]=0;uniform[19]=0;
    if(continuous){uniform[20]=physicalWidth;uniform[21]=physicalHeight;}
    device.queue.writeBuffer(globalsBuffer,0,uniform);
    if(authContext){
      authUniform.set(uniform);
      authUniform[1]=physicalAuthHeight;
      if(continuous){authUniform[20]=physicalWidth;authUniform[21]=physicalAuthHeight;}
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
  // The material buffer is deliberately independent of route tags and tile
  // animation. Both full-scene and pane-only submissions use it.
  function syncMaterialProfiles(){
    const panes=authPaneElements(),nodes=[...trackTiles,...panes];
    const scheme=tint.state.scheme;
    let changed=false,regularCount=0,clockTextCount=0;
    const roles=[],dropdowns=[];dropdownSlots=[];routeLayerSlots=[];
    for(let i=0;i<instanceCount;i++){
      const node=nodes[i],p=i*TILE_FLOATS,m=i*MATERIAL_FLOATS;
      const selectedMaterial=node&&glassMaterialFromElement(node);
      if(i>=tileCount){
        const requested=Number(node?.dataset.glassBackdropLayer||0);
        routeLayerSlots[i-tileCount]=Number.isInteger(requested)&&requested>=0&&requested<=2?requested:0;
      }
      const regular=selectedMaterial==="regular"&&tileData[p+2]>0&&tileData[p+3]>0;
      const dropdown=selectedMaterial==="dropdown"&&tileData[p+2]>0&&tileData[p+3]>0;
      if(selectedMaterial==="clock-text"&&node===glyphMaskOwner){
        const lanes=clockTextMaterialLanes();
        for(let j=0;j<MATERIAL_FLOATS;j++){
          const v=Math.fround(lanes[j]);
          if(materialData[m+j]!==v){materialData[m+j]=v;changed=true;}
        }
        tileData[p+6]=CLOCK_TEXT_PROFILE.blurWord;
        clockTextCount++;
      }else if(dropdown){
        const profile=resolveDropdownMaterial({width:tileData[p+2]/dpr,height:tileData[p+3]/dpr,
          scale:dpr,scheme:node.dataset.glassScheme||scheme,row:dropdownRowBounds(node)});
        const lanes=dropdownMaterialLanes(profile);
        for(let j=0;j<MATERIAL_FLOATS;j++){
          const v=Math.fround(lanes[j]);
          if(materialData[m+j]!==v){materialData[m+j]=v;changed=true;}
        }
        tileData[p+6]=profile.blurWord;
        if(i>=tileCount){
          dropdownSlots[i-tileCount]=true;
          if(tileData[p+18]>.002&&!node.hidden)dropdowns.push({slot:i-tileCount,
            width:tileData[p+2]/dpr,height:tileData[p+3]/dpr,scheme:profile.scheme,
            blurWord:profile.blurWord,activeRow:profile.row.map(v=>v/dpr),faceScope:profile.faceScope});
        }
      }else if(regular){
        const profile=resolveRegularMaterial({width:tileData[p+2]/dpr,
          height:tileData[p+3]/dpr,scale:dpr,scheme});
        const lanes=regularMaterialLanes(profile);
        for(let j=0;j<MATERIAL_FLOATS;j++){
          const v=Math.fround(lanes[j]);
          if(materialData[m+j]!==v){materialData[m+j]=v;changed=true;}
        }
        tileData[p+6]=profile.blurWord;
        regularCount++;
        roles.push({index:i,role:i<tileCount?"mosaic":node.dataset.publicProjectGlass||
          (node.hasAttribute("data-home-cta-glass")?"home-cta":
          node.hasAttribute("data-auth-glass-card")?"card":
          node.hasAttribute("data-auth-glass-input")?"input":
          node.hasAttribute("data-auth-glass-submit")?"submit":"provider-or-back"),
          mode:tileData[p+7],blurWord:tileData[p+6],faceScope:profile.faceScope});
      }else if(materialData[m]!==0){
        materialData.fill(0,m,m+MATERIAL_FLOATS);changed=true;
        if(node)tileData[p+6]=observedBlurWord(nativePublicBlurRadius("clear",
          tileData[p+2]/dpr,tileData[p+3]/dpr),1,.25);
      }
    }
    if(changed)device.queue.writeBuffer(materialBuffer,0,materialData);
    audit.materials={regular:regularCount,clockText:clockTextCount,clear:nodes.length-regularCount-clockTextCount-dropdownSlots.filter(Boolean).length,
      dropdown:dropdownSlots.filter(Boolean).length,scheme,roles,sharedPipeline:true};
    audit.dropdownGlass={visible:dropdowns,backdrop:"completed GPU route underlay",compositeFrames:dropdownCompositeFrames,sharedPipeline:true};
    routeActiveLayers=[...new Set(routeLayerSlots.filter((layer,i)=>layer>0&&tileData[(tileCount+i)*TILE_FLOATS+18]>.002))].sort((a,b)=>a-b);
  }
  // A material partition belongs to the original card instance, not an
  // overlapping pane. Keep its outer silhouette, hit-test, z-order and
  // dismissal. An independent Regular profile applies below its boundary.
  function syncGlassRegions(){
    regionData.fill(0);paneDetailViews=[];
    const panes=authPaneElements(),regions=[],usedDetails=new Set();
    let animating=false;
    for(let i=0;i<panes.length;i++){
      const node=panes[i];
      if(node.dataset.publicProjectGlass!=="card"||node.hidden||!node.offsetWidth)continue;
      const boundary=node.querySelector(".project-showcase-regular-boundary");
      if(!boundary)continue;
      const p=(tileCount+i)*TILE_FLOATS,b=(tileCount+i)*REGION_FLOATS;
      const w=tileData[p+2]/dpr,h=tileData[p+3]/dpr;
      const height=Math.min(h,Math.max(0,boundary.getBoundingClientRect().height));
      if(!(height>0))continue;
      // Independent dark, inactive Clear profile for the title-height band.
      const profile=resolveInactiveClearRegion({width:w,height});
      const photo=node.querySelector(".project-showcase-photo");
      const needsDetail=!authUsesCompositor()&&
        (node.matches(":hover,:focus-visible,.is-expanded,:has(>.project-showcase-trigger:focus-visible)")||
          Number.parseFloat(getComputedStyle(photo).opacity)>0);
      const artwork=artworkAtlas.sync(node,needsDetail,!authUsesCompositor());
      let opacity=0,layer=0,uv=[1,1,0,0];
      if(artwork){
        const style=getComputedStyle(artwork.photo);
        opacity=Number.parseFloat(style.opacity)||0;
        layer=artwork.layer+1;
        if(artwork.detailView&&opacity>0){
          paneDetailViews[i]=artwork.detailView;usedDetails.add(artwork.detailView);
        }
        const matrix=style.transform==="none"?new DOMMatrixReadOnly():new DOMMatrixReadOnly(style.transform);
        uv=artworkCoverTransform(w,h,photo.naturalWidth,photo.naturalHeight,
          Math.abs(matrix.a)||1,Math.abs(matrix.d)||1,matrix.e,matrix.f,...artworkCSSAlignment(style));
      }
      // Keep the 24-float region ABI. No Regular optical or face lanes
      // are populated; the shader uses the shared Clear optical path.
      const shadeAlpha=Math.max(0,Math.min(1,Number.parseFloat(getComputedStyle(node).getPropertyValue("--project-regular-progress"))||0));
      regionData.set([height*dpr,profile.blurWord,layer,opacity],b);
      regionData[b+4]=shadeAlpha;
      // Dedicated hero only: finish the short raw-backdrop fade at exact black.
      regionData[b+5]=node.hasAttribute("data-project-detail-hero")?1:0;
      regionData.set(uv,b+20);
      regions.push({slug:node.dataset.projectSlug,width:w,height:h,regularHeight:height,
        regularFraction:height/h,artworkLayer:layer,artworkOpacity:opacity,shadeAlpha,
        artworkDetail:artwork?.detailSize??null,artworkPresentation:"same-fragment",artworkUV:uv,
        canvasLocalTop:tileData[p+1]/dpr,canvasLocalLeft:tileData[p]/dpr,
        canvasLocalBandTop:(tileData[p+1]+tileData[p+3])/dpr-height,
        material:profile.material,scheme:profile.scheme,interactive:profile.interactive,
        blurWord:profile.blurWord,nativeInputLayerScale:profile.nativeInputLayerScale,
        backdrop:"raw-wallpaper-and-artwork-before-glass",clearUnderlay:false});
      animating ||= Boolean(photo?.getAnimations().some(a=>a.playState==="running"));
    }
    // Evict only unused detail sources; the lower refraction atlas is retained.
    for(const view of artworkAtlas.trimDetails(usedDetails)){detailGroups.delete(view);routeCompositeDetailGroups.delete(view);}
    device.queue.writeBuffer(regionBuffer,0,regionData);
    if(audit.projectGlass){
      audit.projectGlass.regions=regions;
      audit.projectGlass.scrollGeometry={presentation:fixedProjectRoot()?"fixed-viewport-synchronized":"native-content",
        canvasTop:authOriginTop(),canvasHeight:physicalAuthHeight/dpr,
        requestedScroll:routeOutlet?.scrollTop||0,presentedScroll:projectPresentedScroll};
      audit.projectGlass.projectRegionBackdrop={source:"raw-wallpaper-and-artwork",halfScale:true,coordinateSpace:"fixed-wallpaper",
        glassDrawsInCapture:0,mutuallyExclusiveMaterials:true,dimensions:[projectRegionWidth,projectRegionHeight],
        frames:projectRegionCaptureFrames};
    }
    return animating;
  }
  function sourceViews(){
    return {scene:{width:physicalWidth,height:physicalHeight,top:sceneTop,dpr},
      ...(continuous?{base:{width:sourceWidth,height:sourceHeight,top:sceneTop,dpr:sourceDpr}}:{}),
      route:{width:physicalWidth,height:physicalAuthHeight,top:authOriginTop(),dpr}};
  }
  function syncBaseSources(){
    const views=sourceViews();
    baseSourceEntries=[...document.querySelectorAll('[data-glass-paint="scene"]')].map(n=>sourcePainter.sync(n,"scene",views)).filter(Boolean);
    const key=JSON.stringify(baseSourceEntries.map(e=>[e.revision,e.rect,e.alpha]));
    if(key!==baseSourceKey){baseSourceKey=key;scenePending=true;}
  }
  // The route supplies hover policy; the shared atlas owns alpha and distance.
  function syncGlassIcons(dt,includeHome=true){
    iconData.fill(0);silhouetteAtlas.begin();referenceIconData.fill(0);
    const homeComposite=includeHome&&Boolean(audit.homeCtaGlass?.count)&&
      audit.homeCtaGlass.capsules.some(c=>c.opacity>.002&&c.tint>.002);
    const referenceActive=!!(continuous&&(routeActiveLayers.length||homeComposite));
    if(referenceActive&&!referenceCoverage)referenceCoverage=createVectorCoverageAtlas(device,requestRender);
    const before=silhouetteAtlas.view,beforeCoverage=silhouetteAtlas.coverageView,beforeField=continuous?.fieldView,icons=[],homeIcons=[];
    const movingSlots=new Set(),panes=authPaneElements();
    let animating=false;
    if(!authUsesCompositor()){
      const scheme=authGlassScheme();
      for(let i=0;i<panes.length;i++){
        const owner=panes[i],img=owner.querySelector("[data-glass-silhouette-source]");
        const slot=tileCount+i,p=slot*TILE_FLOATS;
        if(continuous&&owner===glyphMaskOwner&&glyphVectorIndex){
          const lanes=iconData.subarray(slot*GLASS_ICON_FLOATS,(slot+1)*GLASS_ICON_FLOATS);
          lanes.set([0,0,...glyphMaskDimensions,dpr],0);lanes.set(glyphVectorPhase,12);lanes[19]=glyphVectorIndex;
        }
        if(referenceActive&&owner===glyphMaskOwner&&glyphVectorIndex)referenceIconData.set(iconData.subarray(slot*GLASS_ICON_FLOATS,(slot+1)*GLASS_ICON_FLOATS),slot*GLASS_ICON_FLOATS);
        if(!img)continue;
        if(owner.hidden||tileData[p+18]<=.001){img.removeAttribute("data-glass-icon-owned");continue;}
        // Final SVG coverage is exact at the physical pixel phase. Only
        // request it for a pane that can contribute to a visible attachment.
        // Include the optical underlay's offset and the full dismissal bloom.
        if(!glassPaneIntersectsViewport(Array.from(tileData.subarray(p,p+4)),
          physicalWidth,physicalAuthHeight,authUniform[11],physicalHeight,tileData[p+19]))continue;
        const suppressed=owner.matches(".is-expanded,.project-showcase-dissolve-ghost")||
          owner.classList.contains("is-contracting")||tileData[p+19]>0;
        // The moving icon bounds and haze share the live card geometry clock.
        const hazeTransition=owner.matches(".is-expanded,.is-contracting")&&!owner.matches(".project-showcase-dissolve-ghost")&&tileData[p+19]<=0?
          projectIconHazeProgress(Number(getComputedStyle(owner).getPropertyValue("--project-regular-progress"))):null;
        const icon=silhouetteAtlas.sync(owner,img,{width:tileData[p+2],height:tileData[p+3],dpr,scheme,
          hover:owner.matches(":hover"),suppressHover:suppressed,hazeTransition,dt,reduced:reducedMotion.matches,
          opacity:tileDismissIconOpacity(tileData[p+19]),slot:i,
          ownerRect:Array.from(tileData.subarray(p,p+4)),dismiss:tileData[p+19]});
        if(!icon)continue;
        iconData.set(icon.lanes,slot*GLASS_ICON_FLOATS);
        if(continuous){
          const lanes=iconData.subarray(slot*GLASS_ICON_FLOATS,(slot+1)*GLASS_ICON_FLOATS);
          lanes[19]=continuous.indexFor(img);
          if(referenceActive){const b=Array.from(tileData.subarray(p,p+4));b[1]-=authUniform[11];const ref=referenceCoverage.sync(img,i,Array.from(lanes.subarray(0,4)),b,tileData[p+19],[sourceWidth/physicalWidth,sourceHeight/physicalHeight]);if(ref){const q=referenceIconData.subarray(slot*GLASS_ICON_FLOATS,(slot+1)*GLASS_ICON_FLOATS);q.set(lanes);q.set(ref.rect,12);q.set(ref.meta,16);q[19]=lanes[19];}}
        }
        animating ||= icon.animating;
        icons.push({slug:owner.dataset.projectSlug,bounds:icon.bounds,vectorCoverage:icon.vectorCoverage,hover:icon.hover,haze:icon.haze,
          tint:icon.tint,tintOpacity:icon.tintOpacity,suppressHover:suppressed,continuousVector:continuous?Boolean(continuous.indexFor(img)):false});
      }
    }else for(const img of document.querySelectorAll(".public-projects-root [data-glass-icon-owned]"))img.removeAttribute("data-glass-icon-owned");
    // Home uses the SAME silhouette lanes and vector controls as Projects.
    // Assign disjoint coverage slots during the route handoff: all sixteen
    // canonical home shapes fit alongside the sixteen project card shapes.
    if(includeHome&&!mosaicLayoutDirty){
      const reserved=new Set(panes.map((owner,i)=>owner.querySelector("[data-glass-silhouette-source]")?i:-1));
      const free=Array.from({length:32},(_,i)=>31-i).filter(i=>!reserved.has(i));
      let j=0;
      for(let i=0;i<trackIcons.length;i++){
        const img=trackIcons[i],owner=trackTiles[i],relative=trackIconBounds[i];
        if(!img||!relative)continue;
        const slot=free[j++],p=i*TILE_FLOATS,rect=Array.from(tileData.subarray(p,p+4));
        const dismiss=dismissProgress[i],intro=glassEntrance(uniform[2],tileData[p+5]);
        if(slot===undefined||dismiss>=1||trackOpacity[i]<=.001||!glassPaneIntersectsViewport(rect,physicalWidth,physicalHeight,0,physicalHeight,dismiss)){
          img.removeAttribute("data-glass-icon-owned");continue;
        }
        const bounds=relative.map((v,k)=>v*rect[2+(k%2)]);
        // The vertex shader's intro and dismissal scales determine exact
        // framebuffer coverage. Do not resample an old moving icon mask.
        const icon=silhouetteAtlas.sync(owner,img,{width:rect[2],height:rect[3],dpr,scheme:authGlassScheme(),
          suppressHover:true,dt,reduced:reducedMotion.matches,opacity:tileDismissIconOpacity(dismiss),
          slot,ownerRect:rect,dismiss,entranceScale:intro.scale,boundsOverride:bounds});
        if(!icon)continue;
        const lanes=iconData.subarray(i*GLASS_ICON_FLOATS,(i+1)*GLASS_ICON_FLOATS);
        lanes.set(icon.lanes);
        if(continuous){
          lanes[19]=continuous.indexFor(img);
          // Moving geometry changes its sample phase each frame. Direct
          // continuous evaluation avoids rebuilding a large cache every
          // frame; stationary/reduced-motion icons use exact sample reuse.
          if(trackRunning||!audit.track?.introComplete||dismiss>0)movingSlots.add(i);
          if(homeComposite){
            const ref=referenceCoverage.sync(img,slot,bounds,rect,dismiss,[sourceWidth/physicalWidth,sourceHeight/physicalHeight],intro.scale);
            if(ref){const q=referenceIconData.subarray(i*GLASS_ICON_FLOATS,(i+1)*GLASS_ICON_FLOATS);q.set(lanes);q.set(ref.rect,12);q.set(ref.meta,16);q[19]=lanes[19];}
          }
        }
        homeIcons.push({slug:owner.dataset.homeProjectIcon,bounds:icon.bounds,tint:icon.tint,tintOpacity:icon.tintOpacity,vectorCoverage:icon.vectorCoverage,continuousVector:continuous?Boolean(lanes[19]):false});
      }
    }
    if(continuous){
      // Grow once, before binding any dispatch to the exact sample cache.
      const extent=lanes=>{let max=0;for(let slot=0;slot<instanceCount;slot++){const i=slot*GLASS_ICON_FLOATS;if(lanes[i+19]>0&&lanes[i+16]>0){const n=Math.max(lanes[i+17],lanes[i+18]);if(n<=256)max=Math.max(max,n);}}return max;};
      continuous.ensureField("display",extent(iconData));if(referenceActive)continuous.ensureField("reference",extent(referenceIconData));
      continuous.beginCache();try{for(let slot=0;slot<instanceCount;slot++){const lanes=iconData.subarray(slot*GLASS_ICON_FLOATS,(slot+1)*GLASS_ICON_FLOATS);if(!movingSlots.has(slot)&&lanes[19]>0&&lanes[16]>0&&continuous.cacheField(lanes,silhouetteAtlas.coverageView))lanes[19]*=-1;
      if(referenceActive){const q=referenceIconData.subarray(slot*GLASS_ICON_FLOATS,(slot+1)*GLASS_ICON_FLOATS);if(!movingSlots.has(slot)&&q[19]>0&&q[16]>0&&continuous.cacheField(q,referenceCoverage.view,"reference"))q[19]*=-1;}}}finally{continuous.endCache();}}
    device.queue.writeBuffer(iconBuffer,0,iconData);
    if(referenceActive){device.queue.writeBuffer(referenceIconBuffer,0,referenceIconData);const a=referenceCoverage.view,b=continuous.fieldFor("reference");if(a!==referenceBindingView||b!==referenceFieldBinding){referenceBindingView=a;referenceFieldBinding=b;rebindGlassGroups();}}
    if(before!==silhouetteAtlas.view||beforeCoverage!==silhouetteAtlas.coverageView||beforeField!==continuous?.fieldView)rebindGlassGroups();
    audit.glassSilhouettes={icons,homeIcons,...silhouetteAtlas.stats(),...(continuous?{continuousSampleCache:continuous.stats()}:{}),backdrop:"current fragment color + original GPU sources"};
    return animating;
  }
  function syncRouteSources(){
    const views=sourceViews(),panes=authPaneElements();
    routeSourceEntries=authUsesCompositor()?[]:panes.map(p=>sourceNodesForPane(p).map(n=>sourcePainter.sync(n,"route",views)).filter(Boolean));
    // The native HTML foreground is above the entire route canvas. Cut
    // only the overlapping portion out at the same submitted pane opacity
    // and geometry, never re-register it as a GPU paint source.
    const covers=[],retargeting=Boolean(document.querySelector(".public-projects-root.is-project-retargeting"));
    const paneOrder=retargeting?new Map(panes.map((node,i)=>[node,i])):null;
    if(!authUsesCompositor())for(let i=0;i<panes.length;i++){
      const node=panes[i],role=node.dataset.publicProjectGlass;
      const dropdown=node.hasAttribute("data-glass-dropdown")&&routeLayerSlots[i]>0;
      if(!dropdown&&!(retargeting&&(role==="card"||role==="expand-close")))continue;
      // A dissolving X sits beneath the arriving native badge; its old
      // full rectangle must not continue masking foreground.
      if(role==="expand-close"&&node.hasAttribute("data-project-close-dismissing"))continue;
      const p=(tileCount+i)*TILE_FLOATS,alpha=tileData[p+18];
      if(alpha<=.002||node.hidden)continue;
      covers.push({left:tileData[p]/dpr,top:tileData[p+1]/dpr+authOriginTop(),
        width:tileData[p+2]/dpr,height:tileData[p+3]/dpr,radius:tileData[p+4]/dpr,opacity:alpha,
        order:i,dropdown});
    }
    // During direct switches, only higher submitted panes occlude lower
    // native foreground; the selected pane never masks its own text.
    const occluded=nativeOcclusion.sync(covers.length?document.querySelectorAll(".public-projects-root .project-showcase-content"):[],covers,
      (cover,node)=>cover.dropdown||cover.order>(paneOrder?.get(node.closest(".project-showcase-card"))??Infinity));
    sourcePainter.sweep();
    audit.sourceComposition={base:baseSourceEntries.length,mosaic:0,route:routeSourceEntries.flat().length,
      routeLayers:[...routeActiveLayers],nativeOccluded:occluded,...sourcePainter.stats(),source:"authored primitives; no captured page pixels"};
  }
  function rebindGlassGroups(){
    if(!sceneView||!tileBuffer||!tintTileBuffer||!materialBuffer||!regionBuffer||!iconBuffer||!projectRegionSceneView)return;
    detailGroups.clear();routeCompositeDetailGroups.clear();routeLayerSources.clear();
    const entries=(buffer,source=sceneView,detail=emptyDetailView,reference=false)=>[
      {binding:0,resource:source},
      {binding:1,resource:{buffer:tileBuffer}},
      {binding:2,resource:{buffer}},
      {binding:3,resource:{buffer:tintTileBuffer}},
      {binding:4,resource:(reference&&referenceGlyphTexture?referenceGlyphTexture:glyphMaskTexture).createView()},
      {binding:5,resource:{buffer:materialBuffer}},
      {binding:6,resource:{buffer:regionBuffer}},
      // Source-only artwork binding 7 belongs exclusively to the capture
      // pipeline; the glass pipeline consumes only the composed capture.
      {binding:8,resource:projectRegionSceneView},
      {binding:9,resource:detail},{binding:10,resource:detailSampler},
      {binding:11,resource:{buffer:reference&&referenceIconBuffer?referenceIconBuffer:iconBuffer}},...(!continuous?[{binding:12,resource:silhouetteAtlas.view}]:[]),
      {binding:13,resource:silhouetteAtlas.hazeView},{binding:14,resource:reference&&referenceBindingView?referenceBindingView:silhouetteAtlas.coverageView},
      ...(continuous?[{binding:15,resource:{buffer:continuous.buffer}},{binding:16,resource:reference&&referenceFieldBinding?referenceFieldBinding:continuous.fieldView}]:[])
    ];
    authDetailEntries=detail=>entries(authGlobalsBuffer,sceneView,detail);
    routeCompositeEntries=(detail,source=sceneView)=>entries(routeCompositeGlobalsBuffer,source,detail,!!continuous);
    routeLayerEntries=(buffer,source,detail)=>entries(buffer,source,detail,!!continuous&&buffer===routeCompositeGlobalsBuffer);
    projectRegionCaptureGroup=null; // bind only when a region actually renders
    glassGroup=device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),entries:entries(globalsBuffer)
    });
    authGlassGroup=device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),entries:entries(authGlobalsBuffer)
    });
    // Offscreen squares read the existing STATIC wallpaper, as always.
    compositeGlassGroup=device.createBindGroup({
      layout:compositeGlassPipeline.getBindGroupLayout(0),
      entries:entries(homeCompositeGlobalsBuffer,sceneView,emptyDetailView,!!continuous)
    });
    // Only HOME CAPSULES read this frame's composited moving glass.
    homeCapsuleGroup=compositeSceneView?device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),
      entries:entries(globalsBuffer,compositeSceneView)
    }):null;
    routeCompositeBaseGroup=device.createBindGroup({layout:compositeGlassPipeline.getBindGroupLayout(0),
      entries:routeCompositeEntries(emptyDetailView)});
    routeMenuGroup=compositeSceneView?device.createBindGroup({layout:glassPipeline.getBindGroupLayout(0),
      entries:entries(authGlobalsBuffer,compositeSceneView)}):null;
  }
  // Paint owner sources immediately after their surface. Upper glass
  // samples completed lower attachments; final display repeats the same order.
  function drawRouteLayer(pass,layer,underlay){
    const pipeline=underlay?compositeGlassPipeline:glassPipeline;
    const source=routeLayerSources.get(layer);
    let first=0;
    while(first<AUTH_PANE_CAPACITY){
      const menu=Boolean(dropdownSlots[first]),view=paneDetailViews[first],slotLayer=routeLayerSlots[first]||0;
      if(slotLayer!==layer){first++;continue;}
      const paint=routeSourceEntries[first]||[];
      let end=first+1;
      while(!paint.length&&end<AUTH_PANE_CAPACITY&&(routeLayerSlots[end]||0)===layer&&
        paneDetailViews[end]===view&&Boolean(dropdownSlots[end])===menu&&!routeSourceEntries[end]?.length)end++;
      let group=underlay?routeCompositeBaseGroup:authGlassGroup;
      if(source){
        const maps=underlay?source.underlayGroups:source.displayGroups,key=view||emptyDetailView;
        group=maps.get(key);
        if(!group){
          group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),
            entries:routeLayerEntries(underlay?routeCompositeGlobalsBuffer:authGlobalsBuffer,source.view,key)});
          maps.set(key,group);
        }
      }else if(view){
        const groups=underlay?routeCompositeDetailGroups:detailGroups;
        group=groups.get(view);
        if(!group){
          group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),
            entries:(underlay?routeCompositeEntries:authDetailEntries)(view)});
          groups.set(view,group);
        }
      }
      pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(6,end-first,0,tileCount+first);
      sourcePainter.draw(pass,paint,underlay?"scene":"route",underlay?"offscreen":"screen");
      first=end;
    }
  }
  function drawRoutePanes(pass,underlay=false){
    drawRouteLayer(pass,0,underlay);
    if(!underlay)for(const layer of routeActiveLayers)drawRouteLayer(pass,layer,false);
  }
  function ensureCompositeScene(home=false){
    const fixed=!!continuous;
    const w=fixed?sourceWidth:physicalWidth,h=fixed?sourceHeight:physicalHeight;
    if(compositeScene&&compositeScene.width===w&&compositeScene.height===h)return;
    compositeScene?.destroy();
    compositeScene=rgba16Texture(device,w,h);
    compositeSceneView=compositeScene.createView();
    compositeMips=[];
    for(let level=1;level<compositeScene.mipLevelCount;level++)compositeMips.push(device.createBindGroup({
      layout:mipPipeline.getBindGroupLayout(0),entries:[
        {binding:0,resource:compositeScene.createView({baseMipLevel:level-1,mipLevelCount:1})},
        {binding:1,resource:compositeScene.createView({baseMipLevel:level,mipLevelCount:1})}
      ]}));
    rebindGlassGroups();
  }
  function mipComposite(encoder,texture,groups){
    for(let level=1;level<texture.mipLevelCount;level++){
      const mip=encoder.beginComputePass({label:"Completed authored lower-layer mip "+level});
      mip.setPipeline(mipPipeline);mip.setBindGroup(0,groups[level-1]);
      mip.dispatchWorkgroups(Math.ceil(Math.max(1,texture.width>>level)/8),
        Math.ceil(Math.max(1,texture.height>>level)/8),1);mip.end();
    }
  }
  function renderRouteDropdownBackdrop(encoder){
    routeLayerSources.clear();
    if(!routeActiveLayers.length)return;
    ensureCompositeScene();
    if(!routeMenuGroup)return;
    const u=new Float32Array(authUniform);
    // All intermediate attachments are optical inputs, not display surfaces.
    // Exclude icon contrast haze from their mip pyramids, even when a
    // higher glass layer (such as a dropdown) samples this lower layer.
    u[1]=physicalHeight;u[7]=physicalHeight;u[19]=authUniform[11];u[11]=0;u[18]=-1;
    if(continuous){u[20]=compositeScene.width;u[21]=compositeScene.height;}
    device.queue.writeBuffer(routeCompositeGlobalsBuffer,0,u);
    const pass=encoder.beginRenderPass({label:"Completed base route glass + authored foreground",
      colorAttachments:[{view:compositeScene.createView({baseMipLevel:0,mipLevelCount:1}),
      loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]});
    pass.setPipeline(compositeBackdropPipeline);pass.setBindGroup(0,compositeBackdropGroup);pass.draw(3);
    drawRoutePanes(pass,true);pass.end();mipComposite(encoder,compositeScene,compositeMips);
    const source=view=>({view,underlayGroups:new Map(),displayGroups:new Map()});
    routeLayerSources.set(routeActiveLayers[0],source(compositeSceneView));
    if(routeActiveLayers.length>1){
      if(!secondRouteScene){
        secondRouteScene=rgba16Texture(device,compositeScene.width,compositeScene.height);
        secondRouteMips=[];
        for(let level=1;level<secondRouteScene.mipLevelCount;level++)secondRouteMips.push(device.createBindGroup({layout:mipPipeline.getBindGroupLayout(0),entries:[
          {binding:0,resource:secondRouteScene.createView({baseMipLevel:level-1,mipLevelCount:1})},
          {binding:1,resource:secondRouteScene.createView({baseMipLevel:level,mipLevelCount:1})}]}));
        secondRouteCopyGroup=device.createBindGroup({layout:compositeBackdropPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:compositeSceneView}]});
      }
      const upper=encoder.beginRenderPass({label:"Complete intermediate glass + foreground",
        colorAttachments:[{view:secondRouteScene.createView({baseMipLevel:0,mipLevelCount:1}),loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]});
      upper.setPipeline(compositeBackdropPipeline);upper.setBindGroup(0,secondRouteCopyGroup);upper.draw(3);
      drawRouteLayer(upper,routeActiveLayers[0],true);upper.end();mipComposite(encoder,secondRouteScene,secondRouteMips);
      routeLayerSources.set(routeActiveLayers[1],source(secondRouteScene.createView()));
    }else if(secondRouteScene){
      secondRouteScene.destroy();secondRouteScene=null;secondRouteMips=[];secondRouteCopyGroup=null;
    }
    if(audit.dropdownGlass?.visible.length)audit.dropdownGlass.compositeFrames=++dropdownCompositeFrames;
    audit.sourceComposition.completedLayers=[...routeActiveLayers];
    if(continuous)audit.routeCompositeLattice={width:compositeScene.width,height:compositeScene.height,referenceIcons:referenceIconData.filter((_,i)=>i%20===19).filter(v=>v!==0).length,referenceGlyph:!!referenceGlyphTexture};
  }
  function syncGlassTextMask(panes){
    const title=panes.find(node=>node.hasAttribute("data-glass-text"));
    if(glyphMaskOwner&&glyphMaskOwner!==title)glyphMaskOwner.removeAttribute("data-glass-text-ready");
    glyphMaskOwner=null;if(!title)return;
    const style=getComputedStyle(title),rect=title.getBoundingClientRect();
    const headingScale=projectHeadingScale(title);
    // Read the untransformed CSS box, not a succession of resampled glyphs.
    const naturalWidth=title.dataset.publicProjectGlass==="title"?parseFloat(style.width):rect.width;
    const naturalHeight=title.dataset.publicProjectGlass==="title"?parseFloat(style.height):rect.height;
    const width=Math.max(1,Math.ceil(naturalWidth*dpr)),height=Math.max(1,Math.ceil(naturalHeight*dpr)),text=title.textContent||"";
    const homeBrand=title.id==="dashboard-title";
    const layout=continuous?.titleAvailable?makeLayoutData(title,dpr,homeBrand?sceneTop:authOriginTop()):null;
    const phase=layout&&headingScale===1?layout.slice(0,2).map(v=>{const n=.5-Math.fround(v);return n-Math.floor(n);}):[.5,.5];
    const geometrySignature=JSON.stringify([text,width,height,dpr,style.fontFamily,style.fontSize,
      style.fontWeight,style.fontStyle,style.letterSpacing,style.lineHeight,style.direction,style.fontKerning,document.fonts?.status]);
    const signature=geometrySignature+JSON.stringify(phase);
    if(signature===glyphMaskKey){
      glyphMaskOwner=title;if(!title.hasAttribute("data-glass-text-ready"))title.dataset.glassTextReady="";return;
    }
    if(width>device.limits.maxTextureDimension2D||height>device.limits.maxTextureDimension2D){
      title.removeAttribute("data-glass-text-ready");return;
    }
    try{
      if(glyphVectorIndex&&glyphAlphaTexture&&glyphAlphaKey===geometrySignature&&continuous?.titleAvailable){
        const next=continuous.titleField(text,style,width,height,dpr,glyphAlphaTexture,phase,glyphMaskTexture);
        if(next&&next.texture===glyphMaskTexture){glyphVectorPhase=phase;glyphMaskKey=signature;glyphMaskOwner=title;if(!title.hasAttribute("data-glass-text-ready"))title.dataset.glassTextReady="";return;}
      }
      const raster=continuous?.rasterTitle(text,style,width,height,dpr)||rasterClockText(text,style,width,height,dpr);
      if(continuous){const rw=Math.max(1,Math.ceil(naturalWidth*sourceDpr)),rh=Math.max(1,Math.ceil(naturalHeight*sourceDpr));const rk=JSON.stringify([text,rw,rh,style.fontFamily,style.fontSize,style.fontWeight,style.fontStyle,style.letterSpacing,style.lineHeight,style.direction,style.fontKerning,document.fonts?.status]);if(rk!==referenceGlyphKey){const ref=dpr===sourceDpr&&width===rw&&height===rh?raster:(continuous?.rasterTitle(text,style,rw,rh,sourceDpr)||rasterClockText(text,style,rw,rh,sourceDpr));if(ref){const previous=referenceGlyphTexture;referenceGlyphTexture=device.createTexture({label:"Fixed logical title coverage and fallback field",size:[rw,rh,1],format:"rgba16float",usage:glyphUsage});device.queue.writeTexture({texture:referenceGlyphTexture},ref.pixels,{bytesPerRow:rw*8,rowsPerImage:rh},[rw,rh,1]);referenceGlyphKey=rk;rebindGlassGroups();previous?.destroy();}}}
      if(!raster){title.removeAttribute("data-glass-text-ready");return;}
      const resized=width!==glyphMaskDimensions[0]||height!==glyphMaskDimensions[1]||glyphVectorIndex>0,previous=glyphMaskTexture;
      const texture=resized?device.createTexture({label:"Native clock text: 10-bit SDF, normals and full-pixel glyph coverage",
        size:[width,height,1],format:"rgba16float",usage:glyphUsage}):previous;
      const pixels=raster.pixels;
      device.queue.writeTexture({texture},pixels,{offset:0,bytesPerRow:width*8,rowsPerImage:height},{width,height,depthOrArrayLayers:1});
      let vector=null;
      if(continuous?.titleAvailable)vector=continuous.titleField(text,style,width,height,dpr,texture,phase,glyphVectorIndex?previous:null);
      glyphMaskTexture=vector?.texture||texture;glyphVectorIndex=vector?.index||0;glyphVectorPhase=phase;
      glyphMaskKey=signature;glyphMaskDimensions=[width,height];glyphMaskOwner=title;
      if(glyphMaskTexture!==previous){rebindGlassGroups();if(previous!==texture||!vector)previous.destroy();}
      if(glyphAlphaTexture&&glyphAlphaTexture!==texture)glyphAlphaTexture.destroy();
      glyphAlphaTexture=vector?texture:null;glyphAlphaKey=vector?geometrySignature:"";
      if(!title.hasAttribute("data-glass-text-ready"))title.dataset.glassTextReady="";
      audit.projectTitleMask={text,owner:homeBrand?"home-brand":"route-heading",source:"computed-font contour and alpha only; no DOM or wallpaper capture",
        width,height,nonzeroPixels:raster.filled,shaderTag:-8,material:"clock-text",sdfBits:vector?32:10,distanceRange:vector?null:[-24,1],vectorOptics:!!vector,vectorCurves:vector?.curves||0,titleMode:continuous?.titleMode||"system",localEvidence:vector?.localEvidence,
        pipeline:"shared-webgpu-glassPipeline",nativeEvidence:"2f4217b4530654e6e9fd432c9834528c0fdd2e89"};
    }catch(error){title.removeAttribute("data-glass-text-ready");console.warn("Glass heading contour:",String(error));}
  }
  function paintAuthPanes(){
    const panes=authPaneElements(),scheme=authGlassScheme();
    const projectRoot=document.querySelector(".public-projects-root");
    const projects=Boolean(projectRoot);
    const homeCtas=panes[0]?.hasAttribute("data-home-cta-glass")===true;
    const homeGroupOpacity=homeCtas?Math.max(0,Math.min(1,
      Number.parseFloat(getComputedStyle(panes[0].parentElement).opacity)||0)):1;
    syncGlassTextMask(panes);
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
      // Clock-text has no rounded-rectangle radius; its unused radius lane
      // transports only the live geometric scale of the heading.
      if(node.hasAttribute("data-glass-text"))tileData[p+4]=projectHeadingScale(node);
      const paneOpacity=node.hasAttribute("data-glass-text")&&node!==glyphMaskOwner?0:(node.hasAttribute("data-glass-dropdown")||node.hasAttribute("data-glass-text"))?Math.max(0,Math.min(1,
        Number.parseFloat(getComputedStyle(node).opacity)||0)):homeCtas?
        homeGroupOpacity*Math.max(0,Math.min(1,
          Number.parseFloat(getComputedStyle(node).opacity)||0)):
        projects?Math.max(0,Math.min(1,
          Number.parseFloat(getComputedStyle(node).opacity)||0)):opacity;
      const homeBrand=homeCtas&&node.id==="dashboard-title";
      tileData[p+18]=paneOpacity*(homeBrand?Math.max(0,Math.min(1,Number.parseFloat(getComputedStyle(node.parentElement).opacity)||0)):1);tileData[p+19]=0;
      if(homeBrand){
        const elapsed=audit.track?.dismissElapsed??-1;
        const progress=elapsed<0?0:tileDismissProgress(elapsed,0,5);
        const drift=tileDismissDrift(progress,0,5,tileData[p],tileData[p+2],physicalWidth,dpr);
        tileData[p]+=drift.x*dpr;tileData[p+1]+=drift.y*dpr;
        tileData[p+19]=progress;
      }
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
      if(projects&&projectRole==="expand-close"&&node.hasAttribute("data-project-close-dismissing")){
        const progress=reducedMotion.matches?1:Math.max(0,Math.min(1,
          Number.parseFloat(getComputedStyle(node).getPropertyValue("--project-close-dissolve"))||0));
        const drift=tileDismissDrift(progress,0,5,tileData[p],tileData[p+2],physicalWidth,dpr);
        const size=Math.min(tileData[p+2],tileData[p+3])/(120*dpr);
        tileData[p]+=drift.x*dpr*size;
        tileData[p+1]+=drift.y*dpr*size;
        tileData[p+19]=progress;
      }
      if(projects&&projectRole==="card"){
        const cardDismissStart=Number.parseFloat(node.dataset.projectCardDismissAt);
        const cardRestoreStart=Number.parseFloat(node.dataset.projectCardRestoreAt);
        const cardRestoreFrom=Number.parseFloat(node.dataset.projectCardRestoreFrom);
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
        }else if(foreground){
          // The same DOM card is recycled after every cascade. No inline
          // optical artifacts may survive its arrival or a route exit.
          foreground.style.removeProperty("opacity");
          foreground.style.removeProperty("filter");
        }
      }
      cornerInert[slot]=paneOpacity<.025||tileData[p+19]>=1||node.hasAttribute("data-glass-text")||
        (projects&&(node.matches(".project-showcase-dissolve-ghost,.is-contracting")||getComputedStyle(node).pointerEvents==="none"))?1:0;
      roles.push(homeCtas?"home-cta-"+i:
        projects?node.dataset.publicProjectGlass:
        node.hasAttribute("data-auth-glass-card")?"card":
        node.classList.contains("auth3-back-link")?"back":
        node.hasAttribute("data-auth-glass-submit")?"submit":"control");
    }
    interaction.retargetRects(tileData,cornerInert);
    if(projects&&pointer.enabled)authHover.reproject(pointer.x*dpr,(pointer.y-authOriginTop())*dpr);
    authHover.retargetRects(tileData,tileCount,cornerInert,
      projects||homeCtas||card?.hasAttribute("data-glass-dropdown")?"independent":"nested",projects?panes:null);
    if(homeCtas){
      audit.homeCtaGlass={renderer:"shared-webgpu-glassPipeline",
        materialTag:-9,face:"shared-per-surface-Clear",count:panes.filter(node=>node.hasAttribute("data-home-cta-glass")).length,roles:roles.slice(0,3),
        brandSlot:panes.findIndex(node=>node.id==="dashboard-title"),
        brandGlyphGlass:glyphMaskOwner?.id==="dashboard-title",
        brandDismiss:panes.some(node=>node.id==="dashboard-title")?tileData[(tileCount+panes.findIndex(node=>node.id==="dashboard-title"))*TILE_FLOATS+19]:null,
        tintModel:"shared-square-film",tintFilmStrength:0.25,
        pressLightGain:GLASS_INTERACTION.pressLight,
        geometry:"oracle-finite-per-surface-min-dimension",
        layers:PUBLIC_HOME_GLASS_LAYERS.map(x=>({...x})),
        backdrop:"GPU-composited-moving-squares",
        compositeFrames:homeCompositeFrames,
        liveGeometry:true,capsules:panes.slice(0,3).map((node,i)=>{
          const p=(tileCount+i)*TILE_FLOATS;
          return {width:tileData[p+2]/dpr,height:tileData[p+3]/dpr,
            radius:tileData[p+4]/dpr,renderMode:tileData[p+7],
            nativeClear:projectFiniteNativeClearGlass(
              tileData[p+2]/dpr,tileData[p+3]/dpr),
            content:surfaceContentFromElement(node),opacity:tileData[p+18],
            tint:Number.parseFloat(getComputedStyle(node).getPropertyValue("--home-cta-tint"))||0};
        })};
      audit.authGlass=null;audit.projectGlass=null;
      const brand=panes.find(node=>node.id==="dashboard-title");
      const brandOpacity=brand?Number.parseFloat(getComputedStyle(brand.parentElement).opacity):1;
      return homeGroupOpacity>.001&&homeGroupOpacity<.999||brandOpacity<.999;
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
  function rebuild({deferDismissedMosaic=false}={}){
    if(stopped)return;
    const viewport=actualSceneViewport();
    sceneTop=viewport.top;
    dpr=window.devicePixelRatio||1;
    const w=Math.max(1,Math.floor(window.innerWidth*dpr));
    const h=Math.max(1,Math.floor(viewport.height*dpr));
    if(w>device.limits.maxTextureDimension2D||h>device.limits.maxTextureDimension2D)
      throw new Error("Visible image region exceeds GPU maxTextureDimension2D");
    // Keep the authored optical source lattice independent of display density.
    // Dynamic underlays still render at output density; their continuous
    // sampler maps LOD to their own logical source spacing.
    const sourceScale=continuous?2:dpr;
    const sw=Math.max(1,Math.floor(innerWidth*sourceScale)),sh=Math.max(1,Math.floor(viewport.height*sourceScale));
    if(sw>device.limits.maxTextureDimension2D||sh>device.limits.maxTextureDimension2D)throw Error("Reference source exceeds GPU limit");
    const sourceSized=sw!==sourceWidth||sh!==sourceHeight||!scene;
    const sized=w!==physicalWidth||h!==physicalHeight||sourceSized;
    physicalWidth=w;physicalHeight=h;sourceWidth=sw;sourceHeight=sh;sourceDpr=sourceScale;
    if(continuous)audit.sourceLattice={width:sw,height:sh,density:sourceScale,outputWidth:w,outputHeight:h,scope:"fixed logical base and reference optical attachments"};
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
      if(sourceSized)scene?.destroy();
      compositeScene?.destroy();projectRegionScene?.destroy();
      secondRouteScene?.destroy();secondRouteScene=null;secondRouteMips=[];secondRouteCopyGroup=null;
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
      if(sourceSized){scene=rgba16Texture(device,sourceWidth,sourceHeight);sceneView=scene.createView();}
      // Allocate the full-resolution secondary scene only when an upper
      // glass layer actually samples it. Preserve its format and every mip.
      compositeScene=null;compositeSceneView=null;homeCapsuleGroup=null;routeMenuGroup=null;
      // Clear uses a half-resolution raw base and its own mip chain.
      // Never sample the glass-composited Home scene.
      const halfBase=Math.min(1,scene.mipLevelCount-1);
      projectRegionWidth=Math.max(1,sourceWidth>>halfBase);projectRegionHeight=Math.max(1,sourceHeight>>halfBase);
      projectRegionScene=rgba16Texture(device,projectRegionWidth,projectRegionHeight);
      projectRegionSceneView=projectRegionScene.createView();
      projectRegionCopyGroup=device.createBindGroup({layout:compositeBackdropPipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:scene.createView({baseMipLevel:halfBase,mipLevelCount:1})}]});
      projectRegionMips=[];projectRegionCaptureKey=null;
      for(let level=1;level<projectRegionScene.mipLevelCount;level++)projectRegionMips.push(device.createBindGroup({
        layout:mipPipeline.getBindGroupLayout(0),entries:[
          {binding:0,resource:projectRegionScene.createView({baseMipLevel:level-1,mipLevelCount:1})},
          {binding:1,resource:projectRegionScene.createView({baseMipLevel:level,mipLevelCount:1})}
        ]}));
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
      }
      copyGroup=device.createBindGroup({
        layout:copyPipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:sceneView}]
      });
      compositeBackdropGroup=device.createBindGroup({
        layout:compositeBackdropPipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:sceneView}]
      });
      scenePending ||= sourceSized;
    }
    // An already fully dismissed mosaic contributes no visible pixels.
    // Resize the full-resolution scene, but do not invalidate/re-measure
    // every hidden tile or rebuild instance buffers on a settled route.
    // Reflow once at the current dimensions before the mosaic returns.
    if(deferDismissedMosaic&&tileBuffer&&mosaicCanDefer()){
      mosaicLayoutDirty=true;
      cornerInert.fill(1,0,tileCount);
      audit.deferredMosaicResizes=(audit.deferredMosaicResizes||0)+1;
      if(sized)rebindGlassGroups();
      return;
    }
    mosaicLayoutDirty=false;
    audit.mosaicLayoutBuilds=(audit.mosaicLayoutBuilds||0)+1;
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
    // Layout is stable throughout the moving track. Measure normalized SVG
    // bounds only on layout rebuild, not after every animated DOM write.
    trackIconBounds=all.map((cell,i)=>{
      const img=trackIcons[i];if(!img)return null;
      const a=cell.getBoundingClientRect(),b=img.getBoundingClientRect();
      return a.width>0&&a.height>0?[(b.left-a.left)/a.width,(b.top-a.top)/a.height,b.width/a.width,b.height/a.height]:null;
    });
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
    materialData=new Float32Array(instanceCount*MATERIAL_FLOATS);
    regionData=new Float32Array(instanceCount*REGION_FLOATS);
    iconData=new Float32Array(instanceCount*GLASS_ICON_FLOATS);if(continuous)referenceIconData=new Float32Array(iconData.length);
    audit.sdfModes={
      mode4:all.filter(t=>selectModeForNormalizedCorners([
        getComputedStyle(t).borderTopLeftRadius,
        getComputedStyle(t).borderTopRightRadius,
        getComputedStyle(t).borderBottomRightRadius,
        getComputedStyle(t).borderBottomLeftRadius
      ])===4).length
    };
    audit.sdfModes.mode5=tileCount-audit.sdfModes.mode4;
    tileBuffer=storageBuffer(tileBuffer,Math.max(48,data.byteLength));
    if(data.length)device.queue.writeBuffer(tileBuffer,0,data);
    tintTileBuffer=storageBuffer(tintTileBuffer,Math.max(16,tintData.byteLength));
    materialBuffer=storageBuffer(materialBuffer,Math.max(MATERIAL_FLOATS*4,materialData.byteLength));
    device.queue.writeBuffer(materialBuffer,0,materialData);
    regionBuffer=storageBuffer(regionBuffer,Math.max(REGION_FLOATS*4,regionData.byteLength));
    device.queue.writeBuffer(regionBuffer,0,regionData);
    iconBuffer=storageBuffer(iconBuffer,Math.max(GLASS_ICON_FLOATS*4,iconData.byteLength));if(continuous)referenceIconBuffer=storageBuffer(referenceIconBuffer,Math.max(GLASS_ICON_FLOATS*4,iconData.byteLength));
    device.queue.writeBuffer(iconBuffer,0,iconData);
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
    sourcePainter.draw(pass,baseSourceEntries,continuous?"base":"scene","offscreen");
    pass.end();
    for(let level=1;level<scene.mipLevelCount;level++){
      const next=encoder.beginComputePass({label:"mip level "+level});
      next.setPipeline(mipPipeline);
      next.setBindGroup(0,mipGroups[level-1]);
      next.dispatchWorkgroups(Math.ceil(Math.max(1,sourceWidth>>level)/8),
        Math.ceil(Math.max(1,sourceHeight>>level)/8),1);
      next.end();
    }
    device.queue.submit([encoder.finish()]);
    scenePending=false;
    audit.sceneBuilds++;
  }
  function renderProjectRegionCapture(encoder){
    if(!audit.projectGlass?.regions?.length||!projectRegionScene)return;
    if(!projectRegionCaptureGroup)projectRegionCaptureGroup=device.createBindGroup({layout:projectRegionCapturePipeline.getBindGroupLayout(0),entries:[
      {binding:1,resource:{buffer:tileBuffer}},
      {binding:2,resource:{buffer:authGlobalsBuffer}},
      {binding:6,resource:{buffer:regionBuffer}},
      {binding:7,resource:artworkAtlas.view}
    ]});
    // Static wallpaper with no exposed art is identical across all scroll
    // positions. Rebuild only when source geometry/opacity actually changes.
    const visibleSources=[];
    for(let i=tileCount;i<instanceCount;i++){
      const b=i*REGION_FLOATS,p=i*TILE_FLOATS;
      if(regionData[b]<=0||(regionData[b+3]<=0&&regionData[b+4]<=0))continue;
      const y=tileData[p+1]-authUniform[11],bottom=y+tileData[p+3];
      if(bottom<0||y>physicalHeight)continue;
      visibleSources.push(...tileData.subarray(p,p+12),...regionData.subarray(b,b+REGION_FLOATS));
    }
    const key=[audit.sceneBuilds,authUniform[11],...visibleSources].join(",");
    if(key===projectRegionCaptureKey)return;
    projectRegionCaptureKey=key;
    const pass=encoder.beginRenderPass({label:"Raw wallpaper + original project artwork (no glass)",
      colorAttachments:[{view:projectRegionScene.createView({baseMipLevel:0,mipLevelCount:1}),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]});
    pass.setPipeline(compositeBackdropPipeline);pass.setBindGroup(0,projectRegionCopyGroup);pass.draw(3);
    pass.setPipeline(projectRegionCapturePipeline);pass.setBindGroup(0,projectRegionCaptureGroup);
    pass.draw(6,AUTH_PANE_CAPACITY,0,tileCount);pass.end();
    for(let level=1;level<projectRegionScene.mipLevelCount;level++){
      const mip=encoder.beginComputePass({label:"Raw Clear region backdrop mip "+level});
      mip.setPipeline(mipPipeline);mip.setBindGroup(0,projectRegionMips[level-1]);
      mip.dispatchWorkgroups(Math.ceil(Math.max(1,projectRegionWidth>>level)/8),
        Math.ceil(Math.max(1,projectRegionHeight>>level)/8),1);mip.end();
    }
    projectRegionCaptureFrames++;
    audit.projectGlass.projectRegionBackdrop.frames=projectRegionCaptureFrames;
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
      const intro=glassEntrance(uniform[2],tileData[p+5]);
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
        (shrink.x*intro.scale).toFixed(5)+","+(shrink.y*intro.scale).toFixed(5)+")";
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
          (glyphAlpha*intro.alpha).toFixed(5));
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
      introSeconds:uniform[2],introComplete:uniform[2]>=.85,
      fadedTiles:fading
    };
  }
  function render(){
    if(mosaicLayoutDirty&&!mosaicCanDefer())rebuild();
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
    syncProjectScrollPresentation();
    syncAuthCanvasSize();
    writeUniform();
    syncBaseSources();
    if(scenePending)buildScene();
    const now=performance.now();
    const dt=Math.max(0,(now-lastFrameTime)/1000);
    const authDt=Math.max(0,(now-lastAuthFrameTime)/1000);
    lastFrameTime=now;
    lastAuthFrameTime=now;
    if(tileCount&&!mosaicLayoutDirty)paintTrack(dt);
    const authAnimating=paintAuthPanes();
    syncTileTints();
    syncMaterialProfiles();
    const artworkAnimating=syncGlassRegions();
    const iconAnimating=syncGlassIcons(authDt);
    syncRouteSources();
    if(artworkAnimating||iconAnimating)requestRender();
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
    renderProjectRegionCapture(encoder);
    // No CSS/DOM capture: directly re-render the CURRENT GPU square tiles
    // into a separate RGBA16F surface atop the original GPU photo. Build
    // its real mip levels in this same submission before the capsule draw.
    // GPU-owned mosaic icon optics are included in this completed lower layer.
    // The backdrop is dynamic ONLY while any black capsule is transitioning
    // toward/away from transparent green glass, avoiding idle GPU overhead.
    const homeCompositeActive=Boolean(audit.homeCtaGlass?.count)&&
      audit.homeCtaGlass.capsules.some(c=>c.opacity>.002&&c.tint>.002);
    if(homeCompositeActive)ensureCompositeScene(true);
    if(homeCompositeActive&&compositeScene&&homeCapsuleGroup){
      if(continuous){const u=new Float32Array(uniform);u[20]=compositeScene.width;u[21]=compositeScene.height;device.queue.writeBuffer(homeCompositeGlobalsBuffer,0,u);audit.homeCompositeLattice=[compositeScene.width,compositeScene.height];}
      const underlay=encoder.beginRenderPass({colorAttachments:[{
        view:compositeScene.createView({baseMipLevel:0,mipLevelCount:1}),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"
      }]});
      underlay.setPipeline(compositeBackdropPipeline);
      underlay.setBindGroup(0,compositeBackdropGroup);
      underlay.draw(3);
      if(tileCount&&!mosaicLayoutDirty){
        underlay.setPipeline(compositeGlassPipeline);
        underlay.setBindGroup(0,compositeGlassGroup);
        underlay.draw(6,tileCount);
      }
      underlay.end();
      for(let level=1;level<compositeScene.mipLevelCount;level++){
        const mip=encoder.beginComputePass({label:"live square underlay mip "+level});
        mip.setPipeline(mipPipeline);
        mip.setBindGroup(0,compositeMips[level-1]);
        mip.dispatchWorkgroups(Math.ceil(Math.max(1,compositeScene.width>>level)/8),
          Math.ceil(Math.max(1,compositeScene.height>>level)/8),1);
        mip.end();
      }
      homeCompositeFrames++;
      audit.homeCtaGlass.compositeFrames=homeCompositeFrames;
    }
    renderRouteDropdownBackdrop(encoder);
    const pass=encoder.beginRenderPass({
      colorAttachments:[{view:OFFSCREEN_CI?
          offscreenFrame.createView():context.getCurrentTexture().createView(),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]
    });
    pass.setPipeline(copyPipeline);pass.setBindGroup(0,copyGroup);
    pass.draw(3);
    if(tileCount&&!mosaicLayoutDirty){
      pass.setPipeline(glassPipeline);pass.setBindGroup(0,glassGroup);
      pass.draw(6,tileCount);
      // The three scaled capsules are separate instances of the same
      // shader on the HOMEPAGE canvas, under their real DOM text.
      if(audit.homeCtaGlass?.count){
        // Square refraction still reads the original scene; only the three
        // capsules sample the GPU frame including live moving squares.
        pass.setBindGroup(0,homeCompositeActive?homeCapsuleGroup:glassGroup);
        pass.draw(6,audit.homeCtaGlass.count,0,tileCount);
        if(audit.homeCtaGlass.brandGlyphGlass&&audit.homeCtaGlass.brandSlot>=0){
          // Same clock-text material and static scene source as the
          // Projects heading. No separate full-screen capture or mip pass.
          pass.setBindGroup(0,glassGroup);
          pass.draw(6,1,0,tileCount+audit.homeCtaGlass.brandSlot);
        }
      }
    }
    pass.end();
    // Draw only the route panes above the persistent homepage DOM. This is
    // the very same glassPipeline, bind group, per-pane tint and spring data
    // as the mosaic squares, not a second approximation or CSS overlay.
    if(authContext&&!routeOutlet?.hidden){
      const authPass=encoder.beginRenderPass({
        colorAttachments:[{view:authContext.getCurrentTexture().createView(),
          loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]
      });
      authPass.setPipeline(glassPipeline);authPass.setBindGroup(0,authGlassGroup);
      if(audit.projectGlass||dropdownSlots.some(Boolean)||routeSourceEntries.some(a=>a.length))drawRoutePanes(authPass);
      else authPass.draw(6,AUTH_PANE_CAPACITY,0,tileCount);
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
    return animating||authHoverAnimating||authAnimating||artworkAnimating||iconAnimating;
  }
  // Auth-only submission for the card's exit Motion and native scroll.
  // Every route pane shares the unchanged homepage WebGPU shader
  // and material. Scroll events submit this pass before their next RAF. 
  function renderAuthOnly(){
    if(!authContext||!instanceCount||stopped)return false;
    const now=performance.now();
    const dt=Math.max(0,(now-lastAuthFrameTime)/1000);
    lastAuthFrameTime=now;
    syncProjectScrollPresentation();
    syncAuthCanvasSize();
    writeUniform();
    syncBaseSources();
    if(scenePending)buildScene();
    const authAnimating=paintAuthPanes();
    syncTileTints();
    syncMaterialProfiles();
    const artworkAnimating=syncGlassRegions();
    const iconAnimating=syncGlassIcons(dt,false);
    syncRouteSources();
    const hoverAnimating=authHover.advance(dt,reducedMotion.matches);
    authHover.writeTo(tileData,tileCount);
    device.queue.writeBuffer(tileBuffer,0,tileData);
    const encoder=device.createCommandEncoder({label:"Public-route-only glass frame"});
    renderProjectRegionCapture(encoder);
    renderRouteDropdownBackdrop(encoder);
    const pass=encoder.beginRenderPass({
      colorAttachments:[{view:authContext.getCurrentTexture().createView(),
        loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]
    });
    pass.setPipeline(glassPipeline);pass.setBindGroup(0,authGlassGroup);
    if(audit.projectGlass||dropdownSlots.some(Boolean)||routeSourceEntries.some(a=>a.length))drawRoutePanes(pass);
    else pass.draw(6,AUTH_PANE_CAPACITY,0,tileCount);
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
    return authAnimating||hoverAnimating||artworkAnimating||iconAnimating;
  }
  function dispose(){
    tileBuffer?.destroy();tintTileBuffer?.destroy();materialBuffer?.destroy();regionBuffer?.destroy();artworkAtlas.dispose();iconBuffer?.destroy();referenceIconBuffer?.destroy();referenceCoverage?.dispose();referenceGlyphTexture?.destroy();silhouetteAtlas.dispose();continuous?.dispose();
    glyphMaskOwner?.removeAttribute("data-glass-text-ready");glyphMaskTexture.destroy();if(glyphAlphaTexture!==glyphMaskTexture)glyphAlphaTexture?.destroy();emptyDetail.destroy();detailGroups.clear();
    scene?.destroy();compositeScene?.destroy();projectRegionScene?.destroy();secondRouteScene?.destroy();sourcePainter.dispose();nativeOcclusion.clear();
    offscreenFrame?.destroy();photo.destroy();
    globalsBuffer.destroy();authGlobalsBuffer.destroy();routeCompositeGlobalsBuffer.destroy();if(continuous)homeCompositeGlobalsBuffer.destroy();routeCompositeDetailGroups.clear();
  }
  await iconsReady;
  await waitForVisibleHome();
  engine={rebuild,render,renderAuthOnly,flushResize,dispose,device};
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
  // Reveal only a completed backdrop/zero-progress frame, then start entry.
  introStart=performance.now();
  root.dataset.glassStartup=OFFSCREEN_CI?"fallback":"ready";
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
    const closePress=event.target?.closest?.(".project-showcase-expand-close")!=null;
    authHover.setPressed(true,{tapImpulse:homePress||closePress});
    if(homePress||closePress)pointerPressFramePending=true;
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
  // Coalesce window and ResizeObserver notifications into the existing RAF.
  // Update the explicit CSS size, physical backing, full mip pyramid and
  // geometry together in that pre-paint callback, never scale an old texture
  // to the new size or swap to CSS glass while dragging.
  // GPU completion is recorded for telemetry, never used as a color swap.
  // React mounts/unmounts and animates route panes independently.
  // Wake this same GPU frame loop without ever capturing DOM pixels.
  const authObserver=routeOutlet?new MutationObserver(()=>requestRender()):null;
  if(routeOutlet)authObserver.observe(routeOutlet,{
    childList:true,subtree:true,attributes:true,
    attributeFilter:["style","class","disabled","data-project-art-gpu-ready"]
  });
  // Native scroll can be composited ahead of requestAnimationFrame. Submit
  // the glass-only GPU pass immediately inside the real scroll event, using
  // the canvas's actual viewport rect, not a predictive scrollTop value.
  const onAuthScroll=()=>{
    if(authUsesCompositor()||stopped||!engine||!homeActive())return;
    // Width changes can clamp native scrollTop as the grid reflows. Do not
    // submit a second pane frame against the old viewport dimensions.
    if(audit.resizePending||Math.floor(innerWidth*(devicePixelRatio||1))!==physicalWidth){
      onSize();requestRender();return;
    }
    if(fixedProjectRoot()){
      // Commit foreground translation and matching fixed-wallpaper GPU
      // frame within the same main-thread rendering turn. No old sampled
      // wallpaper is carried by a compositor-scrollable canvas.
      if(raf){cancelAnimationFrame(raf);raf=0;}
      try{
        const animating=engine.renderAuthOnly();
        audit.projectScrollSynchronousFrames=(audit.projectScrollSynchronousFrames||0)+1;
        if(animating)requestRender();
      }catch(error){void fallback(error);}
      return;
    }
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
    if(authUsesCompositor()||fixedProjectRoot()||!["login","projects"].includes(window.__dofPublicRouter?.state))return;
    authScrollRefreshUntil=performance.now()+AUTH_ELASTIC_SETTLE_MS;
    requestRender();
  };
  routeOutlet?.addEventListener("scroll",onAuthScroll,{passive:true});
  routeOutlet?.addEventListener("wheel",armElasticRefresh,{passive:true});
  routeOutlet?.addEventListener("touchmove",armElasticRefresh,{passive:true});
  window.addEventListener("dofinances:glass-dropdown-change",requestRender);
  document.addEventListener("load",event=>{if(event.target?.localName==="img")requestRender();},true);
  document.fonts?.ready.then(()=>{sourcePainter.invalidate();requestRender();});
  const materialObserver=new MutationObserver(()=>requestRender());
  materialObserver.observe(document.documentElement,{subtree:true,attributes:true,
    attributeFilter:["data-glass-material"]});
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
    if(audit.resizePending){
      audit.coalescedResizeNotifications=(audit.coalescedResizeNotifications||0)+1;
      return;
    }
    if(layoutKey()===lastLayoutKey)return;
    audit.resizeEvents=(audit.resizeEvents||0)+1;
    audit.resizePending=true;
    requestRender();
  };
  function flushResize(){
    const nextKey=layoutKey();
    audit.resizePending=false;
    if(nextKey===lastLayoutKey)return null;
    lastLayoutKey=nextKey;
    const generation=++resizeGeneration;
    const start=performance.now();
    engine.rebuild({deferDismissedMosaic:true});
    const animating=engine.render();
    audit.resizeSubmissions=(audit.resizeSubmissions||0)+1;
    audit.resizeSubmittedFrame=audit.frameCount;
    audit.resizeCpuMs=performance.now()-start;
    device.queue.onSubmittedWorkDone().then(()=>{
      if(stopped||generation!==resizeGeneration)return;
      audit.resizeCompletions=(audit.resizeCompletions||0)+1;
    }).catch(fallback);
    return animating;
  }
  // The explicit invalidation contract for future moving squares/content:
  // reflowTiles rewrites only tile positions; invalidateBackdrop triggers
  // the scene+mip rebuild. Neither action reads rendered DOM pixels.
  window.__dashboardGpuControls=Object.freeze({
    reflowTiles:()=>{if(!stopped){engine.rebuild();requestRender()}},
    setMaterial:(element,material)=>{
      validateGlassMaterial(material);
      if(!(element instanceof Element))throw new TypeError("Glass surface element required");
      element.setAttribute("data-glass-material",material);requestRender();
    },
    invalidateBackdrop:()=>{if(!stopped){scenePending=true;requestRender()}},
    ...(new URLSearchParams(location.search).has("glass-source-proof")?{async sourceRegionDigest(kind,rect,mode="digest"){
      const texture=kind==="base"?scene:kind==="underlay"?(routeActiveLayers.length>1?secondRouteScene:compositeScene):null;
      if(!texture||!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite))throw TypeError("Owned source region required");
      const sampleDpr=kind==="base"?sourceDpr:texture.width/innerWidth;
      const x=Math.max(0,Math.floor(rect[0]*sampleDpr)),y=Math.max(0,Math.floor((rect[1]-sceneTop)*sampleDpr));
      const w=Math.min(128,texture.width-x,Math.max(1,Math.ceil(rect[2]*sampleDpr))),h=Math.min(128,texture.height-y,Math.max(1,Math.ceil(rect[3]*sampleDpr)));
      if(w<1||h<1)throw RangeError("Source region outside viewport");
      const stride=Math.ceil(w*8/256)*256,b=device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      try{const enc=device.createCommandEncoder({label:"Owned internal source numeric digest (not display)"});
        enc.copyTextureToBuffer({texture,origin:[x,y,0]},{buffer:b,bytesPerRow:stride,rowsPerImage:h},[w,h,1]);device.queue.submit([enc.finish()]);
        await b.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(b.getMappedRange());
        if(mode==="numeric"){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];for(let j=0;j<h;j++)for(let i=0;i<w*4;i++)out.push(v.getFloat16(j*stride+i*2,true));return {width:w,height:h,values:out};}
        if(mode!=="digest")throw TypeError("Invalid owned source result mode");
        const digest=await crypto.subtle.digest("SHA-256",bytes.slice());
        return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
      }finally{b.destroy();}
    }}:{})
  });
  window.addEventListener("resize",onSize,{passive:true});
  // Resolution changes (screen moves or browser zoom) can leave CSS layout
  // dimensions unchanged. Re-arm the exact-resolution media query on events.
  let resolutionQuery=null;
  const watchResolution=()=>{resolutionQuery?.removeEventListener("change",resolutionChanged);resolutionQuery=matchMedia("(resolution: "+(devicePixelRatio||1)+"dppx)");resolutionQuery.addEventListener("change",resolutionChanged);};
  const resolutionChanged=()=>{watchResolution();onSize();};
  watchResolution();
  const resizeObserver=new ResizeObserver(onSize);
  resizeObserver.observe(root);
  device.lost.then(reason=>{
    authObserver?.disconnect();authSizeObserver?.disconnect();materialObserver.disconnect();
    resizeObserver.disconnect();resolutionQuery?.removeEventListener("change",resolutionChanged);
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
