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
  if(button.id==="sidebar-toggle"||button.id==="mobile-nav-toggle"||button.id==="sidebar-scrim"||button.id==="global-menu-toggle"||button.id==="global-search-toggle"||button.id==="clock-custom-apply")continue;
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
// The single topbar clock is managed by shared workspace navigation.
const diagnostics=document.getElementById("diagnostics-root");
if(diagnostics){
  const notice=document.getElementById("dg-notice");
  if(notice)notice.textContent="This is a static layout preview. Live measurements and query controls are available in your authenticated DoFinances workspace.";
}
