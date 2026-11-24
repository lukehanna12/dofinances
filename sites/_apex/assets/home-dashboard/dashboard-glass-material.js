/**
 * Shared public material contract, independent of surface shape and route.
 * Regular face rows: two target-native 25F80/M2 SwiftUI process traces,
 * 12 public cases / 36 same-event 264-byte CPU->mapped->Metal binding
 * joins per process. Face matrix is exactly bytes 128..151 of binding 1.
 * The captured rows are HALF, not scalar black/white endpoint blends.
 * Clear deliberately retains the established public rendering path.
 */
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";
export const GLASS_MATERIALS=Object.freeze(["clear","regular"]);
export const MATERIAL_FLOATS=16;
export const NATIVE_REGULAR_FACE_HEX=Object.freeze({
 dark:Object.freeze({large:"893877b432a729304eadf03536a729304fad76b4fa382930",
   small:"3c3926b527a8cd2c1faeda3629a8cd2c20ae26b5bd39cd2c"}),
 light:Object.freeze({large:"983817b498a66639ddac4f369da66639deac17b4fe386639",
   small:"f13820b7bfa9cd3a3cb0e034c1a9cd3a3cb01fb7a439cd3a"})
});
export function decodeFaceHalfRows(hex){
 if(!/^[0-9a-f]{48}$/.test(hex))throw new RangeError("Expected three little-endian half4 rows");
 const out=[];
 for(let i=0;i<hex.length;i+=4){
  const w=parseInt(hex.slice(i+2,i+4)+hex.slice(i,i+2),16);
  const sign=w&0x8000?-1:1,exponent=(w>>>10)&31,mantissa=w&1023;
  if(exponent===31)throw new RangeError("Nonfinite face coefficient");
  out.push(sign*(exponent===0?mantissa*2**-24:(1+mantissa/1024)*2**(exponent-15)));
 }
 return Object.freeze(out);
}
const FACE_ROWS=Object.freeze(Object.fromEntries(Object.entries(NATIVE_REGULAR_FACE_HEX).map(
 ([scheme,faces])=>[scheme,Object.freeze(Object.fromEntries(Object.entries(faces).map(
 ([size,hex])=>[size,decodeFaceHalfRows(hex)])))])));
const FACE_INPUT=Object.freeze({
 light:Object.freeze({large:Object.freeze([.5,.95,.35,1]),small:Object.freeze([.8,.97,.25,1])}),
 dark:Object.freeze({large:Object.freeze([.2,.6,.35,0]),small:Object.freeze([.1,.5,.25,0])})
});
export function validateGlassMaterial(material="clear"){
 if(!GLASS_MATERIALS.includes(material))throw new RangeError("Unknown glass material: "+material);
 return material;
}
export function glassMaterialFromElement(node){
 const owner=node?.closest?.("[data-glass-material]");
 return validateGlassMaterial(owner?.getAttribute("data-glass-material")??"clear");
}
export function resolveRegularMaterial({width,height,scale=1,scheme="dark"}){
 if(![width,height,scale].every(v=>Number.isFinite(v)&&v>0))throw new RangeError("Positive finite material geometry required");
 if(!FACE_ROWS[scheme])throw new RangeError("Unknown material scheme");
 const d=Math.min(width,height),radius=nativePublicBlurRadius("regular",width,height);
 // Both 22pt and 60pt are exactly the same small face in the repeated
 // settled probe. The earlier fresh-view study has variable small-face
 // inputs and stable large inputs starting at sampled 65pt. Do not invent
 // an exact adaptive producer: interpolate only the unsolved 60..65 seam
 // so the existing continuous expansion cannot introduce a color jump.
 const t=Math.min(1,Math.max(0,(d-60)/5));
 const mix=(a,b)=>t===0?a:t===1?b:a+(b-a)*t;
 const face=FACE_INPUT[scheme].small.map((a,i)=>mix(a,FACE_INPUT[scheme].large[i]));
 const faceRows=Object.freeze(FACE_ROWS[scheme].small.map((a,i)=>mix(a,FACE_ROWS[scheme].large[i])));
 return Object.freeze({
  material:"regular",minDimension:d,
  innerAmount:Math.max(-60,-.8*d)*scale,innerHeight:Math.min(20,.25*d)*scale,
  outerAmount:0,outerHeight:0,bleedAmount:.35*d,bleedHeight:.35*d,
  shadowAmount:Math.min(75,.625*d),shadowHeight:.4*d,
  refractionOpacity:0,bleedOpacity:0,shadowOpacity:0,blurDistribution:1,
  nativeInputBlurRadius:radius,nativeInputLayerScale:.25,
  blurWord:observedBlurWord(radius,1,.25),
  lodBias:2,faceBlack:face[0],faceWhite:face[1],faceFillAlpha:face[2],faceFillGray:face[3],
  faceRows,
  faceScope:t===1?"finite native large face matrix; adaptive face producer unproved":
    t===0?"finite native small face matrix; adaptive face producer unproved":
    "browser 60..65pt interpolation of measured matrices; adaptive face producer unproved"
 });
}
export function regularMaterialLanes(profile){
 return [1,profile.innerAmount,profile.innerHeight,profile.lodBias,...profile.faceRows];
}

// Public project title band: the established dark Clear optical profile,
// independently non-interactive. Native public Clear input scale .5 and
// observed finite encoder blur multiplier .4; other Clear surfaces unchanged.
export function resolveInactiveClearRegion({width,height}){
 if(![width,height].every(v=>Number.isFinite(v)&&v>0))throw new RangeError("Positive finite material geometry required");
 const radius=nativePublicBlurRadius("clear",width,height);
 return Object.freeze({material:"clear",scheme:"dark",interactive:false,
  nativeInputLayerScale:.5,nativeInputBlurRadius:radius,blurWord:observedBlurWord(radius,1,.25)});
}
