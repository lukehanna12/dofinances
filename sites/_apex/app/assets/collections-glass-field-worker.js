/*
 * Public Clear (finite scope): one optical branch, one displacement field.
 * Native Clear CAFilter outer refraction = 0, mixture opacity = 0. The old
 * private diagnostic mixed TWO displacement branches + THREE PNG textures.
 * One full-resolution field is lossless relative to this chosen public Clear
 * adapter, and its PNG transport preserves every generated RGBA byte.
 * Worker never receives or reads page/background pixels.
 */
import {generatePublicClearPillField} from "./collections-glass-public-clear.js";

const encodeHere=typeof OffscreenCanvas==="function"&&
 typeof FileReaderSync==="function";
const reader=encodeHere?new FileReaderSync():null;

self.onmessage=async({data:request})=>{
 const {key,w,h,radius}=request||{};
 try{
  const field=generatePublicClearPillField(w,h,radius);
  if(encodeHere){
   const canvas=new OffscreenCanvas(field.width,field.height);
   const ctx=canvas.getContext("2d");
   if(!ctx)throw Error("Worker Canvas2D unavailable");
   const img=ctx.createImageData(field.width,field.height);
   img.data.set(field.pixels);ctx.putImageData(img,0,0);
   const blob=await canvas.convertToBlob({type:"image/png"});
   self.postMessage({key,w:field.width,h:field.height,
    png:reader.readAsDataURL(blob)});
  }else{
   self.postMessage({key,w:field.width,h:field.height,
    pixels:field.pixels},[field.pixels.buffer]);
  }
 }catch(error){self.postMessage({key,error:String(error)});}
};
