import {test} from "node:test";
import assert from "node:assert/strict";
import {TRACK_ROWS,TRACK_LANES,TRACK_SECONDS,TRACK_FADE_ROWS,TRACK_COLUMNS,
  TRACK_CURVE_STRENGTH,trackCurve,phaseAtSeconds,trackPosition}
  from "../sites/_apex/app/assets/dashboard-track.js";

const near=(actual,expected,epsilon=1e-7)=>
  assert.ok(Math.abs(actual-expected)<epsilon,`Expected ${actual} ≈ ${expected}`);

test("35%-faster seven-lane circuit retains its original geometry and timing",()=>{
  assert.equal(TRACK_ROWS,7);
  assert.equal(TRACK_LANES,7);
  assert.equal(TRACK_FADE_ROWS,2);
  assert.equal(TRACK_COLUMNS,11);
  assert.equal(TRACK_CURVE_STRENGTH,.8);
  assert.equal(TRACK_SECONDS,84/(1.15*1.30*1.35));
  near(TRACK_SECONDS,41.62021553325901,1e-10);
  near((84/(1.15*1.30))/TRACK_SECONDS,1.35,1e-10);
  assert.equal(phaseAtSeconds(0),0);
  near(phaseAtSeconds(TRACK_SECONDS/7),1,1e-10);
  assert.equal(phaseAtSeconds(TRACK_SECONDS),0);
  assert.equal(phaseAtSeconds(2*TRACK_SECONDS),0);
});

test("two-row edge gradients keep the six original row positions unchanged",()=>{
  for(let row=0;row<6;row++){
    const pos=trackPosition(row,0);
    near(pos.slot,row,1e-8);
    assert.equal(pos.deltaRows,0);
    assert.equal(pos.opacity,row===0||row===5?.5:1);
  }
  assert.equal(trackPosition(6,0).slot,6);
  assert.equal(trackPosition(6,0).opacity,0);
});

test("upper fade spans precisely two row pitches (-1 to +1)",()=>{
  assert.equal(trackPosition(0,1).slot,-1);
  assert.equal(trackPosition(0,1).opacity,0);
  assert.equal(trackPosition(0,0).opacity,.5);
  assert.equal(trackPosition(1,0).opacity,1);
  near(trackPosition(0,.5).opacity,.15625);
  near(trackPosition(1,.5).opacity,.84375);
});

test("lower fade spans precisely two row pitches (+6 to +4)",()=>{
  assert.equal(trackPosition(6,0).opacity,0);
  near(trackPosition(6,.5).slot,5.5,1e-8);
  near(trackPosition(6,.5).opacity,.15625);
  assert.equal(trackPosition(6,1).opacity,.5);
  assert.equal(trackPosition(6,2).opacity,1);
  assert.equal(trackPosition(5,0).opacity,.5);
  assert.equal(trackPosition(4,0).opacity,1);
  near(trackPosition(5,.5).opacity,.84375);
});

test("top and bottom always contain partially fading rows at every phase",()=>{
  const partial=p=>p.opacity>0&&p.opacity<1;
  for(let phase=0;phase<TRACK_LANES;phase+=.017){
    const positions=Array.from({length:TRACK_ROWS},(_,row)=>trackPosition(row,phase));
    assert.ok(positions.some(p=>p.slot>=-1&&p.slot<1&&partial(p)),
      `Missing partly fading upper row at phase ${phase}`);
    assert.ok(positions.some(p=>p.slot>4&&p.slot<=6&&partial(p)),
      `Missing partly appearing lower row at phase ${phase}`);
    assert.ok(positions.every(p=>p.opacity>=0&&p.opacity<=1));
  }
});

test("the same row wraps below the grid invisibly, then fades in over two rows",()=>{
  const justBefore=trackPosition(0,1-1e-5);
  const justAfter=trackPosition(0,1+1e-5);
  assert.ok(justBefore.opacity<1e-8&&justAfter.opacity<1e-8);
  assert.ok(justAfter.slot>5.9);
  near(trackPosition(0,1.5).opacity,.15625);
  assert.equal(trackPosition(0,2).slot,5);
  assert.equal(trackPosition(0,2).opacity,.5);
  assert.equal(trackPosition(0,3).slot,4);
  assert.equal(trackPosition(0,3).opacity,1);
  const end=trackPosition(0,7-1e-5);
  const start=trackPosition(0,0);
  near(end.slot,start.slot,1e-4);
  near(end.opacity,start.opacity,1e-4);
});


test("top convex and bottom concave contours arch across all eleven columns",()=>{
  near(trackCurve(0),0);
  near(trackCurve(10),0);
  near(trackCurve(5),1);
  for(let col=0;col<TRACK_COLUMNS;col++){
    near(trackCurve(col),trackCurve(10-col));
    // At the edges, the established straight-line fade remains unchanged.
    const upper=trackPosition(0,0,col);
    const lower=trackPosition(5,0,col);
    near(upper.opacity,lower.opacity);
    assert.ok(upper.opacity>=.5&&upper.opacity<=1);
    assert.ok(lower.opacity>=.5&&lower.opacity<=1);
    if(col>0&&col<=5){
      assert.ok(upper.opacity>=trackPosition(0,0,col-1).opacity);
      assert.ok(lower.opacity>=trackPosition(5,0,col-1).opacity);
    }
  }
  near(trackPosition(0,0,0).opacity,.5);
  near(trackPosition(0,0,10).opacity,.5);
  assert.ok(trackPosition(0,0,5).opacity>.5);
  near(trackPosition(5,0,0).opacity,.5);
  near(trackPosition(5,0,10).opacity,.5);
  assert.ok(trackPosition(5,0,5).opacity>.5);
  // Higher visibility in the middle means the upper half-alpha contour
  // lies closer to the top (∩), while the lower contour lies lower (∪).
  assert.ok(trackPosition(0,-.2,5).opacity>trackPosition(0,-.2,0).opacity);
  assert.ok(trackPosition(5,-.2,5).opacity>trackPosition(5,-.2,0).opacity);
});

test("curved fade preserves wrap invisibility, support, timing and DOM/GPU alpha bounds",()=>{
  for(let col=0;col<TRACK_COLUMNS;col++){
    near(trackPosition(0,1,col).opacity,0);
    near(trackPosition(6,0,col).opacity,0);
    near(trackPosition(1,0,col).opacity,1);
    near(trackPosition(4,0,col).opacity,1);
    for(let row=0;row<TRACK_ROWS;row++)
      for(let phase=0;phase<TRACK_LANES;phase+=.073){
        const p=trackPosition(row,phase,col);
        assert.ok(Number.isFinite(p.deltaRows));
        assert.ok(p.opacity>=0&&p.opacity<=1);
      }
    // Both wrap endpoints remain invisible regardless of horizontal bend.
    assert.ok(trackPosition(0,1-1e-6,col).opacity<1e-8);
    assert.ok(trackPosition(0,1+1e-6,col).opacity<1e-8);
  }
  assert.throws(()=>trackPosition(0,0,-1),RangeError);
  assert.throws(()=>trackPosition(0,0,11),RangeError);
  assert.throws(()=>trackCurve(1.5),RangeError);
});
test("bounded alpha, finite positions and fail-closed inputs",()=>{
  for(let row=0;row<TRACK_ROWS;row++)for(let phase=0;phase<=7;phase+=.013){
    const pos=trackPosition(row,phase);
    assert.ok(pos.slot>=-1-1e-8&&pos.slot<=6+1e-8);
    assert.ok(pos.opacity>=0&&pos.opacity<=1);
  }
  assert.throws(()=>trackPosition(7,0),RangeError);
  assert.throws(()=>trackPosition(-1,0),RangeError);
  assert.throws(()=>trackPosition(0,Infinity),RangeError);
  assert.throws(()=>phaseAtSeconds(-1),RangeError);
});
