/*
 * Studio adaptation of the retained Oracle state; source-derived optical math remains shared with production.
 * Original workspace-nav.js exclusively owns routing, breakpoints,
 * collapse preference, focus and mobile drawer. This module adds an
 * actual DOM BACKDROP SVG-filter driven by evidenced AIR expressions.
 * It never renders the scene inside or as a texture for the sidebar.
 */
import {mountOracleBackdrop} from "./sidebar-glass-oracle.js";

export function initLiquidGlassSidebar(doc=document,win=window){
  const shell=doc.getElementById("workspace-shell");
  const sidebar=doc.getElementById("workspace-sidebar");
  const navigation=doc.getElementById("sidebar-navigation");
  const topActions=doc.querySelector(".top-actions");
  if(!shell||!sidebar||!navigation||!topActions)
    throw Error("The genuine /app workspace sidebar is required");
  if(shell.classList.contains("liquid-glass-preview"))
    throw Error("Oracle glass already mounted");
  shell.classList.add("liquid-glass-preview");

  // Actual page backdrop is the SourceGraphic. Only SDF-derived vector maps
  // live in Canvas2D; no background pixels are copied or painted in this pane.
  const material=mountOracleBackdrop({doc,win,shell,sidebar});

  let disposed=false;

  // Compare the same ACTUAL backdrop filter against separate full-viewport
  // page designs. Only the page's stylesheet defines these backgrounds.
  const scenes=[
    {name:"Gallery",className:""},
    {name:"Monochrome",className:"glass-scene-neutral"},
    {name:"Spectrum",className:"glass-scene-prism"}
  ];
  let scene=0;
  const toggle=doc.createElement("button");
  toggle.type="button";
  toggle.className="glass-scene-toggle";

  const dot=doc.createElement("span");
  dot.className="glass-scene-dot";
  dot.setAttribute("aria-hidden","true");
  const label=doc.createElement("span");
  toggle.append(dot,label);
  function sceneUpdate(){
    for(const c of scenes)if(c.className)shell.classList.remove(c.className);
    if(scenes[scene].className)shell.classList.add(scenes[scene].className);
    toggle.setAttribute("aria-label","Change glass backdrop: "+scenes[scene].name);
    label.textContent="Backdrop: "+scenes[scene].name;
  }
  toggle.addEventListener("click",()=>{scene=(scene+1)%scenes.length;sceneUpdate();});
  topActions.prepend(toggle);
  sceneUpdate();

  function cleanup(){
    if(disposed)return;
    disposed=true;
    material.dispose();
    toggle.remove();
  }
  win.addEventListener("pagehide",cleanup,{once:true});
  return {cleanup,get nativeFilterActive(){return material.active;}};
}
