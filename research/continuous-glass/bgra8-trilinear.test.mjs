import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {weightsQ16,trilinearHeldout,sampleBGRA8Mip} from "./bgra8-sampler.mjs";
import {cases} from "./bgra8-trilinear-fixtures.mjs";
test("trilinear exact column conservation",()=>{for(const p of [0,1,17,128,255,256])for(let q=0;q<=256;q++)for(let r=0;r<=64;r++){const [a,b,c,d]=weightsQ16(p,q,r);assert.equal(a+c,(256-p)*r*4);assert.equal(b+d,p*r*4);assert.ok(Math.min(a,b,c,d)>=0);}});
test("native trilinear 98304 exact half lanes",()=>{for(const [k,w,h,n,native] of cases){
 const {levels,points}=trilinearHeldout(w,h,k,n),cpu=new DataView(new ArrayBuffer(n*8));
 for(let j=0;j<n;j++)for(let c=0;c<4;c++)cpu.setFloat16(j*8+c*2,sampleBGRA8Mip(levels,points[4*j],points[4*j+1],points[4*j+2],[2,1,0,3][c]),true);
 assert.equal(createHash("sha256").update(new Uint8Array(cpu.buffer)).digest("hex"),native);
}});
