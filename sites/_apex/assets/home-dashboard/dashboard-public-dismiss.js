/* The macOS 26 X-close optical dissipation fallback.
 * Native-only investigation of NotificationCenter.app confirms a dismissal
 * action and opacity/transition interfaces but NOT their exact curve.
 * The binary/Assets.car expose no poof/smoke asset; public CGWindow alpha
 * remains 1 and an 18s SwiftUI trace had no data. These observations do NOT
 * rule out private compositor effects. User prohibits screen capture.
 *
 * Authored browser approximation: remove the old fake gray smoke and instead
 * lose coherence inside each refracting tile, locally and simultaneously.
 * Do not confuse X-close with a swipe or timed banner expiry.
 */
export const DISMISS_MS=440;
const clamp01=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp01(v);return t*t*(3-2*t)};
export function tileDismissProgress(ms,row,col){
  if(!Number.isFinite(ms)||!Number.isInteger(row)||row<0||row>6||
    !Number.isInteger(col)||col<0||col>10)
    throw new RangeError("Invalid dismissal time or lattice location");
  const delay=((row*7+col*3)%5)*3; // 0-12ms, no diagonal wipe
  return clamp01((ms-delay)/(DISMISS_MS-delay));
}
export function tileDismissIconOpacity(p){
  if(!Number.isFinite(p))throw new RangeError("Invalid progress");
  return 1-ease((clamp01(p)-0.08)/0.74);
}
export function tileDismissScale(p){
  if(!Number.isFinite(p))throw new RangeError("Invalid progress");
  const t=ease(clamp01(p));return {x:1+0.085*t,y:1+0.065*t};
}
export function tileDismissDrift(p,row,col,x,width,viewport,dpr=1){
  if(!Number.isFinite(p)||!Number.isInteger(row)||row<0||row>6||
    !Number.isInteger(col)||col<0||col>10||
    !Number.isFinite(x)||!Number.isFinite(width)||width<=0||
    !Number.isFinite(viewport)||viewport<=0||
    !Number.isFinite(dpr)||dpr<=0)
    throw new RangeError("Invalid tile geometry");
  const t=ease(clamp01(p));
  if(t===0)return {x:0,y:0};
  return {x:((col-5)/5)*0.9*t,y:-1.15*t};
}
export function tileDismissBlur(p){
  if(!Number.isFinite(p))throw new RangeError("Invalid progress");
  return 1.4*ease(clamp01(p));
}
