/*
 * Browser optical-field adapter for the Liquid Glass gallery.
 * Reuses Oracle 25F80 AIR-derived mode-5 SDF and refraction equations.
 * This does NOT claim exact Apple GPU execution, public material selection,
 * browser texture filtering, or final output color (LG-SR-NATIVE / Q OPEN).
 */
import {
  airMode5SDF,
  airRefractionEnvelope,
  airThresholdMix,
  airBlurDistribution,
  encodeOracleDisplacement,
  ORACLE_FINITE_REFRACTION,
  ORACLE_CORNER_FLOOR
} from "/app/assets/sidebar-glass-oracle.js";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const f32=Math.fround;
const fieldCache=new Map();
const MAX_CACHED=9;
const MAX_PIXELS=200000;
const material=ORACLE_FINITE_REFRACTION;

function generateRoundedField(w,h,corner){
  const area=w*h;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||area>MAX_PIXELS)
    throw new RangeError("Unsupported gallery field dimensions");
  const radius=Math.max(ORACLE_CORNER_FLOOR,Math.min(corner,w/2,h/2));
  const signed=[-radius,-radius,-radius,-radius];
  const inner=new Uint8ClampedArray(area*4);
  const outer=new Uint8ClampedArray(area*4);
  const blur=new Uint8ClampedArray(area*4);
  const activeSpan=Math.max(
    Math.abs(material.blurDist[0]),
    1/material.innerInvHeight,
    1/material.outerInvHeight
  );
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const off=(y*w+x)*4;
      const fromBounds=Math.min(x,w-x-.5,y,h-y-.5);
      if(fromBounds>activeSpan){
        inner[off]=inner[off+1]=outer[off]=outer[off+1]=128;
        inner[off+2]=outer[off+2]=0;
        inner[off+3]=outer[off+3]=255;
        blur[off]=blur[off+1]=blur[off+2]=0;
        blur[off+3]=255;
        continue;
      }
      // AIR positive-up, centered, four NEGATIVE signed corner radii.
      const sdf=airMode5SDF(x+.5-w/2,h/2-y-.5,w/2,h/2,signed,0);
      const dx=sdf.nx,dy=-sdf.ny;
      const a=airRefractionEnvelope(sdf.distance,material.innerAmount,material.innerInvHeight);
      const b=airRefractionEnvelope(sdf.distance,material.outerAmount,material.outerInvHeight);
      const mix=clamp(airThresholdMix(
        sdf.distance,material.threshold0,material.threshold1,material.opacity),0,1);
      inner[off]=encodeOracleDisplacement(dx*a);
      inner[off+1]=encodeOracleDisplacement(dy*a);
      outer[off]=encodeOracleDisplacement(dx*b);
      outer[off+1]=encodeOracleDisplacement(dy*b);
      inner[off+2]=outer[off+2]=Math.round(mix*255);
      inner[off+3]=outer[off+3]=255;
      const innerDist=f32(sdf.distance+a);
      const outerDist=f32(sdf.distance+b);
      const innerAlpha=airBlurDistribution(innerDist,material);
      const outerAlpha=airBlurDistribution(outerDist,material);
      const inn=clamp((1-innerAlpha)/.5,0,1);
      const out=clamp((1-outerAlpha)/.5,0,1);
      blur[off]=blur[off+2]=Math.round(255*inn);
      blur[off+1]=Math.round(255*out);
      blur[off+3]=255;
    }
  }
  return [inner,outer,blur];
}

async function encodePNG(pixels,w,h){
  if(typeof OffscreenCanvas!=="function")throw new Error("OffscreenCanvas unavailable");
  const canvas=new OffscreenCanvas(w,h);
  const context=canvas.getContext("2d",{willReadFrequently:false});
  if(!context)throw new Error("Worker Canvas2D unavailable");
  context.putImageData(new ImageData(pixels,w,h),0,0);
  const blob=await canvas.convertToBlob({type:"image/png"});
  if(typeof FileReaderSync!=="function")throw new Error("FileReaderSync unavailable");
  return new FileReaderSync().readAsDataURL(blob);
}

self.onmessage=async event=>{
  const req=event.data||{};
  const id=req.id;
  try{
    const width=req.width,height=req.height;
    const radius=req.radius;
    if(!Number.isFinite(radius)||radius<0)throw new RangeError("Invalid corner radius");
    const key=width+"x"+height+"@"+radius;
    let urls=fieldCache.get(key);
    if(!urls){
      const arrays=generateRoundedField(width,height,radius);
      urls=await Promise.all(arrays.map(arr=>encodePNG(arr,width,height)));
      fieldCache.set(key,urls);
      // Bounded geometry-only cache; no backdrop pixels are read or stored.
      if(fieldCache.size>MAX_CACHED)fieldCache.delete(fieldCache.keys().next().value);
    }
    self.postMessage({id,key,width,height,radius,urls});
  }catch(error){
    self.postMessage({id,error:String(error?.message||error)});
  }
};
