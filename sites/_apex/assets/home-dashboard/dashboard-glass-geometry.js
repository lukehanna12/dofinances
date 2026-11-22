/* Normalize only CSS geometry before the existing shared WebGPU SDF.
 * A browser resolves border-radius:999px on a capsule to at most half its
 * shorter dimension; passing 999px to the shader is NOT equivalent.
 * This does not modify the glass shader, optical parameters, blur or tint.
 */
export function normalizeGlassCornerRadii(rawRadii,width,height){
  if(!Array.isArray(rawRadii)||rawRadii.length!==4)
    throw new TypeError("Four CSS corner radii required");
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    throw new RangeError("Positive finite pane bounds required");
  const cap=Math.min(width,height)*.5;
  return rawRadii.map(raw=>{
    const radius=Number.parseFloat(raw);
    return Math.min(cap,Math.max(0,Number.isFinite(radius)?radius:0));
  });
}
export function glassPaneNeedsLiveTransform(role){
  return role==="search-field"||role==="filter-dropdown";
}
