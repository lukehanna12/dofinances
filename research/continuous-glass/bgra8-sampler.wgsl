// Native-compatible finite BGRA8 sampler and 13-tap mip evaluator.
// Buffer lanes are encoded BGRA codes, not linear-light colors.
struct Params { dims:vec4<u32>, mode:vec4<u32> }
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> coords:array<vec2<f32>>;
@group(0) @binding(2) var<uniform> p:Params;
@group(0) @binding(3) var<storage,read_write> output:array<vec4<u32>>;
fn axis(u:f32,n:u32)->vec3<u32>{
 let x=clamp(u*f32(n)-0.5,0.0,f32(n-1u));
 let a=u32(floor(x));
 return vec3<u32>(a,min(a+1u,n-1u),u32(floor((x-f32(a))*256.0+0.5)));
}
fn codes(x:u32,y:u32)->vec4<u32>{
 let v=source[y*p.dims.x+x];
 return vec4<u32>(v&255u,(v>>8u)&255u,(v>>16u)&255u,(v>>24u)&255u);
}
fn h2(v:vec2<f32>)->vec2<f32>{return unpack2x16float(pack2x16float(v));}
fn h4(v:vec4<f32>)->vec4<f32>{return vec4<f32>(h2(v.xy),h2(v.zw));}
fn sampleBGRA(u:vec2<f32>)->vec4<f32>{
 let x=axis(u.x,p.dims.x);let y=axis(u.y,p.dims.y);
 let v=codes(x.x,y.x)*(256u-x.z)*(256u-y.z)+codes(x.y,y.x)*x.z*(256u-y.z)+codes(x.x,y.y)*(256u-x.z)*y.z+codes(x.y,y.y)*x.z*y.z;
 return h4(vec4<f32>((v+vec4<u32>(2048u))/vec4<u32>(4096u))/4080.0);
}
fn at(x:vec2<f32>,d:vec2<i32>)->vec4<f32>{
 let uv=(x+vec2<f32>(d)+vec2<f32>(.5))* (vec2<f32>(1.0)/vec2<f32>(p.dims.zw));
 return sampleBGRA(uv);
}
fn groupSum(a:vec4<f32>,b:vec4<f32>,c:vec4<f32>,d:vec4<f32>)->vec4<f32>{return h4(h4(h4(a+b)+c)+d);}
fn halfWords(v:vec4<f32>)->vec4<u32>{
 let a=pack2x16float(v.xy);let b=pack2x16float(v.zw);
 return vec4<u32>(a&65535u,a>>16u,b&65535u,b>>16u);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=p.mode.y){return;}
 if(p.mode.x==0u){
  let v=sampleBGRA(coords[i]);
  output[i]=halfWords(v.zyxw);return;
 }
 let x=vec2<f32>(f32(i%p.dims.z),f32(i/p.dims.z));
 let outer=groupSum(at(x,vec2<i32>(0,-2)),at(x,vec2<i32>(-2,0)),at(x,vec2<i32>(2,0)),at(x,vec2<i32>(0,2)));
 let diag=groupSum(at(x,vec2<i32>(-1,-1)),at(x,vec2<i32>(1,-1)),at(x,vec2<i32>(-1,1)),at(x,vec2<i32>(1,1)));
 let inner=groupSum(at(x,vec2<i32>(0,-1)),at(x,vec2<i32>(-1,0)),at(x,vec2<i32>(1,0)),at(x,vec2<i32>(0,1)));
 var z=h4(at(x,vec2<i32>(0,0))*.10546875);
 z=h4(fma(diag,vec4<f32>(.07708740234375),z));
 z=h4(fma(inner,vec4<f32>(.0902099609375),z));
 z=h4(fma(outer,vec4<f32>(.05633544921875),z));
 output[i]=vec4<u32>(clamp(round(z*255.0),vec4<f32>(0),vec4<f32>(255)));
}
