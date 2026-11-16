import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {COLLECTIONS_STRIP_FRACTION,collectionsStripGeometry,wallpaperCover}
 from "../sites/_apex/app/assets/collections-webgpu-strip.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Collections black-to-summary gap is measured, with precisely 43.75% occupied",()=>{
  assert.equal(COLLECTIONS_STRIP_FRACTION,7/16);
  for(const gap of [37.2,43.2,51.6,12,1.25,0]){
    const g=collectionsStripGeometry(44,44+202.65625+gap,202.65625);
    assert.ok(Math.abs(g.gap-gap)<1e-10);
    assert.ok(Math.abs(g.height-gap*.4375)<1e-10);
    assert.equal(g.top,202.65625);
  }
  assert.equal(collectionsStripGeometry(0,100,200).height,0);
  assert.throws(()=>collectionsStripGeometry(NaN,200,30),TypeError);
});
test("Temporary glass tuner defaults to the original undarkened Clear output",async()=>{
  const {DEFAULT_COLLECTIONS_GLASS_TUNING,normalizeCollectionsGlassTuning,
    collectionsGlassTuningUniforms,collectionsGlassTuningPreset}=await import(
    "../sites/_apex/app/assets/collections-glass-tuner.js");
  const s=normalizeCollectionsGlassTuning(DEFAULT_COLLECTIONS_GLASS_TUNING);
  assert.deepEqual(s,{brightness:100,contrast:100,tint:"#ffffff",tintStrength:0});
  const uniform=collectionsGlassTuningUniforms(s);
  assert.equal(uniform.length,8);
  assert.deepEqual(Array.from(uniform),[1,1,0,0,1,1,1,0]);
  const preset=JSON.parse(collectionsGlassTuningPreset(s));
  assert.equal(preset.brightnessPercent,100);
  assert.equal(preset.contrastPercent,100);
  assert.equal(preset.tintStrengthPercent,0);
  assert.equal(preset.tintHex,"#ffffff");
  const js=read("sites/_apex/app/assets/collections-webgpu-strip.js");
  const wgsl=read("sites/_apex/app/assets/collections-webgpu-strip.wgsl");
  assert.ok(!js.includes("COLLECTIONS_STRIP_BRIGHTNESS=.80"));
  assert.ok(!wgsl.includes("let darker=color*state.pointer.w"));
  assert.ok(js.includes("uniform=device.createBuffer({size:96"));
  assert.ok(js.includes("...collectionsGlassTuningUniforms(tuner.value)"));
  assert.ok(wgsl.includes("tuning:vec4<f32>"));
  assert.ok(wgsl.includes("tint:vec4<f32>"));
  assert.ok(wgsl.includes("let contrasted=clamp("));
  assert.ok(wgsl.includes("let brightened=clamp("));
  assert.ok(wgsl.includes("let adjusted=mix(brightened,state.tint.rgb,state.tuning.z)"));
  assert.ok(wgsl.includes("return vec4<f32>(adjusted*coverage,coverage)"));
});
test("Glass tuner exports precise brightness, contrast, tint and tint strength",async()=>{
  const {normalizeCollectionsGlassTuning,collectionsGlassTuningUniforms,
    collectionsGlassTuningPreset}=await import(
    "../sites/_apex/app/assets/collections-glass-tuner.js");
  const s=normalizeCollectionsGlassTuning({
    brightness:83.47,contrast:147.25,tint:"#39aBE4",tintStrength:27.63
  });
  assert.deepEqual(s,{brightness:83.47,contrast:147.25,tint:"#39abe4",tintStrength:27.63});
  const serialized=JSON.parse(collectionsGlassTuningPreset(s));
  assert.deepEqual(serialized.tintRGB,[57,171,228]);
  assert.equal(serialized.brightnessPercent,83.47);
  assert.equal(serialized.contrastPercent,147.25);
  assert.equal(serialized.tintStrengthPercent,27.63);
  assert.equal(serialized.order,"contrast -> brightness -> tint (browser sRGB)");
  const floats=collectionsGlassTuningUniforms(s);
  for(const [i,target] of [[0,.8347],[1,1.4725],[2,.2763],[4,57/255],[5,171/255],[6,228/255]])
    assert.ok(Math.abs(floats[i]-target)<1e-6);
  assert.deepEqual(normalizeCollectionsGlassTuning({
    brightness:-100,contrast:500,tint:"abc",tintStrength:120
  }),{brightness:0,contrast:300,tint:"#aabbcc",tintStrength:100});
  assert.deepEqual(normalizeCollectionsGlassTuning({
    brightness:"",contrast:"oops",tint:"not-a-color",tintStrength:Infinity
  }),{brightness:100,contrast:100,tint:"#ffffff",tintStrength:0});
});
test("Temporary panel is route-only, color-picker capable and copyable",()=>{
  const js=read("sites/_apex/app/assets/collections-glass-tuner.js");
  const host=read("sites/_apex/app/assets/collections-webgpu-strip.js");
  const css=read("sites/_apex/app/assets/collections.css");
  assert.ok(js.includes('data-cs-picker type="color"'));
  assert.ok(js.includes('data-cs-hex type="text"'));
  for(const component of ["r","g","b"])
    assert.ok(js.includes('data-cs-rgb="'+component+'"'));
  for(const component of ["brightness","contrast","tintStrength"]){
    assert.ok(js.includes('data-cs-range="'+component+'"'));
    assert.ok(js.includes('data-cs-number="'+component+'"'));
    assert.ok(js.includes('data-cs-output="'+component+'"'));
  }
  assert.ok(js.includes("sessionStorage"));
  assert.ok(js.includes('data-cs-copy'));
  assert.ok(js.includes('data-cs-reset'));
  assert.ok(js.includes("pointerdown"));
  assert.ok(host.includes("tuner.setVisible(active())"));
  assert.ok(host.includes("tuner.dispose()"));
  assert.ok(css.includes("#cs-glass-tuner.cs-glass-tuner"));
  assert.ok(css.includes("#cs-glass-tuner.cs-glass-tuner[hidden]"));
});
test("Underlying wallpaper cover crop uses viewport width and fixed image plane, not sidebar",()=>{
  const a=wallpaperCover(1280,298.65625,1600,900,.45);
  assert.ok(a.width>=1280&&a.height>=298.65625);
  assert.ok(Math.abs(a.left-(1280-a.width)/2)<1e-10);
  assert.ok(Math.abs(a.top-(298.65625-a.height)*.45)<1e-10);
  assert.deepEqual(wallpaperCover(1280,320,1280,320,.45),
    {left:0,top:0,width:1280,height:320});
  assert.throws(()=>wallpaperCover(0,100,100,100),TypeError);
});
test("Collections WebGPU strip is a non-layout-affecting shell overlay above the black canvas",()=>{
  const css=read("sites/_apex/app/assets/collections.css");
  const module=read("sites/_apex/app/assets/collections-webgpu-strip.js");
  const dashboard=read("sites/_apex/app/assets/dashboard.js");
  assert.ok(css.includes("#workspace-shell > #cs-top-webgpu-strip.cs-top-webgpu-strip{"));
  assert.ok(css.includes("top:var(--cs-strip-top,var(--workspace-banner-height));"));
  assert.ok(css.includes("position:absolute;"));
  assert.ok(css.includes("width:100%;"));
  assert.ok(css.includes("background:transparent;"));
  assert.ok(css.includes("z-index:2;"));
  assert.ok(module.includes("gap*COLLECTIONS_STRIP_FRACTION"));
  assert.ok(module.includes('doc.getElementById("cs-summary")'));
  assert.ok(module.includes("summary.getBoundingClientRect()"));
  assert.ok(module.includes("shell.getBoundingClientRect()"));
  assert.ok(!module.includes("sidebar.getBoundingClientRect()"));
  assert.ok(!module.includes("sidebar-resize"));
  assert.ok(dashboard.includes("initCollectionsWebGPUStrip();"));
});
test("The only sampled backdrop is the real Collections wallpaper; public Clear math is pinned",()=>{
  const m=read("sites/_apex/app/assets/collections-webgpu-strip.js");
  const wgsl=read("sites/_apex/app/assets/collections-webgpu-strip.wgsl");
  const mip=read("sites/_apex/app/assets/collections-webgpu-mipmap.wgsl");
  const original=read("sites/_apex/app/assets/collections-glass-public-clear.js");
  assert.ok(m.includes('workspaceWallpaperForRoute("colosseum/collections")'));
  assert.ok(m.includes('from "./collections-glass-public-clear.js"'));
  assert.ok(m.includes('from "./sidebar-glass-oracle.js"'));
  assert.ok(m.includes('decodeRGBA(doc,win,url)'));
  assert.ok(m.includes('device.queue.writeTexture({texture:photoTexture},photo.pixels'));
  assert.ok(m.includes('entryPoint:"copyBase"'));
  assert.ok(m.includes('entryPoint:"downsample"'));
  assert.ok(m.includes('format:"rgba16float"'));
  assert.ok(m.includes('mipKernel:"authored-2x2-rgba16float-browser-approximation"'));
  assert.ok(m.includes('new win.MutationObserver(sync)'));
  assert.ok(m.includes('win.addEventListener("scroll",onScroll'));
  assert.ok(!m.includes("canvas.toDataURL"));
  assert.ok(!m.includes("getDisplayMedia"));
  assert.ok(wgsl.includes("let signed=max(-y,y-h)"));
  assert.ok(wgsl.includes("let root=clamp(sqrt(max(0.0,(2.0-t)*t))"));
  assert.ok(wgsl.includes("normalY*inner"));
  assert.ok(wgsl.includes("clamp(0.5-signed/derivatives,0.0,1.0)"));
  assert.ok(wgsl.includes("the actual shader lanes are therefore [1,0,0,0]"));
  assert.ok(wgsl.includes("let mip=state.material.z"));
  assert.ok(wgsl.includes("let face=vec3<f32>(0.05)+(vec3<f32>(0.80)-vec3<f32>(0.05))*veiled"));
  assert.ok(wgsl.includes("let color=mix(face,vec3<f32>(1.0),0.05)"));
  assert.ok(wgsl.includes("executed native"));
  assert.ok(m.includes("projectThinRectClearInputs(width,geometry.height)"));
  assert.ok(wgsl.includes("textureSampleLevel(photo,samplerLinear"));
  assert.ok(wgsl.includes("vec3<f32>(19.0,20.0,21.0)/255.0"));
  assert.ok(wgsl.includes("let sampleY=state.viewport.x+y+state.viewport.y"));
  assert.ok(!wgsl.includes("let response=1.0+local*"));
  assert.ok(mip.includes("texture_storage_2d<rgba16float,write>"));
  assert.ok(mip.includes("fn copyBase("));
  assert.ok(mip.includes("fn downsample("));
  assert.ok(original.includes("CLEAR_OBSERVED_128_84"));
  assert.ok(!wgsl.includes("tintColor"));
  assert.ok(!wgsl.includes("shadowColor"));
});

test("Measured untinted public Clear material is not silently substituted with private diagnostic constants",async()=>{
  const {CLEAR_OBSERVED_128_84,projectPublicClearInputs}=await import(
    "../sites/_apex/app/assets/collections-glass-public-clear.js");
  assert.equal(CLEAR_OBSERVED_128_84.innerAmount,-60);
  assert.equal(CLEAR_OBSERVED_128_84.innerHeight,20);
  assert.equal(CLEAR_OBSERVED_128_84.outerAmount,0);
  assert.equal(CLEAR_OBSERVED_128_84.refractionOpacity,0);
  assert.deepEqual(CLEAR_OBSERVED_128_84.blurOpacity,[1,1,1,1,1]);
  assert.deepEqual(CLEAR_OBSERVED_128_84.blurDistance,[0,0,0,0,0]);
  // Exact CPU P-to-S blur-alpha transformation: [a0,a0-a1,a1-a2,a2-a3].
  const a=CLEAR_OBSERVED_128_84.blurOpacity;
  assert.deepEqual([a[0],a[0]-a[1],a[1]-a[2],a[2]-a[3]],[1,0,0,0]);
  assert.equal(CLEAR_OBSERVED_128_84.faceWhite,.8);
  assert.equal(CLEAR_OBSERVED_128_84.faceBlack,.05);
  assert.equal(CLEAR_OBSERVED_128_84.faceFillWhiteAlpha,.05);
  const projected=projectPublicClearInputs(1185,18.89453125);
  assert.ok(Math.abs(projected.amount-Math.fround(-.8*18.89453125))<1e-5);
  assert.ok(Math.abs(projected.height-Math.fround(.25*18.89453125))<1e-5);
  assert.equal(projected.blurRadius,5);
  assert.equal(projected.word,2);
  const shader=read("sites/_apex/app/assets/collections-webgpu-strip.wgsl");
  assert.ok(shader.includes("The observed Clear outer amount and refraction mix opacity are zero."));
  assert.ok(!shader.includes("outerAmount=0.2*"));
  assert.ok(!shader.includes("thresholdMix("));
  assert.ok(!shader.includes("rim*0.28"));
});

test("Native 25F80/M2 straight Clear rectangle, not unrelated rounded geometry, drives the strip",async()=>{
  const {projectThinRectClearInputs,projectPublicClearInputs}=await import(
    "../sites/_apex/app/assets/collections-glass-public-clear.js");
  // New independent native public .rect CAFilter observations: 8 derivation
  // and 3 heldout height/width cases, two reproducible Mac processes each.
  // On native 2x source bounds: CAFilter amount=-height, height=.36*height,
  // blurRadius=5 at these native resolved heights, white face-fill input.
  const observed=[
    [700,16,-16,5.76],[700,19,-19,6.84],[700,23,-23,8.28],
    [320,17,-17,6.12],[700,20,-20,7.2],[820,22,-22,7.92]
  ];
  for(const [w,h,amount,refractionHeight] of observed){
    const projected=projectThinRectClearInputs(w,h);
    assert.equal(projected.amount,Math.fround(amount));
    assert.equal(projected.height,Math.fround(refractionHeight));
    assert.equal(projected.blurRadius,5);
    assert.equal(projected.word,2); // Browser projection, not bound GPU word
    assert.equal(projected.source,"finite-thin-rect-SwiftUI-Clear-browser-height-projection");
  }
  const original=projectPublicClearInputs(700,19);
  const straight=projectThinRectClearInputs(700,19);
  assert.notEqual(straight.amount,original.amount);
  assert.notEqual(straight.height,original.height);
  assert.equal(straight.amount,-19);
  assert.equal(straight.height,Math.fround(6.84));
  assert.throws(()=>projectThinRectClearInputs(NaN,20),RangeError);
});
