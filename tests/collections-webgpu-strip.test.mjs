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
  assert.ok(m.includes('device.queue.writeTexture({texture},photo.pixels'));
  assert.ok(m.includes('new win.MutationObserver(sync)'));
  assert.ok(m.includes('win.addEventListener("scroll",onScroll'));
  assert.ok(!m.includes("canvas.toDataURL"));
  assert.ok(!m.includes("getDisplayMedia"));
  assert.ok(wgsl.includes("let distance=-min(y,h-y)"));
  assert.ok(wgsl.includes("let reduction=clamp(sqrt(max(0.0,(2.0-t)*t))"));
  assert.ok(wgsl.includes("textureSampleLevel(photo,samplerLinear"));
  assert.ok(wgsl.includes("vec3<f32>(19.0,20.0,21.0)/255.0"));
  assert.ok(wgsl.includes("let sampleY=state.viewport.x+y+state.viewport.y"));
  assert.ok(wgsl.includes("let response=1.0+local*"));
  assert.ok(mip.includes("texture_storage_2d<rgba8unorm,write>"));
  assert.ok(original.includes("CLEAR_OBSERVED_128_84"));
  assert.ok(!wgsl.includes("tintColor"));
  assert.ok(!wgsl.includes("shadowColor"));
});
