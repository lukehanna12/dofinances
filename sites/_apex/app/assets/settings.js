/* In-page Settings navigation: buttons never replace the workspace hash route. */
export function initSettingsNavigation(doc=globalThis.document){
 if(!doc)return;
 const root=doc.getElementById("st-root");
 if(!root||root.dataset.navigationReady==="true")return;
 root.dataset.navigationReady="true";
 for(const button of root.querySelectorAll("[data-st-target]")){
  button.addEventListener("click",()=>{
   const id=button.dataset.stTarget,section=doc.getElementById(id);
   if(!section||!root.contains(section))return;
   const reduce=typeof window!=="undefined"&&window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
   section.scrollIntoView({block:"start",behavior:reduce?"auto":"smooth"});
  });
 }
}
if(typeof document!=="undefined")initSettingsNavigation(document);
