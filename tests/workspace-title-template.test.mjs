import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initWorkspaceTitleTransition} from "../sites/_apex/app/assets/workspace-title-transition.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const css=read("sites/_apex/app/assets/workspace-title.css");
const nav=read("sites/_apex/app/assets/workspace-nav.js");

const classList=()=>{
 const values=new Set();
 return {
  add:n=>values.add(n),remove:n=>values.delete(n),
  contains:n=>values.has(n),toggle:(n,on)=>on?values.add(n):values.delete(n)
 };
};
const styles=()=>{const values=new Map();return {
 setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k),
 getPropertyValue:k=>values.get(k)||""
};};
function fixture(count){
 const nodes=Array.from({length:count},(_,i)=>({
   hidden:false,offsetLeft:i*85,offsetWidth:40,style:styles()
 }));
 const arrows=Array.from({length:count-1},(_,i)=>({
   hidden:false,offsetLeft:i*85+64,offsetWidth:12,style:styles()
 }));
 const list={querySelectorAll:s=>s.includes("separator")?arrows:nodes};
 const breadcrumb={querySelector:s=>s===".shadcn-breadcrumb-list"?list:null,inert:false};
 let y=0,label="Permissions";
 const title={style:styles(),classList:classList(),getBoundingClientRect:()=>({top:140-y,height:52}),
   get textContent(){return label;}};
 const header={appendChild(el){this.inline=el;},getBoundingClientRect:()=>({bottom:94})};
 const body={classList:classList(),style:styles()};
 const view={hidden:false,querySelector:s=>s==="h1"?title:null};
 const doc={
  querySelector:s=>s.startsWith("link[")?{}:header,
  querySelectorAll:s=>s===".content > .view[data-view]"?[view]:[],
  getElementById:id=>id==="breadcrumb"?breadcrumb:null,
  body,scrollingElement:{get scrollTop(){return y;}},
  createElement:tag=>({tag,hidden:false,tabIndex:-1,attrs:{},handlers:{},
   setAttribute(key,value){this.attrs[key]=value;},
   addEventListener(event,fn){this.handlers[event]=fn;},
   click(){this.handlers.click?.();},
   blur(){this.blurred=true;}
  })
 };
 const handlers=new Map(),win={addEventListener:(event,fn)=>handlers.set(event,fn)};
 let topCalls=0;
 const controller=initWorkspaceTitleTransition(doc,win,()=>{topCalls++});
 return {controller,topCalls:()=>topCalls,header,breadcrumb,body,title,nodes,arrows,handlers,scroll(n){y=n;handlers.get("scroll")?.();},
  changeTitle(n){label=n;}};
}
test("Every non-dashboard screen uses one geometry-driven title controller",()=>{
 assert.match(nav,/initWorkspaceTitleTransition\(doc,win\)/);
 assert.match(nav,/workspaceTitleTransition\.setRoute\(route\)/);
 assert.doesNotMatch(nav,/initUtilitiesTitleTransition|initCollectionsTitleTransition/);
 assert.match(css,/body\.workspace-title-transition \.workspace-scroll-heading/);
 assert.match(css,/body\.workspace-title-transition\.workspace-title-passed/);
 assert.match(css,/\.view\[data-view\]:not\(\[data-view="home"\]\):not\(\[hidden\]\)/);
});
for(const count of [2,3,4]){
 test("Midpoint title handoff and reverse scroll work for "+count+" breadcrumb levels",()=>{
  const m=fixture(count);
  m.controller.setRoute(count===2?"projects":"colosseum/permissions");
  assert.equal(m.header.inline.textContent,"Permissions");
  assert.equal(m.header.inline.tag,"button");
  assert.equal(m.header.inline.type,"button");
  assert.equal(m.header.inline.tabIndex,-1);
  m.header.inline.click();assert.equal(m.topCalls(),0,"Before handoff, the button cannot scroll");
  assert.equal(m.header.inline.hidden,false);
  assert.equal(m.body.classList.contains("workspace-title-transition"),true);
  assert.equal(m.breadcrumb.inert,false);
  assert.equal(m.nodes.length,count);
  assert.equal(m.nodes[1].style.getPropertyValue("--workspace-crumb-distance"),"-85.000px");
  m.scroll(71.99);
  assert.equal(m.body.classList.contains("workspace-title-passed"),false);
  m.scroll(72);
  assert.equal(m.body.classList.contains("workspace-title-passed"),true);
  assert.equal(m.breadcrumb.inert,true);
  assert.equal(m.header.inline.tabIndex,0);
  assert.equal(m.header.inline.attrs["aria-hidden"],"false");
  assert.equal(m.header.inline.attrs["aria-label"],"Scroll to top of Permissions");
  m.header.inline.click();assert.equal(m.topCalls(),1,"The compact title scrolls the document");
  m.scroll(71.99);
  assert.equal(m.body.classList.contains("workspace-title-passed"),false);
  assert.equal(m.breadcrumb.inert,false);
  m.header.inline.click();assert.equal(m.topCalls(),1,"Button becomes inert above the handoff");
  m.controller.setRoute("home");
  assert.equal(m.body.classList.contains("workspace-title-transition"),false);
  assert.equal(m.header.inline.hidden,true);
  assert.equal(m.title.classList.contains("workspace-scroll-heading"),false);
  assert.equal(m.breadcrumb.inert,false);
 });
}
test("Switching screens replaces title text and clears previous scroll state",()=>{
 const m=fixture(4);
 m.controller.setRoute("colosseum/collections");m.scroll(80);
 assert.equal(m.breadcrumb.inert,true);
 m.changeTitle("Utilities");
 m.scroll(0);
 m.controller.setRoute("colosseum/utilities");
 assert.equal(m.header.inline.textContent,"Utilities");
 assert.equal(m.header.inline.attrs["aria-label"],"Scroll to top of Utilities");
 assert.equal(m.breadcrumb.inert,false);
 assert.equal(m.body.classList.contains("workspace-title-passed"),false);
 assert.equal(m.body.classList.contains("workspace-title-transition"),true);
});
test("The shared controller requires no timers, polling, animation frames or observers",()=>{
 const js=read("sites/_apex/app/assets/workspace-title-transition.js");
 assert.doesNotMatch(js,/setTimeout|setInterval|requestAnimationFrame|MutationObserver|ResizeObserver|IntersectionObserver|poll\(/);
 assert.match(js,/addEventListener\("scroll",onScroll,\{passive:true\}\)/);
 assert.match(js,/heading\.getBoundingClientRect\(\),header\.getBoundingClientRect\(\)/);
 assert.match(css,/transition:opacity 220ms cubic-bezier\(\.4,0,\.2,1\) 230ms/);
});
