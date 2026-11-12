/*
 * Collections-only native-inspired title/breadcrumb handoff.
 * One passive document-scroll listener, no RAF, polling, layout changes or timers.
 * Values derive exclusively from absolute scroll position: reversing the scroll
 * reverses every blur, title, chevron, and breadcrumb movement precisely.
 */
const INTRO_DISTANCE=76;
const HANDOFF_DISTANCE=64;
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const smooth=(a,b,x)=>{
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
};
const ease=t=>smooth(0,1,t);
const number=n=>Number.isFinite(n)?n:0;

/**
 * Pure scroll model, independently unit-testable without a DOM or image inspection.
 * partnerDistances[i]: the fixed horizontal distance from title i to title i-1.
 * arrowCrossings[i-1]: fractional travel where title i passes its left chevron.
 */
export function collectionsTitleFrame(scrollDistance,partnerDistances=[0,100,100,100],arrowCrossings=[.19,.19,.19]){
  const y=Math.max(0,number(Number(scrollDistance)));
  const intro=clamp(y/INTRO_DISTANCE);
  const handoff=clamp((y-INTRO_DISTANCE)/HANDOFF_DISTANCE);
  // Start at the rightmost title, then work back toward the stationary root.
  const starts=[0,.30,.16,0];
  const travel=[0,1,2,3].map(i=>i===0?0:ease(clamp((handoff-starts[i])/.70)));
  const crumbs=[
    {x:0,opacity:1-smooth(.22,.83,handoff)},
    {x:travel[1]===0?0:-number(partnerDistances[1])*travel[1],opacity:1-smooth(.10,.98,travel[1])},
    {x:travel[2]===0?0:-number(partnerDistances[2])*travel[2],opacity:1-smooth(.06,.75,travel[2])},
    {x:travel[3]===0?0:-number(partnerDistances[3])*travel[3],opacity:1-smooth(.06,.75,travel[3])}
  ];
  const arrows=[1,2,3].map(i=>{
    const crossed=clamp(number(arrowCrossings[i-1]),.12,.46);
    const displacement=travel[i];
    return {
      turn:180*smooth(crossed-.065,crossed+.085,displacement),
      opacity:1-smooth(crossed+.095,Math.min(.91,crossed+.47),displacement)
    };
  });
  return {
    intro,handoff,crumbs,arrows,
    largeBlur:11*intro,
    largeOpacity:1-smooth(.62,1,intro),
    stripHeight:64*intro,
    stripBlur:4+20*intro,
    stripOpacity:smooth(0,.86,intro),
    inlineOpacity:smooth(.64,.98,handoff)
  };
}

export function initCollectionsTitleTransition(doc=document,win=window){
  const noop={setRoute(){}};
  const header=doc.querySelector?.("#workspace-shell .topbar");
  const breadcrumb=doc.getElementById?.("breadcrumb");
  const list=breadcrumb?.querySelector?.(".shadcn-breadcrumb-list");
  const heading=doc.getElementById?.("project-collections-title");
  if(!header?.appendChild || !list?.querySelectorAll || !heading?.style?.setProperty ||
     !doc.body?.classList || !doc.createElement || !win.addEventListener)return noop;
  const title=doc.createElement("span");
  title.className="collections-inline-title";
  title.textContent="Collections";
  title.setAttribute("aria-hidden","true"); // Existing h1 supplies the accessible page title.
  title.hidden=true;
  header.appendChild(title);

  let active=false;
  let items=[],separators=[],distances=[0,0,0,0],crossings=[.19,.19,.19];
  const prop=(el,key,value)=>el.style.setProperty(key,value);
  const clearVars=(el,keys)=>{for(const key of keys)el.style.removeProperty(key);};
  const measure=()=>{
    // offsetLeft is layout geometry, unaffected by our compositor transforms.
    // Read only on route entry or resize, never during a scrolling frame.
    items=[...list.querySelectorAll(".shadcn-breadcrumb-item")].filter(el=>!el.hidden);
    separators=[...list.querySelectorAll(".shadcn-breadcrumb-separator")].filter(el=>!el.hidden);
    if(items.length!==4 || separators.length!==3)return false;
    distances=[0,1,2,3].map(i=>i===0?0:Math.max(0,items[i].offsetLeft-items[i-1].offsetLeft));
    crossings=[1,2,3].map(i=>{
      const width=Math.max(1,distances[i]);
      const arrowCenter=separators[i-1].offsetLeft+separators[i-1].offsetWidth/2;
      return clamp((items[i].offsetLeft-arrowCenter)/width,.12,.46);
    });
    return true;
  };
  const scrollPosition=()=>Math.max(0,number(Number(doc.scrollingElement?.scrollTop ?? win.scrollY ?? 0)));
  const paint=()=>{
    if(!active || items.length!==4)return;
    const state=collectionsTitleFrame(scrollPosition(),distances,crossings);
    prop(heading,"--collections-large-blur",state.largeBlur.toFixed(3)+"px");
    prop(heading,"--collections-large-opacity",state.largeOpacity.toFixed(4));
    prop(header,"--collections-strip-height",state.stripHeight.toFixed(3)+"px");
    prop(header,"--collections-strip-blur",state.stripBlur.toFixed(3)+"px");
    prop(header,"--collections-strip-opacity",state.stripOpacity.toFixed(4));
    prop(header,"--collections-inline-opacity",state.inlineOpacity.toFixed(4));
    for(let i=0;i<4;i++){
      prop(items[i],"--collections-crumb-shift",state.crumbs[i].x.toFixed(3)+"px");
      prop(items[i],"--collections-crumb-opacity",state.crumbs[i].opacity.toFixed(4));
    }
    for(let i=0;i<3;i++){
      prop(separators[i],"--collections-arrow-angle",state.arrows[i].turn.toFixed(3)+"deg");
      prop(separators[i],"--collections-arrow-opacity",state.arrows[i].opacity.toFixed(4));
    }
    // The invisible breadcrumb must not retain keyboard focus targets.
    // The large h1 remains in the accessibility tree; compact label is decorative.
    breadcrumb.inert=state.handoff>=.995;
  };
  const onScroll=()=>{if(active)paint();};
  const reset=()=>{
    active=false;
    doc.body.classList.remove("collections-title-transition");
    title.hidden=true;
    breadcrumb.inert=false;
    clearVars(heading,["--collections-large-blur","--collections-large-opacity"]);
    clearVars(header,["--collections-strip-height","--collections-strip-blur",
      "--collections-strip-opacity","--collections-inline-opacity"]);
    for(const el of items)clearVars(el,["--collections-crumb-shift","--collections-crumb-opacity"]);
    for(const el of separators)clearVars(el,["--collections-arrow-angle","--collections-arrow-opacity"]);
  };
  const setRoute=route=>{
    if(route!=="colosseum/collections"){if(active)reset();return;}
    active=true;
    title.hidden=false;
    doc.body.classList.add("collections-title-transition");
    if(measure())paint();
    else reset(); // Incomplete breadcrumb markup must not hide navigation.
  };
  win.addEventListener("scroll",onScroll,{passive:true});
  win.addEventListener("resize",()=>{if(active && measure())paint();},{passive:true});
  return {setRoute};
}
