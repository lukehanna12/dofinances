/*
 * Exact geometry, unchanged from the native-derived browser model.
 * PNG serialisation also belongs here: the prior main-thread Canvas2D
 * toDataURL() blocked animations even after moving SDF math to a Worker.
 * OffscreenCanvas+FileReaderSync preserve all 8-bit pixels and the same
 * three PNG data:image URLs consumed by SVG feImage; fallback transfers
 * the exact arrays to the legacy main-thread encoder.
 */
import {generateOracleField} from "./sidebar-glass-oracle.js";

const canEncode=typeof OffscreenCanvas==="function" &&
                typeof FileReaderSync==="function";
const reader=canEncode?new FileReaderSync():null;
async function toPNG(buffer,width,height){
  const canvas=new OffscreenCanvas(width,height);
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Worker Canvas2D unavailable");
  const image=ctx.createImageData(width,height);
  image.data.set(buffer);
  ctx.putImageData(image,0,0);
  const blob=await canvas.convertToBlob({type:"image/png"});
  return reader.readAsDataURL(blob);
}
self.onmessage=async({data:request})=>{
  try{
    const field=generateOracleField(request.w,request.h,request.corner);
    if(canEncode){
      const urls=[];
      for(const pixels of [field.inner,field.outer,field.blurMask]){
        urls.push(await toPNG(pixels,request.w,request.h));
      }
      self.postMessage({key:request.key,urls});
    }else{
      self.postMessage({key:request.key,inner:field.inner,outer:field.outer,
        blurMask:field.blurMask},
        [field.inner.buffer,field.outer.buffer,field.blurMask.buffer]);
    }
  }catch(error){
    self.postMessage({key:request.key,error:String(error)});
  }
};
