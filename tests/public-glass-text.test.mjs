import test from "node:test";
import assert from "node:assert/strict";
import {CLOCK_TEXT_PROFILE as p,clockTextMaterialLanes,encodeClockDistance,decodeClockDistance,floatToHalf,clockTextField,registerGlassText} from "../sites/_apex/assets/home-dashboard/dashboard-glass-text.js";
import {validateGlassMaterial} from "../sites/_apex/assets/home-dashboard/dashboard-glass-material.js";
test("clock profile carries finite native scalar and matrix witness",()=>{
 assert.equal(validateGlassMaterial("clock-text"),"clock-text");
 assert.deepEqual(clockTextMaterialLanes().slice(0,4),[3,-60,6,2]);
 assert.equal(clockTextMaterialLanes().length,16);
 assert.equal(p.blurWord,Math.fround(1.2));assert.equal(p.bleedWord,8);
 assert.equal(p.sdfBits,10);assert.equal(p.holdingWhite,.97021484375);
 assert.equal(p.keyHeight,.75);assert.equal(p.fillHeight,.75);
 assert.equal(p.gradientBias,.25);assert.equal(p.curvature,.7);
});
test("ten-bit distance codes survive half storage exactly; coverage is independent",()=>{
 assert.equal(encodeClockDistance(1),0);assert.equal(encodeClockDistance(-24),1023);
 assert.equal(decodeClockDistance(0),1);assert.equal(decodeClockDistance(1023),-24);
 assert.equal(floatToHalf(1023),0x63fe);assert.equal(floatToHalf(1),0x3c00);
 assert.equal(floatToHalf(-1),0xbc00);assert.equal(floatToHalf(.5),0x3800);
 const a=new Uint8Array(25);a[12]=255;a[11]=128;
 const field=clockTextField(a,5,5,2);
 assert.equal(field.length,100);
 assert.equal(field[12*4+3],0x3c00);assert.equal(field[11*4+3],floatToHalf(128/255));
 assert.equal(field[3],0);assert.ok(field[12*4]>field[0]);
 assert.ok(Array.from(field).every(v=>(v&0x7c00)!==0x7c00));
});
test("registration is independent of route and text content",()=>{
 const node={dataset:{},textContent:"Å字 مرحبا 🧪"};
 assert.equal(registerGlassText(node),node);
 assert.deepEqual(node.dataset,{glassText:"clock-text",glassMaterial:"clock-text"});
});
