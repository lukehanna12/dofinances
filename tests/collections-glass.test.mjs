import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 airMode5SDF,controlPillField,generateOracleField,
 SVG_DISPLACEMENT_NEUTRAL_BIAS,nativePublicBlurRadius,observedBlurWord
} from "../sites/_apex/app/assets/sidebar-glass-oracle.js";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=source("sites/_apex/app/assets/collections.css");
const controller=source("sites/_apex/app/assets/collections.js");
const mount=source("sites/_apex/app/assets/collections-glass.js");
const fieldWorker=source("sites/_apex/app/assets/collections-glass-field-worker.js");
const oracle=source("sites/_apex/app/assets/sidebar-glass-oracle.js");
const html=source("sites/_apex/app/index.html");

test("Oracle pill uses the retained signed four-corner mode5 relation",()=>{
 const w=130,h=80,r=40;
 for(const [x,y] of [[0.5,.5],[21.5,21.5],[42.5,17.5],[64.5,39.5]]){
  const actual=controlPillField(x,y,w,h,r);
  const native=airMode5SDF(x-w/2,h/2-y,w/2,h/2,[-r,-r,-r,-r]);
  assert.deepEqual(actual,{distance:native.distance,nx:native.nx,ny:-native.ny});
 }
 assert.throws(()=>controlPillField(0,0,-1,80,40),RangeError);
 assert.match(oracle,/shape==="sidebar"&&dst>activeSpan/,"Do not discard curved corner samples");
});

test("Exact field shapes remain independently allocated; sidebar defaults are unchanged",()=>{
 const [w,h,r]=[38,26,13];
 const one=generateOracleField(w,h,r);
 const explicit=generateOracleField(w,h,r,undefined,"sidebar");
 assert.deepEqual(one,explicit,"Original sidebar field bytes must not change");
 const pill=generateOracleField(w,h,r,undefined,"pill");
 for(const name of ["inner","outer","blurMask"]){
  assert.equal(pill[name].length,w*h*4);
  assert.ok(pill[name].every((byte,i)=>i%4!==3||byte===255));
 }
 assert.notDeepEqual([...pill.inner],[...explicit.inner]);
 assert.throws(()=>generateOracleField(16,16,8,undefined,"guess"),RangeError);
});

test("Clear blur scales use observed target arithmetic; SVG neutral is exact",()=>{
 const blur=nativePublicBlurRadius("clear",342,130);
 assert.equal(blur,10);
 const word=observedBlurWord(blur,1,.5);
 assert.equal(word,8);
 assert.equal(SVG_DISPLACEMENT_NEUTRAL_BIAS,1/(2*255));
 assert.ok(mount.includes('k2:1,k3:1,result:"glass"'),"Add independent masked branches, do not over-blend");
 assert.ok(mount.includes('in:"SourceGraphic"'),"Use actual backdrop");
 assert.ok(mount.includes('innerMap')&&mount.includes('outerMap')&&mount.includes('blurMap'));
 assert.ok(!mount.includes("oracleFaceColorMatrixValues("),"Do not substitute a private color matrix");
});

test("Collections dock is viewport-fixed, above content and 2.5x baseline",()=>{
 assert.ok(html.includes('class="cs-control-center" role="group" aria-label="Collection controls"'));
 for(const name of ["cs-create","cs-edit","cs-select-collections"])
  assert.ok(html.includes('id="'+name+'"'));
 assert.match(css,/#cs-root \.cs-control-center\{\s*--cs-dock-scale:2\.5;\s*position:fixed;/);
 assert.match(css,/right:calc\(24px \+ env\(safe-area-inset-right,0px\)\)/);
 assert.match(css,/bottom:calc\(24px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/min-height:calc\(52px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/width:calc\(36px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/width:calc\(32\.4px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/width:calc\(19px \* var\(--cs-dock-scale\)\)/);
 assert.match(css,/\.cs-control-center\.cs-oracle-ready\{/);
 assert.match(css,/bottom:calc\(100% \+ 13px\)/,"Dock tooltips must open above controls");
 assert.match(css,/@media\(max-width:440px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/@keyframes cs-floating-view-arrive\{from\{opacity:\.83\}to\{opacity:1\}\}/);
 assert.match(css,/animation:cs-floating-view-arrive 170ms/,"No transformed fixed containing block");
 assert.ok(!css.includes("cs-control-center{transform:"),"Do not transform the optical maps");
});

test("Only geometry crosses the worker; scrolling repaints native backdrop without JS",()=>{
 assert.match(controller,/import \{mountCollectionsGlass\} from "\.\/collections-glass\.js"/);
 assert.match(controller,/mountCollectionsGlass\(root\)/);
 assert.match(fieldWorker,/generateOracleField\(w,h,radius,undefined,"pill"\)/);
 assert.match(fieldWorker,/OffscreenCanvas/);
 assert.match(fieldWorker,/convertToBlob\(\{type:"image\/png"\}\)/);
 assert.match(fieldWorker,/FileReaderSync/);
 assert.match(mount,/new win\.ResizeObserver\(requestField\)/);
 assert.match(mount,/new win\.MutationObserver\(requestField\)/);
 assert.match(mount,/worker\.postMessage\(\{key,w,h,radius\}\)/);
 assert.match(mount,/while\(cache\.size>MAX_ENTRIES\)/);
 assert.match(mount,/panel\.classList\.remove\("cs-oracle-ready"\)/);
 assert.match(mount,/panel\.classList\.add\("cs-oracle-ready"\)/);
 for(const [name,code] of [["mount",mount],["worker",fieldWorker]]){
  assert.doesNotMatch(code,/addEventListener\(["']scroll|setInterval\(|getImageData\(|drawImage\(|captureStream\(|html2canvas|requestAnimationFrame\(/,
   name+" must not copy the page, poll or update on scroll");
 }
 assert.match(css,/@media\(prefers-reduced-transparency:reduce\),\(forced-colors:active\)/);
});
