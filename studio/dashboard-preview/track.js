/* Isolated Dashboard: browser-authored seven-lane slow vertical track.
 * Six grid rows and one fully transparent entrance lane beneath row six.
 * Fade out between the original top row and one row above; fade in
 * between the new row beneath the bottom and the original bottom row.
 * This does not represent a recovered Apple Liquid Glass parameter.
 */
export const TRACK_ROWS=6;
export const TRACK_LANES=7;
export const TRACK_SECONDS=168; // one row pitch every 24 seconds
const smooth=t=>{
  const x=Math.max(0,Math.min(1,t));
  return x*x*(3-2*x);
};
export function phaseAtSeconds(elapsed,seconds=TRACK_SECONDS){
  if(!Number.isFinite(elapsed)||elapsed<0||
      !Number.isFinite(seconds)||seconds<=0)
    throw new RangeError("Nonnegative elapsed time and positive period required");
  return (elapsed%seconds)/seconds*TRACK_LANES;
}
export function trackPosition(row,phase){
  if(!Number.isInteger(row)||row<0||row>=TRACK_ROWS)
    throw new RangeError("Track row must be in [0,5]");
  if(!Number.isFinite(phase))throw new RangeError("Finite phase required");
  const slot=((row-phase+1)%TRACK_LANES+TRACK_LANES)%TRACK_LANES-1;
  return Object.freeze({
    slot,deltaRows:slot-row,
    opacity:smooth(slot+1)*smooth(6-slot)
  });
}
