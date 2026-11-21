/* Persistent, shared non-authentication preference; no credentials stored. */
const KEY="dofinances-theme";
const button=document.getElementById("public-theme-toggle");
function readTheme(){
  try{return window.localStorage.getItem(KEY)==="light"?"light":"dark"}
  catch{return "dark"}
}
function applyTheme(theme){
  document.documentElement.dataset.dofTheme=theme;
  if(!button)return;
  const dark=theme==="dark";
  const title=dark?"Switch to light mode":"Switch to dark mode";
  button.setAttribute("aria-label",title);
  button.setAttribute("title",title);
  button.setAttribute("aria-pressed",String(dark));
}
applyTheme(readTheme());
button?.addEventListener("click",()=>{
  const next=document.documentElement.dataset.dofTheme==="dark"?"light":"dark";
  try{window.localStorage.setItem(KEY,next)}catch{}
  applyTheme(next);
});
window.addEventListener("storage",event=>{
  if(event.key===KEY)applyTheme(readTheme());
});
