/* Deterministic finite-evidence tests. NO screenshots or visual-fit oracle.
 * Run after CI assembles dist/app/assets, with module-friendly Node.
 * These assertions test the actual shipped math and live-backdrop boundary.
 * Target witness scope: 25F80/M2/G14G; they do not imply pixel equivalence.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";

// Source mosaic's DOM lookup is harmless in this deliberately empty document.
// Browser-only filter creation is not reached when the mosaic is absent.
globalThis.document={getElementById:()=>null};
const {
  finiteGeometryParameters,finiteBlurParameters,shapeField,createGeometricMaps
}=await import("./dashboard-optics.js");
const {
  nativePublicBlurRadius,observedBlurWord,
  airRefractionEnvelope,airThresholdMix,
  encodeOracleDisplacement,decodeOracleDisplacement
}=await import("./sidebar-glass-oracle.js");

test("52-case public geometry formula: retained held-out boundary points",()=>{
  assert.equal(nativePublicBlurRadius("regular",48,90),2);
  assert.equal(nativePublicBlurRadius("regular",75,100),2.482142857142857);
  assert.equal(nativePublicBlurRadius("regular",160,200),4);
  assert.equal(nativePublicBlurRadius("clear",48,90),5);
  assert.equal(nativePublicBlurRadius("clear",75,100),6.875);
  assert.equal(nativePublicBlurRadius("clear",120,160),10);
  assert.equal(nativePublicBlurRadius("clear",48.1,90),5.006944444444445);
});

test("selected-input Float32 blur relation is not a universal scalar proof",()=>{
  const p=finiteBlurParameters(75,100);
  assert.equal(p.publicRadius,6.875);
  assert.equal(p.blurWord,observedBlurWord(6.875,1,.25));
  assert.equal(p.blurWord,2.75);
  // Browser transport: finite LOD -> equivalent Gaussian variance for a
  // box-filter footprint. NOT an exact Metal mip kernel identity.
  assert.ok(p.farSigma>.7&&p.farSigma<.9,
    "Clear-style browser blur must not exaggerate native blur word to 11px");
  assert.ok(p.nearSigma>.4&&p.nearSigma<.6);
  assert.ok(p.farSigma>p.nearSigma);
});

test("derived geometric refraction relations keep their measured finite values",()=>{
  const p=finiteGeometryParameters(88,88);
  assert.equal(p.innerAmount,Math.fround(-60));
  assert.equal(p.innerInvHeight,Math.fround(1/20));
  assert.equal(p.outerAmount,Math.fround(.2*88));
  assert.equal(p.outerInvHeight,Math.fround(1/(.125*88)));
  assert.equal(p.blurDist[0],Math.fround(-44));
  assert.equal(p.blurDist[1],-1);
  assert.equal(p.threshold0,-1);
  assert.equal(p.threshold1,-.5);
});

test("8-bit SVG neutral compensation is exactly unbiased at zero",()=>{
  assert.equal(encodeOracleDisplacement(0),128);
  assert.equal(decodeOracleDisplacement(128),0);
  assert.equal(airThresholdMix(-1,-1,-.5,.3),0);
  assert.equal(airRefractionEnvelope(-100,-40,.05),0);
  assert.equal(airRefractionEnvelope(0,-40,.05),-40);
});

test("AIR four-corner SDF emits finite normals and geometry-only maps",()=>{
  const w=64,h=64,radius=12;
  const center=shapeField(w/2,h/2,w,h,radius);
  const corner=shapeField(.5,.5,w,h,radius);
  for(const p of [center,corner]){
    assert.ok(Number.isFinite(p.distance));
    assert.ok(Number.isFinite(p.nx));
    assert.ok(Number.isFinite(p.ny));
  }
  const material=finiteGeometryParameters(w,h);
  const a=createGeometricMaps(w,h,radius,material);
  const b=createGeometricMaps(w,h,radius,material);
  assert.equal(a.inner.length,w*h*4);
  assert.equal(a.outer.length,w*h*4);
  assert.equal(a.blur.length,w*h*4);
  assert.deepEqual(a.inner,b.inner);
  assert.deepEqual(a.outer,b.outer);
  assert.deepEqual(a.blur,b.blur);
  for(let i=3;i<a.inner.length;i+=4){
    assert.equal(a.inner[i],255);
    assert.equal(a.outer[i],255);
    assert.equal(a.blur[i],255);
  }
  assert.ok(a.inner.some((v,i)=>i%4<2&&v!==128),
    "Geometric field must contain a non-trivial displacement; no backdrop pixels");
  // Regression: the prior adapter attenuated refraction by an extra .25.
  // The mode5 field must now use the source-UV normalization and finite
  // source-scale cancellation (explicit browser mapping assumption).
  const maxSignedInner=Math.max(...a.inner.filter((_,i)=>i%4<2).map(x=>Math.abs(x-128)));
  assert.ok(maxSignedInner>20,
    "Refraction must not be artificially reduced to quarter strength");
});

test("live optical input contract: no pre-rendered backdrop or wallpaper baked in",()=>{
  const source=fs.readFileSync(new URL("./dashboard-optics.js",import.meta.url),"utf8");
  assert.ok(source.includes('in:"SourceGraphic"'));
  assert.ok(source.includes('feDisplacementMap'));
  assert.ok(source.includes('filterUnits:"objectBoundingBox"'));
  assert.ok(source.includes('geometryPNG('));
  assert.ok(source.includes('ResizeObserver'));
  assert.ok(!/\.jpg|\.jpeg|\.webp|\.heic/.test(source));
  assert.ok(!/getImageData\s*\(|drawImage\s*\(|html2canvas/.test(source));
  assert.ok(source.includes("GAP(COLOR-Q)"));
  assert.ok(source.includes("GAP(BROWSER-MIP-TO-GAUSS)"));
  assert.ok(source.includes("GAP(BROWSER-DISPLACEMENT-COORDINATES)"));
  assert.ok(!source.includes("const browserRadius=blurWord/.25"));
  assert.ok(!source.includes("innerValue*.25"));
});
