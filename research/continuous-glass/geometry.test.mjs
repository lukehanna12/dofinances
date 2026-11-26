import {test} from "node:test";
import assert from "node:assert/strict";
import {mode4Field,mode5Field,half,distanceCastDiagnostic,normalMismatch} from "./native-field.mjs";
import {evaluate,closestCurve,contourField} from "./vector-field.mjs";
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),a+" != "+b);
test("mode 4 scaling, reflection and finite normal field",()=>{
 let count=0;
 for(const [w,h,r] of [[80,80,19],[911.5,8,2],[190,52,26],[52,190,12],[913,307.5,73.125]])
 for(const s of [.001,.125,1,8,128,1024])
 for(const x of [.013,.17,.31,.49,.51,.82])
 for(const y of [.021,.19,.33,.47,.55,.83]){
  const a=mode4Field(x*w,y*h,w,h,r),b=mode4Field(-x*w*s,y*h*s,w*s,h*s,r*s);
  near(a.distance,b.distance/s);near(a.opticalNormal[0],-b.opticalNormal[0]);near(a.opticalNormal[1],b.opticalNormal[1]);near(Math.hypot(...a.opticalNormal),1);
  assert.ok(a.denominator>0);count++;
 }
 assert.equal(count,1080);
});
test("analytic derivatives are not silently replaced by recovered optical normals",()=>{
 let checked=0,largest=0;
 for(let i=1;i<18;i++)for(let j=1;j<18;j++){
  const x=20+i*1.13,y=13+j*.91,a=mode4Field(x,y,80,64,19);
  if(!a.gradient)continue;
  const e=1e-4,gx=(mode4Field(x+e,y,80,64,19).distance-mode4Field(x-e,y,80,64,19).distance)/(2*e),
   gy=(mode4Field(x,y+e,80,64,19).distance-mode4Field(x,y-e,80,64,19).distance)/(2*e);
  near(a.gradient[0],gx,1e-6);near(a.gradient[1],gy,1e-6);
  largest=Math.max(largest,normalMismatch(a)??0);checked++;
 }
 assert.ok(checked>150);assert.ok(largest>.05);
});
test("mode 5 private lanes: scale equivariance and mirror permutation",()=>{
 for(const lanes of [[-20,-3,-20,-36],[-12,-28,-44,-6],[20,3,20,36]])
 for(const x of [-53,-23,9,64])for(const y of [-39,-14,12,45]){
  const a=mode5Field(x,y,160,110,lanes),b=mode5Field(x*16,y*16,2560,1760,lanes.map(r=>r*16));
  near(a.distance,b.distance/16);near(a.opticalNormal[0],b.opticalNormal[0]);near(a.opticalNormal[1],b.opticalNormal[1]);
  const [tl,tr,br,bl]=lanes,c=mode5Field(-x,y,160,110,[tr,tl,bl,br]);
  near(a.distance,c.distance);
  if(a.ties===1&&c.ties===1){near(a.opticalNormal[0],-c.opticalNormal[0]);near(a.opticalNormal[1],c.opticalNormal[1]);}
 }
});
test("AIR truncation order differs from final-only rounding",()=>{
 assert.equal(half(1+2**-11),1);assert.equal(half(1+3*2**-11),1+2**-9);
 assert.equal(half(2**-25),0);assert.equal(half(65520),Infinity);
 let changes=0;for(let x=10;x<65;x+=.51)for(let y=8;y<46;y+=.77){
  const a=distanceCastDiagnostic(mode4Field(x,y,100,70,21));
  if(a.finalOnly!==a.airCastOrder)changes++;
 }
 assert.ok(changes>100);
});
test("independent exact line and quadratic nearest-point controls",()=>{
 for(const s of [.001,1,128,1024]){
  const a=closestCurve([[0,0],[4*s,0]],[2*s,3*s],{tolerance:s*1e-7});
  near(a.distance,3*s);
  // Symmetric quadratic arch has unique nearest point at its apex for this query.
  const b=closestCurve([[-s,0],[0,2*s],[s,0]],[0,2*s],{tolerance:s*1e-7});
  assert.ok(b.converged);assert.ok(b.lower<=s+1e-12);assert.ok(b.upper>=s-1e-12);near(b.distance,s,1e-7);
 }
});
test("cubic bounds enclose independently sampled minima and converge",()=>{
 const cs=[[[0,0],[2,5],[4,-4],[6,1]],[[0,0],[5,0],[-5,1],[0,1]],[[0,0],[0,0],[0,0],[0,0]]];
 for(const c of cs)for(const p of [[.3,.2],[2,3],[-1,.8],[0,0]]){
  const a=closestCurve(c,p,{tolerance:1e-6});assert.ok(a.converged);
  let sample=Infinity;for(let i=0;i<=20000;i++){const q=evaluate(c,i/20000);sample=Math.min(sample,Math.hypot(q[0]-p[0],q[1]-p[1]));}
  assert.ok(a.lower<=sample+1e-12);assert.ok(a.upper<=sample+1e-6);assert.ok(a.upper-a.lower<=1e-6);
 }
 const limited=closestCurve(cs[0],[2,3],{tolerance:1e-15,maxNodes:1});assert.equal(limited.converged,false);
});
const square=(x,y,w,h)=>[[[x,y],[x+w,y]],[[x+w,y],[x+w,y+h]],[[x+w,y+h],[x,y+h]],[[x,y+h],[x,y]]];
test("closed contours, winding and holes, boundaries fail closed",()=>{
 const outer=square(0,0,20,20),hole=square(5,5,10,10).reverse().map(s=>s.slice().reverse());
 assert.equal(contourField([outer,hole],[10,10]).inside,false);
 assert.equal(contourField([outer,hole],[2,10]).distance,-2);
 assert.equal(contourField([outer,hole],[25,10]).distance,5);
 assert.equal(contourField([outer,hole],[0,10]).distance,null);
 assert.equal(contourField([outer,square(5,5,10,10)],[10,10],{fillRule:"evenodd"}).inside,false);
 assert.equal(contourField([outer,square(5,5,10,10)],[10,10]).inside,true);
 assert.throws(()=>contourField([[[[0,0],[1,0]]]],[1,1]));
 const lens=[[[-2,0],[0,-4],[2,0]],[[2,0],[0,4],[-2,0]]];
 assert.equal(contourField([lens],[0,0]).inside,true);
 assert.equal(contourField([lens],[0,3]).inside,false);
 assert.equal(contourField([lens],[3,0]).inside,false);
});
test("vector field is invariant across coordinate scale with explicit tolerance",()=>{
 const c=[[[-2,0],[0,-4],[2,0]],[[2,0],[0,4],[-2,0]]];
 for(const p of [[.2,.1],[.4,3],[-3,1]]) {
  const a=contourField([c],p,{tolerance:1e-6});assert.ok(a.converged);
  for(const scale of [.001,1,8,128,1024]){
   const b=contourField([c.map(s=>s.map(q=>q.map(v=>v*scale)))],p.map(v=>v*scale),{tolerance:1e-6*scale});
   assert.ok(b.converged);assert.equal(a.inside,b.inside);near(a.distance,b.distance/scale,2e-6);
  }
 }
});
