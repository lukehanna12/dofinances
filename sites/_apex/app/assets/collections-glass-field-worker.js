/*
 * Geometry-only worker for the fixed Collections glass pill.
 * Uses the exact retained AIR mode5 browser field; never samples or
 * transports the page's backdrop. Three lossless 8-bit PNG fields are
 * encoded off the UI thread. Resize requests are demand-driven, not polled.
 */
import {generateOracleField} from "./sidebar-glass-oracle.js";

const canEncode=typeof OffscreenCanvas==="function"&&
  typeof FileReaderSync==="function";
const reader=canEncode?new FileReaderSync():null;
async function encode(pixels,width,height){
 const canvas=new OffscreenCanvas(width,height);
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Offscreen Canvas2D unavailable");
 const data=ctx.createImageData(width,height);
 data.data.set(pixels);ctx.putImageData(data,0,0);
 return reader.readAsDataURL(await canvas.convertToBlob({type:"image/png"}));
}
self.onmessage=async({data:request})=>{
 const {key,w,h,radius}=request||{};
 try{
  const field=generateOracleField(w,h,radius,undefined,"pill");
  if(canEncode){
   const urls=await Promise.all([field.inner,field.outer,field.blurMask]
     .map(pixels=>encode(pixels,field.width,field.height)));
   self.postMessage({key,w:field.width,h:field.height,urls});
  }else{
   self.postMessage({key,w:field.width,h:field.height,
     inner:field.inner,outer:field.outer,blurMask:field.blurMask},
     [field.inner.buffer,field.outer.buffer,field.blurMask.buffer]);
  }
 }catch(error){self.postMessage({key,error:String(error)});}
};
