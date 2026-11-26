// Actual public fsGlass A/B on owned synthetic GPU attachments, no screenshots.
// The production material code, SVG raster coverage and backdrop mip reducer
// are identical for both variants. Output statistics are not native evidence.
import {specializeContinuousGlass,loadContinuousGlass} from "/site/dashboard-glass-continuous.js";
import {createGlassSilhouetteAtlas} from "/site/dashboard-glass-silhouette.js";
import {resolveRegularMaterial,regularMaterialLanes} from "/site/dashboard-glass-material.js";
export async function run(){
 const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"}),f16=adapter.features.has("shader-f16"),device=await adapter.requestDevice({requiredFeatures:f16?["shader-f16"]:[]});
 const original=await(await fetch("/site/dashboard-gpu-glass.wgsl")).text(),data=await loadContinuousGlass(device,"/site/"),names=Object.keys((await(await fetch("/site/continuous-icon-vectors.json")).json()).assets);
 const atlas=createGlassSilhouetteAtlas(device);
 const pipelines=[];
 const makeBuffer=(v,usage)=>{const b=device.createBuffer({size:v.byteLength,usage:usage|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,v);return b;};
 const fmt="rgba16float",tex=(w,h,mips=1,format=fmt,extra=0)=>device.createTexture({size:[w,h],format,mipLevelCount:mips,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|extra});
 const sampler=device.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});
 const blend={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}};
 const mcode=await(await fetch("/site/dashboard-gpu-mipmap.wgsl")).text(),mm=device.createShaderModule({code:mcode}),mp=await device.createComputePipelineAsync({layout:"auto",compute:{module:mm,entryPoint:"mip2x2"}});
 const owners=await Promise.all(names.map(async name=>{const o=document.createElement("div"),img=new Image();o.style.cssText="position:absolute;left:0;top:0;width:92px;height:88px;";img.style.cssText="position:absolute;width:45.5px;height:45.5px;left:23.25px;top:21.25px;";img.src="/original/"+name+".svg";o.append(img);document.body.append(o);await img.decode();return {o,img,name};}));
 const glyph=tex(1,1),detail=tex(1,1),dummy=new Uint16Array(4);device.queue.writeTexture({texture:glyph},dummy,{bytesPerRow:8},[1,1]);device.queue.writeTexture({texture:detail},dummy,{bytesPerRow:8},[1,1]);
 try{
  for(const mode of ["baseline","continuous"]){
   const code=(f16?"enable f16;\n":"")+(mode==="baseline"?original:specializeContinuousGlass(original,data.code)).replaceAll("__ORACLE_HALF_BODY__",f16?"return vec3<f32>(vec3<f16>(v));":"return v;");
   const module=device.createShaderModule({code});
   pipelines.push(await device.createRenderPipelineAsync({layout:"auto",vertex:{module,entryPoint:"vsGlass"},fragment:{module,entryPoint:"fsGlass",targets:[{format:fmt,blend}]},primitive:{topology:"triangle-list"}}));
  }
  // Prepare all SVGs and native-pixel coverage before measured renders.
  for(const {o,img} of owners)atlas.sync(o,img,{width:92,height:88,dpr:1,scheme:"dark",hover:false,reduced:true,slot:owners.findIndex(v=>v.img===img),ownerRect:[0,0,92,88]});
  await new Promise(r=>setTimeout(r,250));
  const results=[];
  for(const scale of [1,2]){
   const W=400*scale,H=384*scale,mips=6,scene=tex(W,H,mips,fmt,GPUTextureUsage.STORAGE_BINDING);
   const source=new DataView(new ArrayBuffer(W*H*8));
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=(x+.5)/W,v=(y+.5)/H,cols=[.48+.32*Math.sin(u*25+v*6),.43+.27*Math.cos(v*32-u*5),.42+.28*Math.sin(u*60+v*46),1];
    cols.forEach((a,i)=>source.setFloat16((y*W+x)*8+2*i,a,true));
   }
   device.queue.writeTexture({texture:scene},new Uint8Array(source.buffer),{bytesPerRow:W*8,rowsPerImage:H},[W,H]);
   const enc=device.createCommandEncoder();
   for(let l=1;l<mips;l++){
    const b=device.createBindGroup({layout:mp.getBindGroupLayout(0),entries:[{binding:0,resource:scene.createView({baseMipLevel:l-1,mipLevelCount:1})},{binding:1,resource:scene.createView({baseMipLevel:l,mipLevelCount:1})}]});
    const pass=enc.beginComputePass();pass.setPipeline(mp);pass.setBindGroup(0,b);pass.dispatchWorkgroups(Math.ceil((W>>l)/8),Math.ceil((H>>l)/8));pass.end();
   }device.queue.submit([enc.finish()]);
   const tiles=[],icons=[],profiles=[],tints=[],regions=[];
   let coverageCount=0;
   for(let i=0;i<owners.length;i++){
    const {o,img}=owners[i],x=(i%4*100+4)*scale,y=(Math.floor(i/4)*96+4)*scale,w=92*scale,h=88*scale;
    const isRegular=i%2===1,mode=i%4===0?6:i%4===1?5:4,r=i%4===0?44:12,hover=i%3===0?.8:0,press=i%5===0?.6:0;
    tiles.push(x,y,w,h,r*scale,-1,2.5,mode,-12*scale,-7*scale,-15*scale,-10*scale,hover,press,w*.65,h*.35,0,0,1,0);
    const icon=atlas.sync(o,img,{width:w,height:h,dpr:scale,scheme:"dark",hover:hover>0,reduced:true,slot:i,ownerRect:[x,y,w,h]});
    if(!icon)throw Error("Missing icon "+i);
    const lanes=icon.lanes.slice();lanes[19]=data.indexFor(img);if(!lanes[19])throw Error("Missing continuous icon "+i);icons.push(...lanes);coverageCount+=+icon.vectorCoverage;
    profiles.push(...(isRegular?regularMaterialLanes(resolveRegularMaterial({width:92,height:88,scale,scheme:"dark"})):Array(16).fill(0)));
    tints.push(.7,.25,.35,i%4===0?.3:0);regions.push(...Array(24).fill(0));
   }
   const cacheT=performance.now();
   const cachedIcons=Float32Array.from(icons);let cached=0;
   for(let i=0;i<16;i++){const a=cachedIcons.subarray(i*20,(i+1)*20);if(data.cacheField(a,atlas.coverageView)){a[19]*=-1;cached++;}}
   await device.queue.onSubmittedWorkDone();const cacheBuildMs=performance.now()-cacheT;
   const buffers=[makeBuffer(Float32Array.from(tiles),GPUBufferUsage.STORAGE),makeBuffer(Float32Array.of(W,H,1,scale,0,0,0,H,0,0,0,0,0,0,0,0,1,1,0,0),GPUBufferUsage.UNIFORM),makeBuffer(Float32Array.from(tints),GPUBufferUsage.STORAGE),makeBuffer(Float32Array.from(profiles),GPUBufferUsage.STORAGE),makeBuffer(Float32Array.from(regions),GPUBufferUsage.STORAGE),makeBuffer(Float32Array.from(icons),GPUBufferUsage.STORAGE)];
   const sourceView=scene.createView(),entries=[{binding:0,resource:sourceView},{binding:1,resource:{buffer:buffers[0]}},{binding:2,resource:{buffer:buffers[1]}},{binding:3,resource:{buffer:buffers[2]}},{binding:4,resource:glyph.createView()},{binding:5,resource:{buffer:buffers[3]}},{binding:6,resource:{buffer:buffers[4]}},{binding:8,resource:sourceView},{binding:9,resource:detail.createView()},{binding:10,resource:sampler},{binding:11,resource:{buffer:buffers[5]}},{binding:12,resource:atlas.view},{binding:13,resource:atlas.hazeView},{binding:14,resource:atlas.coverageView}];
   const target=tex(W,H,1,fmt,GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC),stride=Math.ceil(W*8/256)*256,read=device.createBuffer({size:stride*H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   const resultsForMode=[];
   for(let mode=0;mode<3;mode++){
    if(mode)device.queue.writeBuffer(buffers[5],0,mode===1?cachedIcons:Float32Array.from(icons));
    const pipeline=pipelines[Math.min(mode,1)],bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:mode?[...entries.filter(e=>e.binding!==12),{binding:15,resource:{buffer:data.buffer}},{binding:16,resource:data.fieldView}]:entries});
    const draw=async(copy=false)=>{const cmd=device.createCommandEncoder(),pass=cmd.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]});pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(6,16);pass.end();if(copy)cmd.copyTextureToBuffer({texture:target},{buffer:read,bytesPerRow:stride,rowsPerImage:H},[W,H]);const t=performance.now();device.queue.submit([cmd.finish()]);await device.queue.onSubmittedWorkDone();return performance.now()-t;};
    await draw();const ms=[];for(let n=0;n<3;n++)ms.push(await draw());
    await draw(true);await read.mapAsync(GPUMapMode.READ);
    const bytes=new Uint8Array(read.getMappedRange()),raw=new Uint8Array(W*H*8);for(let y=0;y<H;y++)raw.set(bytes.subarray(y*stride,y*stride+W*8),y*W*8);read.unmap();
    resultsForMode.push({raw,ms});
   }
   const direct=resultsForMode[2].raw,cachedRaw=resultsForMode[1].raw;let cacheByteDifferences=0;for(let i=0;i<direct.length;i++)if(direct[i]!==cachedRaw[i])cacheByteDifferences++;
   const A=new DataView(resultsForMode[0].raw.buffer),B=new DataView(resultsForMode[1].raw.buffer),diff=[],perIcon=[],alpha=[];
   let sum=0,max=0,nonfinite=0;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const j=(y*W+x)*8;
    for(let c=0;c<4;c++){const a=A.getFloat16(j+2*c,true),b=B.getFloat16(j+2*c,true),d=Math.abs(a-b);if(!Number.isFinite(d)){nonfinite++;continue;}if(c===3){alpha.push(d);continue;}diff.push(d);sum+=d;max=Math.max(max,d);}
   }
   for(let i=0;i<16;i++){let total=0,peak=0,n=0;for(let y=Math.floor((Math.floor(i/4)*96+4+21.25)*scale);y<Math.ceil((Math.floor(i/4)*96+4+66.75)*scale);y++)for(let x=Math.floor((i%4*100+4+23.25)*scale);x<Math.ceil((i%4*100+4+68.75)*scale);x++)for(let c=0;c<3;c++){let j=(y*W+x)*8+2*c,d=Math.abs(A.getFloat16(j,true)-B.getFloat16(j,true));total+=d;peak=Math.max(peak,d);n++;}perIcon.push({name:names[i],mean:total/n,max:peak});}
   diff.sort((a,b)=>a-b);alpha.sort((a,b)=>a-b);
   results.push({scale,W,H,coverageCount,cached,cacheByteDifferences,cacheBuildMs,cacheStats:data.stats(),nonfinite,meanRGB:sum/diff.length,p99RGB:diff[Math.floor(diff.length*.99)],maxRGB:max,p99Alpha:alpha[Math.floor(alpha.length*.99)],maxAlpha:alpha.at(-1),baselineMs:resultsForMode[0].ms,continuousMs:resultsForMode[1].ms,perIcon,atlas:atlas.stats()});
   buffers.forEach(b=>b.destroy());scene.destroy();target.destroy();read.destroy();
  }
  return {adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,f16},results};
 }finally{owners.forEach(({o})=>o.remove());atlas.dispose();data.dispose();glyph.destroy();detail.destroy();device.destroy();}
}
