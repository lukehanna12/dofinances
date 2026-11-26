/* Shared accessible task pane; only explicit user actions write to a workbook. */
(() => {
 "use strict";
 const $=id=>document.getElementById(id), host=globalThis.LatexcelHost;
 const tex=$("tex"), preview=$("preview"), status=$("status");
 const specs=Latexcel.definitions.filter(s=>s.category!=="External rendering");
 let result=null,revision=0,busy=false,hostReady=false,selected=null;
 function say(message,error=false){status.textContent=message;status.dataset.error=String(error);}
 function invalidate(){revision++;result=null;syncButtons();preview.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Render the current expression to preview it."}));}
 function syncButtons(){
   $("render").disabled=busy;
   $("compose").disabled=busy||!$("function").value||args().some(a=>typeof a==="object");
   $("copy").disabled=busy;
   for(const id of ["svg","png"])$(id).disabled=busy||!result;
   for(const id of ["read","insert-source","compose-formula"])$(id).disabled=busy||!hostReady;
   $("insert-image").disabled=busy||!hostReady||!result||!host.canInsertImage;
   $("insert-url").disabled=busy||!hostReady||!$("consent").checked;
 }
 async function perform(fn){
   if(busy)return;
   busy=true;syncButtons();
   try{await fn();}catch(e){say(e?.message||String(e),true);}
   finally{busy=false;syncButtons();}
 }
 async function render(){
   const token=++revision;result=null;syncButtons();
   preview.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Rendering equation..."}));
   try{
     const r=await LatexcelRenderer.render(tex.value);
     if(token!==revision)return;
     result=r;preview.replaceChildren(r.svg);say("Equation ready.");
   }catch(e){if(token!==revision)return;preview.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Preview unavailable."}));throw e;}
   finally{syncButtons();}
 }
 function choose(name){
   const spec=specs.find(s=>s.name===name);if(!spec)return;
   $("function-description").textContent=spec.description;
   $("arguments").replaceChildren();
   spec.args.forEach((arg,i)=>{
     const wrap=document.createElement("div"),label=document.createElement("label"),input=document.createElement("input");
     input.id="argument-"+i;input.value=spec.example[i]??"";input.maxLength=Latexcel.MAX;input.spellcheck=false;
     const mode=document.createElement("select");mode.id="arg-mode-"+i;mode.setAttribute("aria-label",arg+" input type");
     mode.append(new Option("Literal","literal"),new Option("Cell reference","reference"));
     mode.addEventListener("change",()=>{input.placeholder=mode.value==="reference"?"A1":"";if(mode.value==="reference")input.value="A1";else input.value=spec.example[i]??"";showExample();});
     label.htmlFor=input.id;label.textContent=arg;wrap.append(label,mode,input);$("arguments").append(wrap);input.addEventListener("input",showExample);
   });
   showExample();
 }
 function args(){return [...$("arguments").querySelectorAll("input")].map((x,i)=>$("arg-mode-"+i).value==="reference"?{kind:"reference",address:x.value}:x.value);}
 function showExample(){
   try{const mode=host.kind==="excel"?"excel":"sheets";$("function-example").textContent=Latexcel.functionFormula(mode,$("function").value,args());}
   catch(e){$("function-example").textContent=e.message;}
   $("compose").disabled=busy||!$("function").value||args().some(a=>typeof a==="object");
 }
 function listFunctions(){
   const query=$("function-search").value.toLowerCase().trim(), previous=$("function").value;
   $("function").replaceChildren();
   for(const group of [...new Set(specs.map(s=>s.category))]){
     const matches=specs.filter(s=>s.category===group&&(s.name+" "+s.description+" "+s.category).toLowerCase().includes(query));
     if(!matches.length)continue;
     const opt=document.createElement("optgroup");opt.label=group;
     matches.forEach(s=>opt.append(new Option(s.name+" | "+s.description,s.name)));
     $("function").append(opt);
   }
   if([...$("function").options].some(o=>o.value===previous))$("function").value=previous;
   if(!$("function").value){$("arguments").replaceChildren();$("function-description").textContent="No matching functions."; $("function-example").textContent="";syncButtons();return;}
   choose($("function").value);
 }
 async function select(){
   const s=await host.read();selected=s;
   $("target").textContent=s.address;
   $("selected-formula").textContent=s.formula||"No formula in selected cell.";
   return s;
 }
 function confirmReplace(address){
   const dialog=$("confirm-dialog");
   $("confirm-text").textContent="Replace the existing contents of "+address+"?";
   return new Promise(resolve=>{
     dialog.returnValue="cancel";
     dialog.addEventListener("close",()=>resolve(dialog.returnValue==="replace"),{once:true});
     dialog.showModal();
   });
 }
 async function write(mode,payload){
   const s=await select();
   let overwrite=false;
   if(mode!=="png"&&s.occupied){
     overwrite=await confirmReplace(s.address);
     if(!overwrite){say("Insertion canceled. Nothing changed.");return;}
   }
   await host.write({mode,payload,target:s.token,overwrite});
   say(mode==="png"?"Image inserted at "+s.address+".":"Inserted at "+s.address+".");
 }
 function download(blob,filename){
   const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 async function copy(){
   if(!tex.value)throw Error("Enter an expression first.");
   if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(tex.value);say("LaTeX copied.");return;}catch{}}
   tex.focus();tex.select();if(!document.execCommand("copy"))throw Error("Copy manually from the selected editor text.");say("LaTeX copied.");
 }
 $("render").onclick=()=>perform(render);
 $("copy").onclick=()=>perform(copy);
 tex.addEventListener("input",()=>{invalidate();say("Source changed. Render to refresh the preview.");});
 tex.addEventListener("keydown",event=>{if(event.key==="Enter"&&(event.ctrlKey||event.metaKey)){event.preventDefault();perform(render);}});
 $("function-search").addEventListener("input",listFunctions);
 $("function").addEventListener("change",()=>choose($("function").value));
 $("compose").onclick=()=>perform(async()=>{tex.value=Latexcel.call($("function").value,...args());invalidate();await render();});
 $("compose-formula").onclick=()=>perform(()=>write("function",{name:$("function").value,args:args()}));
 $("read").onclick=()=>perform(async()=>{
   const s=await select();invalidate();
   if(s.imageUrl){tex.value="";const img=document.createElement("img");img.alt=s.alt||"Selected cell image";img.src=s.imageUrl;img.style.maxWidth="100%";preview.replaceChildren(img);say("Existing cell image preview. Source is unchanged.");return;}
   if(typeof s.value!=="string"&&!["number","boolean"].includes(typeof s.value))throw Error("The selected cell does not contain a scalar expression.");
   const raw=String(s.value??"");
   tex.value=Latexcel.decodeLegacyURL(raw)??raw;
   if(!tex.value){preview.replaceChildren();say("Selected cell is empty.");return;}
   await render();
 });
 $("insert-source").onclick=()=>perform(()=>write("source",{tex:Latexcel.text(tex.value)}));
 $("insert-image").onclick=()=>perform(async()=>{if(!result)throw Error("Render the expression first.");await write("png",await LatexcelRenderer.png(result,Number($("density").value)));});
 $("consent").onchange=syncButtons;
 $("insert-url").onclick=()=>perform(()=>write("external",$("source-reference").value.trim()?{reference:Latexcel.cellReference($("source-reference").value),consent:$("consent").checked}:{tex:Latexcel.renderInput(tex.value),consent:$("consent").checked}));
 $("svg").onclick=()=>perform(async()=>{if(!result)throw Error("Render first.");download(LatexcelRenderer.svgBlob(result),"latexcel-equation.svg");say("SVG export prepared.");});
 $("png").onclick=()=>perform(async()=>{if(!result)throw Error("Render first.");const p=await LatexcelRenderer.png(result,Number($("density").value));const bytes=Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0));download(new Blob([bytes],{type:"image/png"}),"latexcel-equation.png");say("PNG export prepared.");});
 $("version").textContent=Latexcel.version;
 $("function-count").textContent=Latexcel.definitions.length+" functions";
 $("host-badge").textContent=host.label;
 const prefix=host.kind==="excel"?"LATEXCEL.":"LATEXCEL_";
 $("syntax").textContent="Use "+prefix+"NAME(...) in your workbook. External URL functions do not fetch images themselves.";
 for(const group of [...new Set(Latexcel.definitions.map(s=>s.category))]){
   const details=document.createElement("details"),summary=document.createElement("summary");summary.textContent=group;details.append(summary);
   Latexcel.definitions.filter(s=>s.category===group).forEach(s=>{const p=document.createElement("p"),code=document.createElement("code");code.textContent=prefix+s.name+"("+s.args.join(", ")+")";p.append(code,document.createElement("br"),document.createTextNode(s.description));details.append(p);});$("reference").append(details);
 }
 listFunctions();syncButtons();
 Promise.resolve().then(()=>host.ready()).then(()=>{hostReady=host.kind!=="demo";syncButtons();if(host.kind==="demo")$("image-hint").textContent="This preview is not connected to a workbook. Install the relevant add-on to insert equations.";}).catch(e=>say(e.message,true));
 perform(render);
})();
