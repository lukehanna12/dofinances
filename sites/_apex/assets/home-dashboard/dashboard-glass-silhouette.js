/* Shared authored Clear glass silhouettes. Shape alpha only, no scene readback.
 * The Euclidean field is a browser adapter, not native Apple evidence. */
import {glassSpring} from "./dashboard-glass-model.js";
import {tintParameters} from "./dashboard-tint.js";
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";
export const GLASS_ICON_FLOATS=16;
export const MASK_SIZE=768,MASK_INNER=384,MASK_PAD=192;
// Allocate only the canonical project set initially; grow when necessary.
const INITIAL_MASKS=16,MAX_MASKS=32;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function registerGlassSilhouette(image,{tint="white",opacity=.3}={}){
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
function distanceTo(alpha,w,h,inside){
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
// Signed distances in mask texels, not normalized 8-bit steps. Partial
// coverage at the vector edge supplies a subpixel contour correction.
// Keep alpha and distance independent; never threshold final coverage.
export function silhouetteMask(alpha,w,h){
 if(alpha.length!==w*h||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)throw new RangeError("Invalid alpha mask");
 const inside=distanceTo(alpha,w,h,true),outside=distanceTo(alpha,w,h,false);
 const data=new Float32Array(w*h*2),depthHistogram=new Uint32Array(Math.ceil(Math.hypot(w,h))+1);
 let count=0;
 for(let i=0;i<alpha.length;i++){
  const a=alpha[i]/255;
  const signed=a>0&&a<1?.5-a:alpha[i]>=128?-(Math.sqrt(outside[i])-.5):Math.sqrt(inside[i])-.5;
  data[i*2]=a;data[i*2+1]=signed;
  if(signed<0){depthHistogram[Math.min(depthHistogram.length-1,Math.ceil(-signed))]++;count++;}
 }
 // 95th percentile of interior depth estimates the actual stroke width,
 // robust to isolated thick joins and the overall icon's empty interior.
 let total=0,depth=1;
 for(let i=0;i<depthHistogram.length;i++){total+=depthHistogram[i];if(total>=.95*count){depth=Math.max(1,i);break;}}
 return {data,strokeTexels:2*depth/.95};
}
// IEEE binary16 encoding for a filterable RG16Float texture. All alpha
// and near-contour values preserve far more precision than RG8Unorm.
// Explicit conversion works on browsers without Float16Array as well.
const halfScratch=new DataView(new ArrayBuffer(4));
export function floatToHalf(value){
 halfScratch.setFloat32(0,value,false);
 const bits=halfScratch.getUint32(0,false),sign=(bits>>>16)&0x8000;
 let e=((bits>>>23)&255)-127+15,frac=bits&0x7fffff;
 if(e<=0){
  if(e< -10)return sign;
  frac=(frac|0x800000) >>> (1-e);
  return sign|((frac+0xfff+((frac>>>13)&1))>>>13);
 }
 if(e>=31)return sign|0x7bff;
 frac+=0xfff+((frac>>>13)&1);
 if(frac&0x800000){frac=0;e++;}
 return sign|(Math.min(e,30)<<10)|(frac>>>13);
}
export function packSilhouetteMask(data){
 const out=new Uint16Array(data.length);
 for(let i=0;i<data.length;i++)out[i]=floatToHalf(data[i]);
 return out;
}
// Reference for the authored shader contrast profile, not native evidence.
export function silhouetteHazeStrength(luminance,distanceCSS,hover=1){
 const t=clamp((luminance-.25)/.65),brightness=t*t*(3-2*t);
 const x=Math.max(0,distanceCSS-1.6)/5.4,tail=clamp((distanceCSS-16)/6);
 return .16*clamp(hover)*brightness*Math.exp(-.5*x*x)*(1-tail*tail*(3-2*tail));
}
export function createGlassSilhouetteAtlas(device){
 const placeholder=device.createTexture({size:[1,1,1],format:"rg16float",usage:GPUTextureUsage.TEXTURE_BINDING});
 let texture=null,capacity=0,view=placeholder.createView({dimension:"2d-array"});
 const slots=new Map(),springs=new WeakMap(),owned=new Set();
 let uploads=0;
 function ensure(){
  if(texture&&slots.size<capacity)return;
  const previous=texture,oldCapacity=capacity;
  capacity=previous?Math.min(MAX_MASKS,capacity*2):INITIAL_MASKS;
  texture=device.createTexture({label:"High precision authored alpha and signed distance silhouettes",size:[MASK_SIZE,MASK_SIZE,capacity],format:"rg16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC});
  if(previous){
   const encoder=device.createCommandEncoder({label:"Grow silhouette atlas"});
   encoder.copyTextureToTexture({texture:previous},{texture},[MASK_SIZE,MASK_SIZE,oldCapacity]);
   device.queue.submit([encoder.finish()]);
   previous.destroy();
  }
  view=texture.createView({dimension:"2d-array"});
 }
 function layerFor(img){
  if(!img.complete||!img.naturalWidth)return null;
  const src=img.currentSrc||img.src;
  if(slots.has(src))return slots.get(src);
  if(slots.size>=MAX_MASKS)return null;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=MASK_SIZE;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return null;
  try{
   const fit=MASK_INNER/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*fit,h=img.naturalHeight*fit;
   ctx.drawImage(img,(MASK_SIZE-w)/2,(MASK_SIZE-h)/2,w,h);
   const rgba=ctx.getImageData(0,0,MASK_SIZE,MASK_SIZE).data;
   const alpha=new Uint8Array(MASK_SIZE*MASK_SIZE);
   for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
   if(!alpha.some(v=>v>=128))return null;
   const {data,strokeTexels}=silhouetteMask(alpha,MASK_SIZE,MASK_SIZE);
   const mask=packSilhouetteMask(data);
   ensure();const layer=slots.size;
   device.queue.writeTexture({texture,origin:[0,0,layer]},mask,{bytesPerRow:MASK_SIZE*4,rowsPerImage:MASK_SIZE},[MASK_SIZE,MASK_SIZE,1]);
   const entry={layer,strokeTexels};slots.set(src,entry);uploads++;return entry;
  }catch(error){console.warn("Authored glass silhouette:",String(error));return null;}
  finally{canvas.width=canvas.height=0;}
 }
 function begin(){for(const img of owned)if(!img.isConnected)owned.delete(img);}
 function sync(owner,img,{width,height,dpr,scheme,hover=false,suppressHover=false,dt=0,reduced=false,opacity=1}){
  const rect=owner.getBoundingClientRect(),r=img.getBoundingClientRect();
  if(!rect.width||!rect.height||!r.width||!r.height||!(width>0&&height>0)){img.removeAttribute("data-glass-icon-owned");return null;}
  const entry=layerFor(img);
  if(entry===null){img.removeAttribute("data-glass-icon-owned");return null;}
  const sx=width/rect.width,sy=height/rect.height;
  const bounds=[(r.left-rect.left)*sx,(r.top-rect.top)*sy,r.width*sx,r.height*sy];
  const material=tintParameters(img.dataset.glassSilhouetteTint||"white",Number(img.dataset.glassSilhouetteOpacity??.3),scheme);
  const target=hover&&!suppressHover?1:0,old=springs.get(owner)||[0,0];
  const next=suppressHover||reduced?[target,0]:glassSpring(old[0],old[1],target,dt,target?26:18);
  if(Math.abs(next[0]-target)<.001&&Math.abs(next[1])<.01){next[0]=target;next[1]=0;}
  springs.set(owner,next);
  const stroke=Math.min(bounds[2],bounds[3])*entry.strokeTexels/MASK_INNER;
  const word=observedBlurWord(nativePublicBlurRadius("clear",stroke/dpr,stroke/dpr),1,.25);
  if(!img.hasAttribute("data-glass-icon-owned"))img.dataset.glassIconOwned="";
  owned.add(img);
  return {lanes:[...bounds,entry.layer+1,clamp(next[0]),word,clamp(opacity),...material.rgb,material.opacity,stroke,0,0,0],
   animating:next[0]!==target||next[1]!==0,bounds,strokeCSS:stroke/dpr,hover:clamp(next[0]),tint:material.name,tintOpacity:material.opacity};
 }
 return {get view(){return view;},begin,sync,stats(){return {uploads,layers:slots.size,capacity,maskSize:MASK_SIZE,maskContent:MASK_INNER,format:"rg16float"};},
  dispose(){for(const img of owned)img.removeAttribute("data-glass-icon-owned");owned.clear();texture?.destroy();placeholder.destroy();slots.clear();}};
}
