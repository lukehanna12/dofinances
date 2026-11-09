/*
 * Liquid Plexiglass browser experiment. This is an optical approximation,
 * not a reverse-engineered Apple Q/S/R/C implementation.
 *
 * Keep the real workspace-nav.js as the sole owner of breakpoints, routing,
 * sidebar preference and drawer behavior. This module only adds presentation.
 * No network calls, credentials, persistent accounts, or document captures.
 */

import {BACKDROP_SCENES,createSceneBackedGlass} from "./sidebar-glass-refraction.js";

export function glassIndicatorGeometry(sidebarNavigation, activeLink) {
  const nav = sidebarNavigation.getBoundingClientRect();
  const link = activeLink.getBoundingClientRect();
  if (!(nav.width > 0 && link.width > 0 && link.height > 0)) return null;
  return {
    x: link.left - nav.left + sidebarNavigation.scrollLeft,
    y: link.top - nav.top + sidebarNavigation.scrollTop,
    width: link.width,
    height: link.height
  };
}

export function initLiquidGlassSidebar(doc=document, win=window) {
  const shell = doc.getElementById("workspace-shell");
  const sidebar = doc.getElementById("workspace-sidebar");
  const navigation = doc.getElementById("sidebar-navigation");
  const topActions = doc.querySelector(".top-actions");
  if (!shell || !sidebar || !navigation || !topActions)
    throw new Error("Real workspace sidebar markup required");
  if (shell.classList.contains("liquid-glass-preview"))
    throw new Error("Glass sidebar already initialized");

  shell.classList.add("liquid-glass-preview");
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = doc.createElement("canvas");
  canvas.className = "glass-optics";
  canvas.setAttribute("aria-hidden","true");
  canvas.setAttribute("role","presentation");
  sidebar.prepend(canvas);
  const optics = createSceneBackedGlass({
    doc,win,shell,sidebar,glassCanvas:canvas,reducedMotion
  });

  const indicator = doc.createElement("div");
  indicator.className = "glass-selection";
  indicator.setAttribute("aria-hidden","true");
  navigation.prepend(indicator);
  let updateFrame = 0;
  let firstLayout = true;
  function updateIndicator() {
    updateFrame=0;
    const active = sidebar.querySelector(
      '.nav-stack:not([hidden]) .nav-link.active');
    const bounds = active && glassIndicatorGeometry(navigation,active);
    if (!bounds) {
      shell.classList.remove("has-glass-indicator");
      return;
    }
    if (firstLayout) {
      indicator.style.transition = "none";
      firstLayout=false;
    } else indicator.style.removeProperty("transition");
    indicator.style.setProperty("--glass-selection-x",bounds.x+"px");
    indicator.style.setProperty("--glass-selection-y",bounds.y+"px");
    indicator.style.setProperty("--glass-selection-width",bounds.width+"px");
    indicator.style.setProperty("--glass-selection-height",bounds.height+"px");
    shell.classList.add("has-glass-indicator");
    if (indicator.style.transition === "none") {
      // Prevent first paint from sliding the capsule from the nav's origin.
      win.requestAnimationFrame(()=>indicator.style.removeProperty("transition"));
    }
  }
  function scheduleIndicator() {
    if (!updateFrame) updateFrame=win.requestAnimationFrame(updateIndicator);
  }
  const mutation = new MutationObserver(scheduleIndicator);
  mutation.observe(sidebar,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});
  const resizeObserver = typeof ResizeObserver !== "undefined" ?
    new ResizeObserver(scheduleIndicator) : null;
  resizeObserver?.observe(sidebar);
  resizeObserver?.observe(navigation);
  navigation.addEventListener("scroll",scheduleIndicator,{passive:true});
  win.addEventListener("resize",scheduleIndicator,{passive:true});
  win.addEventListener("hashchange",scheduleIndicator);
  scheduleIndicator();

  // A preview-only optical calibration scene selector. It changes neither
  // the nav state nor any real account data.
  const scenes = BACKDROP_SCENES.map((name,index)=>({
    name,
    className:index===1?"glass-scene-neutral":index===2?"glass-scene-prism":""
  }));
  let scene=0;
  const toggle=doc.createElement("button");
  toggle.type="button";
  toggle.className="glass-scene-toggle";
  toggle.setAttribute("aria-label","Change glass backdrop: Gallery");
  toggle.title="Compare the same neutral glass against different full-screen backgrounds";
  const dot=doc.createElement("span");
  dot.className="glass-scene-dot";
  dot.setAttribute("aria-hidden","true");
  const label=doc.createElement("span");
  toggle.append(dot,label);
  function updateScene() {
    for(const x of scenes) if(x.className) shell.classList.remove(x.className);
    if(scenes[scene].className) shell.classList.add(scenes[scene].className);
    label.textContent="Backdrop: "+scenes[scene].name;
    toggle.setAttribute("aria-label","Change glass backdrop: "+scenes[scene].name);
    optics.setScene(scene);
  }
  toggle.addEventListener("click",()=>{scene=(scene+1)%scenes.length;updateScene();});
  topActions.prepend(toggle);
  updateScene();

  // A real A/B switch: same wallpaper and same glass tint, with the geometric
  // refraction field disabled or enabled. It never alters navigation state.
  if(optics.active) {
    let lensOn=true;
    const lensToggle=doc.createElement("button");
    lensToggle.type="button";
    lensToggle.className="glass-scene-toggle glass-lens-toggle";
    lensToggle.setAttribute("aria-pressed","true");
    lensToggle.setAttribute("aria-label","Disable edge lensing");
    lensToggle.title="Compare lensing against plain blurred material";
    const lensDot=doc.createElement("span");
    lensDot.className="glass-scene-dot";
    lensDot.setAttribute("aria-hidden","true");
    const lensText=doc.createElement("span");
    lensText.textContent="Lensing on";
    lensToggle.append(lensDot,lensText);
    lensToggle.addEventListener("click",()=>{
      lensOn=!lensOn;
      lensToggle.setAttribute("aria-pressed",String(lensOn));
      lensToggle.setAttribute("aria-label",lensOn?"Disable edge lensing":"Enable edge lensing");
      lensToggle.classList.toggle("glass-lens-off",!lensOn);
      lensText.textContent=lensOn?"Lensing on":"Lensing off";
      optics.setLens(lensOn);
    });
    topActions.prepend(lensToggle);
  }

  function cleanup() {
    mutation.disconnect();
    resizeObserver?.disconnect();
    navigation.removeEventListener("scroll",scheduleIndicator);
    win.removeEventListener("resize",scheduleIndicator);
    win.removeEventListener("hashchange",scheduleIndicator);
    if (updateFrame) win.cancelAnimationFrame(updateFrame);
    optics.dispose();
  }
  win.addEventListener("pagehide",cleanup,{once:true});
  return {updateIndicator,cleanup};
}
