import {test} from "node:test";
import assert from "node:assert/strict";
import {TRACK_ROWS,TRACK_LANES,TRACK_SECONDS,phaseAtSeconds,trackPosition}
  from "./dashboard-track.js";
test("a 168-second continuous seven-lane circuit has six original rows",()=>{
  assert.equal(TRACK_ROWS,6);assert.equal(TRACK_LANES,7);
  assert.equal(TRACK_SECONDS,168);
  assert.equal(phaseAtSeconds(0),0);
  assert.equal(phaseAtSeconds(24),1);
  assert.equal(phaseAtSeconds(168),0);
  assert.equal(phaseAtSeconds(336),0);
});
test("all authored initial rows remain in their slots at full opacity",()=>{
  for(let i=0;i<6;i++){
    const x=trackPosition(i,0);
    assert.ok(Math.abs(x.slot-i)<1e-8);
    assert.equal(x.opacity,1);
  }
});
test("top square exits above original top row with a soft fade",()=>{
  assert.ok(Math.abs(trackPosition(0,.5).opacity-.5)<1e-7);
  assert.equal(trackPosition(0,1).slot,-1);
  assert.equal(trackPosition(0,1).opacity,0);
});
test("same square reappears below original bottom, fading into bottom row",()=>{
  const wrapped=trackPosition(0,1+1e-7);
  assert.ok(wrapped.slot>5.9);
  assert.ok(wrapped.opacity<1e-10);
  assert.ok(Math.abs(trackPosition(0,1.5).opacity-.5)<1e-7);
  assert.equal(trackPosition(0,2).slot,5);
  assert.equal(trackPosition(0,2).opacity,1);
});
test("wraps have no visible teleport at the invisible seam",()=>{
  const a=trackPosition(0,1-1e-5),b=trackPosition(0,1+1e-5);
  assert.ok(a.opacity<1e-8&&b.opacity<1e-8);
  const c=trackPosition(0,7-1e-5),d=trackPosition(0,0);
  assert.ok(Math.abs(c.slot-d.slot)<1e-4);
});
test("bounded alpha, finite positions and fail-closed inputs",()=>{
  for(let i=0;i<6;i++)for(let p=0;p<=7;p+=.013){
    const x=trackPosition(i,p);
    assert.ok(x.slot>=-1-1e-8&&x.slot<=6+1e-8);
    assert.ok(x.opacity>=0&&x.opacity<=1);
  }
  assert.throws(()=>trackPosition(6,0),RangeError);
  assert.throws(()=>trackPosition(-1,0),RangeError);
  assert.throws(()=>trackPosition(0,Infinity),RangeError);
  assert.throws(()=>phaseAtSeconds(-1),RangeError);
});
