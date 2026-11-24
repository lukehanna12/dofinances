import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {glassPaneIntersectsViewport as visible} from "../sites/_apex/assets/home-dashboard/dashboard-glass-model.js";
const renderer=readFileSync(new URL("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js",import.meta.url),"utf8");
test("SVG coverage culls only wholly invisible quads including optical underlay and dismissal bloom",()=>{
 assert.equal(visible([0,601,100,100],800,600),false);
 assert.equal(visible([0,600,100,100],800,600),true);
 assert.equal(visible([0,-101,100,100],800,600),false);
 assert.equal(visible([0,-101,100,100],800,600,-20,600),true);
 assert.equal(visible([0,601,100,100],800,600,0,600,1),true);
 assert.equal(visible([801,0,100,100],800,600,0,600,1),true);
 assert.equal(visible([810,0,100,100],800,600,0,600,1),false);
});
test("public resize coalesces notifications on the existing RAF and keeps a complete GPU submission",()=>{
 const handler=renderer.slice(renderer.indexOf("const onSize=()=>{"),renderer.indexOf("function flushResize()"));
 assert.match(handler,/if\(audit.resizePending\)/);
 assert.match(handler,/requestRender\(\)/);
 assert.doesNotMatch(handler,/engine\.(?:render|rebuild)\(/);
 assert.match(renderer,/const resized=resizing\?engine.flushResize\(\):null/);
 assert.match(renderer,/engine.rebuild\(\{deferDismissedMosaic:true\}\);\s*const animating=engine.render\(\)/);
 assert.match(renderer,/if\(mosaicLayoutDirty&&!mosaicCanDefer\(\)\)rebuild\(\)/);
 assert.match(renderer,/if\(previous\?\.size===size\)return previous/);
 assert.match(renderer,/glassPaneIntersectsViewport\(Array.from\(tileData.subarray\(p,p\+4\)\)/);
});
