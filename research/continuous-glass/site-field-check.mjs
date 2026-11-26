// Actual integrated GPU vector evaluator versus independently regenerated
// packed authored controls (independent Float64 evaluator) and the original site's encoded mask.
import {closestCurve} from "./vector-field.mjs";
import {loadContinuousGlass} from "/site/dashboard-glass-continuous.js";
import {silhouetteMask,MASK_SIZE,MASK_INNER,MASK_PAD} from "/site/dashboard-glass-silhouette.js";
export async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),data=await loadContinuousGlass(device,"/site/");
 const code=await(await fetch("/site/dashboard-glass-continuous.wgsl")).text();
 const shader=device.createShaderModule({code:`
 struct GlassSilhouette {rect:vec4<f32>,params:vec4<f32>,tint:vec4<f32>,coverageRect:vec4<f32>,coverageMeta:vec4<f32>};
 `+code+`
 struct Query{p:vec4<f32>,extent:vec4<f32>};
 @group(0) @binding(0) var<storage,read> queries:array<Query>;
 @group(0) @binding(1) var<storage,read_write> output:array<vec4<f32>>;
 @compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=arrayLength(&queries)){return;}
 let q=queries[id.x];let v=vec4<f32>(0,0,q.extent.x,q.extent.y);
 let f=evaluateContinuousIconField(GlassSilhouette(v,vec4<f32>(0),vec4<f32>(0),vec4<f32>(0),vec4<f32>(0,0,0,q.p.w)),q.p.xy);
 output[id.x]=vec4<f32>(f/q.p.z*vec3<f32>(1,q.p.z,q.p.z),0);
 }`});
 const pipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module:shader,entryPoint:"main"}});
 const packed=await(await fetch("/site/continuous-icon-vectors.json")).json(),names=Object.keys(packed.assets),bytes=Uint8Array.from(atob(packed.curves),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),rows=[],refs=[],scales=[1,2,16,64,1024],stats=scales.map(scale=>({scale,n:0,signMismatch:0,maxError:0,sumError:0,legacyMax:0,legacySum:0,maxNormalError:0}));
 const canvas=new OffscreenCanvas(MASK_SIZE,MASK_SIZE),ctx=canvas.getContext("2d",{willReadFrequently:true});
 const bilinear=(mask,x,y)=>{let a=x-.5,b=y-.5,i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j;let f=(k,l)=>mask[2*(l*MASK_SIZE+k)+1]/255;
 return ((1-v)*((1-u)*f(i,j)+u*f(i+1,j))+v*((1-u)*f(i,j+1)+u*f(i+1,j+1))-.5)*256/MASK_INNER*24;};
 let skipped=0;
 try{
 for(const name of names){
  const asset=packed.assets[name],img=new Image();img.src="/original/"+name+".svg";await img.decode();
  const index=data.indexFor(img);if(!index)throw Error("missing index "+name);
  ctx.clearRect(0,0,MASK_SIZE,MASK_SIZE);ctx.drawImage(img,MASK_PAD,MASK_PAD,MASK_INNER,MASK_INNER);
  const alpha=ctx.getImageData(0,0,MASK_SIZE,MASK_SIZE).data,mask=silhouetteMask(Uint8Array.from({length:MASK_SIZE*MASK_SIZE},(_,i)=>alpha[i*4+3]),MASK_SIZE,MASK_SIZE);
  // Independent Float64 reference: prune using original control hulls,
  // then use the CPU subdivision solver and independent monotone-ray parity.
  const path=new Path2D(),segments=[];
  for(let j=0;j<asset.count;j++){const offset=(asset.start+j)*48;const a=Array.from({length:4},(_,i)=>[asset.origin[0]+asset.scale*view.getFloat32(offset+i*8,true),asset.origin[1]+asset.scale*view.getFloat32(offset+i*8+4,true)]);if(view.getFloat32(offset+32,true)===1)a.splice(1,2);
   path.moveTo(...a[0]);if(a.length===2)path.lineTo(...a[1]);else if(a.length===3)path.quadraticCurveTo(...a[1],...a[2]);else path.bezierCurveTo(...a[1],...a[2],...a[3]);
   segments.push({a,b:[Math.min(...a.map(p=>p[0])),Math.min(...a.map(p=>p[1])),Math.max(...a.map(p=>p[0])),Math.max(...a.map(p=>p[1]))]});
  }
  const d=(x,y)=>{const ordered=segments.map(({a,b})=>({a,lower:Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-y,0,y-b[3]))})).sort((a,b)=>a.lower-b.lower);let best=Infinity;
   for(const q of ordered){if(q.lower>best)break;const r=closestCurve(q.a,[x,y],{tolerance:1e-5,maxNodes:20000});if(!r.converged)return null;best=Math.min(best,r.distance);}
   let parity=false;for(const {a} of segments){const first=a[0],last=a.at(-1);if(!((first[1]<=y&&last[1]>y)||(last[1]<=y&&first[1]>y)))continue;
    const up=last[1]>first[1];let lo=0,hi=1;
    const evalAt=t=>{let p=a.map(p=>p.slice());while(p.length>1)p=p.slice(1).map((q,i)=>[(1-t)*p[i][0]+t*q[0],(1-t)*p[i][1]+t*q[1]]);return p[0];};
    for(let i=0;i<44;i++){let mid=(lo+hi)/2;if((evalAt(mid)[1]<=y)===up)lo=mid;else hi=mid;}
    if(evalAt((lo+hi)/2)[0]>x)parity=!parity;
   }return (parity?-1:1)*best;
  },h=24/256;
  for(let j=0;j<2;j++)for(let i=0;i<3;i++){
   const x=(i+.319)*24/3,y=(j+.683)*24/2,ref=d(x,y);
   if(ref===null){skipped++;continue;}
   const a=d(x+h,y),b=d(x-h,y),c=d(x,y+h),e=d(x,y-h);
   let n=null;if([a,b,c,e].every(v=>v!==null)){const dx=a-b,dy=c-e,len=Math.hypot(dx,dy);if(len>.001)n=[dx/len,dy/len];}
   const old=bilinear(mask,MASK_PAD+x*MASK_INNER/24,MASK_PAD+y*MASK_INNER/24);
   for(let k=0;k<scales.length;k++){const s=scales[k];rows.push(x*s,y*s,s,index,24*s,24*s,0,0);refs.push({k,ref,old,n,name});}
  }
 }
 const input=device.createBuffer({size:rows.length*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 const out=device.createBuffer({size:refs.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=device.createBuffer({size:refs.length*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 device.queue.writeBuffer(input,0,Float32Array.from(rows));
 const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:out}},{binding:15,resource:{buffer:data.buffer}}]});
 const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(refs.length/32));pass.end();enc.copyBufferToBuffer(out,0,read,0,refs.length*16);device.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);
 const values=new Float32Array(read.getMappedRange());for(let i=0;i<refs.length;i++){
  const r=refs[i],s=stats[r.k],v=values[i*4],error=Math.abs(v-r.ref),old=Math.abs(r.old-r.ref);
  if(!Number.isFinite(v))throw Error("nonfinite "+r.name);
  s.n++;s.signMismatch+=+(Math.sign(v)!==Math.sign(r.ref));s.maxError=Math.max(s.maxError,error);s.sumError+=error;s.legacyMax=Math.max(s.legacyMax,old);s.legacySum+=old;
  if(r.n)s.maxNormalError=Math.max(s.maxNormalError,Math.hypot(values[i*4+1]-r.n[0],values[i*4+2]-r.n[1]));
 }
 read.unmap();read.destroy();input.destroy();out.destroy();
 return {icons:names.length,skipped,stats:stats.map(s=>({...s,meanError:s.sumError/s.n,legacyMean:s.legacySum/s.n,maxPhysicalError:s.maxError*s.scale,legacyMaxPhysical:s.legacyMax*s.scale}))};
 }finally{data.dispose();device.destroy();}
}
