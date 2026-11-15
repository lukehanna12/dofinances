/*
 * Fixed Collections dock: live-backdrop, evidence-derived black clear glass.
 * Oracle scope: 25F80/M2/G14G AIR mode5, finite public Clear blur word.
 * No framebuffer sampling, screenshots, background assumptions or polling.
 * Browser Gaussian/mipmap conversion and native Q color chain remain open.
 * Black tint is independently user-selected CSS, not a native matrix claim.
 */
import {
 nativePublicBlurRadius,observedBlurWord,airTextureMipLOD,
 SVG_DISPLACEMENT_NEUTRAL_BIAS,generateOracleField
} from "./sidebar-glass-oracle.js";

const NS="http://www.w3.org/2000/svg";
const FILTER_ID="collections-oracle-live-glass";
const element=(doc,name,attributes={})=>{
 const node=doc.createElementNS(NS,name);
 for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
 return node;
};
function makeFilter(doc){
 const svg=element(doc,"svg",{"aria-hidden":"true",focusable:"false",class:"oracle-filter-defs cs-glass-filter-defs"});
 const defs=element(doc,"defs");
 const filter=element(doc,"filter",{id:FILTER_ID,x:"0%",y:"0%",width:"100%",height:"100%",
   filterUnits:"objectBoundingBox",primitiveUnits:"userSpaceOnUse","color-interpolation-filters":"sRGB"});
 const add=(tag,attrs)=>{const node=element(doc,tag,attrs);filter.append(node);return node;};
 const far=add("feGaussianBlur",{in:"SourceGraphic",stdDeviation:16,result:"far"});
 const near=add("feGaussianBlur",{in:"SourceGraphic",stdDeviation:8,result:"near"});
 const blurMap=add("feImage",{result:"blurMap",x:0,y:0,width:1,height:1,preserveAspectRatio:"none"});
 add("feColorMatrix",{in:"blurMap",type:"matrix",
   values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0",result:"ia"});
 add("feColorMatrix",{in:"blurMap",type:"matrix",
   values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0",result:"oa"});
 add("feComposite",{in:"near",in2:"ia",operator:"in",result:"inNear"});
 add("feComposite",{in:"far",in2:"ia",operator:"out",result:"inFar"});
 add("feComposite",{in:"inNear",in2:"inFar",operator:"arithmetic",k2:1,k3:1,result:"innerBlur"});
 add("feComposite",{in:"near",in2:"oa",operator:"in",result:"outNear"});
 add("feComposite",{in:"far",in2:"oa",operator:"out",result:"outFar"});
 add("feComposite",{in:"outNear",in2:"outFar",operator:"arithmetic",k2:1,k3:1,result:"outerBlur"});
 const inner=add("feImage",{result:"innerMap",x:0,y:0,width:1,height:1,preserveAspectRatio:"none"});
 const outer=add("feImage",{result:"outerMap",x:0,y:0,width:1,height:1,preserveAspectRatio:"none"});
 // PNG code 128 is offset from 0.5. This exactly restores neutral zero.
 const bias=SVG_DISPLACEMENT_NEUTRAL_BIAS;
 const centered="1 0 0 0 -"+bias+"  0 1 0 0 -"+bias+"  0 0 1 0 0  0 0 0 1 0";
 add("feColorMatrix",{in:"innerMap",type:"matrix",values:centered,result:"im"});
 add("feColorMatrix",{in:"outerMap",type:"matrix",values:centered,result:"om"});
 add("feDisplacementMap",{in:"innerBlur",in2:"im",scale:128,
   xChannelSelector:"R",yChannelSelector:"G",result:"innerShift"});
 add("feDisplacementMap",{in:"outerBlur",in2:"om",scale:128,
   xChannelSelector:"R",yChannelSelector:"G",result:"outerShift"});
 add("feColorMatrix",{in:"innerMap",type:"matrix",
   values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",result:"mix"});
 add("feComposite",{in:"outerShift",in2:"mix",operator:"in",result:"outPart"});
 add("feComposite",{in:"innerShift",in2:"mix",operator:"out",result:"inPart"});
 // Arithmetic sum, not Porter-Duff over: preserves the two-path weights.
 add("feComposite",{in:"outPart",in2:"inPart",operator:"arithmetic",
   k2:1,k3:1,result:"glass"});
 defs.append(filter);svg.append(defs);
 return {svg,far,near,maps:[inner,outer,blurMap]};
}
function encodePNG(doc,pixels,w,h){
 const canvas=doc.createElement("canvas");canvas.width=w;canvas.height=h;
 const context=canvas.getContext("2d");if(!context)return null;
 const frame=context.createImageData(w,h);frame.data.set(pixels);
 context.putImageData(frame,0,0);
 return canvas.toDataURL("image/png");
}
export function mountCollectionsGlass(root,doc=document,win=window){
 const panel=root?.querySelector(".cs-control-center");
 const view=root?.closest(".view");
 if(!panel||!view)return null;
 const reduced=()=>!!(win.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches||
   win.matchMedia?.("(forced-colors: active)")?.matches||
   win.matchMedia?.("(prefers-contrast: more)")?.matches);
 const ref='url("#'+FILTER_ID+'")';
 const supported=!!win.CSS?.supports?.("backdrop-filter",ref)||
   !!win.CSS?.supports?.("-webkit-backdrop-filter",ref);
 if(!supported||reduced())return {active:false,mode:"native-blur-fallback"};
 const {svg,far,near,maps}=makeFilter(doc);doc.body.append(svg);
 let worker=null,disposed=false,desired="",committed="",fallbackQueued=false;
 const cache=new Map(),MAX_ENTRIES=3;
 const live=()=>!disposed&&view.isConnected&&!view.hidden&&panel.isConnected;
 const apply=(key,w,h,urls)=>{
  if(!live()||key!==desired||!urls?.every(x=>typeof x==="string"&&x.startsWith("data:image/png")))return;
  // Commit all 3 exact-size maps and blur constants in the same task.
  const radius=nativePublicBlurRadius("clear",w,h);
  const word=observedBlurWord(radius,1,.5); // selected public Clear surface-scale finite case
  const farSigma=word/.5,nearSigma=farSigma*.5;
  far.setAttribute("stdDeviation",String(farSigma));
  near.setAttribute("stdDeviation",String(nearSigma));
  maps.forEach((node,i)=>{
   if(node.getAttribute("href")!==urls[i])node.setAttribute("href",urls[i]);
   if(node.getAttribute("width")!==String(w))node.setAttribute("width",String(w));
   if(node.getAttribute("height")!==String(h))node.setAttribute("height",String(h));
  });
  committed=key;
  panel.style.setProperty("--cs-oracle-blur",String(farSigma)+"px");
  panel.dataset.oracleNearLod=String(airTextureMipLOD(word,.5));
  panel.dataset.oracleFarLod=String(airTextureMipLOD(word,1));
  panel.classList.add("cs-oracle-ready");
 };
 const accept=data=>{
  if(disposed||!data||data.error||!data.key)return;
  const urls=data.urls||(
   data.inner&&data.outer&&data.blurMask?
     [data.inner,data.outer,data.blurMask].map(b=>encodePNG(doc,b,data.w,data.h)):null);
  if(!urls?.every(x=>typeof x==="string"&&x.startsWith("data:image/png")))return;
  cache.delete(data.key);cache.set(data.key,{w:data.w,h:data.h,urls});
  while(cache.size>MAX_ENTRIES)cache.delete(cache.keys().next().value);
  apply(data.key,data.w,data.h,urls);
 };
 try{
  worker=new win.Worker(new URL("./collections-glass-field-worker.js",import.meta.url),
   {type:"module",name:"collections-glass-geometry"});
  worker.addEventListener("message",event=>accept(event.data));
  worker.addEventListener("error",()=>{worker?.terminate();worker=null;});
 }catch{worker=null;}
 function requestField(){
  if(!live()||reduced())return;
  const rect=panel.getBoundingClientRect();
  const w=Math.round(rect.width),h=Math.round(rect.height);
  if(w<1||h<1||w*h>6000000)return;
  const radius=Math.min(w,h)*.5,key=w+"x"+h+"@"+radius;
  if(key===desired&&committed===key)return;
  if(key===desired&&worker)return;
  desired=key;panel.classList.remove("cs-oracle-ready");
  const cached=cache.get(key);
  if(cached){apply(key,cached.w,cached.h,cached.urls);return;}
  if(worker){
   try{worker.postMessage({key,w,h,radius});return;}catch{worker.terminate();worker=null;}
  }
  // No Worker: defer exact field generation until after initial paint.
  if(fallbackQueued)return;
  fallbackQueued=true;
  const build=()=>{
   fallbackQueued=false;if(!live())return;
   const b=panel.getBoundingClientRect();
   const width=Math.round(b.width),height=Math.round(b.height);
   if(width<1||height<1)return;
   const r=Math.min(width,height)*.5,k=width+"x"+height+"@"+r;
   const field=generateOracleField(width,height,r,undefined,"pill");
   accept({key:k,w:width,h:height,inner:field.inner,
     outer:field.outer,blurMask:field.blurMask});
  };
  if(win.requestIdleCallback)win.requestIdleCallback(build,{timeout:350});
  else win.setTimeout(build,0);
 }
 const ro=typeof win.ResizeObserver==="function"?
   new win.ResizeObserver(requestField):null;
 ro?.observe(panel);
 const mo=new win.MutationObserver(requestField);
 mo.observe(view,{attributes:true,attributeFilter:["hidden"]});
 requestField();
 return {
  get active(){return !disposed&&committed===desired&&panel.classList.contains("cs-oracle-ready");},
  get mode(){return worker?"worker":"idle-fallback";},
  refresh:requestField,
  dispose(){
   disposed=true;worker?.terminate();ro?.disconnect();mo.disconnect();
   panel.classList.remove("cs-oracle-ready");svg.remove();cache.clear();
  }
 };
}
