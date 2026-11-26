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
 let adapter=null,render=null;
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
    const a=pointReference(Array.from(rows[i]),scene),b=values.subarray(i*OUTPUT,(i+1)*OUTPUT);
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
   }
  }finally{ev.dispose();}
 }
 must(maxField<.001,"Distance error "+maxField);
 must(maxNormal<.0001,"Normal error "+maxNormal);
 must(maxDisplacement<.002,"Displacement error "+maxDisplacement);
 must(maxSource<.0002,"Source error "+maxSource);
 must(maxColor<.0002,"Color error "+maxColor);
 must(coverage===0,"Point coverage mismatches "+coverage);
 return {adapter,count,identical,maxField,maxNormal,maxDisplacement,maxSource,maxColor,coverage,render};
}
