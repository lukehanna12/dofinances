// Round-cap, round-join SVG stroke geometry without outline expansion or rasterization.
// A stroked centerline is the union of radius-r disks centered on its segments.
// The implicit union field is NOT necessarily Euclidean signed distance inside overlaps.
import {closestCurve} from "./vector-field.mjs";
const hyp=Math.hypot;
export function prepareStrokeUnion(svg){
 const entries=[];
 for(const op of svg.ops){
  if(op.fill||!op.stroke||op.cap!=="round"||op.join!=="round")throw new RangeError("Only opaque round strokes without fill are supported");
  for(const sub of op.subpaths)for(const curve of sub.segments){
   const xs=curve.map(p=>p[0]),ys=curve.map(p=>p[1]);
   entries.push({curve,r:op.width/2,box:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]});
  }
 }
 if(!entries.length)throw new RangeError("Empty stroke union");
 // Source parser's approximation budget applies to all arcs; conservatively attach to every curve.
 const error=svg.arcTolerance??0;
 if(!Number.isFinite(error)||error<0)throw new RangeError("Invalid curve budget");
 const extent=[Math.min(...entries.map(e=>e.box[0]-e.r-error)),Math.min(...entries.map(e=>e.box[1]-e.r-error)),Math.max(...entries.map(e=>e.box[2]+e.r+error)),Math.max(...entries.map(e=>e.box[3]+e.r+error))];
 return {entries,error,extent};
}
export function strokeImplicit(model,p,{tolerance=1e-6}={}){
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||!(tolerance>0))throw new RangeError("Invalid query");
 let lower=Infinity,upper=Infinity,nodes=0;
 const ordered=model.entries.map(e=>({e,lb:hyp(Math.max(e.box[0]-p[0],p[0]-e.box[2],0),Math.max(e.box[1]-p[1],p[1]-e.box[3],0))-e.r-model.error})).sort((a,b)=>a.lb-b.lb);
 for(const {e,lb} of ordered){
  if(lb>upper){lower=Math.min(lower,lb);continue;}
  const a=closestCurve(e.curve,p,{tolerance,maxNodes:10000});nodes+=a.nodes;
  lower=Math.min(lower,a.lower-e.r-model.error);upper=Math.min(upper,a.upper-e.r+model.error);
 }
 return {lower,upper,inside:upper<0?true:lower>0?false:null,nodes};
}
// Exact-distance reference by searching for the nearest exterior point of the union.
// The continuous implicit field is 1-Lipschitz. Interior cells with F(center)+radius<0
// contain no exterior point and can be excluded; exterior witnesses give upper bounds.
export function strokeDistance(model,p,{tolerance=.005,maxCells=100000}={}){
 if(!(tolerance>0)||!Number.isSafeInteger(maxCells)||maxCells<1)throw new RangeError("Invalid search budget");
 const eps=Math.max(1e-9,tolerance/32),f=q=>strokeImplicit(model,q,{tolerance:eps}),initial=f(p);
 if(initial.inside===false)return {signedInterval:[initial.lower,initial.upper],converged:initial.upper-initial.lower<=tolerance,cells:0,inside:false};
 if(initial.inside!==true)return {signedInterval:null,converged:false,cells:0,inside:null};
 const margin=1+model.error,exterior=[model.extent[2]+margin,p[1]];
 let best=hyp(exterior[0]-p[0],exterior[1]-p[1]);
 if(best<=0||f(exterior).inside!==false)throw Error("Exterior witness unavailable");
 // Seek tighter exterior witnesses in 16 directions. Nonmonotonicity is harmless:
 // each upper endpoint is independently known exterior.
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,dx=Math.cos(a),dy=Math.sin(a);let lo=0,hi=best;
  if(f([p[0]+dx*hi,p[1]+dy*hi]).inside!==false)continue;
  for(let j=0;j<18;j++){const m=(lo+hi)/2;if(f([p[0]+dx*m,p[1]+dy*m]).inside===false)hi=m;else lo=m;}
  best=Math.min(best,hi);
 }
 const cell=(x,y,h)=>({x,y,h,lb:hyp(Math.max(Math.abs(x-p[0])-h,0),Math.max(Math.abs(y-p[1])-h,0))});
 let stack=[cell(p[0],p[1],best)],discarded=Infinity,cells=0;
 while(stack.length&&cells<maxCells){
  const c=stack.pop();cells++;
  if(c.lb>=best-tolerance){discarded=Math.min(discarded,c.lb);continue;}
  const v=f([c.x,c.y]),r=c.h*Math.SQRT2;
  if(v.upper+r<0)continue;
  if(v.inside===false)best=Math.min(best,hyp(c.x-p[0],c.y-p[1]));
  if(v.lower-r>0){best=Math.min(best,c.lb);continue;}
  const h=c.h/2;
  if(h<Number.EPSILON*Math.max(1,Math.abs(c.x),Math.abs(c.y))){discarded=Math.min(discarded,c.lb);continue;}
  const kids=[cell(c.x-h,c.y-h,h),cell(c.x+h,c.y-h,h),cell(c.x-h,c.y+h,h),cell(c.x+h,c.y+h,h)].sort((a,b)=>b.lb-a.lb);
  stack.push(...kids);
 }
 const lower=Math.min(best,discarded,...stack.map(c=>c.lb));
 return {signedInterval:[-best,-lower],converged:best-lower<=tolerance,cells,inside:true};
}
