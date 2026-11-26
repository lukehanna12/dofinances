import {setBinary16LE} from "./binary16.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {sampleBGRA8,heldout} from "./bgra8-sampler.mjs";
import {nativeBGRA8Downsample} from "./native-diamond.mjs";
const hash=x=>createHash("sha256").update(x).digest("hex");
const words=values=>{const b=new ArrayBuffer(values.length*2),v=new DataView(b);values.forEach((a,i)=>setBinary16LE(v,i*2,a));return new Uint8Array(b);};
export const cases=[
[16,16,"0d9dda42556fab2893e472d74ee7ae64f0e94e699a735a9447dc6513ed539bba"],
[29,19,"57c82fbdbf8f8d3c24f0b32c4d839073ab5d20d9f785611744d76758509657d7"],
[7,11,"72eaa2db57253ab4b8bf025c48a3461fcd9ed8e411d24a6036c9fc5c519f8d9a"],
[64,32,"9c91551de111b696bfaa5116de9a80313b4c9f14df5bd68b6a2bb3956cd6fac3"],
[1,9,"b08891764f53a21861e59521b613cac2587cd0c85d4a529df8f115696abf376a"],
[9,1,"8c4ef3218ddcb1f5e72350d8e3b4792bacdf3e1c3793dc3941093cefebbe9420"]];
test("six independent native BGRA8 sampler byte hashes",()=>{
 for(let i=0;i<cases.length;i++){
  const [w,h,expected]=cases[i],{src,points}=heldout(w,h,i),v=[];
  for(let j=0;j<points.length;j+=2)for(const c of [2,1,0,3])v.push(sampleBGRA8(src,w,h,points[j],points[j+1],c));
  assert.equal(hash(words(v)),expected);
 }
});
test("three odd native downsample texture hashes",()=>{
 const cases=[[9,7,"0a9fac28c0afb9f674c4cf8a3c589f7a7a6daa768074abe522dce83e567c29af"],[17,11,"2239515f5bd279a93c1d25ee03a0f0208f8a092fcec5969bb262154cbb6ae91e"],[63,31,"0ace6284d72241c6dbd9615b39315c73cc0142680df95a8da921c4a1961784da"]];
 for(let i=0;i<cases.length;i++){
  const [w,h,expected]=cases[i],src=Uint8Array.from({length:w*h*4},(_,j)=>{const x=(j>>2)%w,y=Math.floor(j/(4*w)),k=j%4,v=(17*x*x+13*y*y+11*x*y+7*k*x+19*k*y+23*k+3*(i+4))%127;return v*2+(x+y+k)%2;});
  assert.equal(hash(nativeBGRA8Downsample(src,w,h).values),expected);
 }
});
