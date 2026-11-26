// Experimental logical-space evaluator. No production use or native equivalence claim.
// The box kernel and existing authored interaction terms are explicitly candidate operators.
struct Query {
 pointSize:vec4<f32>, geometry:vec4<f32>, radii:vec4<f32>, source:vec4<f32>,
 material:vec4<f32>, pointer:vec4<f32>, tint:vec4<f32>,
 face0:vec4<f32>,face1:vec4<f32>,face2:vec4<f32>,interaction:vec4<f32>
}
struct Result {field:vec4<f32>,source:vec4<f32>,color:vec4<f32>}
struct Scene {grid:vec4<f32>,step:vec4<f32>}
@group(0) @binding(0) var<storage,read> queries:array<Query>;
@group(0) @binding(1) var<storage,read> texels:array<vec4<f32>>;
@group(0) @binding(2) var<uniform> scene:Scene;
@group(0) @binding(3) var<storage,read_write> results:array<Result>;
const K:f32=1.5286649465560913;
fn sat(x:f32)->f32{return clamp(x,0.0,1.0);}
fn normalizedOrZero(p:vec2<f32>)->vec2<f32>{
 let l=length(p);if(l>0.0){return p/l;}return vec2<f32>(0.0);
}
fn quadrant(p:vec2<f32>,h:vec2<f32>,radius:f32,blend:vec2<f32>)->vec3<f32>{
 let r=abs(radius);let k=r*K;
 let q=p-h;let a=mix(k,r,max(blend.x,blend.y));let xy=q+vec2<f32>(a);
 let n=max((q+vec2<f32>(k))/k,vec2<f32>(0.0));
 let rad=length(n);let big=max(n.x,n.y);var u=0.0;
 if(big>0.0){u=sat(min(n.x,n.y)/big);}
 let polynomial=(((3.1560099124908447-u*0.9260540008544922)*u-3.6412200927734375)*u+1.268030047416687)*u+0.2685309946537018;
 let denominator=1.0-u*u*sat(rad)*polynomial;
 let rounded=rad+1.0-1.0/denominator;
 let smoothValue=length(max(n*K-vec2<f32>(0.5286650061607361),vec2<f32>(0.0)))*0.6541655659675598+0.3458344340324402;
 let axis=select(-1.0,1.0,n.y>n.x);let control=sat(0.5-axis+axis*u);
 let value=mix(mix(rounded,smoothValue,blend.x),mix(rounded,smoothValue,blend.y),control);
 let v=max(xy,vec2<f32>(0.0));
 var normal=vec2<f32>(select(0.0,1.0,xy.x>xy.y),select(1.0,0.0,xy.x>xy.y));
 if(length(v)>0.0){normal=normalizedOrZero(v);}
 return vec3<f32>(min(max(xy.x,xy.y),0.0)+k*(value-1.0),normal);
}
fn factor(r:f32,h:f32)->f32{if(r>=0.0){return 1.0;}return sat((-K-h/r)*-1.891557216644287);}
fn geometry(q:Query)->vec3<f32>{
 let p=q.pointSize.xy;let h=q.pointSize.zw*.5;let r=q.geometry.x;
 if(q.geometry.y==4.0){
  let a=quadrant(abs(p),h,r,vec2<f32>(0.0));
  return vec3<f32>(a.x,a.yz*select(vec2<f32>(-1.0),vec2<f32>(1.0),p>=vec2<f32>(0.0)));
 }
 if(q.geometry.y==5.0){
  let tl=q.radii.x;let tr=q.radii.y;let br=q.radii.z;let bl=q.radii.w;
  let a=factor((tl+tr)*.5,h.x);let b=factor((tl+bl)*.5,h.y);
  let c=factor((bl+br)*.5,h.x);let d=factor((tr+br)*.5,h.y);
  let s0=vec2<f32>(1.0,-1.0);let s1=vec2<f32>(-1.0,-1.0);
  let s2=vec2<f32>(1.0,1.0);let s3=vec2<f32>(-1.0,1.0);
  var v=quadrant(p*s0,h,tr,vec2<f32>(a,d));v=vec3<f32>(v.x,v.yz*s0);
  let z1=quadrant(p*s1,h,tl,vec2<f32>(a,b));if(z1.x>v.x){v=vec3<f32>(z1.x,z1.yz*s1);}
  let z2=quadrant(p*s2,h,br,vec2<f32>(c,d));if(z2.x>v.x){v=vec3<f32>(z2.x,z2.yz*s2);}
  let z3=quadrant(p*s3,h,bl,vec2<f32>(c,b));if(z3.x>v.x){v=vec3<f32>(z3.x,z3.yz*s3);}
  return v;
 }
 let a=abs(p)-(h-vec2<f32>(r));let b=max(a,vec2<f32>(0.0));let rho=length(b);
 let d=rho+min(max(a.x,a.y),0.0)-r;
 var normal=vec2<f32>(0.0);
 if(rho>0.0){normal=b/rho*sign(p);}
 else if(a.x>a.y){normal=vec2<f32>(sign(p.x),0.0);}
 else if(a.y>a.x){normal=vec2<f32>(0.0,sign(p.y));}
 return vec3<f32>(d,normal);
}
fn envelope(d:f32,a:f32,h:f32)->f32{
 let t=sat(-d/h);let u=1.0-t;return a*u*u/(1.0+sqrt(t*(2.0-t)));
}
// Integral of a linear basis segment over its overlap with [lo,hi].
fn branchWeight(lo:f32,hi:f32,a:f32,b:f32,rising:bool)->f32{
 let x=max(lo,a);let y=min(hi,b);if(y<=x){return 0.0;}
 let m=(x-a+(y-a))*.5;return (y-x)*select(1.0-m,m,rising);
}
fn axisWeight(n:u32,i:u32,lo:f32,hi:f32)->f32{
 if(n==1u){return 1.0;}
 let x=f32(i);let last=f32(n-1u);
 if(hi<=lo){return max(0.0,1.0-abs(clamp(lo,0.0,last)-x));}
 var z=0.0;
 if(i>0u){z+=branchWeight(lo,hi,x-1.0,x,true);}
 else{z+=max(0.0,min(hi,0.0)-lo);}
 if(i+1u<n){z+=branchWeight(lo,hi,x,x+1.0,false);}
 else{z+=max(0.0,hi-max(lo,last));}
 return z/(hi-lo);
}
fn integrateSource(center:vec2<f32>,radius:vec2<f32>)->vec4<f32>{
 let n=vec2<u32>(scene.grid.xy);let p=(center-scene.grid.zw)/scene.step.xy;let r=radius/scene.step.xy;
 let lo=p-r;let hi=p+r;var out=vec4<f32>(0.0);
 // Small-source reference evaluator. Only occupied supports are visited.
 let start=vec2<u32>(floor(clamp(lo,vec2<f32>(0.0),vec2<f32>(n-vec2<u32>(1u)))));
 let end=vec2<u32>(ceil(clamp(hi,vec2<f32>(0.0),vec2<f32>(n-vec2<u32>(1u)))));
 for(var y=start.y;y<=end.y;y++){
  let wy=axisWeight(n.y,y,lo.y,hi.y);
  for(var x=start.x;x<=end.x;x++){
   let wx=axisWeight(n.x,x,lo.x,hi.x);out+=texels[y*n.x+x]*(wx*wy);
  }
 }
 return out;
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=arrayLength(&queries)){return;}let q=queries[i];
 let f=geometry(q);let disp=envelope(f.x,q.geometry.z,q.geometry.w);
 // Existing authored interaction, now in logical point units; not a recovered native law.
 let d=min(q.pointSize.z,q.pointSize.w);let reach=max(24.0,d*.8)*clamp(q.pointSize.zw/max(d,1.0),vec2<f32>(1.0),vec2<f32>(2.4));
 let rel=(q.pointSize.xy-q.pointer.xy)/reach;let prox=exp(-dot(rel,rel));
 let hover=q.interaction.x;let press=q.interaction.y;
 let shift=prox*(rel*(hover*.55+press*1.1)+q.pointer.zw*(hover*.42+press*.65));
 let src=integrateSource(q.source.xy+f.yz*disp+shift,q.source.zw);
 let rim=exp(-abs(f.x)*1.16);let edge=clamp(rim*.28,0.0,.28);
 let light=prox*(hover*.075+press*.06)+rim*prox*press*.035;
 var color:vec3<f32>;
 if(q.material.x==1.0){
  color=clamp(vec3<f32>(dot(src.rgb,q.face0.xyz)+q.face0.w,dot(src.rgb,q.face1.xyz)+q.face1.w,dot(src.rgb,q.face2.xyz)+q.face2.w)+vec3<f32>((edge+light)*.75),vec3<f32>(0.0),vec3<f32>(1.0));
 }else{
  color=vec3<f32>(q.material.y)+clamp(src.rgb+vec3<f32>(edge+light),vec3<f32>(0.0),vec3<f32>(1.0))*(q.material.z-q.material.y);
 }
 color=mix(color,q.tint.rgb,sat(q.tint.a)*q.material.w);
 results[i]=Result(vec4<f32>(f,disp),src,vec4<f32>(color,select(0.0,1.0,f.x<=0.0)));
}
