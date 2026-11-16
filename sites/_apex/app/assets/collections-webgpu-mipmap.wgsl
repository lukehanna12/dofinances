/* Explicit RGBA16Float GPU-resident mip hierarchy, analogous to the
 * repo's Home glass mip precision. The 2x2 reduction and browser filtering
 * remain candidates, NOT proven Apple M2/G14G kernel/sampler equivalence.
 * Source and destination are disjoint mip subresources. */
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var destination:texture_storage_2d<rgba16float,write>;
@compute @workgroup_size(8,8,1)
fn copyBase(@builtin(global_invocation_id) gid:vec3<u32>){
  let dims=textureDimensions(destination);
  if(any(gid.xy>=dims)){return;}
  textureStore(destination,vec2<i32>(gid.xy),
    textureLoad(source,vec2<i32>(gid.xy),0));
}
@compute @workgroup_size(8,8,1)
fn downsample(@builtin(global_invocation_id) gid:vec3<u32>){
  let dims=textureDimensions(destination);
  if(any(gid.xy>=dims)){return;}
  let sourceSize=textureDimensions(source,0);
  let base=vec2<i32>(gid.xy)*2;
  let last=vec2<i32>(sourceSize)-vec2<i32>(1);
  let a=textureLoad(source,min(base,last),0);
  let b=textureLoad(source,min(base+vec2<i32>(1,0),last),0);
  let c=textureLoad(source,min(base+vec2<i32>(0,1),last),0);
  let d=textureLoad(source,min(base+vec2<i32>(1,1),last),0);
  textureStore(destination,vec2<i32>(gid.xy),((a+b)+c+d)*0.25);
}
