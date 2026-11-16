/* GPU-controlled backdrop. Source asset is a dynamic GPU texture; the output
 * is an offscreen RGBA16Float scene owned by the compositor, not a DOM screenshot.
 * The scene is explicitly extensible to procedural/video/other GPU layers.
 * GAP Q: browser presentation/color conversion is not Apple's output chain.
 */
struct Globals {
  viewport: vec4<f32>,   // physical width, physical height, seconds since start, DPR
  fit: vec4<f32>,        // image cover UV scale X, Y, dark-veil opacity, reserved
  pointer: vec4<f32>,    // physical pointer X, Y, enabled flag, reserved
};
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var imageSampler: sampler;
@group(0) @binding(2) var<uniform> state: Globals;

struct FullscreenOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vsScene(@builtin(vertex_index) vertex: u32) -> FullscreenOutput {
  var output: FullscreenOutput;
  let uv = vec2<f32>(f32((vertex << 1u) & 2u), f32(vertex & 2u));
  output.uv = uv;
  output.position = vec4<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  return output;
}

@fragment
fn fsScene(input: FullscreenOutput) -> @location(0) vec4<f32> {
  let imageUV = (input.uv - vec2<f32>(0.5)) * state.fit.xy + vec2<f32>(0.5);
  let native = textureSampleLevel(image, imageSampler, clamp(imageUV, vec2<f32>(0.0), vec2<f32>(1.0)), 0.0);
  // GAP PUBLIC-SCENE: precisely matches the preview's authored 12% gray
  // overlay, not a recovered native Glass face-color matrix.
  let veiled = mix(native.rgb, vec3<f32>(19.0/255.0,20.0/255.0,21.0/255.0), state.fit.z);
  return vec4<f32>(veiled, 1.0);
}
