/*
 * CI-only browser check. Added to the temporary Pages build and removed
 * before publishing. Tests the ACTUAL DOM backdrop, not a copied wallpaper.
 */
(async()=>{
  const checks=[];
  const assert=(condition,message)=>{
    checks.push(message);
    if(!condition)throw Error(message);
  };
  const tick=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    await tick(950);
    const shell=document.getElementById("workspace-shell");
    const sidebar=document.getElementById("workspace-sidebar");
    assert(!!shell&&!!sidebar,"genuine /app markup exists");
    assert(shell.classList.contains("liquid-glass-preview"),"Oracle material initialized");
    assert(!sidebar.querySelector("canvas"),"no canvas in sidebar");
    assert(!document.querySelector(".glass-wallpaper"),"no embedded wallpaper or background copy");
    const filter=document.getElementById("oracle-glass-native-backdrop");
    assert(!!filter,"real backdrop SVG filter exists");
    assert(filter.querySelectorAll("feDisplacementMap").length===2,"inner/outer displacement operators");
    const blurs=[...filter.querySelectorAll("feGaussianBlur")];
    assert(blurs.length===2,"AIR-guided near/far blur sampling");
    assert(blurs.every(b=>b.getAttribute("in")==="SourceGraphic"),
      "both blur levels operate on ACTUAL DOM backdrop SourceGraphic");
    assert(Number(blurs[0].getAttribute("stdDeviation"))>
      Number(blurs[1].getAttribute("stdDeviation")),
      "blur decreases near the signed-distance edge");
    const maps=[...filter.querySelectorAll("feImage")];
    assert(maps.length===3,"two refraction vector fields and one blur-distribution field");
    const blend=filter.querySelector('feColorMatrix[result="faceMaterial"]');
    const face=blend?.getAttribute("values")?.trim().split(/\s+/).map(Number);
    assert(!!face&&face.length===20,"four-by-five public color transform");
    assert(face.join(",")===[
      1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0
    ].join(","),"private diagnostic darkening matrix must not be applied to public sidebar");
    const nearI=filter.querySelector('feColorMatrix[result="innerNearCoverage"]');
    const nearO=filter.querySelector('feColorMatrix[result="outerNearCoverage"]');
    assert(!!nearI&&!!nearO,"native inner/outer blur-distance masks are independent");
    assert(!!filter.querySelector('feComposite[result="innerBlurred"]') &&
      !!filter.querySelector('feComposite[result="outerBlurred"]'),
      "both refraction paths use their own SDF-adjusted blurred backdrop");
    assert(filter.querySelector('feDisplacementMap[result="innerShift"]')
      ?.getAttribute("in")==="innerBlurred","inner path samples its own LOD");
    assert(filter.querySelector('feDisplacementMap[result="outerShift"]')
      ?.getAttribute("in")==="outerBlurred","outer path samples its own LOD");
    const radius=parseFloat(shell.style.getPropertyValue("--oracle-input-radius"));
    const width=sidebar.getBoundingClientRect().width;
    assert(radius>=2&&radius<=4,"public-style radius within retained range");
    if(width>200)assert(Math.abs(radius-4)<1e-6,"expanded geometry gives regular radius4");
    await tick(600);
    const hasNative=shell.classList.contains("has-oracle-backdrop");
    if(CSS.supports("backdrop-filter",'url("#oracle-glass-native-backdrop")')){
      assert(hasNative,"Chrome activated the backdrop displacement path");
      for(const m of maps){
        const href=m.getAttribute("href");
        assert(!!href&&href.startsWith("data:image/png;base64,"),
          "SDF/blur geometry-only PNG field encoded");
      }
      const property=getComputedStyle(sidebar).backdropFilter ||
        getComputedStyle(sidebar).webkitBackdropFilter || "";
      assert(property.includes("oracle-glass-native-backdrop"),
        "computed backdrop-filter points to SVG actual backdrop");
    }else{
      assert(!hasNative,"unsupported advanced filter retains CSS blur");
      assert(getComputedStyle(sidebar).backdropFilter.includes("blur"),
        "unsupported browser retains simple blur");
    }
    const scene=getComputedStyle(document.body,"::before");
    const overlay=getComputedStyle(document.body,"::after");
    assert(scene.backgroundImage!=="none"&&overlay.backgroundImage!=="none",
      "one physical page-level wallpaper is behind both content and sidebar");
    const shellColor=getComputedStyle(shell).backgroundColor;
    assert(shellColor==="rgba(0, 0, 0, 0)"||shellColor==="transparent",
      "glass host shell must not introduce an opaque dark background");
    assert(getComputedStyle(sidebar).isolation==="auto",
      "sidebar must not isolate itself from the real page backdrop");
    assert(getComputedStyle(shell).isolation==="auto",
      "workspace root must not isolate the backdrop away from page artwork");
    const active=sidebar.querySelector('.nav-stack:not([hidden]) .nav-link.active');
    assert(!!active,"real active nav item exists");
    const capsule=sidebar.querySelector(".glass-selection");
    assert(!!capsule,"selection indicator follows actual rows");
    const capsuleWidth=parseFloat(capsule.style.getPropertyValue("--glass-selection-width"));
    assert(capsuleWidth>30&&capsuleWidth<250,"capsule stays within nav row width");
    const scene=document.querySelector(".glass-scene-toggle");
    assert(!!scene,"scene switch is present");
    scene.click();await tick(100);
    assert(shell.classList.contains("glass-scene-neutral"),"page background scene switched");
    assert(scene.textContent.includes("Monochrome"),"scene control label updates");
    assert(!document.querySelector(".glass-lens-toggle"),"invented lensing switch removed");
    const w=innerWidth;
    if(w>=1280){
      const toggle=document.getElementById("sidebar-toggle");
      assert(!toggle.disabled,"desktop toggle remains enabled");
      toggle.click();await tick(900);
      assert(shell.classList.contains("is-collapsed"),"desktop collapse works");
      assert(sidebar.getBoundingClientRect().width>=72&&
        sidebar.getBoundingClientRect().width<=77,"74px real rail");
      toggle.click();await tick(900);
      assert(!shell.classList.contains("is-collapsed"),"desktop expand works");
    }else if(w>760){
      assert(shell.classList.contains("is-collapsed"),"tablet forces icon rail");
      assert(document.getElementById("sidebar-toggle").disabled,"tablet expand disabled");
    }else{
      const menu=document.getElementById("mobile-nav-toggle");
      menu.click();await tick(260);
      assert(shell.classList.contains("is-mobile-open"),"mobile drawer opens");
      menu.click();await tick(260);
      assert(!shell.classList.contains("is-mobile-open"),"mobile drawer closes");
    }
    assert(!document.querySelector('script[src="/app/assets/dashboard.js"]'),
      "preview never loads auth dashboard script");
    document.documentElement.setAttribute("data-glass-browser-smoke","pass");
    document.documentElement.setAttribute("data-glass-browser-info",
      JSON.stringify({width:w,filterSupported:hasNative,checks:checks.length,radius}));
  }catch(error){
    document.documentElement.setAttribute("data-glass-browser-smoke","fail");
    document.documentElement.setAttribute("data-glass-browser-info",
      String(error&&error.stack||error));
  }
})();