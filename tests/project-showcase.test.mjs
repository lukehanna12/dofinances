import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PROJECT_SHOWCASE,renderProjectShowcase,projectShowcaseStatus,sortProjectShowcase} from "../sites/_apex/app/assets/project-showcase.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Projects roster applies requested names and progress states without retired entries",()=>{
 assert.deepEqual(PROJECT_SHOWCASE.map(p=>p.name),[
  "BootScript","Lightwork","ReadMe GLP","ChatStore",
  "Colosseum","Apple HIGs Reader","Terminal Scalars","Unicode Plus",
  "Liquid Plexiglass 26","3D Liquid Glass","Apple Adobe FX",
  "Protocol Monitor Pruner","App Caviar","Ozoning Board"
 ]);
 assert.equal(new Set(PROJECT_SHOWCASE.map(p=>p.slug)).size,14);
 assert.ok(!PROJECT_SHOWCASE.some(p=>p.slug==="bootscribe"),"Retired BootScribe must not be rendered");
 assert.ok(!PROJECT_SHOWCASE.some(p=>p.slug==="3d-liquid-glass-27-swift-package"));
 assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug==="3d-liquid-glass-26-swift-package"),{
  slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null
 });
 assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug==="ozoning-board"),{
  slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null
 });
});
test("Curated projects link their verified GitHub repositories",()=>{
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.repository).map(p=>[p.slug,p.repository]),[
  ["bootscript","lukehanna12/bootscript"],
  ["translucence-lab","lukehanna12/lightwork"],
  ["chatgpt-chat-save-chrome-extension","lukehanna12/chatstore"],
  ["colosseum","lukehanna12/colosseum"],["apple-hig-reader","lukehanna12/apple-higs-reader"],
  ["unicode-plus","lukehanna12/unicode-plus"],
  ["protocol-monitor-pruner","lukehanna12/protocol-monitor-pruner"]
 ]);
 assert.equal(PROJECT_SHOWCASE.filter(p=>!p.repository).length,7);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.status==="in-progress").map(p=>p.slug),[
  "bootscript","translucence-lab","github-readme-chrome-extension",
  "chatgpt-chat-save-chrome-extension","apple-hig-reader","unicode-plus","protocol-monitor-pruner"
 ]);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.docs).map(p=>p.slug),[
  "bootscript","translucence-lab","github-readme-chrome-extension",
  "chatgpt-chat-save-chrome-extension"
 ]);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.docs&&!p.repository).map(p=>p.slug),[
  "github-readme-chrome-extension"
 ]);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="colosseum").status,undefined);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="unicode-plus").status,"in-progress");
});
test("Local Docs are created in account storage without overwriting saved READMEs",()=>{
 const store=read("edge/auth-store-projects.mjs");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 const router=read("edge/router.mjs");
 for(const name of ["BootScript","Lightwork","ReadMe GLP","ChatStore"]){
  assert.ok(store.includes('"'+name+'"'),"Seed is missing "+name);
 }
 assert.match(store,/INSERT OR IGNORE INTO project_records/);
 assert.doesNotMatch(store,/\["bootscribe","BootScribe"\]/);
 assert.match(store,/DELETE FROM project_records WHERE user_id=\? AND slug=\x27bootscribe\x27/);
 assert.match(store,/project_catalog_migrations/);
 assert.ok(store.includes('["github-readme-chrome-extension","ReadMe GLP (GitHub Live Previewer)","ReadMe GLP"]'),"Stored project titles migrate without overwriting READMEs");
 assert.match(store,/UPDATE project_records SET name=\? WHERE user_id=\? AND slug=\? AND name=\?/);
 assert.match(store,/projectSaveLocal\(/);
 assert.match(ui,/routeSlug\(\)/);
 assert.match(router,/\^\\\/app\\\/project\\\//);
});
test("Compact quarter-area Projects cards retain image reveal and status styling",()=>{
 const css=read("sites/_apex/app/assets/project-showcase.css");
 const source=read("sites/_apex/app/assets/project-showcase.js");
 const permissions=read("sites/_apex/app/assets/permissions.css");
 const store=read("edge/auth-store-projects.mjs");
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/min-height:clamp\(215px,18vw,250px\)/);
 assert.match(css,/@media\(max-width:699px\)[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.project-showcase-title\{[\s\S]*font-size:clamp\(12px,1\.05vw,16px\)/);
 assert.match(css,/transform:scale\(1\.1\)/);
 assert.match(css,/transform:scale\(1\)/);
 assert.match(css,/background:rgba\(0,0,0,\.6\)/);
 assert.match(css,/border-radius:10px/);
 assert.match(css,/font-size:9px;font-weight:500;line-height:12px;padding:2px 9px/);
 assert.match(css,/border-radius:999px;white-space:nowrap/);
 assert.match(permissions,/\.pm-rule-row\{min-height:56px;border-bottom:1px solid var\(--pm-line\)/);
 assert.match(css,/background:color\(srgb 0\.172549 0\.403922 0\.772549 \/ 0\.1\)/);
 assert.match(css,/color:rgb\(44, 103, 197\)/);
 assert.match(css,/background:color\(srgb 0\.137 0\.855 0\.349 \/ 0\.09\)/);
 assert.match(css,/background:color\(srgb 0\.98 0\.76 0\.07 \/ 0\.09\)/);
 assert.match(permissions,/\.pm-rule-row\[data-enabled="false"\] \.pm-rule-status\{color:#747474\}/);
 assert.match(source,/const status=projectShowcaseStatus\(project\)/);
 assert.match(store,/\["protocol-monitor-pruner","Protocol Monitor Pruner","lukehanna12\/protocol-monitor-pruner"\]/);
 assert.match(source,/addEventListener\("pointerenter",reveal/);
 assert.match(source,/addEventListener\("focusin",reveal/);
 assert.match(source,/if\(active\)card\.href/);
 assert.match(source,/project\.docs===true/);
 assert.match(source,/Local Docs · Editable/);
 assert.match(source,/else card\.tabIndex=0/);
});
test("Projects uses native static catalog without exposing private data in Studio",()=>{
 const html=read("sites/_apex/app/index.html");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 const store=read("edge/auth-store-projects.mjs");
 const workflow=read(".github/workflows/site.yml");
 assert.match(html,/href="\/app\/assets\/project-showcase\.css"/);
 assert.match(html,/id="project-list" class="project-showcase-grid"/);
 assert.match(ui,/renderProjectShowcase\(cards,projects,slugRoute\)/);
 assert.match(ui,/location\.hash="#"\+slugRoute\(data\.project\.slug\)/);
 assert.match(store,/lukehanna12\/apple-higs-reader/);
 assert.match(store,/Apple HIGs Reader/);
 assert.doesNotMatch(workflow,/cp sites\/_apex\/app\/assets\/project-showcase\.js dist/);
 assert.equal(typeof renderProjectShowcase,"function");
});

test("Verified repository associations backfill once and respect account overrides",()=>{
 const store=read("edge/auth-store-projects.mjs");
 const ui=read("sites/_apex/app/assets/project-showcase.js");
 for(const [slug,name,repository] of [
  ["bootscript","BootScript","lukehanna12/bootscript"],
  ["unicode-plus","Unicode Plus","lukehanna12/unicode-plus"],
  ["translucence-lab","Lightwork","lukehanna12/lightwork"],
  ["chatgpt-chat-save-chrome-extension","ChatStore","lukehanna12/chatstore"]
 ]){
  assert.ok(store.includes(JSON.stringify([slug,name,repository])));
  assert.equal(PROJECT_SHOWCASE.find(p=>p.slug===slug)?.repository,repository);
 }
 assert.ok(store.includes("CREATE TABLE IF NOT EXISTS project_repository_link_migrations"));
 assert.ok(store.includes("WHERE user_id=? AND slug=? AND repository IS NULL"));
 assert.ok(store.includes("SELECT 1 FROM project_repository_link_migrations WHERE user_id=? AND slug=?"));
 assert.ok(store.includes("DELETE FROM project_repository_link_migrations WHERE user_id=?"));
 assert.ok(ui.includes("repository:saved.repository||null"));
});

test("Project cards order Active → In Progress → Coming Soon with stable ties",()=>{
 assert.equal(projectShowcaseStatus({repository:"owner/repo",status:"in-progress"}),"In Progress");
 assert.equal(projectShowcaseStatus({repository:"owner/repo"}),"Active");
 assert.equal(projectShowcaseStatus({docs:true}),"Active");
 assert.equal(projectShowcaseStatus({repository:null}),"Coming Soon");
 const input=[
  {slug:"soon-a"},{slug:"in-progress-a",status:"in-progress",repository:"owner/repo"},
  {slug:"active-a",repository:"owner/repo"},{slug:"soon-b"},
  {slug:"active-b",docs:true},{slug:"in-progress-b",status:"in-progress"}
 ];
 assert.deepEqual(sortProjectShowcase(input).map(p=>p.slug),[
  "active-a","active-b","in-progress-a","in-progress-b","soon-a","soon-b"
 ]);
 assert.deepEqual(input.map(p=>p.slug),["soon-a","in-progress-a","active-a","soon-b","active-b","in-progress-b"],
  "Sorting must not mutate the account-owned project array");
});

test("Projects header replaces count with the collections-style plus control and shortcut",()=>{
 const html=read("sites/_apex/app/index.html");
 const css=read("sites/_apex/app/assets/project-showcase.css");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 assert.doesNotMatch(html,/Your projects, organized in one place\./);
 assert.doesNotMatch(html,/id="project-count"/);
 assert.match(html,/id="project-create"[^>]*aria-keyshortcuts="Meta\+Shift\+N"/);
 assert.match(html,/id="project-create-tooltip"[^>]*role="tooltip"/);
 assert.match(html,/src="\/app\/assets\/add-collection\.v3\.svg"/);
 assert.match(html,/<kbd>⇧<\/kbd><kbd>⌘<\/kbd><kbd>N<\/kbd>/);
 assert.match(css,/project-create-tooltip/);
 assert.match(css,/transition-delay:\.15s,\.15s,\.15s/);
 assert.match(css,/project-create-plus-icon\{[\s\S]*?filter/);
 assert.match(css,/section-subheading\{[\s\S]*?margin:6px 0 13px/);
 assert.match(ui,/event\.code!=="KeyN"/);
 assert.match(ui,/openCreateDialog\(\)/);
 assert.doesNotMatch(ui,/\$\("project-count"\)/);
});
