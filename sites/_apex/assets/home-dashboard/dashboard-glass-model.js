/*
 * DoFinances shared glass surface contract.
 *
 * Oracle basis (locked target 25F80 / M2 / G14G):
 *  - geometry_331_compact: d=min(resolved backdrop width,height);
 *    ten finite input-geometry relations, NOT universal CSS->native proof.
 *  - SDF bridge: mode4 iff four normalized private radii compare equal;
 *    unequal lanes route to mode5, with finite same-event joins.
 *  - Thin-Clear SwiftUI finite cases show geometry is genuinely
 *    dimension-sensitive; their distinct filter equations MUST NOT be
 *    substituted into this site's general filter family without evidence.
 *
 * This is an explicit BROWSER geometry/presentation adapter, not a
 * recovered universal native corner writer, hover law or compositor.
 * One scalar circular radius per corner can represent squares, rectangles,
 * circles and pills. Elliptical CSS radii are intentionally rejected:
 * mode4/5 cannot silently model two independent corner axes.
 */
import {validateGlassMaterial} from "./dashboard-glass-material.js";
export const GLASS_GEOMETRY_SOURCE="geometry_331_compact/finite-10";
export const GLASS_SDF_FLOOR=0.009999999776482582;
export const GLASS_SHAPES=Object.freeze([
  "auto","square","rectangle","rounded-rectangle","capsule","circle"
]);
export const GLASS_CONTENT_MODES=Object.freeze([
  "none","text","icon","flat","mixed","silhouette"
]);
export const GLASS_INTERACTION=Object.freeze({
  hoverEnterRate:26,hoverExitRate:18,
  pressEnterRate:34,pressExitRate:23,
  pointerFollowRate:25,velocityDecayRate:14,
  hoverLight:0.075,pressLight:0.06,rimPressLight:0.035
});
const finitePositive=(value,label)=>{
  if(!Number.isFinite(value)||value<=0)throw new RangeError(label+" must be positive finite");
  return value;
};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const near=(a,b)=>Math.abs(a-b)<=Math.max(1e-5,Math.min(a,b)*1e-5);
const pct=/^([+-]?(?:\d+\.?\d*|\.\d+))%$/;
const cssPx=/^([+-]?(?:\d+\.?\d*|\.\d+))(?:px)?$/;
function scalarRadius(value,width,height){
  if(typeof value==="number"){
    if(!Number.isFinite(value))throw new RangeError("Finite corner radius required");
    return Math.max(0,value);
  }
  if(typeof value!=="string")throw new TypeError("CSS radius must be px, %, or number");
  const token=value.trim();
  const percent=token.match(pct);
  if(percent){
    // A percentage CSS radius has independent X and Y lengths. The single
    // scalar SDF can express it faithfully ONLY when W=H.
    if(!near(width,height))throw new RangeError(
      "Elliptical percentage radii need a 2-axis SDF; refusing silent conversion");
    return Math.max(0,Number(percent[1])*width/100);
  }
  const pair=token.split(/\s+/);
  if(pair.length===2&&pair.every(x=>cssPx.test(x))){
    const x=Number(pair[0].match(cssPx)[1]);
    const y=Number(pair[1].match(cssPx)[1]);
    if(!near(x,y))throw new RangeError(
      "Elliptical corner requires two-axis SDF, not scalar projection");
    return Math.max(0,x);
  }
  const m=token.match(cssPx);
  if(!m)throw new RangeError("Unsupported elliptical/functional CSS radius");
  return Math.max(0,Number(m[1]));
}
export function selectGlassSdfMode(lanes){
  if(!Array.isArray(lanes)||lanes.length!==4)
    throw new TypeError("Four normalized private corner lanes required");
  // AArch64 FCMP equality considers +/-zero equal and NaN unordered.
  return lanes[0]===lanes[1]&&lanes[1]===lanes[2]&&
    lanes[2]===lanes[3]?4:5;
}
export function normalizeGlassCornerRadii(rawRadii,width,height){
  finitePositive(width,"width");finitePositive(height,"height");
  if(!Array.isArray(rawRadii)||rawRadii.length!==4)
    throw new TypeError("Four CSS corner radii required (TL,TR,BR,BL)");
  const r=rawRadii.map(x=>scalarRadius(x,width,height));
  // CSS "overlapping corner" reduction uses ONE global factor, not four
  // independent half-height clamps. This preserves asymmetric radii and
  // produces true semicircular ends for 999px on 390x40 pills.
  const sums=[r[0]+r[1],r[2]+r[3],r[0]+r[3],r[1]+r[2]];
  const limits=[width,width,height,height];
  const f=Math.min(1,...sums.map((sum,i)=>sum>0?limits[i]/sum:1));
  return r.map(v=>v*f);
}
export function classifyGlassShape(width,height,radii){
  finitePositive(width,"width");finitePositive(height,"height");
  if(!Array.isArray(radii)||radii.length!==4)
    throw new TypeError("Four radii required");
  const equal=radii.every(v=>near(v,radii[0]));
  const square=near(width,height);
  if(radii.every(v=>v<=1e-5))return square?"square":"rectangle";
  if(equal&&near(radii[0],Math.min(width,height)/2))
    return square?"circle":"capsule";
  return square?"square":"rounded-rectangle";
}
export function resolveGlassSurface({
  width,height,shape="auto",radii=[0,0,0,0],scale=1,
  layer=0,backdrop="scene",content="none",material="clear"
}={}){
  finitePositive(width,"width");finitePositive(height,"height");
  finitePositive(scale,"scale");
  if(!GLASS_SHAPES.includes(shape))throw new RangeError("Unknown glass shape");
  validateGlassMaterial(material);
  if(!GLASS_CONTENT_MODES.includes(content))throw new RangeError("Unknown content composition");
  if(!Number.isSafeInteger(layer)||layer<0)throw new RangeError("Invalid glass layer");
  if(!["scene","previous-layer"].includes(backdrop))
    throw new RangeError("Unknown glass backdrop dependency");
  if(backdrop==="previous-layer"&&layer===0)
    throw new RangeError("Previous-layer backdrop requires a positive layer");
  const physicalWidth=width*scale,physicalHeight=height*scale;
  const shapeRadii=(shape==="circle"||shape==="capsule")?
    Array(4).fill(Math.min(width,height)/2):
    shape==="rectangle"?[0,0,0,0]:radii;
  if(shape==="circle"&&!near(width,height))
    throw new RangeError("Circular glass requires equal width and height");
  if(shape==="square"&&!near(width,height))
    throw new RangeError("Square glass requires equal width and height");
  const resolved=normalizeGlassCornerRadii(shapeRadii,width,height);
  const radiiPx=resolved.map(r=>r*scale);
  const nativeMode=selectGlassSdfMode(radiiPx);
  const dimensions=Math.min(physicalWidth,physicalHeight);
  const inferred=classifyGlassShape(width,height,resolved);
  return Object.freeze({
    shape:shape==="auto"?inferred:shape,width:physicalWidth,
    height:physicalHeight,minDimension:dimensions,
    radii:Object.freeze(radiiPx),radius:radiiPx[0],
    nativeMode,
    // Mode 6 is a BROWSER-ANALYTIC capsule/circle silhouette; its exact
    // Euclidean round ends are NOT an Oracle-proved Apple mode-6 route.
    // It uses the SAME refraction, LOD, tint and interaction material.
    renderMode:["capsule","circle"].includes(shape==="auto"?inferred:shape)?6:nativeMode,
    cornerLanes:Object.freeze(radiiPx.map(r=>
      -Math.max(GLASS_SDF_FLOOR,r))),
    layer,backdrop,content,material,source:GLASS_GEOMETRY_SOURCE,
    geometryScope:"finite native geometric relation + browser CSS normalization"
  });
}
export function resolveGlassOpticalGeometry(width,height){
  const d=Math.min(finitePositive(width,"width"),finitePositive(height,"height"));
  // The 10-case geometry_331 family in the Oracle, NOT the different
  // SwiftUI thin-Clear finite family; does not select universal filters.
  return Object.freeze({minDimension:d,
    innerAmount:Math.max(-60,-0.8*d),
    innerHeight:Math.min(20,0.25*d),
    outerAmount:0.2*d,outerHeight:0.125*d,
    scope:GLASS_GEOMETRY_SOURCE});
}
/**
 * Bounded 25F80/M2 native SwiftUI Clear CAFilter INPUT geometry,
 * not a universal final Metal or displayed-pixel model.
 * At 58.5pt: innerAmount=-58.5pt, innerHeight=20pt,
 * outerAmount=0, filter blur radius=5.729166666666667.
 * At 75pt: innerAmount=-60pt, innerHeight=20pt, blur=6.875.
 * The intermediate height slope is a browser projection also
 * supported by 16..23pt thin-Clear finite native controls.
 * Oracle evidence: E-P-SWIFTUI-SHAPE-GEOMETRY-FINITE.
 */
export function projectFiniteNativeClearGlass(width,height){
 const d=Math.min(finitePositive(width,"width"),finitePositive(height,"height"));
 const observed=[58.5,75].some(x=>near(x,d));
 return Object.freeze({
   minDimension:d,
   innerAmount:Math.max(-60,-d),
   innerHeight:Math.min(20,0.36*d),
   outerAmount:0,outerHeight:0,
   nativeInputBlurRadius:Math.min(10,Math.max(5,5+((d-48)/72)*5)),
   nativeInputLayerScale:0.5,
   scope:observed?"observed native Clear scalar endpoints":
     "browser interpolation, native universal producer unproved",
   evidenceId:"E-P-SWIFTUI-SHAPE-GEOMETRY-FINITE"
 });
}
export function glassContainsPoint(rect,radii,x,y){
  if(!Array.isArray(rect)||rect.length!==4||!Number.isFinite(x)||!Number.isFinite(y))
    return false;
  const [left,top,w,h]=rect;
  if(!(w>0&&h>0)||x<left||x>left+w||y<top||y>top+h)return false;
  if(!Array.isArray(radii)||radii.length!==4)return true;
  const [tl,tr,br,bl]=radii.map(r=>Math.max(0,Number.isFinite(r)?r:0));
  const dx=x-left,dy=y-top;
  if(dx<tl&&dy<tl)return (dx-tl)**2+(dy-tl)**2<=tl*tl;
  if(dx>w-tr&&dy<tr)return (dx-(w-tr))**2+(dy-tr)**2<=tr*tr;
  if(dx>w-br&&dy>h-br)return (dx-(w-br))**2+(dy-(h-br))**2<=br*br;
  if(dx<bl&&dy>h-bl)return (dx-bl)**2+(dy-(h-bl))**2<=bl*bl;
  return true;
}
export function glassSpring(value,velocity,target,dt,rate){
  const offset=value-target,j=velocity+rate*offset;
  const decay=Math.exp(-rate*clamp(dt,0,.05));
  return [target+(offset+j*clamp(dt,0,.05))*decay,
    (velocity-rate*j*clamp(dt,0,.05))*decay];
}
export function classifyGlassContent({text=false,icon=false,flat=false,silhouette=false}={}){
  if(silhouette)return "silhouette";
  const count=Number(Boolean(text))+Number(Boolean(icon))+Number(Boolean(flat));
  return count>1?"mixed":icon?"icon":flat?"flat":text?"text":"none";
}
export function surfaceContentFromElement(element){
  if(!element||typeof element.querySelector!=="function")return "none";
  const silhouette=element.dataset?.publicProjectGlass==="title"||
    element.hasAttribute("data-glass-silhouette");
  const icon=Boolean(element.querySelector("svg,img,[data-glass-icon]"));
  const flat=Boolean(element.querySelector("[data-glass-flat],canvas"));
  const text=Boolean(element.textContent?.trim())||
    element.matches?.("input,textarea");
  return classifyGlassContent({text,icon,flat,silhouette});
}
export function planGlassLayers(layers){
  if(!Array.isArray(layers))throw new TypeError("Layer array required");
  // Multiple independent surfaces in the same layer refract the same
  // parent backdrop. A layer may sample only the PREVIOUS completed layer,
  // preventing recursive GPU read/write feedback.
  const sorted=layers.map((item,index)=>{
    const layer=item.layer??0,backdrop=item.backdrop??"scene";
    if(!Number.isSafeInteger(layer)||layer<0||
       !["scene","previous-layer"].includes(backdrop))
      throw new RangeError("Invalid layer declaration");
    if(backdrop==="previous-layer"&&layer===0)
      throw new RangeError("Layer zero cannot sample itself");
    return {...item,layer,backdrop,_insertionIndex:index};
  }).sort((a,b)=>a.layer-b.layer||a._insertionIndex-b._insertionIndex);
  for(const item of sorted){
    if(item.backdrop==="previous-layer"&&
       !sorted.some(other=>other.layer===item.layer-1))
      throw new RangeError("Missing previous glass layer");
  }
  return Object.freeze(sorted.map(({_insertionIndex,...item})=>Object.freeze(item)));
}
export function glassPaneNeedsLiveTransform(role){
  return role==="search-field"||role==="filter-dropdown";
}

// Presentation timing only: match WGSL vsGlass smoothstep and scale.
export function glassEntrance(seconds,delay=0){
  const t=clamp((seconds-delay)/.4,0,1);
  const alpha=t*t*(3-2*t);
  return {alpha,scale:.85+.15*alpha};
}

/** Cull only coverage work whose entire owner quad is outside BOTH the
 * presentation canvas and the completed optical underlay. The vertex shader
 * expands the quad during dismissal; use its identical bloom envelope.
 * Coordinates are physical pixels, with the underlay in route-local space.
 * Never change a visible pixel, optical source, or surface geometry. */
export function glassPaneIntersectsViewport(rect,width,height,underlayOffset=0,underlayHeight=height,dismiss=0){
 const [x,y,w,h]=rect;
 const t=Math.min(1,Math.max(0,dismiss)),b=t*t*(3-2*t);
 const dx=w*.085*b*.5,dy=h*.065*b*.5;
 return w>0&&h>0&&x+w+dx>=0&&x-dx<=width&&
   y+h+dy>=Math.min(0,underlayOffset)&&y-dy<=Math.max(height,underlayOffset+underlayHeight);
}
