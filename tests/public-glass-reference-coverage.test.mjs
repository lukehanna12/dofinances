import {test} from "node:test";
import assert from "node:assert/strict";
import {coverageGeometry} from "../sites/_apex/assets/home-dashboard/dashboard-glass-vector-coverage.js";
test("reference optical SVG coverage uses the same authored geometry on its own lattice",()=>{
 const bounds=[23.25,21.25,45.5,45.5],owner=[40.125,80.625,92,88];
 for(const dismiss of [0,.31,1]){
  const baseline=coverageGeometry(bounds,owner,dismiss,[2,2]);
  const retina=coverageGeometry(bounds.map(x=>x*2),owner.map(x=>x*2),dismiss,[1,1]);
  assert.equal(baseline.width,retina.width);assert.equal(baseline.height,retina.height);
  assert.equal(baseline.phaseX,retina.phaseX);assert.equal(baseline.phaseY,retina.phaseY);
  assert.equal(baseline.pw,retina.pw);assert.equal(baseline.ph,retina.ph);
  assert.deepEqual(baseline.rect,[retina.rect[0]/2,retina.rect[1]/2,retina.rect[2]*2,retina.rect[3]*2]);
 }
});
test("reference coverage supports anisotropic projection without altering original fit",()=>{
 const b=[5,6,20,30],o=[12,16,40,50],g=coverageGeometry(b,o,.5,[2,3]);
 assert.ok(g.sx>2&&g.sy>3);
 assert.equal(g.w,20);assert.equal(g.h,30);
 assert.equal(g.rect[2],g.sx);assert.equal(g.rect[3],g.sy);
});
