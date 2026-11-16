import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {COLLECTIONS_STRIP_FRACTION,COLLECTIONS_STRIP_BRIGHTNESS,
  collectionsStripGeometry,wallpaperCover}
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
test("Collections strip is 20% darker by an explicit neutral, strip-only browser gain",()=>{
  assert.equal(COLLECTIONS_STRIP_BRIGHTNESS,.80);
  const js=read("sites/_apex/app/assets/collections-webgpu-strip.js");
  const wgsl=read("sites/_apex/app/assets/collections-webgpu-strip.wgsl");
  assert.ok(js.includes("userX,userHover,pressed,COLLECTIONS_STRIP_BRIGHTNESS"));
  assert.ok(js.includes("browserBrightness:COLLECTIONS_STRIP_BRIGHTNESS"));
  assert.ok(wgsl.includes("let darker=color*state.pointer.w"));
  assert.ok(wgsl.includes("return vec4<f32>(darker*coverage,coverage)"));
  assert.ok(wgsl.includes("NOT an observed Apple material parameter"));
  for(const intensity of [0,0.04,0.25,0.5,1]){
    const darkened=intensity*COLLECTIONS_STRIP_BRIGHTNESS;
    assert.ok(darkened<=intensity);
    assert.equal(darkened,intensity*.8);
  }
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
