/* Isolated Dashboard: browser-authored seven-lane slow vertical track.
 * Six original grid rows and a seventh, initially transparent entry row.
 * Fade across two row pitches at each end: slot -1 to +1 above,
 * and slot +6 to +4 below. The horizontal fade contour is intentionally
 * curved: upper convex (∩), lower concave (∪). The outer columns retain
 * the original fade while each contour bows outward toward the center.
 * This does not represent a recovered Apple Liquid Glass parameter.
 */
export const TRACK_ROWS=7;
export const TRACK_LANES=7;
export const TRACK_FADE_ROWS=2;
export const TRACK_COLUMNS=11;
export const TRACK_CURVE_STRENGTH=0.8;
// Permanent, subtle lateral transparency: two-pitch-wide sides with a
// 0.35-pitch outward bow at the vertical midpoint, matching the existing
// upper/lower half-alpha contour displacement without making edges disappear.
export const TRACK_SIDE_EDGE_OPACITY=0.82;
export const TRACK_SIDE_BULGE_ROWS=0.35;
export const TRACK_SECONDS=84/(1.15*1.30*1.35); // 35% faster than the immediately preceding preview speed
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
// Horizontal parabolic arch: 0 at both edges, 1 at the center column.
export function trackCurve(column){
  if(!Number.isInteger(column)||column<0||column>=TRACK_COLUMNS)
    throw new RangeError("Track column must be in [0,10]");
  const x=2*column/(TRACK_COLUMNS-1)-1;
  return 1-x*x;
}
// The side mask follows each tile's CURRENT row slot, not its original
// row or entrance delay. At the top/bottom the fade extends 2.35 pitches
// inward; at the middle it extends 1.65. Thus the left/right boundaries
// bow outward centrally, while middle columns stay fully opaque. This
// opacity is independent of the moving top/bottom gradients and hover.
export function trackSideOpacity(slot,column){
  if(!Number.isFinite(slot)||slot<-1||slot>6)
    throw new RangeError("Current track slot must lie in [-1,6]");
  trackCurve(column);
  const vertical=(slot-2.5)/3.5;
  const arch=Math.max(0,1-vertical*vertical);
  const support=TRACK_FADE_ROWS+TRACK_SIDE_BULGE_ROWS*(1-2*arch);
  const inset=Math.min(column,TRACK_COLUMNS-1-column);
  return TRACK_SIDE_EDGE_OPACITY+(1-TRACK_SIDE_EDGE_OPACITY)*smooth(inset/support);
}
const shapedFade=(distance,column)=>{
  const t=Math.max(0,Math.min(1,distance/TRACK_FADE_ROWS));
  // Keep both endpoints (including the invisible wrap row) invariant.
  // Interior alpha rises earlier at the center. Since bottom progress is
  // measured in the opposite vertical direction, the two level contours
  // become an upper convex arch and lower concave scoop, respectively.
  const bend=TRACK_CURVE_STRENGTH*trackCurve(column);
  return smooth(t+bend*t*(1-t));
};
export function trackPosition(row,phase,column=0){
  if(!Number.isInteger(row)||row<0||row>=TRACK_ROWS)
    throw new RangeError("Track row must be in [0,6]");
  if(!Number.isFinite(phase))throw new RangeError("Finite phase required");
  trackCurve(column); // Explicitly fail closed for invalid grid columns.
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
    opacity:shapedFade(slot+1,column)*shapedFade(6-slot,column)
  });
}
