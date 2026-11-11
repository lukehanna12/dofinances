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
 assert.match(css,/#cs-root\{[\s\S]*?width:min\(1536px/);
 const common=src("sites/_apex/app/assets/workspace-enhancements.css");
 assert.match(common,/\.view:not\(\[data-view="home"\]\) > \.page-heading > h1/);
});
