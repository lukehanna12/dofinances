/*
 * Liquid Glass optical backdrop for the production sidebar.
 * Navigation owns the selected state. Its native link background supplies
 * the selection surface directly, so ink and fill commit in one paint.
 * The old measured indicator lagged behind by an observer, animation frame
 * and an independent 250ms transition.
 */
import {mountOracleBackdrop} from "./sidebar-glass-oracle.js";

export function initLiquidGlassSidebar(doc=document,win=window){
  const shell=doc.getElementById("workspace-shell");
  const sidebar=doc.getElementById("workspace-sidebar");
  const navigation=doc.getElementById("sidebar-navigation");
  if(!shell||!sidebar||!navigation)
    throw Error("The genuine /app workspace sidebar is required");
  if(shell.classList.contains("liquid-glass-preview"))
    throw Error("Oracle glass already mounted");
  shell.classList.add("liquid-glass-preview");

  // Preserve the real browser backdrop and unchanged oracle projection.
  const material=mountOracleBackdrop({doc,win,shell,sidebar});
  let disposed=false;
  function cleanup(){
    if(disposed)return;
    disposed=true;
    material.dispose();
  }
  win.addEventListener("pagehide",cleanup,{once:true});
  return {cleanup,get nativeFilterActive(){return material.active;}};
}
