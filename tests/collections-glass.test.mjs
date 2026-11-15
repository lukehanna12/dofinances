import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=read("sites/_apex/app/assets/collections.css");
const controller=read("sites/_apex/app/assets/collections.js");
const html=read("sites/_apex/app/index.html");

test("Collections dock has a fixed, flat dark capsule with no glass optics",()=>{
 assert.match(css,/#cs-root \.cs-control-center\{\s*--cs-dock-scale:1\.5;[\s\S]*?position:fixed;/);
 const finalRule=css.slice(css.indexOf("/* Floating Collections controls: deliberately flat"));
 assert.match(finalRule,/background:#161616;/);
 assert.match(finalRule,/-webkit-backdrop-filter:none;/);
 assert.match(finalRule,/backdrop-filter:none;/);
 assert.match(finalRule,/box-shadow:none;/);
 assert.match(finalRule,/border-radius:9999px;/);
 assert.match(finalRule,/#cs-root \.cs-control-center::before,\s*#cs-root \.cs-control-center::after\{\s*content:none;/);
 assert.doesNotMatch(finalRule,/url\("#collections-oracle-live-glass"\)|mask-image:|feDisplacementMap|cs-oracle-ready|--cs-optical-/);
});

test("Collections loads no WebGPU, SVG refraction, worker, canvas, or optically enhanced background",()=>{
 assert.doesNotMatch(controller,/mountCollectionsGlass|collections-glass\.js|collections-glass-field-worker|new Worker\(|getContext\(["']webgpu/);
 assert.doesNotMatch(html,/collections-glass(?:-field-worker|-public-clear)?\.js/);
 const finalRule=css.slice(css.indexOf("/* Floating Collections controls: deliberately flat"));
 assert.match(finalRule,/contain:layout style/);
 assert.doesNotMatch(finalRule,/(?:backdrop-filter|filter):\s*(?:blur\(|url\()/);
 assert.doesNotMatch(finalRule,/rgba\(255,255,255|linear-gradient\(/);
});

test("Flat dock keeps the same three buttons, dimensions, tooltips and scrolling behavior",()=>{
 const finalRule=css.slice(css.indexOf("/* Floating Collections controls: deliberately flat"));
 assert.match(finalRule,/width:calc\(36px \* var\(--cs-dock-scale\)\)/);
 assert.match(finalRule,/width:calc\(32\.4px \* var\(--cs-dock-scale\)\)/);
 assert.match(finalRule,/width:calc\(19px \* var\(--cs-dock-scale\)\)/);
 assert.match(finalRule,/bottom:calc\(100% \+ 13px\)/);
 assert.match(finalRule,/right:calc\(24px \+ env\(safe-area-inset-right,0px\)\)/);
 assert.match(finalRule,/bottom:calc\(24px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(finalRule,/@keyframes cs-floating-view-arrive/);
 for(const id of ["cs-create","cs-edit","cs-select-collections"])
  assert.ok(html.includes('id="'+id+'"'));
});
