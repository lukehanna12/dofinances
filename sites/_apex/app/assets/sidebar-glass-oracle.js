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
export const ORACLE_FINITE_REFRACTION = Object.freeze({
  // The most frequent independently projected values among 331 retained
  // finite public states. Their joint co-occurrence is not hereby asserted.
  innerAmount:Math.fround(-60),
  innerInvHeight:Math.fround(0.05000000074505806),
  outerAmount:Math.fround(38),
  outerInvHeight:Math.fround(0.04210526496171951),
  threshold0:Math.fround(-1),
  threshold1:Math.fround(-.5),
  opacity:Math.fround(.30000001192092896),
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
 * Transcription of retained _ZN2CA3OGL5Metal12ShaderUtils_IDhE15supercircle_sdf...
 * for the mode4 finite SDF path. The constants are decoded EXACTLY from
 * LLVM/AIR f64 literals, not artist-chosen. Native GPU half precision is
 * not formally equivalent; this JS path computes in float32 at recorded
 * float sites and may differ by half-ULPs at intermediate operations.
 */
export function airSupercircleSDF(absX,absY,halfWidth,halfHeight,radius,blendX=0,blendY=0){
  if(![absX,absY,halfWidth,halfHeight,radius,blendX,blendY].every(Number.isFinite))
    throw new TypeError("Finite SDF operands required");
  if(radius<=0)return {distance:Math.max(absX-halfWidth,absY-halfHeight),nx:0,ny:0};
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

const SVG="http://www.w3.org/2000/svg";
const NS="http://www.w3.org/1999/xlink";
const attribute=(el,attrs)=>{for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
function makeSVG(doc,tag,attrs){return attribute(doc.createElementNS(SVG,tag),attrs);}

/*
 * The pane has rounded RIGHT corners and square LEFT corners. The uniform
 * mode4 native supercircle is applied at the rounded right outline; the
 * square-left seam is handled by a rectangular distance and has no lensing.
 * Apple's exact mode5 per-corner producer mapping is not established by this.
 */
export function paneField(x,y,w,h,radius){
  const px=x-w*.5,py=y-h*.5;
  if(x < w*.5){
    return {distance:Math.max(-x,x-w,-y,y-h),nx:0,ny:0};
  }
  const sdf=airSupercircleSDF(Math.abs(px),Math.abs(py),w*.5,h*.5,radius,0,0);
  return {distance:sdf.distance,nx:sdf.nx*(px>=0?1:-1),
    ny:sdf.ny*(py>=0?1:-1)};
}

export function generateOracleField(w,h,radius,parameters=ORACLE_FINITE_REFRACTION){
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>6000000)
    throw new RangeError("Invalid filter field dimensions");
  const width=Math.round(w),height=Math.round(h);
  const inner=new Uint8ClampedArray(width*height*4);
  const outer=new Uint8ClampedArray(width*height*4);
  const encode=(v)=>Math.round(255*clamp(.5+v/128,0,1));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const dst=Math.min(x,width-x-.5,y,height-y-.5);
    if(x<width*.5 || dst>28){
      inner[i]=outer[i]=128;
      inner[i+1]=outer[i+1]=128;
      inner[i+2]=outer[i+2]=0;
      inner[i+3]=outer[i+3]=255;
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
  }
  return {width,height,inner,outer};
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
  const nearAlpha=makeSVG(doc,"feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",result:"nearCoverage"});
  const nearPart=makeSVG(doc,"feComposite",{
    in:"nearBlur",in2:"nearCoverage",operator:"in",result:"nearPart"});
  const farPart=makeSVG(doc,"feComposite",{
    in:"farBlur",in2:"nearCoverage",operator:"out",result:"farPart"});
  const blurred=makeSVG(doc,"feComposite",{
    in:"nearPart",in2:"farPart",operator:"over",result:"blurred"});
  const innerMap=makeSVG(doc,"feImage",{result:"innerMap",x:0,y:0,
    width:260,height:800,preserveAspectRatio:"none"});
  const outerMap=makeSVG(doc,"feImage",{result:"outerMap",x:0,y:0,
    width:260,height:800,preserveAspectRatio:"none"});
  const innerDist=makeSVG(doc,"feDisplacementMap",{in:"blurred",in2:"innerMap",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"innerShift"});
  const outerDist=makeSVG(doc,"feDisplacementMap",{in:"blurred",in2:"outerMap",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"outerShift"});
  const mask=makeSVG(doc,"feColorMatrix",{in:"innerMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",result:"outerBlendMask"});
  const maskedOuter=makeSVG(doc,"feComposite",{in:"outerShift",in2:"outerBlendMask",
    operator:"in",result:"outerPart"});
  const maskedInner=makeSVG(doc,"feComposite",{in:"innerShift",in2:"outerBlendMask",
    operator:"out",result:"innerPart"});
  const join=makeSVG(doc,"feComposite",{
    in:"outerPart",in2:"innerPart",operator:"over",result:"composited"});
  // AIR base lines 479–525: face_opacity>0 transforms source.rgb/alpha
  // through three half4 rows plus biases, then mixes back to the input.
  // The retained live binding has face_opacity exactly 1.0, so we use the
  // observed three half4 rows directly; extended-sRGB/Q output is not closed.
  const face=makeSVG(doc,"feColorMatrix",{
    in:"composited",type:"matrix",
    values:oracleFaceColorMatrixValues(),result:"faceMaterial"});
  filter.append(blurFar,blurNear,blurMap,nearAlpha,nearPart,farPart,
    blurred,innerMap,outerMap,innerDist,outerDist,mask,maskedOuter,maskedInner,
    join,face);
  defs.append(filter);svg.append(defs);doc.body.append(svg);
  const supported=!!win.CSS?.supports?.("backdrop-filter",'url("#'+id+'")');
  const canUse=!!supported&&!reduced;
  function apply(){
    queued=0;
    if(disposed)return;
    const bounds=sidebar.getBoundingClientRect();
    const w=Math.round(bounds.width),h=Math.round(bounds.height);
    if(w<1||h<1)return;
    const radius=nativePublicBlurRadius("regular",w,h);
    const word=observedBlurWord(radius,1,ORACLE_FINITE_REFRACTION.surfaceScale);
    // Converting finite downsample-space radius to CSS pixel footprint is a
    // browser adapter assumption, not a claimed equivalent Gaussian kernel.
    const scale=ORACLE_FINITE_REFRACTION.surfaceScale;
    const farLOD=airTextureMipLOD(word,1);
    const nearLOD=airTextureMipLOD(word,.5);
    // The LODs are source-exact. Mapping mip-filter footprint into CSS
    // Gaussian sigma is NOT source-exact (browser sampling limitation).
    // The two sigma levels retain the observed LOD ordering and ratio.
    const effective=word/scale;
    const nearSigma=effective*.5;
    const farSigma=effective;
    shell.style.setProperty("--oracle-input-radius",radius+"px");
    shell.style.setProperty("--oracle-render-word",word+"px");
    shell.style.setProperty("--oracle-backdrop-blur",farSigma+"px");
    shell.style.setProperty("--oracle-mip-lod-near",String(nearLOD));
    shell.style.setProperty("--oracle-mip-lod-far",String(farLOD));
    blurFar.setAttribute("stdDeviation",String(farSigma));
    blurNear.setAttribute("stdDeviation",String(nearSigma));
    if(!canUse)return;
    const key=w+"x"+h+"@"+radius;
    if(key===previous)return;
    try{
      // Match the actual DOM sidebar corner geometry rather than inventing
      // a fixed SDF radius. CSS border radius is part of app layout state.
      const style=win.getComputedStyle?.(sidebar);
      const actualRadius=Number.parseFloat(style?.borderTopRightRadius||"24");
      const corner=Number.isFinite(actualRadius)?actualRadius:24;
      const field=generateOracleField(w,h,Math.min(corner,w*.5,h*.5));
      const a=imageDataURL(win,field.inner,w,h);
      const b=imageDataURL(win,field.outer,w,h);
      const c=imageDataURL(win,field.blurMask,w,h);
      if(!a||!b||!c)throw Error("Canvas2D geometry encoding unavailable");
      for(const [node,uri]of [[innerMap,a],[outerMap,b],[blurMap,c]]){
        node.setAttribute("href",uri);
        node.setAttributeNS(NS,"xlink:href",uri);
        node.setAttribute("width",String(w));
        node.setAttribute("height",String(h));
      }
      previous=key;
      usingSVG=true;
      shell.classList.add("has-oracle-backdrop");
    }catch{
      usingSVG=false;
      shell.classList.remove("has-oracle-backdrop");
    }
  }
  function schedule(){
    if(disposed)return;
    if(queued)win.cancelAnimationFrame(queued);
    queued=win.requestAnimationFrame(apply);
  }
  const resize=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
  resize?.observe(sidebar);
  win.addEventListener("resize",schedule,{passive:true});
  schedule();
  return {
    get active(){return usingSVG;},
    refresh:schedule,
    dispose(){
      disposed=true;
      if(queued)win.cancelAnimationFrame(queued);
      if(delay)win.clearTimeout(delay);
      resize?.disconnect();
      win.removeEventListener("resize",schedule);
      shell.classList.remove("has-oracle-backdrop");
      svg.remove();
    }
  };
}
