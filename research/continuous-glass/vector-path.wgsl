// Vector path geometry from normalized, monotone cubic controls.
// The bound uses conservative engineering guards, not certified interval arithmetic.
struct Curve {a:vec2<f32>,b:vec2<f32>,c:vec2<f32>,d:vec2<f32>,degreeInfo:vec4<f32>}
struct Piece {a:vec2<f32>,b:vec2<f32>,c:vec2<f32>,d:vec2<f32>}
struct PathResult {field:vec4<f32>,bounds:vec4<f32>}
@group(0) @binding(4) var<storage,read> curves:array<Curve>;
fn curvePoint(c:Piece,t:f32)->vec2<f32>{
 let a=mix(c.a,c.b,t);let b=mix(c.b,c.c,t);let d=mix(c.c,c.d,t);
 return mix(mix(a,b,t),mix(b,d,t),t);
}
fn lowerBound(c:Piece,p:vec2<f32>,pad:f32)->f32{
 let a=min(min(c.a,c.b),min(c.c,c.d));let b=max(max(c.a,c.b),max(c.c,c.d));
 return max(0.0,length(max(max(a-p,p-b),vec2<f32>(0.0)))-pad);
}
fn pathField(q:vec4<f32>)->PathResult{
 let p=q.xy;let tol=q.z;let scale=q.w;let pad=0.000002*max(1.0,max(abs(p.x),abs(p.y)));
 var best=1e30;var bestPoint=vec2<f32>(0.0);var lower=1e30;var nodes=0u;var parity=false;var uncertain=false;var exhausted=false;
 for(var i=0u;i<arrayLength(&curves);i++){
  let c=curves[i];let root=Piece(c.a,c.b,c.c,c.d);
  // Monotone y on each prepared piece; half-open crossing avoids shared endpoint double-counts.
  let up=c.a.y<=p.y&&c.d.y>p.y;let down=c.d.y<=p.y&&c.a.y>p.y;
  if(up||down){
   var lo=0.0;var hi=1.0;
   for(var j=0u;j<24u;j++){
    let mid=(lo+hi)*.5;let y=curvePoint(root,mid).y;
    if((y<=p.y)==up){lo=mid;}else{hi=mid;}
   }
   let x=curvePoint(root,(lo+hi)*.5).x-p.x;
   if(abs(x)<=pad){uncertain=true;}else if(x>0.0){parity=!parity;}
  }
  if(c.degreeInfo.x==1.0){
   let d=c.d-c.a;let len2=dot(d,d);var t=0.0;if(len2>0.0){t=clamp(dot(p-c.a,d)/len2,0.0,1.0);}
   let near=c.a+t*d;let dist=length(near-p);
   if(dist<best){best=dist;bestPoint=near;}lower=min(lower,max(0.0,dist-pad));nodes++;
   continue;
  }
  let d0=length(c.a-p);let d1=length(c.d-p);
  if(d0<best){best=d0;bestPoint=c.a;}if(d1<best){best=d1;bestPoint=c.d;}
  var stack:array<Piece,32>;var count=1u;stack[0]=root;
  loop{
   if(count==0u){break;}
   count--;let v=stack[count];let lb=lowerBound(v,p,pad);nodes++;
   if(lb>=best-tol*.5){lower=min(lower,lb);continue;}
   if(nodes>8192u||count+2u>32u){exhausted=true;lower=min(lower,lb);break;}
   let a=(v.a+v.b)*.5;let b=(v.b+v.c)*.5;let c0=(v.c+v.d)*.5;
   let d=(a+b)*.5;let e=(b+c0)*.5;let mid=(d+e)*.5;
   let distance=length(mid-p);if(distance<best){best=distance;bestPoint=mid;}
   let l=Piece(v.a,a,d,mid);let r=Piece(mid,e,c0,v.d);
   // Degenerate subdivision is explicitly budgeted, never declared converged.
   if(lowerBound(l,p,pad)<lowerBound(r,p,pad)){stack[count]=r;stack[count+1u]=l;}
   else{stack[count]=l;stack[count+1u]=r;}
   count+=2u;
  }
  if(exhausted){break;}
 }
 let upper=best+pad;lower=min(lower,max(0.0,best-pad));
 let resolved=!exhausted&&!uncertain&&lower>0.0&&upper-lower<=tol;
 let s=select(1.0,-1.0,parity);
 var n=vec2<f32>(0.0);if(best>0.0){n=(p-bestPoint)/best*s;}
 return PathResult(vec4<f32>(s*best*scale,n,select(0.0,1.0,resolved)),vec4<f32>(lower*scale,upper*scale,select(0.0,1.0,resolved),f32(nodes)));
}
