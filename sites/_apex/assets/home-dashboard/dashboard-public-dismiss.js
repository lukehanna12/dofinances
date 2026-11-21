/* Dofinances public-home-only notification-dissipation approximation.
 * No verified macOS notification timing, easing, or geometry producer exists
 * in liquid-plexiglass-oracle's retained evidence as of 25F80/M2/G14G.
 * Browser-authored choreography is separate from source-backed glass optics.
 */
export const DISMISS_MS=970;
const clamp01=n=>Math.min(1,Math.max(0,n));
export function tileDismissProgress(elapsedMs,row,column){
  if(!Number.isFinite(elapsedMs)||!Number.isInteger(row)||row<0||row>6||
    !Number.isInteger(column)||column<0||column>10)
    throw new RangeError("Finite elapsed time and tile coordinates are required");
  // Front comes from the upper-right, varying in time as it sweeps across
  // the 11x7 lattice. The 970ms transition always fully clears each tile.
  const diagonal=((10-column)/10+row/6)*0.5;
  const dither=((row*37+column*23)%11)/11;
  const delay=28+160*diagonal+40*dither;
  const p=clamp01((elapsedMs-delay)/730);
  return p*p*(3-2*p);
}
export function tileDismissIconOpacity(progress){
  if(!Number.isFinite(progress))throw new RangeError("Finite progress required");
  const p=clamp01(progress);
  const fade=clamp01((p-0.08)/0.82);
  const eased=fade*fade*(3-2*fade);
  return 1-eased;
}
export function tileDismissDrift(progress,row,column){
  if(!Number.isFinite(progress)||!Number.isInteger(row)||row<0||row>6||
    !Number.isInteger(column)||column<0||column>10)
    throw new RangeError("Valid progress and tile coordinates required");
  const p=clamp01(progress);
  const variation=((row*13+column*7)%17)/17;
  return {x:p*(8+12*variation),y:-p*(10+12*(1-variation))};
}
