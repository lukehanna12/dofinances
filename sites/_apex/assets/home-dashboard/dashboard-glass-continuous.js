import {prepareTitleWord} from "./dashboard-glass-title-geometry.js";
// Opt-in public renderer candidate. The baseline shader and source pipeline
// are unchanged unless glass-renderer=continuous is explicitly requested.
export const continuousRequested=()=>new URLSearchParams(location.search).get("glass-renderer")==="continuous";
export async function loadContinuousGlass(device,base){
 const [asset,code]=await Promise.all([
  fetch(base+"continuous-icon-vectors.json").then(r=>{if(!r.ok)throw Error("Continuous icon data unavailable");return r.json();}),
  fetch(base+"dashboard-glass-continuous.wgsl").then(r=>{if(!r.ok)throw Error("Continuous shader unavailable");return r.text();})
 ]);
 if(asset.schema!=="dofinances-vector-controls-v1"||Object.keys(asset.assets).length!==16)throw Error("Invalid continuous icon catalog");
 const entries=Object.entries(asset.assets),n=entries.length,bytes=Uint8Array.from(atob(asset.curves),c=>c.charCodeAt(0));
 if(bytes.length!==asset.curveCount*48)throw Error("Invalid continuous curve buffer");
 const rows=Array.from({length:n},()=>Array(12).fill(0)),index=new Map(),view=new DataView(bytes.buffer);
 const all=Array.from({length:asset.curveCount},(_,i)=>Array.from({length:12},(_,j)=>view.getFloat32((i*12+j)*4,true)));
 const bounds=c=>[Math.min(c[0],c[2],c[4],c[6]),Math.min(c[1],c[3],c[5],c[7]),Math.max(c[0],c[2],c[4],c[6]),Math.max(c[1],c[3],c[5],c[7])];
 // Build a hierarchy of vector bounding boxes, not a spatial raster.
 // Every leaf retains the original degree-elevated curve control points.
 function build(items){
  const id=rows.length;rows.push(null);
  const boxes=items.map(bounds),lo=[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1]))],hi=[Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
  if(items.length<=4){const from=rows.length;rows.push(...items);rows[id]=[...lo,...hi,0,0,from,items.length,-2,0,0,0];}
  else{const a=hi[0]-lo[0]>=hi[1]-lo[1]?0:1;items.sort((x,y)=>{const b=bounds(x),c=bounds(y);return (b[a]+b[a+2])-(c[a]+c[a+2]);});const m=items.length>>1,l=build(items.slice(0,m)),r=build(items.slice(m));rows[id]=[...lo,...hi,l,r,0,0,-1,0,0,0];}
  return id;
 }
 entries.forEach(([name,v],i)=>{
  if(v.count<=0||v.start<0||v.start+v.count>asset.curveCount||v.scale<=0)throw Error("Invalid icon range");
  const root=build(all.slice(v.start,v.start+v.count));
  rows[i]=[...v.origin,v.scale,v.count,root,v.viewBox[2],v.viewBox[0],v.viewBox[1],v.viewBox[3],0,0,0];
  index.set(name,i+1);
 });
 const titleSlot=rows.length, titleReserve=2048;
 const titleRequested=new URLSearchParams(location.search).get("glass-title-vector")==="1";
 const titleAsset=titleRequested?await fetch(base+"continuous-title-outline.json").then(r=>r.ok?r.json():null):null;
 const data=Float32Array.from(rows.flat());
 const buffer=device.createBuffer({label:"Continuous authored vector controls",size:data.byteLength+(titleAsset?titleReserve*48:0),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(buffer,0,data);
 const side=128,capacity=32,fieldTexture=device.createTexture({label:"Exact current-framebuffer vector sample cache",size:[side,side,capacity],format:"rgba32float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});
 const fieldView=fieldTexture.createView({dimension:"2d-array"}),keys=new Map(),uniforms=new Map();
 const cacheModule=device.createShaderModule({code:"struct GlassSilhouette { rect:vec4<f32>, params:vec4<f32>, tint:vec4<f32>, coverageRect:vec4<f32>, coverageMeta:vec4<f32> };\n"+code+"\n@group(0) @binding(0) var<uniform> cacheIcon:GlassSilhouette;\n@group(0) @binding(1) var cacheOutput:texture_storage_2d_array<rgba32float,write>;\n@group(0) @binding(2) var cacheCoverage:texture_2d_array<f32>;\n@compute @workgroup_size(8,8)\nfn cacheMain(@builtin(global_invocation_id) id:vec3<u32>){\n if(any(id.xy>=vec2<u32>(cacheIcon.coverageMeta.yz))){return;}\n let pixel=vec2<i32>(id.xy);let layer=i32(cacheIcon.coverageMeta.x)-1;\n if(textureLoad(cacheCoverage,pixel,layer,0).r<=0.001){textureStore(cacheOutput,pixel,layer,vec4<f32>(0.0));return;}\n let local=cacheIcon.coverageRect.xy+(vec2<f32>(id.xy)+vec2<f32>(0.5))/cacheIcon.coverageRect.zw;\n let field=evaluateContinuousIconField(cacheIcon,local);\n textureStore(cacheOutput,pixel,layer,vec4<f32>(field,1.0));\n}\n"});
 const cachePipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module:cacheModule,entryPoint:"cacheMain"}});
 let builds=0,hits=0,misses=0,titleBuilds=0;
 let titlePipeline=null,titleUniform=null;
 if(titleAsset){
  const module=device.createShaderModule({code:"struct GlassSilhouette { rect:vec4<f32>, params:vec4<f32>, tint:vec4<f32>, coverageRect:vec4<f32>, coverageMeta:vec4<f32> };\n"+code+"\n@group(0) @binding(0) var<uniform> titleIcon:GlassSilhouette;\n@group(0) @binding(1) var titleOut:texture_storage_2d<rgba32float,write>;\n@group(0) @binding(2) var titleAlpha:texture_2d<f32>;\n@compute @workgroup_size(8,8)\nfn titleMain(@builtin(global_invocation_id) id:vec3<u32>){\n let dims=textureDimensions(titleOut);\n if(any(id.xy>=dims)){return;}\n let p=vec2<i32>(id.xy);let a=textureLoad(titleAlpha,p,0).a;\n // A one-pixel guard ensures every adjacent derivative lane around\n // a covered fragment has a continuous signed distance.\n var near=a;\n for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){\n  near=max(near,textureLoad(titleAlpha,clamp(p+vec2<i32>(x,y),vec2<i32>(0),vec2<i32>(dims)-1),0).a);\n }}\n if(near<=0.0){textureStore(titleOut,p,vec4<f32>(1000,0,0,0));return;}\n let f=evaluateContinuousTitleField(titleIcon,vec2<f32>(id.xy)+titleIcon.coverageRect.xy);\n textureStore(titleOut,p,vec4<f32>(f,a));\n}\n"});
  titlePipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module,entryPoint:"titleMain"}});
  titleUniform=device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 }
 function titleField(text,style,width,height,dpr,alphaTexture,phase){
  if(!titlePipeline)return null;
  const model=prepareTitleWord(titleAsset,text,style,width,height,dpr);if(!model)return null;
  rows.length=titleSlot;rows.push(null);
  const items=Array.from({length:model.curves.length/12},(_,i)=>Array.from(model.curves.subarray(i*12,(i+1)*12)));
  const root=build(items);
  rows[titleSlot]=[...model.origin,model.scale,items.length,root,width,0,0,height,0,0,0];
  const packed=Float32Array.from(rows.slice(titleSlot).flat());
  if(packed.byteLength>titleReserve*48)throw Error("Title vector storage budget exceeded");
  device.queue.writeBuffer(buffer,titleSlot*48,packed);
  const id=titleSlot+1,lanes=Float32Array.of(0,0,width,height,dpr,0,0,0,0,0,0,0,...phase,0,0,0,width,height,id);
  device.queue.writeBuffer(titleUniform,0,lanes);
  const texture=device.createTexture({label:"Exact output-density title optical samples",size:[width,height],format:"rgba32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.STORAGE_BINDING});
  const group=device.createBindGroup({layout:titlePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:titleUniform}},{binding:1,resource:texture.createView()},{binding:2,resource:alphaTexture.createView()},{binding:15,resource:{buffer}}]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(titlePipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(width/8),Math.ceil(height/8));pass.end();device.queue.submit([enc.finish()]);
  titleBuilds++;return {texture,index:id,curves:items.length};
 }
 function cacheField(lanes,coverageView){
  const slot=lanes[16]-1,w=lanes[17],h=lanes[18];
  if(slot<0||slot>=capacity||!lanes[19]||w>side||h>side||w<1||h<1){misses++;return false;}
  // Relative icon and exact physical sample lattice only: no appearance,
  // material, pointer, time, or backdrop is cached.
  const key=[...lanes.slice(0,4),...lanes.slice(12,20)].join(",");
  if(keys.get(slot)===key){hits++;return true;}
  let u=uniforms.get(slot);if(!u){u=device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});uniforms.set(slot,u);}
  device.queue.writeBuffer(u,0,Float32Array.from(lanes));
  const bind=device.createBindGroup({layout:cachePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:fieldView},{binding:2,resource:coverageView},{binding:15,resource:{buffer}}]});
  const cmd=device.createCommandEncoder(),pass=cmd.beginComputePass();pass.setPipeline(cachePipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8));pass.end();device.queue.submit([cmd.finish()]);
  keys.set(slot,key);builds++;return true;
 }
 return {buffer,code:code+"\n@group(0) @binding(16) var continuousOutputField:texture_2d_array<f32>;\nfn continuousIconField(icon:GlassSilhouette,local:vec2<f32>)->vec3<f32>{\n if(icon.coverageMeta.w<0.0&&icon.coverageMeta.x>0.0){\n  let q=(local-icon.coverageRect.xy)*icon.coverageRect.zw;let p=floor(q);\n  // Only consume a cached evaluation at the SAME framebuffer sample.\n  // Nonmatching phase, large output and changed geometry evaluate directly.\n  if(all(p>=vec2<f32>(0.0))&&all(p<icon.coverageMeta.yz)&&all(abs(q-p-vec2<f32>(0.5))<vec2<f32>(0.001))){\n   let v=textureLoad(continuousOutputField,vec2<i32>(p),i32(icon.coverageMeta.x)-1,0);\n   if(v.w==1.0){return v.xyz;}\n  }\n }\n return evaluateContinuousIconField(icon,local);\n}\n",fieldView,cacheField,titleField,titleAvailable:Boolean(titleAsset),stats(){return {builds,hits,misses,titleBuilds,bytes:side*side*capacity*16};},curveCount:asset.curveCount,bytes:data.byteLength,indexFor(img){const name=new URL(img.currentSrc||img.src,location.href).pathname.split("/").at(-1).replace(/\.svg$/,"");return index.get(name)||0;},dispose(){buffer.destroy();fieldTexture.destroy();titleUniform?.destroy();for(const u of uniforms.values())u.destroy();}};
}
function once(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error("Continuous specialization mismatch: "+a.slice(0,100));return s.replace(a,b);}
export function specializeContinuousGlass(s,code){
 // The real-valued geometry and UV transport are the only changes to
 // existing surface optics. Preserve the material and interaction stages.
 s=once(s,"fn titleGlyphField(local:vec2<f32>)->vec4<f32>{","fn titleGlyphField(local:vec2<f32>,tileIndex:u32)->vec4<f32>{");
 s=once(s,"let glyph=textureLoad(titleGlyphAlpha,p,0);","let glyph=textureLoad(titleGlyphAlpha,p,0);\n let title= silhouettes[tileIndex];\n if(title.coverageMeta.w>0.0){\n  if(all(abs(local-vec2<f32>(p)-title.coverageRect.xy)<vec2<f32>(0.001))||glyph.x>=999.0){return glyph;}\n  let f=evaluateContinuousTitleField(title,local);return vec4<f32>(f,glyph.a);\n }");
 s=once(s,"let glyph=titleGlyphField(in.local);","let glyph=titleGlyphField(in.local,in.tileIndex);");
 const start=s.indexOf("fn supercircleSDF("),end=s.indexOf("/* AIR glass_background_sdf_no_bleed_lph",start);
 if(start<0||end<start)throw Error("Missing geometry range");
 let geometry=s.slice(start,end);
 // Remove the final half conversion, not the original supercircle law.
 geometry=geometry.replaceAll("return nativeHalf3(vec3<f32>(", "return (vec3<f32>(");
 s=s.slice(0,start)+geometry+s.slice(end);
 s=once(s,"let nativeWidth=max(nativeHalf1(fwidth(signed)),nativeHalf1(0.0001));","let nativeWidth=max(fwidth(signed),0.0001);");
 s=once(s,"let signedRatio=nativeHalf1(-signed/nativeWidth);","let signedRatio=-signed/nativeWidth;");
 s=once(s,"nativeHalf1(clamp(0.5+signedRatio,0.0,1.0))","clamp(0.5+signedRatio,0.0,1.0)");
 s=once(s,"let baseUV=nativeHalf2(backdropPosition/backdropExtent);","let baseUV=backdropPosition/backdropExtent;");
 s=once(s,"let innerUV=nativeHalf2(baseUV+nativeHalf2(\n    field.yz*inner*displacementFactor/backdropExtent));","let innerUV=baseUV+field.yz*inner*displacementFactor/backdropExtent;");
 s=once(s,"let outerUV=nativeHalf2(baseUV+nativeHalf2(\n    field.yz*outer*displacementFactor/backdropExtent));","let outerUV=baseUV+field.yz*outer*displacementFactor/backdropExtent;");
 const iconStart=s.indexOf("  let uv=iconUV*(512.0/544.0)"),iconEnd=s.indexOf("  let d=min(icon.rect.z,icon.rect.w);",iconStart);
 if(iconStart<0||iconEnd<iconStart)throw Error("Missing legacy icon optical block");
 s=s.slice(0,iconStart)+`  let iconCoverage=finalSilhouetteCoverage(icon,local,0.0);
  if(icon.coverageMeta.w==0.0||iconCoverage<=0.001){return shaded;}
  let vectorField=continuousIconField(icon,local);
  let signed=vectorField.x;
  let normal=vectorField.yz;
`+s.slice(iconEnd);
 s=once(s,"let sampleUV=nativeHalf2(parentInnerUV+nativeHalf2(displacement/backdropExtent));","let sampleUV=parentInnerUV+displacement/backdropExtent;");
 // Cancellation-stable real extension; same amount/height parameters.
 const envelope="fn continuousEnvelope(d:f32,amount:f32,invHeight:f32)->f32{let t=clamp(-d*invHeight,0.0,1.0);let q=1.0-t;return amount*q*q/(1.0+sqrt(t*(2.0-t)));}\n";
 s=once(s,"let inner=refractionEnvelope(signed,max(-60.0,-clearD)*pointScale,","let inner=continuousEnvelope(signed,max(-60.0,-clearD)*pointScale,");
 s=once(s,"let inner=refractionEnvelope(signed,innerAmount,innerInvHeight);","let inner=continuousEnvelope(signed,innerAmount,innerInvHeight);");
 s=once(s,"let outer=refractionEnvelope(signed,select(outerAmount,0.0,regular),","let outer=continuousEnvelope(signed,select(outerAmount,0.0,regular),");
 // Keep the site's established 2x Retina appearance as the reference.
 // All authored pixel constants become reference-density lengths; optical
 // LOD is mapped to the actual source lattice separately from geometry.
 s=once(s,"let pointScale=max(state.viewport.w,1.0);","let pointScale=max(state.viewport.w,0.001);");
 s=once(s,"max(-60.0,-0.8*d)","max(-60.0*referenceDensity(),-0.8*d)");
 s=once(s,"min(20.0,0.25*d)","min(20.0*referenceDensity(),0.25*d)");
 s=once(s,"let localRadius=max(24.0,d*.8);","let localRadius=max(24.0*referenceDensity(),d*.8);");
 s=once(s,"let shiftUV=shiftPx/backdropExtent;","let shiftUV=shiftPx*referenceDensity()/backdropExtent;");
 s=once(s,"exp(-abs(signed)*1.16)","exp(-abs(signed)/referenceDensity()*1.16)");
 s=once(s,"exp(-abs(silhouetteSigned)*1.16)","exp(-abs(silhouetteSigned)/referenceDensity()*1.16)");
 s=s.replaceAll("thresholdMix(signed)","thresholdMix(signed/referenceDensity())");
 const mipStart=s.indexOf("fn mipSample("),mipEnd=s.indexOf("// Same explicit bilinear",mipStart);
 s=s.slice(0,mipStart)+once(s.slice(mipStart,mipEnd),"let chosen=clamp(lod,0.0,maxLevel);","let chosen=clamp(lod+log2(referenceDensity()),0.0,maxLevel);")+s.slice(mipEnd);
 s=once(s,"let chosen=clamp(lod,0.0,maximum);","let chosen=clamp(lod+log2(referenceDensity()),0.0,maximum);");
 s=once(s,"max(footprint.x,footprint.y)))+max(0.0,lod)","max(footprint.x,footprint.y)*referenceDensity()))+max(0.0,lod)");
 for(const distance of ["signed+inner","signed+outer"]){
  s=s.replaceAll("blurDistribution(nativeHalf1("+distance+"),d)","blurDistribution(nativeHalf1(("+distance+")/referenceDensity()),d/referenceDensity())");
 }
 s=once(s,"let uv=nativeHalf2(baseUV+nativeHalf2(normal*inner*pointScale/extent));","let uv=baseUV+normal*inner*pointScale/extent;");
 s=once(s,"let buv=nativeHalf2(baseUV+nativeHalf2(normal*bleed*pointScale/extent));","let buv=baseUV+normal*bleed*pointScale/extent;");
 s=once(s,"-signed/11.0","-signed/(11.0*referenceDensity())");
 s=once(s,"exp(-abs(signed)*0.18)","exp(-abs(signed)/referenceDensity()*0.18)");
 const density="fn referenceDensity()->f32{return max(state.viewport.w,0.001)*0.5;}\n";
 return s+"\n"+density+envelope+code;
}
