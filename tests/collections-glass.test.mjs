import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=read("sites/_apex/app/assets/collections.css");
const js=read("sites/_apex/app/assets/collections.js");
const html=read("sites/_apex/app/index.html");
const topbar=read("sites/_apex/app/assets/workspace-wallpapers.css");
const headerBorder=read("sites/_apex/app/assets/sidebar-glass.css");
const dock=css.slice(css.indexOf("/* Floating Collections dock:"));
test("Collections dock uses the exact lower topbar translucent tint and frosted material",()=>{
 assert.match(css,/#cs-root \.cs-control-center\{\s*--cs-dock-scale:1\.5;[\s\S]*?position:fixed;/);
 for(const value of ["background:rgba(14,15,17,.69);","-webkit-backdrop-filter:blur(18px) saturate(120%);","backdrop-filter:blur(18px) saturate(120%);"])
  assert.ok(topbar.includes(value)&&dock.includes(value),"Topbar material mismatch: "+value);
 assert.ok(dock.includes("box-shadow:none;")&&dock.includes("border-radius:9999px;"));
 const hairline="border:1px solid rgba(245,248,252,.065);";
 assert.ok(headerBorder.includes("border-bottom:1px solid rgba(245,248,252,.065);"),"The lower topbar original hairline must remain unchanged");
 assert.ok(dock.includes(hairline),"The Collections dock must reuse the exact lower topbar border");
 assert.match(dock,/#cs-root \.cs-control-center::before,\s*#cs-root \.cs-control-center::after\{\s*content:none;/);
 assert.ok(dock.includes("background:rgba(18,19,21,.93)"),"No-blur fallback matches topbar");
 assert.doesNotMatch(dock,/url\("#collections-oracle-live-glass"\)|feDisplacementMap|cs-oracle-ready|--cs-optical-/);
});
test("Native backdrop blur introduces no SVG optical worker or WebGPU renderer",()=>{
 assert.doesNotMatch(js,/mountCollectionsGlass|collections-glass\.js|collections-glass-field-worker|new Worker\(|getContext\(["']webgpu/);
 assert.doesNotMatch(html,/collections-glass(?:-field-worker|-public-clear)?\.js/);
 assert.match(dock,/contain:layout style/);
 assert.doesNotMatch(dock,/filter:\s*url\(/);
});
test("Frosted dock keeps button dimensions, tooltips and fixed viewport anchoring",()=>{
 assert.match(dock,/width:calc\(36px \* var\(--cs-dock-scale\)\)/);
 assert.match(dock,/width:calc\(32\.4px \* var\(--cs-dock-scale\)\)/);
 assert.match(dock,/width:calc\(19px \* var\(--cs-dock-scale\)\)/);
 assert.match(dock,/bottom:calc\(100% \+ 13px\)/);
 assert.match(dock,/right:calc\(24px \+ env\(safe-area-inset-right,0px\)\)/);
 assert.match(dock,/bottom:calc\(24px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(dock,/@keyframes cs-floating-view-arrive/);
 for(const id of ["cs-create","cs-edit","cs-select-collections"])assert.ok(html.includes('id="'+id+'"'));
});
