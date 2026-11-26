// Continuous counterpart of retained AIR supercircle algebra, not native execution.
// Coordinates are centered logical points. The native shading normal is NOT grad(distance).
// Oracle 6a10a83 / glass_background_sdf_no_bleed_lph.ssa.json.gz, lines 1062–1154.
// No production imports. The precision diagnostic is an owned arithmetic model, not G14G proof.
const K=1.5286649465560913, C=0.9260540008544922, B=3.1560099124908447,
 D=-3.6412200927734375, E=1.268030047416687, F=0.2685309946537018,
 L=0.5286650061607361, M=0.6541655659675598, N=0.3458344340324402;
const sat=x=>Math.max(0,Math.min(1,x)),mix=(a,b,t)=>a+(b-a)*t;
const v=(x,dx=0,dy=0)=>({x,dx,dy});
const add=(a,b)=>v(a.x+b.x,a.dx+b.dx,a.dy+b.dy);
const sub=(a,b)=>v(a.x-b.x,a.dx-b.dx,a.dy-b.dy);
const mul=(a,b)=>v(a.x*b.x,a.dx*b.x+a.x*b.dx,a.dy*b.x+a.x*b.dy);
const scale=(a,s)=>v(a.x*s,a.dx*s,a.dy*s);
const div=(a,b)=>v(a.x/b.x,(a.dx-a.x/b.x*b.dx)/b.x,(a.dy-a.x/b.x*b.dy)/b.x);
const max=(a,b)=>a.x>b.x?a:b.x>a.x?b:(a.dx===b.dx&&a.dy===b.dy?a:v(a.x,NaN,NaN));
const min=(a,b)=>scale(max(scale(a,-1),scale(b,-1)),-1);
const clamp=a=>min(max(a,v(0)),v(1));
const hypot=(a,b)=>{const h=Math.hypot(a.x,b.x);return h===0?
 v(0,a.dx===0&&a.dy===0&&b.dx===0&&b.dy===0?0:NaN,a.dx===0&&a.dy===0&&b.dx===0&&b.dy===0?0:NaN):
 v(h,(a.x*a.dx+b.x*b.dx)/h,(a.x*a.dy+b.x*b.dy)/h);};
const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
function requireInputs(x,y,hw,hh,r,bx,by){
 if(![x,y,hw,hh,r,bx,by].every(Number.isFinite)||hw<=0||hh<=0||r<=0||bx<0||bx>1||by<0||by>1)
  throw new RangeError("Positive radius and half extents; finite coordinates; blend lanes in [0,1]");
}
function quadrant(x,y,hw,hh,r,bx,by){
 requireInputs(x,y,hw,hh,r,bx,by);
 const k=r*K, adj=mix(k,r,Math.max(bx,by));
 const qx=v(x-hw,1,0),qy=v(y-hh,0,1);
 const hx=add(qx,v(adj)),hy=add(qy,v(adj));
 const nx=max(v(0),scale(add(qx,v(k)),1/k)),ny=max(v(0),scale(add(qy,v(k)),1/k));
 const rad=hypot(nx,ny),big=max(nx,ny),small=min(nx,ny);
 const u=big.x>0?clamp(div(small,big)):v(0);
 const polynomial=add(mul(add(mul(add(mul(sub(v(B),scale(u,C)),u),v(D)),u),v(E)),u),v(F));
 const denom=sub(v(1),mul(mul(mul(u,u),clamp(rad)),polynomial));
 if(!(denom.x>0))throw new RangeError("Unexpected nonpositive rational denominator");
 const rounded=sub(add(rad,v(1)),div(v(1),denom));
 const sx=max(v(0),sub(scale(nx,K),v(L))),sy=max(v(0),sub(scale(ny,K),v(L)));
 const smooth=add(scale(hypot(sx,sy),M),v(N));
 const a=lerp(rounded,smooth,v(bx)),b=lerp(rounded,smooth,v(by));
 const sign=ny.x>nx.x?1:-1;
 // For equal blend lanes this term cancels exactly; don't propagate artificial tie derivatives.
 const value=bx===by?a:lerp(a,b,clamp(add(v(.5-sign),scale(u,sign))));
 const normalized=sub(value,v(1));
 const inner=min(max(hx,hy),v(0));
 const field=add(inner,scale(normalized,k));
 const px=Math.max(0,hx.x),py=Math.max(0,hy.x),len=Math.hypot(px,py);
 const normal=len>0?[px/len,py/len]:hx.x>hy.x?[1,0]:[0,1];
 // Only promise derivatives on certified smooth branches. A null is not evidence of a singularity.
 return {distance:field.x,gradient:[field.dx,field.dy].every(Number.isFinite)?[field.dx,field.dy]:null,
  opticalNormal:normal,normalized:normalized.x,inner:inner.x,k,hx:hx.x,hy:hy.x,denominator:denom.x};
}
// AIR 895–933 and 999–1037: radial-normal mix, renormalization, then
// explicit 2x2 normal transform. Coordinates and matrix here are y-down.
function postNormal(n,x,y,w,h,normalBlend,normalMatrix){
 if(!Number.isFinite(normalBlend)||normalBlend<0||normalBlend>1||!Array.isArray(normalMatrix)||normalMatrix.length!==4||!normalMatrix.every(Number.isFinite))throw new RangeError("Invalid normal state");
 const length=Math.hypot(x,y*w/h);
 if(normalBlend!==0&&length===0)return null;
 const radial=length===0?[0,0]:[x/length,(y*w/h)/length];
 const m=n.map((a,i)=>mix(a,radial[i],normalBlend)),l=Math.hypot(...m);
 if(l===0)return null;
 const [a,b,c,d]=normalMatrix;return [(a*m[0]+b*m[1])/l,(c*m[0]+d*m[1])/l];
}
export function mode4Field(x,y,width,height,radius,{blendX=0,blendY=0,normalBlend=0,normalMatrix=[1,0,0,1]}={}){
 const a=quadrant(Math.abs(x),Math.abs(y),width/2,height/2,radius,blendX,blendY);
 const sx=x>=0?1:-1,sy=y>=0?1:-1;
 return {...a,gradient:a.gradient&&x!==0&&y!==0?[a.gradient[0]*sx,a.gradient[1]*sy]:null,
  opticalNormal:postNormal([a.opticalNormal[0]*sx,a.opticalNormal[1]*sy],x,y,width,height,normalBlend,normalMatrix)};
}
const factor=(r,h)=>r>=0?1:sat((-K-h/r)*-1.891557216644287);
export function mode5Field(x,y,width,height,radii,{normalBlend=0,normalMatrix=[1,0,0,1]}={}){
 if(!Array.isArray(radii)||radii.length!==4||!radii.every(r=>Number.isFinite(r)&&r!==0))
  throw new RangeError("Four explicit nonzero signed private radius lanes required");
 const [tl,tr,br,bl]=radii,hw=width/2,hh=height/2;
 const a=factor((tl+tr)/2,hw),b=factor((tl+bl)/2,hh),c=factor((bl+br)/2,hw),d=factor((tr+br)/2,hh);
 // Same candidate order/strict maximum as the production AIR-derived adapter.
 const corners=[[1,-1,tr,a,d],[-1,-1,tl,a,b],[1,1,br,c,d],[-1,1,bl,c,b]];
 const results=corners.map(([sx,sy,r,bx,by],corner)=>{
  const z=quadrant(sx*x,sy*y,hw,hh,Math.abs(r),bx,by);
  return {...z,corner,gradient:z.gradient?[sx*z.gradient[0],sy*z.gradient[1]]:null,opticalNormal:[sx*z.opticalNormal[0],sy*z.opticalNormal[1]]};
 });
 let best=results[0];for(const r of results.slice(1))if(r.distance>best.distance)best=r;
 const ties=results.filter(r=>r.distance===best.distance).length;
 return {...best,gradient:ties===1?best.gradient:null,ties,opticalNormal:postNormal(best.opticalNormal,x,y,width,height,normalBlend,normalMatrix)};
}
// IEEE binary16 round-to-nearest-even for finite JS numbers; no claim about native fast-math/FTZ.
export function half(x){
 if(!Number.isFinite(x)||x===0)return x;
 const s=Math.sign(x),a=Math.abs(x);if(a>=65520)return s*Infinity;
 const step=2**(Math.max(-14,Math.floor(Math.log2(a)))-10),q=a/step,k=Math.floor(q),f=q-k;
 return s*(k+(f>.5||(f===.5&&k%2===1)?1:0))*step;
}
export function distanceCastDiagnostic(field){
 const {k,normalized,hx,hy,distance}=field;
 const first=half(normalized),scaled=half(k*first);
 const inner=Math.min(0,Math.max(half(hx),half(hy)));
 return {continuous:distance,finalOnly:half(distance),airCastOrder:half(inner+scaled)};
}
export function normalMismatch(field){
 if(!field.gradient||!field.opticalNormal)return null;
 const l=Math.hypot(...field.gradient);if(l===0)return null;
 const n=field.gradient.map(x=>x/l);
 return Math.atan2(Math.abs(n[0]*field.opticalNormal[1]-n[1]*field.opticalNormal[0]),
  n[0]*field.opticalNormal[0]+n[1]*field.opticalNormal[1]);
}
