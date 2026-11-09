/*
 * Browser-only smoke injected into the ephemeral Pages build, then stripped
 * BEFORE Cloudflare deployment. No screenshots or external resources.
 */
(async()=>{
  const checks=[];
  function assert(ok,message){checks.push({message,ok:!!ok});if(!ok)throw Error(message);}
  async function frame(){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
  async function tick(ms=230){await new Promise(resolve=>setTimeout(resolve,ms));await frame();}
  try {
    await tick(500);
    const shell=document.getElementById("workspace-shell");
    const sidebar=document.getElementById("workspace-sidebar");
    const wallpaper=document.querySelector(".glass-wallpaper");
    const optical=document.querySelector(".glass-optics");
    assert(!!shell&&!!sidebar,"actual /app markup exists");
    assert(!!wallpaper&&wallpaper.width>1&&wallpaper.height>1,"full viewport Canvas2D wallpaper");
    assert(!!optical,"glass optical canvas exists");
    assert(shell.classList.contains("has-glass-wallpaper"),"wallpaper displayed");
    const wp=wallpaper.getContext("2d");
    assert(!!wp,"scene source is readable");
    const ix=Math.max(0,Math.floor(wallpaper.width*.3));
    const iy=Math.max(0,Math.floor(wallpaper.height*.3));
    const pixelBefore=[...wp.getImageData(ix,iy,1,1).data];
    assert(pixelBefore[3]===255,"background is opaque");
    const gl=optical.getContext("webgl2");
    if(gl){
      await tick(450);
      assert(shell.classList.contains("has-refractive-glass"),
        "WebGL2 context must actually render refractive material");
      assert(gl.getError()===gl.NO_ERROR,"WebGL2 draws without errors");
    } else {
      assert(!shell.classList.contains("has-refractive-glass"),
        "WebGL unavailable: CSS fallback stays active");
    }
    const first=sidebar.querySelector(".nav-stack:not([hidden]) .nav-link.active");
    assert(!!first,"real active navigation item");
    const capsule=sidebar.querySelector(".glass-selection");
    assert(!!capsule,"morphing selection capsule exists");
    const width=parseFloat(capsule.style.getPropertyValue("--glass-selection-width"));
    assert(width>=30 && width<=260,"selection highlight fits the actual nav row");
    const scene=document.querySelector(".glass-scene-toggle:not(.glass-lens-toggle)");
    assert(!!scene,"backdrop comparison control exists");
    scene.click();await tick(160);
    assert(scene.textContent.includes("Monochrome"),"backdrop switched");
    const pixelAfter=[...wp.getImageData(ix,iy,1,1).data];
    assert(pixelAfter.some((v,i)=>v!==pixelBefore[i]),"actual shared scene pixels updated");
    if(gl){
      const lens=document.querySelector(".glass-lens-toggle");
      assert(!!lens,"lens comparison control exists");
      lens.click();await tick(80);
      assert(lens.getAttribute("aria-pressed")==="false","lensing can be disabled");
      lens.click();await tick(80);
      assert(lens.getAttribute("aria-pressed")==="true","lensing can be restored");
    }
    const w=innerWidth;
    if(w>=1280){
      const toggle=document.getElementById("sidebar-toggle");
      assert(!toggle.disabled,"wide sidebar control enabled");
      toggle.click();await tick(260);
      assert(shell.classList.contains("is-collapsed"),"real wide sidebar collapses");
      const narrow=sidebar.getBoundingClientRect().width;
      assert(narrow>=72&&narrow<=77,"collapsed rail fits in 74px");
      toggle.click();await tick(260);
      assert(!shell.classList.contains("is-collapsed"),"wide sidebar re-expands");
    } else if(w>760){
      assert(shell.classList.contains("is-collapsed"),"tablet forces icon rail");
      assert(document.getElementById("sidebar-toggle").disabled,"tablet expansion disabled");
    } else {
      const menu=document.getElementById("mobile-nav-toggle");
      menu.click();await tick(220);
      assert(shell.classList.contains("is-mobile-open"),"mobile drawer opens");
      menu.click();await tick(220);
      assert(!shell.classList.contains("is-mobile-open"),"mobile drawer closes");
    }
    const forbidden=document.querySelector('script[src="/app/assets/dashboard.js"]');
    assert(!forbidden,"authenticated dashboard script excluded from preview");
    document.documentElement.setAttribute("data-glass-browser-smoke","pass");
    document.documentElement.setAttribute("data-glass-browser-info",
      JSON.stringify({width:w,gpu:!!gl,checks:checks.length}));
  }catch(e){
    document.documentElement.setAttribute("data-glass-browser-smoke","fail");
    document.documentElement.setAttribute("data-glass-browser-info",
      String(e?.stack||e));
  }
})();
