/* Exact authored two-by-two RGBA8 reduction in browser texture domain.
 * This is NOT a recovered native Apple mipmap kernel. */
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var destination:texture_storage_2d<rgba8unorm,write>;
@compute @workgroup_size(8,8)
fn downsample(@builtin(global_invocation_id) id:vec3<u32>){
  let size=textureDimensions(destination);
  if(id.x>=size.x||id.y>=size.y){return;}
  let sourceSize=textureDimensions(source);
  let xy=vec2<i32>(id.xy*2u);
  let last=vec2<i32>(sourceSize)-vec2<i32>(1);
  let a=textureLoad(source,min(xy,last),0);
  let b=textureLoad(source,min(xy+vec2<i32>(1,0),last),0);
  let c=textureLoad(source,min(xy+vec2<i32>(0,1),last),0);
  let d=textureLoad(source,min(xy+vec2<i32>(1,1),last),0);
  textureStore(destination,vec2<i32>(id.xy),(a+b+c+d)*0.25);
}
