import {initWorkspaceTitleTransition} from "./workspace-title-transition.js";
import {initWorkspaceScroll} from "./workspace-scroll.js";
import {initWorkspaceWallpaper} from "./workspace-wallpapers.js";
import {initCollapsedRailTooltips} from "./workspace-rail-tooltips.js";
// The private dashboard uses hash navigation so all views stay behind
// the same authenticated /app route and require no extra Worker routes.
export const MAIN_ROUTES=Object.freeze(["home","projects","settings"]);
export const COLOSSEUM_ROUTES=Object.freeze(["readme","utilities","collections","providers/local","providers/external","providers/credentials","permissions","diagnostics","settings"]);
export const APPLE_HIG_ROUTES=Object.freeze(["readme","overview"]);
const MAIN_SET=new Set(MAIN_ROUTES);
const PROJECT_SET=new Set(COLOSSEUM_ROUTES);
const APPLE_HIG_SET=new Set(APPLE_HIG_ROUTES);
const PROJECT_README_PATTERN=/^project\/([a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?)\/readme$/;
const PROJECT_REGISTRY=new Map();
export function setWorkspaceProjectRegistry(projects){
  PROJECT_REGISTRY.clear();
  for(const p of Array.isArray(projects)?projects:[])
    if(p&&typeof p.slug==="string"&&typeof p.name==="string")
      PROJECT_REGISTRY.set(p.slug,p.name);
  if(typeof window!=="undefined")window.dispatchEvent(new Event("workspace-projects-updated"));
}

const TITLE_CASE={home:"Home",projects:"Projects",settings:"Settings",readme:"Docs",
  utilities:"Utilities",collections:"Collections",providers:"Providers",
  permissions:"Permissions",diagnostics:"Diagnostics",overview:"Overview"};
const PREFERENCE_KEY="dofinances.workspace.sidebar.collapsed";
const WIDTH_KEY="dofinances.workspace.sidebar.width";
const RESIZE_CAP=440;

/* One hour-formatting convention for the 24-hour top bar and the 12-hour
 * Collections update stamp. Minutes/seconds remain two digits, but a single-
 * digit hour is never padded with zero. No extra clock or timer is created. */
export function formatWorkspaceTime(date,{timeZone,hour12=false,seconds=false}={}){
  const options={hour:"2-digit",minute:"2-digit",hourCycle:hour12?"h12":"h23"};
  if(timeZone)options.timeZone=timeZone;
  if(seconds)options.second="2-digit";
  return new Intl.DateTimeFormat(hour12?"en-US":"en-GB",options).format(date)
    .replace(/^0(?=\d:)/,"").replace(/[\u202f\u00a0]/g," ");
}


export function resolveWorkspaceRoute(hash="",search="",pathname=""){
  const raw=typeof hash==="string"?hash.replace(/^#/,"").toLowerCase():"";
  if(MAIN_SET.has(raw))return raw;
  if(raw==="account")return "settings"; // old dashboard deep-link
  if(raw==="colosseum")return "colosseum/readme";
  if(raw==="colosseum/providers")return "colosseum/providers/local"; // Legacy Providers route.
  if(raw==="apple-hig-reader")return "apple-hig-reader/readme";
  if(PROJECT_README_PATTERN.test(raw))return raw;
  if(raw.startsWith("apple-hig-reader/")){
    const section=raw.slice("apple-hig-reader/".length);
    if(APPLE_HIG_SET.has(section))return "apple-hig-reader/"+section;
  }
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
  if(slug==="colosseum")return "colosseum/readme";
  if(slug==="colosseum/providers")return "colosseum/providers/local"; // Legacy deep link.
  if(slug==="apple-hig-reader")return "apple-hig-reader/readme";
  if(PROJECT_README_PATTERN.test(slug))return slug;
  if(slug.startsWith("apple-hig-reader/")&&APPLE_HIG_SET.has(slug.slice("apple-hig-reader/".length)))
    return slug;
  if(slug==="colosseum/capabilities")return "colosseum/utilities"; // legacy deep link
  if(slug.startsWith("colosseum/")&&PROJECT_SET.has(slug.slice("colosseum/".length)))
    return slug;
  return "home";
}
export function workspaceRouteDetails(route){
  const selected=resolveWorkspaceRoute("#"+route);
  if(selected.startsWith("colosseum/")){
    const section=selected.slice("colosseum/".length);
    const providerChild=section.startsWith("providers/");
    const label=providerChild?({local:"Local",external:"External",credentials:"Credentials"}[section.slice("providers/".length)]):TITLE_CASE[section];
    return {route:selected,project:true,projectKey:"colosseum",label,
      breadcrumb:"Projects / Colosseum / "+(providerChild?"Providers / ":"")+label,
      subtitle:"Colosseum project workspace"};
  }
  if(selected.startsWith("apple-hig-reader/")){
    const section=selected.split("/")[1],label=TITLE_CASE[section]||"Docs";
    return {route:selected,project:true,projectKey:"apple-hig-reader",projectName:"Apple HIG Reader",label,
      breadcrumb:"Projects / Apple HIG Reader / "+label,
      subtitle:"Apple HIG Reader project workspace"};
  }
  const custom=PROJECT_README_PATTERN.exec(selected);
  if(custom){
    const projectName=PROJECT_REGISTRY.get(custom[1])||custom[1].replace(/-/g," ");
    return {route:selected,project:true,projectKey:"project/"+custom[1],projectName,label:"Docs",
      breadcrumb:"Projects / "+projectName+" / Docs",subtitle:projectName+" project workspace"};
  }
  const label=TITLE_CASE[selected];
  return {route:selected,project:false,projectKey:null,label,
    breadcrumb:"Dashboard / "+label,
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
  const appleHigNav=doc.getElementById("apple-hig-navigation");
  const customNav=doc.getElementById("custom-project-navigation");
  const breadcrumb=doc.getElementById("breadcrumb");
  const subtitle=doc.getElementById("location-subtitle");
  const back=doc.getElementById("back-to-workspace");
  const currentCrumb=doc.getElementById("breadcrumb-current");
  const projectArrow=doc.getElementById("breadcrumb-project-separator");
  const projectCrumbItem=doc.getElementById("breadcrumb-project-item");
  const colosseumCrumbItem=doc.getElementById("breadcrumb-colosseum-item");
  const colosseumCrumb=doc.getElementById("breadcrumb-colosseum");
  const colosseumArrow=doc.getElementById("breadcrumb-colosseum-separator");
  const resizeHandle=doc.getElementById("sidebar-resize-handle");
  const railExpandTarget=doc.getElementById("sidebar-rail-expand-target");
  const globalMenu=doc.getElementById("global-menu");
  const globalToggle=doc.getElementById("global-menu-toggle");
  const searchToggle=doc.getElementById("global-search-toggle");
  const searchPanel=doc.getElementById("global-search-panel");
  const searchInput=doc.getElementById("global-search-input");
  const globalLinks=[...doc.querySelectorAll("[data-global-route]")];
  const searchable=[...doc.querySelectorAll("#global-search-results a")];
  const views=[...doc.querySelectorAll(".view[data-view]")];
  // Studio retains its original single Providers showcase. Production uses
  // three real child routes; route-to-view fallback is Studio-only.
  const legacyStudioProviders=views.some(v=>v.dataset.view==="colosseum/providers")&&
    !views.some(v=>v.dataset.view==="colosseum/providers/local");
  const links=[...doc.querySelectorAll(".nav-link[data-route]")];
  const providerParent=doc.querySelector?.("[data-providers-toggle]");
  const providerSubnav=doc.getElementById?.("providers-subnavigation");
  let providersExpanded=false;
  const syncProviderNav=()=>{
    if(providerSubnav)providerSubnav.hidden=!providersExpanded;
    providerParent?.setAttribute?.("aria-expanded",String(providersExpanded));
  };
  if(!shell||!sidebar||!desktopToggle||!mobileToggle||!scrim||
     !mainNav||!projectNav||!breadcrumb||!subtitle||!back||!views.length)
    throw Error("Workspace navigation markup is incomplete.");

  const isMobile=()=>!!win.matchMedia?.("(max-width: 760px)").matches;
  // Match the reference's xl breakpoint: mobile drawer, compact desktop rail,
  // then an expandable full-width sidebar at 1280px and above.
  const isCompactRail=()=>!!win.matchMedia?.("(min-width: 761px) and (max-width: 1279px)").matches;
  const railTooltips=initCollapsedRailTooltips(doc,win,shell,sidebar);
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
  let expandedWidth=260; // Persisted preference, even when the viewport contracts.
  let displayedWidth=260;
  const COLLAPSE_DRAG_FRACTION=.5;
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
  const minSidebarWidth=Math.max(248,Math.ceil(titleWidths()+18+11+22+24+18));
  // Reserve at least 25% of the full viewport for content, including the gutter.
  const maxSidebarWidth=()=>Math.max(minSidebarWidth,
    Math.min(RESIZE_CAP,Math.floor((win.innerWidth||1280)*.75)-16));
  const clampWidth=n=>Math.round(Math.max(minSidebarWidth,Math.min(maxSidebarWidth(),n)));
  function setSidebarWidth(n,preservePreference=false){
    if(!preservePreference)expandedWidth=n;
    displayedWidth=clampWidth(n);
    shell.style?.setProperty?.("--sidebar-expanded-width",displayedWidth+"px");
    resizeHandle?.setAttribute?.("aria-valuemin",String(minSidebarWidth));
    resizeHandle?.setAttribute?.("aria-valuemax",String(maxSidebarWidth()));
    resizeHandle?.setAttribute?.("aria-valuenow",String(displayedWidth));
  }
  setSidebarWidth(expandedWidth,true);
  function updateCollapse(){
    railTooltips?.hide();
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
    if(railExpandTarget)railExpandTarget.hidden=isMobile()||!effectiveCollapsed;
  }
  function closeDrawer(animate=false){
    if(animate===true&&isMobile()&&shell.classList.contains("is-mobile-open"))
      startSidebarMotion("drawer");
    shell.classList.remove("is-mobile-open");
    scrim.hidden=true;
    mobileToggle.tabIndex=0;
    mobileToggle.setAttribute("aria-expanded","false");
    mobileToggle.setAttribute("aria-label","Open navigation");
  }
  function openDrawer(){
    if(isMobile())startSidebarMotion("drawer");
    shell.classList.add("is-mobile-open");
    // The fading-out control cannot retain keyboard focus while invisible.
    mobileToggle.tabIndex=-1;
    if(doc.activeElement===mobileToggle)desktopToggle.focus();
    scrim.hidden=false;
    mobileToggle.setAttribute("aria-expanded","true");
    mobileToggle.setAttribute("aria-label","Close navigation");
  }
  const workspaceScroll=initWorkspaceScroll(doc,win);
  const workspaceTitleTransition=initWorkspaceTitleTransition(doc,win);
  // The final breadcrumb is the active page, not an inert text label.
  // Native button activation (mouse, touch, Enter, Space) reuses the same
  // distance-aware RAF return-to-top trajectory, without changing routes.
  currentCrumb?.addEventListener?.("click",()=>workspaceScroll.animateToTop());
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
    if(legacyStudioProviders&&route==="colosseum/providers/local"){
      meta.label="Providers";
      meta.breadcrumb="Projects / Colosseum / Providers";
    }
    if(customNav){
      const custom=meta.projectKey?.startsWith("project/");
      customNav.hidden=!custom;
      if(custom){
        const name=customNav.querySelector(".nav-section-label");
        if(name)name.textContent=(meta.projectName||"PROJECT").toUpperCase();
        const link=customNav.querySelector(".nav-link");
        if(link){link.href="#"+route;link.dataset.route=route;link.setAttribute("aria-label","Docs for "+meta.projectName);}
      }
    }
    mainNav.hidden=meta.project;
    projectNav.hidden=meta.projectKey!=="colosseum";
    if(appleHigNav)appleHigNav.hidden=meta.projectKey!=="apple-hig-reader";
    back.hidden=!meta.project;
    if(projectCrumbItem)projectCrumbItem.hidden=!meta.project;
    if(colosseumCrumbItem)colosseumCrumbItem.hidden=!meta.project;
    if(colosseumCrumb){
      colosseumCrumb.hidden=!meta.project;
      if(meta.project){
        colosseumCrumb.textContent=meta.projectName||(meta.projectKey==="apple-hig-reader"?"Apple HIG Reader":"Colosseum");
        colosseumCrumb.href=meta.projectKey==="apple-hig-reader"?"#apple-hig-reader/readme":
          meta.projectKey?.startsWith("project/")?"#"+meta.projectKey+"/readme":"#colosseum/readme";
      }
    }
    if(currentCrumb){
      currentCrumb.textContent=meta.label;
      currentCrumb.setAttribute("aria-label","Scroll to top of "+meta.label);
      if(projectArrow)projectArrow.hidden=!meta.project;
      if(colosseumCrumb)colosseumCrumb.hidden=!meta.project;
      if(colosseumArrow)colosseumArrow.hidden=!meta.project;
    }else breadcrumb.textContent=meta.breadcrumb; // Lightweight DOM-test fixture.
    subtitle.textContent=""; // The former second header line is retired.
    for(const link of globalLinks){
      const href=link.href?.split("#")[1];
      const selected=href===route||(legacyStudioProviders&&
        route==="colosseum/providers/local"&&href==="colosseum/providers");
      link.classList.toggle("is-current",selected);
      if(selected)link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    doc.title=meta.label+" · "+(meta.projectKey==="colosseum"?"Colosseum · ":meta.projectKey==="apple-hig-reader"?"Apple HIG Reader · ":"")+"DoFinances";
    // A provider child is a real route; the parent is a disclosure, never a fourth screen.
    if(route.startsWith("colosseum/providers/"))providersExpanded=true;
    syncProviderNav();
    providerParent?.classList?.toggle("is-parent-current",route.startsWith("colosseum/providers/"));
    // One Settings DOM view for both Workspace and every project.
    const visibleView=route==="colosseum/settings"?"settings":
      route.endsWith("/readme")?"project/readme":
      legacyStudioProviders&&route==="colosseum/providers/local"?"colosseum/providers":route;
    for(const view of views)view.hidden=view.dataset.view!==visibleView;
    for(const link of links){
      const href=link.href?.split("#")[1];
      const selected=link!==providerParent&&(href===route||
        legacyStudioProviders&&route==="colosseum/providers/local"&&href==="colosseum/providers");
      link.classList.toggle("active",selected);
      if(selected)link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    railTooltips?.hide();
    closeDrawer();
    lastRenderedRoute=route;
    // Content and active navigation commit first. Loading/decoding a new
    // full-width image must never block this interaction or the scroll reset.
    if(first)workspaceScroll.sync();
    else workspaceScroll.reset();
    wallpaper.show(route,first);
    workspaceTitleTransition.setRoute(route);
  }

  providerParent?.addEventListener?.("click",event=>{
    if(event?.ctrlKey||event?.metaKey||event?.altKey||event?.shiftKey||event?.button>0)return;
    event.preventDefault();
    providersExpanded=!providersExpanded;
    if(providersExpanded&&!isMobile()&&shell.classList.contains("is-collapsed")){
      if(isCompactRail())railExpanded=true;
      else{
        collapsed=false;
        try{win.localStorage.setItem(PREFERENCE_KEY,"false");}catch{}
      }
      startSidebarMotion("layout");updateCollapse();
    }
    syncProviderNav();
  });
  syncProviderNav();
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
  // Preserve click-to-expand on empty rail pixels without any hover popup.
  const blankSurface=target=>!target?.closest?.('a,button,input,[role="separator"]');
  const expandFromBlank=event=>{
    if(isMobile()||!shell.classList.contains("is-collapsed")||!blankSurface(event.target))return;
    if(isCompactRail())railExpanded=true;
    else{
      collapsed=false;
      try{win.localStorage.setItem(PREFERENCE_KEY,"false");}catch{}
    }

    setSidebarWidth(expandedWidth,true);
    startSidebarMotion("layout");
    updateCollapse();
  };
  sidebar.addEventListener?.("click",expandFromBlank);
  railExpandTarget?.addEventListener?.("keydown",event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    event.preventDefault?.();
    expandFromBlank({target:railExpandTarget});
  });
  // A drag can continue beyond the fixed expanded minimum, but crossing
  // half that minimum collapses immediately. No pointerup/release required.
  if(resizeHandle){
    let drag=null,queued=false,pendingWidth=displayedWidth,rawWidth=displayedWidth;
    const paint=()=>{
      queued=false;
      if(drag)setSidebarWidth(pendingWidth,true);
    };
    const collapseDuringDrag=()=>{
      if(!drag)return;
      const pointerId=drag.pointerId;
      drag=null; // Make lostpointercapture and any queued frame harmless.
      queued=false;
      shell.classList.remove("is-sidebar-resizing");
      if(isCompactRail())railExpanded=false;
      else collapsed=true;
      try{win.localStorage.setItem(PREFERENCE_KEY,"true");}catch{}

      startSidebarMotion("layout");
      updateCollapse();
      // Release capture after state is settled. Do not wait for pointerup.
      try{if(pointerId!==undefined)resizeHandle.releasePointerCapture?.(pointerId);}catch{}
    };
    const onMove=event=>{
      if(!drag)return;
      rawWidth=drag.width+event.clientX-drag.x;
      if(rawWidth<minSidebarWidth*COLLAPSE_DRAG_FRACTION){
        collapseDuringDrag();
        return;
      }
      pendingWidth=clampWidth(rawWidth);

      if(queued)return;
      queued=true;
      if(typeof win.requestAnimationFrame==="function")win.requestAnimationFrame(paint);
      else paint();
    };
    const onEnd=event=>{
      if(!drag)return;
      if(event?.type==="pointercancel")
        setSidebarWidth(drag.width,true);
      else{
        setSidebarWidth(pendingWidth);
        try{win.localStorage.setItem(WIDTH_KEY,String(displayedWidth));}catch{}
      }
      drag=null;
      queued=false;
      shell.classList.remove("is-sidebar-resizing");

    };
    resizeHandle.addEventListener("pointerdown",event=>{
      if(isMobile()||shell.classList.contains("is-collapsed"))return;
      event.preventDefault?.();
      stopSidebarMotion();
      drag={x:event.clientX,width:displayedWidth,pointerId:event.pointerId};
      rawWidth=pendingWidth=displayedWidth;
      shell.classList.add("is-sidebar-resizing");
      resizeHandle.setPointerCapture?.(event.pointerId);

    });
    resizeHandle.addEventListener("pointermove",onMove);
    resizeHandle.addEventListener("pointerup",onEnd);
    resizeHandle.addEventListener("pointercancel",onEnd);
    // Some browsers revoke pointer capture mid-drag while the mouse button is
    // still held. That is not a release: keep the in-progress drag alive and
    // follow subsequent events through the document until pointerup/cancel.
    // Pointer capture remains the preferred path when available; the document
    // listeners serve only as an event-driven fallback, never polling.
    doc.addEventListener?.("pointermove",event=>{
      if(drag && event.target!==resizeHandle && event.pointerId===drag.pointerId)onMove(event);
    });
    doc.addEventListener?.("pointerup",event=>{
      if(drag && event.pointerId===drag.pointerId)onEnd(event);
    });
    doc.addEventListener?.("pointercancel",event=>{
      if(drag && event.pointerId===drag.pointerId)onEnd(event);
    });
    resizeHandle.addEventListener("lostpointercapture",event=>{
      if(!drag || event.pointerId!==drag.pointerId)return;
      // Native capture may transfer while buttons still indicate a held drag.
      // Do not commit the old width or discard the drag in that situation.
      if(event.buttons) return;
      onEnd(event);
    });
    resizeHandle.addEventListener("keydown",event=>{
      if(isMobile()||shell.classList.contains("is-collapsed"))return;
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault?.();
      if(event.key==="ArrowLeft"&&displayedWidth<=minSidebarWidth){
        if(isCompactRail())railExpanded=false;else collapsed=true;
        try{win.localStorage.setItem(PREFERENCE_KEY,"true");}catch{}
        startSidebarMotion("layout");
        updateCollapse();return;
      }
      const next=event.key==="Home"?minSidebarWidth:event.key==="End"?
        maxSidebarWidth():displayedWidth+(event.key==="ArrowRight"?10:-10);
      setSidebarWidth(next);
      try{win.localStorage.setItem(WIDTH_KEY,String(displayedWidth));}catch{}
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
  for(const link of globalLinks)link.addEventListener("click",event=>{
    const route=link.href?.split("#")[1];
    const modified=event?.metaKey||event?.ctrlKey||event?.shiftKey||event?.altKey||
      (event?.button!==undefined&&event.button!==0);
    if(route===lastRenderedRoute&&!modified){
      // The current screen is still an ordinary, keyboard-accessible link.
      // Only plain activation scrolls to top instead of changing the URL.
      event.preventDefault();
      workspaceScroll.animateToTop();
      closeGlobal();
      return;
    }
    if(route&&!modified)render(route);
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
      if(link===providerParent)return; // Disclosure opens children; it is not a fourth view.
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
  win.addEventListener("workspace-projects-updated",()=>{lastRenderedRoute=null;render();});
  win.addEventListener("hashchange",render);
  win.addEventListener("popstate",render);
  win.addEventListener("resize",()=>{
    const nowMobile=isMobile();
    const nowCompactRail=isCompactRail();
    if(!nowMobile)setSidebarWidth(expandedWidth,true);
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
  initWorkspaceClock(doc,win);
  render();
  return {render,closeDrawer};
}


// One global clock, independent of routes and Colosseum telemetry.
// Local preference stays on this browser; it is never sent to the server.
export function initWorkspaceClock(doc=document,win=window){
  const clock=doc.getElementById?.("global-clock");
  const time=doc.getElementById?.("global-clock-time");
  const seconds=doc.getElementById?.("global-clock-seconds");
  const suffix=doc.getElementById?.("global-clock-zone");
  if(!clock||!time||!seconds||!suffix)return;
  if(clock.dataset.clockReady==="true")return;
  clock.dataset.clockReady="true";
  const select=doc.getElementById?.("clock-zone-select");
  const customRow=doc.getElementById?.("clock-custom-row");
  const customInput=doc.getElementById?.("clock-custom-zone");
  const apply=doc.getElementById?.("clock-custom-apply");
  const feedback=doc.getElementById?.("clock-settings-feedback");
  const STORAGE_KEY="dofinances.clock.timezone.v1";
  const modes=new Set(["local","utc","central","custom"]);
  const validZone=zone=>{
    if(typeof zone!=="string"||!zone.trim()||zone.length>100)return false;
    try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(new Date());return true;}catch{return false;}
  };
  const detected=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";}catch{return "UTC";}};
  let preference={mode:"local",custom:""};
  const load=()=>{try{
    const saved=JSON.parse(win.localStorage?.getItem(STORAGE_KEY)||"null");
    if(saved&&modes.has(saved.mode)){
      if(saved.mode!=="custom"||validZone(saved.custom))
        preference={mode:saved.mode,custom:validZone(saved.custom)?saved.custom:""};
    }
  }catch{}};
  const store=()=>{try{win.localStorage?.setItem(STORAGE_KEY,JSON.stringify(preference));}catch{}};
  const zone=()=>preference.mode==="utc"?"UTC":preference.mode==="central"?"America/Chicago":
    preference.mode==="custom"?preference.custom:detected();
  // Split the already-formatted 24-hour time; retain exactly one timer and
  // keep the public formatter's HH:MM:SS output for other consumers.
  const renderTime=formatted=>{
    const split=formatted.lastIndexOf(":");
    time.textContent=formatted.slice(0,split);
    seconds.textContent=formatted.slice(split+1);
  };
  const paint=()=>{
    const now=new Date(),name=zone();
    try{
      renderTime(formatWorkspaceTime(now,{timeZone:name,seconds:true}));
      const tz=new Intl.DateTimeFormat("en-US",{timeZone:name,timeZoneName:"short"}).formatToParts(now)
        .find(p=>p.type==="timeZoneName")?.value||name;
      suffix.textContent=preference.mode==="utc"?"UTC":tz;
      clock.setAttribute("aria-label",name+" · "+new Intl.DateTimeFormat("en-US",{timeZone:name,
        weekday:"long",month:"short",day:"numeric",year:"numeric"}).format(now));
      clock.setAttribute("datetime",now.toISOString());
    }catch{
      renderTime(formatWorkspaceTime(now,{timeZone:"UTC",seconds:true}));
      suffix.textContent="UTC";
      clock.setAttribute("aria-label","UTC");
    }
  };
  const sync=()=>{
    if(select)select.value=preference.mode;
    if(customInput)customInput.value=preference.custom;
    if(customRow)customRow.hidden=preference.mode!=="custom";
    if(feedback)feedback.textContent="";
    paint();
  };
  load();
  sync();
  const chooseMode=()=>{
    const mode=select?.value;
    if(!modes.has(mode))return;
    if(customRow)customRow.hidden=mode!=="custom";
    if(feedback)feedback.textContent="";
    if(mode==="custom"){
      if(customInput)customInput.value=preference.custom;
      customInput?.focus?.();
      return;
    }
    preference={...preference,mode};
    store();
    paint();
    if(feedback)feedback.textContent="Top-bar clock updated.";
  };
  select?.addEventListener?.("change",chooseMode);
  const applyCustom=()=>{
    const name=customInput?.value?.trim();
    if(!validZone(name)){
      if(feedback)feedback.textContent="Unsupported time zone. Enter a valid IANA name, such as Europe/London.";
      customInput?.setAttribute?.("aria-invalid","true");
      return;
    }
    customInput?.removeAttribute?.("aria-invalid");
    preference={mode:"custom",custom:name};
    store();sync();
    if(feedback)feedback.textContent="Top-bar clock updated to "+name+".";
  };
  apply?.addEventListener?.("click",applyCustom);
  customInput?.addEventListener?.("keydown",event=>{if(event.key==="Enter"){event.preventDefault();applyCustom();}});
  customInput?.addEventListener?.("input",()=>{customInput.removeAttribute("aria-invalid");if(feedback)feedback.textContent="";});
  win.addEventListener?.("storage",event=>{if(event.key===STORAGE_KEY){load();sync();}});
  // Date.now is sampled each tick; no second clock, no telemetry polling.
  paint();
  if(win.setInterval){
    const timer=win.setInterval(paint,1000);
    win.addEventListener?.("pagehide",()=>win.clearInterval?.(timer),{once:true});
  }
}
