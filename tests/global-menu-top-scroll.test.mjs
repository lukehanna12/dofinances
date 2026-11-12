import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initWorkspaceScroll,topScrollEase,topScrollDuration}
  from "../sites/_apex/app/assets/workspace-scroll.js";

const css=readFileSync(new URL("../sites/_apex/app/assets/workspace-enhancements.css",import.meta.url),"utf8");
const nav=readFileSync(new URL("../sites/_apex/app/assets/workspace-nav.js",import.meta.url),"utf8");

function harness(initial=2400,{reduced=false,raf=true,height=800}={}){
  const root={scrollTop:initial,scrollLeft:0,scrollHeight:initial+height+500,
    clientHeight:height,scrollWidth:800,clientWidth:800};
  const frames=new Map(),listeners=new Map(),windowScrolls=[];
  let id=0,now=0;
  const win={
    performance:{now:()=>now},
    matchMedia:()=>({matches:reduced}),
    addEventListener:(name,fn)=>listeners.set(name,fn),
    scrollTo:args=>{windowScrolls.push(args);root.scrollTop=args.top;}
  };
  if(raf){
    win.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
    win.cancelAnimationFrame=ident=>frames.delete(ident);
  }
  const controller=initWorkspaceScroll({scrollingElement:root},win);
  function step(ms=16.667){
    now+=ms;
    const current=[...frames.values()];
    frames.clear();
    for(const fn of current)fn(now);
    return root.scrollTop;
  }
  function complete(){
    let iterations=0;
    while(frames.size&&iterations++<200)step();
    assert.ok(iterations<200,"animation must terminate");
    return root.scrollTop;
  }
  return {root,win,frames,listeners,windowScrolls,controller,step,complete};
}

test("scroll animation remains attached to current breadcrumb, not the upper global menu",()=>{
  assert.ok(css.includes(".global-menu a.is-current{font-weight:570;}"));
  assert.ok(!css.includes(".global-menu a.is-current{font-weight:570;cursor:pointer;}"));
  assert.ok(nav.includes('currentCrumb?.addEventListener?.("click",()=>workspaceScroll.animateToTop())'));
  assert.ok(nav.includes('for(const link of globalLinks)link.addEventListener("click",()=>{'));
  assert.ok(!nav.includes('targetRoute()!==lastRenderedRoute'));
  assert.ok(!nav.includes('link.setAttribute("role","button")'));
  assert.ok(!nav.includes('link.setAttribute("aria-label","Scroll to top of "'));
  assert.ok(nav.includes("if(route)render(route)"));
});

test("duration respects click-time distance; new asymmetric motion accelerates promptly and brakes late",()=>{
  const height=820;
  const short=topScrollDuration(100,height);
  const medium=topScrollDuration(2000,height);
  const long=topScrollDuration(24000,height);
  assert.ok(short>=240&&short<medium&&medium<long&&long<=1050);
  assert.equal(topScrollEase(0),0);
  assert.equal(topScrollEase(1),1);
  assert.equal(topScrollEase(-1),0);
  assert.equal(topScrollEase(3),1);
  assert.ok(topScrollEase(.15)>.10,"Rapid acceleration should move an appreciable distance by 15% of elapsed time");
  assert.ok(topScrollEase(.85)>.85,"Braking should leave little distance for the final approach");
  assert.ok(Math.abs(topScrollEase(.001)-topScrollEase(0))<.000005);
  assert.ok(Math.abs(topScrollEase(1)-topScrollEase(.999))<.000005);
  for(let i=0;i<1000;i++){
    const a=topScrollEase(i/1000),b=topScrollEase((i+1)/1000);
    assert.ok(Number.isFinite(a)&&b>=a&&b<=1,"No reversal, NaN, or overshoot in the animation");
  }
  const speed=t=>(topScrollEase(t+.005)-topScrollEase(t-.005))/.01;
  assert.ok(speed(.04)<speed(.10)*.55,"Starts gently then reaches travelling speed rapidly");
  assert.ok(speed(.10)>speed(.25)*.8,"Nearly full speed by 10% of travel time");
  assert.ok(speed(.44)>speed(.20)*1.08,"Middle must not be a visually fixed-velocity line");
  assert.ok(speed(.78)>speed(.90)*1.8,"Braking should be unmistakable near the landing");
  assert.ok(speed(.98)<speed(.90)*.12,"Final frames ease almost imperceptibly to zero speed");
  assert.ok(Math.abs(topScrollEase(.09+.00001)+topScrollEase(.09-.00001)-2*topScrollEase(.09))<1e-7,
    "Acceleration and travelling phases join without a visible velocity corner");
  assert.ok(Math.abs(topScrollEase(.74+.00001)+topScrollEase(.74-.00001)-2*topScrollEase(.74))<1e-7,
    "Cruising and braking phases join continuously");
});

test("the same breadcrumb trip has a rapid launch and visible late-stage braking, not a linear glide",()=>{
  const h=harness(3600);
  const duration=topScrollDuration(3600,800);
  h.controller.animateToTop();
  const samples=[[0,3600]];
  while(h.frames.size){
    h.step(1000/120);
    samples.push([Math.min(duration,((samples.length)*1000/120)),h.root.scrollTop]);
    assert.ok(samples.length<300,"Animation should complete on its scheduled timeline");
  }
  assert.equal(h.root.scrollTop,0);
  const displacement=(t0,t1)=>{
    const yAt=t=>3600*(1-topScrollEase(t));
    return yAt(t0)-yAt(t1);
  };
  const launch=displacement(0,.10);
  const middle=displacement(.40,.50);
  const last=displacement(.90,1);
  assert.ok(middle>launch*1.7,"First tenth visibly accelerates instead of instantly reaching a constant velocity");
  assert.ok(last<middle*.3,"Final tenth must be a graceful landing, not another fixed-speed segment");
});
test("RAF scroll is visually smooth, starts on the next frame, and lands exactly at the document top",()=>{
  const h=harness(2000);
  h.controller.animateToTop();
  assert.equal(h.frames.size,1,"One frame scheduled in the activation turn");
  assert.equal(h.root.scrollTop,2000);
  const first=h.step();
  assert.ok(first<2000&&first>0,"First frame must move without a dead frame");
  const samples=[first];
  for(let i=0;i<20;i++)samples.push(h.step());
  assert.ok(samples.every((value,i)=>i===0||value<=samples[i-1]),"No interaction means monotonic upward movement");
  assert.equal(h.complete(),0);
  assert.equal(h.frames.size,0);
  assert.equal(h.windowScrolls.length,0,"Animation does not use competing native smooth scrolling");
});

test("user scroll impulse visibly changes the position mid-flight but is naturally outweighed by the landing",()=>{
  const plain=harness(3800),interrupted=harness(3800);
  plain.controller.animateToTop();interrupted.controller.animateToTop();
  for(let i=0;i<13;i++){plain.step();interrupted.step();}
  interrupted.root.scrollTop+=190; // Browser wheel/touch displacement occurs between frames.
  const expected=plain.step(),adjusted=interrupted.step();
  assert.ok(adjusted>expected+35,"Actual user scroll must affect the animation, not be immediately discarded");
  for(let i=0;i<12;i++){plain.step();interrupted.step();}
  const residual=interrupted.root.scrollTop-plain.root.scrollTop;
  assert.ok(residual<adjusted-expected,"Interruption fades instead of permanently changing the target");
  assert.equal(interrupted.complete(),0,"Animation defeats intervening manual scrolling");
  assert.equal(plain.complete(),0);
});

test("upward manual scrolling is also honored transiently without cancelling final arrival",()=>{
  const plain=harness(4200),interrupted=harness(4200);
  plain.controller.animateToTop();interrupted.controller.animateToTop();
  for(let i=0;i<12;i++){plain.step();interrupted.step();}
  interrupted.root.scrollTop-=170;
  const reference=plain.step(),result=interrupted.step();
  assert.ok(result<reference-35,"Upward manual input should temporarily advance the trajectory");
  assert.equal(interrupted.complete(),0);
});

test("late user interruption is damped and cannot dislodge the guaranteed top landing",()=>{
  const h=harness(5000);h.controller.animateToTop();
  const approachFrames=Math.floor(.78*topScrollDuration(5000,800)/16.667);
  for(let i=0;i<approachFrames;i++)h.step();
  h.root.scrollTop+=250;
  h.step();
  assert.equal(h.complete(),0);
  assert.equal(h.frames.size,0);
});

test("a second same-route click restarts from current scroll distance without competing RAF loops",()=>{
  const h=harness(5000);h.controller.animateToTop();
  for(let i=0;i<10;i++)h.step();
  const before=h.root.scrollTop;
  h.controller.animateToTop();
  assert.ok(h.root.scrollTop<=before+1);
  assert.equal(h.frames.size,1,"Old frame is cancelled; only one animation remains");
  assert.equal(h.complete(),0);
});

test("real route navigation cancels the pending animation and resets instantly",()=>{
  const h=harness(3000);h.controller.animateToTop();
  h.step();assert.ok(h.root.scrollTop>0);
  h.controller.reset();
  assert.equal(h.root.scrollTop,0);
  assert.equal(h.frames.size,0);
  assert.deepEqual(h.windowScrolls,[{top:0,left:0,behavior:"instant"}]);
  h.step(150);
  assert.equal(h.root.scrollTop,0,"Cancelled frame cannot revive prior route's scroll position");
});

test("motion-reduction and platforms without RAF go directly to top",()=>{
  const reduced=harness(2000,{reduced:true});
  reduced.controller.animateToTop();
  assert.equal(reduced.root.scrollTop,0);assert.equal(reduced.frames.size,0);
  const fallback=harness(2000,{raf:false});
  fallback.controller.animateToTop();
  assert.equal(fallback.root.scrollTop,0);
});

test("no ongoing polling, scroll-handler cancellation or sidebar layout mutations",()=>{
  const js=readFileSync(new URL("../sites/_apex/app/assets/workspace-scroll.js",import.meta.url),"utf8");
  assert.doesNotMatch(js,/setInterval\(|new (?:ResizeObserver|MutationObserver)\(/);
  assert.ok(js.includes("root.scrollTop=position"));
  assert.ok(js.includes("animation.disturbance*=Math.exp(-dt/180)"));
  assert.ok(js.includes("const release=1-topScrollEase((t-.62)/.38)"));
  assert.ok(js.includes("win.requestAnimationFrame(tick)"));
  assert.ok(js.includes("cancelTopAnimation()"),"Normal route reset cancels active animation");
});
