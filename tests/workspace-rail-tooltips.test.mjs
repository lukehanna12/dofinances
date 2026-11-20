import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("sites/_apex/app/index.html");
const nav=read("sites/_apex/app/assets/workspace-nav.js");
const tooltips=read("sites/_apex/app/assets/workspace-rail-tooltips.js");
const css=read("sites/_apex/app/assets/workspace-enhancements.css");
const collectionCSS=read("sites/_apex/app/assets/collections.css");

test("Every collapsed desktop screen route receives one clipped-sidebar-safe, accessible tooltip",()=>{
 const links=[...html.matchAll(/<a class="nav-link"[^>]*>/g)];
 assert.ok(links.length>=11,"All Workspace, Colosseum, project, and persistent footer links need titles");
  assert.equal((html.match(/class="sidebar-bottom" aria-label="Settings navigation"/g)||[]).length,1,"One persistent Settings navigation group");
 for(const [markup] of links){
  assert.match(markup,/aria-label="[^"]+"/);
  assert.match(markup,/href="#[^"]+"/);
 }
 assert.match(tooltips,/sidebar\.querySelectorAll\("\.sidebar-navigation \.nav-link, \.sidebar-bottom > \.nav-link, \.sidebar-head \.brand"\)/);
 assert.match(tooltips,/doc\.body\.appendChild\(tip\)/,"Never clip inside sidebar overflow");
 assert.match(tooltips,/tip\.setAttribute\("role","tooltip"\)/);
 assert.match(tooltips,/link\.setAttribute\("aria-describedby",tip\.id\)/);
 assert.match(tooltips,/shown\.removeAttribute\("aria-describedby"\)/);
 assert.match(tooltips,/link\.getAttribute\("aria-label"\)/);
 assert.match(tooltips,/!shell\.classList\.contains\("is-rail-expanded"\)/);
 assert.match(tooltips,/!win\.matchMedia\?\.\("\(max-width: 760px\)"\)\?\.matches/);
 assert.doesNotMatch(tooltips,/sidebar-rail-expand-target/,"Never attach a tooltip to the blank-rail expander");
 assert.match(nav,/import \{initCollapsedRailTooltips\} from "\.\/workspace-rail-tooltips\.js"/);
 assert.match(nav,/initCollapsedRailTooltips\(doc,win,shell,sidebar\)/);
 assert.match(nav,/railTooltips\?\.hide\(\)/,"Clear stale labels on route and collapse changes");
});

test("Collapsed screen tooltips reproduce Collections typography and movement, not native title popups",()=>{
 for(const rule of [
  "padding:7px 10px","border:1px solid rgba(255,255,255,.08)",
  "border-radius:10px","background:#101010;color:#f6f6f6",
  "font-size:12px;font-weight:520;line-height:1.25;letter-spacing:0",
  "box-shadow:0 5px 17px rgba(0,0,0,.29)",
  "opacity:0;visibility:hidden",
  "transition-delay:.15s,.15s,.15s",
  "transition-delay:0s,0s,0s"
 ]) {
  assert.ok(css.includes(rule),"Missing exact Collections tooltip surface term "+rule);
  assert.ok(collectionCSS.includes(rule.replace("opacity:0;visibility:hidden","opacity:0;visibility:hidden")) ||
    rule==="transition-delay:0s,0s,0s",
    "Maintain shared Collections visual semantics: "+rule);
 }
 assert.match(css,/\.workspace-rail-tooltip\{[\s\S]*?position:fixed;z-index:1100/);
 assert.match(css,/\.workspace-rail-tooltip\.is-visible\.is-keyboard\{transition-delay:0s,0s,0s;\}/);
 assert.match(css,/@media\(max-width:760px\)\{\.workspace-rail-tooltip\{display:none!important;\}\}/);
 assert.doesNotMatch(nav,/setAttribute\(["']title["']/);
 assert.doesNotMatch(tooltips,/setInterval|requestAnimationFrame|MutationObserver|IntersectionObserver|captureStream|drawImage/);
 for(const event of ["pointerenter","pointerleave","focus","blur","click"])
  assert.ok(tooltips.includes('link.addEventListener("'+event+'"'));
});

import {untransformedTooltipRect} from "../sites/_apex/app/assets/workspace-rail-tooltips.js";

test("Elevated Edit README tooltip retains its settled right-anchored position through fade-out",()=>{
  const wrapper={clientLeft:0,clientTop:0,scrollLeft:0,scrollTop:0,
    getBoundingClientRect:()=>({left:82,top:55,width:50,height:50,right:132,bottom:105})};
  // The hovered tip is midway through a .94 -> 1 scale animation, so the
  // transformed getBoundingClientRect() cannot be its final popover anchor.
  const editTip={offsetParent:wrapper,offsetLeft:-123,offsetTop:55,
    offsetWidth:173,offsetHeight:31,
    getBoundingClientRect:()=>({left:-33,top:109,width:163,height:29,right:130,bottom:138})};
  const rect=untransformedTooltipRect(editTip);
  assert.deepEqual(rect,{left:-41,top:110,width:173,height:31,right:132,bottom:141});
  assert.equal(rect.right,wrapper.getBoundingClientRect().right,
    "Popover and original tooltip must share the same right-aligned endpoint");
  assert.notEqual(rect.left,editTip.getBoundingClientRect().left,
    "Do not freeze the transient scaled hover geometry");
  assert.ok(tooltips.includes('const box=untransformedTooltipRect(tip)'));
  assert.ok(tooltips.includes('setProperty("--workspace-tooltip-left",box.left+"px")'));
  assert.ok(!tooltips.includes('Math.max(8,Math.min(box.left'),
    "Viewport clamping must not shift the overlay away from the CSS-anchored fade-out");
});

test("Tooltip layout box honors positioned ancestor border and scroll offsets",()=>{
  const parent={clientLeft:1,clientTop:2,scrollLeft:4,scrollTop:6,
    getBoundingClientRect:()=>({left:200,top:80})};
  assert.deepEqual(untransformedTooltipRect({offsetParent:parent,offsetLeft:9,offsetTop:40,
    offsetWidth:130,offsetHeight:25,getBoundingClientRect:()=>({})}),
    {left:206,top:116,width:130,height:25,right:336,bottom:141});
});
