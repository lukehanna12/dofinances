/* Collections-only, wallpaper-sampled Clear material.
 * Oracle (25F80/M2/G14G) finite public Clear CAFilter:
 *   For directly measured straight SwiftUI .rect at native heights 16-23pt:
 *   innerRefractionAmount = -nativeHeight
 *   innerRefractionHeight = 0.36*nativeHeight
 *   Browser CSS height is projected (native 2x edge snapping is not simulated).
 *   This does NOT replace unrelated 10-case rounded-glass geometry evidence.
 *   outerRefractionAmount = 0; outerMixOpacity = 0
 *   face white=.8, black=.05, saturation=1, WHITE fill alpha=.05
 *   blurOpacity[0..4] = 1; blurDistance[0..4] = 0
 * Signed-distance coverage and refraction envelope follow retained LPH AIR.
 * The CSS screen-backed strip's two flat horizontal boundaries are an
 * explicit browser geometry translation, not an observed native SDF writer.
 * The face output equation, sampling precision, Q/EDR chain and interaction
 * remain browser projections, NOT native-equivalent proofs. No tint added.
 */
struct State {
  crop:vec4<f32>,      // wallpaper cover left, top, drawn width, drawn height
  viewport:vec4<f32>,  // strip viewport top, wallpaper overpull, DPR, strip CSS height
  material:vec4<f32>,  // public inner amount, public inner height, mip LOD, original veil
  pointer:vec4<f32>,   // CSS x, hover, pressed, spare
  tuning:vec4<f32>,    // browser brightness gain, contrast gain, tint strength, spare
  tint:vec4<f32>,      // full sRGB picker color, alpha unused (strength above)
};
@group(0) @binding(0) var photo:texture_2d<f32>;
@group(0) @binding(1) var samplerLinear:sampler;
@group(0) @binding(2) var<uniform> state:State;
struct Out { @builtin(position) p:vec4<f32> };
@vertex fn vs(@builtin(vertex_index) index:u32) -> Out {
  var p=array<vec2<f32>,3>(
    vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
  var o:Out;o.p=vec4<f32>(p[index],0.0,1.0);return o;
}
fn refractionEnvelope(distance:f32,amount:f32,height:f32)->f32{
  let t=clamp(-distance/max(height,0.0001),0.0,1.0);
  let root=clamp(sqrt(max(0.0,(2.0-t)*t)),0.0,1.0);
  return amount-root*amount;
}
@fragment fn fs(@builtin(position) pixel:vec4<f32>) -> @location(0) vec4<f32>{
  let x=pixel.x/state.viewport.z;
  let y=pixel.y/state.viewport.z;
  let h=state.viewport.w;
  // An infinite-width straight strip has signed distance -min(top,bottom).
  // Its normal has no horizontal component; rounded corners would be false.
  let signed=max(-y,y-h);
  let normalY=select(1.0,-1.0,y<h*0.5);
  // AIR signed-distance coverage (half fwidth/derivative rounding and native
  // raster sample locations remain open, but avoid the invented 1px fade).
  let derivatives=max(fwidth(signed),0.0001);
  let coverage=clamp(0.5-signed/derivatives,0.0,1.0);
  if(coverage<=0.0){discard;}
  let inner=refractionEnvelope(signed,state.material.x,state.material.y);
  // The observed Clear outer amount and refraction mix opacity are zero.
  // The retained P→S BLUR_ALPHA_CONTRACT transforms input alphas a0..a3
  // into [a0,a0-a1,a1-a2,a2-a3]. Public Clear inputs are all 1:
  // the actual shader lanes are therefore [1,0,0,0], making the
  // AIR distance-ramp distribution identically 1 on this finite state.
  // A synthetic blur gradient would CONTRADICT the retained evidence.
  let mip=state.material.z;
  // Browser interaction is explicitly NOT a measured SwiftUI event-to-Metal
  // mapping. Keep it restrained and make it vanish in the resting state.
  let dx=x-state.pointer.x;
  let proximity=exp(-0.5*pow(dx/max(75.0,5.0*h),2.0));
  let shift=proximity*(0.3*state.pointer.y+0.45*state.pointer.z);
  // Refraction uses the actual wallpaper cover coordinate system and
  // the strip's current scroll-relative viewport position.
  let sampleY=state.viewport.x+y+state.viewport.y+normalY*inner;
  let uv=vec2<f32>(
    (x+shift*sign(dx)-state.crop.x)/state.crop.z,
    (sampleY-state.crop.y)/state.crop.w);
  let source=textureSampleLevel(photo,samplerLinear,
    clamp(uv,vec2<f32>(0.0),vec2<f32>(1.0)),mip);
  // Exactly the existing wallpaper's 12% neutral veil, not glass tint.
  let veiled=mix(source.rgb,vec3<f32>(19.0,20.0,21.0)/255.0,state.material.w);
  // Apply public Clear face INPUT endpoints as a browser-stage projection.
  // Their native executed color matrix and output/EDR chain are not closed.
  let face=vec3<f32>(0.05)+(vec3<f32>(0.80)-vec3<f32>(0.05))*veiled;
  // The directly observed face-fill INPUT is white with 0.05 alpha.
  // Applying it by linear browser mixing is provisional: the executed native
  // face matrix/fill compositing and ColorSync/EDR output remain unproved.
  let color=mix(face,vec3<f32>(1.0),0.05);
  // Temporary browser preview controls only (NOT native Clear filter inputs).
  // Exact operation order is recorded in the on-screen copyable preset.
  // Default brightness=1, contrast=1, strength=0 restores original output.
  let contrasted=clamp((color-vec3<f32>(0.5))*state.tuning.y+vec3<f32>(0.5),
    vec3<f32>(0.0),vec3<f32>(1.0));
  let brightened=clamp(contrasted*state.tuning.x,
    vec3<f32>(0.0),vec3<f32>(1.0));
  let adjusted=mix(brightened,state.tint.rgb,state.tuning.z);
  return vec4<f32>(adjusted*coverage,coverage);
}
