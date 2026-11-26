import {ContinuousScene} from "./sampling.mjs";
import {query,createEvaluator,OUTPUT} from "./gpu-evaluator.mjs";
const must=(c,m)=>{if(!c)throw Error(m)};
export async function run(){
 const results=[];
 for(const [w,h] of [[257,193],[1024,768]]){
  const src=Float32Array.from({length:w*h*4},(_,i)=>{
   const x=Math.floor(i/4)%w,y=Math.floor(i/(w*4)),c=i%4;
   return c===0?Math.sin(x*.031)*Math.cos(y*.039):c===1?1+(x%17-y%13)*.125:c===2?(x===w-1&&y===h-1?2:0):.375;
  });
  const scene=new ContinuousScene(w,h,src);
  const gpu=await createEvaluator(scene,{integrator:"prefix"});
  const direct=await createEvaluator(scene,{integrator:"direct"});
  try{
   const rows=[];
   for(const [x,y] of [[.24,.17],[w-1.13,h-1.75],[w*.5,h*.5],[-3,h*.7],[w+10,h+3],[w-6.3,h-8.4]])
   for(const [rx,ry] of [[0,0],[.125,.25],[2.7,4.3],[8,12],[31,18],[w*.25,h*.25],[w*1.5,h*1.5],[w*.5,.1],[.1,h*.5]])
    rows.push(query({x:2,y:3,w:80,h:64,r:12,mode:6,amount:0,depth:20,sceneX:x,sceneY:y,blur:[rx,ry]}));
   const v=await gpu.evaluate(rows);let error=0;
   for(let i=0;i<rows.length;i++){
    const a=rows[i],q=scene.box(a.logical.source[0],a.logical.source[1],a[14],a[15]);
    for(let c=0;c<4;c++)error=Math.max(error,Math.abs(q[c]-v[i*OUTPUT+4+c]));
   }
   must(error<.0002,"Prefix accuracy "+error);
   // Compare the same 128 large-footprint queries on both GPU paths.
   const bench=Array.from({length:128},(_,i)=>query({x:2,y:3,w:80,h:64,r:12,mode:6,amount:0,depth:20,sceneX:w*(.25+(i%16)/32),sceneY:h*(.25+Math.floor(i/16)/16),blur:[w*.18,h*.21]}));
   await gpu.evaluate(bench.slice(0,4));await direct.evaluate(bench.slice(0,4));
   const a=performance.now(),p=await gpu.evaluate(bench),b=performance.now(),d=await direct.evaluate(bench),c=performance.now();
   let diff=0;for(let i=0;i<bench.length;i++)for(let k=4;k<8;k++)diff=Math.max(diff,Math.abs(p[i*OUTPUT+k]-d[i*OUTPUT+k]));
   must(diff<.003,"Direct GPU accumulation contrast "+diff);
   results.push({w,h,queries:rows.length,maxReferenceError:error,comparisonQueries:bench.length,maxDirectDifference:diff,prefixMs:b-a,directMs:c-b,prefixBytes:(w+1)*(h+1)*32,sourceBytes:w*h*16});
  }finally{gpu.dispose();direct.dispose();}
 }
 return {results};
}
