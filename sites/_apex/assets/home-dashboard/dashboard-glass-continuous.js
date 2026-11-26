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
 const data=Float32Array.from(rows.flat());
 const buffer=device.createBuffer({label:"Continuous authored vector controls",size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(buffer,0,data);
 const side=128,capacity=32,fieldTexture=device.createTexture({label:"Exact current-framebuffer vector sample cache",size:[side,side,capacity],format:"rgba32float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});
 const fieldView=fieldTexture.createView({dimension:"2d-array"}),keys=new Map(),uniforms=new Map();
 const cacheModule=device.createShaderModule({code:"struct GlassSilhouette { rect:vec4<f32>, params:vec4<f32>, tint:vec4<f32>, coverageRect:vec4<f32>, coverageMeta:vec4<f32> };\n"+code+"\n@group(0) @binding(0) var<uniform> cacheIcon:GlassSilhouette;\n@group(0) @binding(1) var cacheOutput:texture_storage_2d_array<rgba32float,write>;\n@group(0) @binding(2) var cacheCoverage:texture_2d_array<f32>;\n@compute @workgroup_size(8,8)\nfn cacheMain(@builtin(global_invocation_id) id:vec3<u32>){\n if(any(id.xy>=vec2<u32>(cacheIcon.coverageMeta.yz))){return;}\n let pixel=vec2<i32>(id.xy);let layer=i32(cacheIcon.coverageMeta.x)-1;\n if(textureLoad(cacheCoverage,pixel,layer,0).r<=0.001){return;}\n let local=cacheIcon.coverageRect.xy+(vec2<f32>(id.xy)+vec2<f32>(0.5))/cacheIcon.coverageRect.zw;\n let field=evaluateContinuousIconField(cacheIcon,local);\n textureStore(cacheOutput,pixel,layer,vec4<f32>(field,1.0));\n}\n"});
 const cachePipeline=await device.createComputePipelineAsync({layout:"auto",compute:{module:cacheModule,entryPoint:"cacheMain"}});
 let builds=0,hits=0,misses=0;
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
 return {buffer,code:code+"\n@group(0) @binding(16) var continuousOutputField:texture_2d_array<f32>;\nfn continuousIconField(icon:GlassSilhouette,local:vec2<f32>)->vec3<f32>{\n if(icon.coverageMeta.w<0.0&&icon.coverageMeta.x>0.0){\n  let q=(local-icon.coverageRect.xy)*icon.coverageRect.zw;let p=floor(q);\n  // Only consume a cached evaluation at the SAME framebuffer sample.\n  // Nonmatching phase, large output and changed geometry evaluate directly.\n  if(all(p>=vec2<f32>(0.0))&&all(p<icon.coverageMeta.yz)&&all(abs(q-p-vec2<f32>(0.5))<vec2<f32>(0.001))){\n   let v=textureLoad(continuousOutputField,vec2<i32>(p),i32(icon.coverageMeta.x)-1,0);\n   if(v.w==1.0){return v.xyz;}\n  }\n }\n return evaluateContinuousIconField(icon,local);\n}\n",fieldView,cacheField,stats(){return {builds,hits,misses,bytes:side*side*capacity*16};},curveCount:asset.curveCount,bytes:data.byteLength,indexFor(img){const name=new URL(img.currentSrc||img.src,location.href).pathname.split("/").at(-1).replace(/\.svg$/,"");return index.get(name)||0;},dispose(){buffer.destroy();fieldTexture.destroy();for(const u of uniforms.values())u.destroy();}};
}
function once(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error("Continuous specialization mismatch: "+a.slice(0,100));return s.replace(a,b);}
export function specializeContinuousGlass(s,code){
 // The real-valued geometry and UV transport are the only changes to
 // existing surface optics. Preserve the material and interaction stages.
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
