import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("workspace and Studio controls expose accessible labels without browser-native or custom tooltips",()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    assert.doesNotMatch(html,/ title="/,"native browser hover bubbles should not be emitted");
    assert.match(html,/id="sidebar-toggle"[^>]*aria-label="Collapse sidebar"/);
    assert.match(html,/id="sidebar-rail-expand-target"[^>]*aria-label="Expand sidebar"/);
    assert.match(html,/id="sidebar-resize-handle"[^>]*aria-label="Resize sidebar"/);
  }
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.doesNotMatch(nav,/sidebar-interaction-tooltip|showHint|hideHint|onRailHover|onGripHover/);
  assert.doesNotMatch(css,/sidebar-interaction-tooltip/);
  assert.match(nav,/sidebar\.addEventListener\?\.\("click",expandFromBlank\)/);
});
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
test("account deletion disclosure has a subtly richer coral tone without changing other destructive UI",()=>{
  const css=read("../sites/_apex/app/assets/workspace-theme.css");
  const foundation=read("../sites/_apex/assets/site-foundation.css");
  assert.ok(css.includes(".danger summary {color: #ff858c; font-size: 13px; font-weight: 550;}"),
    "Settings disclosure keeps its typography while the coral is slightly stronger");
  assert.ok(foundation.includes("--ui-danger: #ff9698;"),
    "shared destructive action token stays unchanged");
  assert.ok(css.includes(".destructive {color: var(--ui-danger);"),
    "actual destructive buttons retain their existing appearance");
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    assert.ok(html.includes('<details class="danger">'));
    assert.match(html,/<summary>Delete my account(?: <span class="st-chevron" aria-hidden="true"><\/span>)?<\/summary>/);
  }
});
test("unfinished Colosseum screens keep compact headings; Collections and Permissions use dedicated interfaces",()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const removed=path.includes("studio")?["utilities","collections","providers","permissions"]:["utilities"];
    const html=read(path);
    for(const slug of removed){
      const name=slug[0].toUpperCase()+slug.slice(1);
      assert.ok(html.includes('<div class="page-heading"><h1 id="project-'+slug+'-title">'+name+'</h1></div>'),
        slug+" must retain only its heading on "+path);
      assert.ok(!html.includes('<p class="lead">Colosseum - '+name+'</p>'),
        slug+" subtitle must be fully removed on "+path);
    }
    if(!path.includes("studio"))for(const child of ["local","external","credentials"])
      assert.ok(html.includes('<div class="page-heading"><h1 id="project-providers-'+child+'-title">'+
        child[0].toUpperCase()+child.slice(1)+'</h1></div>'));
    if(path.includes("studio/sidebar"))
      assert.match(html,/<h1 id="projects-title">Projects<\/h1><p class="lead">/);
    else {
      assert.match(html,/<div class="page-heading"><h1 id="projects-title">Projects<\/h1><\/div>/);
      assert.doesNotMatch(html,/Your projects, organized in one place\./);
    }
    if(path.includes("studio/sidebar"))
      assert.match(html,/<h1 id="settings-title">Settings<\/h1><p class="lead">/);
    else{
      assert.match(html,/<section class="view settings-view" data-view="settings"/);
      assert.match(html,/<div class="page-heading"><h1 id="settings-title">Settings<\/h1><\/div>/);
      for(const id of ["st-general","st-security","st-connections","st-advanced"])
        assert.ok(html.includes('id="'+id+'"'),"Settings retains "+id);
    }
    if(path.includes("studio/sidebar")){
      assert.match(html,/<h1 id="dashboard-title">Your workspace, all in one place\.<\/h1>/);
    }else{
      assert.match(html,/<section class="view dashboard-home" data-view="dashboard"/);
      assert.match(html,/id="cta6-mosaic"/);
      assert.match(html,/<h1 id="dashboard-title">doof<\/h1>/);
    }
  }
});
test("Non-Dashboard heading bottoms align to the sidebar section-label top",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const wallpapers=read("../sites/_apex/app/assets/workspace-wallpapers.css");
  assert.ok(css.includes('.view:not([data-view="dashboard"]) > .page-heading > h1'),
    "only the primary H1 on non-Home pages is moved");
  assert.ok(css.includes("top:calc(var(--global-menu-height) + var(--workspace-header-height) + var(--workspace-sidebar-gap) + 1px + 17px + var(--workspace-sidebar-head-anchor-height) + 8px - var(--workspace-banner-height) - var(--workspace-content-leading) - 1lh);"),
    "title bottom aligns to the reference section label");
  assert.equal((css.match(/\.view:not\(\[data-view="dashboard"\]\) > \.page-heading > h1/g)||[]).length,1,
    "the same title-centering rule applies on both mobile and desktop");
  assert.match(css,/--workspace-sidebar-head-anchor-height:71px/);
  assert.match(css,/@media\(min-width:1280px\)\{\s*\.shell\.is-collapsed\{--workspace-sidebar-head-anchor-height:113px/);
  assert.match(wallpapers,/--workspace-header-height:66px/);
  assert.match(wallpapers,/@media \(max-width:760px\) \{\s*:root \{--workspace-header-height:63px/);
  assert.doesNotMatch(css,/\.page-heading > \.lead\s*\{[^}]*top:/);
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    const headings=[...html.matchAll(/<section class="view[^"]*"[^>]*data-view="([^"]+)"[^>]*>[\s\S]*?<div class="page-heading"><h1 /g)];
    assert.ok(headings.length>=2,"pages retain individually targeted headings");
    if(path.includes("studio/sidebar"))
      assert.match(html,/<section class="view" data-view="dashboard"[^>]*>[\s\S]*?<div class="page-heading"><h1 id="dashboard-title"/);
    else
      assert.match(html,/<section class="view dashboard-home" data-view="dashboard"[\s\S]*?id="cta6-mosaic"/);
  }
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
test("Only Dashboard retains the global bar; other routes reclaim 44px without shifting their content",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const wallpapers=read("../sites/_apex/app/assets/workspace-wallpapers.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  const nl=String.fromCharCode(10);
  const scope='body:has(> #workspace-shell .content > .view[data-view]:not([data-view="dashboard"]):not([hidden]))';
  assert.ok(css.includes([":root{","  --global-menu-height:44px;"].join(nl)),
    "Dashboard retains its original 44px upper navigation");
  assert.ok(css.includes([scope+"{","  --global-menu-height:0px;"].join(nl)),
    "Non-Dashboard routes release the 44px navigation reservation");
  assert.ok(css.includes([scope+" > .global-menu{","  display:none!important;"].join(nl)),
    "Only active non-Dashboard routes hide the upper bar");
  assert.ok(css.includes([".shell{","  padding-top:var(--global-menu-height);"].join(nl)),
    "The shell offset must follow the route-sensitive height");
  assert.ok(wallpapers.includes("top:var(--global-menu-height,44px);"),
    "The lower bar moves up as the global allowance becomes zero");
  assert.ok(css.includes("top:calc(var(--global-menu-height) + var(--workspace-header-height) + var(--workspace-sidebar-gap));"),
    "The sidebar moves up by the same 44px");
  assert.ok(css.includes("top:calc(var(--global-menu-height) + var(--workspace-header-height) + var(--workspace-sidebar-gap) + 1px + 17px + var(--workspace-sidebar-head-anchor-height) + 8px - var(--workspace-banner-height) - var(--workspace-content-leading) - 1lh);"),
    "The screen title moves up with the sidebar");
  assert.ok(css.includes("padding-top:calc(var(--workspace-banner-height) - var(--global-menu-height) - var(--workspace-header-height) + var(--workspace-content-leading));"),
    "Ordinary content retains its established viewport position");
  for(const file of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(file);
    assert.ok(!html.includes('data-breadcrumb-root'),
      "Dashboard is no longer a breadcrumb root");
    assert.ok(html.includes('id="topbar-dashboard-home"')&&html.includes('href="#dashboard" aria-label="Go to Dashboard"'),
      "A right-hand Home action replaces the old breadcrumb root");
    assert.ok(html.includes('<a data-global-route href="#dashboard">Dashboard</a>'),
      "Dashboard's distinct upper navigation remains unchanged");
  }
  assert.ok(nav.includes('breadcrumb:selected==="dashboard"?"":label'),
    "Dashboard has no breadcrumb, and workspace breadcrumbs begin at the current route");
  assert.ok(!nav.includes('breadcrumb:"Workspace / "+label'));
});

test("mobile drawer clears both bars without adding hover tooltips",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  const mobile=css.slice(css.indexOf("@media(max-width:760px){"));
  assert.ok(mobile.includes("top:calc(var(--global-menu-height) + var(--workspace-header-height) + var(--workspace-sidebar-gap));"));
  assert.ok(mobile.includes("height:calc(100dvh - var(--global-menu-height) - var(--workspace-header-height) - var(--workspace-sidebar-gap) - 8px);"));
  assert.ok(!css.includes(".sidebar-interaction-tooltip"),"no custom tooltip CSS remains");
  assert.ok(mobile.includes(".sidebar-rail-expand-target{display:none!important;}"));
  assert.ok(!nav.includes("hideHint"),"no unused tooltip hide hooks remain");
  assert.ok(nav.includes('if(railExpandTarget)railExpandTarget.hidden=isMobile()||!effectiveCollapsed;'));
  for(const file of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(file);
    assert.ok(html.includes('id="mobile-nav-toggle"'));
    assert.ok(html.includes('id="sidebar-rail-expand-target"'));
  }
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
test("lower topbar and scroll title retain the 74px collapsed-rail anchor during sidebar expansion",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const title=read("../sites/_apex/app/assets/workspace-title.css");
  // One registered animated length drives BOTH the main spacer and inverse
  // header compensation: no independent flex-basis transition or JS polling.
  assert.match(css,/@property --workspace-rail-space-width\s*\{[\s\S]*?syntax:"<length>";/);
  assert.match(css,/transition:--workspace-rail-space-width var\(--sidebar-layout-duration\) var\(--ui-ease\)/);
  assert.match(css,/flex:0 0 calc\(var\(--workspace-sidebar-left-gap\) \+ var\(--workspace-rail-space-width\)\)/);
  assert.match(css,/margin-left:calc\(74px - var\(--workspace-rail-space-width\)\)/);
  assert.match(css,/width:calc\(100% \+ var\(--workspace-rail-space-width\) - 74px\)/);
  assert.match(title,/topbar > \.workspace-inline-title\{/);
  assert.match(title,/position:absolute;/);
  assert.doesNotMatch(css,/transition:flex-basis var\(--sidebar-layout-duration\)/);
});
test("Diagnostics sidebar uses exact local waveform.path.ecg SF Symbol v2",()=>{
  const source=read("../sites/_apex/app/assets/diagnostics-screen-sidebar-icon.v2.svg");
  const theme=read("../sites/_apex/app/assets/workspace-theme.css");
  assert.match(source,/data-sf-symbol="waveform\.path\.ecg"/);
  assert.match(source,/data-sf-export="WaveformPathEcg"/);
  assert.match(source,/viewBox="0 0 24\.8594 26\.3093"/);
  assert.match(source,/M0\.601954 15\.2947L6\.13877 15\.2947/);
  assert.match(source,/fill-opacity="0\.85"/);
  const workflow=read("../.github/workflows/site.yml");
  assert.ok(workflow.includes("cp sites/_apex/app/assets/diagnostics-screen-sidebar-icon.v2.svg dist/app/assets/diagnostics-screen-sidebar-icon.v2.svg"));
  assert.match(theme,/mask-image:url\("\/app\/assets\/diagnostics-screen-sidebar-icon\.v2\.svg"\)/);
  assert.doesNotMatch(theme,/diagnostics-screen-sidebar-icon\.v1\.svg/);
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
   assert.match(css,/\.shadcn-breadcrumb-page\{color:var\(--ui-secondary\);font-weight:inherit/);
  assert.match(css,/border-radius:0;padding:0/);
});
test("collapsed desktop sidebar never renders the header toggle at compact or wide widths",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const theme=read("../sites/_apex/app/assets/workspace-theme.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  const desktop=css.slice(css.indexOf("@media(min-width:761px){"),css.indexOf("@media(min-width:761px) and (max-width:1279px){"));
  const mobile=css.slice(css.indexOf("@media(max-width:760px){"));
  // Diagnose the precise wide-width regression: old collapsed positioning
  // is unconditional, but the prior hiding rule was only in compact mode.
  assert.match(theme,/\.shell\.is-collapsed \.sidebar-toggle \{top: 44px; right: 7px;\}/);
  assert.match(theme,/@media \(min-width: 761px\) and \(max-width: 1279px\) \{[\s\S]*?\.shell\.is-compact-rail \.sidebar-toggle \{display: none;\}/);
  assert.match(desktop,/\.shell\.liquid-glass-preview\.is-collapsed \.sidebar-head > \.sidebar-toggle\{display:none;\}/);
  assert.doesNotMatch(mobile,/\.is-collapsed \.sidebar-head > \.sidebar-toggle\{display:none/);
  assert.match(mobile,/\.shell\.liquid-glass-preview \.sidebar-head > \.sidebar-toggle\{[\s\S]*?display:inline-grid/);
  assert.match(desktop,/\.shell\.liquid-glass-preview\.is-collapsed \.sidebar-rail-expand-target\{/);
  assert.match(nav,/sidebar\.addEventListener\?\.\("click",expandFromBlank\)/);
  assert.match(nav,/railExpandTarget\?\.addEventListener\?\.\("keydown"/);
});

test("sidebar spacing and resize grip are symmetric and never light up on hover",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  assert.match(css,/height:calc\(100dvh - var\(--global-menu-height\) - var\(--workspace-header-height\) - var\(--workspace-sidebar-gap\) - var\(--workspace-sidebar-bottom-gap\)\)/);
  assert.match(css,/var\(--workspace-sidebar-gap\) - var\(--workspace-sidebar-bottom-gap\)/);
  assert.match(css,/width:28px;height:auto;z-index:39/);
  assert.match(css,/sidebar-resize-handle:hover,/);
  assert.match(css,/cursor:ew-resize!important;background:transparent!important;box-shadow:none!important/);
  assert.match(css,/\.shell\.is-compact-rail\.is-rail-expanded \.brand\{transform:none;/);
  assert.match(css,/\.shell\.is-compact-rail\.is-rail-expanded \.sidebar-toggle\{top:auto;right:auto;/);
  assert.doesNotMatch(nav,/Click to expand sidebar|Drag to resize • collapse past half minimum width/);
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

test("resize grip is outside clipped sidebar and stays draggable without hover prompts",()=>{
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
  assert.doesNotMatch(js,/onRailHover|onGripHover|sidebar-interaction-tooltip/);
  assert.match(js,/resizeHandle\.addEventListener\("pointermove",onMove\)/);
});

test("blank rail expands from a dedicated pointer region without hover tooltips",()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    assert.match(html,/id="sidebar-rail-expand-target"/);
    assert.match(html,/aria-label="Expand sidebar"/);
    assert.doesNotMatch(html,/ title="/,"do not show browser-native title popups");
  }
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const nav=read("../sites/_apex/app/assets/workspace-nav.js");
  assert.match(css,/\.sidebar-rail-expand-target\{[\s\S]*?cursor:e-resize!important/);
  assert.match(css,/\.sidebar-navigation \.nav-link\{[\s\S]*?margin-inline:auto/);
  assert.match(css,/\.is-collapsed \.sidebar-navigation \.nav-link\{[\s\S]*?justify-content:center!important/);
  assert.match(nav,/railExpandTarget\?\.addEventListener\?\.\("keydown"/);
});

test("desktop clock seconds are smaller, muted, bottom-aligned and independently rendered; breadcrumbs share its sidebar-edge shift",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const js=read("../sites/_apex/app/assets/workspace-nav.js");
  const start=css.indexOf("#workspace-shell .topbar-start{");
  const mobile=css.indexOf("/* Mobile clock override must come AFTER");
  const desktop=css.slice(start,mobile);
  assert.ok(desktop.includes("@media(min-width:761px){"),"Left alignment never affects mobile");
  assert.ok(desktop.includes("margin-left:calc(-74px - clamp(18px,3.8vw,54px));"),
    "Clock and breadcrumbs both shift by the collapsed rail plus horizontal padding");
  assert.ok(desktop.includes("padding-inline-start:144px;"),"Breadcrumbs halve the clock-to-navigation gutter");
   assert.ok(desktop.includes("#workspace-shell .topbar-start:has(.global-clock-doof:not([hidden])){"),
     "Doof uses a separate, smaller desktop gutter without moving the wordmark");
   assert.ok(desktop.includes("padding-inline-start:calc(74px + clamp(26px,4.1vw,58px) + max(0px,calc((100vw - 1200px)/2)));"),
     "Doof breadcrumb uses the collapsed 74px rail plus the actual responsive content inset");
   assert.ok(desktop.includes("padding-inline-start:126.48px;"),
     "Doof breadcrumb aligns with page titles at wide desktop widths");
  assert.ok(css.includes("display:inline-flex;align-items:flex-end;gap:3.825px;flex:none;"),
    "Seconds and timezone share the hours/minutes bottom edge");
  assert.ok(css.includes(".global-clock-zone{margin-left:1.125px}"),
    "Seconds-to-timezone spacing is now 4.95px, reduced 45% from 9px");
  assert.ok(css.includes(".global-clock-seconds,.global-clock-zone{font-size:10px;color:#a0a0a7;"),
    "Seconds match timezone color and font size");
  assert.ok(js.includes('seconds.textContent=part("second");'),
    "The seconds span owns exactly the 2-digit second part, not the leading colon");
  assert.ok(js.includes('time.textContent=String(Number(part("hour")))+":"+part("minute");'),
    "Minutes remain in the large clock span and single-digit hours stay unpadded");
  const mobileRules=css.slice(mobile,css.indexOf("@media(max-width:450px)",mobile));
  assert.ok(mobileRules.includes("opacity:0;visibility:hidden;pointer-events:none;"),
    "Clock still disappears entirely in mobile view");
  for(const file of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(file);
    assert.equal((html.match(/id="global-clock"/g)||[]).length,1);
    assert.equal((html.match(/id="global-clock-seconds"/g)||[]).length,1);
    assert.ok(html.includes('<span id="global-clock-time">--:--</span><span id="global-clock-seconds" class="global-clock-seconds">--</span>'));
  }
});

test("upper navigation stays usable while the clock moves into the lower workspace bar",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.ok(css.includes("@media(max-width:1279px)"),"compact topbar must match the 1279px sidebar rail boundary");
  assert.ok(css.includes("@media(min-width:1280px)"),"full top navigation begins only in wide mode");
  const compact=css.slice(css.lastIndexOf("@media(max-width:1279px)"));
  assert.ok(compact.includes(".global-menu-links{display:none}"),"top-level links are hidden in thin mode");
  assert.ok(compact.includes(".global-menu.is-open .global-menu-links{display:flex}"),"menu button still opens links");
  assert.ok(compact.includes(".global-menu-actions .global-menu-account{display:none}"),"Account is not a center-row button in thin mode");
  assert.ok(!compact.includes(".global-clock{left:50%;right:auto;transform:translate(-50%,-50%)}"),"no centered clock in upper navigation");
  assert.ok(css.includes("#workspace-shell .topbar-start > .global-clock{"),"clock anchored to lower bar");
  for(const htmlPath of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(htmlPath);
    assert.equal((html.match(/id="global-clock"/g)||[]).length,1,"one live clock");
    const upper=html.slice(html.indexOf('<nav class="global-menu"'),html.indexOf('</nav>'));
    const lower=html.slice(html.indexOf('<header class="topbar">'),html.indexOf('<div class="workspace-scroll"'));
    assert.ok(!upper.includes('id="global-clock"'),"upper bar has no clock");
    assert.ok(lower.includes('id="global-clock"'),"lower bar owns clock");
    assert.ok(html.includes('id="global-menu-toggle"'),"right-edge menu control present");
    assert.ok(html.includes('id="global-search-toggle"'),"right-edge search control present");
  }
});


test("Active global navigation keeps its styling but no longer triggers top-scroll",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const js=read("../sites/_apex/app/assets/workspace-nav.js");
  assert.match(css,/\.global-menu-links a,\.global-menu-account\{color:rgba\(230,230,235,\.8\);white-space:nowrap/);
  assert.match(css,/\.global-menu a:hover\{color:#fff;text-decoration:none;\}/);
  assert.doesNotMatch(css,/\.global-menu a\.is-current\{/,
    "The selected route cannot add whiteness or font weight");
  assert.doesNotMatch(js,/if\(route===lastRenderedRoute&&!modified\)\{/);
  assert.match(js,/initWorkspaceTitleTransition\(doc,win,workspaceScroll\.animateToTop\)/);
  assert.match(js,/if\(route&&!modified\)render\(route\)/);
  assert.match(css,/\.shadcn-breadcrumb-link,.shadcn-breadcrumb-page\{[\s\S]*?font-family:inherit;font-weight:inherit;letter-spacing:inherit;[\s\S]*?text-align:left;vertical-align:baseline/);
  assert.match(css,/\.shadcn-breadcrumb-page\{color:var\(--ui-secondary\);font-weight:inherit/);
});

test("doof breadcrumbs follow collapsed page-title left edges, never live sidebar width",()=>{
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const begin=css.indexOf("/* In doof mode, the breadcrumb starts");
  const finish=css.indexOf("#workspace-shell .topbar-start > .global-clock{",begin);
  assert.ok(begin>=0&&finish>begin);
  const rules=css.slice(begin,finish);
  assert.match(rules,/@media\(min-width:1024px\) and \(max-width:1279px\)/);
  assert.match(rules,/@media\(min-width:1280px\)/);
  for(const route of ["projects","colosseum/collections","colosseum/utilities","colosseum/permissions"])
    assert.ok(rules.includes('.view[data-view="'+route+'"]'));
  assert.ok(rules.includes(".pv-route-view"));
  assert.ok(!rules.includes("--workspace-rail-space-width"));
  assert.ok(!rules.includes("--sidebar-expanded-width"));
  assert.ok(!rules.includes(".is-collapsed"));
  assert.ok(!rules.includes(".is-rail-expanded"));
  // Layout identity: header is anchored at 16px; collapsed content begins at
  // 16px + 74px. Check both capped and fluid routes at representative widths.
  for(const [width,fluid] of [[900,false],[1024,false],[1100,true],[1250,false],[1250,true],[1279,false],[1280,false],[1600,true]]){
    const inset=width>=1280?52.48:Math.max(26,Math.min(width*.041,58));
    const centering=width>=1280||fluid?0:Math.max(0,(width-1200)/2);
    const expectedTitleLeft=16+74+inset+centering;
    const breadcrumbLeft=16+(width>=1280?126.48:74+inset+centering);
    assert.ok(Math.abs(breadcrumbLeft-expectedTitleLeft)<1e-8,
      "Doof breadcrumb mismatch at "+width+"px, fluid="+fluid);
  }
});
