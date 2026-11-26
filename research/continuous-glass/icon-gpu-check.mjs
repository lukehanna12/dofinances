import {parseSilhouetteSVG} from "./production-vector-coverage.js";
import {prepareVectorPath,contourField} from "./vector-field.mjs";
import {ContinuousScene} from "./sampling.mjs";
import {query,createEvaluator,OUTPUT} from "./gpu-evaluator.mjs";
function outlinePath(contours){
 const path=new Path2D();
 for(const c of contours){
  path.moveTo(...c[0][0]);
  for(const a of c){
   if(a.length===2)path.lineTo(...a[1]);
   else if(a.length===3)path.quadraticCurveTo(...a[1],...a[2]);
   else path.bezierCurveTo(...a[1],...a[2],...a[3]);
  }
  path.closePath();
 }
 return path;
}
export async function run(){
 const names=await (await fetch("/icon-list")).json(),ctx=new OffscreenCanvas(1,1).getContext("2d"),out=[];
 const scene=new ContinuousScene(5,5,Float32Array.from({length:100},(_,i)=>i%4===3?1:(i%17)/16),{origin:[0,0],step:[6,6]});
 for(const name of names){
  const native=await (await fetch("/outline/"+name+".json")).json();
  const original=parseSilhouetteSVG(await(await fetch("/original/"+name+".svg")).text());
  const vector=outlinePath(native.contours);
  function originalContains(x,y){
   for(const op of original.ops){
    if(op.fill&&ctx.isPointInPath(op.path,x,y,op.rule))return true;
    if(op.stroke){ctx.lineWidth=op.width;ctx.lineCap=op.cap;ctx.lineJoin=op.join;ctx.miterLimit=op.miter;if(ctx.isPointInStroke(op.path,x,y))return true;}
   }return false;
  }
  const info={name,grid:0,outlineMismatch:0,maxMismatchDistance:0,gpuTested:0,gpuUnresolved:0,gpuMismatch:0,maxFieldError:0};
  const points=[];
  for(let j=0;j<48;j++)for(let i=0;i<48;i++){
   const x=(i+.319)*.5,y=(j+.683)*.5,orig=originalContains(x,y),shape=ctx.isPointInPath(vector,x,y);
   info.grid++;
   if(orig!==shape){
    info.outlineMismatch++;
    const d=contourField(native.contours,[x,y],{tolerance:1e-5});
    info.maxMismatchDistance=Math.max(info.maxMismatchDistance,Math.abs(d.distance??0));
   }
   if(i%8===2&&j%8===4)points.push([x,y,shape,orig]);
  }
  let evaluator;
  try{
   const path=prepareVectorPath(native.contours,{tolerance:.003});
   info.curves=path.curves.length/12;
   evaluator=await createEvaluator(scene,{path});
   const rows=points.map(([x,y])=>query({x,y,w:24,h:24,r:0,mode:7,amount:-8,depth:2.88,sceneX:x,sceneY:y,blur:[1,1]}));
   const values=await evaluator.evaluate(rows);
   for(let i=0;i<rows.length;i++){
    const [x,y,shape]=points[i],q=values.subarray(i*OUTPUT,(i+1)*OUTPUT);
    if(q[11]<0){info.gpuUnresolved++;continue;}
    const d=contourField(native.contours,[x,y],{tolerance:1e-6});
    if(d.distance===null||!d.converged){info.gpuUnresolved++;continue;}
    info.gpuTested++;
    if(q[11]!==+shape||q[11]!==+d.inside)info.gpuMismatch++;
    info.maxFieldError=Math.max(info.maxFieldError,Math.abs(q[0]-d.distance));
   }
  }catch(e){info.error=String(e);}
  finally{evaluator?.dispose();}
  out.push(info);
 }
 return {icons:out,summary:{icons:out.length,grid:out.reduce((s,x)=>s+x.grid,0),outlineMismatch:out.reduce((s,x)=>s+x.outlineMismatch,0),maxMismatchDistance:Math.max(...out.map(x=>x.maxMismatchDistance)),gpuTested:out.reduce((s,x)=>s+x.gpuTested,0),gpuUnresolved:out.reduce((s,x)=>s+x.gpuUnresolved,0),gpuMismatch:out.reduce((s,x)=>s+x.gpuMismatch,0),maxFieldError:Math.max(...out.map(x=>x.maxFieldError)),errors:out.filter(x=>x.error).length}};
}
