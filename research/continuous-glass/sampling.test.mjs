import {test} from "node:test";
import assert from "node:assert/strict";
import {ContinuousScene,axisTerms,publicBlitCandidate,finiteConstantMipLOD,finiteMipSelection} from "./sampling.mjs";
import {integrateBox,boxAxisWeights} from "./reference.mjs";
const close=(a,b,t=2e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),a+" != "+b);
test("sparse integrated tent basis agrees with direct weights",()=>{
 for(const n of [1,2,3,7,41])for(const lo of [-100,-2,-.1,0,.17,1,2.5,8,40,100])for(const len of [0,.01,.2,1,2.3,12,201]){
  const a=axisTerms(n,lo,lo+len),w=Array(n).fill(0);
  for(const [i,j,k] of a)for(let p=i;p<=j;p++)w[p]+=k;
  close(w.reduce((a,b)=>a+b,0),1);boxAxisWeights(n,lo,lo+len).forEach((v,i)=>close(w[i],v));
 }
});
test("constant-cost prefix-integral scene agrees with independent full-grid reference",()=>{
 const w=43,h=31,rgba=Array.from({length:w*h*4},(_,i)=>Math.sin(i*.079)+Math.cos(i*.015)*.17);
 const sc=new ContinuousScene(w,h,rgba,{origin:[-14.3,27.1],step:[2.3,.8]});
 for(const x of [-150,-14.3,-11.7,1.19,45,80,200])for(const y of [-90,27.1,30.8,42.3,51,250])for(const [rx,ry] of [[0,0],[.02,.07],[3,5],[17,26],[200,400]]){
  const a=sc.box(x,y,rx,ry);
  for(let c=0;c<4;c++)close(a[c],integrateBox(rgba.filter((_,i)=>i%4===c),w,h,(x-rx+14.3)/2.3,(x+rx+14.3)/2.3,(y-ry-27.1)/.8,(y+ry-27.1)/.8),3e-8);
 }
});
test("finite mip and LOD semantics separated from continuous reconstruction",()=>{
 const src=Array.from({length:5*3*4},(_,i)=>{const x=Math.floor(i/4)%5,y=Math.floor(i/20);return (x+2*y)/32;});
 const a=publicBlitCandidate(src,5,3);assert.equal(a.width,2);assert.equal(a.height,1);close(a.values[0],2.75/32);close(a.values[4],5.25/32);
 assert.equal(finiteConstantMipLOD(.501,[0,1,2]),.5);
 assert.deepEqual(finiteMipSelection(100,60,1.25,2.5),{p:4,q:2,available:3,selected:1});
 assert.throws(()=>finiteMipSelection(4096,4096,100,100));
});
