/*
 * Exact, zero-parameter-change geometry calculation for the real page
 * backdrop. This worker never reads or captures background pixels.
 * It transfers only the canonical SDF-derived R/G displacement and
 * near/far blur masks; all DOM/SVG/PNG composition remains in the page.
 */
import {generateOracleField} from "./sidebar-glass-oracle.js";

self.onmessage=({data:request})=>{
  try{
    const field=generateOracleField(request.w,request.h,request.corner);
    self.postMessage({
      key:request.key,inner:field.inner,outer:field.outer,
      blurMask:field.blurMask
    },[field.inner.buffer,field.outer.buffer,field.blurMask.buffer]);
  }catch(error){
    self.postMessage({key:request.key,error:String(error)});
  }
};
