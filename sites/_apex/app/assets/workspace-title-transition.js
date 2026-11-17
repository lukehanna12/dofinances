/* Shared non-dashboard heading midpoint handoff. Uses the same measured
 * geometry, arrow timing and CSS transitions as Collections. One controller,
 * one scroll listener; no timers, polling, RAF or route-specific duplicates. */
import {collectionsTitleFrame,breadcrumbCrossingTime,COLLECTIONS_CRUMB_MOVE_MS}
 from "./collections-title-transition.js";
const COLLECTIONS_ARROW_TURN_MS=66;
const COLLECTIONS_OUT_DELAYS=[72,52,26,0];
const COLLECTIONS_IN_DELAYS=[200,210,234,258];
const COLLECTIONS_ARROW_IN_START_MS=204;
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const number=n=>Number.isFinite(Number(n))?Number(n):0;
export function initWorkspaceTitleTransition(doc=document,win=window,animateToTop=()=>{}){
  const noop={setRoute(){}};
  // Studio also imports workspace-nav.js but does not load this appearance
  // sheet. Never mount the Collections transition into its static preview.
  if(!doc.querySelector?.('link[href="/app/assets/workspace-title.css"]'))return noop;
  const header=doc.querySelector?.("#workspace-shell .topbar");
  const breadcrumb=doc.getElementById?.("breadcrumb");
  const list=breadcrumb?.querySelector?.(".shadcn-breadcrumb-list");
  let heading=null;
  if(!header?.appendChild || !header?.getBoundingClientRect ||
     !list?.querySelectorAll ||
     !doc.body?.classList ||
     !doc.body?.style?.setProperty || !doc.createElement ||
     !win.addEventListener)return noop;

  const title=doc.createElement("button");
  title.className="workspace-inline-title";
  title.type="button";
  title.textContent="";
  title.tabIndex=-1;
  title.setAttribute("aria-hidden","true");
  title.hidden=true;
  title.addEventListener?.("click",()=>{if(active&&passed)animateToTop();});
  header.appendChild(title);

  let active=false,passed=false,items=[],separators=[];
  const prop=(element,key,value)=>element.style.setProperty(key,value);
  const remove=(element,keys)=>{for(const key of keys)element.style.removeProperty(key);};
  const getScroll=()=>Math.max(0,number(doc.scrollingElement?.scrollTop ?? win.scrollY));
  function measure(){
    // offsetLeft uses layout positions, unaffected by compositor transforms.
    // Measure breadcrumb geometry only on route entry or resize.
    // Heading/bar rects are read per actual scroll event to track the
    // visible 50% crossing, including responsive layout and sticky offsets.
    items=[...list.querySelectorAll(".shadcn-breadcrumb-item")].filter(el=>!el.hidden);
    separators=[...list.querySelectorAll(".shadcn-breadcrumb-separator")].filter(el=>!el.hidden);
    if(items.length<2||items.length>4||separators.length!==items.length-1)return false;
    for(let i=0;i<items.length;i++){
      const left=i?items[i].offsetLeft-items[i-1].offsetLeft:0;
      const distance=Math.max(0,number(left));
      prop(items[i],"--workspace-crumb-distance",(-distance).toFixed(3)+"px");
      // Rightmost goes first; the leftmost only fades without moving.
      const outDelay=COLLECTIONS_OUT_DELAYS[i+4-items.length];
      // Reverse: the compact title finishes fading at 180ms; the first
      // returning breadcrumb waits just 20ms before entering.
      const inDelay=COLLECTIONS_IN_DELAYS[i+4-items.length];
      prop(items[i],"--workspace-out-delay",outDelay+"ms");
      prop(items[i],"--workspace-in-delay",inDelay+"ms");
      if(i===0)continue;
      const arrow=separators[i-1];
      const arrowCenter=number(arrow.offsetLeft)+number(arrow.offsetWidth)*.5;
      const fraction=clamp((number(items[i].offsetLeft)-arrowCenter)/Math.max(1,distance),.08,.60);
      // Match flip midpoint with the text crossing the chevron.
      const flip=Math.max(0,Math.round(outDelay+
        COLLECTIONS_CRUMB_MOVE_MS*breadcrumbCrossingTime(fraction)-
        COLLECTIONS_ARROW_TURN_MS/2));
      prop(arrow,"--workspace-arrow-out-flip",flip+"ms");
      prop(arrow,"--workspace-arrow-out-fade",(flip+COLLECTIONS_ARROW_TURN_MS)+"ms");
      const reverse=COLLECTIONS_ARROW_IN_START_MS+(i-1)*25;
      prop(arrow,"--workspace-arrow-in-fade",reverse+"ms");
      prop(arrow,"--workspace-arrow-in-flip",(reverse+12)+"ms");
    }
    return true;
  }

  function paint(){
    if(!active||items.length<2||!heading)return;
    const state=collectionsTitleFrame(getScroll(),
      heading.getBoundingClientRect(),header.getBoundingClientRect());
    prop(heading,"--workspace-large-blur",state.largeBlur.toFixed(3)+"px");
    // Photo-only effect lives on body::after, behind the scrolling content.
    prop(doc.body,"--workspace-strip-height",state.stripHeight.toFixed(3)+"px");
    prop(doc.body,"--workspace-strip-blur",state.stripBlur.toFixed(3)+"px");
    prop(doc.body,"--workspace-strip-opacity",state.stripOpacity.toFixed(4));
    // This is the sole binary handoff. CSS completes the full animation after
    // a single scroll event, even when there is no further room to scroll.
    if(state.passed!==passed){
      passed=state.passed;
      doc.body.classList.toggle("workspace-title-passed",passed);
      breadcrumb.inert=passed;
      title.tabIndex=passed?0:-1;
      title.setAttribute("aria-hidden",String(!passed));
      if(!passed)title.blur?.();
    }
  }
  const onScroll=()=>{if(active)paint();};
  function reset(){
    active=false;
    passed=false;
    doc.body.classList.remove("workspace-title-passed");
    doc.body.classList.remove("workspace-title-transition");
    breadcrumb.inert=false;
    title.hidden=true;
    title.tabIndex=-1;
    title.setAttribute("aria-hidden","true");
    if(heading){remove(heading,["--workspace-large-blur"]);heading.classList.remove("workspace-scroll-heading");heading=null;}
    remove(doc.body,["--workspace-strip-height","--workspace-strip-blur","--workspace-strip-opacity"]);
    for(const el of items)remove(el,["--workspace-crumb-distance","--workspace-out-delay","--workspace-in-delay"]);
    for(const el of separators)remove(el,["--workspace-arrow-out-flip",
      "--workspace-arrow-out-fade","--workspace-arrow-in-flip","--workspace-arrow-in-fade"]);
  }
  function setRoute(route){
    // Single owner for every route: never let competing controllers
    // reset breadcrumb.inert or leave stale title geometry behind.
    reset();
    if(route==="home")return; // The dashboard is the sole exception.
    const view=[...doc.querySelectorAll(".content > .view[data-view]")].find(node=>!node.hidden);
    heading=view?.querySelector("h1")??null;
    if(!heading?.getBoundingClientRect||!heading.style?.setProperty||!measure()){
      heading=null;return;
    }
    heading.classList.add("workspace-scroll-heading");
    title.textContent=heading.textContent.trim()||route.split("/").at(-1);
    title.setAttribute("aria-label","Scroll to top of "+title.textContent);
    active=true;
    title.hidden=false;
    doc.body.classList.add("workspace-title-transition");
    paint();
  }
  win.addEventListener("scroll",onScroll,{passive:true});
  win.addEventListener("resize",()=>{if(active && measure())paint();},{passive:true});
  return {setRoute};
}
