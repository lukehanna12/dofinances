import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  PROJECT_SHOWCASE as PRIVATE_PROJECTS,PROJECT_CARD_ICONS as PRIVATE_ICONS,
  PROJECT_CARD_IMAGES as PRIVATE_IMAGES,sortProjectShowcase as sortPrivate
} from "../sites/_apex/app/assets/project-showcase.js";
import {
  PROJECT_SHOWCASE as PUBLIC_PROJECTS,PROJECT_CARD_ICONS as PUBLIC_ICONS,
  PROJECT_CARD_IMAGES as PUBLIC_IMAGES,publicProjectImage,sortProjectShowcase
} from "../sites/_apex/assets/public-projects-catalog.js";
import {
  PROJECT_FILTER_CATEGORIES,PROJECT_CATEGORY_BY_KIND,projectMatchesFilters
} from "../sites/_apex/assets/public-projects-controls.js";
import {createAuthGlassHoverController} from "../sites/_apex/assets/home-dashboard/dashboard-auth-hover.js";
import {TILE_FLOATS} from "../sites/_apex/assets/home-dashboard/dashboard-interaction.js";
const load=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public Projects is a curated snapshot, not an authenticated API leak",()=>{
  assert.deepEqual(PUBLIC_PROJECTS,PRIVATE_PROJECTS);
  assert.deepEqual(PUBLIC_ICONS,PRIVATE_ICONS);
  assert.deepEqual(PUBLIC_IMAGES,PRIVATE_IMAGES);
  assert.deepEqual(sortProjectShowcase(PUBLIC_PROJECTS),sortPrivate(PRIVATE_PROJECTS));
  assert.equal(PUBLIC_PROJECTS.length,14);
  const fallback=publicProjectImage({slug:"terminal-scalars"},6);
  assert.match(fallback,/^\/wallpapers\/[a-f0-9]{64}\.[a-z]+$/);
});
test("Projects search and the five multiselect filters use only public curated kinds",()=>{
  assert.deepEqual(PROJECT_FILTER_CATEGORIES,
    ["Applications","Extensions","Plugins","Add-ons","CLIs"]);
  assert.equal(PUBLIC_PROJECTS.length,14);
  const types=new Set(PROJECT_FILTER_CATEGORIES);
  for(const p of PUBLIC_PROJECTS)
    assert.ok(types.has(PROJECT_CATEGORY_BY_KIND[p.kind]),"Unclassified "+p.slug);
  const all=PUBLIC_PROJECTS.filter(project=>projectMatchesFilters(project));
  assert.equal(all.length,14);
  const extensions=PUBLIC_PROJECTS.filter(project=>
    projectMatchesFilters(project,"",new Set(["Extensions"])));
  assert.deepEqual(extensions.map(project=>project.name).sort(),["ChatStore","ReadMe GLP"]);
  const cliAndExt=PUBLIC_PROJECTS.filter(project=>
    projectMatchesFilters(project,"",new Set(["CLIs","Extensions"])));
  assert.equal(cliAndExt.length,5);
  assert.equal(PUBLIC_PROJECTS.filter(project=>
    projectMatchesFilters(project,"ReadMe",new Set(["Extensions"]))).length,1);
  assert.equal(PUBLIC_PROJECTS.filter(project=>
    projectMatchesFilters(project,"ReadMe",new Set(["CLIs"]))).length,0);
  assert.equal(PUBLIC_PROJECTS.filter(project=>
    projectMatchesFilters(project,"no-project-can-match-this-phrase")).length,0);
});
test("all three public Projects triggers use the persistent route registry",async()=>{
  const [html,router,entry,workflow]=await Promise.all([
    load("../sites/_apex/index.html"),load("../sites/_apex/assets/public-home-transition.js"),
    load("../sites/_apex/assets/public-projects-entry.js"),load("../.github/workflows/site.yml")
  ]);
  assert.equal((html.match(/data-public-target="\/projects"/g)||[]).length,3);
  assert.match(router,/\["\/projects",\{module:"\/assets\/public-projects-entry\.js"/);
  assert.match(router,/onExitComplete:finishClose/);
  assert.match(router,/dispatchEvent\(new CustomEvent\("dofinances:home-dismiss"/);
  assert.match(router,/dispatchEvent\(new CustomEvent\("dofinances:home-restore"/);
  assert.match(router,/function finishClose\(\)/);
  assert.match(workflow,/sites\/_apex\/projects\/index\.html/);
  assert.match(entry,/export function mountProjects\(host,\{onBack,onExitComplete\}\)/);
  assert.match(entry,/root\.classList\.add\("is-exiting"\)/);
  assert.match(entry,/project-showcase-card/);
  assert.match(entry,/card\.type="button"/);
  assert.match(entry,/mountProjectControls\(\{root,headingRow,grid,projects,animateGlass\}\)/);
  assert.match(entry,/const PROJECT_EXIT_DURATION_MS=420;/);
  assert.match(entry,/const PROJECT_EXIT_STAGGER_MS=45;/);
  assert.match(entry,/const PROJECT_EXIT_TAIL_MS=60;/);
  assert.doesNotMatch(entry,/\bfetch\s*\(|\blocation\.(assign|replace)\s*\(|\bcard\.href\s*=|["']\/app\/assets/);
});
test("projects glass uses the exact existing WebGPU pane pipeline, not CSS optics",async()=>{
  const [renderer,hover,css,shader,controls]=await Promise.all([
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-auth-hover.js"),
    load("../sites/_apex/assets/public-projects.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/assets/public-projects-controls.js")
  ]);
  assert.match(renderer,/const AUTH_PANE_CAPACITY=24;/);
  assert.match(renderer,/\.public-projects-root/);
  assert.match(renderer,/projects\?"independent":"nested"/);
  assert.match(renderer,/node\.dataset\.publicProjectGlass==="filter-dropdown"/);
  assert.match(renderer,/node\.dataset\.publicProjectGlass==="title"\)return -8;/);
  assert.match(renderer,/syncProjectTitleMask\(panes\)/);
  assert.match(renderer,/glyphMaskTexture\.createView\(\)/);
  assert.match(renderer,/rebindGlassGroups\(\)/);
  assert.match(renderer,/device\.queue\.writeTexture\(\{texture\},pixels/);
  assert.match(renderer,/titleGlyphGlass:roles\.includes\("title"\)/);
  assert.match(renderer,/node\.hidden\|\|getComputedStyle\(node\)\.display==="none"/);
  assert.match(controls,/github\.href="https:\/\/github\.com\/lukehanna12"/);
  assert.match(controls,/github\.target="_blank"/);
  assert.match(controls,/github\.rel="noopener noreferrer"/);
  assert.match(controls,/input\.focus\(\{preventScroll:true\}\)/);
  assert.match(controls,/if\(filterOpen&&!filterWrap\.contains\(event\.target\)\)closeFilters\(\)/);
  assert.match(renderer,/audit\.projectGlass=\{renderer:"shared-webgpu-glassPipeline"/);
  assert.match(renderer,/authPass\.setPipeline\(glassPipeline\)/);
  assert.match(renderer,/authPass\.draw\(6,AUTH_PANE_CAPACITY,0,tileCount\)/);
  assert.match(renderer,/tileData\[p\+5\]=authPaneMaterialTag\(node\)/);
  assert.match(hover,/mode="nested"/);
  assert.match(shader,/if\(authPane\)\{/);
  assert.doesNotMatch(css,/backdrop-filter\s*:\s*blur\(|-webkit-backdrop-filter\s*:\s*blur\(|filter\s*:\s*blur\(/);
  assert.match(css,/body\.public-home\[data-auth-gpu-scene="ready"\]/);
  assert.match(css,/@keyframes project-showcase-enter\{from\{opacity:0;transform:translateY\(24px\)\}to\{opacity:1;transform:translateY\(0\)\}\}/);
  assert.match(css,/@keyframes project-showcase-exit\{from\{opacity:1;transform:translateY\(0\)\}to\{opacity:0;transform:translateY\(24px\)\}\}/);
  assert.match(css,/\.public-projects-header\{\s*display:flex;flex-direction:column;align-items:flex-start;/);
  assert.match(css,/font-size:clamp\(34\.5px,3vw,46\.5px\)/);
  assert.match(css,/\.public-projects-root \.public-projects-title\{\s*color:transparent!important;/);
  assert.match(shader,/@group\(0\) @binding\(4\) var titleGlyphAlpha: texture_2d<f32>;/);
  assert.match(shader,/fn titleGlyphField\(local:vec2<f32>\)/);
  assert.match(shader,/let glassTitle=tile\.properties\.y == -8\.0;/);
  assert.match(shader,/glyphCoverage,glassTitle/);
  assert.match(shader,/let inner=refractionEnvelope\(signed,innerAmount,innerInvHeight\);/);
  assert.match(css,/\.public-projects-search-field\{[\s\S]*?transform-origin:right center;/);
  assert.match(css,/\.public-projects-filter-panel\{[\s\S]*?transform-origin:top right/);
  assert.match(css,/\.public-projects-root \.project-showcase-card\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.public-projects-root\.is-exiting \.project-showcase-card\{\s*animation:project-showcase-exit \.42s both;/);
  assert.match(css,/animation-delay:calc\(var\(--project-reverse-index,0\)\*45ms\)/);
  assert.match(css,/\.public-projects-root\.is-exiting \.public-projects-back,\s*\.public-projects-root\.is-exiting \.public-projects-title/);
});
test("independent project panes get isolated hover springs without breaking nested login",()=>{
  const base=2,capacity=3,data=new Float32Array((base+capacity)*TILE_FLOATS);
  for(let i=0;i<capacity;i++){
    const at=(base+i)*TILE_FLOATS;
    data[at]=i*120;data[at+1]=10;data[at+2]=100;data[at+3]=100;
  }
  const mask=new Uint8Array(base+capacity);
  const hover=createAuthGlassHoverController(capacity);
  hover.retargetRects(data,base,mask,"independent");
  hover.move(150,40);
  hover.advance(.03,false);
  assert.equal(hover.activeControl,1);
  assert.equal(hover.snapshot(0).active,false);
  assert.equal(hover.snapshot(1).active,true);
  assert.equal(hover.snapshot(2).active,false);
  hover.move(270,40);
  hover.advance(.03,false);
  assert.equal(hover.activeControl,2);
  hover.clear();
  assert.equal(hover.activeControl,-1);
  hover.retargetRects(data,base,mask,"nested");
  hover.move(30,30);
  assert.equal(hover.cardHovered,true);
  assert.equal(hover.controlHovered,false);
});
