import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const read=name=>readFileSync(new URL("../sites/_apex/app/"+name,import.meta.url),"utf8");
const asset=name=>read("assets/"+name);

test("Production Home replaces only its own view with the exact CTA6 mosaic",()=>{
  const html=read("index.html");
  const homeStart=html.indexOf('<section class="view dashboard-home" data-view="dashboard"');
  const projectsStart=html.indexOf('<section class="view" data-view="projects"');
  assert.ok(homeStart>=0&&projectsStart>homeStart);
  const home=html.slice(homeStart,projectsStart);
  assert.match(home,/id="cta6-mosaic"/);
  assert.match(home,/<h1 id="dashboard-title">doof<\/h1>/);
  assert.match(home,/href="#projects"/);
  assert.ok(home.includes('<a class="cta6-action" href="#projects">See Projects <svg'),
    "The original action label remains readable before its arrow");
  assert.match(home,/<a class="cta6-action" href="#projects">See Projects <svg[^>]+aria-hidden="true"[^>]*><path d="M5 12h14m-6-6 6 6-6 6"\/><\/svg><\/a>/,
    "Decorative right arrow stays inside the existing Projects link after the text");
  assert.ok(home.indexOf('class="cta6-bottom-action"')>home.indexOf('class="cta6-center"'),
    "See Projects should be separate from the centered title");
  assert.ok(!home.slice(home.indexOf('class="cta6-center"'),home.indexOf('class="cta6-bottom-action"')).includes('cta6-action'),
    "No action remains inside the centered mosaic title");
  assert.equal((home.slice(home.indexOf('class="cta6-bottom-action"'),home.indexOf("</section>")).match(/<svg /g)||[]).length,1,
    "Only one decorative right-arrow SVG appears inside the bottom button");
  assert.ok(asset("dashboard-home.css").includes(".dashboard-home .cta6-action svg{width:15px;height:15px;flex:none}"),
    "Existing desktop icon sizing is preserved");
  assert.ok(asset("dashboard-home.css").includes(".dashboard-home .cta6-action svg{width:12px;height:12px}"),
    "Existing mobile icon sizing is preserved");
  assert.doesNotMatch(home,/Your workspace, all in one place/);
  for(const slug of ["projects","settings","colosseum/collections","colosseum/providers/local","colosseum/providers/external","colosseum/providers/credentials","colosseum/permissions","colosseum/diagnostics"])
    assert.ok(html.includes('data-view="'+slug+'"'),"Preserve "+slug+" view");
  assert.ok(html.includes('/app/assets/dashboard.js'),"Keep the authenticated production controller");
  assert.ok(html.includes('/app/assets/dashboard-home-loader.js'));
  assert.ok(!html.includes('dashboard-preview.js'),"Do not disable production navigation");
});

test("Home-only CSS cannot hide the sidebar, topbar, or photo on other routes",()=>{
  const css=asset("dashboard-home.css");
  const active='body:has(> #workspace-shell .dashboard-home:not([hidden]))';
  assert.ok(css.includes(active+' #workspace-shell .sidebar'));
  assert.ok(css.includes(active+' #workspace-shell .topbar'));
  assert.ok(css.includes('html:has(body > #workspace-shell .dashboard-home:not([hidden]))'));
  assert.ok(!css.includes('body:has(> #workspace-shell .dashboard-home)'));
  assert.ok(!css.includes('body[data-gpu-scene="ready"]::before'));
  assert.ok(css.includes('body:not(:has(> #workspace-shell .dashboard-home:not([hidden]))) #dashboard-webgpu-scene'));
  assert.ok(!asset("dashboard-home-loader.js").includes("stopImmediatePropagation"));
  assert.ok(!asset("dashboard-home-loader.js").includes("preventDefault"));
});

test("WebGPU is lazy-loaded for Home, suspended on departure, restored on return",()=>{
  const loader=asset("dashboard-home-loader.js"),gpu=asset("dashboard-gpu-renderer.js");
  assert.match(loader,/if\(dashboardLoaded\|\|!homeVisible\(\)\)return/);
  assert.match(loader,/import\("\.\/dashboard-gpu-renderer\.js"\)/);
  assert.match(gpu,/const homeActive=/);
  assert.match(gpu,/if\(!homeActive\(\)\|\|!engine\|\|stopped\|\|raf\)return/);
  assert.match(gpu,/function syncDashboardRoute\(\)/);
  assert.ok(gpu.includes('window.addEventListener?.("hashchange"'));
  assert.ok(gpu.includes('window.addEventListener?.("popstate"'));
  assert.match(gpu,/trackRunning=false/);
  assert.doesNotMatch(loader,/setInterval\(/);
});

test("Original preview shader data and source photograph survive byte-for-byte",()=>{
  for(const file of ["dashboard-gpu-scene.wgsl","dashboard-gpu-mipmap.wgsl","dashboard-gpu-glass.wgsl",
    "dashboard-mosaic.js","dashboard-optics.js","dashboard-interaction.js","dashboard-track.js","dashboard-tint.js"])
    assert.ok(existsSync(new URL("../sites/_apex/app/assets/"+file,import.meta.url)),file);
  const avif=readFileSync(new URL("../sites/_apex/app/assets/dashboard-cloud-veiled-colorful-fields.avif",import.meta.url));
  assert.equal(avif.byteLength,106094);
  assert.equal(createHash("sha256").update(avif).digest("hex"),"80006c73c633b57a9a2e63d17df9bbf35e8c86bc6d23491a12600eb8911842f2");
});

test("Palette's row gains exactly one glass tile, three slots to its right",()=>{
  const mosaic=asset("dashboard-mosaic.js");
  const iconCoordinates=Object.fromEntries([...mosaic.matchAll(/"(\d+:\d+)": "([A-Za-z]+)"/g)]
    .map(([,position,icon])=>[position,icon]));
  assert.equal(Object.keys(iconCoordinates).length,16,"Keep every original icon in place");
  assert.equal(iconCoordinates["3:0"],"Palette");
  assert.equal(iconCoordinates["3:3"],undefined,"The added square is icon-free");
  const match=mosaic.match(/const centerGlass=new Set\((\[[^\n]*\])\);/);
  assert.ok(match,"Keep explicit center-grid additions");
  assert.deepEqual(JSON.parse(match[1]).sort(),["2:4","2:6","3:3","3:5","4:3"]);
  assert.match(mosaic,/const center=row>=2&&row<=3&&col>=3&&col<=7;/);
  assert.match(mosaic,/const filled=centerGlass\.has\(row\+":"\+col\) \|\|/);
  assert.match(mosaic,/for\(let index=0;index<66;index\+\+\)/,
    "Preserve the original 11 by 6 grid");
});

test("Home bottom action and global navigation hiding remain scoped to the active Home route",()=>{
  const css=asset("dashboard-home.css"),html=read("index.html");
  const scope='body:has(> #workspace-shell .dashboard-home:not([hidden]))';
  assert.ok(css.includes('.dashboard-home .cta6-bottom-action{'));
  assert.ok(css.includes('bottom:calc(clamp(42px,5.4vh,66px) + env(safe-area-inset-bottom,0px));'));
  assert.ok(css.includes('transform:translateX(-50%);'));
  assert.ok(css.includes('.dashboard-home .cta6-bottom-action .cta6-action{margin-top:0}'));
  assert.ok(css.includes(scope+' #global-clock,'));
  assert.ok(css.includes(scope+' #global-menu-links > a[href="#dashboard"]{'));
  assert.ok(html.includes('id="global-clock"'));
  assert.ok(html.includes('href="#dashboard">Dashboard</a>'));
  assert.ok(html.includes('<h1 id="dashboard-title">doof</h1>'));
});

test("Dashboard alone uses #676b71 for the upper bar and removes its Account button",()=>{
  const css=asset("dashboard-home.css"),html=read("index.html");
  const scope='body:has(> #workspace-shell .dashboard-home:not([hidden]))';
  const nl=String.fromCharCode(10);
  assert.ok(css.includes([scope+' > .global-menu{','  background:#676b71;','}'].join(nl)),
    "Only the active Home route may recolor the global navigation bar");
  assert.ok(css.includes([scope+' > .global-menu .global-menu-account{','  display:none!important;','}'].join(nl)),
    "Only the active Home route may hide the upper Account action");
  assert.ok(html.includes('<a class="global-menu-account" data-global-route href="#settings">Account</a>'),
    "The Account link remains present for every other workspace route");
  assert.ok(html.includes('href="#settings">Settings</a>'),
    "Keep Settings reachable from the global navigation");
});

test("Home squares and centered Doof hold the maximum-width scale when the viewport narrows",()=>{
  const css=asset("dashboard-home.css");
  const latticeRules=[...css.matchAll(/\.dashboard-home \.cta6\{([^}]*)\}/g)]
    .map(([,rule])=>rule);
  assert.equal(latticeRules.length,3,
    "Retain the original, viewport-centered and optical composition rules");
  const declaredWidths=latticeRules.map(rule=>rule.match(/\bwidth:\s*([^;]+);/)?.[1]).filter(Boolean);
  assert.deepEqual(declaredWidths,["1080px","1080px"],
    "The mosaic must remain 1080px wide at desktop and mobile breakpoints");
  assert.match(latticeRules[1],/position:absolute;/,
    "Keep the mosaic anchored to the fixed viewport");
  assert.match(latticeRules[1],/left:50%;\s*top:50%;\s*transform:translate\(-50%,-50%\);/,
    "Center the oversized mosaic independently of flex auto margins");
  assert.match(latticeRules[1],/margin:0;/,
    "Auto margins must not interfere with oversize centering");
  const gutterRules=[...css.matchAll(/--cta6-grid-gap:\s*([^;]+);/g)].map(([,gap])=>gap);
  assert.deepEqual(gutterRules,["13px"],"Keep full-size gutter spacing at all widths");
  assert.match(css,/\.dashboard-home \.cta6-tile\{[^}]*border-radius:17px;/,
    "Tiles retain their maximum-width rounded corners");
  assert.match(css,/\.dashboard-home \.cta6-center h1\{[^}]*--cta6-title-tile:calc\(\(1080px - 10 \* var\(--cta6-grid-gap\)\)\/11\);/);
  assert.match(css,/\.dashboard-home \.cta6-center h1\{[^}]*font-size:45px;/,
    "The Doof logo must not shrink with the viewport");
  assert.match(css,/translate:0 calc\(-0\.5 \* var\(--cta6-title-tile\)\)/,
    "Keep the title raised by exactly half a fixed-size square");
  assert.match(css,/width:100vw;\s*height:var\(--dashboard-scene-height\);\s*overflow-x:clip;/,
    "Crop horizontally rather than shrinking or introducing a scrollbar");
  assert.match(css,/\.dashboard-home \.cta6-mosaic\{[^}]*grid-template-columns:repeat\(11,minmax\(0,1fr\)\)/,
    "Preserve the eleven-column grid");
  assert.doesNotMatch(css,/--cta6-grid-gap:clamp\(/);
  assert.doesNotMatch(css,/--cta6-title-tile:calc\(\(100vw/);
  assert.doesNotMatch(css,/\.dashboard-home \.cta6-center h1\{font-size:clamp\(/);
  assert.doesNotMatch(css,/width:calc\(100vw - 26px\)/);
  const tileWidth=(1080 - 10*13)/11;
  assert.equal(tileWidth,950/11,"Tile width is independent of window width and height");
  assert.match(css,/\.dashboard-home \.cta6-bottom-action\{[\s\S]*?transform:translateX\(-50%\)/,
    "Keep the independent See Projects button centered");
});

test("See Projects has a borderless black surface with exact inset shadow and a white arrow",()=>{
  const css=asset("dashboard-home.css"),html=read("index.html");
  assert.match(css,/\.dashboard-home \.cta6-action\{[\s\S]*?background:#000;\s*color:#fff;\s*border:0;\s*box-shadow:rgba\(255, 255, 255, 0\.2\) 0px 0px 1px inset;/);
  assert.match(css,/\.dashboard-home \.cta6-action svg\{color:#fff;stroke:#fff\}/);
  assert.match(css,/\.dashboard-home \.cta6-action:visited\{color:#fff\}/);
  assert.match(css,/\.dashboard-home \.cta6-action:hover\{\s*background:#000;\s*transform:scale\(1\.03\);\s*box-shadow:rgba\(255, 255, 255, 0\.2\) 0px 0px 1px inset;/);
  assert.match(html,/<a class="cta6-action" href="#projects">See Projects <svg[^>]*stroke="currentColor"/);
});
