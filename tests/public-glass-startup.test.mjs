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
 assert.match(renderer,/if\(homeCompositeActive\)ensureCompositeScene\(\)/);
 assert.match(renderer,/function ensureCompositeScene\(\)\{\s*if\(compositeScene\)return/);
 assert.match(renderer,/compositeScene=rgba16Texture\(device,physicalWidth,physicalHeight\)/);
 assert.match(asset("dashboard-glass-artwork.js"),/get view\(\)\{ensureAtlas\(\);return view/);
 assert.match(asset("dashboard-glass-artwork.js"),/size:\[ART_SIZE,ART_SIZE,ART_LAYERS\]/);
});
