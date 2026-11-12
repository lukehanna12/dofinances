/* Deterministic WebGPU architecture tests, not screenshot acceptance.
 * Node executes only pure layout/scalar helpers. Browser CI must separately
 * confirm that WGSL compiles and the actual GPU pipeline reaches READY.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.document={
  getElementById:()=>null,
  createElement:()=>({})
};
globalThis.window={};
const {makeTileFloatData,coverUVScale} = await import("./dashboard-gpu-renderer.js");
const {nativePublicBlurRadius,observedBlurWord} =
  await import("./sidebar-glass-oracle.js");
test("center-cover backdrop UV respects physical viewport and image aspect",()=>{
  const landscape=coverUVScale(1440,900,1920,1080);
  assert.ok(Math.abs(landscape[0]-.9)<1e-6);
  assert.equal(landscape[1],1);
  const portrait=coverUVScale(390,844,1920,1080);
  assert.ok(portrait[0]<1);
  assert.equal(portrait[1],1);
});
test("one occupied tile maps CSS geometry to physical pixels without screenshot",()=>{
  globalThis.getComputedStyle=()=>({
    borderTopLeftRadius:"12px",
    getPropertyValue:()=>".12s"
  });
  const tile={offsetWidth:75,offsetHeight:75,
    getBoundingClientRect:()=>({left:100,top:250,width:75,height:75})};
  const data=makeTileFloatData([tile],2);
  assert.equal(data.length,8);
  assert.deepEqual(Array.from(data.slice(0,6)),[200,500,150,150,24,Math.fround(.12)]);
  const radius=nativePublicBlurRadius("clear",75,75);
  assert.equal(data[6],observedBlurWord(radius,1,.25));
});
test("real-mip architecture explicit compute, LOD and textureLoad",()=>{
  const path=x=>new URL(x,import.meta.url);
  const bg=fs.readFileSync(path("./dashboard-gpu-scene.wgsl"),"utf8");
  const mip=fs.readFileSync(path("./dashboard-gpu-mipmap.wgsl"),"utf8");
  const glass=fs.readFileSync(path("./dashboard-gpu-glass.wgsl"),"utf8");
  const js=fs.readFileSync(path("./dashboard-gpu-renderer.js"),"utf8");
  assert.match(bg,/textureSampleLevel\(image/);
  assert.match(mip,/@compute @workgroup_size\(8,8,1\)/);
  assert.match(mip,/textureStore\(dst/);
  assert.match(mip,/rgba16float,write/);
  assert.match(glass,/fn mode5SDF/);
  assert.match(glass,/fn refractionEnvelope/);
  assert.match(glass,/fn glassLOD/);
  assert.match(glass,/fn mipSample/);
  assert.match(glass,/fn levelBilinear/);
  assert.match(glass,/textureLoad\(backdrop/);
  assert.doesNotMatch(glass,/feGaussianBlur|textureSampleLevel\(backdrop/);
  assert.match(js,/mipLevelCount:/);
  assert.match(js,/copyExternalImageToTexture/);
  assert.match(js,/device\.createComputePipeline/);
  assert.match(js,/device\.queue\.onSubmittedWorkDone/);
  assert.match(js,/scenePending=false/);
  assert.match(js,/if\(scenePending\)buildScene\(\)/);
  assert.doesNotMatch(js,/getImageData\(|drawImage\(|html2canvas/);
  assert.doesNotMatch(mip,/feGaussianBlur\\s*\\(/);
});
test("oracle-provenance remains finite, native and browser assumptions labeled",()=>{
  const js=fs.readFileSync(new URL("./dashboard-gpu-renderer.js",import.meta.url),"utf8");
  const s=fs.readFileSync(new URL("./dashboard-gpu-glass.wgsl",import.meta.url),"utf8");
  const m=fs.readFileSync(new URL("./dashboard-gpu-mipmap.wgsl",import.meta.url),"utf8");
  assert.match(js,/GAP PUBLIC-SCENE/);
  assert.match(s,/GAP PUBLIC-CLEAR-MATERIAL/);
  assert.match(s,/GAP PUBLIC-CLEAR-COLOR/);
  assert.match(s,/GAP NATIVE-UV-TO-CSS/);
  assert.match(m,/GAP R-MIP-KERNEL/);
});
