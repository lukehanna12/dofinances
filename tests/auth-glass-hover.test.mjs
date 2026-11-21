import assert from "node:assert/strict";
import {test} from "node:test";
import {createAuthGlassHoverController} from
  "../sites/_apex/assets/home-dashboard/dashboard-auth-hover.js";
import {TILE_FLOATS} from
  "../sites/_apex/assets/home-dashboard/dashboard-interaction.js";

const BASE=2,CAPACITY=3;
const make=()=>{
  const s=createAuthGlassHoverController(CAPACITY);
  const data=new Float32Array((BASE+CAPACITY)*TILE_FLOATS);
  for(let i=0;i<BASE*TILE_FLOATS;i++)data[i]=i+1;
  const put=(i,rect)=>data.set(rect,(BASE+i)*TILE_FLOATS);
  put(0,[100,100,300,400]); // Untinted card.
  put(1,[135,275,230,54]); // Nested tinted button.
  put(2,[135,365,230,54]); // Another tinted control.
  const mask=new Uint8Array(BASE+CAPACITY);
  s.retargetRects(data,BASE,mask);
  return {s,data,mask};
};
const settle=(s,n=65)=>{for(let i=0;i<n;i++)s.advance(1/60);};

test("sign-in card remains hovered while a nested button also gets hover",()=>{
  const {s}=make();
  s.move(170,150);settle(s);
  assert.equal(s.cardHovered,true);
  assert.equal(s.controlHovered,false);
  assert.ok(s.snapshot(0).hover>.99);
  s.move(190,300);settle(s);
  assert.equal(s.cardHovered,true);
  assert.equal(s.controlHovered,true);
  assert.equal(s.activeControl,1);
  assert.ok(s.snapshot(0).hover>.99,
    "Moving to a button must not dismiss the surrounding card's highlight");
  assert.ok(s.snapshot(1).hover>.99,
    "Nested button should acquire its own highlight at the same time");
  assert.ok(Math.abs(s.snapshot(0).x-90)<.01);
  assert.ok(Math.abs(s.snapshot(0).y-200)<.01);
});

test("card and button hover dissolve at the LAST coordinates on pointer exit",()=>{
  const {s}=make();
  s.move(190,300);settle(s);
  const card=s.snapshot(0),button=s.snapshot(1);
  assert.ok(card.hover>.99&&button.hover>.99);
  s.move(460,150);s.advance(1/60);
  assert.equal(s.cardHovered,false);
  assert.equal(s.controlHovered,false);
  const leavingCard=s.snapshot(0),leavingButton=s.snapshot(1);
  assert.equal(leavingCard.x,card.x);
  assert.equal(leavingCard.y,card.y);
  assert.equal(leavingButton.x,button.x);
  assert.equal(leavingButton.y,button.y);
  assert.ok(leavingCard.hover>0,
    "Card must fade out rather than disappear immediately");
  assert.ok(leavingCard.hover<card.hover);
  settle(s,70);
  const fadedCard=s.snapshot(0),fadedButton=s.snapshot(1);
  assert.ok(fadedCard.hover<.005&&fadedButton.hover<.005);
  assert.equal(fadedCard.x,card.x);
  assert.equal(fadedCard.y,card.y);
  assert.equal(fadedButton.x,button.x);
  assert.equal(fadedButton.y,button.y);
});

test("auth hover overrides only auth instances, never square lanes or opacity",()=>{
  const {s,data}=make();
  const originalSquares=data.slice(0,BASE*TILE_FLOATS);
  data[(BASE+0)*TILE_FLOATS+18]=1;
  data[(BASE+1)*TILE_FLOATS+18]=.8;
  data[(BASE+2)*TILE_FLOATS+18]=.3;
  data[(BASE+1)*TILE_FLOATS+19]=.75;
  s.move(190,300);settle(s);
  s.writeTo(data,BASE);
  assert.deepEqual(data.slice(0,BASE*TILE_FLOATS),originalSquares,
    "The homepage square instance bytes must be completely unaffected");
  assert.equal(data[(BASE+0)*TILE_FLOATS+18],1);
  assert.ok(Math.abs(data[(BASE+1)*TILE_FLOATS+18]-.8)<1e-6);
  assert.ok(Math.abs(data[(BASE+2)*TILE_FLOATS+18]-.3)<1e-6);
  assert.equal(data[(BASE+1)*TILE_FLOATS+19],.75);
});

test("late-mounted card initializes at its own center, not an offscreen dummy",()=>{
  const s=createAuthGlassHoverController(2);
  const data=new Float32Array(2*TILE_FLOATS);
  data.set([-100000,-100000,1,1],0);
  data.set([-100000,-100000,1,1],TILE_FLOATS);
  const mask=new Uint8Array([1,1]);
  s.retargetRects(data,0,mask);
  data.set([100,100,300,400],0);
  data.set([125,250,210,45],TILE_FLOATS);
  mask.fill(0);
  s.retargetRects(data,0,mask);
  assert.equal(s.snapshot(0).x,150);
  assert.equal(s.snapshot(0).y,200);
  assert.equal(s.snapshot(1).x,105);
  assert.equal(s.snapshot(1).y,22.5);
});

test("auth-only hover respects masked/unmounted elements and pointer cancellation",()=>{
  const {s,data,mask}=make();
  mask[BASE+1]=1;
  s.retargetRects(data,BASE,mask);
  s.move(190,300);settle(s);
  assert.equal(s.cardHovered,true);
  assert.equal(s.controlHovered,false);
  s.clear();s.advance(1/60);
  assert.equal(s.cardHovered,false);
  assert.ok(s.snapshot(0).hover>0);
  assert.throws(()=>s.writeTo(new Float32Array(5),BASE),TypeError);
  assert.throws(()=>s.retargetRects(data,BASE,new Uint8Array(0)),TypeError);
});
