// Experimental native-compatible integer BGRA8 producer, not production rendering.
export async function createBGRA8GPU(){
 const adapter=await navigator.gpu?.requestAdapter({powerPreference:"high-performance"});
 if(!adapter)throw Error("No WebGPU");
 const device=await adapter.requestDevice();
 const source=await(await fetch(new URL("./bgra8-sampler.wgsl",import.meta.url))).text();
 const module=device.createShaderModule({code:source}),info=await module.getCompilationInfo();
 const errors=info.messages.filter(x=>x.type==="error");if(errors.length)throw Error(errors.map(x=>x.message).join(";"));
 const pipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module,entryPoint:"main"}});
 const make=(v,usage)=>{const b=device.createBuffer({size:v.byteLength,usage,mappedAtCreation:true});new Uint8Array(b.getMappedRange()).set(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));b.unmap();return b;};
 let disposed=false;
 async function execute(src,w,h,points){
  if(disposed||!(src instanceof Uint8Array)||![w,h].every(n=>Number.isSafeInteger(n)&&n>0&&n<=4096)||src.length!==w*h*4||(!points&&Math.max(w,h)<2)||points&&(!(points instanceof Float32Array)||!points.length||points.length%2||!points.every(Number.isFinite)))throw new RangeError("Invalid BGRA8 GPU input");
  const dw=Math.max(1,Math.floor(w/2)),dh=Math.max(1,Math.floor(h/2)),count=points?points.length/2:dw*dh,size=count*16;
  // Explicit byte packing, independent of host endianness.
  const packed=Uint32Array.from({length:w*h},(_,i)=>(src[i*4]|src[i*4+1]<<8|src[i*4+2]<<16|src[i*4+3]<<24)>>>0);
  const buffers=[make(packed,GPUBufferUsage.STORAGE),make(points??new Float32Array(2),GPUBufferUsage.STORAGE),make(Uint32Array.of(w,h,dw,dh,points?0:1,count,0,0),GPUBufferUsage.UNIFORM),device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})];
  const read=device.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  try{
   const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
   const cmd=device.createCommandEncoder(),pass=cmd.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();cmd.copyBufferToBuffer(buffers[3],0,read,0,size);device.queue.submit([cmd.finish()]);
   await read.mapAsync(GPUMapMode.READ);const v=new Uint32Array(read.getMappedRange()).slice();read.unmap();
   return points?Uint16Array.from(v):{width:dw,height:dh,values:Uint8Array.from(v)};
  }finally{for(const b of buffers)b.destroy();read.destroy();}
 }
 return {adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,isFallbackAdapter:adapter.info.isFallbackAdapter},sample:(src,w,h,points)=>execute(src,w,h,points),downsample:(src,w,h)=>execute(src,w,h,null),dispose(){if(!disposed){disposed=true;device.destroy();}}};
}
