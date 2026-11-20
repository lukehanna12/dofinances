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
 const links=[...sidebar.querySelectorAll(".sidebar-navigation .nav-link, .sidebar-bottom > .nav-link, .sidebar-head .brand")];
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
  link.addEventListener("focus",()=>{hovered=null;focused=link;sync();});
  link.addEventListener("blur",()=>{
   if(focused===link){focused=null;sync();}
  });
  link.addEventListener("click",()=>{hovered=null;focused=null;hide();});
 }
 // Native keyboard focus can scroll a clipped navigation list. Preserve
 // and re-anchor its tooltip instead of hiding it on that very same scroll.
 // Mouse-hover tips do dismiss on scroll; this is event-driven, not polling.
 sidebar.querySelector(".sidebar-navigation")?.addEventListener("scroll",()=>{
  hovered=null;
  if(focused)show(focused);
  else hide();
 },{passive:true});
 win.addEventListener?.("resize",hide,{passive:true});
 win.addEventListener?.("pagehide",hide,{passive:true});
 return {hide,dispose(){
  disposed=true;hide();tip.remove();
 }};
}

// A tooltip's bounding rectangle is TRANSFORMED while its hover scale animates.
// The popover overlay must instead use the settled, untransformed CSS box: this
// matches the tooltip's ordinary position when the pointer leaves. Offset
// geometry is measured before showPopover moves the element to the top layer.
export function untransformedTooltipRect(tip){
  const parent=tip?.offsetParent;
  const fallback=tip.getBoundingClientRect();
  if(!parent||!Number.isFinite(tip.offsetLeft)||!Number.isFinite(tip.offsetTop)||
     !Number.isFinite(tip.offsetWidth)||!Number.isFinite(tip.offsetHeight))
    return fallback;
  const anchor=parent.getBoundingClientRect();
  const left=anchor.left+(parent.clientLeft||0)-(parent.scrollLeft||0)+tip.offsetLeft;
  const top=anchor.top+(parent.clientTop||0)-(parent.scrollTop||0)+tip.offsetTop;
  const width=tip.offsetWidth,height=tip.offsetHeight;
  return {left,top,width,height,right:left+width,bottom:top+height};
}

// Raise content tooltips above the glass rail only where the rectangles overlap.
// Popover's browser top layer preserves the tooltip's DOM parent and accessibility
// label while escaping the animated view's stacking context and overflow clips.
export function initOverlappingContentTooltips(doc=document,win=window,sidebar){
  if(!doc?.addEventListener||!sidebar?.getBoundingClientRect||
     typeof win?.setTimeout!=="function")return null;
  let active=null,delay=null;
  const hide=()=>{
    if(delay!==null){win.clearTimeout(delay);delay=null;}
    const tip=active?.tip;
    if(tip){
      if(tip.matches?.(":popover-open"))tip.hidePopover();
      tip.classList.remove("workspace-tooltip-overlap");
      tip.removeAttribute("popover");
      for(const name of ["--workspace-tooltip-left","--workspace-tooltip-top","--workspace-tooltip-width"])
        tip.style.removeProperty(name);
    }
    active=null;
  };
  const candidate=node=>{
    const trigger=node?.closest?.('#workspace-shell .content :is(button,a,[tabindex="0"])');
    const tip=trigger?.parentElement?.querySelector?.(':scope > [role="tooltip"]');
    return trigger&&tip?{trigger,tip}:null;
  };
  const promote=()=>{
    if(!active)return;
    const {trigger,tip}=active;
    if(!trigger.isConnected||!tip.isConnected||typeof tip.showPopover!=="function")return;
    const box=untransformedTooltipRect(tip),glass=sidebar.getBoundingClientRect();
    if(!box.width||!box.height||box.right<=glass.left||box.left>=glass.right||
       box.bottom<=glass.top||box.top>=glass.bottom)return;
    // Preserve the native CSS anchor, including right-aligned tooltips such as
    // Edit README. Clamping to 8px caused a visible horizontal snap on fade-out.
    tip.style.setProperty("--workspace-tooltip-left",box.left+"px");
    tip.style.setProperty("--workspace-tooltip-top",box.top+"px");
    tip.style.setProperty("--workspace-tooltip-width",box.width+"px");
    tip.classList.add("workspace-tooltip-overlap");
    tip.setAttribute("popover","manual");
    try{tip.showPopover();}catch{hide();}
  };
  const enter=(event,keyboard)=>{
    const next=candidate(event.target);
    if(!next)return;
    if(active?.trigger===next.trigger){
      if(keyboard&&delay!==null){win.clearTimeout(delay);delay=null;promote();}
      return;
    }
    hide();
    active=next;
    if(keyboard)promote();
    else delay=win.setTimeout(()=>{delay=null;promote();},160);
  };
  const exit=event=>{
    if(active?.trigger===event.target&&!active.trigger.contains?.(event.relatedTarget))
      hide();
  };
  doc.addEventListener("pointerover",event=>{
    if(event.pointerType!=="touch")enter(event,false);
  },true);
  doc.addEventListener("pointerout",exit,true);
  doc.addEventListener("focusin",event=>enter(event,true),true);
  doc.addEventListener("focusout",exit,true);
  win.addEventListener?.("scroll",hide,true);
  win.addEventListener?.("resize",hide,{passive:true});
  return {hide};
}
