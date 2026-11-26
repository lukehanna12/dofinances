// Owned GPU query and tile evaluation. The production renderer never imports this module.
import {mode4Field,mode5Field} from "./native-field.mjs";
import {roundedBoxField,refractionEnvelope} from "./reference.mjs";
import {ContinuousScene} from "./sampling.mjs";
export const LANES=48,OUTPUT=12;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),dot=(a,b)=>a.reduce((z,x,i)=>z+x*b[i],0);
export function pointReference(a,scene){
 const [x,y,w,h,r]=a.logical?.geometry??a;const [, , , , ,mode,amount,depth]=a;
 const g=mode===4?mode4Field(x,y,w,h,r):mode===5?mode5Field(x,y,w,h,Array.from(a.slice(8,12))):roundedBoxField(x,y,w,h,r);
 const n=g.opticalNormal??g.gradient??[0,0],d=g.distance,disp=refractionEnvelope(d,amount,depth).displacement;
 const dim=Math.min(w,h),reach=[w,h].map(z=>Math.max(24,dim*.8)*clamp(z/Math.max(dim,1),1,2.4));
 const rel=[a[20]/reach[0],a[21]/reach[1]],prox=Math.exp(-dot(rel,rel)),hover=a[40],press=a[41];
 const shift=rel.map((v,i)=>prox*(v*(hover*.55+press*1.1)+a[22+i]*(hover*.42+press*.65)));
 const [sx,sy]=a.logical?.source??[a[12],a[13]];const src=scene.box(sx+n[0]*disp+shift[0],sy+n[1]*disp+shift[1],a[14],a[15]);
 const rim=Math.exp(-Math.abs(d)*1.16),edge=clamp(rim*.28,0,.28),light=prox*(hover*.075+press*.06)+rim*prox*press*.035;
 const color=src.slice(0,3).map((v,i)=>a[16]===1?clamp(dot(src.slice(0,3),a.slice(28+4*i,31+4*i))+a[31+4*i]+(edge+light)*.75,0,1):a[17]+clamp(v+edge+light,0,1)*(a[18]-a[17]));
 const tint=clamp(a[27],0,1)*a[19];
 return [d,...n,disp,...src,...color.map((c,i)=>c+(a[24+i]-c)*tint),d<=0?1:0];
}
export function query({x,y,w,h,r,mode=4,radii=[-r,-r,-r,-r],amount=-60,depth=20,sceneX=x,sceneY=y,blur=[4,4],regular=false,face=[.05,.8],tint=[0,0,0,0],film=.25,pointer=[0,0,0,0],hover=0,press=0,rows=[1,0,0,0,0,1,0,0,0,0,1,0]}){
 const a=Float32Array.from([x,y,w,h,r,mode,amount,depth,...radii,sceneX,sceneY,...blur,regular?1:0,...face,film,x-pointer[0],y-pointer[1],pointer[2],pointer[3],...tint,...rows,hover,press,0,0,x-w/2,-x-w/2,y-h/2,-y-h/2]);
 Object.defineProperty(a,"logical",{value:{geometry:[x,y,w,h,r],source:[sceneX,sceneY]}});
 if(a.length!==LANES||!a.every(Number.isFinite)||w<=0||h<=0||depth<=0||blur.some(v=>v<0)||![4,5,6].includes(mode)||r<0||(mode===4&&r===0)||(mode===5&&radii.some(v=>v===0))||(mode===6&&r>Math.min(w,h)/2))throw new RangeError("Invalid experimental query");
 return a;
}
export async function createEvaluator(scene){
 if(!(scene instanceof ContinuousScene))throw new TypeError("Fixed source required");
 const adapter=await navigator.gpu?.requestAdapter({powerPreference:"high-performance"});
 if(!adapter)throw new Error("No WebGPU adapter");
 const device=await adapter.requestDevice();
 const shader=device.createShaderModule({code:await(await fetch(new URL("./continuous.wgsl",import.meta.url))).text()});
 const info=await shader.getCompilationInfo();const errors=info.messages.filter(x=>x.type==="error");
 if(errors.length)throw new Error(errors.map(e=>e.lineNum+":"+e.linePos+" "+e.message).join("\n"));
 const pipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module:shader,entryPoint:"main"}});
 const make=(data,usage)=>{const buffer=device.createBuffer({size:data.byteLength,usage,mappedAtCreation:true});new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));buffer.unmap();return buffer;};
 const src=make(Float32Array.from(scene.rgba),GPUBufferUsage.STORAGE);
 const meta=make(Float32Array.from([scene.width,scene.height,0,0,...scene.step,0,0]),GPUBufferUsage.UNIFORM);
 let disposed=false;
 return {adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter},
 async evaluate(rows){
  if(disposed||!rows.length||rows.length>65536||rows.some(x=>x.length!==LANES))throw new RangeError("Invalid query batch");
  const data=new Float32Array(rows.length*LANES);rows.forEach((a,i)=>{data.set(a,i*LANES);const [x,y]=a.logical?.source??[a[12],a[13]];data[i*LANES+12]=x-scene.origin[0];data[i*LANES+13]=y-scene.origin[1];});
  const input=make(data,GPUBufferUsage.STORAGE),size=rows.length*OUTPUT*4;
  const out=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try{
   const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,src,meta,out].map((buffer,binding)=>({binding,resource:{buffer}}))});
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(rows.length/64));pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);device.queue.submit([encoder.finish()]);
   await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange()).slice();read.unmap();return values;
  }finally{input.destroy();out.destroy();read.destroy();}
 },
 dispose(){if(!disposed){disposed=true;src.destroy();meta.destroy();device.destroy();}}
 };
}
export async function renderTile(evaluator,{width,height,origin=[0,0],density=1,magnification=1,samples=4,makeQuery}){
 if(![width,height,samples].every(x=>Number.isInteger(x)&&x>0)||samples>16||!(density>0&&magnification>0)||!Number.isFinite(density*magnification))throw new RangeError("Invalid tile");
 const out=new Float32Array(width*height*4),rate=density*magnification;
 const spp=samples*samples;
 let rows=[],indices=[];
 const flush=async()=>{if(!rows.length)return;const result=await evaluator.evaluate(rows);indices.forEach((k,j)=>{const a=result[j*OUTPUT+11];out[k*4]+=result[j*OUTPUT+8]*a/spp;out[k*4+1]+=result[j*OUTPUT+9]*a/spp;out[k*4+2]+=result[j*OUTPUT+10]*a/spp;out[k*4+3]+=a/spp;});rows=[];indices=[];};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
  const px=origin[0]+(x+(sx+.5)/samples)/rate,py=origin[1]+(y+(sy+.5)/samples)/rate;
  rows.push(makeQuery(px,py));indices.push(y*width+x);if(rows.length===8192)await flush();
 }
 await flush();return out; // premultiplied linear RGBA, not display-encoded.
}
