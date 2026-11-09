/*
 * Evidence-driven browser backdrop adapter for the 25F80/M2/G14G Oracle.
 *
 * This module NEVER duplicates, snapshots, or rasterizes the page background.
 * Chrome's SVG backdrop-filter receives SourceGraphic from the actual DOM
 * backdrop. Only a DISPLACEMENT FIELD (not backdrop pixels) is generated here.
 *
 * Direct AIR evidence:
 *  - glass_background_sdf_no_bleed_lph.ssa.json.gz:
 *      source lines 30–43: SDF coverage saturate(.5-d/max(fwidth(d),half(.0001)))
 *      lines 256–271: inner refraction - amount * sqrt(t*(2-t)),
 *                     t=saturate(-signedDistance*invHeight)
 *      lines 352–366: the same envelope for outer refraction
 *      lines 405–417: threshold blend saturated over threshold0..threshold1
 *  - supercircle_sdf, source lines 1062–1154: geometric field polynomial,
 *    shape mixing and square/supercircle distance terms, ported below.
 *  - Uniform fields and finite values: public finite-domain contract.
 *  - Native public regular-style radius: 52 held-out exact Double cases.
 *
 * Non-equivalent browser stages: Gaussian instead of Metal mipmap sampling,
 * SVG displacement sampling instead of Apple's G14G texture pipeline,
 * full output-color/EDR Q stage (open), and unproven public scale paths.
 */

export const ORACLE_TARGET = Object.freeze({
  build:"25F80",cpu:"Apple M2",gpu:"G14G",shader:"glass_background_sdf_no_bleed_lph"
});
/*
 * A SINGLE observed 264-byte SDF48+Glass216 live LPH binding, rather than
 * the invalid combination of separately projected 331-case marginal modes.
 * Oracle: live_blur_dataflow.json.xz / diagnostic_m1_b4.75_z1.0,
 * index1 pass148 seq4208. Same joint material signature in 24 uploads.
 * This is a FINITE PRIVATE diagnostic, not a universal public regular state.
 * The public regular-radius→blur-word path below is separate, and composing
 * the two is a documented browser-adapter assumption.
 */
export const ORACLE_FINITE_REFRACTION = Object.freeze({
  sourceCase:"diagnostic_m1_b4.75_z1.0",
  sourceFragment:"glass_background_sdf_no_bleed_lph",
  innerAmount:Math.fround(-44.79999923706055),
  innerInvHeight:Math.fround(0.0714285746216774),
  outerAmount:Math.fround(11.199999809265137),
  outerInvHeight:Math.fround(0.1428571492433548),
  threshold0:Math.fround(-1),
  threshold1:Math.fround(-.5),
  opacity:0.300048828125,
  faceOpacity:1,
  shadowOpacity:0.389404296875,
  shadowFaceOpacity:Math.fround(0.09142857044935226),
  holdingToneOpacity:1,
  blurAlpha:Object.freeze([1,.5,0,-.5]),
  blurDist:Object.freeze([-28,-1,0,0]),
  // Actual half4 rows (RGB coefficient + bias), NOT a stylistic tint.
  faceMatrix:Object.freeze([
    Object.freeze([0.646484375,-0.3486328125,-0.03515625,0.07501220703125]),
    Object.freeze([-0.1036376953125,0.4013671875,-0.03521728515625,0.07501220703125]),
    Object.freeze([-0.10369873046875,-0.3486328125,0.71484375,0.07501220703125])
  ]),
  surfaceScale:Math.fround(.25),
  cpuScaleMultiplier:Math.fround(1.6)
});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const mix=(a,b,t)=>a+(b-a)*t;
const f32=Math.fround;

export function nativePublicBlurRadius(style,width,height){
  if(style!=="regular"&&style!=="clear")throw new RangeError("Only public regular/clear styles");
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<0||height<0)
    throw new RangeError("Nonnegative finite public frame dimensions required");
  // Exact Double operation order from 52 independent held-out public cases;
  // not a universal upstream source theorem.
  const m=Math.min(width,height);
  return style==="regular"
    ? Math.min(4,Math.max(2,2+((m-48)/112)*2))
    : Math.min(10,Math.max(5,5+((m-48)/72)*5));
}

/*
 * SIDEBAR-ONLY FINITE PROJECTION — not a new native Metal observation.
 * 52 independent public radius readbacks + 25 finite native renderer
 * factor=0x3ecccccd/override=0 witnesses + eight separate exact encoder
 * joins. The 74/260/274px cross-product has NOT been replayed in native
 * LLDB; user-facing geometry is mapped to the observed finite factor.
 * See preview/oracle-evidence/sidebar_blur_scale_finite.json.
 */
export const ORACLE_SIDEBAR_FINITE_FACTOR = Math.fround(.4);
export function sidebarFiniteBlurProjection(style,width,height){
  const radius=nativePublicBlurRadius(style,width,height);
  const word=Math.fround(Math.fround(radius)*ORACLE_SIDEBAR_FINITE_FACTOR);
  return {radius,word,factor:ORACLE_SIDEBAR_FINITE_FACTOR};
}

export function observedBlurWord(radius,transformScale=1,surfaceScale=.25){
  if(![radius,transformScale,surfaceScale].every(Number.isFinite))
    throw new TypeError("Finite numeric inputs required");
  // f32(f32(key164) * f32(f32(transform*surface)*1.6f32)).
  return f32(f32(radius)*f32(f32(transformScale*surfaceScale)*f32(1.6)));
}

export function airRefractionEnvelope(distance,amount,invHeight){
  if(![distance,amount,invHeight].every(Number.isFinite))
    throw new TypeError("Finite AIR operands required");
  // AIR background base 25F80 LPH lines 256–270 / 352–365.
  const t=clamp(f32(f32(-distance)*f32(invHeight)),0,1);
  const reduction=clamp(f32(Math.sqrt(f32((2-t)*t))),0,1);
  return f32(f32(amount)-f32(f32(reduction)*f32(amount)));
}

export function airThresholdMix(distance,threshold0=-1,threshold1=-.5,opacity=.3){
  if(threshold0===threshold1)throw new RangeError("Zero AIR threshold interval");
  // AIR lines 409–417: saturate(fma(distance,1/(b-a), -a/(b-a))).
  return f32(f32(opacity)*clamp((distance-threshold0)/(threshold1-threshold0),0,1));
}

/*
 * AIR base lines 290–321: blur_alpha0 minus the dot product of the remaining
 * three alphas and saturated signed-distance interpolation ramps.
 * The pair blur_dist2=blur_dist3=0 creates a singular interval in the captured
 * uniform state; comparisons follow the shader's ordered f32 saturation path
 * with zero/NaN treated as zero at that exact point.
 */
export function airBlurDistribution(distance,material=ORACLE_FINITE_REFRACTION){
  const alpha=material.blurAlpha,dist=material.blurDist;
  if(!Number.isFinite(distance))throw new TypeError("Finite SDF required");
  let sum=0;
  for(let i=0;i<3;i++){
    const span=dist[i+1]-dist[i];
    const ratio=span===0?
      (distance>dist[i]?Infinity:distance<dist[i]?-Infinity:NaN):
      (distance-dist[i])/span;
    const fraction=Number.isNaN(ratio)?0:clamp(ratio,0,1);
    sum+=alpha[i+1]*fraction;
  }
  return f32(alpha[0]-sum);
}

/* AIR lines 329–337 / 388–396 / 443–452: mip LOD is log2(
   t<2 ? 1+0.5*t : t ), clamped to >=0. Browser's Gaussian footprint
   below is a separate approximation of this exact Metal-mipmap LOD. */
export function airTextureMipLOD(blurWord,distribution){
  if(!Number.isFinite(blurWord)||!Number.isFinite(distribution))
    throw new TypeError("Finite blur parameters required");
  const t=f32(f32(blurWord)*f32(distribution));
  const sample=t<2?f32(f32(.5*t)+1):t;
  return Math.max(0,Math.log2(sample));
}

export function oracleFaceColorMatrixValues(material=ORACLE_FINITE_REFRACTION){
  // SVG 4×5 rows multiply UNPREMULTIPLIED browser sRGB RGBA. Native target
  // uses half4 rows and a separate extended-sRGB/Q pipeline; exact source
  // coefficients, non-equivalent working/output color behavior.
  const [r,g,b]=material.faceMatrix;
  return [
    r[0],r[1],r[2],0,r[3],
    g[0],g[1],g[2],0,g[3],
    b[0],b[1],b[2],0,b[3],
    0,0,0,1,0
  ].join(" ");
}

/*
 * Do not apply the retained PRIVATE m1 diagnostic face matrix as if it
 * described the public regular-style sidebar. The native matrix is intact in
 * oracleFaceColorMatrixValues() for source tests, but the appropriate public
 * color-selection and Q/output path have not been captured. We must pass
 * the browser's actual backdrop colors through unchanged instead of
 * implicitly darkening them using a matrix from an unrelated material.
 * This is an explicitly uncalibrated color-stage bypass, not a claim that
 * native Liquid Glass uses an identity matrix.
 */
export const SIDEBAR_PUBLIC_COLOR_PASSTHROUGH =
  "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0";

/*
 * Transcription of retained _ZN2CA3OGL5Metal12ShaderUtils_IDhE15supercircle_sdf...
 * for the mode4 finite SDF path. The constants are decoded EXACTLY from
 * LLVM/AIR f64 literals, not artist-chosen. Native GPU half precision is
 * not formally equivalent; this JS path computes in float32 at recorded
 * float sites and may differ by half-ULPs at intermediate operations.
 */
export function airSupercircleSDF(absX,absY,halfWidth,halfHeight,radius,blendX=0,blendY=0){
  if(![absX,absY,halfWidth,halfHeight,radius,blendX,blendY].every(Number.isFinite))
    throw new TypeError("Finite SDF operands required");
  // AIR supercircle_sdf source line 1062 takes fast_fabs(radius).
  // Negative radii are legitimate mode5 corner lanes, NOT a switch to a
  // normal-less rectangle. Keep their sign only for mode5's preceding
  // per-corner blend-factor selection.
  if(radius===0)return {distance:Math.max(absX-halfWidth,absY-halfHeight),
    nx:absX>=halfWidth?1:0,ny:absY>=halfHeight?1:0};
  const ar=f32(Math.abs(radius));
  const k=f32(ar*1.5286649465560913);
  const qx=f32(absX-halfWidth), qy=f32(absY-halfHeight);
  const cornerAdj=mix(k,ar,Math.max(blendX,blendY));
  const hX=f32(qx+cornerAdj),hY=f32(qy+cornerAdj);
  const nx0=Math.max(0,f32(f32(qx+k)/k)),ny0=Math.max(0,f32(f32(qy+k)/k));
  const rad=Math.hypot(nx0,ny0);
  const big=Math.max(nx0,ny0),small=Math.min(nx0,ny0);
  const u=big===0?0:clamp(small/big,0,1);
  const polynomial =
    (((3.1560099124908447-u*.9260540008544922)*u
    -3.6412200927734375)*u+1.268030047416687)*u
    +.2685309946537018;
  const denom=1-u*u*clamp(rad,0,1)*polynomial;
  const rounded=rad+1-(denom===0?0:1/denom);
  const q2x=Math.max(0,f32(nx0*1.5286649465560913-.5286650061607361));
  const q2y=Math.max(0,f32(ny0*1.5286649465560913-.5286650061607361));
  const smooth=Math.hypot(q2x,q2y)*.6541655659675598+.3458344340324402;
  const a=mix(rounded,smooth,blendX);
  const b=mix(rounded,smooth,blendY);
  const sign=ny0>nx0?1:-1;
  const control=clamp(.5-sign+sign*u,0,1);
  const signed= f32(k*f32(mix(a,b,control)-1));
  const dist=f32(Math.min(Math.max(hX,hY),0)+signed);
  const normalX=Math.max(hX,0),normalY=Math.max(hY,0);
  const len=Math.hypot(normalX,normalY);
  const vx=len>0?normalX/len:(hX>hY?1:0);
  const vy=len>0?normalY/len:(hX>hY?0:1);
  return {distance:dist,nx:vx,ny:vy};
}

/*
 * Actual LPH compute_sdf_with_mode(mode5), AIR source lines 940–1041.
 * One PRIVATE CPU SDF48 contains [halfWidth,halfHeight,5,normalBlend],
 * the 2x2 transform, and FOUR SIGNED corner radii.
 *
 * The four calls are in the exact AIR order:
 *   ( x, y, r1), (-x, y, r0), ( x,-y, r2), (-x,-y, r3)
 * and their signed distances combine via ORDERED max selection, with
 * mirrored normals. This does not assert universal public CSS→SDF mapping.
 * Native G14G half-precision/transcendental equivalence is still unproved.
 */
export function airMode5SDF(x,y,halfWidth,halfHeight,signedCornerRadii,
  normalBlend=0){
  const [r0,r1,r2,r3]=signedCornerRadii;
  if(![x,y,halfWidth,halfHeight,r0,r1,r2,r3,normalBlend].every(Number.isFinite))
    throw new TypeError("Finite mode5 SDF inputs required");
  if(halfWidth<=0||halfHeight<=0)throw new RangeError("Positive SDF half-dimensions");
  // Exact AIR f32 blend weights source lines 943–954. Only the private
  // retained examples establish these negative radii, not CSS corner writer.
  const pair=[
    f32(f32(f32(r0+r1)*.5)),
    f32(f32(f32(r0+r3)*.5)),
    f32(f32(f32(r3+r2)*.5)),
    f32(f32(f32(r1+r2)*.5))
  ];
  const dims=[halfWidth,halfHeight,halfWidth,halfHeight];
  const factors=pair.map((mid,i)=>{
    if(mid>=0)return 1;
    const ratio=f32(f32(dims[i])/mid);
    return clamp(f32(f32(-1.5286649465560913-ratio)*
      f32(-1.891557216644287)),0,1);
  });
  // y uses Cartesian positive-up, matching the native centered SDF.
  const specs=[
    [x,y,r1,factors[0],factors[3],1,1],
    [-x,y,r0,factors[0],factors[1],-1,1],
    [x,-y,r2,factors[2],factors[3],1,-1],
    [-x,-y,r3,factors[2],factors[1],-1,-1]
  ];
  let choice=null;
  for(const [cx,cy,r,bx,by,sx,sy] of specs){
    const value=airSupercircleSDF(cx,cy,halfWidth,halfHeight,r,bx,by);
    const candidate={
      distance:value.distance,
      nx:value.nx*sx,ny:value.ny*sy
    };
    if(!choice||candidate.distance>choice.distance)choice=candidate;
  }
  // AIR lines 994–1022: when arg.w>0, blend selected supercircle normal
  // with normalize([x,(halfWidth/halfHeight)*y]), then normalize again.
  if(normalBlend!==0){
    const sy=f32(f32(halfWidth*y)/halfHeight);
    const len=Math.hypot(x,sy);
    const bx=len>0?x/len:0,by=len>0?sy/len:0;
    const vx=mix(choice.nx,bx,normalBlend);
    const vy=mix(choice.ny,by,normalBlend);
    const normalized=Math.hypot(vx,vy);
    choice.nx=normalized>0?vx/normalized:0;
    choice.ny=normalized>0?vy/normalized:0;
  }
  return choice;
}

/* Native private mode5 uses NEGATIVE signed corner radii. The sidebar's
 * public browser CSS has ZERO left corners and rounded right corners.
 * Use the retained private-lane minimum f32(0.01) for the zero-corner
 * adapter. The final two native static floor values are not retained and
 * this is not an identified Apple public-CSS producer relationship. */
export const ORACLE_CORNER_FLOOR = Math.fround(.009999999776482582);

const SVG="http://www.w3.org/2000/svg";
const NS="http://www.w3.org/1999/xlink";
const attribute=(el,attrs)=>{for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
function makeSVG(doc,tag,attrs){return attribute(doc.createElementNS(SVG,tag),attrs);}

/*
 * A browser CSS adaptation of the actual mode5 FOUR-CORNER AIR route.
 * SDF arg2 order is [top-left, top-right, bottom-right, bottom-left]
 * for our positive-up native coordinate mapping. Native values are signed
 * negative and the first two lanes are clamped to 0.01 in the private
 * representation. Do not claim the other floors or CSS producer are exact.
 */
export function paneField(x,y,w,h,radius){
  const px=x-w*.5,py=h*.5-y;
  const left=-ORACLE_CORNER_FLOOR;
  const right=-Math.max(ORACLE_CORNER_FLOOR,radius);
  const shape=airMode5SDF(px,py,w*.5,h*.5,[left,right,right,left]);
  return {distance:shape.distance,nx:shape.nx,ny:-shape.ny};
}

/* SVG displacement uses scale*(channel - 0.5); an 8-bit PNG cannot encode
 * 0.5 exactly. The historical round(255*(0.5 + v/128)) encoded v=0 as 128,
 * which decodes to a spurious +128/(2*255) pixel displacement. Round the
 * SIGNED offset around byte 128 instead, and compensate the fixed 8-bit
 * center bias in the feColorMatrix immediately before feDisplacementMap.
 *
 * This keeps the bound <= 128/(2*255) pixels for each component, but makes
 * truly zero native-derived displacement EXACTLY zero. No blur/material
 * coefficient or four-corner SDF expression changes.
 */
export const SVG_DISPLACEMENT_NEUTRAL_BIAS = 1/(2*255);
export function encodeOracleDisplacement(v){
  if(!Number.isFinite(v))throw new TypeError("Finite displacement required");
  return Math.min(255,Math.max(0,128+Math.round(v*255/128)));
}
export function decodeOracleDisplacement(encoded){
  if(!Number.isInteger(encoded)||encoded<0||encoded>255)
    throw new RangeError("An 8-bit displacement sample is required");
  return (encoded-128)*128/255;
}

export function generateOracleField(w,h,radius,parameters=ORACLE_FINITE_REFRACTION){
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>6000000)
    throw new RangeError("Invalid filter field dimensions");
  const width=Math.round(w),height=Math.round(h);
  const inner=new Uint8ClampedArray(width*height*4);
  const outer=new Uint8ClampedArray(width*height*4);
  const blurMask=new Uint8ClampedArray(width*height*4);
  const encode=encodeOracleDisplacement;
  // All bounds derived from the CAPTURED inverse refraction heights and
  // blur distance0, not an arbitrary 28px visual cut-off.
  const activeSpan=Math.max(
    Math.abs(parameters.blurDist[0]),
    1/parameters.innerInvHeight,
    1/parameters.outerInvHeight);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const dst=Math.min(x,width-x-.5,y,height-y-.5);
    // The actual mode5 SDF is a FOUR-corner shape. The previous x<width/2
    // shortcut erased every displacement sample in the left half of the
    // pane, even at its upper/lower outline; that shortcut has no AIR
    // provenance. Keep only the proven distance-domain optimization.
    if(dst>activeSpan){
      inner[i]=outer[i]=128;
      inner[i+1]=outer[i+1]=128;
      inner[i+2]=outer[i+2]=0;
      inner[i+3]=outer[i+3]=255;
      // No edge weighting; far field uses the deep mip/blur level.
      blurMask[i]=blurMask[i+1]=blurMask[i+2]=0;
      blurMask[i+3]=255;
      continue;
    }
    const p=paneField(x+.5,y+.5,width,height,radius);
    // AIR produces the refraction coefficient from signed distance.
    // Native displacement_mat converts normal to texture coordinates.
    // Pixel-space identity here is the browser adapter's explicit mapping.
    const innerAmount=airRefractionEnvelope(p.distance,
      parameters.innerAmount,parameters.innerInvHeight);
    const outerAmount=airRefractionEnvelope(p.distance,
      parameters.outerAmount,parameters.outerInvHeight);
    const mx=airThresholdMix(p.distance,
      parameters.threshold0,parameters.threshold1,parameters.opacity);
    inner[i]=encode(p.nx*innerAmount);
    inner[i+1]=encode(p.ny*innerAmount);
    outer[i]=encode(p.nx*outerAmount);
    outer[i+1]=encode(p.ny*outerAmount);
    inner[i+2]=outer[i+2]=Math.round(clamp(mx,0,1)*255);
    inner[i+3]=outer[i+3]=255;
    // AIR background base LPH source lines 271/290–321 and 366/370–381:
    // blur_alpha ramps consume REFRACTION-ADJUSTED SDF distance, not the
    // original signed distance. The two texture reads have distinct LOD.
    const innerDistance=f32(p.distance+innerAmount);
    const outerDistance=f32(p.distance+outerAmount);
    const innerDistribution=airBlurDistribution(innerDistance,parameters);
    const outerDistribution=airBlurDistribution(outerDistance,parameters);
    // The near/far Gaussian interpolation is a browser mip approximation.
    // R controls inner-path near blur, G controls outer-path near blur.
    const innerNear=clamp((1-innerDistribution)/.5,0,1);
    const outerNear=clamp((1-outerDistribution)/.5,0,1);
    blurMask[i]=Math.round(255*innerNear);
    blurMask[i+1]=Math.round(255*outerNear);
    blurMask[i+2]=Math.round(255*innerNear);
    blurMask[i+3]=255;
  }
  return {width,height,inner,outer,blurMask};
}


/*
 * Lossless WIDTH-ONLY transport of the exact mode5 browser field.
 *
 * Proof domain: current square-left / rounded-right sidebar; normalBlend=0,
 * 74 <= width <= 260, fixed height and the 24px DESKTOP corner radius.
 * AIR four-corner selection is translation invariant within each half of
 * the pane: left-source x=x, right-source x=baseWidth-(width-x).
 * This is NOT the rejected y-invariant nine-slice shortcut. Every Y row is
 * copied independently, including full corner/SDF variation. Never stretch
 * maps or interpolate the parameters; the resulting RGBA bytes must equal
 * generateOracleField(width,height,radius).
 */
export function projectOracleFieldWidth(base,width,radius){
  const w=Math.round(width),baseW=base?.width,h=base?.height;
  if(!(radius===24&&Number.isInteger(w)&&w>=74&&w<=260&&
    Number.isInteger(baseW)&&baseW===260&&
    Number.isInteger(h)&&h>=1))
    throw new RangeError("Width projection outside supported sidebar domain");
  const left=Math.ceil(w/2),right=w-left;
  const project=source=>{
    if(source?.length!==baseW*h*4)throw new RangeError("Invalid baseline field length");
    const out=new Uint8ClampedArray(w*h*4),stride=w*4,baselineStride=baseW*4;
    for(let y=0;y<h;y++){
      const start=y*baselineStride,dst=y*stride;
      out.set(source.subarray(start,start+left*4),dst);
      out.set(source.subarray(start+(baseW-right)*4,start+baselineStride),dst+left*4);
    }
    return out;
  };
  return {width:w,height:h,inner:project(base.inner),
    outer:project(base.outer),blurMask:project(base.blurMask)};
}

function imageDataURL(win,buffer,width,height){
  const c=win.document.createElement("canvas");
  c.width=width;c.height=height;
  const ctx=c.getContext("2d",{willReadFrequently:false});
  if(!ctx)return null;
  const img=ctx.createImageData(width,height);
  img.data.set(buffer);
  ctx.putImageData(img,0,0);
  return c.toDataURL("image/png");
}

/* Predict desktop CSS width transitions at common 60Hz sample times.
 * This function guesses CANDIDATE widths only; every generated field still
 * comes from the exact byte-preserving oracle worker. Both directions must
 * be included: collapse widths are not the expansion widths.
 * No backdrop pixels, source-dependent data, or optical coefficients here.
 */
export function predictSidebarMotionWidths(learned=[]){
  function bezier(t,a,b){const u=1-t;return 3*u*u*t*a+3*u*t*t*b+t*t*t;}
  function valueAt(progress){
    let low=0,high=1;
    for(let iteration=0;iteration<24;iteration++){
      const mid=(low+high)/2;
      if(bezier(mid,.2,.2)<progress)low=mid;else high=mid;
    }
    return bezier((low+high)/2,.8,1);
  }
  const widths=new Set();
  for(let ms=1000/60;ms<210;ms+=1000/60){
    const t=valueAt(ms/210);
    // Same 210ms CSS cubic-bezier(.2,.8,.2,1), reversed endpoints.
    const expand=Math.round(74+186*t);
    const collapse=Math.round(260-186*t);
    for(const center of [expand,collapse]){
      if(center>74&&center<260)widths.add(center);
      if(ms>170){
        if(center>75)widths.add(center-1);
        if(center<259)widths.add(center+1);
      }
    }
  }
  return [...new Set([...learned,...widths])].filter(w=>
    Number.isInteger(w)&&w>74&&w<260);
}

export function mountOracleBackdrop({doc=document,win=window,shell,sidebar}){
  if(!shell||!sidebar)throw Error("Genuine /app sidebar required");
  const reduced=win.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches ||
    win.matchMedia?.("(forced-colors: active)")?.matches ||
    win.matchMedia?.("(prefers-contrast: more)")?.matches;
  const id="oracle-glass-native-backdrop";
  let disposed=false,queued=0,delay=0,previous="",usingSVG=false;
  const svg=makeSVG(doc,"svg",{"aria-hidden":"true",focusable:"false"});
  svg.classList.add("oracle-filter-defs");
  const defs=makeSVG(doc,"defs",{});
  const filter=makeSVG(doc,"filter",{id,x:"0%",y:"0%",width:"100%",height:"100%",
    filterUnits:"objectBoundingBox",primitiveUnits:"userSpaceOnUse",
    "color-interpolation-filters":"sRGB"});
  /*
   * Blur is genuinely sourced from the live DOM backdrop. The two sampled
   * spatial scales approximate the retained Metal LODs (not identical to
   * Apple's texture pipeline); AIR alpha/dist ramps choose between them.
   */
  const blurFar=makeSVG(doc,"feGaussianBlur",{
    in:"SourceGraphic",stdDeviation:"4",result:"farBlur"});
  const blurNear=makeSVG(doc,"feGaussianBlur",{
    in:"SourceGraphic",stdDeviation:"2",result:"nearBlur"});
  const blurMap=makeSVG(doc,"feImage",{result:"blurMap",x:0,y:0,
    width:260,height:800,preserveAspectRatio:"none"});
  // A single geometry-only PNG holds the two independently evaluated
  // AIR blur-distance ramps: red=inner, green=outer.
  const innerNearAlpha=makeSVG(doc,"feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0",result:"innerNearCoverage"});
  const outerNearAlpha=makeSVG(doc,"feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0",result:"outerNearCoverage"});
  const innerNearPart=makeSVG(doc,"feComposite",{
    in:"nearBlur",in2:"innerNearCoverage",operator:"in",result:"innerNearPart"});
  const innerFarPart=makeSVG(doc,"feComposite",{
    in:"farBlur",in2:"innerNearCoverage",operator:"out",result:"innerFarPart"});
  // AIR samples and linearly interpolates colors. The premultiplied
  // in/out parts below ALREADY sum to one full-coverage image. A Porter-Duff
  // "over" double-applies 1-alpha to the far branch and loses opacity.
  // SVG arithmetic (k1=0,k2=k3=1,k4=0) adds the complementary parts.
  // This corrects compositing algebra; it does not claim an Apple Q color path.
  const innerBlur=makeSVG(doc,"feComposite",{
    in:"innerNearPart",in2:"innerFarPart",operator:"arithmetic",k2:1,k3:1,result:"innerBlurred"});
  const outerNearPart=makeSVG(doc,"feComposite",{
    in:"nearBlur",in2:"outerNearCoverage",operator:"in",result:"outerNearPart"});
  const outerFarPart=makeSVG(doc,"feComposite",{
    in:"farBlur",in2:"outerNearCoverage",operator:"out",result:"outerFarPart"});
  const outerBlur=makeSVG(doc,"feComposite",{
    in:"outerNearPart",in2:"outerFarPart",operator:"arithmetic",k2:1,k3:1,result:"outerBlurred"});
  const innerMap=makeSVG(doc,"feImage",{result:"innerMap",x:0,y:0,
    width:260,height:800,preserveAspectRatio:"none"});
  const outerMap=makeSVG(doc,"feImage",{result:"outerMap",x:0,y:0,
    width:260,height:800,preserveAspectRatio:"none"});
  // SVG channel center 0.5 lies BETWEEN PNG bytes 127 and 128.
  // Correct the exact 128-byte neutral code WITHOUT shifting the backdrop:
  // the R/G components are now ((byte-128)/255 + 0.5). Other channels and
  // masks are unchanged; native-derived displacement equations are intact.
  const neutralValues=`1 0 0 0 -${SVG_DISPLACEMENT_NEUTRAL_BIAS} `+
    `0 1 0 0 -${SVG_DISPLACEMENT_NEUTRAL_BIAS} `+
    "0 0 1 0 0  0 0 0 1 0";
  const innerCentered=makeSVG(doc,"feColorMatrix",{
    in:"innerMap",type:"matrix",values:neutralValues,result:"innerCentered"});
  const outerCentered=makeSVG(doc,"feColorMatrix",{
    in:"outerMap",type:"matrix",values:neutralValues,result:"outerCentered"});
  const innerDist=makeSVG(doc,"feDisplacementMap",{in:"innerBlurred",in2:"innerCentered",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"innerShift"});
  const outerDist=makeSVG(doc,"feDisplacementMap",{in:"outerBlurred",in2:"outerCentered",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"outerShift"});
  const mask=makeSVG(doc,"feColorMatrix",{in:"innerMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",result:"outerBlendMask"});
  const maskedOuter=makeSVG(doc,"feComposite",{in:"outerShift",in2:"outerBlendMask",
    operator:"in",result:"outerPart"});
  const maskedInner=makeSVG(doc,"feComposite",{in:"innerShift",in2:"outerBlendMask",
    operator:"out",result:"innerPart"});
  const join=makeSVG(doc,"feComposite",{
    in:"outerPart",in2:"innerPart",operator:"arithmetic",k2:1,k3:1,result:"composited"});
  // The m1 PRIVATE diagnostic face matrix is a legitimate source value,
  // but not the proven PUBLIC regular-style color/material selection.
  // Applying it across arbitrary browser sRGB page content darkened the
  // entire sidebar. Preserve original backdrop colors until a matching
  // public-state/Q mapping exists; keep the diagnostic matrix separately
  // available for evidence tests.
  const face=makeSVG(doc,"feColorMatrix",{
    in:"composited",type:"matrix",
    values:SIDEBAR_PUBLIC_COLOR_PASSTHROUGH,result:"faceMaterial"});
  filter.append(blurFar,blurNear,blurMap,innerNearAlpha,outerNearAlpha,
    innerNearPart,innerFarPart,innerBlur,outerNearPart,outerFarPart,outerBlur,
    innerMap,outerMap,innerCentered,outerCentered,innerDist,outerDist,mask,maskedOuter,maskedInner,
    join,face);
  defs.append(filter);svg.append(defs);doc.body.append(svg);
  const supported=!!win.CSS?.supports?.("backdrop-filter",'url("#'+id+'")');
  const canUse=!!supported&&!reduced;

  /*
   * Exact field math is still generateOracleField(), unchanged. Dedicated
   * module Worker execution moves the expensive mode5 four-corner evaluation
   * off the UI thread. A single in-flight request coalesces intermediate
   * resize widths; the latest actual dimensions always win. Cache stores
   * identical encoded field bytes for repeat sizes, never a resampled field.
   * The synchronous path is retained when Worker execution is unavailable.
   */
  const geometryCache=new Map();
  // Retain bounded exact geometry-only PNGs (no webpage pixels). The
  // 32-entry LRU covers responsive endpoints and a selectively warmed path;
  // stale height-specific maps are retired when the window height changes.
  const CACHE_LIMIT=32;
  const SPECULATIVE_BURST=20, SPECULATIVE_TOTAL_LIMIT=24;
  let worker=null,workerBusy=false,desired=null,idleTimer=0;
  let anticipateWorker=null,anticipateTimer=0,anticipateQueue=[];
  let anticipateSignature="",anticipateCount=0,cacheHeight=0;
  const anticipatedKeys=new Set();
  const observedWidths=new Map();

  function expectedExpandWidths(){
    // Actual per-device widths come first after the first transition.
    const learned=[...observedWidths].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    return predictSidebarMotionWidths(learned);
  }
  function stopAnticipation(){
    if(anticipateTimer){win.clearTimeout(anticipateTimer);anticipateTimer=0;}
    try{anticipateWorker?.terminate();}catch{}
    anticipateWorker=null;
    anticipateQueue=[];
  }
  function armAnticipation(){
    if(disposed||!worker||!desired||desired.corner!==24||
       !(desired.w===74||desired.w===260)||
       shell.classList.contains("is-sidebar-toggling")||
       !win.matchMedia?.("(min-width: 761px)")?.matches){
      stopAnticipation();return;
    }
    const signature=desired.h+"@24";
    if(anticipateWorker&&anticipateSignature===signature)return;
    if(anticipateSignature!==signature){
      stopAnticipation();
      anticipateSignature=signature;
      anticipateCount=0;
      observedWidths.clear();
      anticipatedKeys.clear();
    }
    if(anticipateTimer||anticipateCount>=SPECULATIVE_TOTAL_LIMIT)return;
    anticipateTimer=win.setTimeout(()=>{
      anticipateTimer=0;
      if(disposed||!desired||desired.h+"@24"!==signature||
         shell.classList.contains("is-sidebar-toggling"))return;
      const queue=expectedExpandWidths().map(w=>({
        w,h:desired.h,corner:24,key:w+"x"+desired.h+"@24",prefetch:true
      })).filter(request=>!geometryCache.has(request.key))
        .slice(0,Math.min(SPECULATIVE_BURST,SPECULATIVE_TOTAL_LIMIT-anticipateCount));
      if(!queue.length)return;
      try{
        anticipateWorker=new win.Worker(
          new URL("./sidebar-glass-field-worker.js",import.meta.url),
          {type:"module",name:"oracle-field-prefetch"});
        anticipateQueue=queue;
        const sendNext=()=>{
          if(!anticipateWorker||disposed)return;
          const next=anticipateQueue.shift();
          if(!next){stopAnticipation();return;}
          try{anticipateWorker.postMessage(next);}
          catch{stopAnticipation();}
        };
        anticipateWorker.addEventListener("message",event=>{
          const response=event.data;
          if(disposed||!response||response.error||!response.urls||
             response.h+"@"+response.corner!==anticipateSignature){
            stopAnticipation();return;
          }
          cacheField(response,response.urls);
          anticipatedKeys.add(response.key);
          anticipateCount++;
          shell.dataset.oracleWarmFieldCount=String(anticipateCount);
          // A ready exact map can be committed BEFORE the next animation
          // paint without waiting for another rAF. This calls the SAME
          // reconciler; no stale map is blindly installed by a worker.
          if(desired?.key===response.key&&previous!==response.key)
            reconcileReady();
          sendNext();
        });
        anticipateWorker.addEventListener("error",stopAnticipation);
        sendNext();
      }catch{stopAnticipation();}
    },900);
  }
  let lastMaterialWord=NaN,lastInputRadius=NaN;
  // The SVG filter is one optical state: three width-exact mode5 fields
  // AND the finite public blur word computed from those same dimensions.
  // Never advance Gaussian sampling parameters ahead of a pending field.
  // This also skips expensive filter invalidations when the worker has not
  // yet produced the next exact map. No native constants are changed.
  function commitMaterial(w,h){
    const {radius,word}=sidebarFiniteBlurProjection("regular",w,h);
    if(radius!==lastInputRadius){
      shell.style.setProperty("--oracle-input-radius",radius+"px");
      lastInputRadius=radius;
    }
    if(word!==lastMaterialWord){
      const farLOD=airTextureMipLOD(word,1);
      const nearLOD=airTextureMipLOD(word,.5);
      const effective=word/ORACLE_FINITE_REFRACTION.surfaceScale;
      const nearSigma=effective*.5,farSigma=effective;
      shell.style.setProperty("--oracle-render-word",word+"px");
      shell.style.setProperty("--oracle-backdrop-blur",farSigma+"px");
      shell.style.setProperty("--oracle-mip-lod-near",String(nearLOD));
      shell.style.setProperty("--oracle-mip-lod-far",String(farLOD));
      blurFar.setAttribute("stdDeviation",String(farSigma));
      blurNear.setAttribute("stdDeviation",String(nearSigma));
      lastMaterialWord=word;
    }
  }
  function setMaps(request,urls){
    // Coherent optical commit in the SAME JavaScript task as the map update.
    commitMaterial(request.w,request.h);
    for(const [node,uri]of [[innerMap,urls[0]],[outerMap,urls[1]],[blurMap,urls[2]]]){
      if(node.getAttribute("href")!==uri){
        // Modern SVG feImage.href is supported in Chrome/WebKit/Firefox.
        // Writing both href AND xlink:href invalidates the backdrop input
        // twice for identical PNG bytes. Retain xlink for older engines only.
        node.setAttribute("href",uri);
        if(!("href" in node))node.setAttributeNS(NS,"xlink:href",uri);
      }
      if(node.getAttribute("width")!==String(request.w))
        node.setAttribute("width",String(request.w));
      if(node.getAttribute("height")!==String(request.h))
        node.setAttribute("height",String(request.h));
    }
    previous=request.key;
    usingSVG=true;
    if(!shell.classList.contains("has-oracle-backdrop"))
      shell.classList.add("has-oracle-backdrop");
  }
  function cacheField(request,urls){
    if(desired&&request.h!==desired.h)return;
    if(cacheHeight&&cacheHeight!==request.h){
      // A resized viewport invalidates the entire old-height PNG cohort.
      // No optical bytes are approximated or retained with wrong geometry.
      geometryCache.clear();
      anticipatedKeys.clear();
      observedWidths.clear();
    }
    cacheHeight=request.h;
    geometryCache.delete(request.key);
    geometryCache.set(request.key,urls);
    while(geometryCache.size>CACHE_LIMIT){
      const evicted=geometryCache.keys().next().value;
      geometryCache.delete(evicted);
      anticipatedKeys.delete(evicted);
    }
  }
  function storeField(request,field,engine){
    const urls=field.urls||[
      imageDataURL(win,field.inner,request.w,request.h),
      imageDataURL(win,field.outer,request.w,request.h),
      imageDataURL(win,field.blurMask,request.w,request.h)
    ];
    if(urls.some(uri=>!uri))throw Error("Canvas2D geometry encoding unavailable");
    cacheField(request,urls);
    setMaps(request,urls);
    shell.dataset.oracleFieldEngine=engine;
    shell.dataset.oraclePngEngine=field.urls?"worker":"main";
    shell.dataset.oracleFieldBuilds=String(Number(shell.dataset.oracleFieldBuilds||0)+1);
  }
  function syncField(request){
    try{storeField(request,generateOracleField(request.w,request.h,request.corner),"main");}
    catch{usingSVG=false;shell.classList.remove("has-oracle-backdrop");}
  }
  const prefetchDisabled=new Set();
  function stopWorker(){
    if(idleTimer)win.clearTimeout(idleTimer);
    idleTimer=0;
    try{worker?.terminate();}catch{}
    worker=null;workerBusy=false;
  }
  function armEndpointWarmup(){
    // The callback reads CURRENT desired geometry. Rescheduling this idle
    // timer on every rAF gains nothing and can starve endpoint warmup.
    if(idleTimer||!worker||workerBusy||!desired)return;
    idleTimer=win.setTimeout(()=>{
      idleTimer=0;
      if(disposed||!worker||workerBusy||!desired||
         shell.classList.contains("is-sidebar-toggling"))return;
      // Idle-only preparation of exact 74/260px desktop endpoints.
      const w=desired.w===74?260:desired.w===260?74:0;
      if(!w||desired.corner!==24)return;
      const key=w+"x"+desired.h+"@24";
      if(geometryCache.has(key)||prefetchDisabled.has(key))return;
      const next={key,w,h:desired.h,corner:24,prefetch:true};
      workerBusy=true;
      try{worker.postMessage(next);}
      catch{stopWorker();}
    },350);
  }
  function dispatchLatest(){
    if(!worker||workerBusy||!desired||desired.key===previous)return;
    workerBusy=true;
    try{worker.postMessage(desired);}
    catch{stopWorker();syncField(desired);}
  }
  if(canUse&&typeof win.Worker==="function"){
    try{
      worker=new win.Worker(new URL("./sidebar-glass-field-worker.js",import.meta.url),
        {type:"module",name:"oracle-sidebar-field"});
      worker.addEventListener("message",event=>{
        workerBusy=false;
        if(disposed)return;
        const field=event.data;
        if(!field||field.error){
          if(field?.prefetch){
            prefetchDisabled.add(field.key);
            if(desired?.key!==previous)dispatchLatest();
            return;
          }
          stopWorker();if(desired)syncField(desired);return;
        }
        // Every worker output is a byte-exact RGBA map for its own key.
        // Cache completed PNGs first, including superseded resize widths.
        // The central frame reconciler alone decides if/when to install.
        if(field.urls){
          cacheField(field,field.urls);
          if(field.key===desired?.key&&!field.prefetch){
            shell.dataset.oracleFieldEngine="worker";
            shell.dataset.oraclePngEngine="worker";
            shell.dataset.oracleFieldBuilds=String(
              Number(shell.dataset.oracleFieldBuilds||0)+1);
            reconcileReady();
          }
        }else if(field.key===desired?.key&&!field.prefetch){
          // Legacy browsers without worker-side PNG encoding keep the
          // prior exact raw-pixel main-thread fallback.
          try{storeField(desired,field,"worker");}
          catch{stopWorker();if(desired)syncField(desired);return;}
        }
        if(field.prefetch)shell.dataset.oraclePrefetchedEndpoint=field.key;
        // Don't enqueue a duplicate worker job when the desired key is
        // ALREADY in the cache awaiting a single animation-frame commit.
        if(desired?.key!==previous&&!geometryCache.has(desired.key))
          dispatchLatest();
        else {
          schedule();
          if(!shell.classList.contains("is-sidebar-toggling")){
            armEndpointWarmup();
            armAnticipation();
          }
        }
      });
      worker.addEventListener("error",event=>{
        event.preventDefault();
        stopWorker();
        if(!disposed&&desired)syncField(desired);
      });
    }catch{stopWorker();}
  }

  function apply(){
    queued=0;
    if(disposed)return;
    const bounds=sidebar.getBoundingClientRect();
    const w=Math.round(bounds.width),h=Math.round(bounds.height);
    if(w<1||h<1)return;
    if(!canUse){
      // Preserve the original CPU/CSS blur fallback where no SVG filter is
      // available: its blur still follows the current pane width.
      commitMaterial(w,h);
      return;
    }
    // Read the actual CSS corner, not a geometry-only blur radius.
    const style=win.getComputedStyle?.(sidebar);
    const actualRadius=Number.parseFloat(style?.borderTopRightRadius||"24");
    const corner=Math.min(Number.isFinite(actualRadius)?actualRadius:24,w*.5,h*.5);
    const key=w+"x"+h+"@"+corner;
    desired={key,w,h,corner};
    if(shell.classList.contains("is-sidebar-toggling")&&
       corner===24&&w>74&&w<260){
      observedWidths.set(w,(observedWidths.get(w)||0)+1);
    }
    if(key===previous){
      // No DOM writes, no timers, and no worker messages on a no-op frame.
      // Only settled endpoints are eligible for geometry-only warmup.
      if(!shell.classList.contains("is-sidebar-toggling")){
        armEndpointWarmup();
        armAnticipation();
      }
      return;
    }
    const cached=geometryCache.get(key);
    if(cached){
      geometryCache.delete(key);
      geometryCache.set(key,cached);
      setMaps(desired,cached);
      shell.dataset.oracleFieldCacheHits=
        String(Number(shell.dataset.oracleFieldCacheHits||0)+1);
      if(anticipatedKeys.has(key))
        shell.dataset.oracleAnticipatedFieldHits=
          String(Number(shell.dataset.oracleAnticipatedFieldHits||0)+1);
      if(!shell.classList.contains("is-sidebar-toggling")){
        armEndpointWarmup();
        armAnticipation();
      }
      return;
    }
    if(worker)dispatchLatest();
    else syncField(desired);
  }
  // A worker may finish just after one frame was scheduled, while
  // Chromium is about to paint the next width. Commit a newly ready map
  // synchronously through the EXACT same apply() code, cancelling the pending
  // rAF to avoid duplicate updates. This preserves the proven responsive
  // fast handoff and prevents an extra frame of worker-result latency.
  function reconcileReady(){
    if(disposed)return;
    if(queued){win.cancelAnimationFrame(queued);queued=0;}
    apply();
    if(shell.classList.contains("is-sidebar-toggling"))schedule();
  }
  // One animation-frame coordinator for the entire glass geometry:
  // ResizeObserver, width transitions, idle-worker results and viewport
  // events converge on the same read/reconcile/commit. Keep a continuous
  // rAF only during an explicit CSS width animation; other times no loop.
  function frameStep(){
    queued=0;
    if(disposed)return;
    apply();
    if(shell.classList.contains("is-sidebar-toggling"))schedule();
  }
  function schedule(){
    if(disposed||queued)return;
    if(shell.classList.contains("is-sidebar-toggling")&&
       (anticipateTimer||anticipateWorker))stopAnticipation();
    queued=win.requestAnimationFrame(frameStep);
  }
  function onPaneResize(){
    // ResizeObserver runs after layout, before paint. When the *exact* map
    // for this newly laid-out width is already cached, commit immediately
    // instead of deferring it by a full rAF. Missing sizes still use the
    // original coalesced worker path: never stretch/crop an old PNG.
    if(disposed)return;
    const bounds=sidebar.getBoundingClientRect();
    const w=Math.round(bounds.width),h=Math.round(bounds.height);
    if(w<1||h<1)return;
    const css=win.getComputedStyle?.(sidebar);
    const rawCorner=Number.parseFloat(css?.borderTopRightRadius||"24");
    const corner=Math.min(Number.isFinite(rawCorner)?rawCorner:24,w*.5,h*.5);
    const key=w+"x"+h+"@"+corner;
    if(key!==previous&&geometryCache.has(key))reconcileReady();
    else schedule();
  }
  const resize=typeof ResizeObserver!=="undefined"?new ResizeObserver(onPaneResize):null;
  resize?.observe(sidebar);
  function onViewportResize(){
    // At the tablet→desktop breakpoint the pane can switch directly from
    // 74px to 260px before its first rAF. If its EXACT target field is
    // already cached, install it during the resize event, prior to paint.
    // This changes only the timing of exact image delivery, never its data.
    if(disposed)return;
    const r=sidebar.getBoundingClientRect();
    const w=Math.round(r.width),h=Math.round(r.height);
    const style=win.getComputedStyle?.(sidebar);
    const value=Number.parseFloat(style?.borderTopRightRadius||"24");
    const radius=Math.min(Number.isFinite(value)?value:24,w*.5,h*.5);
    const key=w+"x"+h+"@"+radius;
    if(w>0&&h>0&&key!==previous&&geometryCache.has(key)){
      if(queued){win.cancelAnimationFrame(queued);queued=0;}
      apply();
    }else schedule();
  }
  win.addEventListener("resize",onViewportResize,{passive:true});
  // Width-transition completion is one more input to the SAME frame
  // scheduler. The prior second rAF loop raced ResizeObserver and worker
  // callbacks, causing redundant filter operations for a single width.
  const onWidthTransition=event=>{
    if(event.target===sidebar&&event.propertyName==="width")schedule();
  };
  sidebar.addEventListener("transitionend",onWidthTransition);
  sidebar.addEventListener("transitioncancel",onWidthTransition);
  const endpointObserver=typeof MutationObserver!=="undefined"?
    new MutationObserver(()=>{
      if(shell.classList.contains("is-sidebar-toggling")){
        stopAnticipation();
        schedule();
      }else{
        // Class removal may not cause a ResizeObserver event. Reconcile the
        // exact endpoint once, then re-arm geometry-only idle preparation.
        schedule();
        armAnticipation();
      }
    }):null;
  endpointObserver?.observe(shell,{attributes:true,attributeFilter:["class"]});
  schedule();
  return {
    get active(){return usingSVG;},
    refresh:schedule,
    dispose(){
      disposed=true;
      if(queued)win.cancelAnimationFrame(queued);
      if(delay)win.clearTimeout(delay);
      stopWorker();
      stopAnticipation();
      geometryCache.clear();
      resize?.disconnect();
      endpointObserver?.disconnect();
      win.removeEventListener("resize",onViewportResize);
      sidebar.removeEventListener("transitionend",onWidthTransition);
      sidebar.removeEventListener("transitioncancel",onWidthTransition);
      shell.classList.remove("has-oracle-backdrop");
      svg.remove();
    }
  };
}
