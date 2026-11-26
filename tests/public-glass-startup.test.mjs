import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {glassEntrance} from "../sites/_apex/assets/home-dashboard/dashboard-glass-model.js";
const asset=name=>readFileSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url),"utf8");

test("shared entry uses the same stagger, smoothstep and scale as WGSL",()=>{
 const delays=[0,.03,.15,.45];
 for(const delay of delays){
  assert.deepEqual(glassEntrance(0,delay),{alpha:0,scale:.85});
  const mid=glassEntrance(delay+.2,delay);
  assert.ok(Math.abs(mid.alpha-.5)<1e-10);
  assert.ok(Math.abs(mid.scale-.925)<1e-10);
  const end=glassEntrance(delay+.41,delay);
  assert.deepEqual(end,{alpha:1,scale:1});
 }
 const shader=asset("dashboard-gpu-glass.wgsl");
 assert.match(shader,/let progress=clamp\(\(state\.viewport\.z-tile\.properties\.y\)\/0\.4,0\.0,1\.0\)/);
 assert.match(shader,/return t\*t\*\(3\.0-2\.0\*t\)/);
 assert.match(shader,/0\.85\+0\.15\*a/);
 const renderer=asset("dashboard-gpu-renderer.js");
 assert.match(renderer,/glassEntrance\(uniform\[2\],tileData\[p\+5\]\)/);
 assert.match(renderer,/glyphAlpha\*intro\.alpha/);
 assert.match(renderer,/shrink\.x\*intro\.scale/);
 assert.ok(renderer.indexOf("await device.queue.onSubmittedWorkDone()")<renderer.indexOf("introStart=performance.now()"));
 assert.match(renderer,/await iconsReady/);
});
test("startup defers unused GPU resources without lowering quality",()=>{
 const renderer=asset("dashboard-gpu-renderer.js");
 assert.match(renderer,/Promise\.all\(\[deviceReady,ready,sourcesReady\]\)/);
 assert.match(renderer,/if\(homeCompositeActive\)ensureCompositeScene\(true\)/);
 assert.match(renderer,/if\(compositeScene&&compositeScene.width===w&&compositeScene.height===h\)return/);
 assert.match(renderer,/compositeScene=rgba16Texture\(device,w,h\)/);
 assert.match(renderer,/const fixed=!!continuous/);
 assert.match(asset("dashboard-glass-artwork.js"),/get view\(\)\{ensureAtlas\(\);return view/);
 assert.match(asset("dashboard-glass-artwork.js"),/size:\[ART_SIZE,ART_SIZE,ART_LAYERS\]/);
});

test("cold homepage clock-text is gated until the first completed frame or confirmed fallback",()=>{
 const css=readFileSync(new URL("../sites/_apex/assets/public-home.css",import.meta.url),"utf8");
 const html=readFileSync(new URL("../sites/_apex/index.html",import.meta.url),"utf8");
 const renderer=asset("dashboard-gpu-renderer.js"),loader=asset("dashboard-home-loader.js");
 assert.match(html,/id="cta6-mosaic"[^>]*data-glass-startup="pending"[^>]*><\/div>\s*<div class="cta6-center"><h1 id="dashboard-title"/);
 assert.match(css,/body\.public-home:not\(\[data-public-route\]\) #cta6-mosaic\[data-glass-startup="pending"\] \+ \.cta6-center > #dashboard-title,[\s\S]*?color:transparent!important;\s*-webkit-text-fill-color:transparent!important;\s*text-shadow:none!important/);
 assert.ok(renderer.indexOf("await device.queue.onSubmittedWorkDone()")<renderer.indexOf('root.dataset.glassStartup=OFFSCREEN_CI?"fallback":"ready"'));
 assert.match(renderer,/finally\{if\(root\)root\.dataset\.glassStartup="fallback"/);
 assert.match(loader,/finally\{const root=document\.getElementById\("cta6-mosaic"\);if\(root\)root\.dataset\.glassStartup="fallback"/);
});
