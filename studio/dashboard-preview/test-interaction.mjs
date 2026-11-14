import assert from "node:assert/strict";
import {test} from "node:test";
import {createInteractionController,TILE_FLOATS} from "./dashboard-interaction.js";

const make=()=>{
  const state=createInteractionController();
  state.configure([[0,0,100,100],[110,0,100,100]]);
  return state;
};
const settle=(s,count=55)=>{for(let i=0;i<count;i++)s.advance(1/60);};
test("separate tiles have separate hover and centered local coordinates",()=>{
  const s=make();
  assert.equal(s.move(25,40),0);
  settle(s);
  const v=new Float32Array(TILE_FLOATS*2);s.writeTo(v);
  assert.ok(v[12]>.97);assert.equal(v[32],0);
  assert.ok(Math.abs(v[14]-25)<.01);
  assert.ok(Math.abs(v[15]-40)<.01);
  assert.equal(s.move(150,75),1);settle(s);
  s.writeTo(v);assert.ok(v[12]<.01);assert.ok(v[32]>.97);
});
test("press releases and leave return smoothly to inactive",()=>{
  const s=make();s.move(55,55);s.setPressed(true);settle(s);
  assert.ok(s.snapshot()[0].press>.98);
  s.setPressed(false);settle(s);
  assert.ok(s.snapshot()[0].press<.01);
  s.clear();settle(s);
  assert.ok(s.snapshot()[0].hover<.01);
});
test("pointer speed is local, bounded, and settles without new events",()=>{
  const s=make();s.move(20,20);s.move(45,30);
  assert.ok(s.snapshot()[0].vx>0);
  s.move(900,900);
  assert.equal(s.focusedTile,-1);settle(s);
  assert.ok(Math.abs(s.snapshot()[0].vx)<.002);
  assert.equal(s.advance(1/60),false);
});
test("single-touch press can be cancelled and reduced motion snaps",()=>{
  const s=make();s.move(170,40);s.setPressed(true);
  s.advance(1/60,true);
  assert.equal(s.snapshot()[1].hover,1);
  assert.equal(s.snapshot()[1].press,1);
  s.clear();s.advance(1/60,true);
  assert.equal(s.snapshot()[1].hover,0);
  assert.equal(s.snapshot()[1].press,0);
});
test("layout changes preserve state yet update tile targeting",()=>{
  const s=make();s.move(20,20);settle(s);
  s.configure([[200,200,100,100],[300,200,100,100]]);
  assert.equal(s.focusedTile,-1);
  s.move(350,250);settle(s);
  assert.ok(s.snapshot()[1].hover>.98);
});
test("reject malformed buffers and invalid geometry",()=>{
  const s=make();
  assert.throws(()=>s.writeTo(new Float32Array(12)),TypeError);
  assert.throws(()=>s.configure([[NaN,0,1,1]]),TypeError);
});
