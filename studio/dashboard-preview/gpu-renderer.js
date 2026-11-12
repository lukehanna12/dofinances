/* WebGPU-owned backdrop and Oracle-constrained Liquid Glass preview.
 * 25F80/M2/G14G reference; all stages are replaceable proof interfaces.
 * No baked-in backdrop samples, DOM screenshot, CPU-side mipmap generator,
 * per-square Canvas2D or precomputed displacement PNG. The photo is uploaded
 * ONCE as a GPU source, composed into a viewport texture, and downsampled
 * into ACTUAL GPU mip levels. Every square reads the same texture pyramid.
 *
 * Re-rendering squares never re-uploads the scene or rebuilds mipmaps.
 * Scene invalidation is separate: resize/source change regenerates the
 * backdrop; pointer motion/animation updates only a tiny uniforms buffer.
 * Future freely moving tiles can update one GPU tile buffer (or vertex
 * shader motion formula) without changing the backdrop.
 *
 * GAP PUBLIC-SCENE: this GPU scene currently contains the original photograph
 * and overlay, not arbitrary external HTML/DOM. Future refractable content
 * must be added as a GPU scene layer; normal DOM above the canvas remains UI.
 * GAP R-MIP-KERNEL: authored 2x2 explicit reduction awaits native proof.
 * GAP Q: browser presentation/color/EDR not Apple's output pipeline.
 */
import "./dashboard-mosaic.js";
import {nativePublicBlurRadius,observedBlurWord} from "./sidebar-glass-oracle.js";

const root=document.getElementById("cta6-mosaic");
const canvas=document.createElement("canvas");
const activeTiles=()=>root?[...root.querySelectorAll(
  ".cta6-tile--plain, .cta6-tile--icon")]:[];
const audit={
  path:"webgpu",status:"initializing",oracleTarget:"25F80/M2/G14G",
  scene:"GPU-owned centered photograph + 12% authored veil",
  sceneCapture:"No DOM screenshot/readback. Arbitrary external DOM is NOT included.",
  backend:"WebGPU",mipKernel:"explicit 2x2 RGBA16Float compute reduction",
  mipSampling:"WGSL manual bilinear + trilinear textureLoad",
  oracleMath:"four-corner mode5 SDF, refraction envelope, blur LOD; finite scope",
  mipCount:0,sceneBuilds:0,frameCount:0,tiles:0,errors:[]
};
Object.defineProperty(window,"__dashboardWebGPU",{
  configurable:true,get:()=>Object.freeze({...audit,errors:[...audit.errors]})
});
const start=performance.now();
const pointer={x:-1e6,y:-1e6,enabled:0};
let stopped=false,raf=0,engine=null,scenePending=false;
function requestRender(){
  if(!engine||stopped||raf)return;
  raf=requestAnimationFrame(()=>{
    raf=0;
    try{engine.render()}catch(e){fallback(e);}
    if(!stopped&&performance.now()-start<1250)requestRender();
  });
}
async function fallback(reason){
  if(stopped)return;
  stopped=true;
  if(raf)cancelAnimationFrame(raf);
  audit.status="fallback";
  audit.errors.push(String(reason));
  if(root){
    root.dataset.gpuStatus="fallback";
    root.dataset.gpuError=String(reason).slice(0,700);
  }
  document.body.dataset.gpuScene="fallback";
  canvas.remove();
  try{engine?.dispose()}catch{}
  // Avoid a blank preview where WebGPU is not available (e.g. a disabled
  // enterprise GPU or software adapter). Live DOM sampling still works.
  // The fallback is the EXISTING earlier SVG glass, not a fake GPU result.
  try{await import("./dashboard-optics.js")}catch(error){
    audit.errors.push("SVG fallback: "+String(error));
  }
}
function compileCheck(module,label){
  return module.getCompilationInfo().then(info=>{
    const problems=info.messages.filter(x=>x.type==="error");
    if(problems.length)throw new Error(label+" WGSL: "+
       problems.map(x=>x.lineNum+":"+x.linePos+" "+x.message).join("; "));
  });
}
function rgba16Texture(device,width,height){
  return device.createTexture({
    label:"One GPU-owned scene with real RGBA16F mip levels",
    size:[width,height,1],
    mipLevelCount:Math.floor(Math.log2(Math.max(width,height)))+1,
    format:"rgba16float",
    usage:GPUTextureUsage.TEXTURE_BINDING|
          GPUTextureUsage.RENDER_ATTACHMENT|
          GPUTextureUsage.STORAGE_BINDING
  });
}
function makeLayoutData(tile,scale){
  // Reading DOM positions only establishes the INITIAL user-selected layout.
  // Future translations are GPU-side parameters, not wallpaper captures.
  const b=tile.getBoundingClientRect();
  const w=tile.offsetWidth,h=tile.offsetHeight;
  const x=b.left+b.width*.5-w*.5;
  const y=b.top+b.height*.5-h*.5;
  const radius=Number.parseFloat(getComputedStyle(tile).borderTopLeftRadius)||0;
  const delay=Number.parseFloat(getComputedStyle(tile).getPropertyValue("--cta6-delay"))||0;
  const r=nativePublicBlurRadius("clear",w,h);
  // Finite native f32 selected factor, NOT universal scale-selection proof.
  const word=observedBlurWord(r,1,.25);
  return [x*scale,y*scale,w*scale,h*scale,
    radius*scale,delay,word,0];
}
export function makeTileFloatData(elements,dpr){
  const out=new Float32Array(elements.length*8);
  elements.forEach((tile,i)=>out.set(makeLayoutData(tile,dpr),i*8));
  return out;
}
function geometry(width,height,imgWidth,imgHeight){
  const drawScale=Math.max(width/imgWidth,height/imgHeight);
  const drawn=[imgWidth*drawScale,imgHeight*drawScale];
  return [width/drawn[0],height/drawn[1]];
}
export function coverUVScale(width,height,imgWidth,imgHeight){
  return geometry(width,height,imgWidth,imgHeight);
}

async function initialize(){
  if(!root)return;
  if(!navigator.gpu)throw new Error("WebGPU API not available");
  const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});
  if(!adapter)throw new Error("No WebGPU adapter available");
  const device=await adapter.requestDevice();
  const context=canvas.getContext("webgpu");
  if(!context)throw new Error("No GPUCanvasContext");
  const format=navigator.gpu.getPreferredCanvasFormat();
  context.configure({device,format,alphaMode:"opaque"});
  canvas.id="dashboard-webgpu-scene";
  canvas.setAttribute("aria-hidden","true");
  document.body.insertBefore(canvas,document.getElementById("workspace-shell"));
  const url="/app/assets/home-rice-terraces-hq.jpg";
  const response=await fetch(url);
  if(!response.ok)throw new Error("Backdrop image HTTP "+response.status);
  const bitmap=await createImageBitmap(await response.blob());
  const photoWidth=bitmap.width,photoHeight=bitmap.height;
  const photo=device.createTexture({
    size:[photoWidth,photoHeight,1],format:"rgba8unorm",
    usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST
  });
  device.queue.copyExternalImageToTexture({source:bitmap},
    {texture:photo},[photoWidth,photoHeight]);
  bitmap.close();

  const base="/app/assets/";
  const sources=await Promise.all([
    "dashboard-gpu-scene.wgsl",
    "dashboard-gpu-mipmap.wgsl",
    "dashboard-gpu-glass.wgsl"
  ].map(async name=>{
    const r=await fetch(base+name);
    if(!r.ok)throw new Error(name+" HTTP "+r.status);
    return r.text();
  }));
  const modules=sources.map((code,i)=>device.createShaderModule({
    label:["background","explicit mip reduction","oracle glass"][i],code
  }));
  await Promise.all(modules.map((x,i)=>compileCheck(x,["scene","mips","glass"][i])));
  device.pushErrorScope("validation");
  const backdropPipeline=device.createRenderPipeline({
    label:"GPU-owned scene -> mip0",
    layout:"auto",
    vertex:{module:modules[0],entryPoint:"vsScene"},
    fragment:{module:modules[0],entryPoint:"fsScene",
      targets:[{format:"rgba16float"}]},
    primitive:{topology:"triangle-list"}
  });
  const mipPipeline=device.createComputePipeline({
    label:"Explicit 2x2 real GPU mip level",
    layout:"auto",compute:{module:modules[1],entryPoint:"mip2x2"}
  });
  const copyPipeline=device.createRenderPipeline({
    label:"Mip0 scene -> display canvas",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsCopy"},
    fragment:{module:modules[2],entryPoint:"fsCopy",
      targets:[{format}]},primitive:{topology:"triangle-list"}
  });
  const glassPipeline=device.createRenderPipeline({
    label:"Oracle refraction per instanced tile; manual trilinear mip sampling",
    layout:"auto",
    vertex:{module:modules[2],entryPoint:"vsGlass"},
    fragment:{module:modules[2],entryPoint:"fsGlass",targets:[{
      format,blend:{
        color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},
        alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}
      }
    }]},primitive:{topology:"triangle-list"}
  });
  const pipelineError=await device.popErrorScope();
  if(pipelineError)throw Error("GPU pipeline validation: "+pipelineError.message);
  const sampler=device.createSampler({
    magFilter:"linear",minFilter:"linear",mipmapFilter:"nearest",
    addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"
  });
  const globalsBuffer=device.createBuffer({
    size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
  });
  let tileBuffer=null,scene=null,sceneView=null,mipGroups=[],copyGroup=null,
    glassGroup=null,backgroundGroup=null,tileCount=0,physicalWidth=0,physicalHeight=0,
    dpr=1;
  const uniform=new Float32Array(12);
  function writeUniform(){
    uniform[0]=physicalWidth;
    uniform[1]=physicalHeight;
    uniform[2]=(performance.now()-start)/1000;
    uniform[3]=dpr;
    const fit=coverUVScale(physicalWidth,physicalHeight,photoWidth,photoHeight);
    uniform[4]=fit[0];uniform[5]=fit[1];uniform[6]=.12;uniform[7]=0;
    uniform[8]=pointer.x*dpr;uniform[9]=pointer.y*dpr;
    uniform[10]=pointer.enabled;uniform[11]=0;
    device.queue.writeBuffer(globalsBuffer,0,uniform);
  }
  function rebuild(){
    if(stopped)return;
    const w=Math.max(1,Math.floor(window.innerWidth*window.devicePixelRatio));
    const h=Math.max(1,Math.floor(window.innerHeight*window.devicePixelRatio));
    if(w>device.limits.maxTextureDimension2D||h>device.limits.maxTextureDimension2D)
      throw new Error("Viewport exceeds GPU maxTextureDimension2D");
    dpr=window.devicePixelRatio||1;
    const sized=w!==physicalWidth||h!==physicalHeight||!scene;
    physicalWidth=w;physicalHeight=h;
    if(sized){
      canvas.width=w;canvas.height=h;
      canvas.style.width=window.innerWidth+"px";
      canvas.style.height=window.innerHeight+"px";
      scene?.destroy();
      scene=rgba16Texture(device,w,h);
      sceneView=scene.createView();
      audit.mipCount=scene.mipLevelCount;
      backgroundGroup=device.createBindGroup({
        layout:backdropPipeline.getBindGroupLayout(0),
        entries:[
          {binding:0,resource:photo.createView()},
          {binding:1,resource:sampler},
          {binding:2,resource:{buffer:globalsBuffer}}
        ]
      });
      mipGroups=[];
      for(let level=1;level<scene.mipLevelCount;level++){
        mipGroups.push(device.createBindGroup({
          layout:mipPipeline.getBindGroupLayout(0),
          entries:[
            {binding:0,resource:scene.createView({
              baseMipLevel:level-1,mipLevelCount:1})},
            {binding:1,resource:scene.createView({
              baseMipLevel:level,mipLevelCount:1})}
          ]
        }));
      }
      copyGroup=device.createBindGroup({
        layout:copyPipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:sceneView}]
      });
      scenePending=true;
    }
    const all=activeTiles();
    const data=makeTileFloatData(all,dpr);
    tileCount=all.length;audit.tiles=tileCount;
    tileBuffer?.destroy();
    tileBuffer=device.createBuffer({
      size:Math.max(32,data.byteLength),
      usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST
    });
    if(data.length)device.queue.writeBuffer(tileBuffer,0,data);
    glassGroup=device.createBindGroup({
      layout:glassPipeline.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:sceneView},
        {binding:1,resource:{buffer:tileBuffer}},
        {binding:2,resource:{buffer:globalsBuffer}}
      ]
    });
  }
  function buildScene(){
    const encoder=device.createCommandEncoder({label:"Scene & full real mip chain"});
    const pass=encoder.beginRenderPass({colorAttachments:[{
      view:scene.createView({baseMipLevel:0,mipLevelCount:1}),
      loadOp:"clear",clearValue:[0.04,0.04,0.04,1],storeOp:"store"
    }]});
    pass.setPipeline(backdropPipeline);
    pass.setBindGroup(0,backgroundGroup);
    pass.draw(3);
    pass.end();
    for(let level=1;level<scene.mipLevelCount;level++){
      const next=encoder.beginComputePass({label:"mip level "+level});
      next.setPipeline(mipPipeline);
      next.setBindGroup(0,mipGroups[level-1]);
      next.dispatchWorkgroups(Math.ceil(Math.max(1,physicalWidth>>level)/8),
        Math.ceil(Math.max(1,physicalHeight>>level)/8),1);
      next.end();
    }
    device.queue.submit([encoder.finish()]);
    scenePending=false;
    audit.sceneBuilds++;
  }
  function render(){
    writeUniform();
    if(scenePending)buildScene();
    const encoder=device.createCommandEncoder({label:"Glass only frame"});
    const pass=encoder.beginRenderPass({
      colorAttachments:[{view:context.getCurrentTexture().createView(),
        loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]
    });
    pass.setPipeline(copyPipeline);pass.setBindGroup(0,copyGroup);
    pass.draw(3);
    if(tileCount){
      pass.setPipeline(glassPipeline);pass.setBindGroup(0,glassGroup);
      pass.draw(6,tileCount);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
    audit.frameCount++;
  }
  function dispose(){
    tileBuffer?.destroy();scene?.destroy();photo.destroy();
    globalsBuffer.destroy();
  }
  engine={rebuild,render,dispose,device};
  rebuild();
  render();
  // A valid initial command buffer has been submitted. Reject GPU pipeline
  // errors before removing the CSS fallback background.
  await device.queue.onSubmittedWorkDone();
  document.body.dataset.gpuScene="ready";
  audit.status="ready";
  root.dataset.gpuRenderer="webgpu";
  root.dataset.gpuStatus="ready";
  root.dataset.gpuMipLevels=String(audit.mipCount);
  root.dataset.gpuTileCount=String(audit.tiles);
  document.querySelectorAll(".cta6-tile--plain,.cta6-tile--icon")
    .forEach(tile=>tile.classList.add("cta6-tile--webgpu"));
  window.addEventListener("pointermove",event=>{
    if(event.pointerType==="touch")return;
    pointer.x=event.clientX;pointer.y=event.clientY;
    pointer.enabled=1;requestRender();
  },{passive:true});
  window.addEventListener("pointerout",event=>{
    if(event.relatedTarget)return;
    pointer.enabled=0;requestRender();
  },{passive:true});
  window.addEventListener("blur",()=>{
    pointer.enabled=0;requestRender();
  });
  let sizeQueued=false;
  const onSize=()=>{
    if(sizeQueued||stopped)return;
    sizeQueued=true;
    requestAnimationFrame(()=>{
      sizeQueued=false;
      try{engine.rebuild();requestRender()}catch(error){fallback(error)}
    });
  };
  window.addEventListener("resize",onSize,{passive:true});
  const resizeObserver=new ResizeObserver(onSize);
  resizeObserver.observe(root);
  device.lost.then(reason=>{
    resizeObserver.disconnect();
    fallback("GPU device lost: "+reason.message);
  });
  requestRender();
}
initialize().catch(fallback);
