import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=src("sites/_apex/app/index.html");
const js=src("sites/_apex/app/assets/collections.js");
const css=src("sites/_apex/app/assets/collections.css");
const edge=src("edge/router.mjs");
const dashboard=src("sites/_apex/app/assets/dashboard.js");

test("Collections controller is valid native ES module",async()=>{
 const module=await import("../sites/_apex/app/assets/collections.js");
 assert.equal(typeof module.initColosseumCollections,"function");
});
test("Collections view is isolated from Permissions and wired to the dashboard",()=>{
 assert.match(html,/data-view="colosseum\/collections"[\s\S]*?id="cs-root"/);
 assert.match(html,/id="cs-refresh"/);
 assert.match(html,/id="cs-create"/);
 assert.match(html,/id="cs-form-dialog"/);
 assert.match(html,/id="cs-delete-dialog"/);
 assert.match(html,/href="\/app\/assets\/collections\.css"/);
 assert.match(dashboard,/import \{initColosseumCollections\} from "\.\/collections\.js"/);
 assert.match(dashboard,/initColosseumCollections\(\)/);
 assert.match(html,/data-view="colosseum\/permissions"/);
 assert.doesNotMatch(js,/\/api\/colosseum\/permissions/);
});
test("Exact recovered accordion behavior includes direct collapse and exclusive selection",()=>{
 assert.match(js,/const next=state\.activeId===id\?null:id/);
 assert.match(js,/state\.activeId=next/);
 assert.match(js,/classList\.toggle\("cs-open",open\)/);
 assert.match(js,/aria-expanded/);
 assert.match(css,/grid-template-rows:0fr/);
 assert.match(css,/\.cs-entry\.cs-open \.cs-accordion-panel\{grid-template-rows:1fr/);
});
test("Collections paginate, utilities scroll at no more than 480px with natural smaller height",()=>{
 assert.match(js,/pageSize:4/);
 assert.match(js,/data-cs-page="prev"/);
 assert.match(js,/data-cs-page="next"/);
 assert.match(js,/aria-current="page"/);
 assert.match(css,/\.cs-card\{[^}]*max-height:480px/);
 assert.doesNotMatch(css,/\.cs-card\{[^}]*min-height:480px/);
 assert.match(css,/\.cs-utility-list\{[^}]*overflow-y:auto/);
 assert.match(css,/\.cs-card\{[^}]*border-radius:24px/);
});
test("Selection mode changes Edit/Select to Remove/Cancel and hides dormant addition",()=>{
 assert.match(js,/if\(state\.selecting\)/);
 assert.match(js,/cs-danger" type="button" data-cs-action="remove"/);
 assert.match(js,/data-cs-action="cancel"/);
 assert.match(js,/data-cs-action="admit" disabled/);
 assert.match(js,/data-cs-action="edit"/);
 assert.match(js,/data-cs-action="select"/);
 assert.match(js,/if\(action==="admit"\)return/);
 assert.doesNotMatch(js,/request\("admit"/);
 assert.match(js,/new Set\(\)/);
});
test("Real writes are owner-protected, revision-bound, and preserve underlying catalog items",()=>{
 assert.match(edge,/const collections=pathname==="\/api\/colosseum\/collections"/);
 assert.match(edge,/if\(!state\.owner\)return json\(\{error:"Only the connected Colosseum administrator may manage collections/);
 assert.match(edge,/Cross-site collection management request denied/);
 assert.match(edge,/collection\.manage/);
 assert.match(js,/request\("create",\{name,description\}\)/);
 assert.match(js,/request\("edit",\{original_name:previous\.name,name,desc:description,expected_revision:revision\}\)/);
 assert.match(js,/request\("evict",\{name:col\.name,item_uids:uids,expected_revision:revision\}\)/);
 assert.match(js,/request\("destroy",\{name:col\.name,expected_revision:revision\}\)/);
 assert.match(js,/Underlying catalog items|underlying catalog items|underlying utilities/);
});
test("Source data is never fabricated and Refresh asks Colosseum for live data",()=>{
 assert.match(js,/const COLLECTIONS_API="\/api\/colosseum\/collections"/);
 assert.match(js,/cache:"no-store"/);
 assert.match(js,/credentials:"same-origin"/);
 assert.match(js,/request\("list",\{\},true\)/);
 assert.match(js,/request\("get",\{name:col\.name\}\)/);
 assert.match(js,/page\.next_cursor/);
 assert.match(js,/refreshButton\.addEventListener/);
});

test("Collections title uses the shared non-Home heading contract without custom offsets",()=>{
 const section=html.match(/<section class="view project-view" data-view="colosseum\/collections"[^>]*>([\s\S]*?)<\/section>/)?.[1]||"";
 assert.match(section,/^\s*<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
 assert.equal((section.match(/id="project-collections-title"/g)||[]).length,1);
 assert.match(section,/<div id="cs-root" class="cs-screen">/);
 assert.doesNotMatch(section,/<div class="cs-head-copy">[\s\S]*?<h1/);
 assert.doesNotMatch(css,/#cs-root \.cs-head h1/);
 assert.doesNotMatch(css,/padding-top:0/);
 assert.doesNotMatch(css,/\.content:has\(> \.view\[data-view="colosseum\/collections"/);
 assert.doesNotMatch(css,/\.content > \.view\[data-view="colosseum\/collections"\] > \.page-heading/);
 assert.doesNotMatch(css,/width:min\(1536px/);
 assert.doesNotMatch(css,/left:50%/);
 assert.doesNotMatch(css,/transform:translateX\(-50%\)/);
 assert.match(css,/#cs-root \.cs-wrap\{width:100%;margin:0;padding:0\}/);
 const common=src("sites/_apex/app/assets/workspace-enhancements.css");
 assert.match(common,/\.view:not\(\[data-view="home"\]\) > \.page-heading > h1/);
});

test("Collections uses one route-scoped black canvas without an overlay",()=>{
 const styles=src("sites/_apex/app/assets/collections.css");
 const wallpapers=src("sites/_apex/app/assets/workspace-wallpapers.css");
 const foundation=src("sites/_apex/assets/site-foundation.css");
 assert.match(styles,/html:has\(body > #workspace-shell \.view\[data-view="colosseum\/collections"\]:not\(\[hidden\]\)\)\s*\{\s*--ui-canvas:#0a0a0a;/);
 assert.doesNotMatch(styles,/#cs-root\s*\{[^}]*background:/);
 assert.match(wallpapers,/html:has\(body > #workspace-shell\)[\s\S]*?background:var\(--ui-canvas,#171717\)/);
 assert.match(wallpapers,/body:has\(> #workspace-shell\)[\s\S]*?background:var\(--ui-canvas,#171717\)/);
 assert.match(foundation,/--ui-canvas: #171717;/);
});

test("Collections summary uses the visitor's last successful refresh time and complete live count",async()=>{
 const {formatCollectionSummary}=await import("../sites/_apex/app/assets/collections.js");
 assert.equal(formatCollectionSummary(new Date(2026,10,11,2,2),11),
   "TOTAL 11 / UPDATED 2:02 AM");
 assert.equal(formatCollectionSummary(new Date(2026,10,11,14,7),0),
   "TOTAL 0 / UPDATED 2:07 PM");
 assert.ok(html.includes('<span class="cs-eyebrow cs-summary-loading" id="cs-summary" aria-live="polite" aria-busy="true">'));
 assert.doesNotMatch(html,/COLOSSEUM \/ COLLECTION LIBRARY/);
 assert.ok(js.includes('summaryValue.textContent=formatCollectionSummary(refreshedAt,state.collections.length)'));
 assert.match(js,/state\.collections=good\.filter/);
 assert.match(js,/if\(seq!==state\.loadSeq\)return/);
 assert.match(css,/#cs-root \.cs-eyebrow\{[^}]*text-transform:uppercase/);
});
test("Collections content rises while maintaining a margin and the shared title position",()=>{
 assert.match(css,/#cs-root\{[^}]*margin-top:-44px/);
 assert.match(css,/#cs-root\{margin-top:-28px;padding-bottom:66px\}/);
 assert.match(html,/<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
 assert.doesNotMatch(css,/#cs-root \.cs-head h1/);
 assert.doesNotMatch(css,/#cs-root\{[^}]*position:absolute/);
});

test("Collections inherits the shared horizontal content alignment without independent centering",()=>{
 assert.doesNotMatch(css,/width:min\(1536px/);
 assert.doesNotMatch(css,/#cs-root\s*\{[^}]*padding:0 clamp\(/);
 assert.doesNotMatch(css,/#cs-root \.cs-wrap\{[^}]*padding:0 24px/);
 assert.doesNotMatch(css,/#cs-root \.cs-wrap\{[^}]*max-width:1400px/);
 assert.match(css,/#cs-root \.cs-wrap\{width:100%;margin:0;padding:0\}/);
 const shared=src("sites/_apex/app/assets/workspace-wallpapers.css");
 assert.match(shared,/body:has\(> #workspace-shell\) \.content \{/);
 assert.match(html,/<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
});
test("Collections primary content typography scales continuously with window width",()=>{
 for(const selector of [
  "#cs-root .cs-eyebrow", "#cs-root .cs-head p",
  "#cs-root .cs-trigger .cs-entry-title", "#cs-root .cs-description",
  "#cs-root .cs-card-label", "#cs-root .cs-utility-name"
 ]){
  const declarations=css.slice(css.indexOf(selector+"{")).match(/^[^}]*\}/)?.[0]||"";
  assert.match(declarations,/font-size:clamp\(/,selector+" must use fluid sizing");
 }
 assert.doesNotMatch(css,/\.cs-trigger \.cs-entry-title\{font-size:18px/);
 assert.doesNotMatch(css,/\.cs-card-label\{font-size:16px/);
});

test("Collections does not duplicate the live count and refresh time below the header",()=>{
 assert.ok(!js.includes('announce("Live Colosseum · "'));
 assert.ok(js.includes('summaryValue.textContent=formatCollectionSummary(refreshedAt,state.collections.length)'));
 assert.ok(js.includes('announce("");'));
 assert.ok(css.includes("#cs-root .cs-source:empty{display:none}"));
 assert.ok(css.includes('#cs-root .cs-source[data-error="true"]'));
 assert.ok(html.includes('<p id="cs-status" class="cs-source" role="status" aria-live="polite"></p>'));
});

test("Collections refresh icon has one clean clockwise arc and consistent arrowhead",()=>{
 const start=html.indexOf('<button class="cs-button" id="cs-refresh"');
 assert.ok(start>=0,"Refresh control exists");
 const button=html.slice(start,html.indexOf("</button>",start)+9);
 assert.ok(button.includes('class="cs-refresh-icon"'));
 assert.ok(button.includes('viewBox="0 0 24 24"'));
 assert.ok(button.includes('aria-hidden="true" focusable="false"'));
 assert.ok(button.includes('<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>'));
 assert.ok(button.includes('<path d="M21 3v5h-5"/>'));
 assert.ok(!button.includes("M4 12l-1 5"));
 assert.ok(button.endsWith("Refresh</button>"));
 assert.ok(css.includes("#cs-root #cs-refresh .cs-refresh-icon{width:17px;height:17px;stroke-width:1.9}"));
 assert.ok(js.includes('refreshButton.addEventListener("click"'));
 assert.ok(!js.includes("const REFRESH="));
});

test("Collections loading summary uses two synchronized, text-colored circular skeletons",()=>{
 const start=html.indexOf('id="cs-summary"');
 const summary=html.slice(start,html.indexOf("</span></span>",start)+14);
 assert.ok(summary.includes('aria-busy="true"'));
 assert.ok(summary.includes('class="cs-summary-skeleton" aria-hidden="true"'));
 assert.equal((summary.match(/class="cs-summary-dot"/g)||[]).length,2);
 assert.ok(summary.includes('class="cs-summary-divider">/</span>'));
 assert.ok(css.includes('width:1em;height:1em;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;background:transparent;animation:cs-summary-spin 1000ms linear infinite'));
 assert.ok(css.includes('@keyframes cs-summary-spin{to{transform:rotate(360deg)}}'));
 assert.equal((css.match(/animation:cs-summary-spin 1000ms/g)||[]).length,1);
 assert.ok(!css.includes('background:currentColor;animation:cs-summary-pulse'));
 assert.ok(css.includes('#cs-root .cs-summary-loading .cs-summary-value{display:none}'));
 assert.ok(css.includes('#cs-root .cs-eyebrow:not(.cs-summary-loading) .cs-summary-skeleton{display:none}'));
 assert.ok(css.includes('#cs-root .cs-summary-dot{animation:none!important;opacity:.65}'));
 assert.ok(js.includes('setSummaryLoading(true);'));
 assert.ok(js.includes('setSummaryLoading(false);'));
 assert.ok(js.includes('summary.classList.toggle("cs-summary-loading",loading)'));
 assert.ok(js.includes('summary.setAttribute("aria-busy",String(loading))'));
 assert.ok(!js.includes("setInterval("));
});
test("Collections legacy live-status skeleton occupies no space, while failures can surface",()=>{
 assert.ok(html.includes('<p id="cs-status" class="cs-source" role="status" aria-live="polite"></p>'));
 assert.ok(css.includes('#cs-root .cs-source:not([data-visible="true"]){position:absolute;width:1px;height:1px;min-height:0;margin:0;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}'));
 assert.ok(js.includes('status.dataset.visible=error||visible?"true":"false"'));
 assert.ok(!js.includes('announce("Live Colosseum · "'));
 assert.ok(js.includes('setSummaryLoading(false); // Preserve last successful values if this refresh failed.'));
});
