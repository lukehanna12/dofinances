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
 assert.match(js,/pageSize:7/);
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
test("Collections positions both ring centers symmetrically around the complete space/slash/space delimiter",async()=>{
 const {collectionSummaryGeometry}=await import("../sites/_apex/app/assets/collections.js");
 const geometry=collectionSummaryGeometry(56.3,70.9,62.1,10);
 assert.deepEqual(geometry,[5.63,7.09,6.21]); // Stored in em for fluid font sizes.
 assert.equal(collectionSummaryGeometry(70,60,65,10),null);
 assert.equal(collectionSummaryGeometry(10,30,40,10),null);
 assert.equal(collectionSummaryGeometry(10,30,20,0),null);
 for(const [A,B] of [[5.63,7.09],[6.4,7.8],[9.2,10.9]]){
   const first=B/2,second=A+B/2,dividerMiddle=(A+B)/2;
   assert.equal(first,B/2);                 // TOTAL left (0) to delimiter right B
   assert.ok(Math.abs((first+second)/2-dividerMiddle)<1e-12); // Reflection
   assert.ok(Math.abs((dividerMiddle-first)-(second-dividerMiddle))<1e-12);
 }
 assert.match(css,/\.cs-summary-dot\{[^}]*left:calc\(var\(--cs-summary-group-end,8em\) \/ 2 - \.5em\)/);
 assert.match(css,/\.cs-summary-dot:last-child\{left:calc\(var\(--cs-summary-group-start,6em\) \+ var\(--cs-summary-group-end,8em\) \/ 2 - \.5em\)/);
 assert.match(css,/\.cs-summary-divider\{[^}]*left:var\(--cs-summary-slash-left,7em\)/);
 assert.doesNotMatch(css,/\.cs-summary-skeleton\{[^}]*gap:/);
 assert.match(js,/range\.setEnd\(text,index\+3\); \/\/ Both spaces AND the slash/);
 assert.match(js,/range\.setEnd\(text,index\+2\)/);
 assert.match(js,/window\.localStorage\.getItem\(SUMMARY_GEOMETRY_KEY\)/);
 assert.match(js,/window\.localStorage\.setItem\(SUMMARY_GEOMETRY_KEY,encoded\)/);
 assert.match(js,/let storedGeometry=initialGeometry\?JSON\.stringify\(initialGeometry\):null/);
 assert.match(js,/if\(persist&&encoded!==storedGeometry\)/);
 assert.match(js,/LEGACY_SUMMARY_SHIFT_KEY/);
 assert.match(js,/const oldSlash=shift\/em\+1\.75/);
 assert.match(js,/applyGeometry\(measureSeparator\(summaryValue\),true\)/);
 assert.doesNotMatch(js,/localStorage\.setItem\([^\n]*state\.collections/);
 assert.doesNotMatch(js,/ResizeObserver|requestAnimationFrame|setInterval/);
});

test("Collections content rises while maintaining a margin and the shared title position",()=>{
 assert.match(css,/#cs-root\{[^}]*margin-top:-44px/);
 assert.match(css,/#cs-root\\{padding-bottom:66px\\}/);
 assert.doesNotMatch(css,/#cs-root\\{margin-top:-28px/);
 assert.match(html,/<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
 assert.doesNotMatch(css,/#cs-root \.cs-head h1/);
 assert.doesNotMatch(css,/#cs-root\{[^}]*position:absolute/);
});

test("Collapsed Collections rows retain the former mobile height at all widths",()=>{
 // The former mobile rule: vertical padding 20px on both sides, 16px text, line-height 1.4.
 const mobileSingleLineHeight=20*2+16*1.4;
 assert.equal(mobileSingleLineHeight,62.4);
 assert.match(css,/#cs-root \\.cs-entry:not\\(\\.cs-open\\) \\.cs-trigger\\{height:62\\.4px;padding:0;align-items:center\\}/);
 assert.match(css,/#cs-root \\.cs-entry:not\\(\\.cs-open\\) \\.cs-entry-title\\{overflow:hidden;white-space:nowrap;text-overflow:ellipsis\\}/);
 assert.match(css,/#cs-root \\.cs-trigger \\.cs-entry-title\\{[^}]*font-size:clamp\\(16px,1\\.7vw,20px\\);line-height:1\\.4/);
 assert.match(css,/#cs-root \\.cs-entry\\.cs-open \\.cs-accordion-panel\\{grid-template-rows:1fr/);
 assert.match(css,/@media\\(max-width:639px\\)\\{[\\s\\S]*?#cs-root \\.cs-trigger\\{padding:20px 0\\}/);
 // No global height limit on expanded rows; long titles remain readable there.
 assert.doesNotMatch(css,/#cs-root \\.cs-trigger\\{[^}]*height:62\\.4px/);
 assert.doesNotMatch(css,/#cs-root \\.cs-entry\\.cs-open \\.cs-trigger\\{[^}]*height:/);
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

test("Collections idle refresh icon uses Lucide rotate-cw with Apple-like stroke",()=>{
 const start=html.indexOf('<button class="cs-button" id="cs-refresh"');
 assert.ok(start>=0);
 const button=html.slice(start,html.indexOf("</button>",start)+9);
 assert.ok(button.includes('class="cs-refresh-icon lucide lucide-rotate-cw"'));
 assert.ok(button.includes('stroke="currentColor" stroke-width="1.7"'));
 assert.ok(button.includes('stroke-linecap="round" stroke-linejoin="round"'));
 assert.ok(button.includes('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>'));
 assert.ok(button.includes('<path d="M21 3v5h-5"/>'));
 assert.ok(button.endsWith("Refresh</button>"));
 assert.ok(css.includes("#cs-root #cs-refresh .cs-refresh-icon{width:17px;height:17px;stroke-width:1.7}"));
 assert.ok(js.includes('refreshButton.addEventListener("click"'));
});


test("Collections loading summary uses two synchronized, text-colored circular skeletons",()=>{
 const start=html.indexOf('id="cs-summary"');
 const summary=html.slice(start,html.indexOf("</span></span>",start)+14);
 assert.ok(summary.includes('aria-busy="true"'));
 assert.ok(summary.includes('class="cs-summary-skeleton" aria-hidden="true"'));
 assert.equal((summary.match(/class="cs-summary-dot"/g)||[]).length,2);
 assert.ok(summary.includes('class="cs-summary-divider">/</span>'));
 assert.ok(css.includes('width:1em;height:1em;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;background:transparent;animation:cs-summary-spin 600ms linear infinite'));
 assert.ok(css.includes('@keyframes cs-summary-spin{to{transform:rotate(360deg)}}'));
 assert.equal((css.match(/animation:cs-summary-spin 600ms/g)||[]).length,2); // Both share one keyframe.
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

test("Collections refresh shows a fast arrow-free ring while both skeletons remain synchronized",()=>{
 assert.ok(js.includes('refreshButton.classList.toggle("cs-refreshing",loading)'));
 assert.ok(js.includes('refreshButton.setAttribute("aria-busy",String(loading))'));
 assert.ok(js.includes('summary.classList.toggle("cs-summary-loading",loading)'));
 assert.ok(js.includes('setSummaryLoading(true);'));
 assert.ok(js.includes('setSummaryLoading(false);'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing .cs-refresh-icon{display:none}'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing::before{content:"";display:inline-block;box-sizing:border-box;width:17px;height:17px;flex:none;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:cs-summary-spin 600ms linear infinite}'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing::before{animation:none!important}'));
 assert.ok(css.includes('@keyframes cs-summary-spin{to{transform:rotate(360deg)}}'));
 assert.ok(!css.includes('cs-refreshing .cs-refresh-icon{animation:'));
 assert.equal((css.match(/@keyframes cs-summary-spin/g)||[]).length,1);
 assert.equal((css.match(/animation:cs-summary-spin 600ms/g)||[]).length,2);
 assert.ok(!js.includes('setInterval('));
});

test("Collections update time inherits the shared unpadded-hour convention",async()=>{
 const {formatWorkspaceTime}=await import("../sites/_apex/app/assets/workspace-nav.js");
 const {formatCollectionSummary}=await import("../sites/_apex/app/assets/collections.js");
 const first=new Date(2026,10,11,2,43,9);
 assert.equal(formatWorkspaceTime(first,{hour12:true}),"2:43 AM");
 assert.equal(formatCollectionSummary(first,11),"TOTAL 11 / UPDATED 2:43 AM");
 const afternoon=new Date(2026,10,11,14,5,9);
 assert.equal(formatCollectionSummary(afternoon,7),"TOTAL 7 / UPDATED 2:05 PM");
 assert.ok(js.includes('import {formatWorkspaceTime} from "./workspace-nav.js"'));
 assert.ok(js.includes('formatWorkspaceTime(updatedAt,{hour12:true})'));
 assert.ok(!js.includes('updatedAt.toLocaleTimeString('));
});

test("Eleven collections paginate as seven on the first page and four on the second",()=>{
 const pageSize=7;
 const collections=Array.from({length:11},(_,i)=>({collection_id:"c"+i}));
 assert.match(js,/page:1,pageSize:7,selecting:false/);
 assert.match(js,/Math\.ceil\(state\.collections\.length\/state\.pageSize\)/);
 assert.match(js,/state\.collections\.slice\(\(state\.page-1\)\*state\.pageSize,state\.page\*state\.pageSize\)/);
 assert.equal(Math.ceil(collections.length/pageSize),2);
 assert.equal(collections.slice(0,pageSize).length,7);
 assert.equal(collections.slice(pageSize,2*pageSize).length,4);
});
