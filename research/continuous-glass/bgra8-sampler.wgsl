// Finite BGRA8 numerical compatibility with explicit integer rounding.
// All intermediate nonnegative half values are exact multiples of 2^-24.
struct Params { dims:vec4<u32>, mode:vec4<u32> }
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> coords:array<vec2<u32>>;
@group(0) @binding(2) var<uniform> p:Params;
@group(0) @binding(3) var<storage,read_write> output:array<vec4<u32>>;
fn q24round(q:u32,r:u32,den:u32)->u32{
 let s=max(10u,31u-countLeadingZeros(max(q,1u)))-10u;
 let step=1u<<s;let base=q>>s;
 let twice=2u*((q&(step-1u))*den+r);let mid=step*den;
 let up=select(0u,1u,twice>mid||(twice==mid&&(base&1u)==1u));
 return (base+up)<<s;
}
fn sampleHalf(code:u32)->u32{
 // code is q4 encoded intensity; divide by 4080 exactly.
 let a=code*65536u;let b=(a%4080u)*256u;
 return q24round((a/4080u)*256u+b/4080u,b%4080u,4080u);
}
fn halfWord(q:u32)->u32{
 if(q<1024u){return q;}
 let msb=31u-countLeadingZeros(q);
 return ((msb-9u)<<10u)|((q>>(msb-10u))&1023u);
}
fn codes(x:u32,y:u32)->vec4<u32>{
 let v=source[y*p.dims.x+x];
 return vec4<u32>(v&255u,(v>>8u)&255u,(v>>16u)&255u,(v>>24u)&255u);
}
fn sampleBGRA(q:vec2<u32>)->vec4<u32>{
 let a=q>>vec2<u32>(8u);let f=q&vec2<u32>(255u);let b=min(a+vec2<u32>(1),p.dims.xy-vec2<u32>(1));
 let v=codes(a.x,a.y)*(256u-f.x)*(256u-f.y)+codes(b.x,a.y)*f.x*(256u-f.y)+codes(a.x,b.y)*(256u-f.x)*f.y+codes(b.x,b.y)*f.x*f.y;
 let c=(v+vec4<u32>(2048u))/vec4<u32>(4096u);
 return vec4<u32>(sampleHalf(c.x),sampleHalf(c.y),sampleHalf(c.z),sampleHalf(c.w));
}
fn halfAdd(a:vec4<u32>,b:vec4<u32>)->vec4<u32>{
 let q=a+b;return vec4<u32>(q24round(q.x,0u,1u),q24round(q.y,0u,1u),q24round(q.z,0u,1u),q24round(q.w,0u,1u));
}
fn laneFMA(a:u32,w:u32,z:u32)->u32{
 // Exact product quotient/remainder, denominator 32768; no f32 or f16 instructions.
 let low=(a&32767u)*w;
 return q24round(z+(a>>15u)*w+(low>>15u),low&32767u,32768u);
}
fn halfFMA(a:vec4<u32>,w:u32,z:vec4<u32>)->vec4<u32>{
 return vec4<u32>(laneFMA(a.x,w,z.x),laneFMA(a.y,w,z.y),laneFMA(a.z,w,z.z),laneFMA(a.w,w,z.w));
}
fn at(x:vec2<i32>,d:vec2<i32>)->vec4<u32>{
 let i=x+d+vec2<i32>(2);
 // Two independent axis tables of fixed q8 positions.
 return sampleBGRA(vec2<u32>(coords[u32(i.x)].x,coords[u32(i.y)].y));
}
fn groupSum(a:vec4<u32>,b:vec4<u32>,c:vec4<u32>,d:vec4<u32>)->vec4<u32>{return halfAdd(halfAdd(halfAdd(a,b),c),d);}
fn toByte(q:u32)->u32{
 let n=min(q,16777216u)*255u;
 let b=n>>24u;let r=n&16777215u;
 return b+select(0u,1u,r>8388608u||(r==8388608u&&(b&1u)==1u));
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=p.mode.y){return;}
 if(p.mode.x==0u){
  let v=sampleBGRA(coords[i]);
  output[i]=vec4<u32>(halfWord(v.z),halfWord(v.y),halfWord(v.x),halfWord(v.w));return;
 }
 let x=vec2<i32>(i32(i%p.dims.z),i32(i/p.dims.z));
 let outer=groupSum(at(x,vec2<i32>(0,-2)),at(x,vec2<i32>(-2,0)),at(x,vec2<i32>(2,0)),at(x,vec2<i32>(0,2)));
 let diag=groupSum(at(x,vec2<i32>(-1,-1)),at(x,vec2<i32>(1,-1)),at(x,vec2<i32>(-1,1)),at(x,vec2<i32>(1,1)));
 let inner=groupSum(at(x,vec2<i32>(0,-1)),at(x,vec2<i32>(-1,0)),at(x,vec2<i32>(1,0)),at(x,vec2<i32>(0,1)));
 var z=halfFMA(at(x,vec2<i32>(0,0)),3456u,vec4<u32>(0));
 z=halfFMA(diag,2526u,z);z=halfFMA(inner,2956u,z);z=halfFMA(outer,1846u,z);
 output[i]=vec4<u32>(toByte(z.x),toByte(z.y),toByte(z.z),toByte(z.w));
}
