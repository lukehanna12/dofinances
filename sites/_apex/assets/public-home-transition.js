/* Persistent public shell. Route ownership:
 * Shell: wallpaper/WebGPU tiles, navigation, doof mark, buttons and their
 * reversible 440ms transitions.
 * Route: its own mounted UI, entrance and complete reversed exit animation.
 * Adding a route needs one registry entry; no copy of the shell.
 */
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";
const registry=new Map([["/login",{manifest:"/assets/public-login-manifest.json",mount:"mountLogin"}]]);
const outlet=document.getElementById("public-route-content");
const routeMount=document.getElementById("public-route-stage");
const signIn=document.querySelector('.cta6-bottom-action a[href="/login"]');
const body=document.body,reduced=matchMedia("(prefers-reduced-motion: reduce)");
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const routePath=()=>location.pathname.replace(/\/+$/,"")||"/";
let current=null,busy=false,fromHome=false,state="home",revision=0,pendingNavigate=false;
function positionCompactLogo(){
  const logo=document.getElementById("dashboard-title");
  if(!logo)return;
  const previous=body.dataset.publicRoute;
  const direct=body.dataset.directLogin==="true";
  if(previous==="leaving")delete body.dataset.publicRoute;
  if(direct)delete body.dataset.directLogin;
  const rect=logo.getBoundingClientRect();
  const parent=logo.closest(".cta6-center");
  const parentTransform=parent?getComputedStyle(parent).transform:"none";
  const introDy=parentTransform==="none"?0:new DOMMatrixReadOnly(parentTransform).m42;
  const navBottom=document.getElementById("global-menu")?.getBoundingClientRect().bottom??44;
  // Measure against the intro animation's resting geometry so the compact
  // target remains exact even if clicked while the 16px entrance is active.
  logo.style.setProperty("--doof-exit-y",
    (navBottom+46-(rect.top+rect.height/2-introDy))+"px");
  if(previous)body.dataset.publicRoute=previous;
  if(direct)body.dataset.directLogin="true";
  body.dataset.publicReady="true";
}
function activateCompact({immediate=false}={}){
  positionCompactLogo();
  body.dataset.publicRoute="leaving";
  dispatchEvent(new CustomEvent("dofinances:home-dismiss",{
    detail:{durationMs:immediate||reduced.matches?0:DISMISS_MS}
  }));
}
function restoreHome(){
  delete body.dataset.directLogin;
  body.dataset.publicRoute="returning";
  dispatchEvent(new CustomEvent("dofinances:home-restore",{
    detail:{durationMs:reduced.matches?0:DISMISS_MS}
  }));
  const token=++revision;
  setTimeout(()=>{
    if(token===revision&&state==="home")delete body.dataset.publicRoute;
  },reduced.matches?0:DISMISS_MS+60);
}
const cssPromises=new Map();
function loadCss(url){
  if(cssPromises.has(url))return cssPromises.get(url);
  const pending=new Promise((resolve,reject)=>{
    const link=document.createElement("link");
    link.rel="stylesheet";link.href=url;link.dataset.publicRouteCss=url;
    link.onload=resolve;link.onerror=()=>reject(Error("Route stylesheet failed to load"));
    document.head.append(link);
  });
  cssPromises.set(url,pending);return pending;
}
const moduleCache=new Map();
async function loadModule(path){
  if(moduleCache.has(path))return moduleCache.get(path);
  const pending=(async()=>{
    const def=registry.get(path);
    if(!def)throw Error("Unregistered route");
    const response=await fetch(def.manifest,{cache:"no-store"});
    if(!response.ok)throw Error("Missing public route manifest");
    const manifest=await response.json();
    if(typeof manifest.js!=="string"||!/^\/assets\/[\w./-]+\.js$/.test(manifest.js)||
       !Array.isArray(manifest.css)||manifest.css.some(x=>typeof x!=="string"||!/^\/assets\/[\w./-]+\.css$/.test(x)))
      throw Error("Invalid public route manifest");
    await Promise.all(manifest.css.map(loadCss));
    const module=await import(manifest.js);
    if(typeof module[def.mount]!=="function")throw Error("Route has no mount function");
    return module[def.mount];
  })();
  moduleCache.set(path,pending);
  pending.catch(()=>moduleCache.delete(path));
  return pending;
}
async function openLogin({push=false,direct=false}={}){
  if(busy||current)return;
  busy=true;state="entering";
  const token=++revision;
  activateCompact({immediate:direct});
  const loaded=loadModule("/login");
  const settle=delay(direct||reduced.matches?0:DISMISS_MS+45);
  try{
    const [mountLogin]=await Promise.all([loaded,settle]);
    if(token!==revision)return;
    if(push){
      history.pushState({dofinancesPublic:true},"","/login");
      fromHome=true;
    }else{
      fromHome=!!history.state?.dofinancesPublic;
    }
    outlet.hidden=false;
    current=mountLogin(routeMount,{onBack:()=>closeLogin({navigate:true}),
      onExitComplete:finishClose});
    state="login";
    document.title="Sign in · Dofinances";
  }catch(error){
    await settle;
    if(token!==revision)return;
    console.error("The public sign-in route did not load",error);
    if(push)history.pushState({dofinancesPublic:true},"","/login");
    outlet.hidden=false;
    const note=document.createElement("p");
    note.className="public-route-error";note.setAttribute("role","alert");
    note.textContent="The sign-in card could not load. Please reload and try again.";
    routeMount.replaceChildren(note);
    state="error";
  }finally{busy=false;}
}
function closeLogin({navigate=false}={}){
  if(!current||state==="exiting")return;
  pendingNavigate=navigate;
  state="exiting";
  // Resume the shell's track clock on this same arrow-click turn. The tiles
  // remain dissolved until the route-owned 600ms card exit completes.
  dispatchEvent(new CustomEvent("dofinances:home-track-resume"));
  current.exit(); // /login owns the exact reverse slide-and-fade.
}
function finishClose(){
  if(!current||state!=="exiting")return;
  current.unmount();
  current=null;routeMount.replaceChildren();outlet.hidden=true;
  state="home";document.title="DoFinances";
  if(pendingNavigate){
    if(fromHome){fromHome=false;history.back();}
    else history.replaceState({dofinancesPublic:true},"","/");
  }
  pendingNavigate=false;
  restoreHome();
}
signIn?.addEventListener("click",event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
    event.shiftKey||event.altKey||busy||current)return;
  event.preventDefault();
  void openLogin({push:true});
});
addEventListener("popstate",()=>{
  const path=routePath();
  if(path==="/login"){
    if(!current&&!busy)void openLogin();
  }else if(path==="/"){
    if(current)closeLogin();
    else if(state==="error"){
      routeMount.replaceChildren();outlet.hidden=true;state="home";restoreHome();
    }
  }
});
addEventListener("pageshow",event=>{
  if(event.persisted&&routePath()==="/login"&&!current&&!busy)
    void openLogin({direct:true});
});
addEventListener("resize",()=>{
  if(body.dataset.publicRoute==="leaving")positionCompactLogo();
});
Object.defineProperty(window,"__dofPublicRouter",{
  get:()=>Object.freeze({state,route:routePath(),persistentShell:true,
    hasCard:!!current,registeredRoutes:[...registry.keys()]})
});
if(routePath()==="/login"){
  body.dataset.publicRoute="leaving";
  body.dataset.directLogin="true";
  void openLogin({direct:true});
}
