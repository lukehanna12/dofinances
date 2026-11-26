import {test} from "node:test";
import assert from "node:assert/strict";
import {parsePath,parseIconSVG} from "./svg-ingestion.mjs";
import {evaluate} from "./vector-field.mjs";
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,a+" != "+b);
test("SVG compact flags, relative repeated commands, smooth controls and close",()=>{
 const [p]=parsePath("M2 4a2 2 0 012-2h16a2 2 0 012 2v16a2 2 0 01-2 2H4z");
 assert.equal(p.closed,true);assert.deepEqual(p.segments.at(-1).at(-1),[2,4]);
 const [q]=parsePath("M1 2q2 3 4 0t4 0c1 2 2 2 3 0s2-2 3 0");
 assert.deepEqual(q.segments[1],[[5,2],[7,-1],[9,2]]);
 assert.deepEqual(q.segments[3],[[12,2],[13,0],[14,0],[15,2]]);
});
test("arc Hermite error bounded at independent dense points",()=>{
 for(const r of [.1,2,100])for(const tol of [1e-3,1e-5]){
  const segs=parsePath("M"+r+" 0A"+r+" "+r+" 0 0 1 0 "+r,{arcTolerance:tol})[0].segments;
  for(let i=0;i<segs.length;i++)for(let j=0;j<=100;j++){
   const t=j/100,a=(i+t)*Math.PI/(2*segs.length),p=evaluate(segs[i],t);
   assert.ok(Math.hypot(p[0]-r*Math.cos(a),p[1]-r*Math.sin(a))<=tol+1e-11);
  }
 }
});
test("strict opaque authored SVG subset rejects unsupported state",()=>{
 const root=x=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'+x+'</svg>';
 const a=parseIconSVG(root('<rect x="2" y="2" width="16" height="6" rx="2"/><circle cx="12" cy="12" r="2"/>'));
 assert.equal(a.ops.length,2);assert.ok(a.ops.every(x=>x.subpaths[0].closed));
 assert.throws(()=>parseIconSVG(root('<path transform="scale(2)" d="M0 0L1 1"/>')));
 assert.throws(()=>parseIconSVG(root('<path opacity=".3" d="M0 0L1 1"/>')));
 assert.throws(()=>parsePath("M0 0A1 1 0 2 0 1 1"));
});
