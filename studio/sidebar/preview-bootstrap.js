// Standalone Studio: real workspace navigation and glass, no account operations.
import {initWorkspaceNavigation} from "./workspace-nav.js";
import {initLiquidGlassSidebar} from "./sidebar-glass.js";
initWorkspaceNavigation();
for(const id of ["account-email","account-email-detail"]){
  const element=document.getElementById(id);
  if(element)element.textContent="Preview workspace";
}
for(const form of document.querySelectorAll("form")){
  form.addEventListener("submit",event=>event.preventDefault());
  for(const field of form.querySelectorAll("button,input,select,textarea")){
    field.disabled=true;
    field.setAttribute("aria-description","Unavailable in this static preview");
  }
}
for(const button of document.querySelectorAll("button")){
  if(button.id==="sidebar-toggle"||button.id==="mobile-nav-toggle"||button.id==="sidebar-scrim"||button.id==="global-menu-toggle"||button.id==="global-search-toggle")continue;
  button.disabled=true;
  button.setAttribute("aria-description","Unavailable in this static preview");
}
for(const link of document.querySelectorAll("a[href]")){
  if(link.getAttribute("href")?.startsWith("#"))continue;
  link.removeAttribute("href");
  link.setAttribute("aria-disabled","true");
}

// Preview-only optical material; account/network controls remain disabled.
window.__ciGlass=initLiquidGlassSidebar();

// The public Studio is a design preview only; never request protected telemetry.
const diagnostics=document.getElementById("diagnostics-root");
if(diagnostics){
  const notice=document.getElementById("dg-notice");
  if(notice)notice.textContent="This is a static layout preview. Live measurements and query controls are available in your authenticated DoFinances workspace.";
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  function previewClocks(){
    const now=new Date();
    let zone="Local";
    try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Local";}catch{}
    set("dg-tz",zone);
    const clock=(where,options)=>new Intl.DateTimeFormat(undefined,{...options,timeZone:where}).format(now);
    try{set("dg-localtime",clock(zone,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}));
      set("dg-localdate",clock(zone,{weekday:"long",month:"short",day:"numeric",year:"numeric"}));}catch{}
    set("dg-utctime",clock("UTC",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}));
    set("dg-utcdate",clock("UTC",{weekday:"long",month:"short",day:"numeric",year:"numeric"}));
  }
  previewClocks();
  window.setInterval(previewClocks,1000);
}

