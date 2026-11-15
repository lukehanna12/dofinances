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
 assert.ok(links.length>=13,"Workspace, Colosseum, and project rail links all need titles");
 for(const [markup] of links){
  assert.match(markup,/aria-label="[^"]+"/);
  assert.match(markup,/href="#[^"]+"/);
 }
 assert.match(tooltips,/sidebar\.querySelectorAll\("\.sidebar-navigation \.nav-link, \.sidebar-head \.brand"\)/);
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
