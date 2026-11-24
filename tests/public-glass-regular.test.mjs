import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveRegularMaterial,regularMaterialLanes,glassMaterialFromElement,
 validateGlassMaterial,MATERIAL_FLOATS,decodeFaceHalfRows,NATIVE_REGULAR_FACE_HEX} from "../sites/_apex/assets/home-dashboard/dashboard-glass-material.js";
import {resolveGlassSurface} from "../sites/_apex/assets/home-dashboard/dashboard-glass-model.js";
const assets=name=>readFileSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url),"utf8");
test("Regular uses the native finite per-surface geometry and scalar relation",()=>{
 for(const [width,height] of [[75,75],[150,58.5],[58.5,150],[32,32],[300,160],[320,220]]){
  const d=Math.min(width,height),p=resolveRegularMaterial({width,height,scale:2});
  assert.equal(p.innerAmount,Math.max(-60,-.8*d)*2);
  assert.equal(p.innerHeight,Math.min(20,.25*d)*2);
  assert.equal(p.outerAmount,0);assert.equal(p.outerHeight,0);
  assert.equal(p.nativeInputLayerScale,.25);
  assert.equal(p.nativeInputBlurRadius,Math.min(4,Math.max(2,2+((d-48)/112)*2)));
  assert.equal(p.blurWord,Math.fround(Math.fround(p.nativeInputBlurRadius)*Math.fround(.4)));
  assert.equal(p.bleedAmount,.35*d);assert.equal(p.shadowHeight,.4*d);
  assert.equal(p.blurDistribution,1);assert.equal(p.refractionOpacity,0);
  assert.equal(regularMaterialLanes(p).length,MATERIAL_FLOATS);
 }
});
test("Regular face inputs have explicit finite scheme and small-size scope",()=>{
 const a=resolveRegularMaterial({width:150,height:84,scheme:"light"});
 const b=resolveRegularMaterial({width:150,height:84,scheme:"dark"});
 assert.deepEqual(regularMaterialLanes(a).slice(4),decodeFaceHalfRows(NATIVE_REGULAR_FACE_HEX.light.large));
 assert.deepEqual(regularMaterialLanes(b).slice(4),decodeFaceHalfRows(NATIVE_REGULAR_FACE_HEX.dark.large));
 assert.equal(MATERIAL_FLOATS,16);
 assert.deepEqual(b.faceRows.slice(0,4),[.56689453125,-.279052734375,-.028106689453125,.1300048828125]);
 const small=resolveRegularMaterial({width:700,height:22,scheme:"dark"});
 assert.deepEqual(small.faceRows,decodeFaceHalfRows(NATIVE_REGULAR_FACE_HEX.dark.small));
 assert.deepEqual(resolveRegularMaterial({width:220,height:60,scheme:"dark"}).faceRows,small.faceRows);
 const mid=resolveRegularMaterial({width:220,height:62.5,scheme:"dark"}).faceRows;
 assert.ok(mid.every((v,i)=>Math.abs(v-(small.faceRows[i]+b.faceRows[i])/2)<1e-12));
 assert.throws(()=>decodeFaceHalfRows("00"),RangeError);
 assert.match(resolveRegularMaterial({width:150,height:58.5}).faceScope,/adaptive face producer unproved/);
});
test("Material is independent of geometry and role; Clear remains default",()=>{
 assert.equal(resolveGlassSurface({width:100,height:50}).material,"clear");
 for(const shape of ["rectangle","rounded-rectangle","capsule","circle","square"]){
  assert.equal(resolveGlassSurface({width:50,height:50,shape,material:"regular"}).material,"regular");
 }
 assert.equal(glassMaterialFromElement(null),"clear");
 assert.equal(glassMaterialFromElement({closest:()=>({getAttribute:()=>"regular"})}),"regular");
 assert.throws(()=>validateGlassMaterial("unknown"),RangeError);
});
test("Regular uses one shared GPU shader, material buffer and both frame paths",()=>{
 const r=assets("dashboard-gpu-renderer.js"),s=assets("dashboard-gpu-glass.wgsl");
 assert.match(s,/@binding\(5\).*materialProfiles/);
 assert.match(s,/let regular=profile\.optics\.x>0\.5/);
 assert.match(s,/select\(thresholdMix\(signed\),0\.0,regular\)/);
 assert.match(s,/let face=regularFace\(source\.rgb,profile\)/);
 assert.match(s,/dot\(v,r0\),dot\(v,r1\),dot\(v,r2\)/);
 assert.doesNotMatch(s,/color=mix\(vec3<f32>\(profile\.face/);
 assert.match(s,/let routePane=authPane && !homeCapsule/);
 assert.match(r,/binding:5,resource:\{buffer:materialBuffer\}/);
 assert.equal((r.match(/syncMaterialProfiles\(\);/g)||[]).length,2);
 assert.match(r,/attributeFilter:\["data-glass-material"\]/);
});
