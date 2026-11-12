/*
 * DoFinances five-component Liquid Glass gallery.
 *
 * Native-derived: 25F80/M2 DesignLibrary public regular radius, QuartzCore
 * Float32 blur selection, retained AIR mode-5 SDF/refraction/blur ramps.
 *
 * Browser approximations: Gaussian instead of Metal mipmap sampling; SVG
 * displacement instead of G14G fragment execution; color/EDR bypass; spring
 * timings are authored controls, not captured native interaction trajectories.
 */
import {
  nativePublicBlurRadius,
  observedBlurWord,
  airTextureMipLOD,
  SIDEBAR_PUBLIC_COLOR_PASSTHROUGH,
  SVG_DISPLACEMENT_NEUTRAL_BIAS
} from "/app/assets/sidebar-glass-oracle.js";

export const BACKGROUND_MODES=Object.freeze(["flat","design","photo"]);
export const GALLERY_COMPONENTS=Object.freeze(["panel","button","segments","slider","toggle"]);
const SVG_NS="http://www.w3.org/2000/svg";
const captions={
  flat:"A neutral field reveals the outline and soft highlight.",
  design:"Color and geometry reveal light transmission.",
  photo:"Natural detail makes the refraction easier to inspect."
};
const doc=typeof document==="undefined"?null:document;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function makeSVG(name,attrs={}){
  const node=doc.createElementNS(SVG_NS,name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
}

function makeFilter(id){
  const filter=makeSVG("filter",{
    id:id,x:"0%",y:"0%",width:"100%",height:"100%",
    filterUnits:"objectBoundingBox",primitiveUnits:"userSpaceOnUse",
    "color-interpolation-filters":"sRGB"
  });
  const blurFar=makeSVG("feGaussianBlur",{in:"SourceGraphic",stdDeviation:4,result:"farBlur"});
  const blurNear=makeSVG("feGaussianBlur",{in:"SourceGraphic",stdDeviation:2,result:"nearBlur"});
  const blurMap=makeSVG("feImage",{result:"blurMap",x:0,y:0,width:1,height:1,preserveAspectRatio:"none"});
  const innerNearCoverage=makeSVG("feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0",result:"innerNearCoverage"});
  const outerNearCoverage=makeSVG("feColorMatrix",{in:"blurMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0",result:"outerNearCoverage"});
  const nearInner=makeSVG("feComposite",{
    in:"nearBlur",in2:"innerNearCoverage",operator:"in",result:"innerNear"});
  const farInner=makeSVG("feComposite",{
    in:"farBlur",in2:"innerNearCoverage",operator:"out",result:"innerFar"});
  const innerBlur=makeSVG("feComposite",{
    in:"innerNear",in2:"innerFar",operator:"arithmetic",k2:1,k3:1,result:"innerBlurred"});
  const nearOuter=makeSVG("feComposite",{
    in:"nearBlur",in2:"outerNearCoverage",operator:"in",result:"outerNear"});
  const farOuter=makeSVG("feComposite",{
    in:"farBlur",in2:"outerNearCoverage",operator:"out",result:"outerFar"});
  const outerBlur=makeSVG("feComposite",{
    in:"outerNear",in2:"outerFar",operator:"arithmetic",k2:1,k3:1,result:"outerBlurred"});
  const innerMap=makeSVG("feImage",{result:"innerMap",x:0,y:0,width:1,height:1,preserveAspectRatio:"none"});
  const outerMap=makeSVG("feImage",{result:"outerMap",x:0,y:0,width:1,height:1,preserveAspectRatio:"none"});
  const bias=String(SVG_DISPLACEMENT_NEUTRAL_BIAS);
  // Native offset v is quantized by SVG; compensate byte 128's fixed 0.5 bias.
  const centered="1 0 0 0 -"+bias+"  0 1 0 0 -"+bias+"  0 0 1 0 0  0 0 0 1 0";
  const innerCentered=makeSVG("feColorMatrix",{
    in:"innerMap",type:"matrix",values:centered,result:"innerCentered"});
  const outerCentered=makeSVG("feColorMatrix",{
    in:"outerMap",type:"matrix",values:centered,result:"outerCentered"});
  const innerShift=makeSVG("feDisplacementMap",{
    in:"innerBlurred",in2:"innerCentered",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"innerShift"});
  const outerShift=makeSVG("feDisplacementMap",{
    in:"outerBlurred",in2:"outerCentered",scale:128,
    xChannelSelector:"R",yChannelSelector:"G",result:"outerShift"});
  const blendMask=makeSVG("feColorMatrix",{
    in:"innerMap",type:"matrix",
    values:"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",
    result:"outerBlend"});
  const outerPart=makeSVG("feComposite",{
    in:"outerShift",in2:"outerBlend",operator:"in",result:"outerPart"});
  const innerPart=makeSVG("feComposite",{
    in:"innerShift",in2:"outerBlend",operator:"out",result:"innerPart"});
  const joined=makeSVG("feComposite",{
    in:"outerPart",in2:"innerPart",operator:"arithmetic",k2:1,k3:1,result:"composited"});
  // Public face color is not identified. Do NOT apply private m1 matrix.
  const face=makeSVG("feColorMatrix",{
    in:"composited",type:"matrix",values:SIDEBAR_PUBLIC_COLOR_PASSTHROUGH});
  filter.append(
    blurFar,blurNear,blurMap,innerNearCoverage,outerNearCoverage,
    nearInner,farInner,innerBlur,nearOuter,farOuter,outerBlur,
    innerMap,outerMap,innerCentered,outerCentered,innerShift,outerShift,
    blendMask,outerPart,innerPart,joined,face
  );
  return {filter,blurFar,blurNear,blurMap,innerMap,outerMap};
}

function mountOpticalFields(){
  const components=[...doc.querySelectorAll("[data-oracle-surface]")];
  const noTransparency=window.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches ||
    window.matchMedia?.("(forced-colors: active)")?.matches;
  const supported=!!window.CSS?.supports?.("backdrop-filter",'url("#studio-glass-filter-0")');
  const canUse=!!supported&&!noTransparency&&typeof Worker==="function" &&
    typeof ResizeObserver==="function";
  if(!canUse){
    for(const element of components)element.dataset.opticalStatus="css-fallback";
    return ()=>{};
  }
  const defsHost=makeSVG("svg",{width:0,height:0,"aria-hidden":"true",focusable:"false"});
  defsHost.style.cssText="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const defs=makeSVG("defs");
  defsHost.append(defs);
  doc.body.append(defsHost);
  const records=new Map();
  const byId=new Map();
  const worker=new Worker(new URL("./gallery-field-worker.js",import.meta.url),{
    type:"module",name:"liquid-glass-gallery-field"
  });
  const observer=new ResizeObserver(entries=>{
    for(const entry of entries){
      const record=records.get(entry.target);
      if(record)update(record);
    }
  });
  let seq=0,disposed=false;
  for(const [i,element] of components.entries()){
    const optical=element.querySelector(".glass-optic");
    if(!optical)continue;
    const built=makeFilter("studio-glass-filter-"+i);
    defs.append(built.filter);
    const record={id:i,element,optical,...built,lastKey:"",pendingKey:""};
    element.dataset.opticalStatus="pending";
    records.set(element,record);byId.set(i,record);
    observer.observe(element);
  }

  function update(record){
    if(disposed)return;
    const rect=record.element.getBoundingClientRect();
    const width=Math.round(rect.width),height=Math.round(rect.height);
    const radius=Math.min(Number(record.element.dataset.radius)||22,width/2,height/2);
    if(width<1||height<1||width*height>200000)return;
    const key=width+"x"+height+"@"+radius;
    if(key===record.lastKey||key===record.pendingKey)return;
    // Do not paint a stale optical map while the panel is being resized.
    record.optical.style.backdropFilter="";
    record.optical.style.webkitBackdropFilter="";
    record.element.dataset.opticalStatus="pending";
    record.pendingKey=key;
    worker.postMessage({id:record.id,requestId:++seq,key,width,height,radius});
  }

  worker.addEventListener("message",event=>{
    if(disposed)return;
    const data=event.data||{};
    const record=byId.get(data.id);
    if(!record)return;
    if(data.error){
      record.pendingKey="";
      record.element.dataset.opticalStatus="css-fallback";
      return;
    }
    if(data.key!==record.pendingKey || !Array.isArray(data.urls) || data.urls.length!==3)
      return;
    const {width,height,radius}=data;
    const current=record.element.getBoundingClientRect();
    if(Math.round(current.width)!==width||Math.round(current.height)!==height){
      record.pendingKey="";
      update(record);
      return;
    }
    const surfaces=[
      [record.innerMap,data.urls[0]],
      [record.outerMap,data.urls[1]],
      [record.blurMap,data.urls[2]]
    ];
    for(const [node,uri] of surfaces){
      node.setAttribute("href",uri);
      node.setAttribute("width",width);
      node.setAttribute("height",height);
    }
    // Exact finite CPU arithmetic from the native observed source path;
    // Gaussian parameters are a documented browser approximation of mip LOD.
    const publicRadius=nativePublicBlurRadius("regular",width,height);
    const blurWord=observedBlurWord(publicRadius,1,.25);
    const far=blurWord/.25;
    record.blurFar.setAttribute("stdDeviation",String(far));
    record.blurNear.setAttribute("stdDeviation",String(far*.5));
    record.element.dataset.oracleRadius=String(publicRadius);
    record.element.dataset.oracleBlurWord=String(blurWord);
    record.element.dataset.oracleMipLod=String(airTextureMipLOD(blurWord,1));
    record.optical.style.backdropFilter='url("#'+record.filter.id+'")';
    record.optical.style.webkitBackdropFilter='url("#'+record.filter.id+'")';
    record.element.dataset.opticalStatus="native-derived";
    record.lastKey=data.key;
    record.pendingKey="";
  });
  worker.addEventListener("error",()=>{
    for(const record of records.values()){
      record.element.dataset.opticalStatus="css-fallback";
      record.optical.style.backdropFilter="";
      record.pendingKey="";
    }
    worker.terminate();
    disposed=true;
  });
  return ()=>{
    disposed=true;
    observer.disconnect();
    worker.terminate();
    defsHost.remove();
  };
}

function setupPointerSheen(){
  for(const element of doc.querySelectorAll("[data-oracle-surface]")){
    element.addEventListener("pointermove",event=>{
      if(event.pointerType==="touch")return;
      const r=element.getBoundingClientRect();
      if(r.width<1||r.height<1)return;
      element.style.setProperty("--px",String(clamp((event.clientX-r.left)/r.width*100,0,100))+"%");
      element.style.setProperty("--py",String(clamp((event.clientY-r.top)/r.height*100,0,100))+"%");
    },{passive:true});
    element.addEventListener("pointerleave",()=>{
      element.style.setProperty("--px","50%");
      element.style.setProperty("--py","50%");
    },{passive:true});
  }
}
function setupBackground(){
  const buttons=[...doc.querySelectorAll("[data-background]")];
  const caption=doc.querySelector("#environment-caption");
  function select(mode){
    if(!BACKGROUND_MODES.includes(mode))return;
    doc.body.dataset.scene=mode;
    for(const button of buttons){
      const selected=button.dataset.background===mode;
      button.classList.toggle("is-active",selected);
      button.setAttribute("aria-pressed",String(selected));
    }
    caption.textContent=captions[mode];
    try{window.localStorage.setItem("dofinances-studio-glass-environment",mode);}catch{}
  }
  for(const button of buttons)button.addEventListener("click",()=>select(button.dataset.background));
  const switcher=doc.getElementById("background-switcher");
  switcher.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const current=buttons.findIndex(x=>x.getAttribute("aria-pressed")==="true");
    const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:
      (current+(event.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;
    event.preventDefault();select(buttons[next].dataset.background);buttons[next].focus();
  });
  try{const saved=window.localStorage.getItem("dofinances-studio-glass-environment");
    if(BACKGROUND_MODES.includes(saved))select(saved);}catch{}
}
function setupPanel(){
  const element=doc.getElementById("panel-control");
  const status=doc.getElementById("panel-state");
  element.addEventListener("click",()=>{
    const expanded=element.getAttribute("aria-expanded")!=="true";
    element.setAttribute("aria-expanded",String(expanded));
    element.classList.toggle("is-expanded",expanded);
    status.textContent=expanded?"SURFACE EXPANDED":"READY TO EXPAND";
  });
}
function setupButton(){
  const action=doc.getElementById("action-button");
  const label=doc.getElementById("action-label");
  const feedback=doc.getElementById("action-feedback");
  let count=0;
  action.addEventListener("pointerdown",()=>action.classList.add("is-pressing"));
  for(const type of ["pointerup","pointercancel","pointerleave","blur"])
    action.addEventListener(type,()=>action.classList.remove("is-pressing"));
  action.addEventListener("click",()=>{
    count++;
    label.textContent="Created";
    feedback.textContent=count===1?"One moment of light, made tangible.":
      String(count)+" moments created.";
    feedback.classList.add("is-complete");
    action.dataset.presses=String(count);
  });
}
function setupSegments(){
  const container=doc.getElementById("period-control");
  const buttons=[...container.querySelectorAll("[data-period]")];
  const out=doc.getElementById("period-readout");
  const readouts={Day:"Today",Week:"This week",Month:"This month"};
  function select(index){
    const target=buttons[index];
    if(!target)return;
    container.style.setProperty("--segment-index",String(index));
    for(const button of buttons){
      const active=button===target;
      button.classList.toggle("is-selected",active);
      button.setAttribute("aria-pressed",String(active));
    }
    out.textContent=readouts[target.dataset.period];
  }
  buttons.forEach((button,index)=>button.addEventListener("click",()=>select(index)));
  container.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const index=buttons.findIndex(x=>x.getAttribute("aria-pressed")==="true");
    const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:
      (index+(event.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;
    event.preventDefault();select(next);buttons[next].focus();
  });
}
function setupSlider(){
  const range=doc.getElementById("diffusion-range");
  const output=doc.getElementById("diffusion-output");
  function update(){
    const v=clamp(Number(range.value),0,100);
    output.textContent=String(v)+"%";
    range.style.setProperty("--fill",String(v)+"%");
    doc.documentElement.style.setProperty("--glow",String(v/100));
  }
  range.addEventListener("input",update);
  range.addEventListener("change",update);
  update();
}
function setupToggle(){
  const toggle=doc.getElementById("clarity-switch");
  const description=doc.getElementById("toggle-description");
  toggle.addEventListener("click",()=>{
    const on=toggle.getAttribute("aria-checked")!=="true";
    toggle.setAttribute("aria-checked",String(on));
    doc.body.dataset.clarity=on?"on":"off";
    description.textContent=on?"On · brighter edges":"Off · softer contrast";
  });
}

export function initGallery(){
  if(!doc)return;
  setupBackground();
  setupPointerSheen();
  setupPanel();
  setupButton();
  setupSegments();
  setupSlider();
  setupToggle();
  mountOpticalFields();
}
if(doc)initGallery();
