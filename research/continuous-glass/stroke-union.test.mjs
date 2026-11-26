import {test} from "node:test";
import assert from "node:assert/strict";
import {prepareStrokeUnion,strokeImplicit,strokeDistance} from "./stroke-union.mjs";
const model=(curves,r=1)=>prepareStrokeUnion({arcTolerance:0,ops:[{fill:false,stroke:true,cap:"round",join:"round",width:r*2,subpaths:curves.map(curve=>({segments:[curve]}))}]});
function encloses(result,value,tol=.005){assert.ok(result.converged,JSON.stringify(result));assert.ok(result.signedInterval[0]<=value+1e-10&&result.signedInterval[1]>=value-1e-10,JSON.stringify(result));assert.ok(result.signedInterval[1]-result.signedInterval[0]<=tol+1e-10);}
test("round stroke is the disk sweep of the centerline",()=>{
 const m=model([[[-4,0],[4,0]]]);
 encloses(strokeDistance(m,[0,3]),2);
 encloses(strokeDistance(m,[5,1]),Math.SQRT2-1);
 encloses(strokeDistance(m,[0,.25]),-.75);
 encloses(strokeDistance(m,[0,0]),-1);
});
test("intersecting stroke interiors require union distance, not min of component distances",()=>{
 const m=model([[[-4,0],[4,0]],[[0,-4],[0,4]]]);
 const f=strokeImplicit(m,[0,0]);assert.equal(f.lower,-1);assert.equal(f.upper,-1);
 encloses(strokeDistance(m,[0,0]),-Math.SQRT2);
 encloses(strokeDistance(m,[.5,.25]),-Math.hypot(.5,.75));
});
test("budget failure stays explicit",()=>{
 const m=model([[[-4,0],[4,0]],[[0,-4],[0,4]]]);
 assert.equal(strokeDistance(m,[0,0],{maxCells:1,tolerance:1e-9}).converged,false);
});
