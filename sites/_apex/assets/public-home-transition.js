/* Persistent public shell. Route ownership:
 * Shell: wallpaper/WebGPU tiles, navigation, doof mark, buttons and their
 * reversible 440ms transitions.
 * Route: its own mounted UI, entrance and complete reversed exit animation.
 * Adding a route needs one registry entry; no copy of the shell.
 */
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";
const registry=new Map([
  ["/login",{manifest:"/assets/public-login-manifest.json",mount:"mountLogin"}],
  ["/projects",{module:"/assets/public-projects-entry.js",
    css:["/assets/public-projects.css"],mount:"mountProjects"}]
]);
const outlet=document.getElementById("public-route-content");
const routeMount=document.getElementById("public-route-stage");
const signIn=document.querySelector('.cta6-bottom-action a[href="/login"]');
const body=document.body,reduced=matchMedia("(prefers-reduced-motion: reduce)");
// The original full WebGPU refraction (same exact shader/material as the
// homepage squares) is the chosen default. Do not silently substitute a
// CSS-backdrop likeness or a partial shader when the user prefers this look.
// The compositor-synchronized hybrid remains an explicit, reversible option
// at /login?auth-glass=compositor while pursuing full-look scroll sync.
body.dataset.authGlassMode=new URLSearchParams(location.search).get("auth-glass")==="compositor"
  ?"compositor":"webgpu";
// Full original WGSL glass remains the only WebGPU material. Default to
// viewport-fixed presentation so a previously completed refracted-photo
// frame cannot be dragged across the wallpaper during native fast-scroll or
// elastic overscroll. The form and native scroll mechanics remain untouched.
// Explicit ?auth-scroll=native restores the former scroll-attached canvas.
body.dataset.authScrollMode=new URLSearchParams(location.search).get("auth-scroll")==="native"
  ?"native":"fixed";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const routePath=()=>location.pathname.replace(/\/+$/,"")||"/";
let current=null,busy=false,fromHome=false,state="home",revision=0,pendingNavigate=false;
let activeRoute=null,reopenPath=null;
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
    // Login uses Vite's versioned JS/CSS manifest. Projects is an isolated,
    // static, route-owned ESM module. Both obey the same mount/exit contract.
    let module;
    if(def.module){
      await Promise.all((def.css||[]).map(loadCss));
      module=await import(def.module);
    }else{
      const response=await fetch(def.manifest,{cache:"no-store"});
      if(!response.ok)throw Error("Missing public route manifest");
      const manifest=await response.json();
      if(typeof manifest.js!=="string"||!/^\/assets\/[\w./-]+\.js$/.test(manifest.js)||
         !Array.isArray(manifest.css)||manifest.css.some(x=>typeof x!=="string"||!/^\/assets\/[\w./-]+\.css$/.test(x)))
        throw Error("Invalid public route manifest");
      await Promise.all(manifest.css.map(loadCss));
      module=await import(manifest.js);
    }
    if(typeof module[def.mount]!=="function")throw Error("Route has no mount function");
    return module[def.mount];
  })();
  moduleCache.set(path,pending);
  pending.catch(()=>moduleCache.delete(path));
  return pending;
}
async function openRoute(path,{push=false,direct=false}={}){
  if(!registry.has(path)||busy||current)return;
  busy=true;state="entering";
  const token=++revision;
  activateCompact({immediate:direct});
  const loaded=loadModule(path);
  const settle=delay(direct||reduced.matches?0:DISMISS_MS+45);
  try{
    const [mount]=await Promise.all([loaded,settle]);
    if(token!==revision)return;
    if(push){
      history.pushState({dofinancesPublic:true},"",path);
      fromHome=true;
    }else{
      fromHome=!!history.state?.dofinancesPublic;
    }
    outlet.hidden=false;
    routeMount.replaceChildren();
    document.title=(path==="/login"?"Sign in":"Projects")+" | DoFinances";
    current=mount(routeMount,{onBack:()=>closeRoute({navigate:true}),
      onExitComplete:finishClose});
    activeRoute=path;
    state=path.slice(1);
  }catch(error){
    await settle;
    if(token!==revision)return;
    console.error("The public route did not load",path,error);
    if(push)history.pushState({dofinancesPublic:true},"",path);
    outlet.hidden=false;
    const note=document.createElement("p");
    note.className="public-route-error";note.setAttribute("role","alert");
    note.textContent="This page could not load. Please reload and try again.";
    routeMount.replaceChildren(note);
    state="error";
  }finally{busy=false;}
}
function closeRoute({navigate=false}={}){
  if(!current||state==="exiting")return;
  pendingNavigate=navigate;
  state="exiting";
  // The public shell resumes its own tile clock on the back click.
  // The route alone owns its reverse card/button sequence.
  dispatchEvent(new CustomEvent("dofinances:home-track-resume"));
  current.exit();
}
function finishClose(){
  if(!current||state!=="exiting")return;
  current.unmount();
  // After Projects restores the original h1 to its homepage parent, refresh
  // the compact departure offset for the CURRENT viewport. That lets Home's
  // returning transition start at the same 90px anchor even after a resize.
  if(activeRoute==="/projects")positionCompactLogo();
  current=null;activeRoute=null;
  routeMount.replaceChildren();outlet.hidden=true;
  state="home";document.title="DoFinances";
  if(pendingNavigate){
    if(fromHome){fromHome=false;history.back();}
    else history.replaceState({dofinancesPublic:true},"","/");
  }
  pendingNavigate=false;
  if(reopenPath&&registry.has(reopenPath)){
    const next=reopenPath;reopenPath=null;
    void openRoute(next);
  }else{
    reopenPath=null;
    restoreHome();
  }
}
signIn?.addEventListener("click",event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
    event.shiftKey||event.altKey||busy||current)return;
  event.preventDefault();
  void openRoute("/login",{push:true});
});
for(const trigger of document.querySelectorAll('[data-public-target="/projects"]')){
  trigger.addEventListener("click",event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
       event.shiftKey||event.altKey||busy||current)return;
    event.preventDefault();
    void openRoute("/projects",{push:true});
  });
}
addEventListener("popstate",()=>{
  const path=routePath();
  if(registry.has(path)){
    if(current&&activeRoute!==path){
      reopenPath=path;closeRoute();
    }else if(current&&activeRoute===path&&state!=="exiting")current.syncLocation?.();
    else if(!current&&!busy)void openRoute(path);
  }else if(path==="/"){
    reopenPath=null;
    if(current)closeRoute();
    else if(state==="error"){
      routeMount.replaceChildren();outlet.hidden=true;state="home";restoreHome();
    }
  }
});
addEventListener("hashchange",()=>{
  if(activeRoute==="/projects"&&routePath()==="/projects"&&state==="projects")current?.syncLocation?.();
});
addEventListener("pageshow",event=>{
  const path=routePath();
  if(event.persisted&&registry.has(path)&&!current&&!busy)
    void openRoute(path,{direct:true});
});
addEventListener("resize",()=>{
  // The Projects logo is CSS-pinned to the 44px navigation bar after mount.
  // In particular, never measure an interpolating transform and rewrite
  // --doof-exit-y during either horizontal or vertical Projects resizes.
  // Sign-in and an unfinished homepage dismissal retain their old behavior.
  if(body.dataset.publicRoute==="leaving"&&
     !outlet.querySelector(".public-projects-root"))positionCompactLogo();
});
Object.defineProperty(window,"__dofPublicRouter",{
  get:()=>Object.freeze({state,route:routePath(),persistentShell:true,
    hasCard:!!current,activeRoute,registeredRoutes:[...registry.keys()]})
});
if(registry.has(routePath())){
  body.dataset.publicRoute="leaving";
  body.dataset.directLogin="true";
  void openRoute(routePath(),{direct:true});
}
