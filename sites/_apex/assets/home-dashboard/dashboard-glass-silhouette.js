/* Shared authored Clear glass silhouettes. Shape alpha only, no scene readback.
 * The Euclidean field is a browser adapter, not native Apple evidence. */
import {glassSpring} from "./dashboard-glass-model.js";
import {tintParameters} from "./dashboard-tint.js";
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";
export const GLASS_ICON_FLOATS=12;
export const MASK_SIZE=512,MASK_INNER=256,MASK_PAD=128,MASK_RANGE=64,HAZE_RANGE=128;
const MAX_MASKS=32;
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
export function silhouetteMask(alpha,w,h,range=MASK_RANGE){
 if(alpha.length!==w*h||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!(range>0))throw new RangeError("Invalid alpha mask");
 const inside=distanceTo(alpha,w,h,true),outside=distanceTo(alpha,w,h,false);
 const data=new Uint8Array(w*h*4);
 for(let i=0;i<alpha.length;i++){
  const signed=alpha[i]>=128?-(Math.sqrt(outside[i])-.5):Math.sqrt(inside[i])-.5;
  data[i*4]=alpha[i];data[i*4+1]=Math.round(clamp(.5+signed/(2*range))*255);
  data[i*4+2]=Math.round(clamp(.5+signed/(2*HAZE_RANGE))*255);data[i*4+3]=255;
 }
 return data;
}
// Reference for the authored shader contrast profile, not native evidence.
export function silhouetteHazeStrength(luminance,distanceCSS,hover=1){
 const t=clamp((luminance-.25)/.65),brightness=t*t*(3-2*t);
 const x=Math.max(0,distanceCSS-1.6)/5.4,tail=clamp((distanceCSS-16)/6);
 return .16*clamp(hover)*brightness*Math.exp(-.5*x*x)*(1-tail*tail*(3-2*tail));
}
export function createGlassSilhouetteAtlas(device){
 const placeholder=device.createTexture({size:[1,1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING});
 let texture=null,view=placeholder.createView({dimension:"2d-array"});
 const slots=new Map(),springs=new WeakMap(),owned=new Set();
 let uploads=0;
 function ensure(){
  if(texture)return;
  texture=device.createTexture({label:"Authored alpha and signed distance silhouettes",size:[MASK_SIZE,MASK_SIZE,MAX_MASKS],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
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
   const mask=silhouetteMask(alpha,MASK_SIZE,MASK_SIZE);
   ensure();const layer=slots.size;
   device.queue.writeTexture({texture,origin:[0,0,layer]},mask,{bytesPerRow:MASK_SIZE*4,rowsPerImage:MASK_SIZE},[MASK_SIZE,MASK_SIZE,1]);
   slots.set(src,layer);uploads++;return layer;
  }catch(error){console.warn("Authored glass silhouette:",String(error));return null;}
  finally{canvas.width=canvas.height=0;}
 }
 function begin(){for(const img of owned)if(!img.isConnected)owned.delete(img);}
 function sync(owner,img,{width,height,dpr,scheme,hover=false,suppressHover=false,dt=0,reduced=false,opacity=1}){
  const rect=owner.getBoundingClientRect(),r=img.getBoundingClientRect();
  if(!rect.width||!rect.height||!r.width||!r.height||!(width>0&&height>0)){img.removeAttribute("data-glass-icon-owned");return null;}
  const layer=layerFor(img);
  if(layer===null){img.removeAttribute("data-glass-icon-owned");return null;}
  const sx=width/rect.width,sy=height/rect.height;
  const bounds=[(r.left-rect.left)*sx,(r.top-rect.top)*sy,r.width*sx,r.height*sy];
  const material=tintParameters(img.dataset.glassSilhouetteTint||"white",Number(img.dataset.glassSilhouetteOpacity??.2),scheme);
  const target=hover&&!suppressHover?1:0,old=springs.get(owner)||[0,0];
  const next=suppressHover||reduced?[target,0]:glassSpring(old[0],old[1],target,dt,target?26:18);
  if(Math.abs(next[0]-target)<.001&&Math.abs(next[1])<.01){next[0]=target;next[1]=0;}
  springs.set(owner,next);
  const word=observedBlurWord(nativePublicBlurRadius("clear",bounds[2]/dpr,bounds[3]/dpr),1,.25);
  if(!img.hasAttribute("data-glass-icon-owned"))img.dataset.glassIconOwned="";
  owned.add(img);
  return {lanes:[...bounds,layer+1,clamp(next[0]),word,clamp(opacity),...material.rgb,material.opacity],
   animating:next[0]!==target||next[1]!==0,bounds,hover:clamp(next[0]),tint:material.name,tintOpacity:material.opacity};
 }
 return {get view(){return view;},begin,sync,stats(){return {uploads,layers:slots.size};},
  dispose(){for(const img of owned)img.removeAttribute("data-glass-icon-owned");owned.clear();texture?.destroy();placeholder.destroy();slots.clear();}};
}
