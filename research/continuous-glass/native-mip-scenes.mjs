// Native-stage lattice is explicit, fixed in source coordinates. The consumer
// reconstructs each level as a continuous field independently of backing density.
import {ContinuousScene} from "./sampling.mjs";
import {nativeFixedMipChain} from "./native-diamond.mjs";
export function fixedMipScenes(src,w,h,{origin=[0,0],step=[1,1],...abi}){
 if(!Array.isArray(origin)||origin.length!==2||!origin.every(Number.isFinite)||!Array.isArray(step)||step.length!==2||!step.every(x=>Number.isFinite(x)&&x>0))throw new RangeError("Invalid source coordinate map");
 return nativeFixedMipChain(src,w,h,abi).map(level=>{
  const normalized=Float64Array.from(level.values,x=>x/((abi.unorm??true)?255:1));
  return {level,scene:new ContinuousScene(level.width,level.height,normalized,{origin:origin.map((v,i)=>v+step[i]*level.sourceOrigin[i]),step:step.map((v,i)=>v*(level.sourcePitchXY??[level.sourcePitch,level.sourcePitch])[i])})};
 });
}
