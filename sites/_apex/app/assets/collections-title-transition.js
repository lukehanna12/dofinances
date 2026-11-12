/*
 * Collections-only title handoff with one definitive scroll threshold.
 * The large title and backdrop track scroll up to that point. Crossing it
 * starts a complete, self-finishing, time-based CSS transition. Re-entering
 * the pre-threshold region reverses the entire sequence without timers,
 * animation frames, polling, or any dependence on remaining page height.
 */
export const COLLECTIONS_TITLE_TRIGGER_DISTANCE=76;
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
    largeBlur:11*intro,
    largeOpacity:1-smooth(.62,1,intro),
    stripHeight:64*intro,
    stripBlur:4+20*intro,
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
     !doc.body?.classList || !doc.createElement || !win.addEventListener)return noop;

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
      const outDelay=[92,66,33,0][i];
      const inDelay=[120,130,164,198][i];
      prop(items[i],"--collections-out-delay",outDelay+"ms");
      prop(items[i],"--collections-in-delay",inDelay+"ms");
      if(i===0)continue;
      const arrow=separators[i-1];
      const arrowCenter=number(arrow.offsetLeft)+number(arrow.offsetWidth)*.5;
      const fraction=clamp((number(items[i].offsetLeft)-arrowCenter)/Math.max(1,distance),.08,.60);
      // Match flip midpoint with the text crossing the chevron.
      const flip=Math.max(0,Math.round(outDelay+280*breadcrumbCrossingTime(fraction)-41));
      prop(arrow,"--collections-arrow-out-flip",flip+"ms");
      prop(arrow,"--collections-arrow-out-fade",(flip+84)+"ms");
      const reverse=120+(i-1)*31;
      prop(arrow,"--collections-arrow-in-fade",reverse+"ms");
      prop(arrow,"--collections-arrow-in-flip",(reverse+15)+"ms");
    }
    return true;
  }

  function paint(){
    if(!active||items.length!==4)return;
    const state=collectionsTitleFrame(getScroll(),getMaxScroll());
    prop(heading,"--collections-large-blur",state.largeBlur.toFixed(3)+"px");
    prop(heading,"--collections-large-opacity",state.largeOpacity.toFixed(4));
    prop(header,"--collections-strip-height",state.stripHeight.toFixed(3)+"px");
    prop(header,"--collections-strip-blur",state.stripBlur.toFixed(3)+"px");
    prop(header,"--collections-strip-opacity",state.stripOpacity.toFixed(4));
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
    remove(header,["--collections-strip-height","--collections-strip-blur","--collections-strip-opacity"]);
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
