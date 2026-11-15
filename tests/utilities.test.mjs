import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initColosseumUtilities,utilityFiltersFromFields,utilitySearchIndex,utilityCanManage} from "../sites/_apex/app/assets/utilities.js";
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
 assert.ok(html.includes('<link rel="stylesheet" href="/app/assets/utilities.css">'));
 assert.ok(dashboard.includes('import {initColosseumUtilities} from "./utilities.js"'));
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
 assert.ok(js.includes('query,sort:elements.sort.value,page_size:25'));
 assert.ok(js.includes('include:s.include,exclude:s.exclude'));
});
test("Six sort orders, separate filter modes and keyset pagination are present",()=>{
 for(const name of ["name_asc","name_desc","uid_asc","uid_desc","time_new","time_old"])
  assert.ok(view.includes('value="'+name+'"'),"Missing "+name);
 assert.ok(js.includes('["include","exclude"]'));
 assert.ok(js.includes('s.cursors[index+1]=s.nextCursor'));
 assert.ok(js.includes('s.cursors[s.page-1]'));
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
 assert.ok(js.includes("files_has_more"));
 assert.ok(js.includes("s.detailCache.clear();s.page=index"));
 assert.ok(js.includes('files_offset:offset'));
 assert.ok(js.includes("s.detail?.item?.uid===item.uid"));
 assert.ok(!js.includes("Array.from({length:13}"));
});
test("Update inspection is manual, bounded, and cannot change the catalog",()=>{
 assert.ok(js.includes('elements.updates.addEventListener("click",()=>void checkUpdates())'));
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
