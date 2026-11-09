import {applyWorkspaceWallpaper} from "./workspace-wallpapers.js";
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
  try{collapsed=win.localStorage.getItem(PREFERENCE_KEY)==="true";}catch{}
  function updateCollapse(){
    const forcedRail=isCompactRail();
    const effectiveCollapsed=forcedRail||collapsed;
    shell.classList.toggle("is-compact-rail",forcedRail);
    shell.classList.toggle("is-collapsed",effectiveCollapsed);
    // The compact rail is a responsive mode, not a user toggle.
    desktopToggle.disabled=forcedRail;
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
  let lastRenderedRoute=null;
  function render(){
    const route=resolveWorkspaceRoute(win.location.hash,win.location.search,win.location.pathname);
    const changingScreen=lastRenderedRoute!==null&&lastRenderedRoute!==route;
    const meta=workspaceRouteDetails(route);
    mainNav.hidden=meta.project;
    projectNav.hidden=!meta.project;
    back.hidden=!meta.project;
    breadcrumb.textContent=meta.breadcrumb;
    subtitle.textContent=meta.subtitle;
    doc.title=meta.label+" · "+(meta.project?"Colosseum · ":"")+"DoFinances";
    applyWorkspaceWallpaper(doc,route);
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
    // Only reset when changing to a different screen. Avoid browser CSS
    // smooth-scroll movement and unnecessary resets during initial hydration,
    // repeated hash events, or history updates for the same route.
    if(changingScreen&&win.scrollTo)
      win.scrollTo({top:0,left:0,behavior:"instant"});
  }

  desktopToggle.addEventListener("click",()=>{
    if(isMobile()){closeDrawer(true);return;}
    if(isCompactRail())return;
    startSidebarMotion("layout");
    collapsed=!collapsed;
    try{win.localStorage.setItem(PREFERENCE_KEY,String(collapsed));}catch{}
    updateCollapse();
  });
  mobileToggle.addEventListener("click",()=>{
    if(shell.classList.contains("is-mobile-open"))closeDrawer(true);
    else openDrawer();
  });
  scrim.addEventListener("click",()=>closeDrawer(true));
  doc.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&shell.classList.contains("is-mobile-open")){
      closeDrawer(true);mobileToggle.focus();
    }
  });
  for(const link of links)link.addEventListener("click",()=>{if(isMobile())closeDrawer(true);});
  back.addEventListener("click",()=>{if(isMobile())closeDrawer(true);});
  win.addEventListener("hashchange",render);
  win.addEventListener("popstate",render);
  win.addEventListener("resize",()=>{
    const nowMobile=isMobile();
    const nowCompactRail=isCompactRail();
    if(nowMobile!==wasMobile){
      stopSidebarMotion();
      stopRailEntry();
      // The 274px fixed drawer must never animate from the right into a
      // 74px in-flow rail. Instead reveal the desktop rail from the left.
      if(wasMobile&&!nowMobile)enterDesktopFromLeft();
    }else if(nowCompactRail!==wasCompactRail){
      stopRailEntry();
      // Within desktop layouts the rail/full-width resize may interpolate.
      startSidebarMotion("layout");
    }
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
