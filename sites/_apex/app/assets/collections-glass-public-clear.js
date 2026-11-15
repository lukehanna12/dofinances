/*
 * Pinned finite evidence from lukehanna12/liquid-plexiglass-oracle:
 * main 58a83a8f68392f8004981c9b42ab308b3874f543
 *   model/primary_evidence/scalars/live_swiftui_clear_filter_state.json
 *   model/primary_evidence/scalars/live_public_geometry_radius_heldout.json
 *   model/primary_evidence/scalars/live_public_style_scale_chain.json
 *   model/foundation/model/geometry_331_compact.json
 *
 * The observed SwiftUI Glass.clear case is 128×84 points at radius 19 on
 * macOS 26.5.1 (25F80) / M2 / G14G. The CAFilter input was measured
 * directly, rather than reconstructed from any PRIVATE diagnostic material.
 * Its observed ZERO outer amount, ZERO outer/refraction-mix opacity, and
 * all-ones blur-alpha lanes permit one-path field selection in this finite
 * adapter. The browser Gaussian/Metal mip correspondence and CSS shape
 * writer are still unproved. Never label this global Apple exactness.
 */
import {
 airRefractionEnvelope,controlPillField,encodeOracleDisplacement,
 nativePublicBlurRadius,observedBlurWord
} from "./sidebar-glass-oracle.js";

export const CLEAR_OBSERVED_128_84=Object.freeze({
 width:128,height:84,corner:19,
 innerAmount:-60,innerHeight:20,
 outerAmount:0,outerHeight:0,
 refractionOpacity:0,refractionDistance0:-1,refractionDistance1:-.5,
 blurRadius:7.5,blurOpacity:Object.freeze([1,1,1,1,1]),
 blurDistance:Object.freeze([0,0,0,0,0]),
 faceWhite:.8,faceBlack:.05,faceFillWhiteAlpha:.05,
 backdropScale:.5,cacheScale:.25
});
const f32=Math.fround;
export function projectPublicClearInputs(w,h){
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)
  throw new RangeError("Finite positive glass dimensions required");
 const d=Math.min(w,h);
 // Finite original 10-case geometry relationships (not universal proof):
 const amount=f32(Math.max(-60,-.8*d));
 const height=f32(Math.min(20,.25*d));
 const blurRadius=nativePublicBlurRadius("clear",w,h);
 const cachedScale=CLEAR_OBSERVED_128_84.cacheScale;
 const word=observedBlurWord(blurRadius,1,cachedScale);
 // Metal LOD is not a Gaussian standard deviation. This is an explicit
 // browser approximation at the observed public surface/cache scale.
 return {d,amount,height,blurRadius,word,
  browserGaussianSigma:word/cachedScale};
}
export function generatePublicClearPillField(w,h,radius){
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>6000000)
  throw new RangeError("Invalid public-Clear displacement-map dimensions");
 const width=Math.round(w),height=Math.round(h);
 const r=Math.min(width,height)*.5;
 if(!Number.isFinite(radius)||radius<=0||radius>r)
  throw new RangeError("Radius must be within the actual pill geometry");
 const inputs=projectPublicClearInputs(width,height);
 const pixels=new Uint8ClampedArray(width*height*4);
 // This is a complete 2D mode5 four-corner evaluation. No stretched maps,
 // nine-slice field, assumed source background, or lossy color quantization.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=controlPillField(x+.5,y+.5,width,height,radius);
  const offset=airRefractionEnvelope(p.distance,inputs.amount,
    f32(1/inputs.height));
  const i=(y*width+x)*4;
  pixels[i]=encodeOracleDisplacement(p.nx*offset);
  pixels[i+1]=encodeOracleDisplacement(p.ny*offset);
  pixels[i+2]=0;pixels[i+3]=255;
 }
 return {width,height,pixels,inputs};
}
