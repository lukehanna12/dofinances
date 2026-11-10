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
  assert.match(bar,/class="shadcn-breadcrumbs"/);
  assert.doesNotMatch(bar,/Colosseum project workspace|Back to Projects/);
});
test("two consistent header heights, viewport layers, and a stable responsive sidebar gap",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const html=read("../sites/_apex/app/index.html");
  assert.match(html,/class="global-menu"/);
  assert.match(css,/--global-menu-height:44px/);
  assert.match(css,/--workspace-header-height:50px/);
  assert.match(css,/--workspace-sidebar-gap:16px/);
  assert.match(css,/--workspace-sidebar-left-gap:16px/);
  assert.match(css,/--workspace-sidebar-bottom-gap:16px/);
  assert.match(css,/calc\(var\(--global-menu-height\) \+ var\(--workspace-header-height\) \+ var\(--workspace-sidebar-gap\)\)/);
  assert.doesNotMatch(html,/workspace-topbar-backdrop/);
  assert.match(read("../sites/_apex/app/assets/workspace-wallpapers.css"),/\.topbar::before \{[\s\S]*?z-index:0;/);
  assert.match(css,/\.shell\.liquid-glass-preview \.sidebar/);
});
test("desktop pane stays fixed and reserves its responsive width",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const js=read("../sites/_apex/app/assets/workspace-scroll.js");
  assert.match(css,/\.shell::before \{[\s\S]*?flex:0 0 calc\(/);
  assert.match(css,/\.shell\.liquid-glass-preview \.sidebar\{\s*position:fixed;/);
  assert.match(css,/\.shell\.is-compact-rail:not\(\.is-rail-expanded\)/);
  assert.match(css,/bottom:calc\(var\(--workspace-sidebar-bottom-gap\) \+ 22px\)/);
  assert.doesNotMatch(css,/--workspace-sidebar-end-shrink/);
  assert.doesNotMatch(js,/sidebarEndShrink|new Resize\(sync\)/);
});
test("sidebar admits blank-space expansion and bounded accessible pointer/keyboard resizing",()=>{
  const js=read("../sites/_apex/app/assets/workspace-nav.js");
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(js,/minSidebarWidth=Math\.max\(248/);
  assert.match(js,/Math\.floor\(\(win\.innerWidth\|\|1280\)\*\.75\)-16/);
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

test("Studio preview mirrors production navigation without enabling account mutations",()=>{
  const studio=read("../studio/sidebar/index.html");
  const bootstrap=read("../studio/sidebar/preview-bootstrap.js");
  assert.match(studio,/class="global-menu"/);
  assert.match(studio,/class="shadcn-breadcrumbs"/);
  assert.match(studio,/workspace-enhancements.css/);
  assert.match(studio,/Manage Account/);
  assert.match(studio,/preview-bootstrap.js/);
  assert.doesNotMatch(studio,/src="\/app\/assets\/dashboard.js"/);
  assert.match(bootstrap,/global-menu-toggle/);
  assert.match(bootstrap,/global-search-toggle/);
});

test("Studio sidebar uses the production's immediate active-row selection without delayed geometry",()=>{
  const css=read("../studio/sidebar/sidebar-glass.css");
  const js=read("../studio/sidebar/sidebar-glass.js");
  assert.doesNotMatch(css,/glass-selection|has-glass-indicator/);
  assert.doesNotMatch(js,/glass-selection|MutationObserver|glassIndicatorGeometry|requestAnimationFrame/);
  assert.match(css,/\.shell\.liquid-glass-preview \.nav-link\.active\{/);
  assert.match(js,/glass-scene-toggle/);
});

test("actual shadcn Base breadcrumb list uses muted links and an unframed page",()=>{
  for(const template of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(template);
    assert.match(html,/<nav class="shadcn-breadcrumbs"[^>]+aria-label="Breadcrumb"/);
    assert.match(html,/<ol class="shadcn-breadcrumb-list">/);
    assert.match(html,/class="shadcn-breadcrumb-link"/);
    assert.match(html,/class="shadcn-breadcrumb-separator"/);
    assert.match(html,/class="shadcn-breadcrumb-page"[^>]+aria-current="page"/);
    assert.doesNotMatch(html,/class="rb-crumb/);
  }
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(css,/\.shadcn-breadcrumb-link\{color:var\(--ui-secondary\)/);
  assert.match(css,/\.shadcn-breadcrumb-page\{color:var\(--ui-text\)/);
  assert.match(css,/border-radius:0;padding:0/);
});
test("sidebar spacing and resize grip are symmetric and never light up on hover",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  assert.match(css,/var\(--workspace-sidebar-bottom-gap\) var\(--workspace-sidebar-left-gap\)/);
  assert.match(css,/var\(--workspace-sidebar-gap\) - var\(--workspace-sidebar-bottom-gap\)/);
  assert.match(css,/width:28px;height:auto;z-index:39/);
  assert.match(css,/sidebar-resize-handle:hover,/);
  assert.match(css,/cursor:ew-resize!important;background:transparent!important;box-shadow:none!important/);
  assert.match(css,/\.shell\.is-compact-rail\.is-rail-expanded \.brand\{transform:none;/);
  assert.match(css,/\.shell\.is-compact-rail\.is-rail-expanded \.sidebar-toggle\{top:auto;right:auto;/);
  assert.match(nav,/Click to expand sidebar/);
  assert.match(nav,/Drag to resize • collapse past half minimum width/);
  assert.match(nav,/collapse past half minimum width/);
  assert.match(nav,/COLLAPSE_DRAG_FRACTION=\.5/);
  assert.match(nav,/rawWidth<minSidebarWidth\*COLLAPSE_DRAG_FRACTION/);
});
test("footer is in normal scroll flow with no end-of-page appearance animation",()=>{
  const scroll=read("../sites/_apex/app/assets/workspace-scroll.js");
  const css=read("../sites/_apex/app/assets/workspace-wallpapers.css");
  assert.doesNotMatch(scroll,/workspace-at-end|ENTER_END_GAP|LEAVE_END_GAP/);
  assert.doesNotMatch(css,/opacity 180ms ease-out|workspace-at-end|workspace-home-art-bottom/);
  assert.match(css,/\.workspace-footer \{[\s\S]*?position:relative;/);
});

test("resize grip is outside clipped sidebar and exposes both hover affordances",()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    const asideEnd=html.indexOf("</aside>");
    const grip=html.indexOf('id="sidebar-resize-handle"');
    assert.ok(asideEnd>0&&grip>asideEnd,"resize grip must be an aside sibling");
  }
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const js=read("../sites/_apex/app/assets/workspace-nav.js");
  assert.match(css,/\.shell > \.sidebar-resize-handle\{/);
  assert.match(css,/width:28px;height:auto;z-index:39/);
  assert.match(css,/cursor:ew-resize!important;touch-action:none/);
  assert.match(css,/\.shell\.is-collapsed \.sidebar \*\{cursor:e-resize!important;/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 34px/);
  assert.match(js,/pointerover",onRailHover/);
  assert.match(js,/resizeHandle\.addEventListener\("pointerenter",onGripHover/);
  assert.match(js,/else onGripHover\(event\)/);
});

test("blank rail expands from a dedicated pointer region and icons use centered geometry",()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    assert.match(html,/id="sidebar-rail-expand-target"/);
    assert.match(html,/aria-label="Expand sidebar" title="Click to expand sidebar"/);
  }
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  assert.match(css,/\.sidebar-rail-expand-target\{[\s\S]*?cursor:e-resize!important/);
  assert.match(css,/\.sidebar-navigation \.nav-link\{[\s\S]*?margin-inline:auto/);
  assert.match(css,/\.is-collapsed \.sidebar-navigation \.nav-link\{[\s\S]*?justify-content:center!important/);
  assert.match(nav,/railExpandTarget\?\.addEventListener\?\.\("keydown"/);
});
