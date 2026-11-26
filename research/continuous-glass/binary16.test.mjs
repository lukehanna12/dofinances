import test from "node:test";
import assert from "node:assert/strict";
import {binary16Bits,decodeBinary16,setBinary16LE} from "./binary16.mjs";
test("portable binary16 words round-trip every finite pattern, signed zero and infinities",()=>{
 const d=new DataView(new ArrayBuffer(2));
 for(let bits=0;bits<65536;bits++){
  const x=decodeBinary16(bits);
  if(Number.isNaN(x)){assert.equal(binary16Bits(x),0x7e00);continue;}
  assert.equal(binary16Bits(x),bits);
  setBinary16LE(d,0,x);assert.equal(d.getUint16(0,true),bits);
  if(typeof d.setFloat16==="function"){d.setFloat16(0,x,true);assert.equal(d.getUint16(0,true),bits);}
 }
});
test("portable binary16 rounds all neighboring positive midpoints to nearest even without float32 double rounding",()=>{
 for(let bits=0;bits<0x7bff;bits++){
  const a=decodeBinary16(bits),b=decodeBinary16(bits+1),mid=(a+b)*.5,delta=(b-a)*2**-24;
  assert.equal(binary16Bits(mid),bits+(bits&1));
  assert.equal(binary16Bits(mid-delta),bits);
  assert.equal(binary16Bits(mid+delta),bits+1);
  assert.equal(binary16Bits(-mid),0x8000|(bits+(bits&1)));
 }
 assert.equal(binary16Bits(65519),0x7bff);assert.equal(binary16Bits(65520),0x7c00);
 assert.equal(binary16Bits(-65520),0xfc00);assert.equal(binary16Bits(-0),0x8000);
});
