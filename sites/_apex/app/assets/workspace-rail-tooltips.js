/*
 * Collapsed DESKTOP rail navigation labels. One body-level tooltip is shared
 * by every visible screen link and the Home brand, so the glass sidebar's
 * overflow clipping never crops it. This deliberately does NOT attach to
 * the blank-rail expand target (its existing no-hover-popup contract).
 *
 * Same typography, colors, 150ms pointer delay, 250ms entrance, and
 * keyboard-immediate behavior as Collections' .cs-create-tooltip.
 * Event driven only: no scroll-position polling, animation loop, observer,
 * background snapshots, or duplicate tooltip trees.
 */
export function initCollapsedRailTooltips(doc=document,win=window,shell,sidebar){
 if(!doc?.body?.appendChild||!doc?.createElement||
    !shell?.classList||!sidebar?.querySelectorAll)return null;
 const links=[...sidebar.querySelectorAll(".sidebar-navigation .nav-link, .sidebar-head .brand")];
 const tip=doc.createElement("span");
 tip.id="workspace-rail-tooltip";
 tip.className="workspace-rail-tooltip";
 tip.setAttribute("role","tooltip");
 tip.setAttribute("aria-hidden","true");
 doc.body.appendChild(tip);
 let hovered=null,focused=null,shown=null,disposed=false;
 const active=()=>!disposed&&shell.classList.contains("is-collapsed")&&
  !shell.classList.contains("is-rail-expanded")&&
  !win.matchMedia?.("(max-width: 760px)")?.matches;
 const hide=()=>{
  if(shown?.getAttribute("aria-describedby")==="workspace-rail-tooltip")
   shown.removeAttribute("aria-describedby");
  shown=null;
  tip.classList.remove("is-visible","is-keyboard");
  tip.setAttribute("aria-hidden","true");
 };
 const show=link=>{
  if(!active()||!link?.getClientRects?.().length){hide();return;}
  const label=(link.getAttribute("aria-label")||
    link.querySelector(".nav-label-text")?.textContent||"").trim();
  if(!label){hide();return;}
  if(shown&&shown!==link&&shown.getAttribute("aria-describedby")==="workspace-rail-tooltip")
   shown.removeAttribute("aria-describedby");
  shown=link;
  tip.textContent=label;
  tip.setAttribute("aria-hidden","false");
  // Read geometry only on a real pointer/focus event, not on page scroll.
  const rect=link.getBoundingClientRect();
  const right=Number(win.innerWidth)||doc.documentElement?.clientWidth||1280;
  const bottom=Number(win.innerHeight)||doc.documentElement?.clientHeight||800;
  const width=tip.offsetWidth,height=tip.offsetHeight;
  tip.style.left=Math.round(Math.max(8,Math.min(rect.right+8,right-width-8)))+"px";
  tip.style.top=Math.round(Math.max(8+height/2,
    Math.min(rect.top+rect.height/2,bottom-height/2-8)))+"px";
  tip.classList.toggle("is-keyboard",focused===link&&!hovered);
  tip.classList.add("is-visible");
  link.setAttribute("aria-describedby",tip.id);
 };
 const sync=()=>{const link=hovered||focused;if(link)show(link);else hide();};
 for(const link of links){
  link.addEventListener("pointerenter",event=>{
   if(event.pointerType==="touch")return;
   hovered=link;sync();
  },{passive:true});
  link.addEventListener("pointerleave",()=>{
   if(hovered===link){hovered=null;sync();}
  },{passive:true});
  link.addEventListener("focus",()=>{focused=link;sync();});
  link.addEventListener("blur",()=>{
   if(focused===link){focused=null;sync();}
  });
  link.addEventListener("click",()=>{hovered=null;focused=null;hide();});
 }
 sidebar.querySelector(".sidebar-navigation")?.addEventListener("scroll",()=>{
  hovered=null;focused=null;hide();
 },{passive:true});
 win.addEventListener?.("resize",hide,{passive:true});
 win.addEventListener?.("pagehide",hide,{passive:true});
 return {hide,dispose(){
  disposed=true;hide();tip.remove();
 }};
}
