import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {nativePublicBlurRadius,observedBlurWord,airMode5SDF,airRefractionEnvelope}
  from "../sites/_apex/app/assets/sidebar-glass-oracle.js";

const load=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Studio root is exactly five accessible, genuinely interactive Glass components",async()=>{
  const html=await load("../studio/gallery/index.html");
  assert.match(html,/<title>Liquid Glass Gallery — DoFinances Studio<\/title>/);
  assert.equal((html.match(/data-oracle-surface\b/g)||[]).length,5);
  for(const id of ["specimen-panel","specimen-button","specimen-segments",
    "specimen-slider","specimen-toggle","panel-control","action-button",
    "period-control","diffusion-range","clarity-switch"])
    assert.match(html,new RegExp('id="'+id+'"'),id);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/aria-controls="panel-reveal"/);
  assert.match(html,/role="group" aria-label="Select a time range"/);
  assert.match(html,/type="range" min="0" max="100" step="1"/);
  assert.match(html,/role="switch" aria-checked="false"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/href="\/app\/"/);
  assert.doesNotMatch(html,/auth3-studio-preview-v1|\/api\/auth\/|dashboard\.js|\/app\/assets\/dashboard\.js/);
});

test("Three exclusive background environments, real bundled photograph and responsive layout",async()=>{
  const [html,css,js]=await Promise.all([
    load("../studio/gallery/index.html"),
    load("../studio/gallery/gallery.css"),
    load("../studio/gallery/gallery.js")
  ]);
  for(const mode of ["flat","design","photo"]){
    assert.match(html,new RegExp('data-background="'+mode+'"'));
    assert.match(css,new RegExp('body\\[data-scene="'+mode+'"\\]'));
  }
  assert.equal((html.match(/class="environment-option/g)||[]).length,3);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,2,
    "Default background and default segmented selection are the only pressed options");
  assert.match(css,/home-rice-terraces-hq\.jpg/);
  assert.match(css,/@media \(max-width:710px\)/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media \(forced-colors:active\)/);
  assert.match(js,/localStorage\.setItem\("dofinances-studio-glass-environment"/);
  assert.match(js,/localStorage\.getItem\("dofinances-studio-glass-environment"/);
});

test("Oracle-derived math is reused without pretending G14G/browser parity",async()=>{
  const [html,js,worker]=await Promise.all([
    load("../studio/gallery/index.html"),
    load("../studio/gallery/gallery.js"),
    load("../studio/gallery/gallery-field-worker.js")
  ]);
  for(const marker of ["nativePublicBlurRadius","observedBlurWord","airTextureMipLOD",
    "SIDEBAR_PUBLIC_COLOR_PASSTHROUGH","SVG_DISPLACEMENT_NEUTRAL_BIAS"])
    assert.match(js,new RegExp(marker));
  for(const marker of ["airMode5SDF","airRefractionEnvelope","airThresholdMix",
    "airBlurDistribution","encodeOracleDisplacement","ORACLE_FINITE_REFRACTION"])
    assert.match(worker,new RegExp(marker));
  assert.match(worker,/const signed=\[-radius,-radius,-radius,-radius\]/);
  assert.match(worker,/MAX_PIXELS=200000/);
  assert.match(js,/new ResizeObserver/);
  assert.match(js,/data\.key!==record\.pendingKey/);
  assert.match(js,/record\.optical\.style\.backdropFilter=""/);
  assert.match(js,/in:"SourceGraphic"/);
  assert.match(js,/feDisplacementMap/);
  assert.match(js,/filterUnits:"objectBoundingBox"/);
  assert.match(html,/approximations—not an Apple bit-exact rendering claim/);
  assert.doesNotMatch(js+"\n"+worker,/fetch\(|api\/auth|gateway|\/account\/connections/);
});

test("Native finite CPU blur calculation and four-corner AIR mode still return valid values",()=>{
  const r=nativePublicBlurRadius("regular",220,75);
  assert.equal(r,2+(75-48)/112*2);
  assert.equal(observedBlurWord(r,1,.25),
    Math.fround(Math.fround(r)*Math.fround(Math.fround(1*.25)*Math.fround(1.6))));
  const sdf=airMode5SDF(0,0,80,45,[-20,-20,-20,-20]);
  assert.ok(Number.isFinite(sdf.distance));
  const envelope=airRefractionEnvelope(-3,-44.79999923706055,.0714285746216774);
  assert.ok(Number.isFinite(envelope));
});

test("Pages packages gallery root and preserves existing public sidebar and protected apex routes",async()=>{
  const [workflow,readme]=await Promise.all([
    load("../.github/workflows/site.yml"),
    load("../studio/sidebar/README.md")
  ]);
  assert.match(workflow,/cp studio\/gallery\/index\.html dist\/index\.html/);
  assert.match(workflow,/cp studio\/sidebar\/index\.html dist\/app\/index\.html/);
  for(const asset of ["gallery.css","gallery.js","gallery-field-worker.js"]){
    assert.match(workflow,new RegExp('cp studio/gallery/'+asset.replace(".","\\.")+
      ' dist/gallery/assets/'+asset.replace(".","\\.")));
    assert.match(workflow,new RegExp('/gallery/assets/'+asset.replace(".","\\.")));
  }
  assert.match(workflow,/cp dist\/index\.html sites\/_apex\/login\/index\.html/);
  assert.match(workflow,/test ! -e dist\/app\/assets\/dashboard\.js/);
  assert.match(workflow,/node scripts\/verify-live-sidebar\.mjs/);
  assert.match(readme,/\/app/);
});
