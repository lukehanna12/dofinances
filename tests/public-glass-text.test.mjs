import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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
 assert.equal(field[3],0);assert.ok(field[12*4]>0);assert.equal(field[0]&0x8000,0);
 assert.ok(Array.from(field).every(v=>(v&0x7c00)!==0x7c00));
});
test("registration is independent of route and text content",()=>{
 const node={dataset:{},textContent:"Å字 مرحبا 🧪"};
 assert.equal(registerGlassText(node),node);
 assert.deepEqual(node.dataset,{glassText:"clock-text",glassMaterial:"clock-text"});
});

test("clock glyphs use the coordinate space of their draw target, not their material tag",()=>{
 const shader=readFileSync(new URL("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl",import.meta.url),"utf8");
 const renderer=readFileSync(new URL("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js",import.meta.url),"utf8");
 assert.match(shader,/let routePane=authPane && state\.fit\.w>0\.0;/);
 assert.match(shader,/if\(routePane\)\{\s*backdropExtent\.y=max\(1\.0,state\.fit\.w\);\s*backdropPosition\.y-=state\.pointer\.w;/);
 assert.match(renderer,/uniform\[7\]=0;/);
 assert.match(renderer,/authUniform\[7\]=physicalHeight;/);
 assert.match(renderer,/pass\.setBindGroup\(0,glassGroup\);\s*pass\.draw\(6,1,0,tileCount\+audit\.homeCtaGlass\.brandSlot\)/);
});

test("disconnected glyphs preserve exterior distance and one shared dissolve coordinate system",()=>{
 const width=31,height=11,a=new Uint8Array(width*height);
 for(let y=3;y<=7;y++)for(const x of [3,4,5,25,26,27])a[y*width+x]=255;
 const field=clockTextField(a,width,height,1);
 const code=(x,y)=>field[(y*width+x)*4];
 const coverage=(x,y)=>field[(y*width+x)*4+3];
 assert.equal(coverage(15,5),0);
 assert.equal(coverage(4,5),0x3c00);
 assert.ok((code(15,5)&0x8000)!==0);
 assert.ok((code(15,5)&0x7fff)>(code(8,5)&0x7fff),"Distance increases into the gap between glyphs");
 const shader=readFileSync(new URL("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl",import.meta.url),"utf8");
 const continuous=readFileSync(new URL("../sites/_apex/assets/home-dashboard/dashboard-glass-continuous.js",import.meta.url),"utf8");
 assert.match(shader,/glyph=titleDismissField\(in.local,dimensions,in.tileIndex,glyph\)/);
 assert.match(shader,/let dissolveExtent=select\(tile.rect.zw,vec2<f32>\(min\(tile.rect.z,tile.rect.w\)\),glassTitle\)/);
 assert.match(shader,/smoothstep\(5.0,8.0,max\(signed,0.0\)\/pointScale\)/);
 assert.match(continuous,/let d=pathDistance\(q.p,q.root,q.tol\)\*q.px/);
});
