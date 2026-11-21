import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initColosseumUtilities,utilityFiltersFromFields,utilitySearchIndex,utilityCanManage} from "../sites/_apex/app/assets/utilities.js";
import {validateUtilityAnnotation} from "../sites/_apex/app/assets/utility-editorial-ui.js";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=source("sites/_apex/app/index.html");
const css=source("sites/_apex/app/assets/utilities.css");
const js=source("sites/_apex/app/assets/utilities.js");
const edge=source("edge/router.mjs");
const dashboard=source("sites/_apex/app/assets/dashboard.js");
const view=html.slice(html.indexOf('data-view="colosseum/utilities"'),html.indexOf('data-view="colosseum/collections"'));

test("Utilities page exposes the Collections-style list, inspector and frosted dock",()=>{
 for(const part of ['id="ut-root"','id="ut-summary"','id="ut-layout"','id="ut-list"',
  'id="ut-inspector"','id="ut-pages"','id="ut-add"','id="ut-edit"','id="ut-select"',
  'id="ut-editor"','id="ut-delete-dialog"'])
   assert.ok(view.includes(part),"Missing Utilities element: "+part);
 assert.ok(html.includes('<link rel="stylesheet" href="/app/assets/utilities.css?profile=v2">'));
 assert.ok(dashboard.includes('import {initColosseumUtilities} from "./utilities.js?profile=v2"'));
 assert.ok(dashboard.includes("initColosseumUtilities();"));
 assert.equal(typeof initColosseumUtilities,"function");
 assert.match(css,/#ut-root \.ut-control-center\{[^}]*position:fixed;/);
 assert.ok(css.includes("border:1px solid rgba(245,248,252,.065)"));
 assert.ok(css.includes("backdrop-filter:blur(18px) saturate(120%)"));
});
test("Live catalog search and include/exclude filter toggle share one search bar",()=>{
 const search=view.slice(view.indexOf('<div class="ut-search"'),view.indexOf('</div>\n                  <select class="ut-order"'));
 assert.ok(search.includes('id="ut-search-submit"'));
 assert.ok(search.includes('id="ut-search"'));
 assert.ok(search.includes('class="ut-filter-control"'));
 assert.ok(search.includes('id="ut-filter-toggle"'));
 assert.ok(search.indexOf('id="ut-search-submit"')<search.indexOf('id="ut-search"'));
 assert.ok(search.indexOf('id="ut-search"')<search.indexOf('id="ut-filter-toggle"'));
 assert.ok(view.includes('id="ut-filters" hidden'));
 assert.ok(view.includes('id="ut-filter-fields"'));
 assert.ok(js.includes('const API="/api/colosseum/utilities"'));
 assert.ok(js.includes('action:"list"'));
 assert.ok(js.includes('query,sort:elements.sort.value,page_size:s.pageSize'));
 assert.ok(js.includes('include:s.include,exclude:s.exclude'));
});
test("Six sort orders, separate filter modes and numbered indexed-offset pagination are present",()=>{
 for(const name of ["name_asc","name_desc","uid_asc","uid_desc","time_new","time_old"])
  assert.ok(view.includes('value="'+name+'"'),"Missing "+name);
 assert.ok(js.includes('["include","exclude"]'));
 assert.ok(js.includes('index>0?{offset:index*s.pageSize}'));
 assert.match(js,/class="ut-page"/);
 assert.match(js,/aria-current="page"/);
 assert.match(js,/s\.total\/s\.pageSize/);
 assert.deepEqual(utilityFiltersFromFields([
  {field:"routes",mode:"include",value:"cloud,direct,cloud"},
  {field:"languages",mode:"exclude",value:"JavaScript, Swift"},
  {field:"authors",mode:"exclude",value:""}
 ]),{include:{routes:["cloud","direct"]},exclude:{languages:["JavaScript","Swift"]}});
 assert.match(utilitySearchIndex({name:"Utility",uid:"000a11",languages_json:'["Swift"]',subjects_json:'["Rendering"]'}),/swift.*rendering/);
});
test("Catalog requests are lazy until the Utilities route is visible",()=>{
 assert.ok(js.includes("const visible=!root.closest(\".view\")?.hidden"));
 assert.ok(js.includes("if(visible&&!routeVisible){routeVisible=true;void loadPage(0,null);}"));
 assert.ok(js.includes('window.addEventListener("hashchange",onRouteVisibility)'));
 assert.ok(js.includes('window.addEventListener("popstate",onRouteVisibility)'));
});
test("Lazy, accessible one-at-a-time list expansion and detail reads",()=>{
 assert.ok(js.includes("s.activeUid=s.activeUid===uid?null:uid"));
 assert.ok(js.includes('el.classList.toggle("ut-active",open)'));
 assert.ok(js.includes('aria-expanded'));
 assert.ok(js.includes('api({action:"get",uid,files_limit:30,files_offset:0})'));
 assert.ok(js.includes('const seq=++s.detailSeq'));
 assert.ok(js.includes('if(seq!==s.detailSeq||s.activeUid!==uid)return'));
 assert.ok(css.includes("grid-template-rows:0fr"));
 assert.ok(css.includes('data-view="colosseum/utilities":not([hidden])')||css.includes('data-view="colosseum/utilities"]:not([hidden])'));
 assert.ok(css.includes(".ut-row.ut-active .ut-row-panel{grid-template-rows:1fr"));
 assert.ok(css.includes(".ut-layout.ut-open{grid-template-columns:minmax(0,1fr)"));
 assert.ok(css.includes("@media(max-width:1023px)"));
});
test("Utility editor is revision-reviewed and mutations remain Git-first",()=>{
 assert.ok(utilityCanManage({uid:"a012bc",route:"cloud"}));
 assert.ok(utilityCanManage({uid:"a012bc",route:"direct"}));
 assert.equal(utilityCanManage({uid:"a012bc",route:"ported"}),false);
 assert.equal(utilityCanManage({uid:"a012bc",route:"cloud",enabled:0}),false);
 assert.equal(utilityCanManage({uid:"a012bc",route:"local"}),false);
 assert.equal(utilityCanManage({uid:"a012bc",route:"cloudish"}),false);
 for(const kind of ["add","update","remove"])
  assert.ok(js.includes('CATALOG_API+kind'));
 for(const term of ['phase:"plan"','phase:"publish"','expected_revision','expected_updated_at','manifest_digest','add_files','remove_files','asset_payloads'])
  assert.ok(js.includes(term),"Missing "+term);
 assert.ok(js.includes('if(result?.phase!=="complete")'));
 assert.match(js,/library_key:"iii"/);
 assert.ok(js.includes("bytes.length;i+=8192"));
});
test("Static asset counts and file lists are read on demand, not assembled from fake data",()=>{
 assert.ok(js.includes('asset_count'));
 assert.ok(js.includes('["Enabled",item.enabled===0?"No":"Yes"]'));
 assert.ok(js.includes("files_has_more"));
 assert.ok(js.includes("s.detailCache.clear();s.page=index"));
 assert.ok(js.includes('files_offset:offset'));
 assert.ok(js.includes("s.detail?.item?.uid===item.uid"));
 assert.ok(!js.includes("Array.from({length:13}"));
});
test("Update inspection is manual, bounded, and cannot change the catalog",()=>{
 assert.ok(js.includes('elements.refresh.addEventListener("click",()=>void refreshCatalog())'));
 assert.ok(js.includes('if(await loadPage(0,null))await checkUpdates(selectedBeforeRefresh)'));
 assert.ok(!js.includes('elements.updates.addEventListener'));
 assert.ok(js.includes('const body={action:"updates"}'));
 assert.ok(js.includes('["safe_update","manual_update"].includes(chosen.source_mode)'));
 assert.ok(!/loadPage\(0,null\)[\s\S]*checkUpdates\(\)/.test(js.slice(js.lastIndexOf("renderFilterControls();"))));
 assert.ok(!/setInterval|setTimeout|requestAnimationFrame|MutationObserver|IntersectionObserver/.test(js));
 assert.ok(!/setInterval|setTimeout|requestAnimationFrame|MutationObserver|IntersectionObserver/.test(css));
});
test("Read-only Utilities endpoint retains the existing sole-owner security stack",()=>{
 assert.ok(edge.includes('const utilities=pathname==="/api/colosseum/utilities"'));
 assert.ok(edge.includes('return colosseumCatalogForward(request,env,"utilities.catalog")'));
 assert.ok(edge.includes('!state.owner)return json({error:"Only the connected Colosseum administrator may access utilities."}'));
 assert.ok(edge.includes('const identity')||edge.includes('identity=await verifyColosseumOwnerJwt'));
 assert.ok(edge.includes('request.headers.get("Origin")!=="https://dofinances.com"'));
 assert.ok(!view.includes('Nothing here yet'));
 assert.ok(!/ title="/.test(view),"No browser-native hover tooltips");
});

test("Utilities exactly matches the Collections title handoff and black canvas",async()=>{
 const {utilitiesTitleFrame,initUtilitiesTitleTransition}=await import("../sites/_apex/app/assets/utilities-title-transition.js");
 const {collectionsTitleFrame}=await import("../sites/_apex/app/assets/collections-title-transition.js");
 assert.equal(typeof initUtilitiesTitleTransition,"function");
 for(const scroll of [0,20,56,71,72,73,160])
  assert.deepEqual(utilitiesTitleFrame(scroll,{top:140-scroll,height:52},{bottom:94}),
    collectionsTitleFrame(scroll,{top:140-scroll,height:52},{bottom:94}));
 const nav=source("sites/_apex/app/assets/workspace-nav.js");
 assert.match(nav,/workspaceTitleTransition\.setRoute\(route\)/);
 assert.match(css,/--ui-canvas:#0a0a0a/);
 assert.match(css,/body\.utilities-title-transition\.utilities-title-passed #project-utilities-title/);
 assert.match(css,/body\.utilities-title-transition #workspace-shell \.shadcn-breadcrumb-item/);
 assert.match(css,/body\.utilities-title-transition #workspace-shell \.topbar > \.utilities-inline-title/);
 const entry=source(".github/workflows/site.yml");
 assert.ok(entry.includes("cp sites/_apex/app/assets/utilities-title-transition.js dist/app/assets/utilities-title-transition.js"));
});
test("Collection filter choices are loaded only when opened and never polled",()=>{
 assert.ok(js.includes('["collections","Collection",[]]'));
 assert.ok(js.includes('async function loadCollectionChoices()'));
 assert.ok(js.includes('method:cursor?"POST":"GET"'));
 assert.ok(js.includes('if(open)void loadCollectionChoices();'));
 assert.ok(js.includes('collection_names'));
 assert.ok(js.includes('pageSize:25'));
 assert.ok(css.includes('appearance:none;-webkit-appearance:none'));
 assert.ok(css.includes('background-position:right 10px center'));
 assert.ok(css.includes('.ut-title-measure'));
 assert.ok(css.includes('height:calc(var(--ut-row-height) - var(--ut-row-divider))'));
 assert.ok(css.includes('max-height:480px'));
});

test("Utilities summary shows exact total and app-configured local refresh time",()=>{
 const view=html.slice(html.indexOf('data-view="colosseum/utilities"'),html.indexOf('data-view="colosseum/collections"'));
 assert.match(view,/class="ut-summary ut-summary-loading"/);
 assert.match(view,/class="ut-summary-value">TOTAL — \/ UPDATED —/);
 assert.match(view,/class="ut-summary-skeleton"/);
 assert.equal((view.match(/class="ut-summary-dot"/g)||[]).length,2);
 assert.match(js,/Number\.isSafeInteger\(result\.total_items\)/);
 assert.match(js,/formatWorkspaceTime\(s\.updatedAt,\{hour12:true\}\)/);
 assert.doesNotMatch(js,/report\("Loading live catalog utilities/);
 assert.match(js,/Array\.from\(\{length:s\.pageSize\}/);
 assert.match(css,/#ut-root \.ut-skeleton-bar\{width:var\(--site-skeleton-text-width,68%\)/);
 assert.match(css,/#ut-root \.ut-summary-dot\{[\s\S]*?animation:ut-summary-spin 600ms linear infinite/);
 assert.ok(js.includes('class="ut-skeleton-bar site-skeleton" data-slot="skeleton"'));
 const skeleton=source("sites/_apex/app/assets/site-skeleton.css");
 assert.match(skeleton,/animation:site-skeleton-pulse 2s cubic-bezier\(\.4,0,\.6,1\) infinite/);
 assert.match(skeleton,/@keyframes site-skeleton-pulse\{50%\{opacity:\.5\}\}/);
 assert.ok(skeleton.includes("visibility:hidden"));
 assert.ok(skeleton.includes("transition:none"));
 assert.doesNotMatch(skeleton,/cs-summary-placeholder|ut-summary-placeholder/);
 assert.doesNotMatch(skeleton,/background-clip:text|text-shimmer/);
});
test("Utilities restores twenty-five compact row headers and keeps authors in badges",()=>{
 assert.match(js,/pageSize:25/);
 assert.match(css,/#ut-root \.ut-row-main,#ut-root \.ut-row\.ut-active \.ut-row-main\{/);
 assert.match(css,/height:calc\(var\(--ut-row-height\) - var\(--ut-row-divider\)\)/);
 assert.match(css,/#ut-root\{--ut-row-height:54px\}/);
 assert.match(css,/#ut-root\{--ut-row-height:48px\}/);
 assert.doesNotMatch(js,/'<span class="ut-row-side">'\+esc/);
 assert.match(js,/ut-author-badge/);
 assert.doesNotMatch(js,/\["Author",item\.author\]/);
});
test("Utilities dock uses full circular Add and invariant Select glyph dimensions",()=>{
 assert.match(view,/id="ut-add"[^>]*><img src="\/app\/assets\/add-collection\.v3\.svg"/);
 assert.match(css,/#ut-root \.ut-control-center #ut-add img\{/);
 assert.match(css,/#ut-root \.ut-control-center \.ut-dock-button img\{/);
 assert.match(css,/width:calc\(19px \* var\(--ut-dock-scale\)\)/);
 assert.match(css,/--ut-dock-scale:1\.5/);
 assert.ok(view.includes('id="ut-refresh"'));
 assert.ok(view.includes('Refresh utilities and check for updates'));
 assert.doesNotMatch(view,/id="ut-update-check"|id="ut-update-tooltip"|Meta\+Shift\+U/);
 assert.doesNotMatch(css,/ut-refresh-stack|ut-update-check/);
 assert.ok(js.includes('if(await loadPage(0,null))await checkUpdates(selectedBeforeRefresh)'));
 assert.doesNotMatch(js,/elements\.updates|KeyU/);
});
test("Shared non-dashboard canvas and scroll-title template has one owner",async()=>{
 const commonCss=source("sites/_apex/app/assets/workspace-title.css");
 const commonJs=source("sites/_apex/app/assets/workspace-title-transition.js");
 const nav=source("sites/_apex/app/assets/workspace-nav.js");
 const {initWorkspaceTitleTransition}=await import("../sites/_apex/app/assets/workspace-title-transition.js");
 assert.equal(typeof initWorkspaceTitleTransition,"function");
 assert.match(commonCss,/\.view\[data-view\]:not\(\[data-view="dashboard"\]\):not\(\[hidden\]\)/);
 assert.match(commonCss,/body\.workspace-title-transition\.workspace-title-passed \.workspace-scroll-heading\{\s*opacity:0/);
 assert.match(commonJs,/heading\.getBoundingClientRect\(\),header\.getBoundingClientRect\(\)/);
 assert.match(nav,/workspaceTitleTransition\.setRoute\(route\)/);
 assert.doesNotMatch(nav,/collectionsTitleTransition\.setRoute|utilitiesTitleTransition\.setRoute/);
 assert.doesNotMatch(commonJs,/setTimeout|setInterval|requestAnimationFrame|MutationObserver|ResizeObserver/);
 assert.match(source(".github/workflows/site.yml"),/cp sites\/_apex\/app\/assets\/workspace-title\.css dist\/app\/assets\/workspace-title\.css/);
 assert.match(html,/href="\/app\/assets\/workspace-title\.css"/);
});

test("Collapsed Utilities accordions have zero intrinsic panel padding on desktop and mobile",()=>{
 // A grid child with padding:28px (24px mobile) forced the 0fr track
 // to retain that minimum height. Keep decorative spacing on descendants.
 assert.match(css,/#ut-root \.ut-row-panel-inner\{overflow:hidden;min-height:0;padding:0\}/);
 assert.match(css,/@media\(max-width:1023px\)\{[\s\S]*?#ut-root \.ut-row-panel-inner\{padding:0\}/);
 assert.match(css,/#ut-root \.ut-row-description\{\s*margin:0;max-width:448px;padding:0 32px 28px 44px;/);
 assert.match(css,/#ut-root \.ut-mobile-detail\{margin-top:0;padding:0\}/);
 assert.match(css,/#ut-root \.ut-row\.ut-active \.ut-mobile-detail\{margin-top:24px\}/);
 assert.match(css,/#ut-root \.ut-row-panel\{\s*display:grid;grid-template-rows:0fr;/);
 assert.match(css,/#ut-root \.ut-row-main,#ut-root \.ut-row\.ut-active \.ut-row-main\{\s*height:calc\(var\(--ut-row-height\) - var\(--ut-row-divider\)\);/);
 assert.match(css,/#ut-root\{--ut-row-height:54px\}/);
 assert.match(css,/#ut-root\{--ut-row-height:48px\}/);
});

test("Collections-style search focuses without requesting a catalog page",()=>{
 assert.match(view,/class="ut-search-control"/);
 assert.match(view,/class="ut-search-focus"/);
 assert.match(view,/id="ut-search-submit"[^>]*aria-keyshortcuts="Meta\+Shift\+F"/);
 assert.match(js,/elements\.submit\.addEventListener\("click",\(\)=>\{if\(!elements\.query\.disabled\)elements\.query\.focus/);
 assert.match(css,/#ut-root \.ut-search-control\{/);
 assert.match(css,/#ut-root \.ut-search-focus:hover/);
});
test("Default footer and numbered pagination match Collections",()=>{
 assert.match(js,/first\+"–"\+Math\.min\(first\+s\.items\.length-1,s\.total\)\+" of "\+s\.total/);
 assert.match(js,/const numbers=new Set\(\[1,pages\]\)/);
 assert.match(js,/class="ut-page-gap"/);
 assert.match(js,/data-ut-page="prev"/);
 assert.match(js,/data-ut-page="next"/);
 assert.match(js,/PAGE_LEFT/);
 assert.match(js,/PAGE_RIGHT/);
 assert.match(css,/#ut-root \.ut-pages \.ut-page\{/);
 assert.match(css,/\.ut-page\[aria-current="page"\]/);
 assert.doesNotMatch(js,/more available"\)\+" · live Colosseum/);
});
test("Edit Utilities dock enters inline rename mode while detailed metadata editor remains",()=>{
 assert.match(js,/elements\.edit\.addEventListener\("click",toggleEditMode\)/);
 assert.match(js,/function startInlineRename\(uid\)/);
 assert.match(js,/function finishInlineRename\(restore=false\)/);
 assert.match(js,/function enterEditMode\(\)/);
 assert.match(js,/function exitEditMode\(\)/);
 assert.match(js,/record:\{name:change\.name\}/);
 assert.match(js,/expected_revision:change\.base\.revision/);
 assert.match(js,/phase:"publish"/);
 assert.match(js,/data-ut-start-rename/);
 assert.match(js,/data-ut-confirm-rename/);
 assert.match(js,/data-ut-cancel-rename/);
 assert.match(js,/data-ut-edit/);
 assert.match(css,/\.ut-name-underline\{/);
 assert.match(css,/\.ut-underline-extended \.ut-name-underline\{/);
});
test("Select Utilities is a transient unchecked picker with native CSS swap",()=>{
 assert.match(js,/elements\.select\.addEventListener\("click",toggleSelectMode\)/);
 assert.match(js,/selected=s\.selection\.has\(item\.uid\)/);
 assert.match(js,/class="ut-row-pick"/);
 assert.match(js,/aria-pressed="'\+String\(selected\)/);
 assert.match(js,/function toggleRowPick\(uid\)/);
 assert.match(js,/if\(s\.selection\.has\(uid\)\)s\.selection\.delete\(uid\);else s\.selection\.add\(uid\)/);
 assert.doesNotMatch(js,/'<span class="ut-pick" role="img" aria-label="Select utility" aria-pressed="false">✓<\/span>'/);
 assert.match(css,/#ut-root \.ut-select-bubble svg\{[^}]*opacity:0/);
 assert.match(css,/#ut-root \.ut-row-pick\[aria-pressed="true"\] \.ut-select-bubble svg\{opacity:1\}/);
 assert.match(css,/@keyframes ut-pick-enter-right/);
 assert.match(css,/@keyframes ut-pick-exit-left/);
 assert.match(js,/waitForMotion\(elements\.list\.querySelector\("\.ut-row-pick"\),"ut-pick-enter-right"\)/);
});
test("Tooltips and shortcuts are scoped to Utilities and avoid input interception",()=>{
 for(const [id,key] of [["ut-search-submit","F"],["ut-add","N"],["ut-edit","E"]]){
  const at=view.indexOf('id="'+id+'"');
  assert.ok(at>=0,"Missing control "+id);
  assert.ok(view.slice(at,view.indexOf(">",at)).includes('aria-keyshortcuts="Meta+Shift+'+key+'"'),
    "Missing route-scoped shortcut on "+id);
 }
 assert.match(view,/id="ut-refresh"[^>]*aria-keyshortcuts="Control\+Shift\+R"/);
 assert.doesNotMatch(view,/ut-update-tooltip|ut-update-check|Meta\+Shift\+U/);
 for(const id of ["ut-search-tooltip","ut-add-tooltip","ut-edit-tooltip","ut-refresh-tooltip"])
  assert.ok(view.includes('id="'+id+'"'));
 assert.match(js,/root\.closest\("\.view"\)\?\.hidden\|\|document\.querySelector\("dialog\[open\]"\)/);
 assert.match(js,/event\.target instanceof Element/);
 assert.match(js,/window\.addEventListener\("keydown",event=>/);
 assert.doesNotMatch(js,/setTimeout|setInterval|requestAnimationFrame/);
});

test("Utility editorial fields remain separate from catalog labels and collection annotations",()=>{
 const editor=source("sites/_apex/app/assets/utility-editorial-ui.js");
 assert.match(js,/item\.description\|\|"Description pending source review"/);
 assert.match(js,/data-ut-edit-annotation/);
 assert.match(js,/createUtilityAnnotationEditor/);
 assert.match(editor,/editorial_version/);
 assert.match(js,/Pending direct source review/);
 assert.match(editor,/action:"annotate"/);
 assert.match(editor,/maxlength="250" required/);
 assert.match(editor,/data-annotation-target/);
 assert.match(editor,/description\.value/);
 assert.match(editor,/descriptionCount/);
 assert.match(js,/Edit description, notes &amp; rating/);
 assert.match(editor,/expected_version:version/);
 assert.match(editor,/rating!==null/);
 assert.match(editor,/length>100/);
 assert.match(editor,/Unrated/);
 assert.match(css,/#ut-root \.ut-annotation-dialog/);
 assert.match(css,/#ut-root \.ut-editorial-section/);
 assert.match(html,/utilities\.css\?profile=v2/);
 assert.match(dashboard,/utilities\.js\?profile=v2/);
});

test("Edit utility description: required, 250-character limit, one-paragraph input; preserve optional annotations",()=>{
 const valid=validateUtilityAnnotation("Reviewed and updated utility description","",null);
 assert.deepEqual(valid,{description:"Reviewed and updated utility description",notes:"",rating:null});
 assert.equal(validateUtilityAnnotation("x".repeat(250),"note",0.5).description.length,250);
 assert.equal(validateUtilityAnnotation("Short", "n".repeat(100),5).rating,5);
 for(const description of ["","  ","x".repeat(251)," leading","trailing ","line\nbreak","tab\there"])
  assert.throws(()=>validateUtilityAnnotation(description,"",null),/Description is required/);
 for(const other of [null,undefined,8])
  assert.throws(()=>validateUtilityAnnotation(other,"",null),/Description is required/);
 assert.throws(()=>validateUtilityAnnotation("Fine","n".repeat(101),null),/Notes must/);
 assert.throws(()=>validateUtilityAnnotation("Fine","",0.75),/Rating must/);
 assert.match(js,/createUtilityAnnotationEditor/);
 assert.match(css,/#ut-root \.ut-annotation-form #ut-annotation-description/);
 assert.match(css,/max-height:calc\(100dvh - 32px\)/);
});
