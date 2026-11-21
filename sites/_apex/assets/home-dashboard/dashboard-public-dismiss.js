/* Temporary upper-right macOS notification X-CLOSE "poof" inspired effect.
 *
 * Not the banner's swipe-right, automatic expiry, remote-session dismissal
 * offset or the Notification Center sheet opening/closing.
 *
 * Evidence: historical X-click notification dismissal was a rapid gray
 * puff-of-smoke; 10.8 accounts distinguish it from the cartoon Dock poof.
 * AppKit's NSAnimationEffectPoof and NSUserNotificationPrivate's former
 * _poofsOnCancel establish the lineage. The installed macOS 26.5
 * NotificationCenter executable exposes dismissal interfaces but does NOT
 * expose a recoverable current close-button smoke shader/timing curve. This
 * is a clearly marked PROCEDURAL RECONSTRUCTION, not exact Apple code.
 *
 * The effect is local, with smoke blooming around each original tile.
 * Never translate the entire lattice sideways or break into square pixels.
 * Its five broad visual phases loosely follow the historic five-frame puff:
 * intact -> fraying -> rounded cloud -> fine wisps -> transparent.
 */
export const DISMISS_MS=620;
const clamp01=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp01(v);return t*t*(3-2*t)};
export function tileDismissProgress(elapsedMs,row,column){
  if(!Number.isFinite(elapsedMs)||!Number.isInteger(row)||row<0||row>6||
     !Number.isInteger(column)||column<0||column>10)
    throw new RangeError("Finite elapsed time and lattice coordinates required");
  // Maximum 28ms temporal variation—per-surface smoke is nearly
  // simultaneous, as with one clicked notification. No diagonal wipe.
  const delay=((row*7+column*3)%5)*7;
  return clamp01((elapsedMs-delay)/(DISMISS_MS-delay));
}
export function tileDismissIconOpacity(progress){
  if(!Number.isFinite(progress))throw new RangeError("Finite progress required");
  // SVG contours disappear while the GPU's material becomes a cloud;
  // they share the same locally evolving progress and expanding geometry.
  return 1-ease((clamp01(progress)-0.10)/0.39);
}
export function tileDismissScale(progress){
  if(!Number.isFinite(progress))throw new RangeError("Finite progress required");
  const p=ease(clamp01(progress));
  return {x:1+0.40*p,y:1+0.32*p};
}
export function tileDismissDrift(progress,row,column,baseX,tileWidth,viewportWidth,dpr=1){
  if(!Number.isFinite(progress)||!Number.isInteger(row)||row<0||row>6||
     !Number.isInteger(column)||column<0||column>10||
     !Number.isFinite(baseX)||!Number.isFinite(tileWidth)||tileWidth<=0||
     !Number.isFinite(viewportWidth)||viewportWidth<=0||
     !Number.isFinite(dpr)||dpr<=0)
    throw new RangeError("Valid coordinates, dimensions and DPR required");
  // The puff remains anchored where the tile lived; smoke lifts a few
  // pixels, and each column expands radially by at most 3.4 CSS pixels.
  const puff=ease(clamp01(progress));
  if(puff===0)return {x:0,y:0};
  return {x:((column-5)/5)*3.4*puff,y:-6.0*puff};
}
export function tileDismissBlur(progress){
  if(!Number.isFinite(progress))throw new RangeError("Finite progress required");
  return 5.2*ease(clamp01(progress));
}
