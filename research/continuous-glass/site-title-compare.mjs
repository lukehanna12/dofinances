import {referenceTitleField} from "./native-title-reference.mjs";
// Actual title material output against the preserved browser-native alpha.
// All readback is of test-owned offscreen attachments, not displayed pixels.
import {specializeContinuousGlass,loadContinuousGlass} from "/site/dashboard-glass-continuous.js";
import {rasterClockText,clockTextMaterialLanes} from "/site/dashboard-glass-text.js";
export async function run(){
 const adapter=await navigator.gpu.requestAdapter(),f16=adapter.features.has("shader-f16"),device=await adapter.requestDevice({requiredFeatures:f16?["shader-f16"]:[]}),errors=[];
 device.addEventListener("uncapturederror",e=>errors.push(e.error.message));
 const original=await(await fetch("/site/dashboard-gpu-glass.wgsl")).text(),vectors=await loadContinuousGlass(device,"/site/");
 if(!vectors.titleAvailable)throw Error("Local title mode unavailable");
 const fmt="rgba16float",sw=480,sh=180,mips=6,tex=(w,h,m=1,extra=0,format=fmt)=>device.createTexture({size:[w,h],format,mipLevelCount:m,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|extra});
 const scene=tex(sw,sh,mips,GPUTextureUsage.STORAGE_BINDING),src=new DataView(new ArrayBuffer(sw*sh*8));
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const u=(x+.5)/sw,v=(y+.5)/sh;[.48+.32*Math.sin(u*25+v*6),.43+.27*Math.cos(v*32-u*5),.42+.28*Math.sin(u*60+v*46),1].forEach((a,i)=>src.setFloat16((y*sw+x)*8+i*2,a,true));}
 device.queue.writeTexture({texture:scene},new Uint8Array(src.buffer),{bytesPerRow:sw*8},[sw,sh]);
 const mp=await device.createComputePipelineAsync({layout:"auto",compute:{module:device.createShaderModule({code:await(await fetch("/site/dashboard-gpu-mipmap.wgsl")).text()}),entryPoint:"mip2x2"}});
 const enc=device.createCommandEncoder();
 for(let l=1;l<mips;l++){const group=device.createBindGroup({layout:mp.getBindGroupLayout(0),entries:[{binding:0,resource:scene.createView({baseMipLevel:l-1,mipLevelCount:1})},{binding:1,resource:scene.createView({baseMipLevel:l,mipLevelCount:1})}]});const p=enc.beginComputePass();p.setPipeline(mp);p.setBindGroup(0,group);p.dispatchWorkgroups(Math.ceil((sw>>l)/8),Math.ceil((sh>>l)/8));p.end();}device.queue.submit([enc.finish()]);
 const source=scene.createView(),dummy=tex(1,1),array=device.createTexture({size:[1,1,1],format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING}).createView({dimension:"2d-array"}),sampler=device.createSampler({magFilter:"linear",minFilter:"linear"});
 const blend={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}},programs=[];
 for(const mode of ["baseline","continuous"]){const code=(f16?"enable f16;\n":"")+(mode==="baseline"?original:specializeContinuousGlass(original,vectors.code)).replaceAll("__ORACLE_HALF_BODY__",f16?"return vec3<f32>(vec3<f16>(v));":"return v;");const module=device.createShaderModule({code});const info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==="error"))throw Error(info.messages.map(x=>x.message).join(";"));programs.push(await device.createRenderPipelineAsync({layout:"auto",vertex:{module,entryPoint:"vsGlass"},fragment:{module,entryPoint:"fsGlass",targets:[{format:fmt,blend}]},primitive:{topology:"triangle-list"}}));}
 const size=63,style={fontStyle:"normal",fontWeight:"550",fontSize:"63px",fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',letterSpacing:(-.035*size)+"px",lineHeight:(1.02*size)+"px",direction:"ltr",fontKerning:"auto"};
 const ctx=document.createElement("canvas").getContext("2d");ctx.font=style.fontWeight+" "+style.fontSize+" "+style.fontFamily;ctx.letterSpacing=style.letterSpacing;
 const logicalWidth=ctx.measureText("Projects").width,logicalHeight=parseFloat(style.lineHeight),out=[];
 const useReference=new URLSearchParams(location.search).has("native-reference"),native=useReference?await(await fetch("/title-outline")).json():null;
 const make=(a,usage)=>{const v=Float32Array.from(a),b=device.createBuffer({size:v.byteLength,usage:usage|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,v);return b;};
 try{
 for(const dpr of (useReference?[2]:[1,2,3])){
  const W=240*dpr,H=90*dpr,w=Math.ceil(logicalWidth*dpr),h=Math.ceil(logicalHeight*dpr),x=8*dpr,y=6*dpr,alpha=rasterClockText("Projects",style,w,h,dpr),glyph=tex(w,h);
  device.queue.writeTexture({texture:glyph},alpha.pixels,{bytesPerRow:w*8},[w,h]);
  const t0=performance.now(),v=vectors.titleField("Projects",style,w,h,dpr,glyph,[.5,.5]);if(!v)throw Error("Missing title model");
  await device.queue.onSubmittedWorkDone();const buildMs=performance.now()-t0;
  let referenceTexture=null,reference=null;
  if(native){reference=referenceTitleField(native,"Projects",style,w,h,dpr,alpha,[.5,.5],true);referenceTexture=tex(w,h,1,0,"rgba32float");device.queue.writeTexture({texture:referenceTexture},reference.out,{bytesPerRow:w*16},[w,h]);}
  const tile=[x,y,w,h,0,-8,2.5,4,0,0,0,0,0,0,w*.5,h*.5,0,0,1,0];
  const lanes=phase=>[0,0,w,h,dpr,0,0,0,0,0,0,0,phase,phase,0,0,0,w,h,v.index];
  const buffers=[make(tile,GPUBufferUsage.STORAGE),make([W,H,1,dpr,0,0,0,H,0,0,0,0,0,0,0,0,1,1,0,0,W,H,0,0],GPUBufferUsage.UNIFORM),make([0,0,0,0],GPUBufferUsage.STORAGE),make(clockTextMaterialLanes(),GPUBufferUsage.STORAGE),make(Array(24).fill(0),GPUBufferUsage.STORAGE),make(lanes(.5),GPUBufferUsage.STORAGE)];
  const target=tex(W,H,1,GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC),stride=Math.ceil(W*8/256)*256,read=device.createBuffer({size:stride*H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const values=[],timings=[];
  for(let mode=0;mode<(useReference?4:3);mode++){
   device.queue.writeBuffer(buffers[5],0,Float32Array.from(lanes(mode===2?.25:.5)));
   const entries=[{binding:0,resource:source},{binding:1,resource:{buffer:buffers[0]}},{binding:2,resource:{buffer:buffers[1]}},{binding:3,resource:{buffer:buffers[2]}},{binding:4,resource:(mode===3?referenceTexture:mode?v.texture:glyph).createView()},{binding:5,resource:{buffer:buffers[3]}},{binding:6,resource:{buffer:buffers[4]}},{binding:8,resource:source},{binding:9,resource:dummy.createView()},{binding:10,resource:sampler},{binding:11,resource:{buffer:buffers[5]}},{binding:13,resource:array},{binding:14,resource:array},...(mode?[{binding:15,resource:{buffer:vectors.buffer}},{binding:16,resource:vectors.fieldView}]:[{binding:12,resource:array}])];
   const pipeline=programs[mode?1:0],bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries});
   const draw=async copy=>{const c=device.createCommandEncoder(),p=c.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]});p.setPipeline(pipeline);p.setBindGroup(0,bind);p.draw(6);p.end();if(copy)c.copyTextureToBuffer({texture:target},{buffer:read,bytesPerRow:stride,rowsPerImage:H},[W,H]);const t=performance.now();device.queue.submit([c.finish()]);await device.queue.onSubmittedWorkDone();return performance.now()-t;};
   await draw(false);const ms=[];for(let i=0;i<3;i++)ms.push(await draw(false));timings.push(ms);await draw(true);await read.mapAsync(GPUMapMode.READ);
   const raw=new Uint8Array(W*H*8),b=new Uint8Array(read.getMappedRange());for(let y=0;y<H;y++)raw.set(b.subarray(y*stride,y*stride+W*8),y*W*8);read.unmap();values.push(raw);
  }
  const a=new DataView(values[0].buffer),b=new DataView(values[1].buffer),rgb=[],alphaDiff=[];let exact=0,nonfinite=0,cacheByteDifferences=0,cacheMax=0;
  for(let i=0;i<values[1].length;i++)cacheByteDifferences+=+(values[1][i]!==values[2][i]);
  const direct=new DataView(values[2].buffer);for(let j=0;j<values[1].length;j+=2)cacheMax=Math.max(cacheMax,Math.abs(b.getFloat16(j,true)-direct.getFloat16(j,true)));
  for(let i=0;i<W*H;i++){const j=i*8,aa=a.getFloat16(j+6,true),bb=b.getFloat16(j+6,true);alphaDiff.push(Math.abs(aa-bb));exact+=+(aa===bb);if(aa>0||bb>0)for(let c=0;c<3;c++){const d=Math.abs(a.getFloat16(j+c*2,true)-b.getFloat16(j+c*2,true));if(Number.isFinite(d))rgb.push(d);else nonfinite++;}}
  const referenceErrors=useReference?[0,1].map(mode=>{const a=new DataView(values[mode].buffer),r=new DataView(values[3].buffer),d=[];for(let i=0;i<W*H;i++){const j=i*8;if(r.getFloat16(j+6,true)>0)for(let c=0;c<3;c++)d.push(Math.abs(a.getFloat16(j+c*2,true)-r.getFloat16(j+c*2,true)));}d.sort((a,b)=>a-b);return {mode,channels:d.length,mean:d.reduce((a,b)=>a+b,0)/d.length,p99:d[Math.floor(d.length*.99)],max:d.at(-1)};}):null;
  rgb.sort((a,b)=>a-b);out.push({dpr,referenceErrors,referenceEdgeCount:reference?.edgeCount,geometry:v.localEvidence,buildMs,coveredChannels:rgb.length,meanRGB:rgb.reduce((a,b)=>a+b,0)/rgb.length,p99RGB:rgb[Math.floor(rgb.length*.99)],maxRGB:rgb.at(-1),alphaEqual:exact,totalPixels:W*H,maxAlpha:alphaDiff.reduce((a,b)=>Math.max(a,b),0),cacheByteDifferences,cacheMax,nonfinite,timings});
  glyph.destroy();v.texture.destroy();referenceTexture?.destroy();buffers.forEach(b=>b.destroy());target.destroy();read.destroy();
 }
 if(errors.length)throw Error(errors.join(";"));return {out,scope:"Current clock text material and final browser coverage; synthetic fixed optical source. Baseline color differences are not native proof."};
 }finally{scene.destroy();dummy.destroy();vectors.dispose();device.destroy();}
}
