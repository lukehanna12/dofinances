// Explicit fixed-source mip lattice; continuous reconstruction and native
// numerical sampling are separate consumers. BGRA8 codes are not linear light.
import {ContinuousScene} from "./sampling.mjs";
import {nativeFixedMipChain} from "./native-diamond.mjs";
import {sampleBGRA8Mip} from "./bgra8-sampler.mjs";
export function fixedMipScenes(src,w,h,{origin=[0,0],step=[1,1],...abi}){
 if(!Array.isArray(origin)||origin.length!==2||!origin.every(Number.isFinite)||!Array.isArray(step)||step.length!==2||!step.every(x=>Number.isFinite(x)&&x>0))throw new RangeError("Invalid source coordinate map");
 const unorm=abi.unorm??true;
 return nativeFixedMipChain(src,w,h,abi).map(level=>{
  const normalized=Float64Array.from(level.values,(x,i)=>unorm?level.values[(i&~3)+[2,1,0,3][i&3]]/255:x);
  return {level,encoding:unorm?"bgra8-unorm-normalized-rgba":"rgba16float",scene:new ContinuousScene(level.width,level.height,normalized,{origin:origin.map((v,i)=>v+step[i]*level.sourceOrigin[i]),step:step.map((v,i)=>v*(level.sourcePitchXY??[level.sourcePitch,level.sourcePitch])[i])})};
 });
}
export function fixedMipField(entries){
 if(!entries.length||entries.some(e=>!(e.scene instanceof ContinuousScene)||e.encoding!==entries[0].encoding))throw RangeError("Explicit consistent mip scenes required");
 const base=entries[0].scene,levels=entries.map(e=>e.level),last=entries.length-1;
 const pitch=[base.width*base.step[0],base.height*base.step[1]],left=base.origin.map((v,i)=>v-base.step[i]/2);
 for(const {scene:s} of entries)for(let i=0;i<2;i++){
  const n=i?s.height:s.width;
  if(Math.abs(n*s.step[i]-pitch[i])>1e-9*Math.max(1,pitch[i])||Math.abs((s.origin[i]-left[i])-s.step[i]/2)>1e-9*Math.max(1,pitch[i]))throw RangeError("Misaligned mip lattice");
 }
 const finite=(...v)=>{if(!v.every(Number.isFinite))throw RangeError("Nonfinite mip query");};
 const uv=(x,y)=>{finite(x,y);return [(x-left[0])/pitch[0],(y-left[1])/pitch[1]];};
 return {
  encoding:entries[0].encoding,uv,
  continuous(x,y,lod,rx=0,ry=rx){
   finite(x,y,lod,rx,ry);const l=Math.max(0,Math.min(last,lod)),a=Math.floor(l),b=Math.min(a+1,last),p=l-a;
   const A=entries[a].scene.box(x,y,rx,ry),B=entries[b].scene.box(x,y,rx,ry);
   return A.map((v,c)=>v+(B[c]-v)*p);
  },
  native(x,y,lod){
   finite(x,y,lod);if(entries[0].encoding!=="bgra8-unorm-normalized-rgba")throw RangeError("Signed half sampler unresolved");
   const [u,v]=uv(x,y);return [2,1,0,3].map(c=>sampleBGRA8Mip(levels,u,v,lod,c));
  }
 };
}
