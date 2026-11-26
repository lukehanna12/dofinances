/* Shared authored Clear glass silhouettes. Shape alpha only, no scene readback.
 * The Euclidean field is a browser adapter, not native Apple evidence. */
import {glassSpring} from "./dashboard-glass-model.js";
import {tintParameters} from "./dashboard-tint.js";
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";
import {createVectorCoverageAtlas} from "./dashboard-glass-vector-coverage.js";
export const GLASS_ICON_FLOATS=20;
// Double the vector raster resolution, NOT the optical quantization.
 // 128 high-resolution distance texels equal the old 64 in icon space.
export const MASK_SIZE=544,MASK_INNER=512,MASK_PAD=16,MASK_RANGE=128;
// Half-width support permits cropping unused padding, without changing
// original SVG raster resolution or any stored distance quantization.
export const HAZE_SIZE=384,HAZE_INNER=256,HAZE_PAD=64,HAZE_RANGE=128;
const INITIAL_MASKS=16,MAX_MASKS=32;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function registerGlassSilhouette(image,{tint="white",opacity=.2}={}){
 const material=tintParameters(tint,opacity);
 image.dataset.glassSilhouetteSource="";
 image.dataset.glassSilhouetteTint=material.name;
 image.dataset.glassSilhouetteOpacity=String(opacity);
 return image;
}
// Exact separable squared Euclidean distance transform; retain original alpha.
function distanceLine(f,n,out,v,z){
 let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
 for(let q=1;q<n;q++){
  let s;
  do{
   const p=v[k];s=((f[q]+q*q)-(f[p]+p*p))/(2*(q-p));
   if(s>z[k]||k===0)break;
   k--;
  }while(true);
  k++;v[k]=q;z[k]=s;z[k+1]=Infinity;
 }
 k=0;
 for(let q=0;q<n;q++){while(z[k+1]<q)k++;const p=v[k];out[q]=(q-p)**2+f[p];}
}
export function distanceTo(alpha,w,h,inside){
 const work=new Float32Array(w*h),out=new Float32Array(w*h);
 const n=Math.max(w,h),f=new Float64Array(n),line=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++)f[x]=(alpha[y*w+x]>=128)===inside?0:1e9;
  distanceLine(f,w,line,v,z);
  for(let x=0;x<w;x++)work[y*w+x]=line[x];
 }
 for(let x=0;x<w;x++){
  for(let y=0;y<h;y++)f[y]=work[y*w+x];
  distanceLine(f,h,line,v,z);
  for(let y=0;y<h;y++)out[y*w+x]=line[y];
 }
 return out;
}
function encodedDistance(alpha,w,h,range,withCoverage){
 if(alpha.length!==w*h||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!(range>0))throw new RangeError("Invalid alpha mask");
 const inside=distanceTo(alpha,w,h,true),outside=distanceTo(alpha,w,h,false);
 const channels=withCoverage?2:1,data=new Uint8Array(w*h*channels);
 for(let i=0;i<alpha.length;i++){
  const signed=alpha[i]>=128?-(Math.sqrt(outside[i])-.5):Math.sqrt(inside[i])-.5;
  const encoded=Math.round(clamp(.5+signed/(2*range))*255);
  if(withCoverage){data[2*i]=alpha[i];data[2*i+1]=encoded;}
  else data[i]=encoded;
 }
 return data;
}
export function silhouetteMask(alpha,w,h,range=MASK_RANGE){
 return encodedDistance(alpha,w,h,range,true);
}
// Preserve the exact old low-resolution haze channel, including its
// original SVG content raster dimensions, threshold and distance encoding.
// Only the unused outer padding has been cropped.
export function silhouetteHazeMask(alpha,w,h){
 return encodedDistance(alpha,w,h,HAZE_RANGE,false);
}
export function silhouetteAtlasBytes(capacity=INITIAL_MASKS){
 return capacity*(MASK_SIZE*MASK_SIZE*2+HAZE_SIZE*HAZE_SIZE);
}
// Reference for the authored shader contrast profile, not native evidence.
export function silhouetteHazeStrength(luminance,distanceCSS,hover=1){
 const t=clamp((luminance-.25)/.65),brightness=t*t*(3-2*t);
 const x=Math.max(0,distanceCSS-.8/6)/5.4,tail=clamp((distanceCSS-5/6)/6);
 return .16*clamp(hover)*brightness*Math.exp(-.5*x*x)*(1-tail*tail*(3-2*tail));
}
export function createGlassSilhouetteAtlas(device,wake=()=>{},options={}){
 const vectorOnly=options.vectorOnly===true;
 const coverageAtlas=createVectorCoverageAtlas(device,wake);
 const usage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC;
 const placeholder=device.createTexture({size:[1,1,1],format:"rg8unorm",usage:GPUTextureUsage.TEXTURE_BINDING});
 const hazePlaceholder=device.createTexture({size:[1,1,1],format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING});
 let texture=null,hazeTexture=null,capacity=0;
 let view=placeholder.createView({dimension:"2d-array"}),hazeView=hazePlaceholder.createView({dimension:"2d-array"});
 const slots=new Map(),springs=new WeakMap(),owned=new Set();
 let uploads=0;
 function ensure(){
  if(hazeTexture&&slots.size<capacity)return;
  const previous=texture,previousHaze=hazeTexture,oldCapacity=capacity;
  capacity=previousHaze?Math.min(MAX_MASKS,capacity*2):INITIAL_MASKS;
  if(!vectorOnly)texture=device.createTexture({label:"512px authored silhouette alpha and optical distance (8-bit each)",size:[MASK_SIZE,MASK_SIZE,capacity],format:"rg8unorm",usage});
  hazeTexture=device.createTexture({label:"Original resolution authored haze distance (8-bit)",size:[HAZE_SIZE,HAZE_SIZE,capacity],format:"r8unorm",usage});
  if(previousHaze){
   const encoder=device.createCommandEncoder({label:"Grow split silhouette atlases"});
   if(previous)encoder.copyTextureToTexture({texture:previous},{texture},[MASK_SIZE,MASK_SIZE,oldCapacity]);
   encoder.copyTextureToTexture({texture:previousHaze},{texture:hazeTexture},[HAZE_SIZE,HAZE_SIZE,oldCapacity]);
   device.queue.submit([encoder.finish()]);
   previous?.destroy();previousHaze.destroy();
  }
  if(texture)view=texture.createView({dimension:"2d-array"});
  hazeView=hazeTexture.createView({dimension:"2d-array"});
 }
 function rasterAlpha(img,size,inner){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=size;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return null;
  try{
   const fit=inner/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*fit,h=img.naturalHeight*fit;
   ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
   const rgba=ctx.getImageData(0,0,size,size).data;
   const alpha=new Uint8Array(size*size);
   for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
   return alpha;
  }finally{canvas.width=canvas.height=0;}
 }
 function layerFor(img){
  if(!img.complete||!img.naturalWidth)return null;
  const src=img.currentSrc||img.src;
  if(slots.has(src))return slots.get(src);
  if(slots.size>=MAX_MASKS)return null;
  try{
   const alpha=vectorOnly?null:rasterAlpha(img,MASK_SIZE,MASK_INNER);
   const hazeAlpha=rasterAlpha(img,HAZE_SIZE,HAZE_INNER);
   if(!hazeAlpha||(!vectorOnly&&(!alpha||!alpha.some(v=>v>=128))))return null;
   const mask=vectorOnly?null:silhouetteMask(alpha,MASK_SIZE,MASK_SIZE);
   const hazeMask=silhouetteHazeMask(hazeAlpha,HAZE_SIZE,HAZE_SIZE);
   ensure();const layer=slots.size;
   if(mask)device.queue.writeTexture({texture,origin:[0,0,layer]},mask,{bytesPerRow:MASK_SIZE*2,rowsPerImage:MASK_SIZE},[MASK_SIZE,MASK_SIZE,1]);
   device.queue.writeTexture({texture:hazeTexture,origin:[0,0,layer]},hazeMask,{bytesPerRow:HAZE_SIZE,rowsPerImage:HAZE_SIZE},[HAZE_SIZE,HAZE_SIZE,1]);
   slots.set(src,layer);uploads++;return layer;
  }catch(error){console.warn("Authored glass silhouette:",String(error));return null;}
 }
 function begin(){for(const img of owned)if(!img.isConnected)owned.delete(img);}
 function sync(owner,img,{width,height,dpr,scheme,hover=false,suppressHover=false,dt=0,reduced=false,opacity=1,slot=-1,ownerRect=null,dismiss=0}){
  const rect=owner.getBoundingClientRect(),r=img.getBoundingClientRect();
  if(!rect.width||!rect.height||!r.width||!r.height||!(width>0&&height>0)){img.removeAttribute("data-glass-icon-owned");return null;}
  if(vectorOnly&&!options.hasVector?.(img)){img.removeAttribute("data-glass-icon-owned");return null;}
  const layer=layerFor(img);
  if(layer===null){img.removeAttribute("data-glass-icon-owned");return null;}
  const sx=width/rect.width,sy=height/rect.height;
  const bounds=[(r.left-rect.left)*sx,(r.top-rect.top)*sy,r.width*sx,r.height*sy];
  const material=tintParameters(img.dataset.glassSilhouetteTint||"white",Number(img.dataset.glassSilhouetteOpacity??.2),scheme);
  const target=hover&&!suppressHover?1:0,old=springs.get(owner)||[0,0];
  const next=suppressHover||reduced?[target,0]:glassSpring(old[0],old[1],target,dt,target?26:18);
  if(Math.abs(next[0]-target)<.001&&Math.abs(next[1])<.01){next[0]=target;next[1]=0;}
  springs.set(owner,next);
  const coverage=ownerRect?coverageAtlas.sync(img,slot,bounds,ownerRect,dismiss):null;
  if(vectorOnly&&!coverage){img.removeAttribute("data-glass-icon-owned");return null;}
  const word=observedBlurWord(nativePublicBlurRadius("clear",bounds[2]/dpr,bounds[3]/dpr),1,.25);
  if(!img.hasAttribute("data-glass-icon-owned"))img.dataset.glassIconOwned="";
  owned.add(img);
  return {lanes:[...bounds,layer+1,clamp(next[0]),word,clamp(opacity),...material.rgb,material.opacity,...(coverage?.rect||[0,0,0,0]),...(coverage?.meta||[0,0,0,0])],
   animating:next[0]!==target||next[1]!==0,bounds,vectorCoverage:Boolean(coverage),hover:clamp(next[0]),tint:material.name,tintOpacity:material.opacity};
 }
 return {get view(){return view;},get hazeView(){return hazeView;},get coverageView(){return coverageAtlas.view;},begin,sync,
  stats(){return {uploads,layers:slots.size,capacity,maskContent:vectorOnly?0:MASK_INNER,maskSize:vectorOnly?0:MASK_SIZE,format:vectorOnly?null:"rg8unorm",
   hazeContent:HAZE_INNER,hazeSize:HAZE_SIZE,hazeFormat:"r8unorm",atlasBytes:vectorOnly?capacity*HAZE_SIZE*HAZE_SIZE:silhouetteAtlasBytes(capacity),...coverageAtlas.stats()};},
  dispose(){coverageAtlas.dispose();for(const img of owned)img.removeAttribute("data-glass-icon-owned");owned.clear();texture?.destroy();hazeTexture?.destroy();placeholder.destroy();hazePlaceholder.destroy();slots.clear();}};
}
