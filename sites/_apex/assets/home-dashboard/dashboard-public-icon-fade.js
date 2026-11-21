/* Public-home-only DOM glyph alpha: matches the public WebGPU glass
 * fragment's two spatial fades at the glyph center. The animated track alpha
 * is already applied to the icon's parent tile, so it must NOT be applied
 * here again. No DOM, WebGPU or timing dependencies: testable in Node. */
const clamp01=value=>Math.max(0,Math.min(1,value));
export function publicIconSpatialAlpha(
    centerX,centerY,tileWidth,sceneWidth,sceneHeight,dpr=1){
  if([centerX,centerY,tileWidth,sceneWidth,sceneHeight,dpr]
      .some(value=>!Number.isFinite(value)) ||
      tileWidth<=0||sceneWidth<=0||sceneHeight<=0||dpr<=0)
    throw new RangeError("Positive finite scene dimensions and finite coordinates required");
  // Mirror dashboard-gpu-glass.wgsl: side fade 25% -> 100% over 0.75 tile.
  const edgeDistance=Math.min(centerX,sceneWidth-centerX);
  const edgeOpacity=0.25+0.75*clamp01(edgeDistance/Math.max(1,0.75*tileWidth));
  // The public logo is 2.5 tile heights above the viewport-scene center.
  // Mirror WGSL's 140x100 CSS-pixel radial, squared falloff (60% -> 100%).
  const logoY=sceneHeight*0.5-2.5*(950/11)*dpr;
  const ovalDistance=clamp01(Math.hypot(
    (centerX-sceneWidth*0.5)/(140*dpr),
    (centerY-logoY)/(100*dpr)));
  const logoOpacity=0.60+0.40*ovalDistance*ovalDistance;
  return edgeOpacity*logoOpacity;
}
