import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveWorkspaceRoute,workspaceRouteDetails} from "../sites/_apex/app/assets/workspace-nav.js";
const read=rel=>readFileSync(new URL("../"+rel,import.meta.url),"utf8");
const app=read("sites/_apex/app/index.html");
const studio=read("studio/sidebar/index.html");
const css=rel=>read("sites/_apex/app/assets/"+rel);
test("Dashboard is canonical in both shells; original content, photo, nav and WebGPU loader survive",()=>{
 for(const html of [app,studio]){
  assert.ok(html.includes('data-route="dashboard" href="#dashboard" aria-label="Dashboard"'));
  assert.ok(html.includes('data-view="dashboard"'));
  assert.ok(html.includes('href="#dashboard">Dashboard</a>'));
  assert.ok(!html.includes('data-breadcrumb-root'));
  assert.ok(html.includes('id="topbar-dashboard-home" class="topbar-dashboard-home" href="#dashboard"'));
  assert.ok(html.includes('aria-labelledby="dashboard-title"'));
  assert.ok(!html.includes('href="#home"'));
  assert.ok(!html.includes('data-view="home"'));
  assert.ok(!html.includes('data-route="home"'));
 }
 assert.ok(app.includes('<h1 id="dashboard-title">doof</h1>'));
 assert.ok(app.includes('id="cta6-mosaic"'));
 assert.ok(css("dashboard-home-loader.js").includes('data-view="dashboard"'));
 assert.ok(css("dashboard-home.css").includes('a[href="#dashboard"]'));
 assert.ok(css("workspace-wallpapers.js").includes('"dashboard": {'));
 assert.ok(css("workspace-wallpapers.js").includes('WORKSPACE_WALLPAPERS.dashboard'));
 assert.ok(css("workspace-title-transition.js").includes('if(route==="dashboard")return'));
 assert.ok(read("edge/router.mjs").includes('"/app/dashboard", "/app/projects"'));
 assert.ok(!read("edge/router.mjs").includes('"/app/home",'));
 assert.equal(resolveWorkspaceRoute("#dashboard"),"dashboard");
 assert.equal(resolveWorkspaceRoute("#home"),"dashboard","Legacy hash redirects to Dashboard");
 assert.equal(workspaceRouteDetails("dashboard").label,"Dashboard");
});
test("Colosseum Settings has a project-scoped sidebar link and a single shared content view",()=>{
 const nav=css("workspace-nav.js");
 assert.ok(nav.includes('meta.projectKey==="colosseum"?"#colosseum/settings":"#settings"'));
 assert.ok(nav.includes('route==="colosseum/settings"?"settings"'));
 assert.ok(nav.includes('route==="colosseum/settings"&&href==="settings"'));
 for(const html of [app,studio]){
  assert.equal((html.match(/data-view="settings"/g)||[]).length,1);
  assert.equal((html.match(/class="nav-link" data-route="settings"/g)||[]).length,1);
  assert.ok(!html.includes('data-view="colosseum/settings"'));
 }
});
test("Clock seconds and timezone retain the same font baseline but have 45% less space",()=>{
 const shared=css("workspace-enhancements.css");
 assert.ok(shared.includes("display:inline-flex;align-items:flex-end;gap:3.825px;flex:none;"));
 assert.ok(shared.includes(".global-clock-zone{margin-left:1.125px}"));
 assert.equal(3.825+1.125,9*.55);
 assert.ok(shared.includes("opacity:0;visibility:hidden;pointer-events:none;"),
  "Clock stays hidden on mobile");
});
test("Every near-black workspace surface gets the requested exact inset highlight without altering Dashboard imagery",()=>{
 const common=css("workspace-title.css");
 assert.ok(common.includes('not([data-view="dashboard"])'));
 assert.ok(common.includes('background:var(--ui-canvas,#0a0a0a);'));
 assert.ok(common.includes("box-shadow:rgba(255, 255, 255, 0.2) 0px 0px 1px inset;"));
 assert.ok(!css("workspace-wallpapers.css").includes('data-wallpaper-route="home"'));
 assert.ok(css("workspace-wallpapers.css").includes('data-wallpaper-route="dashboard"'));
});
test("Docs tooltips expose Collections-style label-only and separated shortcut-key variations",()=>{
 const docs=css("project-readme.css"),controller=css("project-readme-ui.js");
 assert.ok(app.includes('id="rm-edit-tooltip" class="rm-tooltip" role="tooltip"><span class="rm-tooltip-label">Edit README</span><span class="rm-tooltip-shortcut"'));
 assert.ok(app.includes('<kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>'));
 assert.ok(app.includes('aria-describedby="rm-edit-tooltip"'));
 assert.ok(app.includes('id="rm-confirm-tooltip" class="rm-tooltip" role="tooltip"><span class="rm-tooltip-label">Confirm and save changes</span></span>'));
 assert.ok(app.includes('id="rm-diff-tooltip" class="rm-tooltip" role="tooltip"><span class="rm-tooltip-label">Show or hide changes</span></span>'));
 assert.ok(docs.includes(".rm-tooltip-shortcut{"));
 assert.ok(docs.includes("gap:2px;margin-left:14px;"));
 assert.ok(docs.includes(".rm-tooltip-shortcut kbd{"));
 assert.ok(controller.includes('querySelector?.(".rm-tooltip-label")'));
 assert.ok(!controller.includes("Edit README · ⇧⌘E"));
});
test("Utilities, Providers, Permissions and Diagnostics follow Collections tooltip metrics and keyboard focus rules",()=>{
 const cs=css("collections.css"),ut=css("utilities.css"),pv=css("providers.css"),pm=css("permissions.css"),dg=css("diagnostics.css");
 assert.ok(cs.includes("padding:7px 10px"));
 assert.ok(cs.includes("gap:2px;margin-left:14px"));
 assert.ok(cs.includes("transition-delay:.15s,.15s,.15s"));
 assert.ok(cs.includes("transition-delay:0s,0s,0s"));
 assert.ok(ut.includes("padding:7px 10px;font-size:12px;font-weight:520"));
 assert.ok(ut.includes(".ut-shortcut-tooltip{display:inline-flex;align-items:center;justify-content:flex-start;gap:0}"));
 assert.ok(ut.includes("align-items:center;margin-left:14px;color:#a3a3a3"));
 assert.ok(ut.includes(".ut-tooltip-wrap:hover .ut-tooltip"));
 assert.ok(ut.includes(".ut-tooltip-wrap:focus-within .ut-tooltip"));
 assert.ok(ut.includes(".ut-shortcut-keys kbd{display:inline-block"));
 assert.ok(pv.includes(".pv-refresh-tooltip-shortcut{display:inline-flex;align-items:center;gap:2px;margin-left:14px"));
 assert.ok(pm.includes(".pm-refresh-tooltip-shortcut{"));
 assert.ok(pm.includes(".pm-search-tooltip-shortcut{"));
 assert.ok(dg.includes(".dg-refresh-tooltip-shortcut{display:inline-flex;align-items:center;gap:2px;margin-left:14px"));
 for(const id of ["ut-search-tooltip","ut-refresh-tooltip","ut-add-tooltip","ut-edit-tooltip",
   "ut-select-tooltip","pv-search-tooltip","pv-refresh-tooltip","pm-refresh-tooltip",
   "pm-search-tooltip","dg-refresh-tooltip","cs-create-tooltip","cs-select-tooltip"]){
  assert.ok(app.includes('id="'+id+'"'),"Missing visible tooltip: "+id);
 }
 for(const [id,cls] of [["ut-search-tooltip","ut-shortcut-keys"],
  ["pv-search-tooltip","pv-search-tooltip-shortcut"],
  ["pm-refresh-tooltip","pm-refresh-tooltip-shortcut"],
  ["dg-refresh-tooltip","dg-refresh-tooltip-shortcut"]]){
  const start=app.indexOf('id="'+id+'"');
  assert.ok(start>=0,id+" must exist in the application");
  const markup=app.slice(start,start+850);
  assert.ok(markup.includes(cls)&&markup.includes("<kbd>"),id+" has separate real keycaps");
 }
});
