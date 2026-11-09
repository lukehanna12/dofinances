import {initWorkspaceScroll} from "./workspace-scroll.js";
import {initWorkspaceWallpaper} from "./workspace-wallpapers.js";
// The private dashboard uses hash navigation so all views stay behind
// the same authenticated /app route and require no extra Worker routes.
export const MAIN_ROUTES=Object.freeze(["home","projects","settings"]);
export const COLOSSEUM_ROUTES=Object.freeze(["utilities","collections","providers","permissions","diagnostics","settings"]);
const MAIN_SET=new Set(MAIN_ROUTES);
const PROJECT_SET=new Set(COLOSSEUM_ROUTES);
const TITLE_CASE={home:"Home",projects:"Projects",settings:"Settings",
  utilities:"Utilities",collections:"Collections",providers:"Providers",
  permissions:"Permissions",diagnostics:"Diagnostics"};
const PREFERENCE_KEY="dofinances.workspace.sidebar.collapsed";
const WIDTH_KEY="dofinances.workspace.sidebar.width";
const RESIZE_CAP=440;

export function resolveWorkspaceRoute(hash="",search="",pathname=""){
  const raw=typeof hash==="string"?hash.replace(/^#/,"").toLowerCase():"";
  if(MAIN_SET.has(raw))return raw;
  if(raw==="account")return "settings"; // old dashboard deep-link
  if(raw==="colosseum")return "colosseum/utilities";
  if(raw.startsWith("colosseum/")){
    const section=raw.slice("colosseum/".length);
    if(section==="capabilities")return "colosseum/utilities"; // legacy hash link
    if(PROJECT_SET.has(section))return "colosseum/"+section;
  }
  if(raw)return "home"; // Invalid hashes must not silently select a different page.
  if(/(?:^|[?&])federation_(?:linked|error)=/.test(search))return "settings";
  // The Worker serves the same authenticated document for these nested view URLs.
  const urlPath=typeof pathname==="string"?pathname.replace(/\/+$/,"").toLowerCase()
    .replace(/^\/dashboard(?=\/|$)/,"/app"):"";
  const slug=urlPath.startsWith("/app/")?urlPath.slice("/app/".length):"";
  if(MAIN_SET.has(slug))return slug;
  if(slug==="account")return "settings";
  if(slug==="colosseum")return "colosseum/utilities";
  if(slug==="colosseum/capabilities")return "colosseum/utilities"; // legacy deep link
  if(slug.startsWith("colosseum/")&&PROJECT_SET.has(slug.slice("colosseum/".length)))
    return slug;
  return "home";
}
export function workspaceRouteDetails(route){
  const selected=resolveWorkspaceRoute("#"+route);
  if(selected.startsWith("colosseum/")){
    const section=selected.split("/")[1];
    return {route:selected,project:true,label:TITLE_CASE[section],
      breadcrumb:"Projects / Colosseum / "+TITLE_CASE[section],
      subtitle:"Colosseum project workspace"};
  }
  const label=TITLE_CASE[selected];
  return {route:selected,project:false,label,
    breadcrumb:"Workspace / "+label,
    subtitle:selected==="settings"?"Manage account & security":
      selected==="projects"?"Your projects":"Your personal workspace"};
}
export function initWorkspaceNavigation(doc=document,win=window){
  const shell=doc.getElementById("workspace-shell");
  const sidebar=doc.getElementById("workspace-sidebar");
  const desktopToggle=doc.getElementById("sidebar-toggle");
  const mobileToggle=doc.getElementById("mobile-nav-toggle");
  const scrim=doc.getElementById("sidebar-scrim");
  const mainNav=doc.getElementById("main-navigation");
  const projectNav=doc.getElementById("project-navigation");
  const breadcrumb=doc.getElementById("breadcrumb");
  const subtitle=doc.getElementById("location-subtitle");
  const back=doc.getElementById("back-to-workspace");
  const currentCrumb=doc.getElementById("breadcrumb-current");
  const projectArrow=doc.getElementById("breadcrumb-project-separator");
  const colosseumCrumb=doc.getElementById("breadcrumb-colosseum");
  const colosseumArrow=doc.getElementById("breadcrumb-colosseum-separator");
  const resizeHandle=doc.getElementById("sidebar-resize-handle");
  const globalMenu=doc.getElementById("global-menu");
  const globalToggle=doc.getElementById("global-menu-toggle");
  const searchToggle=doc.getElementById("global-search-toggle");
  const searchPanel=doc.getElementById("global-search-panel");
  const searchInput=doc.getElementById("global-search-input");
  const globalLinks=[...doc.querySelectorAll("[data-global-route]")];
  const searchable=[...doc.querySelectorAll("#global-search-results a")];
  const views=[...doc.querySelectorAll(".view[data-view]")];
  const links=[...doc.querySelectorAll(".nav-link[data-route]")];
  if(!shell||!sidebar||!desktopToggle||!mobileToggle||!scrim||
     !mainNav||!projectNav||!breadcrumb||!subtitle||!back||!views.length)
    throw Error("Workspace navigation markup is incomplete.");

  const isMobile=()=>!!win.matchMedia?.("(max-width: 760px)").matches;
  // Match the reference's xl breakpoint: mobile drawer, compact desktop rail,
  // then an expandable full-width sidebar at 1280px and above.
  const isCompactRail=()=>!!win.matchMedia?.("(min-width: 761px) and (max-width: 1279px)").matches;
  // A viewport breakpoint is a layout change, not an expand/collapse action.
  // Keep transitions off unless a user actually clicked a sidebar control.
  let motionTimeout=null;
  let entryTimeout=null;
  let wasMobile=isMobile();
  let wasCompactRail=isCompactRail();
  function stopRailEntry(){
    if(entryTimeout!==null)clearTimeout(entryTimeout);
    entryTimeout=null;
    shell.classList.remove("is-rail-entering");
  }
  function enterDesktopFromLeft(){
    stopRailEntry();
    shell.classList.add("is-rail-entering");
    entryTimeout=setTimeout(()=>{
      shell.classList.remove("is-rail-entering");
      entryTimeout=null;
    },290);
  }
  function stopSidebarMotion(){
    if(motionTimeout!==null)clearTimeout(motionTimeout);
    motionTimeout=null;
    shell.classList.remove("is-sidebar-toggling");
    shell.classList.remove("is-drawer-toggling");
  }
  function startSidebarMotion(kind){
    stopSidebarMotion();
    const className=kind==="drawer"?"is-drawer-toggling":"is-sidebar-toggling";
    shell.classList.add(className);
    motionTimeout=setTimeout(()=>{
      shell.classList.remove(className);
      motionTimeout=null;
    },250);
  }
  let collapsed=false;
  let railExpanded=false;
  let expandedWidth=260;
  try{
    collapsed=win.localStorage.getItem(PREFERENCE_KEY)==="true";
    const saved=Number(win.localStorage.getItem(WIDTH_KEY));
    if(Number.isFinite(saved)&&saved>=180)expandedWidth=saved;
  }catch{}
  // The minimum is driven by real navigation label widths and chrome,
  // never a percentage of viewport width. A 25%-content minimum caps max.
  const titleWidths=()=>{
    let widest=0;
    const canvas=doc.createElement?.("canvas");
    const ctx=canvas?.getContext?.("2d");
    if(ctx)ctx.font="450 14px system-ui, sans-serif";
    for(const link of links){
      const title=link.querySelector?.(".nav-label")?.textContent||link.getAttribute?.("aria-label")||"";
      widest=Math.max(widest,ctx?ctx.measureText(title).width:title.length*8);
    }
    return widest;
  };
  const minSidebarWidth=Math.max(204,Math.ceil(titleWidths()+18+11+22+24+18));
  const maxSidebarWidth=()=>Math.max(minSidebarWidth,Math.min(RESIZE_CAP,Math.floor((win.innerWidth||1280)*.75)));
  const clampWidth=n=>Math.round(Math.max(minSidebarWidth,Math.min(maxSidebarWidth(),n)));
  function setSidebarWidth(n){
    expandedWidth=clampWidth(n);
    shell.style?.setProperty?.("--sidebar-expanded-width",expandedWidth+"px");
    resizeHandle?.setAttribute?.("aria-valuemin",String(minSidebarWidth));
    resizeHandle?.setAttribute?.("aria-valuemax",String(maxSidebarWidth()));
    resizeHandle?.setAttribute?.("aria-valuenow",String(expandedWidth));
  }
  setSidebarWidth(expandedWidth);
  function updateCollapse(){
    const forcedRail=isCompactRail();
    const effectiveCollapsed=forcedRail?!railExpanded:collapsed;
    shell.classList.toggle("is-compact-rail",forcedRail);
    shell.classList.toggle("is-rail-expanded",forcedRail&&railExpanded);
    shell.classList.toggle("is-collapsed",effectiveCollapsed);
    // Compact rail can expand from its empty surface; toggle then collapses.
    desktopToggle.disabled=forcedRail&&!railExpanded;
    desktopToggle.setAttribute("aria-expanded",String(!effectiveCollapsed));
    desktopToggle.setAttribute("aria-label",isMobile()?"Close navigation":
      effectiveCollapsed?"Expand sidebar":"Collapse sidebar");
    desktopToggle.title=effectiveCollapsed?"Expand sidebar":"Collapse sidebar";
  }
  function closeDrawer(animate=false){
    if(animate===true&&isMobile()&&shell.classList.contains("is-mobile-open"))
      startSidebarMotion("drawer");
    shell.classList.remove("is-mobile-open");
    scrim.hidden=true;
    mobileToggle.setAttribute("aria-expanded","false");
    mobileToggle.setAttribute("aria-label","Open navigation");
  }
  function openDrawer(){
    if(isMobile())startSidebarMotion("drawer");
    shell.classList.add("is-mobile-open");
    scrim.hidden=false;
    mobileToggle.setAttribute("aria-expanded","true");
    mobileToggle.setAttribute("aria-label","Close navigation");
  }
  const workspaceScroll=initWorkspaceScroll(doc,win);
  const wallpaper=initWorkspaceWallpaper(doc,win);
  let lastRenderedRoute=null;
  function render(requestedRoute=null){
    // Click commits in this turn; hashchange/popstate only reconcile.
    const route=typeof requestedRoute==="string"
      ? resolveWorkspaceRoute("#"+requestedRoute)
      : resolveWorkspaceRoute(win.location.hash,win.location.search,win.location.pathname);
    // hashchange/popstate can both fire for one navigation. A repeated route
    // must not trigger another wallpaper repaint, layout measurement or decode.
    if(route===lastRenderedRoute)return;
    const first=lastRenderedRoute===null;
    const meta=workspaceRouteDetails(route);
    mainNav.hidden=meta.project;
    projectNav.hidden=!meta.project;
    back.hidden=!meta.project;
    if(currentCrumb){
      currentCrumb.textContent=meta.label;
      if(projectArrow)projectArrow.hidden=!meta.project;
      if(colosseumCrumb)colosseumCrumb.hidden=!meta.project;
      if(colosseumArrow)colosseumArrow.hidden=!meta.project;
    }else breadcrumb.textContent=meta.breadcrumb; // Lightweight DOM-test fixture.
    subtitle.textContent=""; // The former second header line is retired.
    for(const link of globalLinks){
      const selected=link.href?.split("#")[1]===route;
      link.classList.toggle("is-current",selected);
      if(selected)link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    doc.title=meta.label+" · "+(meta.project?"Colosseum · ":"")+"DoFinances";
    // One Settings DOM view for both Workspace and every project.
    const visibleView=route==="colosseum/settings"?"settings":route;
    for(const view of views)view.hidden=view.dataset.view!==visibleView;
    for(const link of links){
      const selected=link.href?.split("#")[1]===route;
      link.classList.toggle("active",selected);
      if(selected)link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    closeDrawer();
    lastRenderedRoute=route;
    // Content and active navigation commit first. Loading/decoding a new
    // full-width image must never block this interaction or the scroll reset.
    if(first)workspaceScroll.sync();
    else workspaceScroll.reset();
    wallpaper.show(route,first);
  }

  desktopToggle.addEventListener("click",()=>{
    if(isMobile()){closeDrawer(true);return;}
    if(isCompactRail()&&!railExpanded)return;
    startSidebarMotion("layout");
    if(isCompactRail()){
      railExpanded=false;
      collapsed=true;
    }else collapsed=!collapsed;
    try{win.localStorage.setItem(PREFERENCE_KEY,String(collapsed));}catch{}
    updateCollapse();
  });
  // In collapsed desktop mode the unused glass surface is an expansion
  // target. Native links, buttons and the resize grip keep their own actions.
  sidebar.addEventListener?.("click",event=>{
    if(isMobile()||!shell.classList.contains("is-collapsed"))return;
    if(event.target?.closest?.('a,button,input,[role="separator"]'))return;
    if(isCompactRail())railExpanded=true;
    else {
      collapsed=false;
      try{win.localStorage.setItem(PREFERENCE_KEY,"false");}catch{}
    }
    startSidebarMotion("layout");
    updateCollapse();
  });

  // A single frame owns each drag width change; the oracle's ResizeObserver
  // then sees the real CSS width. Dragging never animates the width itself.
  if(resizeHandle){
    let drag=null,queued=false,pendingWidth=expandedWidth;
    const paint=()=>{
      queued=false;
      if(drag)setSidebarWidth(pendingWidth);
    };
    const onMove=event=>{
      if(!drag)return;
      pendingWidth=clampWidth(drag.width+event.clientX-drag.x);
      if(queued)return;
      queued=true;
      if(typeof win.requestAnimationFrame==="function")win.requestAnimationFrame(paint);
      else paint();
    };
    const onEnd=()=>{
      if(!drag)return;
      setSidebarWidth(pendingWidth);
      drag=null;
      shell.classList.remove("is-sidebar-resizing");
      try{win.localStorage.setItem(WIDTH_KEY,String(expandedWidth));}catch{}
    };
    resizeHandle.addEventListener("pointerdown",event=>{
      if(isMobile()||shell.classList.contains("is-collapsed"))return;
      event.preventDefault?.();
      stopSidebarMotion();
      drag={x:event.clientX,width:expandedWidth};
      pendingWidth=expandedWidth;
      shell.classList.add("is-sidebar-resizing");
      resizeHandle.setPointerCapture?.(event.pointerId);
    });
    resizeHandle.addEventListener("pointermove",onMove);
    resizeHandle.addEventListener("pointerup",onEnd);
    resizeHandle.addEventListener("pointercancel",onEnd);
    resizeHandle.addEventListener("lostpointercapture",onEnd);
    resizeHandle.addEventListener("keydown",event=>{
      if(isMobile()||shell.classList.contains("is-collapsed"))return;
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault?.();
      const next=event.key==="Home"?minSidebarWidth:
        event.key==="End"?maxSidebarWidth():
        expandedWidth+(event.key==="ArrowRight"?10:-10);
      setSidebarWidth(next);
      try{win.localStorage.setItem(WIDTH_KEY,String(expandedWidth));}catch{}
    });
  }

  // Genuine Apple-documentation-style global menu, with fully functional
  // route links, a compact navigation menu, and keyboard-searchable routes.
  const closeGlobal=()=>{
    globalMenu?.classList?.remove("is-open");
    globalToggle?.setAttribute?.("aria-expanded","false");
    if(searchPanel)searchPanel.hidden=true;
    searchToggle?.setAttribute?.("aria-expanded","false");
  };
  globalToggle?.addEventListener?.("click",()=>{
    const open=!globalMenu.classList.contains("is-open");
    closeGlobal();
    globalMenu.classList.toggle("is-open",open);
    globalToggle.setAttribute("aria-expanded",String(open));
  });
  searchToggle?.addEventListener?.("click",()=>{
    const open=!!searchPanel?.hidden;
    closeGlobal();
    if(!searchPanel)return;
    searchPanel.hidden=!open;
    searchToggle.setAttribute("aria-expanded",String(open));
    if(open){if(searchInput)searchInput.value="";searchable.forEach(a=>a.hidden=false);searchInput?.focus?.();}
  });
  searchInput?.addEventListener?.("input",()=>{
    const q=searchInput.value.trim().toLowerCase();
    for(const a of searchable)a.hidden=!a.textContent.toLowerCase().includes(q);
  });
  for(const link of globalLinks)link.addEventListener("click",()=>{
    const route=link.href?.split("#")[1];
    if(route)render(route);
    closeGlobal();
  });
  for(const link of links){
    const label=link.querySelector?.(".nav-label");
    const inner=link.querySelector?.(".nav-label-text");
    if(!label||!inner)continue;
    const activate=()=>{
      if(!isMobile())return;
      const extra=Math.max(0,inner.scrollWidth-label.clientWidth);
      label.classList.toggle("is-marquee",extra>1);
      label.style?.setProperty?.("--marquee-distance",extra+"px");
    };
    link.addEventListener("pointerenter",activate,{passive:true});
    link.addEventListener("focus",activate,{passive:true});
    link.addEventListener("pointerleave",()=>label.classList.remove("is-marquee"),{passive:true});
    link.addEventListener("blur",()=>label.classList.remove("is-marquee"),{passive:true});
  }
  mobileToggle.addEventListener("click",()=>{
    if(shell.classList.contains("is-mobile-open"))closeDrawer(true);
    else openDrawer();
  });
  scrim.addEventListener("click",()=>closeDrawer(true));
  doc.addEventListener("keydown",event=>{
    if(event.key==="Escape"){
      closeGlobal();
      if(shell.classList.contains("is-mobile-open")){
        closeDrawer(true);mobileToggle.focus();
      }
    }
  });
  for(const link of links){
    link.addEventListener("click",()=>{
      // Never wait for later hashchange delivery to show the selected route.
      const target=link.href?.split("#")[1];
      if(target)render(target);
      if(isMobile())closeDrawer(true);
    });
    // Warm only likely next routes; avoid pre-decoding eight full-size images.
    const anticipate=()=>wallpaper.warm(link.href?.split("#")[1]||"home");
    link.addEventListener("pointerenter",anticipate,{passive:true});
    link.addEventListener("focus",anticipate,{passive:true});
  }
  back.addEventListener("click",()=>{if(isMobile())closeDrawer(true);});
  win.addEventListener("hashchange",render);
  win.addEventListener("popstate",render);
  win.addEventListener("resize",()=>{
    const nowMobile=isMobile();
    const nowCompactRail=isCompactRail();
    setSidebarWidth(expandedWidth);
    if(nowMobile!==wasMobile){
      stopSidebarMotion();
      stopRailEntry();
      // The 274px fixed drawer must never animate from the right into a
      // 74px in-flow rail. Instead reveal the desktop rail from the left.
      if(wasMobile&&!nowMobile)enterDesktopFromLeft();
    }else if(nowCompactRail!==wasCompactRail){
      stopRailEntry();
      // A viewport-driven breakpoint must not animate a stale geometry.
      stopSidebarMotion();
    }
    if(!nowCompactRail)railExpanded=false;
    if(!nowMobile&&!nowCompactRail&&(wasCompactRail||wasMobile)){
      // Entering xl is a fresh full-sidebar layout, not a remembered tablet
      // collapse. Manual collapse remains available once wide.
      collapsed=false;
      try{win.localStorage.setItem(PREFERENCE_KEY,"false");}catch{}
    }
    wasMobile=nowMobile;
    wasCompactRail=nowCompactRail;
    if(!nowMobile)closeDrawer();
    updateCollapse();
  });
  updateCollapse();
  render();
  return {render,closeDrawer};
}
