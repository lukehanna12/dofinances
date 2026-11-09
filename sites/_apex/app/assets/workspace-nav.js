// The private dashboard uses hash navigation so all views stay behind
// the same authenticated /app route and require no extra Worker routes.
export const MAIN_ROUTES=Object.freeze(["home","projects","settings"]);
export const COLOSSEUM_ROUTES=Object.freeze(["capabilities","collections","providers","permissions","diagnostics","settings"]);
const MAIN_SET=new Set(MAIN_ROUTES);
const PROJECT_SET=new Set(COLOSSEUM_ROUTES);
const TITLE_CASE={home:"Home",projects:"Projects",settings:"Settings",
  capabilities:"Capabilities",collections:"Collections",providers:"Providers",
  permissions:"Permissions",diagnostics:"Diagnostics"};
const PREFERENCE_KEY="dofinances.workspace.sidebar.collapsed";

export function resolveWorkspaceRoute(hash="",search=""){
  const raw=typeof hash==="string"?hash.replace(/^#/,"").toLowerCase():"";
  if(MAIN_SET.has(raw))return raw;
  if(raw==="account")return "settings"; // old dashboard deep-link
  if(raw==="colosseum")return "colosseum/capabilities";
  if(raw.startsWith("colosseum/")){
    const section=raw.slice("colosseum/".length);
    if(PROJECT_SET.has(section))return "colosseum/"+section;
  }
  if(!raw&&/(?:^|[?&])federation_(?:linked|error)=/.test(search))return "settings";
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
  let collapsed=false;
  try{collapsed=win.localStorage.getItem(PREFERENCE_KEY)==="true";}catch{}
  function updateCollapse(){
    shell.classList.toggle("is-collapsed",collapsed);
    desktopToggle.setAttribute("aria-expanded",String(!collapsed));
    desktopToggle.setAttribute("aria-label",isMobile()?"Close navigation":
      collapsed?"Expand sidebar":"Collapse sidebar");
    desktopToggle.title=collapsed?"Expand sidebar":"Collapse sidebar";
  }
  function closeDrawer(){
    shell.classList.remove("is-mobile-open");
    scrim.hidden=true;
    mobileToggle.setAttribute("aria-expanded","false");
    mobileToggle.setAttribute("aria-label","Open navigation");
  }
  function openDrawer(){
    shell.classList.add("is-mobile-open");
    scrim.hidden=false;
    mobileToggle.setAttribute("aria-expanded","true");
    mobileToggle.setAttribute("aria-label","Close navigation");
  }
  function render(){
    const route=resolveWorkspaceRoute(win.location.hash,win.location.search);
    const meta=workspaceRouteDetails(route);
    mainNav.hidden=meta.project;
    projectNav.hidden=!meta.project;
    back.hidden=!meta.project;
    breadcrumb.textContent=meta.breadcrumb;
    subtitle.textContent=meta.subtitle;
    doc.title=meta.label+" · "+(meta.project?"Colosseum · ":"")+"DoFinances";
    for(const view of views)view.hidden=view.dataset.view!==route;
    for(const link of links){
      const selected=link.href?.split("#")[1]===route;
      link.classList.toggle("active",selected);
      if(selected)link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    closeDrawer();
    if(win.scrollTo)win.scrollTo(0,0);
  }

  desktopToggle.addEventListener("click",()=>{
    if(isMobile()){closeDrawer();return;}
    collapsed=!collapsed;
    try{win.localStorage.setItem(PREFERENCE_KEY,String(collapsed));}catch{}
    updateCollapse();
  });
  mobileToggle.addEventListener("click",()=>{
    if(shell.classList.contains("is-mobile-open"))closeDrawer();
    else openDrawer();
  });
  scrim.addEventListener("click",closeDrawer);
  doc.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&shell.classList.contains("is-mobile-open")){
      closeDrawer();mobileToggle.focus();
    }
  });
  for(const link of links)link.addEventListener("click",()=>{if(isMobile())closeDrawer();});
  back.addEventListener("click",()=>{if(isMobile())closeDrawer();});
  win.addEventListener("hashchange",render);
  win.addEventListener("popstate",render);
  win.addEventListener("resize",()=>{
    if(!isMobile())closeDrawer();
    updateCollapse();
  });
  updateCollapse();
  render();
  return {render,closeDrawer};
}
