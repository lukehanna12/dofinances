/**
 * Public surface material contract. Independent of shape, role, page and
 * entrance delay. The default preserves the existing Clear implementation.
 *
 * Target 25F80 / Apple M2 / G14G:
 * E-P-SWIFTUI-REGULAR-FACE-GEOMETRY-FINITE (Oracle 44c7fe3),
 * E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE and the 52-case public radius witness.
 * CAFilter inputs are not final Metal or Q output. Small Regular face
 * inputs are environment-dependent; the explicit finite representative
 * below is a browser projection, not a claimed adaptive native producer.
 */
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";
export const GLASS_MATERIALS=Object.freeze(["clear","regular"]);
export const MATERIAL_FLOATS=8;
const FACE=Object.freeze({
 light:Object.freeze({large:Object.freeze([.5,.95,.35,1]),
   small:Object.freeze([.41060906648635864,.9700000286102295,.44469547271728516,1])}),
 dark:Object.freeze({large:Object.freeze([.2,.6,.35,0]),
   small:Object.freeze([.16312696039676666,.7631269693374634,.34397393465042114,0])})
});
export function validateGlassMaterial(material="clear"){
 if(!GLASS_MATERIALS.includes(material))throw new RangeError("Unknown glass material: "+material);
 return material;
}
export function glassMaterialFromElement(node){
 // Opt-in per surface; a parent or document may also supply a default.
 // The nearest explicit declaration always wins, including explicit Clear.
 const owner=node?.closest?.("[data-glass-material]");
 return validateGlassMaterial(owner?.getAttribute("data-glass-material")??"clear");
}
export function resolveRegularMaterial({width,height,scale=1,scheme="dark"}){
 if(![width,height,scale].every(v=>Number.isFinite(v)&&v>0))throw new RangeError("Positive finite material geometry required");
 if(!FACE[scheme])throw new RangeError("Unknown material scheme");
 const d=Math.min(width,height);
 const radius=nativePublicBlurRadius("regular",width,height);
 const face=FACE[scheme][d>=65?"large":"small"];
 return Object.freeze({
  material:"regular",minDimension:d,
  innerAmount:Math.max(-60,-.8*d)*scale,innerHeight:Math.min(20,.25*d)*scale,
  outerAmount:0,outerHeight:0,bleedAmount:.35*d,bleedHeight:.35*d,
  shadowAmount:Math.min(75,.625*d),shadowHeight:.4*d,
  refractionOpacity:0,bleedOpacity:0,shadowOpacity:0,blurDistribution:1,
  nativeInputBlurRadius:radius,nativeInputLayerScale:.25,
  blurWord:observedBlurWord(radius,1,.25),
  // Browser full-resolution mip pyramid: map the finite 1/4 input grid to
  // its corresponding mip origin. Exact native producer/sampling remains open.
  lodBias:2,faceBlack:face[0],faceWhite:face[1],faceFillAlpha:face[2],faceFillGray:face[3],
  faceScope:d>=65?"stable finite large-surface inputs":"finite 58.5pt representative; adaptive face producer unproved"
 });
}
export function regularMaterialLanes(profile){
 return [1,profile.innerAmount,profile.innerHeight,profile.lodBias,
  profile.faceBlack,profile.faceWhite,profile.faceFillAlpha,profile.faceFillGray];
}
