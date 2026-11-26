/* Public-home-only DOM glyph alpha: matches the public WebGPU glass
 * fragment's two spatial fades at the glyph center. The animated track alpha
 * is already applied to the icon's parent tile, so it must NOT be applied
 * here again. No DOM, WebGPU or timing dependencies: testable in Node. */
const clamp01=value=>Math.max(0,Math.min(1,value));
export const publicLogoOvalRadius=(width,referenceWidth)=>{
  if(!Number.isFinite(width)||!Number.isFinite(referenceWidth)||width<=0||referenceWidth<=0)
    throw new RangeError("Positive finite wordmark widths required");
  return 140*width/referenceWidth;
};
// The CSS fallback, GPU and DOM icon alpha share one measured radius.
// Measure only when the wordmark's intrinsic layout or font changes.
let ovalRadius=320;
export const currentPublicLogoOvalRadius=()=>ovalRadius;
export function observePublicLogoOval(){
  const title=document.getElementById("dashboard-title"),grid=document.getElementById("cta6-mosaic");
  if(!title||!grid)return;
  function update(){
    const style=getComputedStyle(title),width=parseFloat(style.width);
    if(!(width>0))return;
    const probe=document.createElement("span");
    probe.textContent="Doof";
    Object.assign(probe.style,{position:"absolute",visibility:"hidden",pointerEvents:"none",
      display:"inline-block",width:"max-content",whiteSpace:"nowrap"});
    for(const property of ["fontFamily","fontSize","fontWeight","fontStyle","fontStretch",
      "fontVariant","fontKerning","fontFeatureSettings","fontVariationSettings","letterSpacing",
      "wordSpacing","textTransform"])probe.style[property]=style[property];
    title.parentElement.append(probe);
    const referenceWidth=probe.getBoundingClientRect().width;
    probe.remove();
    if(!(referenceWidth>0))return;
    const radius=publicLogoOvalRadius(width,referenceWidth);
    if(Math.abs(radius-ovalRadius)<0.001&&grid.style.getPropertyValue("--public-logo-oval-x"))return;
    ovalRadius=radius;
    grid.style.setProperty("--public-logo-oval-x",radius+"px");
    window.dispatchEvent(new Event("dofinances:logo-oval-change"));
  }
  update();
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(update).observe(title);
  new MutationObserver(update).observe(title,{childList:true,characterData:true,subtree:true});
  document.fonts?.ready.then(update);
  document.fonts?.addEventListener?.("loadingdone",update);
}
export function publicIconSpatialAlpha(
    centerX,centerY,tileWidth,sceneWidth,sceneHeight,dpr=1,radiusX=140){
  if([centerX,centerY,tileWidth,sceneWidth,sceneHeight,dpr,radiusX]
      .some(value=>!Number.isFinite(value)) ||
      tileWidth<=0||sceneWidth<=0||sceneHeight<=0||dpr<=0||radiusX<=0)
    throw new RangeError("Positive finite scene dimensions and finite coordinates required");
  // Mirror dashboard-gpu-glass.wgsl: side fade 25% -> 100% over 0.75 tile.
  const edgeDistance=Math.min(centerX,sceneWidth-centerX);
  const edgeOpacity=0.25+0.75*clamp01(edgeDistance/Math.max(1,0.75*tileWidth));
  // The public logo is 2.5 tile heights above the viewport-scene center.
  // Match the measured horizontal radius and fixed 100px vertical radius.
  const logoY=sceneHeight*0.5-2.5*(950/11)*dpr;
  const ovalDistance=clamp01(Math.hypot(
    (centerX-sceneWidth*0.5)/(radiusX*dpr),
    (centerY-logoY)/(100*dpr)));
  const logoOpacity=0.60+0.40*ovalDistance*ovalDistance;
  return edgeOpacity*logoOpacity;
}
