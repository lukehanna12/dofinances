import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {glassIndicatorGeometry} from "../sites/_apex/app/assets/sidebar-glass.js";

const read = path => readFile(new URL(path,import.meta.url),"utf8");

test("glass presentation preserves the actual app route and responsive owners", async () => {
  const nav=await read("../sites/_apex/app/assets/workspace-nav.js");
  const boot=await read("../preview/app-sidebar-bootstrap.js");
  const html=await read("../sites/_apex/app/index.html");
  assert.match(boot,/initWorkspaceNavigation\(\)/);
  assert.match(boot,/initLiquidGlassSidebar\(\)/);
  assert.ok(boot.indexOf("initWorkspaceNavigation()") < boot.indexOf("initLiquidGlassSidebar()"));
  assert.match(nav,/const isMobile=.*max-width: 760px/);
  assert.match(nav,/const isCompactRail=.*max-width: 1279px/);
  assert.match(nav,/const PREFERENCE_KEY="dofinances.workspace.sidebar.collapsed"/);
  assert.match(nav,/win\.addEventListener\("hashchange",render\)/);
  assert.match(nav,/shell\.classList\.toggle\("is-collapsed",effectiveCollapsed\)/);
  assert.match(html,/href="\/app\/assets\/sidebar-glass\.css"/);
  assert.equal((html.match(/id="workspace-sidebar"/g)||[]).length,1);
});

test("glass selection follows the actual active link rather than a fixed mock row", () => {
  const nav={scrollLeft:0,scrollTop:22,getBoundingClientRect:()=>({left:0,top:70,width:245,height:700})};
  const active={getBoundingClientRect:()=>({left:12,top:211,width:221,height:39})};
  assert.deepEqual(glassIndicatorGeometry(nav,active),{x:12,y:163,width:221,height:39});
  const rail={scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:72,width:49,height:700})};
  const railLink={getBoundingClientRect:()=>({left:12,top:162,width:49,height:39})};
  assert.deepEqual(glassIndicatorGeometry(rail,railLink),{x:12,y:90,width:49,height:39});
  assert.equal(glassIndicatorGeometry(nav,{getBoundingClientRect:()=>({left:0,top:0,width:0,height:0})}),null);
});

test("optical shading is progressive with reduced-transparency, contrast and motion modes", async () => {
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  const js=await read("../sites/_apex/app/assets/sidebar-glass.js");
  for(const token of [
    ".shell.liquid-glass-preview .sidebar", ".glass-selection",
    ".glass-optics", ".glass-scene-toggle", "glass-scene-neutral",
    "glass-scene-prism", "prefers-reduced-transparency",
    "prefers-reduced-motion", "forced-colors",
    "backdrop-filter: blur(21px)", "border-radius: 0 24px 24px 0"
  ]) assert.ok(css.includes(token),token);
  assert.match(js,/canvas\.getContext\?\.\("webgl2"/);
  assert.match(js,/if \(!gl\) return/);
  assert.match(js,/uniform vec2 u_pointer/);
  assert.match(js,/gauss\(u_size\.x - p\.x, 2\.6\)/);
  assert.match(js,/new MutationObserver\(scheduleIndicator\)/);
  assert.match(js,/new ResizeObserver\(scheduleIndicator\)/);
  assert.match(js,/pointermove/);
  assert.match(js,/pointerleave/);
  assert.match(js,/visibilitychange/);
  assert.match(js,/win\.addEventListener\("pagehide",cleanup/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\.cookie|localStorage/);
  assert.doesNotMatch(css,/@import|url\(https?:\/\//);
});

test("the test branch alone deploys a static read-only preview with all required assets", async () => {
  const workflow=await read("../.github/workflows/app-sidebar-preview.yml");
  assert.match(workflow,/branches: \[test\/app-sidebar\]/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/test\/app-sidebar'/);
  assert.match(workflow,/pages deploy .*--branch=app-sidebar-preview/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/sidebar-glass\.js/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/sidebar-glass\.css/);
  assert.match(workflow,/test ! -e .app-sidebar-preview\/app\/assets\/dashboard\.js/);
  assert.match(workflow,/node --test tests\/dashboard-navigation\.test\.mjs tests\/sidebar-glass\.test\.mjs/);
});


test("the preview wallpaper spans the entire viewport and glass remains color-neutral",async()=>{
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  const js=await read("../sites/_apex/app/assets/sidebar-glass.js");
  // The scene must continue behind BOTH sidebar and content. The previous
  // 440px color patch plus opaque main obscured the comparison altogether.
  assert.match(css,/\.shell\.liquid-glass-preview::before,\s*\.shell\.liquid-glass-preview::after\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*width: 100%;[^}]*height: 100%/s);
  assert.doesNotMatch(css,/width:\s*min\(440px/);
  assert.match(css,/\.shell\.liquid-glass-preview::after\s*\{[^}]*radial-gradient\(circle[^}]*repeating-linear-gradient\(90deg/s);
  assert.match(css,/\.shell\.liquid-glass-preview \.main\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*rgba\(7,13,17,\.10\)/s);
  assert.match(css,/\.shell\.liquid-glass-preview \.topbar\s*\{[^}]*background:\s*rgba\(12,\s*18,\s*22,\s*\.34\)/s);
  assert.match(css,/--glass-pane:\s*rgba\(22,\s*24,\s*26,\s*\.34\)/);
  assert.match(css,/backdrop-filter:\s*blur\(21px\) saturate\(1\.13\) brightness\(1\.04\)/);
  assert.match(js,/vec3\(\.86,\.87,\.88\)/);
  for(const scene of ["Gallery","Monochrome","Spectrum"])
    assert.match(js,new RegExp('name:"'+scene+'"'));
  // No new routes, network requests, or external images are added.
  assert.doesNotMatch(css,/url\(|@import/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest/);
});
