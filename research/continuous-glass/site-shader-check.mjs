// Compile both actual public renderers, using the reference browser and
// original shader entrypoints, not the separate research compute shader.
import {specializeContinuousGlass,loadContinuousGlass} from "/site/dashboard-glass-continuous.js";
export async function run(){
 const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});
 if(!adapter)throw Error("No WebGPU");
 const f16=adapter.features.has("shader-f16"),device=await adapter.requestDevice({requiredFeatures:f16?["shader-f16"]:[]});
 const original=await(await fetch("/site/dashboard-gpu-glass.wgsl")).text();
 const data=await loadContinuousGlass(device,"/site/");
 const out=[];
 try{for(const mode of ["baseline","continuous"]){
  let code=mode==="baseline"?original:specializeContinuousGlass(original,data.code);
  code=(f16?"enable f16;\n":"")+code.replaceAll("__ORACLE_HALF_BODY__",f16?"return vec3<f32>(vec3<f16>(v));":"return v;");
  const module=device.createShaderModule({code}),info=await module.getCompilationInfo();
  const errors=info.messages.filter(m=>m.type==="error");if(errors.length)throw Error(mode+" "+errors.map(e=>e.lineNum+":"+e.message).join(";"));
  const t=performance.now();
  for(const format of ["bgra8unorm","rgba16float"])await device.createRenderPipelineAsync({layout:"auto",vertex:{module,entryPoint:"vsGlass"},fragment:{module,entryPoint:"fsGlass",targets:[{format}]},primitive:{topology:"triangle-list"}});
  out.push({mode,compileMs:performance.now()-t,errors:0});
 }return {adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,f16},curveCount:data.curveCount,bytes:data.bytes,out};}finally{data.dispose();device.destroy();}
}
