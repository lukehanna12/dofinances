/*
 * Utilities-only title handoff, anchored to the actual rendered geometry.
 * When the midpoint of the large title crosses the bottom of the sticky
 * lower top bar, all three transitions start from that exact crossing:
 * large heading opacity, breadcrumb departure/reentry, compact-title handoff.
 * The animations self-finish in CSS even when scrolling stops. No polling,
 * animation frames, or fixed scroll-distance guesses.
 */
/* Preserve one synchronized timeline for all three breadcrumb chevrons.
   The CSS movement and flip durations must match these constants. */
export const UTILITIES_CRUMB_MOVE_MS=220;
const UTILITIES_ARROW_TURN_MS=66;
const UTILITIES_OUT_DELAYS=[72,52,26,0];
const UTILITIES_IN_DELAYS=[200,210,234,258];
const UTILITIES_ARROW_IN_START_MS=204;
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const number=n=>Number.isFinite(Number(n))?Number(n):0;
const smooth=(a,b,x)=>{
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
};

/* The heading's visual half-height crossing uses its actual client rect,
   including responsive font metrics and relative top placement. The sticky
   bar's bottom edge is also measured, rather than assumed to be 94px.
   Title, bar and scroll are read in the same scroll event, so the forward
   and reverse transitions share a single mathematical crossing. */
export function utilitiesTitleFrame(scrollDistance,headingRect,barRect){
  const scroll=Math.max(0,number(scrollDistance));
  const valid=Number.isFinite(headingRect?.top)&&
    Number.isFinite(headingRect?.height)&&headingRect.height>0&&
    Number.isFinite(barRect?.bottom);
  const distance=valid?headingRect.top+headingRect.height/2-barRect.bottom:Infinity;
  // At a stationary sticky bar: current scroll + center-to-edge distance
  // equals the document scroll position of the exact 50% crossing.
  const threshold=valid?scroll+distance:null;
  const passed=valid&&distance<=0;
  const intro=valid
    ?threshold>0?clamp(scroll/threshold):(passed?1:0)
    :0;
  return {
    threshold,passed,intro,
    // UIKit applies no direct label blur; retain only a subtle, authored
    // blur to honor the Utilities-specific design requirement.
    largeBlur:1.25*intro,
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
export function initUtilitiesTitleTransition(doc=document,win=window){
  const noop={setRoute(){}};
  // Studio also imports workspace-nav.js but does not load this appearance
  // sheet. Never mount the Utilities transition into its static preview.
  if(!doc.querySelector?.('link[href="/app/assets/utilities.css"]'))return noop;
  const header=doc.querySelector?.("#workspace-shell .topbar");
  const breadcrumb=doc.getElementById?.("breadcrumb");
  const list=breadcrumb?.querySelector?.(".shadcn-breadcrumb-list");
  const heading=doc.getElementById?.("project-utilities-title");
  if(!header?.appendChild || !header?.getBoundingClientRect ||
     !list?.querySelectorAll || !heading?.style?.setProperty ||
     !heading?.getBoundingClientRect || !doc.body?.classList ||
     !doc.body?.style?.setProperty || !doc.createElement ||
     !win.addEventListener)return noop;

  const title=doc.createElement("span");
  title.className="utilities-inline-title";
  title.textContent="Utilities";
  title.setAttribute("aria-hidden","true");
  title.hidden=true;
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
    if(items.length!==4||separators.length!==3)return false;
    for(let i=0;i<4;i++){
      const left=i?items[i].offsetLeft-items[i-1].offsetLeft:0;
      const distance=Math.max(0,number(left));
      prop(items[i],"--utilities-crumb-distance",(-distance).toFixed(3)+"px");
      // Rightmost goes first; the leftmost only fades without moving.
      const outDelay=UTILITIES_OUT_DELAYS[i];
      // Reverse: the compact title finishes fading at 180ms; the first
      // returning breadcrumb waits just 20ms before entering.
      const inDelay=UTILITIES_IN_DELAYS[i];
      prop(items[i],"--utilities-out-delay",outDelay+"ms");
      prop(items[i],"--utilities-in-delay",inDelay+"ms");
      if(i===0)continue;
      const arrow=separators[i-1];
      const arrowCenter=number(arrow.offsetLeft)+number(arrow.offsetWidth)*.5;
      const fraction=clamp((number(items[i].offsetLeft)-arrowCenter)/Math.max(1,distance),.08,.60);
      // Match flip midpoint with the text crossing the chevron.
      const flip=Math.max(0,Math.round(outDelay+
        UTILITIES_CRUMB_MOVE_MS*breadcrumbCrossingTime(fraction)-
        UTILITIES_ARROW_TURN_MS/2));
      prop(arrow,"--utilities-arrow-out-flip",flip+"ms");
      prop(arrow,"--utilities-arrow-out-fade",(flip+UTILITIES_ARROW_TURN_MS)+"ms");
      const reverse=UTILITIES_ARROW_IN_START_MS+(i-1)*25;
      prop(arrow,"--utilities-arrow-in-fade",reverse+"ms");
      prop(arrow,"--utilities-arrow-in-flip",(reverse+12)+"ms");
    }
    return true;
  }

  function paint(){
    if(!active||items.length!==4)return;
    const state=utilitiesTitleFrame(getScroll(),
      heading.getBoundingClientRect(),header.getBoundingClientRect());
    prop(heading,"--utilities-large-blur",state.largeBlur.toFixed(3)+"px");
    // Photo-only effect lives on body::after, behind the scrolling content.
    prop(doc.body,"--utilities-strip-height",state.stripHeight.toFixed(3)+"px");
    prop(doc.body,"--utilities-strip-blur",state.stripBlur.toFixed(3)+"px");
    prop(doc.body,"--utilities-strip-opacity",state.stripOpacity.toFixed(4));
    // This is the sole binary handoff. CSS completes the full animation after
    // a single scroll event, even when there is no further room to scroll.
    if(state.passed!==passed){
      passed=state.passed;
      doc.body.classList.toggle("utilities-title-passed",passed);
      breadcrumb.inert=passed;
    }
  }
  const onScroll=()=>{if(active)paint();};
  function reset(){
    active=false;
    passed=false;
    doc.body.classList.remove("utilities-title-passed");
    doc.body.classList.remove("utilities-title-transition");
    breadcrumb.inert=false;
    title.hidden=true;
    remove(heading,["--utilities-large-blur"]);
    remove(doc.body,["--utilities-strip-height","--utilities-strip-blur","--utilities-strip-opacity"]);
    for(const el of items)remove(el,["--utilities-crumb-distance","--utilities-out-delay","--utilities-in-delay"]);
    for(const el of separators)remove(el,["--utilities-arrow-out-flip",
      "--utilities-arrow-out-fade","--utilities-arrow-in-flip","--utilities-arrow-in-fade"]);
  }
  function setRoute(route){
    if(route!=="colosseum/utilities"){if(active)reset();return;}
    if(!measure()){reset();return;}
    active=true;
    title.hidden=false;
    doc.body.classList.add("utilities-title-transition");
    paint();
  }
  win.addEventListener("scroll",onScroll,{passive:true});
  win.addEventListener("resize",()=>{if(active && measure())paint();},{passive:true});
  return {setRoute};
}
