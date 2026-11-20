/* Explicit GPU mip pyramid, one level per compute pass.
 * Source and destination views are DISJOINT mip subresources of the SAME
 * RGBA16Float scene texture. The source is always GPU-resident.
 *
 * GAP R-MIP-KERNEL: 2x2 arithmetic box reduction is an EXPLICIT, deterministic
 * candidate kernel, NOT proven equivalent to Apple's G14G mip producer.
 * The output is actual texture mip levels and is sampled through textureLoad
 * in gpu-glass.wgsl; no feGaussianBlur, Canvas2D pixels, or fake mip LOD.
 * GAP R-PRECISION: stores quantize each level to binary16; exact Apple native
 * reduction operation order and GPU half semantics still await verification.
 */
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba16float,write>;

@compute @workgroup_size(8,8,1)
fn mip2x2(@builtin(global_invocation_id) gid: vec3<u32>) {
  let size = textureDimensions(dst);
  if (gid.x >= size.x || gid.y >= size.y) { return; }
  let sourceSize = vec2<i32>(textureDimensions(src, 0));
  let base = vec2<i32>(gid.xy) * 2;
  let last = sourceSize - vec2<i32>(1);
  let a = textureLoad(src, min(base, last), 0);
  let b = textureLoad(src, min(base + vec2<i32>(1,0), last), 0);
  let c = textureLoad(src, min(base + vec2<i32>(0,1), last), 0);
  let d = textureLoad(src, min(base + vec2<i32>(1,1), last), 0);
  // Explicit accumulation order (do not "optimize" until proven equivalent).
  let result = ((a+b)+c+d) * 0.25;
  textureStore(dst, vec2<i32>(gid.xy), result);
}
