// Owned experimental integer trilinear dispatch.
import {axis,lodState} from "./bgra8-sampler.mjs";
const quant=(u,n)=>{const [a,,p]=axis(u,n);return a*256+p;};
export async function createBGRA8LodGPU(){
 const adapter=await navigator.gpu?.requestAdapter({powerPreference:"high-performance"});
 if(!adapter)throw Error("No WebGPU");
 const device=await adapter.requestDevice();
 const module=device.createShaderModule({code:await(await fetch(new URL("./bgra8-trilinear.wgsl",import.meta.url))).text()});
 const errors=(await module.getCompilationInfo()).messages.filter(x=>x.type==="error");if(errors.length)throw Error(errors.map(x=>x.message).join(";"));
 const pipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module,entryPoint:"main"}});
 const make=(v)=>{const b=device.createBuffer({size:v.byteLength,usage:GPUBufferUsage.STORAGE,mappedAtCreation:true});new Uint32Array(b.getMappedRange()).set(v);b.unmap();return b;};
 let disposed=false;
 async function sample(levels,points){
  if(disposed||!levels.length||!(points instanceof Float32Array)||!points.length||points.length%4||!points.every(Number.isFinite))throw RangeError("Invalid mip query");
  const offsets=[];let count=0;
  for(const {width:w,height:h,values:v} of levels){
   if(![w,h].every(n=>Number.isInteger(n)&&n>0&&n<=4096)||!(v instanceof Uint8Array)||v.length!==w*h*4)throw RangeError("Invalid mip level");
   offsets.push(count);count+=w*h;
  }
  const packed=new Uint32Array(count);
  levels.forEach(({values:v},l)=>{for(let i=0;i<v.length/4;i++)packed[offsets[l]+i]=(v[4*i]|v[4*i+1]<<8|v[4*i+2]<<16|v[4*i+3]<<24)>>>0;});
  const n=points.length/4,q=new Uint32Array(n*12);
  for(let i=0;i<n;i++){
   const [u,v,lod]=points.subarray(4*i,4*i+3),[a,b,p]=lodState(lod,levels.length-1),A=levels[a],B=levels[b];
   q.set([offsets[a],A.width,A.height,quant(u,A.width),offsets[b],B.width,B.height,quant(u,B.width),quant(v,A.height),quant(v,B.height),p,0],i*12);
  }
  const size=n*16,buffers=[make(packed),make(q),device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})];
  const read=device.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  try{
   const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
   const cmd=device.createCommandEncoder(),pass=cmd.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();cmd.copyBufferToBuffer(buffers[2],0,read,0,size);device.queue.submit([cmd.finish()]);
   await read.mapAsync(GPUMapMode.READ);const out=Uint16Array.from(new Uint32Array(read.getMappedRange()));read.unmap();return out;
  }finally{buffers.forEach(b=>b.destroy());read.destroy();}
 }
 return {sample,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,isFallbackAdapter:adapter.info.isFallbackAdapter},dispose(){if(!disposed){disposed=true;device.destroy();}}};
}
