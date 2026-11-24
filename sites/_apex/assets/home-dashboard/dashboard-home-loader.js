/* Production-only loader: Home artwork is isolated from authentication and
   other workspace screens. Navigation remains under workspace-nav.js. */
let dashboardLoaded=false;
function homeVisible(){
  const home=document.querySelector('.view.dashboard-home[data-view="dashboard"]');
  return !!home&&!home.hidden;
}
function activateDashboard(){
  if(dashboardLoaded||!homeVisible())return;
  dashboardLoaded=true;
  void import("./dashboard-gpu-renderer.js").catch(async error=>{
    console.warn("Dashboard WebGPU unavailable; retaining browser fallback",error);
    try{await import("./dashboard-optics.js");}
    catch(fallbackError){console.warn("Dashboard fallback unavailable",fallbackError);}
    finally{const root=document.getElementById("cta6-mosaic");if(root)root.dataset.glassStartup="fallback";}
  });
}
activateDashboard();
window.addEventListener("hashchange",()=>queueMicrotask(activateDashboard));
window.addEventListener("popstate",()=>queueMicrotask(activateDashboard));
