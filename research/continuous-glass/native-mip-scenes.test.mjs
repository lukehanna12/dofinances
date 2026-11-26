import test from "node:test";
import assert from "node:assert/strict";
import {fixedMipScenes,fixedMipField} from "./native-mip-scenes.mjs";
import {sampleBGRA8Mip} from "./bgra8-sampler.mjs";
const abi={base:[0,0],limits:[0,0,9,13],baseSize:[10,14],mipSize:[5,7],noBaseMip:false,levelCount:4};
const src=Uint8Array.from({length:10*14*4},(_,j)=>j%4===3?255:(j*73+17)%256);
test("fixed mip field preserves encoded channel order, odd-axis phase and explicit LOD",()=>{
 const e=fixedMipScenes(src,10,14,{...abi,origin:[10000,-20000],step:[.25,.5]}),f=fixedMipField(e);
 assert.deepEqual(e.map(x=>[x.scene.width,x.scene.height]),[[10,14],[5,7],[2,3],[1,1]]);
 assert.deepEqual(f.continuous(10000,-20000,0),[src[2]/255,src[1]/255,src[0]/255,1]);
 for(const u of [.1,.3,.6,.95])for(const v of [.1,.6,.9])for(const l of [0,.5,1,1.75,2,2.5,3]){
  const x=10000-.125+2.5*u,y=-20000-.25+7*v,[a,b]=f.uv(x,y);
  assert.deepEqual(f.native(x,y,l),[2,1,0,3].map(c=>sampleBGRA8Mip(e.map(z=>z.level),a,b,l,c)));
  const result=f.continuous(x,y,l),lo=Math.floor(l),hi=Math.min(3,lo+1),p=l-lo,A=e[lo].scene.box(x,y),B=e[hi].scene.box(x,y);
  result.forEach((z,c)=>assert.ok(Math.abs(z-(A[c]*(1-p)+B[c]*p))<1e-12));
 }
});
test("continuous mip field continuity and camera-independent logical reconstruction",()=>{
 const e=fixedMipScenes(src,10,14,abi),f=fixedMipField(e);
 for(const l of [1,2])for(const [x,y] of [[.125,1.5],[4.6,7.75],[9,13]]){
  const a=f.continuous(x,y,l),b=f.continuous(x,y,l-1e-7),c=f.continuous(x,y,l+1e-7);
  a.forEach((v,k)=>{assert.ok(Math.abs(v-b[k])<1e-6);assert.ok(Math.abs(v-c[k])<1e-6);});
  const same=f.continuous(x*8/8,y*8/8,l);assert.deepEqual(a,same);
 }
});
