import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  PROJECT_SHOWCASE as PRIVATE_PROJECTS,PROJECT_CARD_ICONS as PRIVATE_ICONS,
  PROJECT_CARD_IMAGES as PRIVATE_IMAGES,sortProjectShowcase as sortPrivate,
  projectShowcaseStatus as privateStatus
} from "../sites/_apex/app/assets/project-showcase.js";
import {
  PROJECT_SHOWCASE as PUBLIC_PROJECTS,PROJECT_CARD_ICONS as PUBLIC_ICONS,
  PROJECT_CARD_IMAGES as PUBLIC_IMAGES,publicProjectImage,sortProjectShowcase,
  projectShowcaseStatus as publicStatus
} from "../sites/_apex/assets/public-projects-catalog.js";
import {
  PROJECT_FILTER_CATEGORIES,PROJECT_CATEGORY_BY_KIND,projectMatchesFilters
} from "../sites/_apex/assets/public-projects-controls.js";
import {createAuthGlassHoverController} from "../sites/_apex/assets/home-dashboard/dashboard-auth-hover.js";
import {
  normalizeGlassCornerRadii,glassPaneNeedsLiveTransform
} from "../sites/_apex/assets/home-dashboard/dashboard-glass-geometry.js";
import {TILE_FLOATS} from "../sites/_apex/assets/home-dashboard/dashboard-interaction.js";
const load=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public Projects is a curated snapshot, not an authenticated API leak",()=>{
  assert.deepEqual(PUBLIC_PROJECTS,PRIVATE_PROJECTS);
  assert.deepEqual(PUBLIC_ICONS,PRIVATE_ICONS);
  assert.deepEqual(PUBLIC_IMAGES,PRIVATE_IMAGES);
  assert.deepEqual(sortProjectShowcase(PUBLIC_PROJECTS),sortPrivate(PRIVATE_PROJECTS));
  assert.equal(PUBLIC_PROJECTS.length,16);
  assert.equal(publicProjectImage({slug:"terminal-scalars"},6),
    "/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp",
    "The attached Manfred Mohr artwork is served locally on the public site");
  assert.equal(publicProjectImage({slug:"app-caviar"},12),"/assets/project-art/app-caviar-source.v1.webp");
  assert.equal(publicProjectImage({slug:"hidden-functions"},14),"https://api.nga.gov/iiif/5fcee9f7-9c78-4432-96c2-4228fc697aa7/full/!800,800/0/default.jpg");
  assert.equal(publicProjectImage({slug:"latexcel"},15),"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg");
  const fallback=publicProjectImage({slug:"__unassigned__"},12);
  assert.match(fallback,/^\/wallpapers\/[a-f0-9]{64}\.[a-z]+$/);
  assert.equal(PUBLIC_ICONS["apple-hig-reader"],"apple-higs-reader.v4");
  assert.equal(PRIVATE_ICONS["apple-hig-reader"],"apple-higs-reader.v4");
});
test("Named art sources and all-sided Piranesi crop are the same on both routes",async()=>{
  const [publicCSS,privateCSS]=await Promise.all([
    load("../sites/_apex/assets/public-projects.css"),
    load("../sites/_apex/app/assets/project-showcase.css")
  ]);
  for(const css of [publicCSS,privateCSS]){
    assert.match(css,/\[data-project-slug="hidden-functions"\][^{}]*\.project-showcase-photo\{\s*transform:scale\(1\.221\)/);
    assert.match(css,/\[data-project-slug="hidden-functions"\]\.is-photo-ready[^{}]*\.project-showcase-photo\{\s*transform:scale\(1\.11\)/);
  }
  assert.deepEqual(PUBLIC_IMAGES,PRIVATE_IMAGES);
});
test("new Coming Soon cards and their exact supplied SVGs appear in both Projects views",async()=>{
  const incoming=[
    ["hidden-functions","Hidden Functions","M 14 2 A2.4 2.4 0 0 1 15.704 2.706"],
    ["latexcel","LaTeXceL","M14 17h2l2 5 2-10h2.5"]
  ];
  const sorted=sortProjectShowcase(PUBLIC_PROJECTS);
  assert.deepEqual(sorted.slice(-2).map(project=>project.slug),
    incoming.map(row=>row[0]),"The new Coming Soon cards end the curated catalog");
  for(const [slug,name,specialPath] of incoming){
    const match=PUBLIC_PROJECTS.find(project=>project.slug===slug);
    assert.ok(match,"Missing project "+slug);
    assert.equal(match.name,name);
    assert.equal(match.kind,"Project");
    assert.equal(match.status,"coming-soon");
    assert.equal(match.repository,null);
    assert.equal(publicStatus(match),"Coming Soon");
    assert.equal(privateStatus(PRIVATE_PROJECTS.find(project=>project.slug===slug)),"Coming Soon");
    assert.equal(PUBLIC_ICONS[slug],slug);
    assert.equal(PRIVATE_ICONS[slug],slug);
    const [pub,priv]=await Promise.all([
      load("../sites/_apex/assets/project-icons/"+slug+".svg"),
      load("../sites/_apex/app/assets/project-icons/"+slug+".svg")
    ]);
    assert.equal(pub,priv,"Both routes must use the identical authored icon");
    assert.match(pub,/<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(pub,/viewBox="0 0 24 24"/);
    assert.match(pub,/stroke-width="2"/);
    assert.ok(pub.includes(specialPath),"Original supplied SVG geometry changed");
  }
});
test("Projects search and the five multiselect filters use only public curated kinds",()=>{
  assert.deepEqual(PROJECT_FILTER_CATEGORIES,
    ["Applications","Extensions","Plugins","Add-ons","CLIs"]);
  assert.equal(PUBLIC_PROJECTS.length,16);
  const types=new Set(PROJECT_FILTER_CATEGORIES);
  for(const p of PUBLIC_PROJECTS)
    assert.ok(types.has(PROJECT_CATEGORY_BY_KIND[p.kind]),"Unclassified "+p.slug);
  const all=PUBLIC_PROJECTS.filter(project=>projectMatchesFilters(project));
  assert.equal(all.length,16);
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
test("WebGPU capsule radius resolves to the rendered CSS semicircle",()=>{
  assert.deepEqual(normalizeGlassCornerRadii(["999px","999px","999px","999px"],390,40),
    [20,20,20,20],
    "A long pill MUST NOT pass 999px into the mode4 glass SDF");
  assert.deepEqual(normalizeGlassCornerRadii(["999px","999px","999px","999px"],10,40),
    [5,5,5,5],
    "While opening, the GPU capsule follows its live scaleX transform");
  assert.deepEqual(normalizeGlassCornerRadii(["999px","999px","999px","999px"],40,40),
    [20,20,20,20],"The circular search cancel has a valid glass SDF");
  assert.deepEqual(normalizeGlassCornerRadii(["12px","12px","12px","12px"],40,40),
    [12,12,12,12],"Existing square button optical geometry must stay unchanged");
  assert.deepEqual(normalizeGlassCornerRadii(["10px","10px","10px","10px"],200,250),
    [10,10,10,10],"Existing project card optical geometry stays unchanged");
  assert.equal(glassPaneNeedsLiveTransform("search-field"),true);
  assert.equal(glassPaneNeedsLiveTransform("filter-dropdown"),true);
  assert.equal(glassPaneNeedsLiveTransform("card"),false);
  assert.equal(glassPaneNeedsLiveTransform("title"),false);
  assert.throws(()=>normalizeGlassCornerRadii(["999px"],390,40),TypeError);
  assert.throws(()=>normalizeGlassCornerRadii(["999px","999px","999px","999px"],0,40),RangeError);
});
test("all three public Projects triggers use the persistent route registry",async()=>{
  const [html,router,entry,workflow,homeCss]=await Promise.all([
    load("../sites/_apex/index.html"),load("../sites/_apex/assets/public-home-transition.js"),
    load("../sites/_apex/assets/public-projects-entry.js"),load("../.github/workflows/site.yml"),
    load("../sites/_apex/assets/public-home.css")
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
  assert.match(entry,/const PROJECT_ENTER_DURATION_MS=500;/);
  assert.match(entry,/const PROJECT_ENTER_HEADING_DELAY_MS=165;/);
  assert.match(entry,/const PROJECT_ENTER_FIRST_CARD_DELAY_MS=330;/);
  assert.match(entry,/const PROJECT_ENTER_STAGGER_MS=65;/);
  assert.match(entry,/const PROJECT_LOGO_SEARCH_GAP_PX=5;/);
  assert.match(entry,/const searchCapsule=headingRow\.querySelector\("\.public-projects-search-field"\);/);
  assert.match(entry,/const searchTop=searchCapsule\.getBoundingClientRect\(\)\.top;/);
  assert.match(entry,/const logoBottom=logo\.getBoundingClientRect\(\)\.bottom;/);
  assert.match(entry,/const hide=routeScroll\.scrollTop>0&&\s*searchTop<=logoBottom\+PROJECT_LOGO_SEARCH_GAP_PX;/);
  assert.match(entry,/document\.body\.toggleAttribute\("data-projects-logo-hidden",hide\)/);
  assert.match(entry,/routeScroll\?\.addEventListener\("scroll",syncLogoWithScroll,/);
  assert.doesNotMatch(entry,/addEventListener\("resize",syncLogoWithScroll/);
  assert.doesNotMatch(entry,/visualViewport\?\.addEventListener\("resize"/);
  assert.match(router,/!outlet\.querySelector\("\.public-projects-root"\)\)positionCompactLogo\(\);/);
  assert.match(homeCss,/body\.public-home\[data-projects-logo-pinned="true"\]/);
  assert.match(entry,/document\.body\.dataset\.projectsLogoPinned="true"/);
  assert.match(entry,/document\.body\.removeAttribute\("data-projects-logo-pinned"\)/);
  assert.match(homeCss,/body\.public-home\[data-projects-logo-pinned="true"\] > #dashboard-title\{/);
  assert.match(homeCss,/position:fixed;\s*top:90px;\s*left:50%;/);
  assert.match(homeCss,/transform:translate\(-50%,-50%\) scale\(\.6\)/);
  assert.doesNotMatch(homeCss,/calc\(283\.90909px - 50dvh\)/);
  assert.match(entry,/const logoHomeParent=logo\?\.parentElement\?\?null;/);
  assert.match(entry,/if\(logoHomeParent\)document\.body\.append\(logo\);/);
  assert.match(entry,/logoHomeParent\.append\(logo\);/);
  assert.match(router,/if\(activeRoute==="\/projects"\)positionCompactLogo\(\);/);
  assert.match(homeCss,/transition:opacity 210ms cubic-bezier\(\.22,\.72,\.24,1\)!important/);
  assert.match(entry,/logoScrollAbort\.abort\(\)/);
  assert.match(entry,/document\.body\.removeAttribute\("data-projects-logo-hidden"\)/);
  assert.match(homeCss,/body\.public-home\[data-projects-logo-hidden\] #dashboard-title\{\s*opacity:0;/);
  assert.match(homeCss,/transition:transform 440ms cubic-bezier\(\.22,\.72,\.24,1\),\s*opacity 210ms cubic-bezier\(\.22,\.72,\.24,1\);/);
  assert.match(homeCss,/body\.public-home\[data-direct-login="true"\]:has\(\.public-projects-root\)/);
  assert.match(entry,/root\.style\.setProperty\("--project-heading-enter-delay",PROJECT_ENTER_HEADING_DELAY_MS\+"ms"\)/);
  assert.match(entry,/root\.style\.setProperty\("--project-first-card-enter-delay",PROJECT_ENTER_FIRST_CARD_DELAY_MS\+"ms"\)/);
  assert.match(entry,/PROJECT_ENTER_FIRST_CARD_DELAY_MS\+\s*PROJECT_ENTER_DURATION_MS\+15\*PROJECT_ENTER_STAGGER_MS\+PROJECT_ENTER_TAIL_MS/);
  assert.match(entry,/const PROJECT_EXIT_DURATION_MS=420;/);
  assert.match(entry,/const PROJECT_EXIT_STAGGER_MS=45;/);
  assert.match(entry,/const PROJECT_EXIT_TAIL_MS=60;/);
  assert.match(entry,/const PROJECT_HEADER_DISMISS_DELAY_MS=15\*PROJECT_EXIT_STAGGER_MS;/);
  assert.match(entry,/import \{DISMISS_MS\} from "\.\/home-dashboard\/dashboard-public-dismiss\.js";/);
  assert.match(entry,/root\.dataset\.projectHeaderDismissAt=String\(performance\.now\(\)\)/);
  assert.match(entry,/root\.classList\.add\("is-dissolving-header"\)/);
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
  assert.match(renderer,/projects\|\|homeCtas\?"independent":"nested"/);
  assert.match(renderer,/node\.dataset\.publicProjectGlass==="filter-dropdown"/);
  assert.match(renderer,/node\.dataset\.publicProjectGlass==="title"\)return -8;/);
  assert.match(renderer,/syncProjectTitleMask\(panes\)/);
  assert.match(renderer,/normalizeGlassCornerRadii\(\[/);
  assert.match(renderer,/const live=tile\.hasAttribute\("data-home-cta-glass"\)\|\|\s*glassPaneNeedsLiveTransform\(tile\.dataset\?\.publicProjectGlass\)/);
  assert.match(renderer,/const w=live\?Math\.max\(1,b\.width\):tile\.offsetWidth;/);
  assert.match(renderer,/searchGlass,/);
  assert.match(controls,/FILTER_MORPH_ICON=svg\(/);
  assert.match(controls,/class="public-projects-icon-morph"/);
  assert.doesNotMatch(controls,/FILTER_ICON\+FILTER_UP/);
  assert.match(renderer,/glyphMaskTexture\.createView\(\)/);
  assert.match(renderer,/rebindGlassGroups\(\)/);
  assert.match(renderer,/device\.queue\.writeTexture\(\{texture\},pixels/);
  assert.match(renderer,/titleGlyphGlass:roles\.includes\("title"\)/);
  assert.match(renderer,/const PROJECT_HEADER_DISMISS_ROLES=new Set\(\[/);
  assert.match(renderer,/tileDismissProgress\(projectDismissElapsed,0,col\)/);
  assert.match(renderer,/tileDismissDrift\(progress,0,col,/);
  assert.match(renderer,/tileDismissIconOpacity\(progress\)/);
  assert.match(renderer,/tileDismissBlur\(progress\)/);
  assert.match(renderer,/tileDismissScale\(progress\)/);
  assert.match(renderer,/tileData\[p\+19\]=progress;/);
  assert.match(renderer,/headerDissolve:projectDismissElapsed>=0/);
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
  // An optional unsupported-GPU DISMISSAL blur is not a CSS imitation
  // of the native glass material. Backdrop filters remain forbidden.
  assert.doesNotMatch(css,/backdrop-filter\s*:\s*blur\(|-webkit-backdrop-filter\s*:\s*blur\(/);
  assert.match(css,/\.public-projects-root\.is-dissolving-header[\s\S]*?filter:blur\(1\.4px\)/);
  assert.match(css,/body\.public-home\[data-auth-gpu-scene="ready"\]/);
  assert.match(css,/@keyframes project-showcase-enter\{from\{opacity:0;transform:translateY\(24px\)\}to\{opacity:1;transform:translateY\(0\)\}\}/);
  assert.match(css,/\.public-projects-title,\s*\.public-projects-search-button,\s*\.public-projects-filter-button,\s*\.public-projects-github-button\{\s*animation:project-showcase-enter \.5s both;\s*animation-delay:var\(--project-heading-enter-delay,165ms\)/);
  assert.match(css,/animation-delay:calc\(var\(--project-first-card-enter-delay,330ms\) \+ min\(var\(--project-index,0\),15\)\*65ms\)/);
  assert.match(css,/@keyframes project-showcase-exit\{from\{opacity:1;transform:translateY\(0\)\}to\{opacity:0;transform:translateY\(24px\)\}\}/);
  assert.match(css,/\.public-projects-header\{\s*display:flex;flex-direction:column;align-items:flex-start;/);
  assert.match(css,/font-size:clamp\(34\.5px,3vw,46\.5px\)/);
  assert.match(css,/\.public-projects-title\{[\s\S]*?-webkit-user-select:none;user-select:none/);
  assert.match(css,/\.public-projects-root \.public-projects-title\{\s*color:transparent!important;/);
  assert.match(shader,/@group\(0\) @binding\(4\) var titleGlyphAlpha: texture_2d<f32>;/);
  assert.match(shader,/fn titleGlyphField\(local:vec2<f32>\)/);
  assert.match(shader,/let glassTitle=tile\.properties\.y == -8\.0;/);
  assert.match(shader,/glyphCoverage,glassTitle/);
  assert.match(shader,/let dismiss=clamp\(tile\.motion\.w,0\.0,1\.0\);/);
  assert.match(shader,/if\(authPane&&dismiss<=0\.0\)\{/);
  assert.match(shader,/let routeSpatialAlpha=select\(edgeOpacity\*logoOpacity,1\.0,authPane\);/);
  assert.match(shader,/let noiseField=dissolveField\(/);
  assert.match(shader,/let fine=dissolveNoise\(/);
  assert.match(shader,/let inner=refractionEnvelope\(signed,innerAmount,innerInvHeight\);/);
  assert.match(css,/\.public-projects-search-field\{[\s\S]*?transform-origin:right center;/);
  assert.match(css,/\.public-projects-filter-panel\{[\s\S]*?transform-origin:top right/);
  assert.match(css,/\.public-projects-filter-wrap\.is-open \.public-projects-filter-morph-left\{\s*transform:translate\(-2\.75px,4\.25px\) rotate\(-45deg\) scaleX\(\.5556\)/);
  assert.match(css,/\.public-projects-filter-wrap\.is-open \.public-projects-filter-morph-right\{\s*transform:translate\(2\.75px,-\.25px\) rotate\(45deg\) scaleX\(\.7778\)/);
  assert.match(css,/\.public-projects-filter-wrap\.is-open \.public-projects-filter-morph-tail\{\s*transform:translateY\(-4\.75px\) scaleX\(\.2\);opacity:0/);
  assert.doesNotMatch(css,/\.public-projects-icon-up\{|\.public-projects-icon-filter\{/);
  assert.match(css,/\.public-projects-root \.project-showcase-card\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.public-projects-root\.is-exiting \.project-showcase-card\{\s*animation:project-showcase-exit \.42s both;/);
  assert.match(css,/animation-delay:calc\(var\(--project-reverse-index,0\)\*45ms\)/);
  assert.match(css,/\.public-projects-root\.is-exiting :is\(\.public-projects-back,\.public-projects-title,\s*\.public-projects-toolbar,\.public-projects-search-button,\.public-projects-filter-button,\s*\.public-projects-github-button\)\{/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.public-projects-root \.public-projects-title,[\s\S]*?\.public-projects-root \.public-projects-github-button\{animation:none!important\}/);
  assert.match(css,/\.public-projects-root\.is-dissolving-header/);
  assert.match(css,/body\.public-home > #public-route-content:has\(\.public-projects-root\)\{\s*overscroll-behavior-y:none;/);
  assert.match(css,/html:has\(body\.public-home #public-route-content \.public-projects-root\),\s*body\.public-home:has\(#public-route-content \.public-projects-root\)\{\s*overscroll-behavior-y:none;/);
  assert.doesNotMatch(css,/\.public-projects-root\.is-exiting \.public-projects-back,\s*\.public-projects-root\.is-exiting \.public-projects-title/);
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
