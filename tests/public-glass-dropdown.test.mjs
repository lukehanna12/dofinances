import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveDropdownMaterial,dropdownMaterialLanes,GLASS_DROPDOWN_METRICS,DROPDOWN_ACCENT,dropdownRowBounds} from "../sites/_apex/assets/home-dashboard/dashboard-glass-dropdown.js";
import {resolveGlassSurface} from "../sites/_apex/assets/home-dashboard/dashboard-glass-model.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("native menu profile fits finite geometry, including the held intermediate size",()=>{
 for(const [w,h,r] of [[94,58,1.5714285714285714],[87,106,2.261904761904762],[94,106,2.428571428571429],[190,202,4]]){
  const p=resolveDropdownMaterial({width:w,height:h,scale:2,scheme:"light"});
  const d=Math.min(w,h);
  assert.ok(Math.abs(p.nativeInputBlurRadius-r)<1e-12);
  assert.equal(p.innerAmount,Math.max(-60,-.8*d)*2);
  assert.equal(p.innerHeight,Math.min(20,.25*d)*2);
  assert.equal(p.outerAmount,.2*d*2);assert.equal(p.outerHeight,.125*d*2);
  assert.equal(p.nativeInputLayerScale,.25);assert.equal(p.lodBias,2);
  assert.equal(dropdownMaterialLanes(p).length,16);assert.equal(dropdownMaterialLanes(p)[0],2);
 }
 assert.equal(resolveGlassSurface({width:90,height:110,material:"dropdown"}).material,"dropdown");
 assert.deepEqual([GLASS_DROPDOWN_METRICS.cornerRadius,GLASS_DROPDOWN_METRICS.inset,GLASS_DROPDOWN_METRICS.rowHeight,GLASS_DROPDOWN_METRICS.rowRadius],[12,5,24,7]);
 assert.equal(resolveDropdownMaterial({width:94,height:106,scheme:"dark"}).faceFillGray,0);
 assert.equal(resolveDropdownMaterial({width:94,height:106,scheme:"light"}).faceFillGray,1);
 assert.equal(DROPDOWN_ACCENT.light[2],1);
 assert.throws(()=>resolveDropdownMaterial({width:0,height:1}),RangeError);
});
test("active row geometry is panel-local and follows the same DOM transform",()=>{
 const p={getBoundingClientRect:()=>({left:100,top:200}),querySelector:()=>({getBoundingClientRect:()=>({left:105,top:229,width:84,height:24})})};
 assert.deepEqual(dropdownRowBounds(p),[5,29,84,24]);
 assert.deepEqual(dropdownMaterialLanes(resolveDropdownMaterial({width:94,height:106,scale:2,row:dropdownRowBounds(p)})).slice(12),[10,58,168,48]);
 assert.deepEqual(dropdownRowBounds({...p,inert:true}),[0,0,0,0]);
});
test("dropdown uses shared GPU material and prior-layer texture in both frame paths",()=>{
 const r=read("sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),s=read("sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),c=read("sites/_apex/assets/public-projects-controls.js");
 assert.match(r,/querySelectorAll\("\[data-glass-dropdown\]"\)/);
 assert.match(c,/registerGlassDropdown\(filterPanel/);
 assert.match(r,/if\(underlay&&menu\)/);
 assert.equal((r.match(/renderRouteDropdownBackdrop\(encoder\);/g)||[]).length,2);
 assert.match(r,/entries:entries\(authGlobalsBuffer,compositeSceneView\)/);
 assert.match(s,/let dropdown=profile\.optics\.x>1\.5/);
 assert.match(s,/color=mix\(color,mix\(soft,accent,0\.75\),rowCoverage\)/);
 assert.match(s,/split\|\|dropdown/);
});
