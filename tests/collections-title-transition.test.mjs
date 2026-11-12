import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {collectionsTitleFrame,initCollectionsTitleTransition}
  from "../sites/_apex/app/assets/collections-title-transition.js";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("native-inspired Collections sequence has stable, reversible endpoints",()=>{
  const initial=collectionsTitleFrame(0,[0,100,100,100]);
  assert.equal(initial.largeBlur,0);
  assert.equal(initial.largeOpacity,1);
  assert.equal(initial.stripHeight,0);
  assert.equal(initial.stripOpacity,0);
  assert.equal(initial.inlineOpacity,0);
  assert.deepEqual(initial.crumbs.map(c=>[c.x,c.opacity]),[[0,1],[0,1],[0,1],[0,1]]);
  assert.ok(initial.arrows.every(a=>a.turn===0 && a.opacity===1));

  const blurComplete=collectionsTitleFrame(76,[0,100,100,100]);
  assert.equal(blurComplete.largeOpacity,0);
  assert.equal(blurComplete.stripHeight,64);
  assert.equal(blurComplete.stripBlur,24);
  assert.equal(blurComplete.handoff,0);
  assert.equal(blurComplete.inlineOpacity,0);
  const finished=collectionsTitleFrame(140,[0,100,100,100]);
  assert.deepEqual(finished.crumbs.map(c=>c.x),[0,-100,-100,-100]);
  assert.ok(finished.crumbs.every(c=>c.opacity===0));
  assert.ok(finished.arrows.every(a=>a.opacity===0 && a.turn===180));
  assert.equal(finished.inlineOpacity,1);
  assert.deepEqual(collectionsTitleFrame(0,[0,100,100,100]),initial,
    "Returning to scroll-top must precisely reverse every model value");
});

test("Collection title stays at native font size while breadcrumbs glide independently",()=>{
  const values=[0,10,25,40,60,76,83,93,106,120,140].map(y=>
    collectionsTitleFrame(y,[0,78,102,120],[.2,.2,.2]));
  for(let i=1;i<values.length;i++){
    assert.ok(values[i].stripHeight>=values[i-1].stripHeight);
    assert.ok(values[i].largeBlur>=values[i-1].largeBlur);
    assert.ok(values[i].largeOpacity<=values[i-1].largeOpacity);
    assert.ok(values[i].inlineOpacity>=values[i-1].inlineOpacity);
    for(let j=1;j<4;j++)assert.ok(values[i].crumbs[j].x<=values[i-1].crumbs[j].x);
  }
  // The stationary leftmost "Workspace" title never translates.
  assert.ok(values.every(v=>v.crumbs[0].x===0));
  const opening=collectionsTitleFrame(84,[0,78,102,120]);
  assert.ok(opening.crumbs[3].x<0,"Collections begins moving first");
  assert.equal(opening.crumbs[2].x,0,"Colosseum starts a little later");
  assert.equal(opening.crumbs[1].x,0,"Projects begins last");
  const passing=collectionsTitleFrame(103,[0,78,102,120],[.2,.2,.2]);
  assert.ok(passing.arrows[2].turn>0,"Chevron flips as the right title crosses it");
});

test("No polling, animation-frame loop, screenshot dependencies or shared navbar mutation",()=>{
  const js=source("sites/_apex/app/assets/collections-title-transition.js");
  const nav=source("sites/_apex/app/assets/workspace-nav.js");
  const css=source("sites/_apex/app/assets/collections.css");
  assert.match(nav,/import \{initCollectionsTitleTransition\} from "\.\/collections-title-transition\.js"/);
  assert.match(nav,/const collectionsTitleTransition=initCollectionsTitleTransition\(doc,win\)/);
  assert.match(nav,/collectionsTitleTransition\.setRoute\(route\)/);
  assert.match(js,/win\.addEventListener\("scroll",onScroll,\{passive:true\}\)/);
  assert.match(js,/doc\.scrollingElement\?\.scrollTop/);
  assert.match(js,/offsetLeft/);
  assert.match(js,/breadcrumb\.inert=state\.handoff>=\.995/);
  assert.doesNotMatch(js,/requestAnimationFrame|setInterval|setTimeout|ResizeObserver|MutationObserver|screenshot|canvas\.toDataURL/);
  assert.match(css,/body\.collections-title-transition #workspace-shell \.topbar::after/);
  assert.match(css,/body\.collections-title-transition #workspace-shell \.topbar > \.collections-inline-title/);
  assert.match(css,/font:600 17px\/21px -apple-system/);
  assert.match(css,/transform:rotateY\(var\(--collections-arrow-angle,0deg\)\)/);
  assert.match(css,/mask-image:linear-gradient\(to bottom,#000/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(js,/if\(route!=="colosseum\/collections"\)/);
  assert.ok(!js.includes("global-menu-links"),"Upper global bar remains untouched");
  assert.ok(!js.includes("sidebar"),"The sidebar remains untouched");
});

test("Controller safely no-ops on minimal navigation fixtures",()=>{
  assert.doesNotThrow(()=>initCollectionsTitleTransition({querySelector:()=>null,getElementById:()=>null},{}).setRoute("colosseum/collections"));
});


test("Studio keeps working when shared navigation imports the Collections module",()=>{
  const workflow=source(".github/workflows/site.yml");
  const studio=source("studio/sidebar/index.html");
  const js=source("sites/_apex/app/assets/collections-title-transition.js");
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/collections-title-transition\.js dist\/app\/assets\/collections-title-transition\.js/);
  assert.match(workflow,/test -s dist\/app\/assets\/collections-title-transition\.js/);
  assert.match(workflow,/\/app\/assets\/collections-title-transition\.js \/app\/assets\/sidebar-glass\.css/);
  assert.doesNotMatch(studio,/href="\/app\/assets\/collections\.css"/,"Studio must remain visually independent");
  assert.match(js,/if\(!doc\.querySelector\?\.\('link\[href="\/app\/assets\/collections\.css"\]'\)\)return noop/);
});
