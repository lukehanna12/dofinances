/* Dashboard-only public static preview. Keep existing top bars and the
 * standalone 0001c1 mosaic, without sidebar routing or oracle workers.
 * No account/authenticated controller modules are loaded. */

const HOME_HASH="#home";
if(location.hash && location.hash!==HOME_HASH)
  history.replaceState(history.state,"",location.pathname+location.search+HOME_HASH);

// Capture before the production workspace router: links remain focusable,
// hoverable and pressable, but do not switch views or leave the preview.
document.addEventListener("click",event=>{
  const anchor=event.target.closest?.("a[href]");
  if(!anchor)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  anchor.classList.add("dashboard-preview-tapped");
  setTimeout(()=>anchor.classList.remove("dashboard-preview-tapped"),180);
},true);
document.addEventListener("auxclick",event=>{
  if(event.target.closest?.("a[href]")){
    event.preventDefault();
    event.stopImmediatePropagation();
  }
},true);
document.addEventListener("submit",event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
},true);
// Direct hash entry or a browser Back/Forward must also remain on Home.
window.addEventListener("hashchange",()=>{
  if(location.hash!==HOME_HASH)
    history.replaceState(history.state,"",location.pathname+location.search+HOME_HASH);
},true);

// Preserve the existing topbar glass CSS without mounting the sidebar oracle.
document.getElementById("workspace-shell")?.classList.add("liquid-glass-preview");
document.body.dataset.wallpaperRoute="home";
document.title="Dashboard Preview · DoFinances";
// The public preview has no authenticated account; never show a fake loading state.
for(const id of ["account-email","account-email-detail"]){
  const el=document.getElementById(id);
  if(el)el.textContent="";
}

// Unrelated account, collection and diagnostic actions are not wired to
// their production controllers. Disable them to avoid misleading activity.
for(const form of document.querySelectorAll("form")){
  for(const field of form.querySelectorAll("button,input,select,textarea")){
    field.disabled=true;
    field.setAttribute("aria-description","Not available in this static Dashboard preview");
  }
}
const sidebarControls=new Set([
  "global-menu-toggle","global-search-toggle","clock-custom-apply"
]);
for(const button of document.querySelectorAll("button")){
  if(sidebarControls.has(button.id))continue;
  button.disabled=true;
  button.setAttribute("aria-description","Not available in this static Dashboard preview");
}
for(const element of document.querySelectorAll(".view[data-view]")){
  if(element.dataset.view!=="home")element.hidden=true;
}
for(const element of document.querySelectorAll("a[href]")){
  if(!element.hasAttribute("aria-description"))
    element.setAttribute("aria-description","Preview interaction only; navigation disabled");
}
const style=document.createElement("style");
style.textContent=`
.nav-link.dashboard-preview-tapped{
  background-color:rgba(244,247,251,.12)!important;
  transition:background-color 135ms ease;
}
`;
document.head.append(style);
