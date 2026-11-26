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
 const data=new Float32Array((n+asset.curveCount)*12),index=new Map(),view=new DataView(bytes.buffer);
 for(let i=0;i<bytes.length/4;i++)data[n*12+i]=view.getFloat32(i*4,true);
 entries.forEach(([name,v],i)=>{
  if(v.count<=0||v.start<0||v.start+v.count>asset.curveCount||v.scale<=0)throw Error("Invalid icon range");
  data.set([...v.origin,v.scale,v.count,n+v.start,v.viewBox[2],v.viewBox[0],v.viewBox[1],v.viewBox[3],0,0,0],i*12);
  index.set(name,i+1);
 });
 const buffer=device.createBuffer({label:"Continuous authored vector controls",size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(buffer,0,data);
 return {buffer,code,curveCount:asset.curveCount,bytes:data.byteLength,indexFor(img){const name=new URL(img.currentSrc||img.src,location.href).pathname.split("/").at(-1).replace(/\.svg$/,"");return index.get(name)||0;},dispose(){buffer.destroy();}};
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
 s=once(s,"let signed=(mask.g-0.5)*256.0*scale;","var signed=(mask.g-0.5)*256.0*scale;");
 s=once(s,"let normal=grad/max(length(grad),0.00001);","var normal=grad/max(length(grad),0.00001);\n  if(icon.coverageMeta.w>0.0){let f=continuousIconField(icon,local);signed=f.x;normal=f.yz;}");
 s=once(s,"let sampleUV=nativeHalf2(parentInnerUV+nativeHalf2(displacement/backdropExtent));","let sampleUV=parentInnerUV+displacement/backdropExtent;");
 // Cancellation-stable real extension; same amount/height parameters.
 const envelope="fn continuousEnvelope(d:f32,amount:f32,invHeight:f32)->f32{let t=clamp(-d*invHeight,0.0,1.0);let q=1.0-t;return amount*q*q/(1.0+sqrt(t*(2.0-t)));}\n";
 s=once(s,"let inner=refractionEnvelope(signed,max(-60.0,-clearD)*pointScale,","let inner=continuousEnvelope(signed,max(-60.0,-clearD)*pointScale,");
 s=once(s,"let inner=refractionEnvelope(signed,innerAmount,innerInvHeight);","let inner=continuousEnvelope(signed,innerAmount,innerInvHeight);");
 s=once(s,"let outer=refractionEnvelope(signed,select(outerAmount,0.0,regular),","let outer=continuousEnvelope(signed,select(outerAmount,0.0,regular),");
 return s+"\n"+envelope+code;
}
