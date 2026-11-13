/*
 * Collections-only title handoff with one definitive scroll threshold.
 * The large title and backdrop track scroll up to that point. Crossing it
 * starts a complete, self-finishing, time-based CSS transition. Re-entering
 * the pre-threshold region reverses the entire sequence without timers,
 * animation frames, polling, or any dependence on remaining page height.
 */
export const COLLECTIONS_TITLE_TRIGGER_DISTANCE=76;
/* Preserve one synchronized timeline for all three breadcrumb chevrons.
   The CSS movement and flip durations must match these constants. */
export const COLLECTIONS_CRUMB_MOVE_MS=220;
const COLLECTIONS_ARROW_TURN_MS=66;
const COLLECTIONS_OUT_DELAYS=[72,52,26,0];
const COLLECTIONS_IN_DELAYS=[200,210,234,258];
const COLLECTIONS_ARROW_IN_START_MS=204;
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const number=n=>Number.isFinite(Number(n))?Number(n):0;
const smooth=(a,b,x)=>{
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
};

/* Keep the trigger within the document's *actual* scrolling range, even
   when the final Collections page is shorter than a normal viewport. */
export function collectionsTitleFrame(scrollDistance,maxScrollDistance){
  const scroll=Math.max(0,number(scrollDistance));
  const maxScroll=Math.max(0,number(maxScrollDistance));
  const threshold=Math.min(COLLECTIONS_TITLE_TRIGGER_DISTANCE,maxScroll*.5);
  const intro=threshold>0?clamp(scroll/threshold):0;
  const passed=threshold>0 && scroll>=threshold;
  return {
    threshold,passed,intro,
    // UIKit applies no direct label blur; retain only a subtle, authored
    // blur to honor the Collections-specific design requirement.
    largeBlur:1.25*intro,
    largeOpacity:1-smooth(.62,1,intro),
    stripHeight:64*intro,
    // Native masked variableBlur exposes inputRadius=1, not a 24px
    // CSS Gaussian radius. A soft 2px maximum is an approximation,
    // not a claim of identical GPU filter semantics.
    stripBlur:2*intro,
    stripOpacity:smooth(0,.86,intro)
  };
}

/* Invert the actual cubic-bezier(.22,1,.36,1) easing used for breadcrumb
   translation. This couples a chevron's turn to when its title crosses it,
   rather than to an unrelated fixed animation percentage. */
export function breadcrumbCrossingTime(fraction){
  const target=clamp(number(fraction));
  let low=0,high=1;
  for(let i=0;i<24;i++){
    const t=(low+high)*.5;
    const y=3*(1-t)*(1-t)*t + 3*(1-t)*t*t + t*t*t;
    if(y<target)low=t;else high=t;
  }
  const t=(low+high)*.5;
  return 3*(1-t)*(1-t)*t*.22 + 3*(1-t)*t*t*.36 + t*t*t;
}
export function initCollectionsTitleTransition(doc=document,win=window){
  const noop={setRoute(){}};
  // Studio also imports workspace-nav.js but does not load this appearance
  // sheet. Never mount the Collections transition into its static preview.
  if(!doc.querySelector?.('link[href="/app/assets/collections.css"]'))return noop;
  const header=doc.querySelector?.("#workspace-shell .topbar");
  const breadcrumb=doc.getElementById?.("breadcrumb");
  const list=breadcrumb?.querySelector?.(".shadcn-breadcrumb-list");
  const heading=doc.getElementById?.("project-collections-title");
  if(!header?.appendChild || !list?.querySelectorAll || !heading?.style?.setProperty ||
     !doc.body?.classList || !doc.body?.style?.setProperty ||
     !doc.createElement || !win.addEventListener)return noop;

  const title=doc.createElement("span");
  title.className="collections-inline-title";
  title.textContent="Collections";
  title.setAttribute("aria-hidden","true");
  title.hidden=true;
  header.appendChild(title);

  let active=false,passed=false,items=[],separators=[];
  const prop=(element,key,value)=>element.style.setProperty(key,value);
  const remove=(element,keys)=>{for(const key of keys)element.style.removeProperty(key);};
  const getScroll=()=>Math.max(0,number(doc.scrollingElement?.scrollTop ?? win.scrollY));
  const getMaxScroll=()=>{
    const root=doc.scrollingElement||doc.documentElement;
    return root?Math.max(0,number(root.scrollHeight)-number(root.clientHeight)):0;
  };

  function measure(){
    // offsetLeft uses layout positions, unaffected by compositor transforms.
    // Measure only on route entry or resize. No scrolling layout reads.
    items=[...list.querySelectorAll(".shadcn-breadcrumb-item")].filter(el=>!el.hidden);
    separators=[...list.querySelectorAll(".shadcn-breadcrumb-separator")].filter(el=>!el.hidden);
    if(items.length!==4||separators.length!==3)return false;
    for(let i=0;i<4;i++){
      const left=i?items[i].offsetLeft-items[i-1].offsetLeft:0;
      const distance=Math.max(0,number(left));
      prop(items[i],"--collections-crumb-distance",(-distance).toFixed(3)+"px");
      // Rightmost goes first; the leftmost only fades without moving.
      const outDelay=COLLECTIONS_OUT_DELAYS[i];
      // Reverse: the compact title finishes fading at 180ms; the first
      // returning breadcrumb waits just 20ms before entering.
      const inDelay=COLLECTIONS_IN_DELAYS[i];
      prop(items[i],"--collections-out-delay",outDelay+"ms");
      prop(items[i],"--collections-in-delay",inDelay+"ms");
      if(i===0)continue;
      const arrow=separators[i-1];
      const arrowCenter=number(arrow.offsetLeft)+number(arrow.offsetWidth)*.5;
      const fraction=clamp((number(items[i].offsetLeft)-arrowCenter)/Math.max(1,distance),.08,.60);
      // Match flip midpoint with the text crossing the chevron.
      const flip=Math.max(0,Math.round(outDelay+
        COLLECTIONS_CRUMB_MOVE_MS*breadcrumbCrossingTime(fraction)-
        COLLECTIONS_ARROW_TURN_MS/2));
      prop(arrow,"--collections-arrow-out-flip",flip+"ms");
      prop(arrow,"--collections-arrow-out-fade",(flip+COLLECTIONS_ARROW_TURN_MS)+"ms");
      const reverse=COLLECTIONS_ARROW_IN_START_MS+(i-1)*25;
      prop(arrow,"--collections-arrow-in-fade",reverse+"ms");
      prop(arrow,"--collections-arrow-in-flip",(reverse+12)+"ms");
    }
    return true;
  }

  function paint(){
    if(!active||items.length!==4)return;
    const state=collectionsTitleFrame(getScroll(),getMaxScroll());
    prop(heading,"--collections-large-blur",state.largeBlur.toFixed(3)+"px");
    prop(heading,"--collections-large-opacity",state.largeOpacity.toFixed(4));
    // Photo-only effect lives on body::after, behind the scrolling content.
    prop(doc.body,"--collections-strip-height",state.stripHeight.toFixed(3)+"px");
    prop(doc.body,"--collections-strip-blur",state.stripBlur.toFixed(3)+"px");
    prop(doc.body,"--collections-strip-opacity",state.stripOpacity.toFixed(4));
    // This is the sole binary handoff. CSS completes the full animation after
    // a single scroll event, even when there is no further room to scroll.
    if(state.passed!==passed){
      passed=state.passed;
      doc.body.classList.toggle("collections-title-passed",passed);
      breadcrumb.inert=passed;
    }
  }
  const onScroll=()=>{if(active)paint();};
  function reset(){
    active=false;
    passed=false;
    doc.body.classList.remove("collections-title-passed");
    doc.body.classList.remove("collections-title-transition");
    breadcrumb.inert=false;
    title.hidden=true;
    remove(heading,["--collections-large-blur","--collections-large-opacity"]);
    remove(doc.body,["--collections-strip-height","--collections-strip-blur","--collections-strip-opacity"]);
    for(const el of items)remove(el,["--collections-crumb-distance","--collections-out-delay","--collections-in-delay"]);
    for(const el of separators)remove(el,["--collections-arrow-out-flip",
      "--collections-arrow-out-fade","--collections-arrow-in-flip","--collections-arrow-in-fade"]);
  }
  function setRoute(route){
    if(route!=="colosseum/collections"){if(active)reset();return;}
    if(!measure()){reset();return;}
    active=true;
    title.hidden=false;
    doc.body.classList.add("collections-title-transition");
    paint();
  }
  win.addEventListener("scroll",onScroll,{passive:true});
  win.addEventListener("resize",()=>{if(active && measure())paint();},{passive:true});
  return {setRoute};
}
