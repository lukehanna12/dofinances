import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PROJECT_SHOWCASE,renderProjectShowcase} from "../sites/_apex/app/assets/project-showcase.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Utility 0001c4 Projects roster is complete and ordered",()=>{
 assert.deepEqual(PROJECT_SHOWCASE.map(p=>p.name),[
  "Translucence Lab","GitHub README Chrome Extension","ChatGPT Chat Save Chrome Extension",
  "Colosseum","Apple HIGs Reader","Terminal Scalars","Unicode Plus",
  "Liquid Plexiglass 26","3D Liquid Glass 26 Swift Package",
  "3D Liquid Glass 27 Swift Package","Apple Adobe FX","Protocol Monitor Pruner","App Caviar"
 ]);
 assert.equal(new Set(PROJECT_SHOWCASE.map(p=>p.slug)).size,13);
});
test("Only Colosseum and the two in-progress projects have GitHub repositories",()=>{
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.repository).map(p=>[p.slug,p.repository]),[
  ["colosseum","lukehanna12/colosseum"],["apple-hig-reader","lukehanna12/apple-higs-reader"],
  ["protocol-monitor-pruner","lukehanna12/protocol-monitor-pruner"]
 ]);
 assert.equal(PROJECT_SHOWCASE.filter(p=>!p.repository).length,10);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.status==="in-progress").map(p=>p.slug),[
  "apple-hig-reader","protocol-monitor-pruner"
 ]);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="colosseum").status,undefined);
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
 assert.match(css,/font-size:9px;font-weight:500;line-height:12px;padding:1px 5px/);
 assert.match(permissions,/\.pm-rule-row\{min-height:56px;border-bottom:1px solid var\(--pm-line\)/);
 assert.match(css,/project-showcase-badge--soon\{background:#3b235f;color:#e9d5ff\}/);
 assert.match(css,/project-showcase-badge--progress\{background:#382409;color:#facc15\}/);
 assert.match(permissions,/\.pm-rule-row\[data-enabled="false"\] \.pm-rule-status\{color:#747474\}/);
 assert.match(source,/const status=project\.status==="in-progress"\?"In Progress"/);
 assert.match(store,/\["protocol-monitor-pruner","Protocol Monitor Pruner","lukehanna12\/protocol-monitor-pruner"\]/);
 assert.match(source,/addEventListener\("pointerenter",reveal/);
 assert.match(source,/addEventListener\("focusin",reveal/);
 assert.match(source,/if\(active\)card\.href/);
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
