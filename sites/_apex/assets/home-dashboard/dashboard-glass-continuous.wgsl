// Bounded vector evaluation using a hierarchical control-hull index.
struct Curve {a:vec2<f32>,b:vec2<f32>,c:vec2<f32>,d:vec2<f32>,degreeInfo:vec4<f32>}
struct Piece {a:vec2<f32>,b:vec2<f32>,c:vec2<f32>,d:vec2<f32>}
@group(0) @binding(15) var<storage,read> curves:array<Curve>;
fn curvePoint(c:Piece,t:f32)->vec2<f32>{
 let a=mix(c.a,c.b,t);let b=mix(c.b,c.c,t);let d=mix(c.c,c.d,t);
 return mix(mix(a,b,t),mix(b,d,t),t);
}
fn boxDistance(a:vec2<f32>,b:vec2<f32>,p:vec2<f32>)->f32{
 return length(max(max(a-p,p-b),vec2<f32>(0.0)));
}
fn pieceLower(c:Piece,p:vec2<f32>)->f32{
 return boxDistance(min(min(c.a,c.b),min(c.c,c.d)),max(max(c.a,c.b),max(c.c,c.d)),p);
}
fn segmentParameter(a:vec2<f32>,b:vec2<f32>,p:vec2<f32>)->f32{
 let d=b-a;return clamp(dot(p-a,d)/max(dot(d,d),1e-20),0.0,1.0);
}
fn curveNearest(c:Curve,p:vec2<f32>,prior:vec3<f32>,tol:f32)->vec3<f32>{
 var best=prior;
 let root=Piece(c.a,c.b,c.c,c.d);
 if(pieceLower(root,p)>best.x+0.000002){return best;}
 if(c.degreeInfo.x==1.0){
  let near=mix(c.a,c.d,segmentParameter(c.a,c.d,p));let d=length(near-p);
  if(d<best.x){best=vec3<f32>(d,near);}
  return best;
 }
 var stack:array<Piece,20>;stack[0]=root;var count=1u;var iterations=0u;
 loop{
  if(count==0u||iterations>=1024u){break;}
  iterations++;count--;let v=stack[count];
  if(pieceLower(v,p)>=best.x-tol*.5){continue;}
  let t=segmentParameter(v.a,v.d,p);let chord=mix(v.a,v.d,t);
  let near=curvePoint(v,t);let d=length(near-p);
  if(d<best.x){best=vec3<f32>(d,near);}
  // A Bezier curve minus its linearly parameterized chord is itself
  // a Bezier with controls (0,b-L(1/3),c-L(2/3),0).
  // Convex hull gives a conservative bound on Euclidean deviation.
  let dev=max(length(v.b-mix(v.a,v.d,1.0/3.0)),length(v.c-mix(v.a,v.d,2.0/3.0)));
  if(length(chord-p)-dev>=best.x-tol*.5||dev<=tol*.25){continue;}
  if(count+2u>20u){break;}
  let a=(v.a+v.b)*.5;let b=(v.b+v.c)*.5;let c0=(v.c+v.d)*.5;
  let d0=(a+b)*.5;let e=(b+c0)*.5;let mid=(d0+e)*.5;
  let l=Piece(v.a,a,d0,mid);let r=Piece(mid,e,c0,v.d);
  if(pieceLower(l,p)<pieceLower(r,p)){stack[count]=r;stack[count+1u]=l;}
  else{stack[count]=l;stack[count+1u]=r;}count+=2u;
 }
 return best;
}
fn crossing(c:Curve,p:vec2<f32>)->bool{
 let up=c.a.y<=p.y&&c.d.y>p.y;let down=c.d.y<=p.y&&c.a.y>p.y;
 if(!up&&!down){return false;}
 if(c.degreeInfo.x==1.0){return mix(c.a.x,c.d.x,(p.y-c.a.y)/(c.d.y-c.a.y))>p.x;}
 var lo=0.0;var hi=1.0;let root=Piece(c.a,c.b,c.c,c.d);
 for(var i=0u;i<22u;i++){let m=(lo+hi)*.5;if((curvePoint(root,m).y<=p.y)==up){lo=m;}else{hi=m;}}
 return curvePoint(root,(lo+hi)*.5).x>p.x;
}
fn pathDistance(p:vec2<f32>,root:u32,tol:f32)->f32{
 var best=vec3<f32>(1e10,0.0,0.0);var inside=false;
 var stack:array<u32,24>;stack[0]=root;var count=1u;
 loop{
  if(count==0u){break;}count--;let node=curves[stack[count]];
  let ray=p.y>=node.a.y&&p.y<node.b.y&&p.x<=node.b.x;
  let close=boxDistance(node.a,node.b,p)<best.x+0.000002;
  if(!ray&&!close){continue;}
  if(node.degreeInfo.x == -2.0){
   for(var i=0u;i<u32(node.d.y);i++){
    let c=curves[u32(node.d.x)+i];
    if(ray&&crossing(c,p)){inside=!inside;}
    if(close){best=curveNearest(c,p,best,tol);}
   }
  }else{
   let l=u32(node.c.x);let r=u32(node.c.y);
   let a=curves[l];let b=curves[r];
   if(boxDistance(a.a,a.b,p)<boxDistance(b.a,b.b,p)){stack[count]=r;stack[count+1u]=l;}
   else{stack[count]=l;stack[count+1u]=r;}count+=2u;
  }
 }
 return select(best.x,-best.x,inside);
}
fn continuousIconField(icon:GlassSilhouette,local:vec2<f32>)->vec3<f32>{
 let h=curves[u32(icon.coverageMeta.w)-1u];
 let size=vec2<f32>(h.c.y,h.degreeInfo.x);
 let fit=min(icon.rect.z/size.x,icon.rect.w/size.y);
 let center=icon.rect.xy+icon.rect.zw*.5;
 let authored=h.d+size*.5+(local-center)/fit;
 let p=(authored-h.a)/h.b.x;let px=fit*h.b.x;
 let tol=max(0.000008,min(0.00012,0.025/max(px,1.0)));
 let root=u32(h.c.x);
 let sd=pathDistance(p,root,tol);
 // Retain the old authored normal-smoothing footprint, but evaluate
 // the continuous field rather than a quantized sampled distance atlas.
 let step=max(size.x,size.y)/(256.0*h.b.x);
 let dx=vec2<f32>(step,0.0);let dy=dx.yx;
 let grad=vec2<f32>(pathDistance(p+dx,root,tol)-pathDistance(p-dx,root,tol),pathDistance(p+dy,root,tol)-pathDistance(p-dy,root,tol));
 return vec3<f32>(sd*px,grad/max(length(grad),0.000001));
}
