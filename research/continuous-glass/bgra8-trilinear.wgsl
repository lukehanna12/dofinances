// Exact finite BGRA8 trilinear sampler; no hardware sampler or implicit float rounding.
struct Query { a:vec4<u32>, b:vec4<u32>, blend:vec4<u32> }
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> queries:array<Query>;
@group(0) @binding(2) var<storage,read_write> output:array<vec4<u32>>;
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

fn codes(i:u32)->vec4<u32>{
 let v=source[i];return vec4<u32>(v&255u,(v>>8u)&255u,(v>>16u)&255u,v>>24u);
}
fn weighted(level:vec4<u32>,qy:u32,r:u32)->vec4<u32>{
 let x=level.w>>8u;let y=qy>>8u;
 let p=level.w&255u;let q=qy&255u;
 let x1=min(x+1u,level.y-1u);let y1=min(y+1u,level.z-1u);
 let a=((256u-p)*(256u-q)*r+32u)/64u;
 let b=(p*(256u-q)*r+32u)/64u;
 let c=(256u-p)*r*4u-a;let d=p*r*4u-b;
 return codes(level.x+y*level.y+x)*a+codes(level.x+y*level.y+x1)*b+codes(level.x+y1*level.y+x)*c+codes(level.x+y1*level.y+x1)*d;
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=arrayLength(&queries)){return;}
 let q=queries[i];let p=q.blend.z;
 let v=(weighted(q.a,q.blend.x,64u-p)+weighted(q.b,q.blend.y,p)+vec4<u32>(2048u))/vec4<u32>(4096u);
 output[i]=vec4<u32>(halfWord(sampleHalf(v.z)),halfWord(sampleHalf(v.y)),halfWord(sampleHalf(v.x)),halfWord(sampleHalf(v.w)));
}
