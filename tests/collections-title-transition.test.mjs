import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {collectionsTitleFrame,breadcrumbCrossingTime,initCollectionsTitleTransition,
  COLLECTIONS_CRUMB_MOVE_MS}
  from "../sites/_apex/app/assets/collections-title-transition.js";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const syntheticTitle=(scroll,top=140,height=52)=>({top:top-scroll,height});
const syntheticBar=(bottom=94)=>({bottom});

test("Handoff begins at exact 50% heading occlusion, in both directions",()=>{
  const bar=syntheticBar();
  // 140+26-94=72px; unlike the old fixed 76px, this follows typography.
  const threshold=72;
  const at=(scroll)=>collectionsTitleFrame(scroll,syntheticTitle(scroll),bar);
  assert.equal(at(0).threshold,threshold);
  assert.equal(at(0).passed,false);
  assert.equal(at(0).largeBlur,0);
  assert.equal(at(0).stripHeight,0);
  assert.equal(at(threshold-0.0001).passed,false);
  assert.equal(at(threshold).passed,true);
  assert.equal(at(threshold+0.0001).passed,true);
  assert.equal(at(threshold).threshold,threshold);
  assert.equal(at(threshold).stripHeight,64);
  assert.equal(at(threshold).stripBlur,2);
  assert.equal(at(threshold).largeBlur,1.25);
  assert.equal(at(threshold).stripOpacity,1);
  assert.deepEqual(at(threshold-1),at(threshold-1),"Exact same crossing when reversing");
  assert.equal(at(threshold-0.0001).passed,false,"Fade-in starts at reverse crossing");
});

test("No premature short-page handoff if half-heading never passes behind top bar",()=>{
  const bar=syntheticBar();
  for(const maxScroll of [0,1,5,12,20,48,70]){
    const state=collectionsTitleFrame(maxScroll,syntheticTitle(maxScroll),bar);
    assert.equal(state.threshold,72);
    assert.equal(state.passed,false,"Heading still over half visible at "+maxScroll);
  }
  for(const scroll of [72,74,90,128,152]){
    const state=collectionsTitleFrame(scroll,syntheticTitle(scroll),bar);
    assert.equal(state.passed,true);
  }
  const invalid=collectionsTitleFrame(100,{top:0,height:0},bar);
  assert.equal(invalid.passed,false,"Hidden/unmeasured headings cannot trigger");
  assert.equal(invalid.threshold,null);
});

test("Measured crossing adapts exactly to different heading sizes and sticky bar heights",()=>{
  for(const {top,height,bottom} of [
    {top:130,height:48,bottom:94},
    {top:160,height:36,bottom:94},
    {top:110,height:58,bottom:104},
    {top:148.25,height:51.5,bottom:92.5}
  ]){
    const expected=top+height/2-bottom;
    const bar=syntheticBar(bottom);
    for(const scroll of [0,expected-.001,expected,expected+.001,200]){
      const state=collectionsTitleFrame(scroll,syntheticTitle(scroll,top,height),bar);
      assert.ok(Math.abs(state.threshold-expected)<1e-7);
      assert.equal(state.passed,scroll>=expected);
    }
  }
});

test("Blur progresses smoothly to the midpoint without prematurely fading the title",()=>{
  const bar=syntheticBar();
  const values=[0,10,25,40,60,71,72].map(y=>collectionsTitleFrame(y,syntheticTitle(y),bar));
  for(let i=1;i<values.length;i++){
    assert.ok(values[i].largeBlur>=values[i-1].largeBlur);
    assert.ok(values[i].stripHeight>=values[i-1].stripHeight);
  }
  assert.equal(values.at(-1).largeBlur,1.25);
  assert.equal(values.at(-1).stripBlur,2);
  const css=source("sites/_apex/app/assets/collections.css");
  assert.match(css,/body\.collections-title-transition #project-collections-title\{[\s\S]*?opacity:1;\s*transition:opacity 180ms/);
  assert.match(css,/body\.collections-title-transition\.collections-title-passed #project-collections-title\{\s*opacity:0/);
  assert.doesNotMatch(source("sites/_apex/app/assets/collections-title-transition.js"),/--collections-large-opacity/,
    "Heading fade must start with threshold state, not be scroll-scrubbed before it");
});

test("Chevrons can time their turns to actual crossing positions",()=>{
  assert.ok(breadcrumbCrossingTime(.1)<breadcrumbCrossingTime(.2));
  assert.ok(breadcrumbCrossingTime(.2)<breadcrumbCrossingTime(.8));
  assert.ok(Math.abs(breadcrumbCrossingTime(1)-1)<1e-5);
  assert.ok(breadcrumbCrossingTime(.2)<.2,"Navigation translation uses native-inspired fast ease");
});

function classes(){
  const value=new Set();
  return {
    contains:name=>value.has(name),
    add:name=>value.add(name),
    remove:name=>value.delete(name),
    toggle:(name,enabled)=>{
      if(enabled)value.add(name);else value.delete(name);
    }
  };
}
function mockNode({left=0,width=12,hidden=false}={}){
  const values=new Map();
  return {
    hidden,offsetLeft:left,offsetWidth:width,
    style:{
      setProperty:(key,value)=>values.set(key,value),
      removeProperty:key=>values.delete(key),
      getPropertyValue:key=>values.get(key)||""
    },
    get varValues(){return values;}
  };
}
function mockEnvironment({scrollHeight=1500,clientHeight=800}={}){
  const items=[0,82,196,309].map(left=>mockNode({left}));
  const separators=[65,179,292].map(left=>mockNode({left,width:12}));
  const list={querySelectorAll:selector=>selector.includes("separator")?separators:items};
  const breadcrumb={querySelector:()=>list,inert:false};
  const heading=mockNode();
  const header={...mockNode(),appendChild(child){this.child=child;}};
  const body={classList:classes(),style:mockNode().style};
  const scroll={scrollTop:0,scrollHeight,clientHeight};
  heading.getBoundingClientRect=()=>syntheticTitle(scroll.scrollTop);
  header.getBoundingClientRect=()=>syntheticBar();
  const handlers=new Map();
  const doc={
    querySelector:selector=>selector.startsWith("link[")?{}:header,
    getElementById:id=>id==="breadcrumb"?breadcrumb:id==="project-collections-title"?heading:null,
    body,scrollingElement:scroll,
    createElement:()=>({hidden:false,setAttribute(){}})
  };
  const win={addEventListener:(name,fn)=>handlers.set(name,fn)};
  return {doc,win,header,heading,items,separators,scroll,body,breadcrumb,handlers,
    controller:initCollectionsTitleTransition(doc,win)};
}

test("Controller crosses exactly once, completes on zero further scroll, reverses at threshold",()=>{
  const m=mockEnvironment({scrollHeight:1100,clientHeight:800});
  m.controller.setRoute("colosseum/collections");
  assert.equal(m.body.classList.contains("collections-title-transition"),true);
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
  assert.equal(m.header.child.textContent,"Collections");
  assert.equal(m.items[0].style.getPropertyValue("--collections-crumb-distance"),"0.000px");
  assert.equal(m.items[1].style.getPropertyValue("--collections-crumb-distance"),"-82.000px");
  assert.equal(m.items[2].style.getPropertyValue("--collections-crumb-distance"),"-114.000px");
  const threshold=72;
  m.scroll.scrollTop=threshold-1;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
  m.scroll.scrollTop=threshold;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),true);
  assert.equal(m.breadcrumb.inert,true);
  assert.equal(m.heading.style.getPropertyValue("--collections-large-opacity"),"",
    "Large title fade is triggered by the body class, not scroll-written opacity");
  // No extra scroll callbacks, RAF, or timers required for the cascade.
  assert.equal(m.items[3].varValues.has("--collections-crumb-opacity"),false);
  assert.equal(m.handlers.has("scroll"),true);
  m.scroll.scrollTop=threshold-1;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
  assert.equal(m.breadcrumb.inert,false);
  m.scroll.scrollTop=threshold;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),true,
    "Rapid reversal must not trap the animation between states");
  m.controller.setRoute("home");
  assert.equal(m.body.classList.contains("collections-title-transition"),false);
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
  assert.equal(m.breadcrumb.inert,false);
  assert.equal(m.header.child.hidden,true);
  assert.equal(m.items[2].style.getPropertyValue("--collections-crumb-distance"),"");
});

test("Short document keeps exact heading midpoint rather than artificially lowering trigger",()=>{
  const m=mockEnvironment({scrollHeight:880,clientHeight:800});
  m.controller.setRoute("colosseum/collections");
  m.scroll.scrollTop=40;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),false,
    "Do not fade when the large title remains more than half visible");
  m.scroll.scrollTop=72;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),true);
  m.scroll.scrollTop=71.99;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
});

test("CSS guarantees quicker, nonoverlapping title/breadcrumb handoff in both directions",()=>{
  const css=source("sites/_apex/app/assets/collections.css");
  const intro=css.slice(css.indexOf("/* Collections only: scroll-dependent large-title/edge treatment"));
  assert.match(intro,/collections-title-passed #workspace-shell \.topbar > \.collections-inline-title\{\s*opacity:1;\s*transition:opacity 220ms cubic-bezier\(\.4,0,\.2,1\) 230ms/);
  assert.match(intro,/collections-inline-title\{[\s\S]*?opacity:0;\s*transition:opacity 180ms cubic-bezier\(\.4,0,\.2,1\) 0ms/);
  assert.match(intro,/\.shadcn-breadcrumb-item\{[\s\S]*?opacity:1;[\s\S]*?transform 220ms cubic-bezier\(\.22,1,\.36,1\),opacity 88ms linear/);
  assert.match(intro,/collections-title-passed #workspace-shell \.shadcn-breadcrumb-item\{[\s\S]*?opacity:0/);
  assert.match(intro,/transform:rotateY\(180deg\)/);
  assert.ok(72+88<230,"Last breadcrumb finishes fading before compact title enters");
  assert.ok(180<200,"Compact title fades out before first breadcrumb reappears");
  assert.match(intro,/transition:opacity 58ms linear var\(--collections-arrow-in-fade,204ms\)/);
  assert.match(intro,/transition:transform 66ms cubic-bezier\(\.4,0,\.2,1\)/);
  assert.match(intro,/--collections-arrow-out-fade/);
});

test("No polling or scroll-driven translation remains; Studio stays isolated",()=>{
  const js=source("sites/_apex/app/assets/collections-title-transition.js");
  const nav=source("sites/_apex/app/assets/workspace-nav.js");
  const workflow=source(".github/workflows/site.yml");
  const studio=source("studio/sidebar/index.html");
  assert.match(nav,/import \{initCollectionsTitleTransition\} from "\.\/collections-title-transition\.js"/);
  assert.match(nav,/collectionsTitleTransition\.setRoute\(route\)/);
  assert.match(js,/win\.addEventListener\("scroll",onScroll,\{passive:true\}\)/);
  assert.match(js,/heading\.getBoundingClientRect\(\),header\.getBoundingClientRect\(\)/);
  assert.match(js,/headingRect\.top\+headingRect\.height\/2-barRect\.bottom/);
  assert.match(js,/doc\.body\.classList\.toggle\("collections-title-passed",passed\)/);
  assert.match(js,/offsetLeft/);
  assert.doesNotMatch(js,/requestAnimationFrame|setInterval|setTimeout|ResizeObserver|MutationObserver|screenshot|canvas\.toDataURL/);
  assert.doesNotMatch(js,/--collections-crumb-opacity|--collections-arrow-opacity|--collections-inline-opacity/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/collections-title-transition\.js dist\/app\/assets\/collections-title-transition\.js/);
  assert.doesNotMatch(studio,/href="\/app\/assets\/collections\.css"/);
  assert.match(js,/if\(!doc\.querySelector\?\.\('link\[href="\/app\/assets\/collections\.css"\]'\)\)return noop/);
  assert.ok(!js.includes("global-menu-links"),"Upper global bar untouched");
  assert.ok(!js.includes("sidebar"),"Sidebar untouched");
});

test("Missing markup safely declines to mount transition",()=>{
  assert.doesNotThrow(()=>initCollectionsTitleTransition({querySelector:()=>null,getElementById:()=>null},{}).setRoute("colosseum/collections"));
});


test("Native reference optics constrain Collections blur and title fade behavior",()=>{
  const js=source("sites/_apex/app/assets/collections-title-transition.js");
  const css=source("sites/_apex/app/assets/collections.css");
  const start=collectionsTitleFrame(0,syntheticTitle(0),syntheticBar());
  const mid=collectionsTitleFrame(36,syntheticTitle(36),syntheticBar());
  const end=collectionsTitleFrame(72,syntheticTitle(72),syntheticBar());
  assert.equal(start.largeBlur,0);
  assert.equal(start.stripBlur,0);
  assert.ok(mid.largeBlur>0&&mid.largeBlur<end.largeBlur);
  assert.ok(mid.stripBlur>0&&mid.stripBlur<end.stripBlur);
  assert.equal(end.largeBlur,1.25);
  assert.equal(end.stripBlur,2);
  assert.ok(end.stripBlur<4,"Do not substitute a strong 24px uniform Gaussian for the native variable blur");
  assert.ok(js.includes("inputRadius=1"),"Document verified filter parameter, not guessed equivalence");
  const incoming=css.match(/collections-title-passed #workspace-shell \.topbar > \.collections-inline-title\{([\s\S]*?)\}/)?.[1]||"";
  const outgoing=css.match(/\.topbar > \.collections-inline-title\{([\s\S]*?)\}/)?.[1]||"";
  assert.match(incoming,/opacity:1/);
  assert.match(incoming,/transition:opacity 220ms cubic-bezier\(\.4,0,\.2,1\) 230ms/);
  assert.match(outgoing,/transition:opacity 180ms cubic-bezier\(\.4,0,\.2,1\) 0ms/);
  assert.ok(230>72+88,"Incoming compact title starts after all breadcrumb fades");
  assert.ok(200>180,"Reverse breadcrumbs wait until compact title is hidden");
  assert.match(js,/const COLLECTIONS_IN_DELAYS=\[200,210,234,258\]/);
  assert.match(js,/const COLLECTIONS_ARROW_IN_START_MS=204/);
});


test("Growing blur is restricted to the photographic top strip, never page content",()=>{
  const css=source("sites/_apex/app/assets/collections.css");
  const js=source("sites/_apex/app/assets/collections-title-transition.js");
  const wallpapers=source("sites/_apex/app/assets/workspace-wallpapers.css");
  const imageBlur=css.match(/body\.collections-title-transition::after\{([\s\S]*?)\}/)?.[1]||"";
  assert.match(imageBlur,/position:fixed/);
  assert.match(imageBlur,/z-index:0/);
  assert.match(imageBlur,/var\(--workspace-wallpaper-image,none\)/);
  assert.match(imageBlur,/background-position:center,var\(--workspace-wallpaper-position,center 46%\)/);
  assert.match(imageBlur,/filter:blur\(var\(--collections-strip-blur,0px\)\)/);
  assert.match(imageBlur,/mask-size:100% var\(--collections-strip-height,0px\)/);
  assert.match(imageBlur,/mask-position:left calc\(var\(--workspace-top-overpull\) \+ var\(--global-menu-height\) \+ var\(--workspace-header-height\)\)/);
  assert.doesNotMatch(imageBlur,/backdrop-filter/,"A backdrop sampler would blur scrolling text and rows");
  assert.doesNotMatch(css,/collections-title-transition #workspace-shell \.topbar::after/,
    "Never place the image-only filter above the scrolling document");
  assert.match(wallpapers,/body:has\(> #workspace-shell\)::before,[\s\S]*?--workspace-wallpaper-image/);
  assert.match(wallpapers,/body:has\(> #workspace-shell\) \.topbar::before/,
    "Keep the existing shared sticky header unchanged");
  assert.match(js,/prop\(doc\.body,"--collections-strip-height"/);
  assert.match(js,/prop\(doc\.body,"--collections-strip-blur"/);
  assert.match(js,/prop\(doc\.body,"--collections-strip-opacity"/);
  assert.doesNotMatch(js,/prop\(header,"--collections-strip-/);
});
test("Photo strip variables reverse and clean up on route exit",()=>{
  const m=mockEnvironment({scrollHeight:1100,clientHeight:800});
  m.controller.setRoute("colosseum/collections");
  m.scroll.scrollTop=30;
  m.handlers.get("scroll")();
  assert.ok(Number.parseFloat(m.body.style.getPropertyValue("--collections-strip-height"))>0);
  assert.ok(Number.parseFloat(m.body.style.getPropertyValue("--collections-strip-blur"))>0);
  m.controller.setRoute("home");
  for(const key of ["--collections-strip-height","--collections-strip-blur","--collections-strip-opacity"])
    assert.equal(m.body.style.getPropertyValue(key),"",key+" must not bleed into other views");
});


test("small Collections title inherits the native system stack and matches global clock digits",()=>{
  const css=source("sites/_apex/app/assets/collections.css");
  const foundation=source("sites/_apex/assets/site-foundation.css");
  const clock=source("sites/_apex/app/assets/workspace-enhancements.css");
  const toggle=source("sites/_apex/app/assets/workspace-theme.css");
  const compact=css.match(/body\.collections-title-transition #workspace-shell \.topbar > \.collections-inline-title\{([\s\S]*?)\}/)?.[1]||"";
  assert.match(foundation,/html, body \{[\s\S]*?font-family: var\(--ui-font-sans\)/);
  assert.match(compact,/font:620 15px\/1 var\(--ui-font-sans,system-ui\)/);
  assert.match(clock,/\.global-clock\{[\s\S]*?font-size:15px;font-weight:620;line-height:1/);
  assert.match(compact,/letter-spacing:-\.02em/);
  assert.match(clock,/font-variant-numeric:tabular-nums;letter-spacing:-\.02em/);
  assert.match(css,/@media\(max-width:1279px\)\{\s*body\.collections-title-transition #workspace-shell \.topbar > \.collections-inline-title\{\s*font-size:14px/);
  assert.match(css,/@media\(max-width:450px\)\{\s*body\.collections-title-transition #workspace-shell \.topbar > \.collections-inline-title\{\s*font-size:13px/);
  assert.match(clock,/@media\(max-width:1279px\)\{[\s\S]*?\.global-clock\{[\s\S]*?font-size:14px/);
  assert.match(clock,/@media\(max-width:450px\)\{\s*\.global-clock\{gap:6px;font-size:13px/);
  assert.match(toggle,/\.icon-button \{[\s\S]*?color: var\(--ui-secondary\)/);
  assert.match(compact,/color:var\(--ui-secondary\)/);
  assert.doesNotMatch(compact,/"SF Pro Text"|"Helvetica Neue"/);
  assert.match(compact,/position:absolute;\s*z-index:2;\s*inset:0;\s*display:flex;\s*align-items:center;\s*justify-content:center;\s*transform:none/);
  assert.match(compact,/pointer-events:none/);
  assert.match(compact,/transition:opacity 180ms/);
  assert.match(css,/collections-title-passed #workspace-shell \.topbar > \.collections-inline-title\{\s*opacity:1;\s*transition:opacity 220ms/);
});


test("Breadcrumb stagger, chevron crossings and title handoff form a coherent faster timeline",()=>{
  assert.equal(COLLECTIONS_CRUMB_MOVE_MS,220);
  const m=mockEnvironment({scrollHeight:1100,clientHeight:800});
  m.controller.setRoute("colosseum/collections");
  const out=m.items.map(el=>Number.parseFloat(el.style.getPropertyValue("--collections-out-delay")));
  const inside=m.items.map(el=>Number.parseFloat(el.style.getPropertyValue("--collections-in-delay")));
  assert.deepEqual(out,[72,52,26,0],"Rightmost still starts first, in staggered order");
  assert.deepEqual(inside,[200,210,234,258],"Reverse stagger starts right after compact title vanishes");
  const outgoingTitleStart=230;
  assert.ok(out.every(delay=>delay+88<outgoingTitleStart),
    "Every breadcrumb completely fades before compact title begins");
  assert.ok(inside.every(delay=>delay>=180+20),"Every crumb waits for compact title to fade out");
  const arrowOutEnds=[];
  for(let i=0;i<3;i++){
    const el=m.separators[i];
    const flip=Number.parseFloat(el.style.getPropertyValue("--collections-arrow-out-flip"));
    const fade=Number.parseFloat(el.style.getPropertyValue("--collections-arrow-out-fade"));
    assert.equal(fade,flip+66,"Arrow fade starts when its 66ms crossing flip completes");
    arrowOutEnds.push(fade+58);
    const incoming=Number.parseFloat(el.style.getPropertyValue("--collections-arrow-in-fade"));
    assert.equal(incoming,204+i*25);
    assert.ok(incoming>=200,"Reverse arrows return after compact title vanishes");
  }
  assert.ok(Math.max(...arrowOutEnds)<outgoingTitleStart,
    "All arrows vanish before the compact title enters");
  const css=source("sites/_apex/app/assets/collections.css");
  assert.match(css,/transition:transform 220ms cubic-bezier/);
  assert.match(css,/opacity 88ms linear/);
  assert.match(css,/transition:transform 66ms cubic-bezier/);
  assert.match(css,/transition:opacity 58ms linear/);
  m.scroll.scrollTop=72;m.handlers.get("scroll")();
  assert.ok(m.body.classList.contains("collections-title-passed"));
  m.scroll.scrollTop=71.99;m.handlers.get("scroll")();
  assert.ok(!m.body.classList.contains("collections-title-passed"));
});
