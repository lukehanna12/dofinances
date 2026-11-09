/*
 * Production adaptation of the retained Oracle state; source math is unchanged.
 * Original workspace-nav.js exclusively owns routing, breakpoints,
 * collapse preference, focus and mobile drawer. This module adds an
 * actual DOM BACKDROP SVG-filter driven by evidenced AIR expressions.
 * It never renders the scene inside or as a texture for the sidebar.
 */
import {mountOracleBackdrop} from "./sidebar-glass-oracle.js";

export function glassIndicatorGeometry(sidebarNavigation,activeLink){
  const nav=sidebarNavigation.getBoundingClientRect();
  const link=activeLink.getBoundingClientRect();
  if(!(nav.width>0&&link.width>0&&link.height>0))return null;
  return {
    x:link.left-nav.left+sidebarNavigation.scrollLeft,
    y:link.top-nav.top+sidebarNavigation.scrollTop,
    width:link.width,height:link.height
  };
}

export function initLiquidGlassSidebar(doc=document,win=window){
  const shell=doc.getElementById("workspace-shell");
  const sidebar=doc.getElementById("workspace-sidebar");
  const navigation=doc.getElementById("sidebar-navigation");
  if(!shell||!sidebar||!navigation)
    throw Error("The genuine /app workspace sidebar is required");
  if(shell.classList.contains("liquid-glass-preview"))
    throw Error("Oracle glass already mounted");
  shell.classList.add("liquid-glass-preview");

  // Actual page backdrop is the SourceGraphic. Only SDF-derived vector maps
  // live in Canvas2D; no background pixels are copied or painted in this pane.
  const material=mountOracleBackdrop({doc,win,shell,sidebar});

  const indicator=doc.createElement("div");
  indicator.className="glass-selection";
  indicator.setAttribute("aria-hidden","true");
  navigation.prepend(indicator);
  let frame=0,first=true,disposed=false;
  function updateIndicator(){
    frame=0;
    if(disposed)return;
    const active=sidebar.querySelector('.nav-stack:not([hidden]) .nav-link.active');
    const bounds=active&&glassIndicatorGeometry(navigation,active);
    if(!bounds){
      shell.classList.remove("has-glass-indicator");
      return;
    }
    if(first){
      first=false;
      indicator.style.transition="none";
    }else indicator.style.removeProperty("transition");
    // The CSS track now owns horizontal morphing. Avoid duplicate JS
    // animations, forced layout on every width frame and unchanged writes.
    for(const [name,value] of [
      ["--glass-selection-x",bounds.x+"px"],
      ["--glass-selection-y",bounds.y+"px"],
      ["--glass-selection-height",bounds.height+"px"]
    ])if(indicator.style.getPropertyValue(name)!==value)
      indicator.style.setProperty(name,value);
    shell.classList.add("has-glass-indicator");
    if(indicator.style.transition==="none")
      win.requestAnimationFrame(()=>indicator.style.removeProperty("transition"));
  }
  function scheduleIndicator(){
    if(!frame&&!disposed)frame=win.requestAnimationFrame(updateIndicator);
  }
  const mutations=new MutationObserver(scheduleIndicator);
  mutations.observe(sidebar,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});
  // Geometry of the highlight scales with the CSS row. Route changes,
  // navigation scroll and viewport changes still schedule its Y position.
  navigation.addEventListener("scroll",scheduleIndicator,{passive:true});
  win.addEventListener("resize",scheduleIndicator,{passive:true});
  win.addEventListener("hashchange",scheduleIndicator);
  scheduleIndicator();

  function cleanup(){
    if(disposed)return;
    disposed=true;
    mutations.disconnect();
    navigation.removeEventListener("scroll",scheduleIndicator);
    win.removeEventListener("resize",scheduleIndicator);
    win.removeEventListener("hashchange",scheduleIndicator);
    if(frame)win.cancelAnimationFrame(frame);
    material.dispose();
    indicator.remove();
  }
  win.addEventListener("pagehide",cleanup,{once:true});
  return {updateIndicator,cleanup,get nativeFilterActive(){return material.active;}};
}
