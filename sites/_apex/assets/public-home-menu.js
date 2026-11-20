/* Public homepage only. No auth, workspace navigation, or hidden routes. */
const toggle=document.getElementById("public-menu-toggle");
const panel=document.getElementById("public-menu-panel");
const compact=window.matchMedia("(max-width:748px)");
if(toggle&&panel){
  const close=()=>{
    panel.hidden=true;
    toggle.setAttribute("aria-expanded","false");
    toggle.setAttribute("aria-label","Open navigation menu");
  };
  const open=()=>{
    if(!compact.matches)return;
    panel.hidden=false;
    toggle.setAttribute("aria-expanded","true");
    toggle.setAttribute("aria-label","Close navigation menu");
  };
  toggle.addEventListener("click",()=>{
    if(panel.hidden)open();
    else close();
  });
  // Placeholder entries retain their own hover and press feedback and only
  // dismiss the dropdown; they intentionally do not navigate.
  panel.addEventListener("click",event=>{
    if(event.target.closest("button"))close();
  });
  document.addEventListener("pointerdown",event=>{
    if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))close();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!panel.hidden){
      close();
      toggle.focus();
    }
  });
  compact.addEventListener("change",close);
}
