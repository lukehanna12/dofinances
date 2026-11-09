import {mountOracleBackdrop} from "/app/assets/sidebar-glass-oracle.js";
import {createGPUExperiment} from "./gpu-renderer.js";

const width=260,height=640;
const status=document.querySelector("#status");
const bench=document.querySelector("#benchmark");
const button=document.querySelector("#benchmark-button");
function sourceImage(){
  const c=document.createElement("canvas");c.width=width;c.height=height;
  const context=c.getContext("2d");
  const gradient=context.createLinearGradient(0,0,width,height);
  gradient.addColorStop(0,"#25384b");gradient.addColorStop(.5,"#ac8171");gradient.addColorStop(1,"#17445c");
  context.fillStyle=gradient;context.fillRect(0,0,width,height);
  for(let x=0;x<width;x+=23){
    context.fillStyle=x%2?"#dceefd":"#101f31";context.fillRect(x,0,3,height);
  }
  for(let y=0;y<height;y+=38){
    context.fillStyle="rgba(226,247,242,.40)";context.fillRect(0,y,width,2);
  }
  context.beginPath();context.strokeStyle="#ffffff";context.lineWidth=4;
  context.arc(222,162,73,0,Math.PI*2);context.stroke();
  context.beginPath();context.arc(38,470,48,0,Math.PI*2);context.stroke();
  return {pixels:context.getImageData(0,0,width,height).data,image:c.toDataURL("image/png")};
}
const source=sourceImage();
document.querySelector("#svg-scene").style.backgroundImage=`url("${source.image}")`;
document.querySelector("#gpu-scene").style.backgroundImage=`url("${source.image}")`;
document.querySelector("#gpu-scene").style.backgroundSize=`${width}px ${height}px`;
// The source texture is the SAME generated data as the SVG browser backdrop.
const ref=mountOracleBackdrop({doc:document,win:window,
  shell:document.querySelector("#svg-scene"),sidebar:document.querySelector("#svg-pane")});
let gpu=null;
try{
  gpu=await createGPUExperiment(document.querySelector("#gpu-canvas"),source.pixels,width,height,24);
  status.textContent="GPU shader ready. Exact same test source texture as the SVG pane.\n"+
    "Framebuffers: persistent WebGPU pipelines + Oracle geometry fields.\n"+
    "Backdrop scope: controlled input, NOT arbitrary DOM.\n"+
    "Reference SVG active: "+String(ref.active);
  document.documentElement.dataset.gpuLabReady="true";
  button.disabled=false;
  button.addEventListener("click",async()=>{
    button.disabled=true;bench.textContent="Benchmark running…";
    try{
      const numbers=await gpu.benchmark(80);
      bench.textContent=JSON.stringify(numbers,null,2);
      document.documentElement.dataset.gpuLabBenchmark=JSON.stringify(numbers);
    }catch(error){bench.textContent=String(error)}
    button.disabled=false;
  });
}catch(error){
  status.textContent="WebGPU unavailable: "+String(error)+"\nSVG reference still active.";
  document.documentElement.dataset.gpuLabReady="unavailable";
}
window.addEventListener("pagehide",()=>{ref.dispose();gpu?.dispose();},{once:true});
