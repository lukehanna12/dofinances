/* Keep real /login navigation and working modifier/new-tab clicks.
 * This browser-authored dissolution is deliberately NOT labeled a verified
 * macOS Notification Center animation; the Oracle's evidence corpus covers
 * the glass material but not Notification Center dismissal dynamics.
 */
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";
const login=document.querySelector('.cta6-bottom-action a[href="/login"]');
let leaving=false;
login?.addEventListener("click",event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
      event.shiftKey||event.altKey||leaving)return;
  event.preventDefault();
  leaving=true;
  const target=login.href;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    window.location.assign(target);return;
  }
  // The login mark is precisely positioned from the real card after mount.
  // Head toward its expected mid-gap now; the named cross-document View
  // Transition resolves any remaining pixel delta against the measured card.
  const wordmark=document.getElementById("dashboard-title");
  if(wordmark){
    const bounds=wordmark.getBoundingClientRect();
    const navBottom=document.getElementById("global-menu")?.getBoundingClientRect().bottom??44;
    const expectedCardTop=Math.max(navBottom+60,(window.innerHeight-650)/2);
    const centerY=(navBottom+expectedCardTop)/2;
    wordmark.style.setProperty("--doof-exit-y",
      (centerY-(bounds.top+bounds.height/2))+"px");
  }
  document.body.dataset.publicRoute="leaving";
  window.dispatchEvent(new CustomEvent("dofinances:home-dismiss",{
    detail:{durationMs:DISMISS_MS}
  }));
  // The original href remains semantic and /login is a distinct real route.
  // The background on /login is the same local AVIF asset as the homepage.
  window.setTimeout(()=>window.location.assign(target),DISMISS_MS+45);
});
window.addEventListener("pageshow",event=>{
  if(!event.persisted)return;
  leaving=false;delete document.body.dataset.publicRoute;
});
