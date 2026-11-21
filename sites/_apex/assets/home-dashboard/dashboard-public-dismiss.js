/* Public-home-only banner-dismissal-inspired motion, 25F80 scope.
 *
 * Native macOS NotificationCenter.app inspection found:
 * - BannerTransition / BannerTransitionModifier interfaces
 * - NCCAController:dismissRemoteSession:withAnimation:
 * - setSwipeGestureOffset:offset:didComplete:
 * - SwiftUI spring and CASpringAnimation references.
 * These prove existence of transition/offset mechanisms, NOT the exact
 * banner curve, duration or whether the live banner uses those classes.
 * Independent macOS 26 user reports describe a rightward disappearance.
 * Therefore this authored model is coherent rightward contraction, with no
 * invented fragmentation, noise particles or vertical scatter. All material
 * SDF/refraction remains in the existing Oracle-grounded shader.
 */
export const DISMISS_MS=720;
const clamp01=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp01(value);return t*t*(3-2*t)};
export function tileDismissProgress(elapsedMs,row,column){
  if(!Number.isFinite(elapsedMs)||!Number.isInteger(row)||row<0||row>6||
    !Number.isInteger(column)||column<0||column>10)
    throw new RangeError("Finite elapsed time and tile coordinates required");
  // Adjacent tiles keep their lattice relationship. Rightmost cells begin
  // slightly earlier, so the material is drawn rightward as one elastic sheet
  // rather than disappearing into unrelated grains/individual particles.
  const delay=(10-column)*6+row*2;
  const t=clamp01((elapsedMs-delay)/(DISMISS_MS-delay));
  // Critically damped step-response *shape*, normalized to finish exactly
  // at t=1. The rate is an authored perceptual approximation, not a
  // recovered native spring coefficient.
  const omega=7.0;
  const remaining=(1+omega*t)*Math.exp(-omega*t);
  const atEnd=1-(1+omega)*Math.exp(-omega);
  return clamp01((1-remaining)/atEnd);
}
export function tileDismissIconOpacity(progress){
  if(!Number.isFinite(progress))throw new RangeError("Finite progress required");
  // Shader samples this identical curve at its center; only the rightmost
  // few pixels of each square attenuate imperceptibly ahead of the center.
  return 1-smooth((clamp01(progress)-0.06)/0.82);
}
export function tileDismissScale(progress){
  if(!Number.isFinite(progress))throw new RangeError("Finite progress required");
  const p=clamp01(progress);
  const contraction=p*p;
  return {x:1-0.58*contraction,y:1-0.30*contraction};
}
export function tileDismissDrift(progress,row,column,baseX,tileWidth,viewportWidth,dpr=1){
  if(!Number.isFinite(progress)||!Number.isInteger(row)||row<0||row>6||
    !Number.isInteger(column)||column<0||column>10||
    !Number.isFinite(baseX)||!Number.isFinite(tileWidth)||tileWidth<=0||
    !Number.isFinite(viewportWidth)||viewportWidth<=0||
    !Number.isFinite(dpr)||dpr<=0)
    throw new RangeError("Valid tile, viewport and DPR required");
  const p=clamp01(progress);
  // A cohesive sheet contracts towards the right edge. Every square's
  // center converges beyond the SAME screen-right exit boundary, while
  // retaining its row's original height (no arbitrary upward drift).
  const exitX=viewportWidth+tileWidth*.65;
  const centerX=baseX+tileWidth*.5;
  const distance=Math.max(0,exitX-centerX);
  return {x:distance*p/dpr,y:0};
}
