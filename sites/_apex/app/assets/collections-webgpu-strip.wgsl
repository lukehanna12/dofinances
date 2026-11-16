/* Collections-only WebGPU Clear glass field, using a pinned finite 25F80
 * public Clear refraction envelope. Output is un-tinted, image-only, and
 * confined to the top 7/16 of the measured black-surface/summary gap.
 * The border is a flat two-edge strip, not a substituted capsule SDF.
 * The mip reduction / output-color chain is a browser approximation. */
struct State {
  crop:vec4<f32>,         // left,top,coverWidth,coverHeight, CSS px
  viewport:vec4<f32>,     // canvasViewportY,overpull,dpr,stripHeight
  material:vec4<f32>,     // innerAmount,innerHeight,mipLOD,veilOpacity
  pointer:vec4<f32>,      // xCSS,hover,pressed,reserved
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
@fragment fn fs(@builtin(position) p:vec4<f32>) -> @location(0) vec4<f32> {
  let x=p.x/state.viewport.z;
  let y=p.y/state.viewport.z;
  let h=state.viewport.w;
  let distance=-min(y,h-y); // Negative in the strip; two straight boundaries
  let t=clamp(-distance/max(0.001,state.material.y),0.0,1.0);
  let reduction=clamp(sqrt(max(0.0,(2.0-t)*t)),0.0,1.0);
  let amount=state.material.x*(1.0-reduction);
  // Interaction responsiveness is only a restrained browser approximation:
  // native event-driven Clear lighting dynamics have not been recovered.
  let local=exp(-0.5*pow((x-state.pointer.x)/max(75.0,5.0*h),2.0));
  let response=1.0+local*(0.10*state.pointer.y+0.12*state.pointer.z);
  let outward=select(1.0,-1.0,y<h*0.5);
  let sampleY=state.viewport.x+y+state.viewport.y+outward*amount*response;
  let uv=vec2<f32>(
    (x-state.crop.x)/state.crop.z,
    (sampleY-state.crop.y)/state.crop.w);
  let sample=textureSampleLevel(photo,samplerLinear,
    clamp(uv,vec2<f32>(0.0),vec2<f32>(1.0)),state.material.z);
  // The existing wallpaper has an authored 12% uniform veil. No additional
  // material tint, face matrix, shadow or guessed darkening is introduced.
  let color=mix(sample.rgb,vec3<f32>(19.0,20.0,21.0)/255.0,state.material.w);
  let alpha=smoothstep(0.0,1.0,max(0.0,min(y,h-y)));
  return vec4<f32>(color*alpha,alpha);
}
