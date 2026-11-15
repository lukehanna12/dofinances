import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 airMode5SDF,controlPillField,generateOracleField,
 SVG_DISPLACEMENT_NEUTRAL_BIAS
} from "../sites/_apex/app/assets/sidebar-glass-oracle.js";
import {
 CLEAR_OBSERVED_128_84,projectPublicClearInputs,generatePublicClearPillField
} from "../sites/_apex/app/assets/collections-glass-public-clear.js";

const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=src("sites/_apex/app/assets/collections.css");
const controller=src("sites/_apex/app/assets/collections.js");
const mount=src("sites/_apex/app/assets/collections-glass.js");
const worker=src("sites/_apex/app/assets/collections-glass-field-worker.js");
const source=src("sites/_apex/app/assets/collections-glass-public-clear.js");
const original=src("sites/_apex/app/assets/sidebar-glass-oracle.js");
const html=src("sites/_apex/app/index.html");

test("Pinned PUBLIC SwiftUI Clear native filter inputs, not PRIVATE m1 material",()=>{
 const x=CLEAR_OBSERVED_128_84;
 assert.deepEqual([x.width,x.height,x.corner],[128,84,19]);
 assert.deepEqual([x.innerAmount,x.innerHeight,x.outerAmount,x.outerHeight],
   [-60,20,0,0]);
 assert.deepEqual([x.refractionDistance0,x.refractionDistance1,x.refractionOpacity],
   [-1,-.5,0]);
 assert.deepEqual(x.blurOpacity,[1,1,1,1,1]);
 assert.deepEqual(x.blurDistance,[0,0,0,0,0]);
 assert.deepEqual([x.blurRadius,x.cacheScale,x.backdropScale],[7.5,.25,.5]);
 assert.deepEqual([x.faceWhite,x.faceBlack,x.faceFillWhiteAlpha],[.8,.05,.05]);
 assert.ok(source.includes("live_swiftui_clear_filter_state.json"));
 assert.ok(source.includes("live_public_style_scale_chain.json"));
 assert.ok(source.includes("geometry_331_compact.json"));
 assert.ok(source.includes("58a83a8f68392f8004981c9b42ab308b3874f543"));
 assert.doesNotMatch(mount,/ORACLE_FINITE_REFRACTION|oracleFaceColorMatrixValues|shadowOpacity/);
});

test("Finite public geometry formulas reproduce observed 128×84 filter inputs",()=>{
 const d=projectPublicClearInputs(128,84);
 assert.equal(d.amount,-60);
 assert.equal(d.height,20);
 assert.equal(d.blurRadius,7.5);
 assert.equal(d.word,3);
 assert.equal(d.browserGaussianSigma,12);
 const smaller=projectPublicClearInputs(204,78);
 assert.equal(smaller.amount,-60);
 assert.equal(smaller.height,19.5);
 assert.ok(smaller.blurRadius>7&&smaller.blurRadius<8);
 assert.equal(smaller.word,Math.fround(Math.fround(smaller.blurRadius)*
  Math.fround(Math.fround(1*.25)*Math.fround(1.6))));
 assert.throws(()=>projectPublicClearInputs(0,60),RangeError);
});

test("Native-derived pill geometry is four-corner, not estimated rectangular SDF",()=>{
 const w=130,h=80,r=40;
 for(const [x,y] of [[.5,.5],[21.5,21.5],[42.5,17.5],[64.5,39.5]]){
  const actual=controlPillField(x,y,w,h,r);
  const expected=airMode5SDF(x-w/2,h/2-y,w/2,h/2,[-r,-r,-r,-r]);
  assert.deepEqual(actual,{distance:expected.distance,nx:expected.nx,ny:-expected.ny});
 }
 assert.match(original,/shape==="sidebar"&&dst>activeSpan/);
 const sidebar=generateOracleField(38,26,13);
 assert.deepEqual(sidebar,generateOracleField(38,26,13,undefined,"sidebar"),
  "Do not change previously shipped sidebar field bytes");
});

test("Public Clear retains one exact byte field with measurable nonneutral warp",()=>{
 const w=98,h=56,r=28;
 const {width,height,pixels}=generatePublicClearPillField(w,h,r);
 assert.deepEqual([width,height,pixels.length],[w,h,w*h*4]);
 assert.ok(pixels.every((v,i)=>i%4!==3||v===255));
 assert.ok(pixels.every((v,i)=>i%4!==2||v===0));
 const active=Array.from({length:w*h},(_,i)=>i).filter(i=>
  pixels[i*4]!==128||pixels[i*4+1]!==128);
 assert.ok(active.length>100,"Refraction mask must not collapse to a neutral image");
 assert.ok(active.length<w*h,"Interior should have neutral displacement");
 assert.equal(SVG_DISPLACEMENT_NEUTRAL_BIAS,1/(2*255));
 assert.throws(()=>generatePublicClearPillField(-1,h,r),RangeError);
 assert.throws(()=>generatePublicClearPillField(w,h,999),RangeError);
});

test("Dock is 150% OF original (1.5×), not 150% additional (2.5×)",()=>{
 assert.match(css,/#cs-root \.cs-control-center\{\s*--cs-dock-scale:1\.5;\s*position:fixed;/);
 assert.match(css,/min-height:calc\(52px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/width:calc\(36px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/width:calc\(32\.4px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/width:calc\(19px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/border-radius:9999px;/);
 assert.match(css,/background:rgba\(0,0,0,\.24\)/);
 assert.match(css,/#cs-root \.cs-control-center\.cs-oracle-ready\{/);
 assert.ok(!css.includes("--cs-dock-scale:2.5"));
 assert.match(css,/bottom:calc\(100% \+ 13px\)/);
 assert.match(css,/@keyframes cs-floating-view-arrive/);
 for(const id of ["cs-create","cs-edit","cs-select-collections"])
  assert.ok(html.includes('id="'+id+'"'));
});

test("One lossless worker mask; no private diagnostic multi-pass mixing",()=>{
 assert.match(controller,/mountCollectionsGlass\(root\)/);
 assert.match(worker,/generatePublicClearPillField\(w,h,radius\)/);
 assert.match(worker,/OffscreenCanvas/);
 assert.match(worker,/FileReaderSync/);
 assert.match(worker,/convertToBlob\(\{type:"image\/png"\}\)/);
 assert.match(mount,/new win\.ResizeObserver\(requestField\)/);
 assert.match(mount,/new win\.MutationObserver\(requestField\)/);
 assert.match(mount,/worker\.postMessage\(\{key,w,h,radius\}\)/);
 assert.match(mount,/while\(cache\.size>2\)/);
 assert.match(mount,/in:"SourceGraphic"/);
 assert.match(mount,/feDisplacementMap/);
 assert.equal((mount.match(/make\(doc,"feImage"/g)||[]).length,1);
 assert.equal((mount.match(/make\(doc,"feGaussianBlur"/g)||[]).length,1);
 assert.ok(!mount.includes('outerShift'),"Clear outer branch must be absent");
 assert.ok(!mount.includes('innerMap'),"Old private diagnostic branch must be absent");
 assert.match(mount,/Firefox\\\//);
 assert.match(mount,/Safari\\\//);
 assert.match(css,/@media\(prefers-reduced-transparency:reduce\),\(forced-colors:active\)/);
 for(const item of [mount,worker]){
  assert.doesNotMatch(item,/addEventListener\(["']scroll|setInterval\(|getImageData\(|drawImage\(|captureStream\(|html2canvas|requestAnimationFrame\(/);
 }
});
