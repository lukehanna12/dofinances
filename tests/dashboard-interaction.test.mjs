import assert from "node:assert/strict";
import {test} from "node:test";
import {createInteractionController,TILE_FLOATS} from "../sites/_apex/app/assets/dashboard-interaction.js";

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
test("interaction never erases the renderer-owned glass opacity or dismissal lanes",()=>{
  const s=make(),data=new Float32Array(2*TILE_FLOATS);
  data[18]=1;data[19]=.75;data[38]=.63;data[39]=.35;
  s.move(35,35);s.advance(1/60);s.writeTo(data);
  assert.equal(data[18],1,"Sign-in card must not lose its alpha after hover writes");
  assert.equal(data[19],.75,"Independent glass dismissal must be preserved");
  assert.ok(Math.abs(data[38]-.63)<1e-6,"Second pane alpha must survive");
  assert.ok(Math.abs(data[39]-.35)<1e-6,"Second pane dismissal must survive");
  assert.ok(data[12]>0,"Interaction state still flows to the shared shader");
});
test("reject malformed buffers and invalid geometry",()=>{
  const s=make();
  assert.throws(()=>s.writeTo(new Float32Array(12)),TypeError);
  assert.throws(()=>s.configure([[NaN,0,1,1]]),TypeError);
});

test("moving tile targeting updates without resetting existing springs",()=>{
  const s=make();s.move(20,20);settle(s);
  const before=s.snapshot()[0].hover;
  const data=new Float32Array(2*TILE_FLOATS);
  data.set([0,120,100,100],0);
  data.set([110,120,100,100],TILE_FLOATS);
  s.retargetRects(data);
  assert.equal(s.focusedTile,-1);
  assert.equal(s.snapshot()[0].hover,before);
  s.move(20,150);
  assert.equal(s.focusedTile,0);
  settle(s);
  assert.ok(s.snapshot()[0].hover>.97);
  assert.throws(()=>s.retargetRects(new Float32Array(8)),TypeError);
});

test("corner-only hit mask leaves every perceptible tile hoverable",()=>{
  const s=make();
  const data=new Float32Array(2*TILE_FLOATS);
  data.set([0,0,100,100],0);data.set([110,0,100,100],TILE_FLOATS);
  s.move(35,35);settle(s);
  const hoverBefore=s.snapshot()[0].hover;
  s.retargetRects(data,new Uint8Array([1,0]));
  assert.equal(s.focusedTile,-1,"Newly imperceptible corner must release hit");
  assert.equal(s.snapshot()[0].hover,hoverBefore,"No spring-state reset");
  assert.equal(s.move(35,35),-1,"No hit on fully gated corner");
  assert.equal(s.move(150,40),1,"Other squares keep full pointer response");
  s.retargetRects(data,new Uint8Array([0,0]));
  assert.equal(s.move(35,35),0,"The same square reactivates when perceptible");
  s.retargetRects(data);
  assert.equal(s.move(150,40),1,"Legacy API remains fully interactive");
  assert.throws(()=>s.retargetRects(data,new Uint8Array(1)),TypeError);
  assert.throws(()=>s.retargetRects(data,new Float32Array(2)),TypeError);
});
