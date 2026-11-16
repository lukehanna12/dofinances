import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const read=name=>readFileSync(new URL("../sites/_apex/app/"+name,import.meta.url),"utf8");
const asset=name=>read("assets/"+name);

test("Production Home replaces only its own view with the exact CTA6 mosaic",()=>{
  const html=read("index.html");
  const homeStart=html.indexOf('<section class="view dashboard-home" data-view="home"');
  const projectsStart=html.indexOf('<section class="view" data-view="projects"');
  assert.ok(homeStart>=0&&projectsStart>homeStart);
  const home=html.slice(homeStart,projectsStart);
  assert.match(home,/id="cta6-mosaic"/);
  assert.match(home,/<h1 id="home-title">doof<\/h1>/);
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
  assert.ok(css.includes(scope+' #global-menu-links > a[href="#home"]{'));
  assert.ok(html.includes('id="global-clock"'));
  assert.ok(html.includes('href="#home">Workspace</a>'));
  assert.ok(html.includes('<h1 id="home-title">doof</h1>'));
});

test("Home title rises exactly half a responsive mosaic square without moving the grid or action",()=>{
  const css=asset("dashboard-home.css");
  assert.match(css,/--cta6-title-tile:calc\(\(min\(calc\(100vw - 32px\),1080px\) - 10 \* clamp\(6px,0\.75vw,13px\)\)\/11\)/);
  assert.match(css,/translate:0 calc\(-0\.5 \* var\(--cta6-title-tile\)\)/);
  assert.match(css,/--cta6-title-tile:calc\(\(100vw - 26px - 10 \* clamp\(3px,1\.1vw,7px\)\)\/11\)/);
  const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
  const calculate=(viewport,mobile)=>{
    const width=mobile?viewport-26:Math.min(viewport-32,1080);
    const gap=mobile?clamp(viewport*0.011,3,7):clamp(viewport*0.0075,6,13);
    return {square:(width-10*gap)/11,offset:-(width-10*gap)/22};
  };
  for(const [viewport,mobile] of [[1440,false],[1024,false],[760,true],[390,true],[320,true]]){
    const {square,offset}=calculate(viewport,mobile);
    assert.ok(square>0);
    assert.ok(Math.abs(offset/square+0.5)<1e-12,"Title offset must equal half a square at "+viewport+"px");
  }
  assert.match(css,/\.dashboard-home \.cta6-bottom-action\{[\s\S]*?transform:translateX\(-50%\)/);
  assert.match(css,/\.dashboard-home \.cta6-mosaic\{[\s\S]*?grid-template-columns:repeat\(11,minmax\(0,1fr\)\)/);
});

test("See Projects has a borderless black surface with exact inset shadow and a white arrow",()=>{
  const css=asset("dashboard-home.css"),html=read("index.html");
  assert.match(css,/\.dashboard-home \.cta6-action\{[\s\S]*?background:#000;\s*color:#fff;\s*border:0;\s*box-shadow:rgba\(255, 255, 255, 0\.2\) 0px 0px 1px inset;/);
  assert.match(css,/\.dashboard-home \.cta6-action svg\{color:#fff;stroke:#fff\}/);
  assert.match(css,/\.dashboard-home \.cta6-action:visited\{color:#fff\}/);
  assert.match(css,/\.dashboard-home \.cta6-action:hover\{\s*background:#000;\s*transform:scale\(1\.03\);\s*box-shadow:rgba\(255, 255, 255, 0\.2\) 0px 0px 1px inset;/);
  assert.match(html,/<a class="cta6-action" href="#projects">See Projects <svg[^>]*stroke="currentColor"/);
});
