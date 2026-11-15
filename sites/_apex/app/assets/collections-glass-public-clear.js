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
 airRefractionEnvelope,encodeOracleDisplacement,
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
/*
 * The CSS panel uses border-radius:9999px (height/2): a straight strip
 * between TWO precise semicircles. This is its analytic signed-distance
 * function, not a guessed border. We cannot substitute the private AIR
 * mode5 signed-corner-radii path for CSS capsule geometry: the repository
 * explicitly DOES NOT prove the browser-radius -> native mode5 producer.
 * We do reuse the recorded public Clear CAFilter coefficients and the AIR
 * signed-distance -> refraction equation, evaluated against this exact CSS
 * outline. Positive distance is exterior, zero lies on the perimeter.
 */
export function cssCapsuleField(x,y,w,h,radius=h/2){
 if(![x,y,w,h,radius].every(Number.isFinite)||w<h||h<=0||
    radius<=0||Math.abs(radius-h/2)>1e-6)
  throw new RangeError("A finite horizontal CSS capsule is required");
 const cx=Math.max(radius,Math.min(w-radius,x));
 const dx=x-cx,dy=y-h/2,len=Math.hypot(dx,dy);
 return {distance:Math.fround(len-radius),
  nx:len===0?0:Math.fround(dx/len),
  ny:len===0?0:Math.fround(dy/len)};
}
const smooth01=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
export function generatePublicClearPillField(w,h,radius){
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>6000000)
  throw new RangeError("Invalid public-Clear displacement-map dimensions");
 const bodyWidth=Math.round(w),bodyHeight=Math.round(h);
 if(bodyWidth<bodyHeight||!Number.isFinite(radius)||
    Math.abs(radius-bodyHeight*.5)>1e-6)
  throw new RangeError("The map must match the CSS capsule's actual half-height radius");
 const inputs=projectPublicClearInputs(bodyWidth,bodyHeight);
 // The *measured public* inner-refraction height sets the optical reach.
 // Overscan and exterior fade therefore have a source-derived dimension,
 // rather than an arbitrary artist-chosen halo thickness.
 const overscan=Math.ceil(inputs.height);
 const width=bodyWidth+2*overscan,height=bodyHeight+2*overscan;
 const pixels=new Uint8ClampedArray(width*height*4);
 const invHeight=f32(1/inputs.height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=cssCapsuleField(x+.5-overscan,y+.5-overscan,
    bodyWidth,bodyHeight,radius);
  // The public AIR refraction envelope is defined across the glass body.
  // Extend its exterior contribution to zero over one measured refraction
  // height so the blur/warp does not terminate abruptly at the CSS clip.
  const outerFade=p.distance<=0?1:
   1-smooth01(p.distance/inputs.height);
  const offset=airRefractionEnvelope(p.distance,inputs.amount,invHeight);
  const displacement=f32(offset*f32(outerFade));
  const i=(y*width+x)*4;
  pixels[i]=encodeOracleDisplacement(p.nx*displacement);
  pixels[i+1]=encodeOracleDisplacement(p.ny*displacement);
  pixels[i+2]=0;
  // Reuse SAME lossless PNG as CSS alpha mask: alpha=1 throughout the
  // actual capsule, gradually zero outside. No second map, no extra
  // browser pixels copied, and the warped halo is rendered beyond the rim.
  pixels[i+3]=Math.round(255*outerFade);
 }
 return {width,height,bodyWidth,bodyHeight,overscan,pixels,inputs};
}
