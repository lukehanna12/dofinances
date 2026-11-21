/* The authoritative alignment of compositor-scrolled glass with its fixed
 * wallpaper is the actual viewport relationship between BOTH surfaces.
 * scrollTop by itself misses elastic overscroll and compositor transforms.
 *
 * A glass fragment's content Y is measured from its canvas origin. Subtract
 * (fixed-scene top - composited-canvas top) to obtain wallpaper-local Y.
 * This contains no approximations or changes to the optical material.
 */
export function authBackdropOffsetCSS(sceneTopCSS,canvasTopCSS){
  if(!Number.isFinite(sceneTopCSS)||!Number.isFinite(canvasTopCSS))
    throw new TypeError("Finite scene and composited canvas origins required");
  return sceneTopCSS-canvasTopCSS;
}
