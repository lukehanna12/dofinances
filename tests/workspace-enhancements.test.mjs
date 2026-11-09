import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("Account signout moved after MFA into Manage Account and ahead of deletion",()=>{
  const html=read("../sites/_apex/app/index.html");
  assert.equal((html.match(/id="signout"/g)||[]).length,1);
  const a=html.indexOf('id="start-mfa"'),b=html.indexOf('id="manage-account-title"'),
    c=html.indexOf('id="signout"'),d=html.indexOf('<details class="danger">');
  assert.ok(a>=0&&a<b&&b<c&&c<d);
  const bar=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1]||"";
  assert.doesNotMatch(bar,/id="signout"/);
  assert.match(bar,/class="rb-breadcrumbs"/);
  assert.doesNotMatch(bar,/Colosseum project workspace|Back to Projects/);
});
test("two consistent header heights, viewport layers, and a stable responsive sidebar gap",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const html=read("../sites/_apex/app/index.html");
  assert.match(html,/class="global-menu"/);
  assert.match(css,/--global-menu-height:44px/);
  assert.match(css,/--workspace-header-height:50px/);
  assert.match(css,/--workspace-sidebar-gap:18px/);
  assert.match(css,/calc\(var\(--global-menu-height\) \+ var\(--workspace-header-height\) \+ var\(--workspace-sidebar-gap\)\)/);
  assert.match(css,/body:has\(> #workspace-shell\) > \.workspace-topbar-backdrop/);
  assert.match(css,/\.shell\.liquid-glass-preview \.sidebar/);
});
test("sidebar admits blank-space expansion and bounded accessible pointer/keyboard resizing",()=>{
  const js=read("../sites/_apex/app/assets/workspace-nav.js");
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(js,/minSidebarWidth=Math\.max\(204/);
  assert.match(js,/Math\.floor\(\(win\.innerWidth\|\|1280\)\*\.75\)/);
  assert.match(js,/sidebar\.addEventListener\?\.\("click"/);
  assert.match(js,/resizeHandle\.addEventListener\("pointerdown"/);
  assert.match(js,/resizeHandle\.addEventListener\("keydown"/);
  assert.match(css,/cursor:e-resize/);
  assert.match(css,/cursor:ew-resize/);
  assert.match(css,/@keyframes nav-label-marquee/);
  assert.match(css,/width:274px!important/);
});
test("the 170ms entrance applies only to main content and honors reduced motion",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(css,/\.content > \.view:not\(\[hidden\]\)\{animation:workspace-content-arrive 170ms/);
  assert.match(css,/@keyframes workspace-content-arrive/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test("Home wallpaper uses its retained 1280px replacement without invoking a shared library asset",()=>{
  const js=read("../sites/_apex/app/assets/workspace-wallpapers.js");
  assert.match(js,/home-rice-terraces-hq\.jpg/);
  assert.match(js,/wallpaper\.path\|\|/);
});
