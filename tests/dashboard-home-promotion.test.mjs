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
  assert.match(home,/<h1 id="home-title">Workspace<\/h1>/);
  assert.match(home,/href="#projects"/);
  assert.doesNotMatch(home,/Your workspace, all in one place/);
  for(const slug of ["projects","settings","colosseum/collections","colosseum/providers","colosseum/permissions","colosseum/diagnostics"])
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
  assert.match(gpu,/window\.addEventListener\("hashchange"/);
  assert.match(gpu,/window\.addEventListener\("popstate"/);
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
