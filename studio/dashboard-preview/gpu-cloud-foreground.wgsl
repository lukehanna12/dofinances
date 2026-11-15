/* Dashboard-preview-only atmospheric cloud foreground.
 * Reuses the ALREADY rendered and mipmapped original AVIF scene, with the
 * identical viewport crop. No duplicate photo/DOM overlay or synthetic cloud
 * pattern. High-luminance, low-chroma pixels identify real photographic mist;
 * the horizontal envelope restricts it to corners and outer side edges.
 * Drawn after glass, before DOM icons: input handling is unchanged.
 * This artistic veil is not a recovered native Liquid Glass parameter.
 */
@group(0) @binding(0) var backdrop: texture_2d<f32>;

struct CloudVertex {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vsCloud(@builtin(vertex_index) vertex: u32) -> CloudVertex {
  var result: CloudVertex;
  let uv=vec2<f32>(f32((vertex << 1u) & 2u), f32(vertex & 2u));
  result.uv=uv;
  result.position=vec4<f32>(uv.x*2.0-1.0, 1.0-uv.y*2.0, 0.0, 1.0);
  return result;
}

@fragment
fn fsCloud(input: CloudVertex) -> @location(0) vec4<f32> {
  let uv=input.uv;
  let sideDistance=min(uv.x,1.0-uv.x);
  // The center remains untouched; no haze across the CTA or main text.
  let side=1.0-smoothstep(0.08,0.38,sideDistance);
  if(side<=0.0){return vec4<f32>(0.0);}
  // Softly sample the SAME photograph's existing mip pyramid: the mist
  // crosses glass without a sharp, repeated/offset image edge.
  let mipLevel=min(4u,textureNumLevels(backdrop)-1u);
  let dims=vec2<i32>(textureDimensions(backdrop,mipLevel));
  let point=clamp(vec2<i32>(uv*vec2<f32>(dims)),
    vec2<i32>(0),dims-vec2<i32>(1));
  let mist=textureLoad(backdrop,point,i32(mipLevel)).rgb;
  let brightness=dot(mist,vec3<f32>(0.2126,0.7152,0.0722));
  let chroma=max(mist.r,max(mist.g,mist.b))-min(mist.r,min(mist.g,mist.b));
  // Use bright, relatively neutral cloud pixels; suppress dark mountains,
  // green water and gold color fields visible in the original source.
  let cloudiness=smoothstep(0.30,0.74,brightness)*
    (1.0-0.55*smoothstep(0.12,0.33,chroma));
  let cornerBias=smoothstep(0.08,0.93,abs(2.0*uv.y-1.0));
  let envelope=side*mix(0.47,1.0,cornerBias);
  let alpha=0.54*cloudiness*envelope;
  let color=mix(mist,vec3<f32>(0.93,0.94,0.96),0.22);
  return vec4<f32>(color,alpha);
}
