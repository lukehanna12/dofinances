/* Isolated Dashboard: browser-authored seven-lane slow vertical track.
 * Six original grid rows and a seventh, initially transparent entry row.
 * Fade across two row pitches at each end: slot -1 to +1 above,
 * and slot +6 to +4 below. Both edges always have a partial row.
 * This does not represent a recovered Apple Liquid Glass parameter.
 */
export const TRACK_ROWS=7;
export const TRACK_LANES=7;
export const TRACK_FADE_ROWS=2;
export const TRACK_SECONDS=84/1.15; // precisely 15% faster than the previous 84s cycle
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
    throw new RangeError("Track row must be in [0,6]");
  if(!Number.isFinite(phase))throw new RangeError("Finite phase required");
  // Prefer the unwrapped position while it is inside the visual track.
  // In particular, row 6 at phase 0 MUST begin at the bottom (slot 6),
  // not the mathematically equivalent but misplaced invisible top (-1).
  // At a wrap, both endpoints have alpha 0, so this stays seamless.
  const cycle=((phase%TRACK_LANES)+TRACK_LANES)%TRACK_LANES;
  const raw=row-cycle;
  const slot=raw>=-1&&raw<=6?raw:
    ((raw+1)%TRACK_LANES+TRACK_LANES)%TRACK_LANES-1;
  return Object.freeze({
    slot,deltaRows:slot-row,
    opacity:smooth((slot+1)/TRACK_FADE_ROWS)*smooth((6-slot)/TRACK_FADE_ROWS)
  });
}
