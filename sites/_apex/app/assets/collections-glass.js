/*
 * Collections: actual live-backdrop SVG optical filter, with FINITE public
 * SwiftUI Glass.clear evidence, not the old private diagnostic material.
 * Oracle: lukehanna12/liquid-plexiglass-oracle @58a83a8f68392f8004981c9b42ab308b3874f543
 * See collections-glass-public-clear.js for source measurements and limits.
 *
 * Chrome supports SVG displacement in backdrop-filter; WebKit and Firefox
 * currently cannot reliably render it (CSS.supports may still return true).
 * Those engines receive native CSS blur, never a broken/empty SVG fallback.
 * No screenshots, background clones, polling, or synthetic wallpaper.
 */
import {
 projectPublicClearInputs,generatePublicClearPillField
} from "./collections-glass-public-clear.js";
import {SVG_DISPLACEMENT_NEUTRAL_BIAS} from "./sidebar-glass-oracle.js";

const SVG="http://www.w3.org/2000/svg";
const FILTER_ID="collections-oracle-live-glass";
const make=(doc,name,attrs={})=>{
 const node=doc.createElementNS(SVG,name);
 for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
 return node;
};
function createGlassFilter(doc){
 const svg=make(doc,"svg",{"aria-hidden":"true",focusable:"false",
  class:"oracle-filter-defs cs-glass-filter-defs"});
 const defs=make(doc,"defs");
 const filter=make(doc,"filter",{
  id:FILTER_ID, x:"-40%",y:"-130%",width:"180%",height:"360%",
  filterUnits:"objectBoundingBox",primitiveUnits:"userSpaceOnUse",
  "color-interpolation-filters":"sRGB"
 });
 const blur=make(doc,"feGaussianBlur",{
  in:"SourceGraphic",stdDeviation:"12",result:"liveBackdropBlur"});
 const field=make(doc,"feImage",{
  x:0,y:0,width:1,height:1,
  preserveAspectRatio:"none",result:"clearRefractionField"});
 // One byte-encoded field. A code of 128 must correspond to ZERO signed
 // offset; the 8-bit 0.5 midpoint bias is corrected without resampling.
 const bias=SVG_DISPLACEMENT_NEUTRAL_BIAS;
 const centered=make(doc,"feColorMatrix",{
  in:"clearRefractionField",type:"matrix",result:"signedRefraction",
  values:"1 0 0 0 -"+bias+"  0 1 0 0 -"+bias+
   "  0 0 1 0 0  0 0 0 1 0"
 });
 const displace=make(doc,"feDisplacementMap",{
  in:"liveBackdropBlur",in2:"signedRefraction",scale:128,
  xChannelSelector:"R",yChannelSelector:"G",result:"publicClearOptics"
 });
 filter.append(blur,field,centered,displace);
 defs.append(filter);svg.append(defs);
 return {svg,blur,field};
}
const pngURL=(doc,rgba,w,h)=>{
 const canvas=doc.createElement("canvas");
 canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext("2d");if(!ctx)return null;
 const img=ctx.createImageData(w,h);
 img.data.set(rgba);ctx.putImageData(img,0,0);
 return canvas.toDataURL("image/png"); // lossless 8-bit RGBA
};
const hasUsableSVGBackdrop=win=>{
 const ua=String(win.navigator?.userAgent||"");
 // Known SVG backdrop-filter limitations:
 // https://bugs.webkit.org/show_bug.cgi?id=245510
 // https://github.com/mdn/browser-compat-data/issues/24110
 if(/Firefox\/|iPhone|iPad|iPod/.test(ua)||/Safari\//.test(ua)&&!/Chrome\/|Chromium\/|Edg\//.test(ua))
  return false;
 const ref='url("#'+FILTER_ID+'")';
 return !!win.CSS?.supports?.("backdrop-filter",ref)||
  !!win.CSS?.supports?.("-webkit-backdrop-filter",ref);
};

export function mountCollectionsGlass(root,doc=document,win=window){
 const panel=root?.querySelector(".cs-control-center");
 const view=root?.closest(".view");
 if(!panel||!view)return null;
 const reduced=()=>!!(win.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches||
  win.matchMedia?.("(forced-colors: active)")?.matches||
  win.matchMedia?.("(prefers-contrast: more)")?.matches);
 if(reduced()||!hasUsableSVGBackdrop(win)){
  return {active:false,mode:"native-blur-fallback"};
 }
 const {svg,blur,field}=createGlassFilter(doc);
 doc.body.append(svg);
 const cache=new Map();
 let worker=null,disposed=false,desired="",committed="",fallbackQueued=false;
 let pending=null;
 const alive=()=>!disposed&&panel.isConnected&&view.isConnected&&!view.hidden;
 const apply=(key,w,h,mapWidth,mapHeight,overscan,url)=>{
  if(!alive()||key!==desired||typeof url!=="string"||!url.startsWith("data:image/png"))
   return;
  const inputs=projectPublicClearInputs(w,h);
  blur.setAttribute("stdDeviation",String(inputs.browserGaussianSigma));
  if(field.getAttribute("href")!==url)field.setAttribute("href",url);
  if(field.getAttribute("width")!==String(mapWidth))field.setAttribute("width",String(mapWidth));
  if(field.getAttribute("height")!==String(mapHeight))field.setAttribute("height",String(mapHeight));
  // The same lossless RGBA PNG is the distortion texture AND the CSS
  // alpha mask of the real, overscanned glass silhouette. No assumed
  // background images or extra geometry textures are necessary.
  panel.style.setProperty("--cs-optical-mask",`url("${url}")`);
  panel.style.setProperty("--cs-optical-overscan",overscan+"px");
  panel.style.setProperty("--cs-optical-width",mapWidth+"px");
  panel.style.setProperty("--cs-optical-height",mapHeight+"px");
  // Preserve every RGBA pixel of the emitted map across repaints. Only
  // the browser compositor resamples the REAL backdrop during scroll.
  committed=key;
  panel.style.setProperty("--cs-oracle-blur",inputs.browserGaussianSigma+"px");
  panel.classList.add("cs-oracle-ready");
 };
 const accept=response=>{
  if(disposed||!response?.key)return;
  if(response.error){fail();return;}
  const {key,w,h,mapWidth,mapHeight,overscan}=response;
  const url=response.png||(
   response.pixels?pngURL(doc,response.pixels,mapWidth,mapHeight):null);
  if(!url?.startsWith("data:image/png"))return;
  cache.delete(key);cache.set(key,{w,h,mapWidth,mapHeight,overscan,url});
  while(cache.size>2)cache.delete(cache.keys().next().value);
  apply(key,w,h,mapWidth,mapHeight,overscan,url);
 };
 const fail=()=>{
  try{worker?.terminate();}catch{}
  worker=null;
  if(!disposed&&alive())requestField();
 };
 try{
  worker=new win.Worker(new URL("./collections-glass-field-worker.js",import.meta.url),
   {type:"module",name:"collections-public-clear-field"});
  worker.addEventListener("message",event=>accept(event.data));
  worker.addEventListener("error",fail);
 }catch{worker=null;}
 function requestField(){
  if(!alive()||reduced())return;
  const bounds=panel.getBoundingClientRect();
  const w=Math.round(bounds.width),h=Math.round(bounds.height);
  if(w<1||h<1||w*h>6000000)return;
  const radius=Math.min(w,h)/2,key=w+"x"+h+"@"+radius;
  if(key===committed&&key===desired)return;
  if(key===desired&&worker)return;
  desired=key;
  panel.classList.remove("cs-oracle-ready");
  const cached=cache.get(key);
  if(cached){apply(key,cached.w,cached.h,cached.mapWidth,cached.mapHeight,
    cached.overscan,cached.url);return;}
  if(worker){
   try{worker.postMessage({key,w,h,radius});return;}
   catch{try{worker.terminate();}catch{}worker=null;}
  }
  // No Worker: schedule the same exact field work only after first paint.
  if(fallbackQueued)return;
  fallbackQueued=true;
  const build=()=>{
   fallbackQueued=false;if(!alive())return;
   const rect=panel.getBoundingClientRect();
   const width=Math.round(rect.width),height=Math.round(rect.height);
   if(width<1||height<1)return;
   const r=Math.min(width,height)/2;
   const computed=generatePublicClearPillField(width,height,r);
   accept({key:width+"x"+height+"@"+r,w:width,h:height,
    mapWidth:computed.width,mapHeight:computed.height,overscan:computed.overscan,
    pixels:computed.pixels});
  };
  if(win.requestIdleCallback)win.requestIdleCallback(build,{timeout:350});
  else win.setTimeout(build,0);
 }
 // Read the outline/optical size only when real layout changes. A fixed
 // positioned pane has ZERO JavaScript work during ordinary page scrolling.
 const ro=typeof win.ResizeObserver==="function"?
  new win.ResizeObserver(requestField):null;
 ro?.observe(panel);
 const mo=new win.MutationObserver(requestField);
 mo.observe(view,{attributes:true,attributeFilter:["hidden"]});
 requestField();
 return {
  get active(){return !disposed&&committed===desired&&panel.classList.contains("cs-oracle-ready");},
  get mode(){return worker?"public-clear-worker":"public-clear-idle-fallback";},
  refresh:requestField,
  dispose(){
   disposed=true;try{worker?.terminate();}catch{}
   ro?.disconnect();mo.disconnect();
   panel.classList.remove("cs-oracle-ready");svg.remove();cache.clear();
  }
 };
}
