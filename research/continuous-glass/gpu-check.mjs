import {prepareVectorPath,contourField} from "./vector-field.mjs";
import {ContinuousScene} from "./sampling.mjs";
import {query,pointReference,createEvaluator,renderTile,OUTPUT} from "./gpu-evaluator.mjs";
const must=(c,m)=>{if(!c)throw new Error(m);};
const norm=(a,b)=>Math.abs(a-b);
const rowsNativeDark=[0x3889,0xb477,0xa732,0x3029,0xad4e,0x35f0,0xa736,0x3029,0xad4f,0xb476,0x38fa,0x3029];
// Exact production large Regular dark face words from retained native matrix.
const data=new DataView(new ArrayBuffer(2));
const half=word=>{data.setUint16(0,word,true);return data.getFloat16(0,true);};
const matrix=rowsNativeDark.map(half);
export async function run(){
 let count=0,maxField=0,maxNormal=0,maxSource=0,maxColor=0,maxDisplacement=0,identical=0,coverage=0;
 let adapter=null,render=null,precision=null,edge=null;
 for(const [sw,sh] of [[9,7],[17,13]]){
  const samples=Float32Array.from({length:sw*sh*4},(_,i)=>i%4===3?1:.5+.4*Math.sin(i*.13)*Math.cos(i*.027));
  const scene=new ContinuousScene(sw,sh,samples,{origin:[-120,-90],step:[240/(sw-1),180/(sh-1)]});
  const ev=await createEvaluator(scene);adapter=ev.adapter;
  try{
   const rows=[];
   for(const [w,h,r,mode] of [[80,64,19,4],[913,307.5,73.125,4],[160,110,20,5],[190,52,26,6],[52,190,26,6],[64,64,32,6],[911.5,8,0,6]])
    for(const density of [1,1.5,2,4])for(const zoom of [.5,1,8,128])for(const [u,v] of [[.17,.21],[-.22,.39],[.43,-.17],[.51,.48]]){
     // Exact same logical state sampled by different camera/backing maps.
     const x=u*w,y=v*h,rate=density*zoom;
     const px=x*rate/rate,py=y*rate/rate;
     for(const regular of [false,true]){
      const d=Math.min(w,h);
      rows.push(query({x:px,y:py,w,h,r,mode,radii:[-20,-3,-20,-36],amount:regular?Math.max(-60,-.8*d):-Math.min(60,d),depth:regular?Math.min(20,.25*d):Math.min(20,.36*d),sceneX:x*.25,sceneY:y*.25,blur:regular?[4,3]:[10,7],regular,rows:matrix,tint:[.8,.2,.4,.2],hover:.35,press:.2,pointer:[x*.25,y*.4,.07,-.11]}));
     }
    }
   const values=await ev.evaluate(rows),again=await ev.evaluate(rows);
   must(values.every((x,i)=>Object.is(x,again[i])),"Repeat GPU output mismatch");
   identical+=values.length;
   for(let i=0;i<rows.length;i++){
    const a=pointReference(rows[i],scene),b=values.subarray(i*OUTPUT,(i+1)*OUTPUT);
    must(b.every(Number.isFinite),"Nonfinite GPU result");
    maxField=Math.max(maxField,norm(a[0],b[0]));
    maxNormal=Math.max(maxNormal,norm(a[1],b[1]),norm(a[2],b[2]));
    maxDisplacement=Math.max(maxDisplacement,norm(a[3],b[3]));
    for(let k=4;k<8;k++)maxSource=Math.max(maxSource,norm(a[k],b[k]));
    for(let k=8;k<11;k++)maxColor=Math.max(maxColor,norm(a[k],b[k]));
    if(a[11]!==b[11])coverage++;
    count++;
   }
   if(sw===17){
    const makeQuery=(x,y)=>query({x,y,w:80,h:64,r:19,mode:4,amount:-60,depth:20,sceneX:x,sceneY:y,blur:[7,7],rows:matrix});
    const cfg={width:20,height:16,origin:[-10,-8],density:2,magnification:8,samples:4,makeQuery};
    const a=await renderTile(ev,cfg),b=await renderTile(ev,{...cfg,density:4,magnification:4});
    must(a.every((x,i)=>Object.is(x,b[i])),"Equivalent logical footprint tile differs");
    render={pixels:a.length/4,identicalWords:a.length,nonzeroAlpha:Array.from(a).filter((x,i)=>i%4===3&&x>0).length};
    const shifts=[-.00005,-.00001,-.000001,0,.000001,.00001,.00005];
    const deep=shifts.map(d=>query({x:2048+d,y:123,w:4096,h:3072,r:0,mode:6,amount:-60,depth:20,sceneX:0,sceneY:0}));
    const pv=await ev.evaluate(deep);
    const distances=shifts.map((d,i)=>pv[i*OUTPUT]),err=Math.max(...distances.map((d,i)=>Math.abs(d-shifts[i])));
    must(err<2e-9,"Deep-magnification local coordinate error "+err);
    must(distances[2]<0&&distances[4]>0,"Sub-f32 global edge offsets collapsed");
    precision={shifts,distances,maxError:err,rawGlobalCoordinatesDistinct:new Set(shifts.map(d=>Math.fround(2048+d))).size};
    const edgeConfig={width:12,height:4,origin:[39.68,-1],density:2,magnification:8,samples:16,makeQuery:(x,y)=>query({x,y,w:80,h:64,r:0,mode:6,sceneX:x,sceneY:y,blur:[0,0]})};
    const e=await renderTile(ev,edgeConfig),f=await renderTile(ev,{...edgeConfig,density:4,magnification:4});
    must(e.every((v,i)=>Object.is(v,f[i])),"Edge tile density/zoom mismatch");
    let partial=0,error=0;
    for(let i=0;i<e.length/4;i++){const alpha=e[i*4+3],x=edgeConfig.origin[0]+(i%edgeConfig.width)/16;
     if(alpha>0&&alpha<1)partial++;error=Math.max(error,Math.abs(alpha-Math.max(0,Math.min(1,(40-x)*16))));}
    must(partial>0&&error<=1/16,"Invalid partial coverage");
    edge={pixels:e.length/4,partial,maxCoverageError:error,identicalWords:e.length};
   }
  }finally{ev.dispose();}
 }
 must(maxField<.001,"Distance error "+maxField);
 must(maxNormal<.0001,"Normal error "+maxNormal);
 must(maxDisplacement<.002,"Displacement error "+maxDisplacement);
 must(maxSource<.0002,"Source error "+maxSource);
 must(maxColor<.0002,"Color error "+maxColor);
 must(coverage===0,"Point coverage mismatches "+coverage);
 const vector=await checkVectors();
 return {adapter,count,identical,maxField,maxNormal,maxDisplacement,maxSource,maxColor,coverage,render,precision,edge,vector};
}

async function checkVectors(){
 const box=(x,y,w,h)=>[[[x,y],[x+w,y]],[[x+w,y],[x+w,y+h]],[[x+w,y+h],[x,y+h]],[[x,y+h],[x,y]]];
 const lens=[[[-2,0],[0,-4],[2,0]],[[2,0],[0,4],[-2,0]]];
 const cubic=[[[-3,0],[-2,-4],[2,-3],[4,0]],[[4,0],[1,5],[-1,3],[-3,0]]];
 const outer=box(-5,-4,10,8),hole=box(-2,-1,4,2).reverse().map(s=>s.slice().reverse());
 const scenes=[[lens],[cubic],[outer,hole],[outer,box(-2,-1,4,2)]];
 const rgba=Float32Array.from({length:9*7*4},(_,i)=>i%4===3?1:.5+.25*Math.sin(i*.31));
 const scene=new ContinuousScene(9,7,rgba,{origin:[-10,-10],step:[2.5,10/3]});
 let tested=0,maxError=0,maxInterval=0,maxNodes=0,unknown=0;
 for(const contours of scenes){
  const path=prepareVectorPath(contours,{tolerance:.0005});
  const ev=await createEvaluator(scene,{path});
  try{
   const pts=[];for(const x of [-5.2,-3.6,-2.3,-.7,.6,2.7,4.3,5.4])for(const y of [-4.3,-2.6,-.45,.65,2.5,4.4])pts.push([x,y]);
   const rows=pts.map(([x,y])=>query({x,y,w:10,h:8,r:0,mode:7,amount:-8,depth:2.88,sceneX:x,sceneY:y,blur:[.5,.75],hover:.2}));
   const a=await ev.evaluate(rows);
   for(let i=0;i<rows.length;i++){
    const q=a.subarray(i*OUTPUT,(i+1)*OUTPUT),r=contourField(contours,pts[i],{tolerance:1e-7});
    if(q[11]<0){unknown++;continue;}
    must(r.distance!==null&&r.converged,"Unresolved independent CPU reference");
    must(q[12]<=Math.abs(r.distance)+1e-6&&q[13]>=Math.abs(r.distance)-1e-6,"GPU interval did not enclose reference");
    must(q[11]===(r.inside?1:0),"Path coverage mismatch");
    must(q[10]>=0&&q[10]<=1&&q.every(Number.isFinite),"Invalid optical result");
    maxError=Math.max(maxError,Math.abs(q[0]-r.distance));maxInterval=Math.max(maxInterval,q[13]-q[12]);maxNodes=Math.max(maxNodes,q[15]);tested++;
   }
   const exact=contours[0][0][0];const z=await ev.evaluate([query({x:exact[0],y:exact[1],w:10,h:8,r:0,mode:7})]);
   must(z[11]===-1,"Exact path boundary should fail closed");
  }finally{ev.dispose();}
 }
 must(unknown===0&&tested===192&&maxError<=.0005&&maxInterval<=.0005,"Path error or unresolved held-out points");
 return {tested,maxError,maxInterval,maxNodes,unknown,exactBoundaryRejected:scenes.length};
}
