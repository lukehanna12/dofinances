import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  PROJECT_SHOWCASE as PRIVATE_PROJECTS,PROJECT_CARD_ICONS as PRIVATE_ICONS,
  PROJECT_CARD_IMAGES as PRIVATE_IMAGES,sortProjectShowcase as sortPrivate,
  projectShowcaseStatus as privateStatus
} from "../sites/_apex/app/assets/project-showcase.js";
import {
  PROJECT_SHOWCASE as PUBLIC_PROJECTS,PROJECT_DESCRIPTIONS,PROJECT_CARD_ICONS as PUBLIC_ICONS,
  PROJECT_CARD_IMAGES as PUBLIC_IMAGES,publicProjectImage,publicProjectIconSource,sortProjectShowcase,
  projectShowcaseStatus as publicStatus
} from "../sites/_apex/assets/public-projects-catalog.js";
import {
  PROJECT_FILTER_CATEGORIES,PROJECT_CATEGORIES_BY_SLUG,projectMatchesFilters
} from "../sites/_apex/assets/public-projects-controls.js";
import {createAuthGlassHoverController} from "../sites/_apex/assets/home-dashboard/dashboard-auth-hover.js";
import {
  normalizeGlassCornerRadii,glassPaneNeedsLiveTransform
} from "../sites/_apex/assets/home-dashboard/dashboard-glass-geometry.js";
import {TILE_FLOATS} from "../sites/_apex/assets/home-dashboard/dashboard-interaction.js";
import {PROJECT_DIAGRAMS,projectDiagramLayout} from "../sites/_apex/assets/public-projects-diagrams.js";
import {BOOTSCRIPT_DIAGRAM_SVG} from "../sites/_apex/assets/public-projects-bootscript-diagram.js";
import {PROJECT_ICON_REVISIONS} from "../sites/_apex/assets/project-icon-revisions.js";
import {createHash} from "node:crypto";
const load=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public Projects is a curated snapshot, not an authenticated API leak",()=>{
  assert.deepEqual(PUBLIC_PROJECTS,PRIVATE_PROJECTS);
  assert.deepEqual(PUBLIC_ICONS,PRIVATE_ICONS);
  assert.deepEqual(PUBLIC_IMAGES,PRIVATE_IMAGES);
  assert.deepEqual(sortProjectShowcase(PUBLIC_PROJECTS),sortPrivate(PRIVATE_PROJECTS));
  assert.equal(PUBLIC_PROJECTS.length,16);
  assert.equal(publicProjectImage({slug:"terminal-scalars"},6),
    "/assets/project-art/terminal-scalars-liquid-symmetry.v3.webp",
    "The attached Manfred Mohr artwork is served locally on the public site");
  assert.equal(publicProjectImage({slug:"app-caviar"},12),"/assets/project-art/app-caviar-source.v2.webp");
  assert.equal(publicProjectImage({slug:"hidden-functions"},14),"/assets/project-art/hidden-functions-piranesi.v1.webp");
  assert.equal(publicProjectImage({slug:"latexcel"},15),"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg");
  const fallback=publicProjectImage({slug:"__unassigned__"},12);
  assert.match(fallback,/^\/wallpapers\/[a-f0-9]{64}\.[a-z]+$/);
  assert.equal(PUBLIC_ICONS["apple-hig-reader"],"apple-higs-reader.v4");
  assert.equal(PRIVATE_ICONS["apple-hig-reader"],"apple-higs-reader.v4");
  for(const project of PUBLIC_PROJECTS)
    assert.equal(publicProjectIconSource(project.slug),
      "/assets/project-icons/"+PUBLIC_ICONS[project.slug]+".svg?v="+PROJECT_ICON_REVISIONS[PUBLIC_ICONS[project.slug]]);
  assert.equal(publicProjectIconSource("__unknown__"),null);
});
test("seven supplied project SVGs are identical across public and authenticated views",async()=>{
  const assigned=[
    ["terminal-scalars","terminal-scalars.v3",13],
    ["colosseum","colosseum-lucide.v2",14],
    ["translucence-lab","lightwork.v3",6],
    ["apple-adobe-fx","apple-adobe-fx.v2",6],
    ["ozoning-board","treehouse-ozoning.v4",6],
    ["unicode-plus","unicode-plus.v2",10],
    ["protocol-monitor-pruner","protocol-monitor-pruner.v2",6]
  ];
  for(const [slug,name,pathCount] of assigned){
    assert.equal(PUBLIC_ICONS[slug],name);
    assert.equal(PRIVATE_ICONS[slug],name);
    assert.equal(publicProjectIconSource(slug),"/assets/project-icons/"+name+".svg?v="+PROJECT_ICON_REVISIONS[name]);
    const [publicSvg,privateSvg]=await Promise.all([
      load("../sites/_apex/assets/project-icons/"+name+".svg"),
      load("../sites/_apex/app/assets/project-icons/"+name+".svg")
    ]);
    assert.equal(publicSvg,privateSvg,"Public and private SVG geometry must match for "+slug);
    assert.match(publicSvg,/viewBox="0 0 24 24"/);
    assert.match(publicSvg,/stroke="currentColor"/);
    assert.match(publicSvg,/stroke-width="2"/);
    assert.equal((publicSvg.match(/<path d=/g)||[]).length,pathCount);
  }
  const terminal=await load("../sites/_apex/assets/project-icons/terminal-scalars.v3.svg");
  assert.ok(terminal.includes('M 19 3 A2 2 0 0 1 21 5'));
  const lightwork=await load("../sites/_apex/assets/project-icons/lightwork.v3.svg");
  assert.ok(lightwork.includes('M8 8h.5l2-3 2.5 6 1.5-3H16'));
  assert.ok(lightwork.includes('M18 8h1.5'));
  assert.ok(lightwork.includes('M4.5 8H6'));
  assert.ok(!lightwork.includes('M17.7 15h.01'));
  assert.ok(!lightwork.includes('m19.1 13.1 1.4.9'));
  assert.ok(!lightwork.includes('M3.08 5.49h1'));
  const adobe=await load("../sites/_apex/assets/project-icons/apple-adobe-fx.v2.svg");
  assert.ok(adobe.includes('M15 16a7 7 0 116.841-8.5'));
  const ozoning=await load("../sites/_apex/assets/project-icons/treehouse-ozoning.v4.svg");
  assert.ok(ozoning.includes('M8 16.5H4.75'));
  assert.ok(ozoning.includes('M8 19.5H5'));
});
test("artwork zoom retains its compositor layer at the final hover frame across both routes",async()=>{
  const csses=await Promise.all([
    load("../sites/_apex/assets/public-projects.css"),
    load("../sites/_apex/app/assets/project-showcase.css")
  ]);
  for(const css of csses){
    const baseline=css.match(/\.project-showcase-photo\{([\s\S]*?)\n\s*\}/)?.[1]||"";
    assert.match(baseline,/will-change:transform,opacity/,
      "Always retain the artwork bitmap compositing layer, including at scale(1)");
    assert.match(baseline,/transform-origin:center center/);
    assert.match(baseline,/-webkit-backface-visibility:hidden;backface-visibility:hidden/);
    assert.match(baseline,/transition:opacity \.5s ease-out,transform \.5s ease-out/,
      "Do not change the approved 500ms zoom speed");
    assert.match(css,/opacity:1;transform:scale\(1\)/,
      "Preserve the exact final size and composition");
  }
});
test("ReadMe GLP artwork is gently enlarged and shifted up on public Projects only",async()=>{
 const publicCSS=await load("../sites/_apex/assets/public-projects.css");
 const path='[data-project-slug="github-readme-chrome-extension"]';
 assert.match(publicCSS,/\[data-project-slug="github-readme-chrome-extension"\] \.project-showcase-photo\{\s*transform:translateY\(-\.6%\) scale\(1\.144\)/);
 assert.match(publicCSS,/\[data-project-slug="github-readme-chrome-extension"\]\.is-photo-ready:is\(:hover,:focus-visible\) \.project-showcase-photo\{\s*transform:translateY\(-\.6%\) scale\(1\.04\)/);
 assert.ok(path.length>0);
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
test("Projects search and seven multiselect filters use exact slug memberships",()=>{
  const expected={
    "Applications": [
      "Colosseum",
      "Lightwork",
      "App Caviar"
    ],
    "Extensions": [
      "BootScript",
      "ReadMe GLP",
      "ChatStore",
      "Protocol Monitor Pruner"
    ],
    "Plugins": [
      "Colosseum"
    ],
    "Add-ons": [
      "Hidden Functions",
      "LaTeXceL"
    ],
    "CLIs": [
      "Colosseum",
      "Unicode Plus",
      "Lightwork"
    ],
    "MCPs": [
      "Apple HIGs Reader",
      "Terminal Scalars",
      "Ozoning Board"
    ],
    "Libraries": [
      "3D Liquid Glass",
      "Apple Adobe FX",
      "Terminal Scalars",
      "Liquid Plexiglass 26"
    ]
  };
  assert.deepEqual(PROJECT_FILTER_CATEGORIES,Object.keys(expected));
  assert.equal(PUBLIC_PROJECTS.length,16);
  assert.deepEqual(Object.keys(PROJECT_CATEGORIES_BY_SLUG).sort(),PUBLIC_PROJECTS.map(p=>p.slug).sort());
  for(const [category,names] of Object.entries(expected)){
    const matches=PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p,"",new Set([category])));
    assert.deepEqual(matches.map(p=>p.name).sort(),[...names].sort(),category);
  }
  assert.equal(PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p)).length,16);
  const cliAndExt=PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p,"",new Set(["CLIs","Extensions"])));
  assert.equal(cliAndExt.length,7);
  const mcpAndLibrary=PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p,"",new Set(["MCPs","Libraries"])));
  assert.equal(mcpAndLibrary.length,6);
  assert.equal(mcpAndLibrary.filter(p=>p.name==="Terminal Scalars").length,1);
  assert.equal(PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p,"ReadMe",new Set(["Extensions"]))).length,1);
  assert.equal(PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p,"ReadMe",new Set(["CLIs"]))).length,0);
  assert.equal(PUBLIC_PROJECTS.filter(p=>projectMatchesFilters(p,"no-project-can-match-this-phrase")).length,0);
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
  assert.match(entry,/trigger\.type="button"/);
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
  assert.match(renderer,/const AUTH_PANE_CAPACITY=32;/);
  assert.match(renderer,/\.public-projects-root/);
  assert.match(renderer,/projects\|\|homeCtas\|\|card\?\.hasAttribute\("data-glass-dropdown"\)\?"independent":"nested"/);
  assert.match(renderer,/\["filter-dropdown","expand-close"\]\.includes\(node\.dataset\.publicProjectGlass\)/);
  assert.match(renderer,/node\.hasAttribute\("data-glass-text"\)\)return -8;/);
  assert.match(renderer,/syncGlassTextMask\(panes\)/);
  assert.match(renderer,/normalizeGlassCornerRadii\(\[/);
  assert.match(renderer,/const live=tile\.hasAttribute\("data-home-cta-glass"\)\|\|\s*glassPaneNeedsLiveTransform\(tile\.dataset\?\.publicProjectGlass\)/);
  assert.match(renderer,/const layoutW=Math\.max\(1,tile\.offsetWidth\),layoutH=Math\.max\(1,tile\.offsetHeight\)/);
  assert.match(renderer,/const w=live\?Math\.max\(1,b\.width\):layoutW;/);
  assert.match(renderer,/const surface=resolveGlassSurface\(/);
  assert.match(renderer,/searchGlass,/);
  assert.match(controls,/FILTER_MORPH_ICON=svg\(/);
  assert.match(controls,/class="public-projects-icon-morph"/);
  assert.doesNotMatch(controls,/FILTER_ICON\+FILTER_UP/);
  assert.match(renderer,/\(reference&&referenceGlyphTexture\?referenceGlyphTexture:glyphMaskTexture\)\.createView\(\)/);
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
  // Route panes still use the auth-scrolling backdrop; Home capsules do not.
  assert.match(shader,/let routePane=authPane && state\.fit\.w>0\.0;/);
  assert.match(shader,/if\(routePane\)\{/);
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
  assert.match(css,/font-size:clamp\(51\.75px,4\.5vw,69\.75px\)/);
  assert.match(css,/\.public-projects-heading-row\{\s*display:flex;align-items:flex-start;justify-content:space-between;/);
  assert.match(css,/\.public-projects-title\{[\s\S]*?-webkit-user-select:none;user-select:none/);
  assert.match(await load("../sites/_apex/assets/public-home.css"),/\[data-glass-text-ready\]\{\s*color:transparent!important;/);
  assert.match(shader,/@group\(0\) @binding\(4\) var titleGlyphAlpha: texture_2d<f32>;/);
  assert.match(shader,/fn titleGlyphField\(local:vec2<f32>\)/);
  assert.match(shader,/let glassTitle=tile\.properties\.y == -8\.0 && clockText;/);
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

test("BootScript framing uses the same top-left cover alignment and 10.25 percent hover zoom in both project views",async()=>{
 const csses=await Promise.all([
  load("../sites/_apex/assets/public-projects.css"),
  load("../sites/_apex/app/assets/project-showcase.css")
 ]);
 for(const css of csses){
  assert.match(css,/\[data-project-slug="bootscript"\] \.project-showcase-photo\{\s*object-position:0% 0%;transform-origin:0% 0%;transform:scale\(1\.21275\)/);
  assert.match(css,/\[data-project-slug="bootscript"\]\.is-photo-ready:is\(:hover,:focus-visible(?:,:focus-within)?\) \.project-showcase-photo\{\s*transform:scale\(1\.1025\)/);
 }
 assert.match(csses[0],/\.is-expanded\[data-project-slug="bootscript"\]\.is-photo-ready \.project-showcase-photo\{\s*transform:scale\(1\.1025\)/);
});

test("search has one persistent native morphing button and a continuously expanding glass field",async()=>{
 const [controls,css]=await Promise.all([load("../sites/_apex/assets/public-projects-controls.js"),load("../sites/_apex/assets/public-projects.css")]);
 assert.match(controls,/searchButton\.innerHTML=SEARCH_MORPH_ICON/);
 assert.match(controls,/searchWrap\.append\(searchField,searchButton\)/);
 assert.doesNotMatch(controls,/const cancel=namedButton/);
 assert.match(controls,/searchWrap\.classList\.add\("is-expanded"\);\s*input\.focus/);
 assert.match(css,/\.public-projects-search-field\{[\s\S]*?right:100%;top:0;\s*width:0;height:40px/);
 assert.match(css,/\.public-projects-search-wrap\.is-expanded \.public-projects-search-button\{\s*border-radius:20px/);
 assert.match(css,/\.public-projects-search-morph>path\{\s*transition:d 320ms/);
 assert.match(css,/\.public-projects-search-wrap\.is-expanded \.public-projects-search-morph-ring\{\s*d:path\(/);
 assert.doesNotMatch(css,/\.is-ready \.public-projects-search-(?:button|cancel)/);
 assert.match(css,/\.public-projects-empty\{[^}]*color:#ad414e/);
});

test("project switching retargets the live rectangles on one expansion clock",async()=>{
 const [exp,css,renderer]=await Promise.all([load("../sites/_apex/assets/public-projects-expand.js"),load("../sites/_apex/assets/public-projects.css"),load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js")]);
 assert.match(exp,/export const EXPAND_MS=620/);
 assert.match(exp,/function retarget\(card,/);
 assert.match(exp,/const presented=new Map\(visible\.map/);
 assert.match(exp,/else if\(state\.card!==card\|\|state\.phase==="closing"\)retarget\(card,/);
 assert.match(exp,/close\(\{restoreFocus:keyboard\}\)/);
 assert.doesNotMatch(css,/\.has-project-expansion \.project-showcase-card:not\(\.is-expanded\)/);
 assert.doesNotMatch(css,/:focus-within/);
 assert.match(renderer,/projects\?panes:null/);
 assert.match(renderer,/node\.matches\("\.project-showcase-dissolve-ghost,\.is-contracting"\)/);
});

test("project title-band, action, badge clearance and switch geometry share expansion progress",async()=>{
 const [css,exp]=await Promise.all([load("../sites/_apex/assets/public-projects.css"),load("../sites/_apex/assets/public-projects-expand.js")]);
 assert.match(css,/padding-right:calc\(53px\*var\(--project-regular-progress\)\)/);
 assert.match(css,/grid-column:1;grid-row:2;align-self:end;justify-self:start/);
 assert.match(exp,/motion\.startTime=sharedStart/);
 assert.match(exp,/rect\.left\+=originDX;rect\.top\+=originDY/);
});

test("every public project has a single substantive, source-conscious paragraph",()=>{
  assert.deepEqual(Object.keys(PROJECT_DESCRIPTIONS).sort(),PUBLIC_PROJECTS.map(p=>p.slug).sort());
  for(const [slug,copy] of Object.entries(PROJECT_DESCRIPTIONS)){
    assert.ok(copy.length>=250&&copy.length<750,slug);
    assert.doesNotMatch(copy,/\n/);
    assert.doesNotMatch(copy,new RegExp("[\u00b7\u2014]"));
  }
  assert.match(PROJECT_DESCRIPTIONS["chatgpt-chat-save-chrome-extension"],/26 alternatives/);
  assert.match(PROJECT_DESCRIPTIONS["3d-liquid-glass-26-swift-package"],/shed light/);
  assert.match(PROJECT_DESCRIPTIONS.latexcel,/^LaTeXceL is an Excel add-in and Google Sheets add-on project/);
  assert.match(PROJECT_DESCRIPTIONS.bootscript,/built to be the most capable Google Apps Script Chrome extension.*97-criterion documented-feature comparison against 21 competing extensions.*66 capabilities/);
  assert.match(PROJECT_DESCRIPTIONS.bootscript,/2\.44 times the highest competing count and 8\.25 times the competitor median/);
  assert.match(PROJECT_DESCRIPTIONS.bootscript,/57 editor theme choices.*Gemini assistance.*collaborative draft editing/);
  assert.match(PROJECT_DESCRIPTIONS.bootscript,/development build.*not yet published/);
  assert.match(PROJECT_DESCRIPTIONS["translucence-lab"],/gold standard of modern knowledge about light/);
  assert.match(PROJECT_DESCRIPTIONS["translucence-lab"],/^Lightwork is a native macOS application and independent command-line interface/);
  assert.match(PROJECT_DESCRIPTIONS["translucence-lab"],/share a Metal rendering engine/);
  assert.match(PROJECT_DESCRIPTIONS["github-readme-chrome-extension"],/lightweight live documentation editor/);
  assert.match(PROJECT_DESCRIPTIONS["chatgpt-chat-save-chrome-extension"],/near-instant.*seven days/);
  assert.match(PROJECT_DESCRIPTIONS["chatgpt-chat-save-chrome-extension"],/detailed preservation of individual conversations/);
  assert.match(PROJECT_DESCRIPTIONS.colosseum,/virtually any tool or reference/);
  assert.match(PROJECT_DESCRIPTIONS.colosseum,/Claude plugins/);
  assert.match(PROJECT_DESCRIPTIONS["apple-hig-reader"],/freely hosted reference architecture on Google Apps Script/);
  assert.match(PROJECT_DESCRIPTIONS["unicode-plus"],/terminal counterpart to LaTeXceL/);
  assert.match(PROJECT_DESCRIPTIONS["liquid-plexiglass-26"],/is the most faithful reconstruction of macOS 26 Tahoe Liquid Glass on the internet/);
  assert.match(PROJECT_DESCRIPTIONS["liquid-plexiglass-26"],/includes the entire public interface for macOS 26 Tahoe Liquid Glass/);
  assert.match(PROJECT_DESCRIPTIONS["liquid-plexiglass-26"],/is 100% resolution independent/);
  assert.doesNotMatch(PROJECT_DESCRIPTIONS["liquid-plexiglass-26"],/\b(?:aims|ambition|planned|intends)\b/i);
  assert.equal(PROJECT_DIAGRAMS["liquid-plexiglass-26"][0].planned,false);
  assert.match(PROJECT_DESCRIPTIONS["liquid-plexiglass-26"],/Rust and WebGPU/);
  assert.match(PROJECT_DESCRIPTIONS["3d-liquid-glass-26-swift-package"],/Liquid Plexiglass 27/);
  assert.match(PROJECT_DESCRIPTIONS["apple-adobe-fx"],/most faithful reconstruction/);
  assert.match(PROJECT_DESCRIPTIONS["apple-adobe-fx"],/recently open-sourced Adobe Photoshop reconstruction/);
  assert.match(PROJECT_DESCRIPTIONS["protocol-monitor-pruner"],/Few specialized tools exist/);
  assert.match(PROJECT_DESCRIPTIONS["app-caviar"],/homegrown AI assistant/);
  assert.match(PROJECT_DESCRIPTIONS["ozoning-board"],/most versatile in-memory Vite and React application builder/);
  assert.match(PROJECT_DESCRIPTIONS["hidden-functions"],/extensive collection of hidden Google Sheets functions/);
  // Direct project copy should not rely on owner or creator attribution.
  for(const copy of Object.values(PROJECT_DESCRIPTIONS)){
    assert.doesNotMatch(copy,/\b(?:creator|owner)\b/i);
  }
  assert.match(PROJECT_DESCRIPTIONS["chatgpt-chat-save-chrome-extension"],/reported near-instant/);
  assert.match(PROJECT_DESCRIPTIONS["ozoning-board"],/Google Apps Script's generous usage allowances/);
  assert.match(PROJECT_DESCRIPTIONS["ozoning-board"],/restrictive free-tier limits/);
  assert.match(PROJECT_DESCRIPTIONS["apple-adobe-fx"],/reported exceptionally high fidelity/);
  assert.match(PROJECT_DESCRIPTIONS["apple-hig-reader"],/keep request volume low/);
  assert.match(PROJECT_DESCRIPTIONS["latexcel"],/In Excel/);


});

test("all 16 projects have readable, explicitly connected native architecture schematics",()=>{
  assert.deepEqual(Object.keys(PROJECT_DIAGRAMS).sort(),PUBLIC_PROJECTS.map(p=>p.slug).sort());
  for(const [slug,specs] of Object.entries(PROJECT_DIAGRAMS)){
    assert.ok(specs.length>=1&&specs.length<=4,slug);
    for(const spec of specs){
      if(spec.renderer==="archify"){
        assert.equal(slug,"bootscript");
        assert.ok(spec.title&&spec.label&&!spec.planned);
        assert.match(BOOTSCRIPT_DIAGRAM_SVG,/viewBox="0 0 834 840"/);
        assert.match(BOOTSCRIPT_DIAGRAM_SVG,/data-preset="classic"/);
        assert.doesNotMatch(BOOTSCRIPT_DIAGRAM_SVG,/<(?:script|foreignObject)\b/i);
        for(const color of ["rgb(251, 146, 60)","rgb(250, 204, 21)","rgb(248, 113, 113)","rgb(163, 163, 163)"])assert.ok(BOOTSCRIPT_DIAGRAM_SVG.includes(color),color);
        assert.match(BOOTSCRIPT_DIAGRAM_SVG,/(?:rgba\([^"]+,\s*0\.[0-9]+\)|color\(srgb [^"]+ \/ 0\.[0-9]+\))/);
        for(const label of ["Apps Script IDE","Editor integration","Project console","TypeScript worker","Encrypted vault","Peer drafts","Authorized API clients","External services","Gemini"])assert.ok(BOOTSCRIPT_DIAGRAM_SVG.includes(label),label);
        continue;
      }
      const layout=projectDiagramLayout(spec,specs.length>1);
      assert.ok(spec.title&&spec.rows.length>=2&&spec.edges.length>0,slug);
      for(const row of layout.rows)for(const n of row){
        assert.ok(n.x>=0&&n.x+n.w<=layout.width&&n.y+n.h<=layout.height,slug);
        assert.ok(n.label.split("\n").every(line=>line.length<=40),n.label);
      }
      for(const [ar,ac,br,bc] of spec.edges){
        assert.ok(layout.rows[ar]?.[ac]&&layout.rows[br]?.[bc],slug);
        assert.ok(br===ar+1||(ar===br&&bc===ac+1),slug);
      }
    }
  }
  assert.match(PROJECT_DESCRIPTIONS["terminal-scalars"],/^Terminal Scalars is a library.*command-line interfaces.*terminal user interfaces/);
  assert.ok(PROJECT_DESCRIPTIONS["terminal-scalars"].endsWith("Scripts are also included for the purpose of deploying your own customizable Google-hosted MCP server using Google Apps Script; all you need is a Google Drive account."));
  assert.doesNotMatch(PROJECT_DESCRIPTIONS["terminal-scalars"],/\b(?:framework|planned)\b/i);
  assert.equal(PROJECT_DIAGRAMS["terminal-scalars"][0].title,"Native terminal library");
  assert.match(PROJECT_DESCRIPTIONS["github-readme-chrome-extension"],/ReadMe GitHub Live/);
  assert.match(PROJECT_DESCRIPTIONS["ozoning-board"],/Model Context Protocol \(MCP\).*Agent2Agent \(A2A\)/);
  assert.match(PROJECT_DESCRIPTIONS["apple-hig-reader"],/authenticated Model Context Protocol.*\/mcp endpoint/);
  assert.doesNotMatch(PROJECT_DESCRIPTIONS["apple-hig-reader"],/final form|planned/);
  assert.equal(PROJECT_DIAGRAMS["apple-hig-reader"][0].planned,false);
  assert.ok(PROJECT_DIAGRAMS["apple-hig-reader"][0].rows.flat().includes("/mcp Worker"));
});

test("every project has a unique readable hash URL and legacy alias",async()=>{
 const {PROJECT_SHOWCASE,publicProjectHref,projectFromPublicHash}=await import("../sites/_apex/assets/public-projects-catalog.js");
 const urls=PROJECT_SHOWCASE.map(publicProjectHref);
 assert.equal(new Set(urls).size,16);
 assert.ok(urls.includes("/projects#bootscript")&&urls.includes("/projects#lightwork")&&urls.includes("/projects#readme-glp"));
 for(const p of PROJECT_SHOWCASE){
  assert.equal(projectFromPublicHash(publicProjectHref(p).split("#")[1]),p);
  assert.equal(projectFromPublicHash("#"+p.slug),p);
 }
 assert.equal(projectFromPublicHash("#unknown"),null);
 assert.equal(projectFromPublicHash("#%"),null);
});

test("Terminal Scalars uses a centered 3% crop without altering the reveal ratio",async()=>{
 const publicCSS=await load("../sites/_apex/assets/public-projects.css");
 const privateCSS=await load("../sites/_apex/app/assets/project-showcase.css");
 for(const css of [publicCSS,privateCSS]){
  assert.match(css,/\[data-project-slug="terminal-scalars"\] \.project-showcase-photo\{\s*object-position:center;transform-origin:center center;transform:scale\(1\.133\)/);
  assert.match(css,/\[data-project-slug="terminal-scalars"\]\.is-photo-ready:is\(:hover,:focus-visible(?:,:focus-within)?\) \.project-showcase-photo\{\s*transform:scale\(1\.03\)/);
 }
 assert.match(publicCSS,/\.is-expanded\[data-project-slug="terminal-scalars"\]\.is-photo-ready \.project-showcase-photo\{\s*transform:scale\(1\.03\)/);
 assert.match(publicCSS,/\[data-project-slug="terminal-scalars"\]\.is-photo-ready:has\(>\.project-showcase-trigger:focus-visible\) \.project-showcase-photo\{transform:scale\(1\.03\)/);
 assert.ok(Math.abs(1.133/1.03-1.1)<1e-12);
});

test("dedicated hero places its original silhouette above the title and overlays the shared back chip",async()=>{
 const [entry,css,renderer]=await Promise.all([
  load("../sites/_apex/assets/public-projects-entry.js"),
  load("../sites/_apex/assets/public-projects.css"),
  load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js")]);
 const detail=entry.slice(entry.indexOf("function mountProjectDetail("),entry.indexOf("export function mountProjects("));
 assert.match(detail,/title\.before\(hero\.querySelector\("\.project-showcase-number"\)\)/);
 assert.match(detail,/back\.dataset\.glassBackdropLayer="1"/);
 assert.doesNotMatch(detail,/projectsLogoPinned|logoParent|syncLogo/);
 assert.match(css,/\.public-project-detail \.public-projects-header\{\s*position:absolute;top:var\(--project-detail-inset\);left:var\(--project-detail-inset\)/);
 assert.match(css,/:has\(\.public-project-detail\) #dashboard-title\{\s*visibility:hidden!important;opacity:0!important/);
 assert.match(renderer,/\|\|node\.hasAttribute\("data-project-detail-back"\)/);
});

test("all sixteen public icon URLs are revisioned by actual SVG bytes and agree with GPU vector inputs",async()=>{
 const packed=JSON.parse(await load("../sites/_apex/assets/home-dashboard/continuous-icon-vectors.json"));
 assert.deepEqual(Object.keys(PROJECT_ICON_REVISIONS).sort(),Object.values(PUBLIC_ICONS).sort());
 for(const project of PUBLIC_PROJECTS){
  const name=PUBLIC_ICONS[project.slug];
  const svg=await readFile(new URL("../sites/_apex/assets/project-icons/"+name+".svg",import.meta.url));
  const hash=createHash("sha256").update(svg).digest("hex");
  assert.equal(PROJECT_ICON_REVISIONS[name],hash);
  assert.equal(packed.assets[name].sourceSha256,hash);
  assert.equal(publicProjectIconSource(project.slug),"/assets/project-icons/"+name+".svg?v="+hash);
 }
});
