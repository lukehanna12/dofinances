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

test("animation accelerates throughout first 93% and decelerates throughout final 7%",()=>{
  assert.equal(topScrollEase(0),0);
  assert.equal(topScrollEase(.93),.93,"Both the elapsed time AND distance breakpoint are exactly 93%");
  assert.equal(topScrollEase(1),1);
  assert.equal(topScrollEase(-1),0);
  assert.equal(topScrollEase(3),1);
  // Sample the derivative to verify there is no uniform-speed middle.
  const v=t=>(topScrollEase(t+.00005)-topScrollEase(t-.00005))/.0001;
  for(let i=1;i<93;i++){
    const left=v((i-1)/100),right=v(i/100);
    assert.ok(right>left+1e-7,"Speed must increase on every acceleration sample at "+i+"%");
  }
  for(let i=94;i<100;i++){
    const left=v((i-1)/100),right=v(i/100);
    assert.ok(right<left-1e-7,"Speed must decrease on every braking sample at "+i+"%");
  }
  assert.ok(v(.10)<v(.50)*.55,"No near-constant speed before halfway");
  assert.ok(v(.50)<v(.80),"Speed still increasing near the end of the 93% phase");
  assert.ok(v(.94)>v(.97)&&v(.97)>v(.99),"Final 7% has distinctly diminishing velocity");
  assert.ok(v(.999)<v(.98)*.02,"Arrives gently at practically zero speed");
  assert.ok(v(0)<.01&&v(1)<.01,"Zero endpoint velocity");
  for(let i=0;i<1000;i++){
    const a=topScrollEase(i/1000),b=topScrollEase((i+1)/1000);
    assert.ok(Number.isFinite(a)&&b>a&&b<=1,"Strictly increasing position without overshoot");
  }
  // The phases must meet without a jump in position, speed, or acceleration.
  const h=.00001;
  assert.ok(Math.abs(topScrollEase(.93-h)-topScrollEase(.93+h)+2*h*v(.93))<1e-8);
  assert.ok(Math.abs(topScrollEase(.93-h)+topScrollEase(.93+h)-2*topScrollEase(.93))<1e-8);
});

test("distance-adjusted duration provides rendered frames for the 7% final brake",()=>{
  const height=820;
  const short=topScrollDuration(100,height);
  const medium=topScrollDuration(2000,height);
  const long=topScrollDuration(24000,height);
  assert.ok(short>=380&&short<medium&&medium<long&&long<=1700);
  assert.ok(medium*.07>=60,"Common multi-viewport travel gives about four 60Hz braking frames");
  assert.ok(long*.07>=100,"Long distances reserve at least six 60Hz braking frames");
});

test("actual RAF trajectory continuously gains speed before 93% then loses it over the last 7%",()=>{
  const h=harness(8000);
  const duration=topScrollDuration(8000,800);
  const steps=[];
  h.controller.animateToTop();
  while(h.frames.size){
    steps.push(h.step(1000/120));
    assert.ok(steps.length<300,"Stops after one bounded animation");
  }
  assert.equal(h.root.scrollTop,0);
  const displacement=(a,b)=>topScrollEase(b)-topScrollEase(a);
  assert.ok(displacement(.50,.60)>displacement(.20,.30)*1.4,
    "Mid-run moves much faster than the early acceleration phase");
  assert.ok(displacement(.82,.92)>displacement(.60,.70),
    "Near the end of the first 93% still accelerating");
  assert.ok(displacement(.93,.95)>displacement(.98,1)*3,
    "Last 7% contains clearly visible braking before zero-velocity landing");
  assert.equal(topScrollEase(.93),.93);
  assert.ok(duration*.07>=70,"Long return-to-top has multiple visible braking frames");
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
  assert.ok(js.includes("const release=1-smoothstep(Math.max(0,Math.min(1,(t-.62)/.38)))"));
  assert.ok(js.includes("win.requestAnimationFrame(tick)"));
  assert.ok(js.includes("cancelTopAnimation()"),"Normal route reset cancels active animation");
});
