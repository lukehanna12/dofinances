import {ContinuousScene} from "./sampling.mjs";
import {query,pointReference,createEvaluator,renderTile,OUTPUT} from "./gpu-evaluator.mjs";
const must=(c,m)=>{if(!c)throw Error(m)};
export async function run(){
 const results=[];
 for(const [w,h] of [[16,16],[257,193],[1024,768]]){
  const s=new ContinuousScene(w,h,Float32Array.from({length:w*h*4},(_,i)=>i%4===3?1:.5+.4*Math.sin(i*.13)*Math.cos(i*.027)),{origin:[10000,-20000],step:[.25,.5]});
  const ev=await createEvaluator(s,{kernel:"diamond",integrator:"direct"});
  try{
   let rows=[];
   for(const [x,y] of [[.1,.2],[w-1.13,h-1.75],[w*.5,h*.5],[-3,h*.7],[w+10,h+3],[w-6.3,h-8.4]])
   for(const [sx,sy] of [[.25,.5],[.125,.25],[.025,.05],[1,3],[4,7],[.000001,.000003]])
   for(const [px,py,mode,regular] of [[0,0,6,false],[39.2,15,4,false],[-38.9,12,4,true],[31,26,5,true]])
    rows.push(query({x:px,y:py,w:80,h:64,r:12,mode,radii:[-20,-3,-20,-36],amount:-40,depth:14,sceneX:10000+x*.25,sceneY:-20000+y*.5,diamondStep:[sx,sy],regular,tint:[.8,.2,.4,.2],hover:.2,press:.3,pointer:[3,4,.07,-.11]}));
   const a=await ev.evaluate(rows),b=await ev.evaluate(rows);
   must(a.every((x,i)=>Number.isFinite(x)&&Object.is(x,b[i])),"Non-repeatable diamond");
   let maxSource=0,maxColor=0;
   for(let i=0;i<rows.length;i++){const r=pointReference(rows[i],s,{kernel:"diamond"});for(let k=4;k<8;k++)maxSource=Math.max(maxSource,Math.abs(r[k]-a[i*OUTPUT+k]));for(let k=8;k<11;k++)maxColor=Math.max(maxColor,Math.abs(r[k]-a[i*OUTPUT+k]));}
   must(maxSource<.0002&&maxColor<.0002,"GPU source/color discrepancy "+maxSource+" "+maxColor);
   const config={width:12,height:8,origin:[-4,-4],density:2,magnification:8,samples:4,makeQuery:(x,y)=>query({x,y,w:80,h:64,r:12,mode:4,amount:0,depth:14,sceneX:10000+w*.125+x,sceneY:-20000+h*.25+y,diamondStep:[.25,.5]})};
   const c=await renderTile(ev,config),d=await renderTile(ev,{...config,density:4,magnification:4});
   must(c.every((v,i)=>Object.is(v,d[i])),"Density/magnification divergence");
   results.push({w,h,count:rows.length,maxSource,maxColor,identicalWords:a.length,tileWords:c.length,adapter:ev.adapter});
  }finally{ev.dispose();}
 }
 return {results};
}
