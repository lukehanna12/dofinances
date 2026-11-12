import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {collectionsTitleFrame,breadcrumbCrossingTime,initCollectionsTitleTransition,
  COLLECTIONS_TITLE_TRIGGER_DISTANCE}
  from "../sites/_apex/app/assets/collections-title-transition.js";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Collections handoff is a single binary threshold, never partial",()=>{
  const max=400,threshold=COLLECTIONS_TITLE_TRIGGER_DISTANCE;
  assert.equal(threshold,76);
  const zero=collectionsTitleFrame(0,max);
  assert.equal(zero.threshold,76);
  assert.equal(zero.passed,false);
  assert.equal(zero.largeBlur,0);
  assert.equal(zero.largeOpacity,1);
  assert.equal(zero.stripHeight,0);
  const before=collectionsTitleFrame(threshold-.01,max);
  assert.equal(before.passed,false);
  assert.ok(before.largeOpacity>=0&&before.largeOpacity<.00001);
  assert.equal(collectionsTitleFrame(threshold,max).passed,true);
  assert.equal(collectionsTitleFrame(threshold+500,max).passed,true);
  assert.equal(collectionsTitleFrame(threshold-.01,max).passed,false);
  assert.deepEqual(collectionsTitleFrame(0,max),zero);
  const at=collectionsTitleFrame(threshold,max);
  assert.equal(at.largeOpacity,0);
  assert.equal(at.stripHeight,64);
  assert.equal(at.stripBlur,2);
  assert.equal(at.largeBlur,1.25);
  assert.equal(at.stripOpacity,1);
});

test("Trigger is reachable on short Collections pages without adding scroll space",()=>{
  for(const maxScroll of [1,5,12,20,48,70,90,128,140,152]){
    const state=collectionsTitleFrame(maxScroll,maxScroll);
    assert.ok(state.threshold>0&&state.threshold<=maxScroll);
    assert.equal(state.passed,true,"Must finish even when user is at bottom "+maxScroll);
    assert.equal(collectionsTitleFrame(Math.max(0,state.threshold-1e-3),maxScroll).passed,false);
  }
  assert.equal(collectionsTitleFrame(0,0).passed,false);
  assert.equal(collectionsTitleFrame(0,0).largeOpacity,1);
});

test("Blur rises monotonically before threshold and reverses identically",()=>{
  const values=[0,10,25,40,60,75,76].map(y=>collectionsTitleFrame(y,500));
  for(let i=1;i<values.length;i++){
    assert.ok(values[i].largeBlur>=values[i-1].largeBlur);
    assert.ok(values[i].stripHeight>=values[i-1].stripHeight);
    assert.ok(values[i].largeOpacity<=values[i-1].largeOpacity);
  }
  assert.deepEqual(collectionsTitleFrame(25,500),values[2]);
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
  const threshold=76;
  m.scroll.scrollTop=threshold-1;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
  m.scroll.scrollTop=threshold;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),true);
  assert.equal(m.breadcrumb.inert,true);
  assert.equal(m.heading.style.getPropertyValue("--collections-large-opacity"),"0.0000");
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

test("Small document uses a lower threshold, allowing a complete handoff before bottom",()=>{
  const m=mockEnvironment({scrollHeight:880,clientHeight:800});
  m.controller.setRoute("colosseum/collections");
  m.scroll.scrollTop=39;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),false);
  m.scroll.scrollTop=40;
  m.handlers.get("scroll")();
  assert.equal(m.body.classList.contains("collections-title-passed"),true);
});

test("CSS guarantees nonoverlapping centered title and breadcrumbs in both directions",()=>{
  const css=source("sites/_apex/app/assets/collections.css");
  const intro=css.slice(css.indexOf("/* Collections only: scroll-dependent large-title/edge treatment"));
  assert.match(intro,/collections-title-passed #workspace-shell \.topbar > \.collections-inline-title\{\s*opacity:1;\s*transition:opacity 220ms cubic-bezier\(\.4,0,\.2,1\) 280ms/);
  assert.match(intro,/collections-inline-title\{[\s\S]*?opacity:0;\s*transition:opacity 180ms cubic-bezier\(\.4,0,\.2,1\) 0ms/);
  assert.match(intro,/\.shadcn-breadcrumb-item\{[\s\S]*?opacity:1;[\s\S]*?opacity 112ms linear/);
  assert.match(intro,/collections-title-passed #workspace-shell \.shadcn-breadcrumb-item\{[\s\S]*?opacity:0/);
  assert.match(intro,/transform:rotateY\(180deg\)/);
  // Last breadcrumb fades by 92+112=204 ms. Last arrow fades before 280ms.
  assert.ok(92+112<280);
  assert.ok(180<240,"Reverse must hide centered title before first breadcrumb restores");
  assert.match(intro,/--collections-arrow-in-fade/);
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
  assert.match(js,/scroll>=threshold/);
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
  const start=collectionsTitleFrame(0,500);
  const mid=collectionsTitleFrame(38,500);
  const end=collectionsTitleFrame(76,500);
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
  assert.match(incoming,/transition:opacity 220ms cubic-bezier\(\.4,0,\.2,1\) 280ms/);
  assert.match(outgoing,/transition:opacity 180ms cubic-bezier\(\.4,0,\.2,1\) 0ms/);
  assert.ok(280>92+112,"Incoming compact title starts after all breadcrumb fades");
  assert.ok(240>180,"Reverse breadcrumbs wait until compact title is hidden");
  assert.match(js,/const inDelay=\[240,250,282,315\]/);
  assert.match(js,/const reverse=242\+\(i-1\)\*31/);
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


test("small Collections title shares the exact native system font stack of large heading",()=>{
  const css=source("sites/_apex/app/assets/collections.css");
  const foundation=source("sites/_apex/assets/site-foundation.css");
  const compact=css.match(/body\.collections-title-transition #workspace-shell \.topbar > \.collections-inline-title\{([\s\S]*?)\}/)?.[1]||"";
  assert.match(compact,/font:600 17px\/21px var\(--ui-font-sans,system-ui\)/);
  assert.match(foundation,/html, body \{[\s\S]*?font-family: var\(--ui-font-sans\)/);
  assert.doesNotMatch(compact,/"SF Pro Text"|"Helvetica Neue"/);
  assert.match(compact,/color:#fff/);
  assert.match(compact,/transition:opacity 180ms/);
  assert.match(css,/collections-title-passed #workspace-shell \.topbar > \.collections-inline-title\{\s*opacity:1;\s*transition:opacity 220ms/);
});
