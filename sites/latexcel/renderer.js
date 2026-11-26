/* Browser-local MathJax SVG renderer, bounded output, no formula upload. */
var LatexcelRenderer = (() => {
 "use strict";
 const NS="http://www.w3.org/2000/svg", MAX_NODES=20000, MAX_PIXELS=4000000;
 const cache=new Map();
 let cacheBytes=0;
 const CACHE_LIMIT=1500000, CACHE_COUNT=16;
 const allowed=new Set(["svg","g","path","rect","line","polygon","polyline","circle","ellipse","title","desc","defs","use","text","tspan"]);
 async function engine(){
   const mj=globalThis.MathJax;
   if(!mj||!mj.startup||!mj.startup.promise)throw Error("The local math renderer is unavailable. Reload the add-in.");
   await mj.startup.promise;
   if(typeof mj.tex2svgPromise!=="function")throw Error("Math renderer did not initialize.");
   return mj;
 }
 function clean(node){
   const svg=node.querySelector("svg");
   if(!svg||node.querySelector('[data-mml-node="merror"]'))throw Error("Invalid or unsupported LaTeX expression.");
   const out=svg.cloneNode(true);
   const elements=[out,...out.querySelectorAll("*")];
   if(elements.length>MAX_NODES)throw Error("The rendered expression is too complex.");
   for(const el of elements){
     if(el.namespaceURI!==NS||!allowed.has(el.localName))throw Error("Unsupported SVG element.");
     for(const a of [...el.attributes]){
       if(/^on/i.test(a.name)||/url\s*\(/i.test(a.value))throw Error("Active SVG content is not allowed.");
       if(/(?:^|:)href$/i.test(a.name)&&!/^#[A-Za-z0-9_.:-]+$/.test(a.value))throw Error("External SVG resources are not allowed.");
       if(a.name==="style"||a.name==="class")el.removeAttribute(a.name);
       if(a.value==="currentColor"&&(a.name==="stroke"||a.name==="fill"))el.setAttribute(a.name,"#17212e");
     }
   }
   const view=(out.getAttribute("viewBox")||"").trim().split(/\s+/).map(Number);
   if(view.length!==4||view.some(n=>!Number.isFinite(n))||view[2]<=0||view[3]<=0)throw Error("Invalid equation dimensions.");
   out.setAttribute("xmlns",NS);
   out.setAttribute("role","img");
   out.setAttribute("preserveAspectRatio","xMidYMid meet");
   // MathJax uses a 1000-unit em. Use 24 CSS pixels/em and cap very long formulas.
   const scale=Math.min(0.024,1800/view[2],1200/view[3]);
   const width=Math.max(1,Math.ceil(view[2]*scale)),height=Math.max(1,Math.ceil(view[3]*scale));
   out.setAttribute("width",String(width));out.setAttribute("height",String(height));
   return {svg:out,width,height};
 }
 async function render(tex){
   const input=Latexcel.renderInput(tex);
   if(cache.has(input)){
     const item=cache.get(input);cache.delete(input);cache.set(input,item);
     return {...item.result,svg:item.result.svg.cloneNode(true)};
   }
   const mj=await engine();
   const wrapper=await mj.tex2svgPromise(input,{display:true});
   const result=clean(wrapper);
   result.tex=input;
   result.svg.setAttribute("aria-label","Typeset mathematical expression");
   const bytes=svgText(result).length*2;
   if(bytes<=CACHE_LIMIT){
     const saved={...result,svg:result.svg.cloneNode(true)};
     cache.set(input,{result:saved,bytes});cacheBytes+=bytes;
     while(cache.size>CACHE_COUNT||cacheBytes>CACHE_LIMIT){
       const key=cache.keys().next().value;cacheBytes-=cache.get(key).bytes;cache.delete(key);
     }
   }
   return result;
 }
 function svgText(result){return new XMLSerializer().serializeToString(result.svg);}
 function svgBlob(result){return new Blob([svgText(result)],{type:"image/svg+xml;charset=utf-8"});}
 async function png(result,density=2){
   if(!Number.isInteger(density)||density<1||density>3)throw Error("PNG density must be 1, 2, or 3.");
   const scale=Math.min(density,Math.sqrt(MAX_PIXELS/(result.width*result.height)));
   const width=Math.max(1,Math.floor(result.width*scale)),height=Math.max(1,Math.floor(result.height*scale));
   const url=URL.createObjectURL(svgBlob(result));
   try{
     const img=new Image();
     await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Could not rasterize the equation."));img.src=url;});
     const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
     const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas rendering is unavailable.");
     ctx.drawImage(img,0,0,width,height);
     const data=canvas.toDataURL("image/png");
     if(!data.startsWith("data:image/png;base64,"))throw Error("PNG export failed.");
     return {base64:data.slice(22),width,height,displayWidth:result.width,displayHeight:result.height};
   }finally{URL.revokeObjectURL(url);}
 }
 return Object.freeze({render,svgText,svgBlob,png});
})();
