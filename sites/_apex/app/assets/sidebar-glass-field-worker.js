/*
 * Exact geometry, unchanged from the native-derived browser model.
 * PNG serialisation also belongs here: the prior main-thread Canvas2D
 * toDataURL() blocked animations even after moving SDF math to a Worker.
 * OffscreenCanvas+FileReaderSync preserve all 8-bit pixels and the same
 * three PNG data:image URLs consumed by SVG feImage; fallback transfers
 * the exact arrays to the legacy main-thread encoder.
 */
import {generateOracleField,projectOracleFieldWidth} from "./sidebar-glass-oracle.js";

const canEncode=typeof OffscreenCanvas==="function" &&
                typeof FileReaderSync==="function";
const reader=canEncode?new FileReaderSync():null;
const rawBases=new Map();
const MAX_BASES=2;
function sourceExactField(request){
  const {w,h,corner}=request;
  // Only desktop 74–260px with radius 24 is proven byte-exact.
  // Mobile uses the untouched generator, especially at radius 26.
  if(w<74||w>260||h<1||corner!==24)
    return generateOracleField(w,h,corner);
  const key=h+"@"+corner;
  let base=rawBases.get(key);
  if(!base){
    base=generateOracleField(260,h,corner);
    rawBases.set(key,base);
    while(rawBases.size>MAX_BASES)rawBases.delete(rawBases.keys().next().value);
  }else{
    rawBases.delete(key);
    rawBases.set(key,base);
  }
  return projectOracleFieldWidth(base,w,corner);
}
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
    const field=sourceExactField(request);
    if(canEncode){
      const urls=await Promise.all(
        [field.inner,field.outer,field.blurMask].map(pixels=>
          toPNG(pixels,request.w,request.h)));
      self.postMessage({key:request.key,w:request.w,h:request.h,
        corner:request.corner,urls});
    }else{
      self.postMessage({key:request.key,w:request.w,h:request.h,
        corner:request.corner,inner:field.inner,outer:field.outer,
        blurMask:field.blurMask},
        [field.inner.buffer,field.outer.buffer,field.blurMask.buffer]);
    }
  }catch(error){
    self.postMessage({key:request.key,error:String(error)});
  }
};
