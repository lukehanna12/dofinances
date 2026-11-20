/**
 * Live-content Liquid Glass for Colosseum 0001c1's occupied squares.
 *
 * Research: lukehanna12/liquid-plexiglass-oracle @
 * 3fd32ed3be300560552dd4577907affef7a09737 (25F80 / M2 / G14G).
 *
 * EXACT/FINITE-SCOPED SOURCES:
 *   model/foundation/canonical_evidence/records/glass_background_sdf_no_bleed_lph.ssa.json.gz
 *   model/foundation/model/geometry_331_compact.json
 *   model/primary_evidence/scalars/live_public_geometry_radius_heldout.json
 *   model/primary_evidence/scalars/live_public_container_factors.json
 *   model/primary_evidence/scalars/live_public_blur_encoder_joins.json
 *   model/primary_evidence/v5_reconciliation.json
 *   model/OPEN_PROOFS.json
 *
 * The exact AIR SDF/normal, envelope, threshold, distribution and Float32
 * CPU arithmetic are imported unchanged from the existing evidence-backed
 * browser bridge, sidebar-glass-oracle.js. This preview NEVER reads, copies,
 * encodes, or snapshots the image/pixels under the glass. Its three PNG maps
 * contain only geometry-driven displacement and blur weights. The SVG
 * backdrop-filter's SourceGraphic is the ACTUAL live browser-composited
 * backdrop: changing/moving underlying DOM or moving a tile changes the
 * sampled appearance without a regenerated scene image.
 *
 * OPEN ORACLE GAPS — explicitly not native-equivalent:
 * GAP(PUBLIC-STATE): public "clear" style writer of all material parameters,
 *      face/bleed/shadow matrix, opacity, tint, four-corner SDF and geometry
 *      selection is not structurally closed. Public geometry and CAFilter
 *      evidence are FINITE. The shape-to-mode5 signed-corner mapping below
 *      is a physically motivated browser adapter, not proven SwiftUI code.
 * GAP(P-SCALARS): renderer/downsample/surface factor .4f is finite-scope,
 *      not a universal public-state blur multiplier.
 * GAP(S-R-NATIVE): JS Float32 port / SVG engine does not prove AIR↔G14G native
 *      equivalence (not closed even for the full native shader corpus).
 * GAP(BROWSER-TRANSPORT): browser SVG Gaussian blur substitutes for Metal
 *      filtered texture MIP/LOD; browser feDisplacementMap approximates
 *      texture-coordinate transport, precision, edge clipping and sampling.
 *      CORRECTION: the original bridge divided blurWord by surfaceScale,
 *      creating massive Gaussian blur that is NOT an observed native radius.
 *      The bridge now maps observed LOD to a box-filter footprint and
 *      variance-matched Gaussian sigma. This is a transparent approximation,
 *      not an Apple pixel-equivalent law. The original bridge also applied
 *      a second .25 factor to displacement without resolving normalized
 *      source-texture coordinates to CSS pixels; that attenuation is removed.
 *      Assumed source texture grid scale still remains an OPEN transport gap.
 * GAP(COLOR-Q): runtime extended-sRGB→ColorSync→EDR→display chain is open.
 *      Keep actual backdrop colors; never substitute one private diagnostic
 *      color matrix as purported public clear-style evidence.
 * GAP(JOINT-MATERIAL): threshold/alpha values below are from ONE coherent
 *      private diagnostic; geometry values are from SEPARATE finite public
 *      cases. Their cross-product has not been natively observed as clear
 *      material. No visual similarity is treated as proof of equivalence.
 * GAP(INTERACTION): pointer-responsive glint is a cosmetic browser fill-in;
 *      no measured macOS specular/interaction equation is claimed.
 */
import "./dashboard-mosaic.js";
import {
  ORACLE_FINITE_REFRACTION,
  ORACLE_CORNER_FLOOR,
  SVG_DISPLACEMENT_NEUTRAL_BIAS,
  nativePublicBlurRadius,
  observedBlurWord,
  airMode5SDF,
  airRefractionEnvelope,
  airThresholdMix,
  airBlurDistribution,
  airTextureMipLOD,
  encodeOracleDisplacement
} from "./sidebar-glass-oracle.js";

const NS="http://www.w3.org/2000/svg";
const FILTER_ID="liquid-plexiglass-mosaic";
const root=typeof document!=="undefined"?document.getElementById("cta6-mosaic"):null;
const tiles=root?[...root.querySelectorAll(".cta6-tile:not(.cta6-tile--empty)")]:[];
const round=Math.fround;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const reduced=()=>window.matchMedia("(prefers-reduced-transparency: reduce)").matches ||
  window.matchMedia("(forced-colors: active)").matches ||
  window.matchMedia("(prefers-contrast: more)").matches;
const SDF_MODE=5;
const LIVE_INPUT="CSS backdrop-filter SourceGraphic / actual painted DOM";
const TARGET="25F80 / Apple M2 / G14G — finite evidence only";

function svgElement(name,attributes={}){
  const node=document.createElementNS(NS,name);
  for(const [key,value]of Object.entries(attributes))
    node.setAttribute(key,String(value));
  return node;
}
function filterGraph(){
  const svg=svgElement("svg",{
    "aria-hidden":"true",focusable:"false",
    xmlns:NS,width:0,height:0
  });
  svg.style.cssText="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const defs=svgElement("defs");
  const filter=svgElement("filter",{
    id:FILTER_ID,x:"0%",y:"0%",width:"100%",height:"100%",
    filterUnits:"objectBoundingBox",primitiveUnits:"userSpaceOnUse",
    "color-interpolation-filters":"sRGB"
  });
  function node(type,options){const n=svgElement(type,options);filter.append(n);return n;}
  const far=node("feGaussianBlur",{in:"SourceGraphic",stdDeviation:8,result:"farBlur"});
  const near=node("feGaussianBlur",{in:"SourceGraphic",stdDeviation:4,result:"nearBlur"});
  const blurMap=node("feImage",{
    x:0,y:0,width:1,height:1,preserveAspectRatio:"none",result:"blurMap"
  });
  // ColorMatrix converts measured geometry PNG R/G to near-blur coverages.
  node("feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0",
    result:"innerNearCoverage"});
  node("feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0",
    result:"outerNearCoverage"});
  node("feComposite",{in:"nearBlur",in2:"innerNearCoverage",
    operator:"in",result:"innerNearPart"});
  node("feComposite",{in:"farBlur",in2:"innerNearCoverage",
    operator:"out",result:"innerFarPart"});
  // Exact interpolation COMPOSITING algebra; additive, not "over" (which
  // erroneously applies the alpha complement twice).
  node("feComposite",{in:"innerNearPart",in2:"innerFarPart",
    operator:"arithmetic",k2:1,k3:1,result:"innerBlurred"});
  node("feComposite",{in:"nearBlur",in2:"outerNearCoverage",
    operator:"in",result:"outerNearPart"});
  node("feComposite",{in:"farBlur",in2:"outerNearCoverage",
    operator:"out",result:"outerFarPart"});
  node("feComposite",{in:"outerNearPart",in2:"outerFarPart",
    operator:"arithmetic",k2:1,k3:1,result:"outerBlurred"});
  const innerMap=node("feImage",{
    x:0,y:0,width:1,height:1,preserveAspectRatio:"none",result:"innerMap"
  });
  const outerMap=node("feImage",{
    x:0,y:0,width:1,height:1,preserveAspectRatio:"none",result:"outerMap"
  });
  // PNG 8-bit neutral=128 (not 127.5): compensate 1/(2*255) to make
  // exactly zero native-derived displacement decode as exactly zero.
  const centerMatrix="1 0 0 0 -"+SVG_DISPLACEMENT_NEUTRAL_BIAS+" "+
    "0 1 0 0 -"+SVG_DISPLACEMENT_NEUTRAL_BIAS+" "+
    "0 0 1 0 0  0 0 0 1 0";
  node("feColorMatrix",{in:"innerMap",type:"matrix",
    values:centerMatrix,result:"innerCentered"});
  node("feColorMatrix",{in:"outerMap",type:"matrix",
    values:centerMatrix,result:"outerCentered"});
  node("feDisplacementMap",{
    in:"innerBlurred",in2:"innerCentered",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"innerShift"});
  node("feDisplacementMap",{
    in:"outerBlurred",in2:"outerCentered",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"outerShift"});
  node("feColorMatrix",{in:"innerMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",
    result:"outerBlendMask"});
  node("feComposite",{in:"outerShift",in2:"outerBlendMask",
    operator:"in",result:"outerPart"});
  node("feComposite",{in:"innerShift",in2:"outerBlendMask",
    operator:"out",result:"innerPart"});
  node("feComposite",{in:"outerPart",in2:"innerPart",
    operator:"arithmetic",k2:1,k3:1,result:"liveGlass"});
  // GAP(COLOR-Q): public clear color transform is not established.
  // The identity preserves ACTUAL sRGB pixels without faking Apple tone map.
  node("feColorMatrix",{in:"liveGlass",type:"matrix",
    values:"1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
    result:"liveGlassColor"});
  defs.append(filter);svg.append(defs);document.body.append(svg);
  return {svg,filter,far,near,innerMap,outerMap,blurMap};
}

/* These scale relations are recorded in 10 finite geometry cases in
 * model/foundation/model/geometry_331_compact.json. Applying their joint
 * values to a browser square with private mode5 thresholds is GAP
 * (JOINT-MATERIAL/PUBLIC-STATE), not an Apple target capture. */
export function finiteGeometryParameters(w,h){
  const d=Math.min(w,h);
  const innerHeight=Math.min(20,.25*d);
  const outerHeight=.125*d;
  const profile={
    ...ORACLE_FINITE_REFRACTION,
    innerAmount:round(Math.max(-60,-.8*d)),
    innerInvHeight:round(1/innerHeight),
    outerAmount:round(.2*d),
    outerInvHeight:round(1/outerHeight),
    blurDist:[round(-.5*d),-1,0,0],
    blurAlpha:ORACLE_FINITE_REFRACTION.blurAlpha
  };
  return profile;
}
/* Exact finite public CLEAR interpolation, followed by finite selected-input
 * Float32 product. Converting Metal filtered LOD footprint into browser CSS
 * sigma is explicitly a GAP(BROWSER-TRANSPORT) adapter. */
export function finiteBlurParameters(w,h){
  const publicRadius=nativePublicBlurRadius("clear",w,h);
  const blurWord=observedBlurWord(publicRadius,1,.25);
  const nearLOD=airTextureMipLOD(blurWord,.5);
  const farLOD=airTextureMipLOD(blurWord,1);
  // GAP(BROWSER-MIP-TO-GAUSS): AIR's LOD is retained exactly. Native mip
  // texel filtering is NOT a CSS Gaussian. Treat a footprint of 2**LOD
  // units as a box kernel, then equate variances: sigma=footprint/sqrt(12).
  // Its 1-texture-texel == 1-CSS-pixel conversion is explicitly UNPROVEN.
  // Critically, DO NOT divide blurWord by surfaceScale: the former is
  // already the selected renderer's native blur word, NOT a CSS sigma.
  const nearSigma=Math.max(.12,Math.pow(2,nearLOD)/Math.sqrt(12));
  const farSigma=Math.max(.12,Math.pow(2,farLOD)/Math.sqrt(12));
  return {publicRadius,blurWord,nearSigma,farSigma,nearLOD,farLOD};
}

/* Fully geometric four-corner AIR mode5. No page-background pixels enter.
 * CSS border-radius -> PRIVATE signed-corner CPU SDF mapping is unproved.
 * The observed private mode5 floor only bounds the minimum corner magnitude. */
export function shapeField(x,y,w,h,radius){
  const signed=-Math.max(ORACLE_CORNER_FLOOR,radius);
  const normal=airMode5SDF(
    round(x-w*.5),round(h*.5-y),round(w*.5),round(h*.5),
    [signed,signed,signed,signed],0
  );
  return {distance:normal.distance,nx:normal.nx,ny:-normal.ny};
}
export function createGeometricMaps(w,h,radius,profile){
  const len=w*h*4;
  const inner=new Uint8ClampedArray(len);
  const outer=new Uint8ClampedArray(len);
  const blur=new Uint8ClampedArray(len);
  // GAP(BROWSER-DISPLACEMENT-COORDINATES): target-native sampled
  // normalized source-UV delta = amount/(4*sourceTextureDimension).
  // Converting that to page CSS pixels multiplies by displayPixels /
  // sourceTextureDimension. The finite sourceScale=.25 means a nominal
  // quarter-resolution native source; for a matching CSS extent this
  // cancels the /4: (1/4) / .25 = 1. Previous code incorrectly applied
  // ANOTHER .25 to pixel-space amount, hiding most edge refraction.
  // That matching-extent/texture-scale assumption is NOT validated for a
  // browser SVG filter or all clear-style public states.
  const cssDisplacementScale=1/(4*ORACLE_FINITE_REFRACTION.surfaceScale);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=4*(x+y*w);
      const p=shapeField(x+.5,y+.5,w,h,radius);
      const innerValue=airRefractionEnvelope(
        p.distance,profile.innerAmount,profile.innerInvHeight);
      const outerValue=airRefractionEnvelope(
        p.distance,profile.outerAmount,profile.outerInvHeight);
      const blend=airThresholdMix(
        p.distance,profile.threshold0,profile.threshold1,profile.opacity);
      // The ±1/(4*N) native UV relation is retained. Its CSS displacement
      // multiplier is derived above, with the explicit texture-grid gap.
      inner[i]=encodeOracleDisplacement(round(p.nx*innerValue*cssDisplacementScale));
      inner[i+1]=encodeOracleDisplacement(round(p.ny*innerValue*cssDisplacementScale));
      outer[i]=encodeOracleDisplacement(round(p.nx*outerValue*cssDisplacementScale));
      outer[i+1]=encodeOracleDisplacement(round(p.ny*outerValue*cssDisplacementScale));
      inner[i+2]=outer[i+2]=Math.round(clamp(blend,0,1)*255);
      inner[i+3]=outer[i+3]=255;
      // Retained AIR refraction-adjusted SDF is used for blur ramps.
      const inDistribution=airBlurDistribution(
        round(p.distance+innerValue),profile);
      const outDistribution=airBlurDistribution(
        round(p.distance+outerValue),profile);
      // GAP(BROWSER-TRANSPORT): near/far Gaussian blend is the browser
      // approximation of native texture mip LOD and filtering.
      const inNear=clamp((1-inDistribution)/.5,0,1);
      const outNear=clamp((1-outDistribution)/.5,0,1);
      blur[i]=Math.round(inNear*255);
      blur[i+1]=Math.round(outNear*255);
      blur[i+2]=blur[i];
      blur[i+3]=255;
    }
  }
  return {w,h,inner,outer,blur};
}
function geometryPNG(bytes,w,h){
  // Canvas encodes only geometric scalar fields, NEVER backdrop pixels.
  const canvas=document.createElement("canvas");
  canvas.width=w;canvas.height=h;
  const context=canvas.getContext("2d",{willReadFrequently:false});
  if(!context)throw new Error("Canvas geometry encoder unavailable");
  const img=context.createImageData(w,h);
  img.data.set(bytes);
  context.putImageData(img,0,0);
  return canvas.toDataURL("image/png");
}
function decodePNG(url){
  const img=new Image();
  img.src=url;
  return img.decode();
}
function readTileGeometry(tile){
  const b=tile.getBoundingClientRect();
  // During .4s entrance, boundingClientRect includes scale(.85) animation.
  // offsetWidth/Height are the NON-TRANSFORMED layout dimensions.
  const w=Math.max(1,Math.round(tile.offsetWidth));
  const h=Math.max(1,Math.round(tile.offsetHeight));
  const radiusCSS=Number.parseFloat(getComputedStyle(tile).borderTopLeftRadius)||0;
  const radius=Math.max(ORACLE_CORNER_FLOOR,Math.min(radiusCSS,w/2,h/2));
  return {w,h,radius,screenRect:b};
}
function init(){
  if(!root||!tiles.length)return;
  const allow=typeof CSS!=="undefined"&&
    (CSS.supports("backdrop-filter",'url("#'+FILTER_ID+'")')||
     CSS.supports("-webkit-backdrop-filter",'url("#'+FILTER_ID+'")'));
  const graph=filterGraph();
  const audit={target:TARGET,shader:"glass_background_sdf_no_bleed_lph",
    mode:SDF_MODE,input:LIVE_INPUT,
    backdropReadback:false,generatedMaps:"SDF normals/refraction/blur weights ONLY",
    browserSVGSupported:allow,active:false,panes:tiles.length,
    geometry:null,publicClearRadius:null,finiteBlurWord:null,
    nearLOD:null,farLOD:null,nearSigma:null,farSigma:null,
    cssDisplacementScale:null,
    coverage:"finite P/S + approximate browser R/C/Q",
    error:null};
  Object.defineProperty(window,"__liquidGlassOraclePreview",{
    configurable:true,get:()=>Object.freeze({...audit})
  });
  for(const tile of tiles){
    tile.classList.add("cta6-tile--glass");
    tile.addEventListener("pointermove",event=>{
      if(event.pointerType==="touch")return;
      const b=tile.getBoundingClientRect();
      tile.style.setProperty("--glass-pointer-x",
        (100*(event.clientX-b.left)/b.width).toFixed(1)+"%");
      tile.style.setProperty("--glass-pointer-y",
        (100*(event.clientY-b.top)/b.height).toFixed(1)+"%");
      tile.style.setProperty("--glass-pointer-energy",".65");
    },{passive:true});
    tile.addEventListener("pointerleave",()=>{
      tile.style.setProperty("--glass-pointer-energy","0");
    },{passive:true});
  }
  let lastKey="",generation=0;
  async function updateField(){
    const rect=readTileGeometry(tiles[0]);
    if(rect.w<2||rect.h<2)return;
    const key=rect.w+"x"+rect.h+"@"+rect.radius.toFixed(3);
    if(key===lastKey)return;
    const gen=++generation;
    const profile=finiteGeometryParameters(rect.w,rect.h);
    const blur=finiteBlurParameters(rect.w,rect.h);
    for(const tile of tiles)
      tile.style.setProperty("--glass-fallback-blur",blur.farSigma+"px");
    audit.geometry={w:rect.w,h:rect.h,radius:rect.radius};
    audit.publicClearRadius=blur.publicRadius;
    audit.finiteBlurWord=blur.blurWord;
    audit.nearLOD=blur.nearLOD;audit.farLOD=blur.farLOD;
    audit.nearSigma=blur.nearSigma;audit.farSigma=blur.farSigma;
    audit.cssDisplacementScale=1/(4*ORACLE_FINITE_REFRACTION.surfaceScale);
    if(!allow||reduced()){lastKey=key;return}
    try{
      const field=createGeometricMaps(rect.w,rect.h,rect.radius,profile);
      const urls=[
        geometryPNG(field.inner,rect.w,rect.h),
        geometryPNG(field.outer,rect.w,rect.h),
        geometryPNG(field.blur,rect.w,rect.h)
      ];
      // Prevent a partially decoded map from becoming a live filter.
      await Promise.all(urls.map(decodePNG));
      if(gen!==generation)return;
      graph.far.setAttribute("stdDeviation",String(blur.farSigma));
      graph.near.setAttribute("stdDeviation",String(blur.nearSigma));
      for(const [node,url]of [
        [graph.innerMap,urls[0]],[graph.outerMap,urls[1]],
        [graph.blurMap,urls[2]]
      ]){
        node.setAttribute("width",String(rect.w));
        node.setAttribute("height",String(rect.h));
        node.setAttribute("href",url);
      }
      // All material parameters and maps commit within the same JS task.
      for(const tile of tiles)tile.classList.add("oracle-filter-active");
      audit.error=null;audit.active=true;lastKey=key;
      root.dataset.oracleOpticalMode="live-backdrop";
      root.dataset.oracleFieldGeometry=key;
      root.dataset.oracleBlurSigmaFar=blur.farSigma.toFixed(3);
      root.dataset.oracleCssDisplacementScale=
        String(1/(4*ORACLE_FINITE_REFRACTION.surfaceScale));
    }catch(error){
      if(gen!==generation)return;
      audit.error=String(error);
      audit.active=false;
      for(const tile of tiles)tile.classList.remove("oracle-filter-active");
    }
  }
  updateField();
  // ResizeObserver reacts ONLY to an actual tile layout-size change.
  // A future transform/translation changes the live sampled SourceGraphic,
  // not this geometry map. No static screenshot or timing/polling loop.
  const resize=new ResizeObserver(()=>{updateField()});
  resize.observe(tiles[0]);
  window.addEventListener("pagehide",()=>{resize.disconnect();graph.svg.remove()},{once:true});
}
init();
