// Actual public shader, fixed owned source, aligned logical sample points.
// DPR1 vs DPR3 and DPR2 vs DPR6 use identical logical pixel centers.
// Interior material comparison deliberately excludes AA boundary pixels.
import {specializeContinuousGlass,loadContinuousGlass} from "/site/dashboard-glass-continuous.js";
import {resolveRegularMaterial,regularMaterialLanes} from "/site/dashboard-glass-material.js";
export async function run(){
 const adapter=await navigator.gpu.requestAdapter(),f16=adapter.features.has("shader-f16"),device=await adapter.requestDevice({requiredFeatures:f16?["shader-f16"]:[]});
 const original=await(await fetch("/site/dashboard-gpu-glass.wgsl")).text(),vectors=await loadContinuousGlass(device,"/site/");
 const fmt="rgba16float",logical=[190,150],sw=380,sh=300,mips=7;
 const texture=(w,h,m=1,extra=0)=>device.createTexture({size:[w,h],format:fmt,mipLevelCount:m,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|extra});
 const scene=texture(sw,sh,mips,GPUTextureUsage.STORAGE_BINDING),src=new DataView(new ArrayBuffer(sw*sh*8));
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
  const u=(x+.5)/sw,v=(y+.5)/sh;
  [.48+.32*Math.sin(u*25+v*6),.43+.27*Math.cos(v*32-u*5),.42+.28*Math.sin(u*60+v*46),1].forEach((a,i)=>src.setFloat16((y*sw+x)*8+i*2,a,true));
 }
 device.queue.writeTexture({texture:scene},new Uint8Array(src.buffer),{bytesPerRow:sw*8},[sw,sh]);
 const mipShader=device.createShaderModule({code:await(await fetch("/site/dashboard-gpu-mipmap.wgsl")).text()}),mp=await device.createComputePipelineAsync({layout:"auto",compute:{module:mipShader,entryPoint:"mip2x2"}});
 const enc=device.createCommandEncoder();
 for(let l=1;l<mips;l++){const group=device.createBindGroup({layout:mp.getBindGroupLayout(0),entries:[{binding:0,resource:scene.createView({baseMipLevel:l-1,mipLevelCount:1})},{binding:1,resource:scene.createView({baseMipLevel:l,mipLevelCount:1})}]});const p=enc.beginComputePass();p.setPipeline(mp);p.setBindGroup(0,group);p.dispatchWorkgroups(Math.ceil((sw>>l)/8),Math.ceil((sh>>l)/8));p.end();}
 device.queue.submit([enc.finish()]);
 const source=scene.createView(),dummy=texture(1,1),array=device.createTexture({size:[1,1,1],format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING}).createView({dimension:"2d-array"}),sampler=device.createSampler({magFilter:"linear",minFilter:"linear"});
 const shapes=[{r:[4,4,78,24],rad:12,mode:6,regular:false,hover:.65,press:.3},{r:[95,4,81,48],rad:9.75,mode:4,regular:true,hover:.2,press:0},{r:[4,45,71,43],rad:0,mode:5,corners:[-11,-3,-15,-7],regular:false,hover:.4,press:.7},{r:[104,66,51,51],rad:25.5,mode:6,regular:true,hover:0,press:0},{r:[4,110,91,7.75],rad:0,mode:4,regular:false,hover:0,press:0},{r:[4,125,180,18],rad:4.125,mode:4,regular:true,hover:.55,press:.2}];
 const blend={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}};
 const programs=[];
 for(const mode of ["baseline","continuous"]){
  let code=(f16?"enable f16;\n":"")+(mode==="baseline"?original:specializeContinuousGlass(original,vectors.code)).replaceAll("__ORACLE_HALF_BODY__",f16?"return vec3<f32>(vec3<f16>(v));":"return v;");
  if(mode==="continuous")code=code.replace("  // Preserve the original rounded rect discard","  if(state.tintMeta.x==99.0){return vec4<f32>(field.yz*0.5+vec2<f32>(0.5),field.x/referenceDensity()/256.0+0.5,coverage);}\n  // Preserve the original rounded rect discard");
  const module=device.createShaderModule({code});
  programs.push({glass:await device.createRenderPipelineAsync({layout:"auto",vertex:{module,entryPoint:"vsGlass"},fragment:{module,entryPoint:"fsGlass",targets:[{format:fmt,blend}]},primitive:{topology:"triangle-list"}}),copy:await device.createRenderPipelineAsync({layout:"auto",vertex:{module,entryPoint:"vsCopy"},fragment:{module,entryPoint:"fsCopy",targets:[{format:fmt}]},primitive:{topology:"triangle-list"}})});
 }
 const render=async(dpr,mode,diagnostic=false)=>{
  const W=logical[0]*dpr,H=logical[1]*dpr,tiles=[],profiles=[],tints=[],region=[],icons=[];
  for(const shape of shapes){
   const [x,y,w,h]=shape.r;
   tiles.push(x*dpr,y*dpr,w*dpr,h*dpr,shape.rad*dpr,-1,2.5,shape.mode,...(shape.corners||Array(4).fill(-shape.rad)).map(v=>v*dpr),shape.hover,shape.press,w*.63*dpr,h*.41*dpr,.15,-.08,1,0);
   profiles.push(...(shape.regular?regularMaterialLanes(resolveRegularMaterial({width:w,height:h,scale:dpr,scheme:"dark"})):Array(16).fill(0)));
   tints.push(.7,.25,.35,.25);region.push(...Array(24).fill(0));icons.push(...Array(20).fill(0));
  }
  const make=(data,usage)=>{const v=Float32Array.from(data),b=device.createBuffer({size:v.byteLength,usage:usage|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,v);return b;};
  const buffers=[make(tiles,GPUBufferUsage.STORAGE),make([W,H,1,dpr,0,0,0,H,0,0,0,0,0,0,0,0,diagnostic?99:1,1,0,0,W,H,0,0],GPUBufferUsage.UNIFORM),make(tints,GPUBufferUsage.STORAGE),make(profiles,GPUBufferUsage.STORAGE),make(region,GPUBufferUsage.STORAGE),make(icons,GPUBufferUsage.STORAGE)];
  const entries=[{binding:0,resource:source},{binding:1,resource:{buffer:buffers[0]}},{binding:2,resource:{buffer:buffers[1]}},{binding:3,resource:{buffer:buffers[2]}},{binding:4,resource:dummy.createView()},{binding:5,resource:{buffer:buffers[3]}},{binding:6,resource:{buffer:buffers[4]}},{binding:8,resource:source},{binding:9,resource:dummy.createView()},{binding:10,resource:sampler},{binding:11,resource:{buffer:buffers[5]}},{binding:13,resource:array},{binding:14,resource:array},...(mode===1?[{binding:15,resource:{buffer:vectors.buffer}},{binding:16,resource:vectors.fieldView}]:[{binding:12,resource:array}])];
  const target=texture(W,H,1,GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC),stride=Math.ceil(W*8/256)*256,read=device.createBuffer({size:stride*H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const pipeline=programs[mode].glass,bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries});
  const cmd=device.createCommandEncoder(),pass=cmd.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:"clear",clearValue:[0,0,0,0],storeOp:"store"}]});
  pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(6,shapes.length);pass.end();
  cmd.copyTextureToBuffer({texture:target},{buffer:read,bytesPerRow:stride,rowsPerImage:H},[W,H]);device.queue.submit([cmd.finish()]);await read.mapAsync(GPUMapMode.READ);
  const bytes=new Uint8Array(read.getMappedRange()),raw=new Uint8Array(W*H*8);for(let y=0;y<H;y++)raw.set(bytes.subarray(y*stride,y*stride+W*8),y*W*8);read.unmap();buffers.forEach(b=>b.destroy());target.destroy();read.destroy();
  return {W,H,dpr,v:new DataView(raw.buffer)};
 };
 const compare=(a,b)=>{const ratio=b.dpr/a.dpr,off=(ratio-1)/2,diff=[],perShape=[];let n=0,nonfinite=0,edgeExcluded=0,sum=0,max=0;
 for(const shape of shapes){let count=0,total=0,peak=0,worst=null;const [X,Y,w,h]=shape.r;for(let y=Math.ceil(Y*a.dpr);y<Math.floor((Y+h)*a.dpr);y++)for(let x=Math.ceil(X*a.dpr);x<Math.floor((X+w)*a.dpr);x++){
  const i=(y*a.W+x)*8,j=((y*ratio+off)*b.W+x*ratio+off)*8;
  if(a.v.getFloat16(i+6,true)<.999||b.v.getFloat16(j+6,true)<.999){edgeExcluded++;continue;}
  for(let c=0;c<3;c++){const d=Math.abs(a.v.getFloat16(i+2*c,true)-b.v.getFloat16(j+2*c,true));if(!Number.isFinite(d)){nonfinite++;continue;}diff.push(d);sum+=d;max=Math.max(max,d);total+=d;if(d>peak){peak=d;worst={x:(x+.5)/a.dpr,y:(y+.5)/a.dpr,channel:c,values:[a.v.getFloat16(i+2*c,true),b.v.getFloat16(j+2*c,true)]};}count++;n++;}
 }perShape.push({mode:shape.mode,regular:shape.regular,count,mean:total/count,max:peak,worst});}
 diff.sort((a,b)=>a-b);return {samples:n,nonfinite,edgeExcluded,mean:sum/n,p99:diff[Math.floor(diff.length*.99)],max,perShape};};
 try{
  const a=await render(1,1),b=await render(3,1),c=await render(2,1),d=await render(6,1),baseline=await render(2,0);
  const normalA=await render(2,1,true),normalB=await render(6,1,true);
  return {source:[sw,sh],shapes:shapes.length,comparisons:{oneToThree:compare(a,b),twoToSix:compare(c,d),retinaBaseline:compare(baseline,c),normalTwoToSix:compare(normalA,normalB)},acceptance:"Predeclared density interior p99 <= .003 and max <= .02; baseline deviations are diagnostics, not blanket native proof."};
 }finally{device.destroy();vectors.dispose();}
}
