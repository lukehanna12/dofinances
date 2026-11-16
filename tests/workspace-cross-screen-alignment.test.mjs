import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const asset=name=>source("sites/_apex/app/assets/"+name);
const html=source("sites/_apex/app/index.html");
const shared=asset("workspace-wallpapers.css");

test("Workspace alignment geometry is centrally configured at desktop and mobile sizes",()=>{
 for(const token of [
  "--workspace-panel-overlap:44px",
  "--workspace-summary-row-height:clamp(15px,1.275vw,16.5px)",
  "--workspace-summary-controls-gap:24px",
  "--workspace-control-size:32px",
  "--workspace-controls-content-gap:15px",
  "--workspace-summary-top:calc(var(--workspace-title-flow-height) + var(--workspace-title-flow-gap) - var(--workspace-panel-overlap))",
  "--workspace-controls-top:calc(var(--workspace-summary-top) + var(--workspace-summary-row-height) + var(--workspace-summary-controls-gap))",
  "--workspace-summary-controls-gap:20px",
  "--workspace-control-size:30px",
  "--workspace-controls-content-gap:12px"
 ])assert.ok(shared.includes(token),token);
});
test("Collections and Utilities consume the same summary and list spacing values",()=>{
 for(const name of ["collections.css","utilities.css"]){
  const css=asset(name);
  assert.ok(css.includes("margin-top:calc(-1 * var(--workspace-panel-overlap))"),name);
  assert.ok(css.includes("margin-top:var(--workspace-summary-controls-gap)"),name);
  assert.ok(css.includes("margin-bottom:var(--workspace-controls-content-gap)"),name);
 }
});
test("Local, External and Credentials reuse one Provider workbench with the common search row",()=>{
 const js=asset("providers.js"),css=asset("providers.css");
 assert.ok(js.includes("host.append(root)"));
 for(const route of ["local","external","credentials"])assert.ok(html.includes('colosseum/providers/'+route));
 const provider=html.slice(html.indexOf('<div class="pv-overview">'),html.indexOf('<div class="pv-inspector"'));
 assert.ok(provider.includes('class="pv-search-row"'));
 assert.ok(provider.indexOf('id="pv-summary"')<provider.indexOf('class="pv-search-row"'));
 assert.ok(provider.indexOf('id="pv-search"')<provider.indexOf('id="pv-refresh"'));
 assert.equal((provider.match(/id="pv-refresh"/g)||[]).length,1);
 assert.equal((provider.match(/id="pv-index-total"/g)||[]).length,0);
 assert.equal((provider.match(/id="pv-summary-updated"/g)||[]).length,1);
 assert.ok(provider.indexOf('id="pv-summary-updated"')<provider.indexOf('class="pv-search-row"'));
 assert.ok(css.includes("margin-top:var(--workspace-summary-controls-gap)"));
 assert.ok(css.includes("margin-bottom:var(--workspace-controls-content-gap)"));
 assert.ok(css.includes("height:var(--workspace-control-size)"));
});
test("Permissions puts RULES / ENABLED above its lower refresh track",()=>{
 const css=asset("permissions.css");
 assert.ok(html.includes("— RULES / — ENABLED"));
 assert.ok(css.includes("grid-template-rows:var(--workspace-summary-row-height) minmax(var(--workspace-control-size),auto)"));
 assert.ok(css.includes("row-gap:var(--workspace-summary-controls-gap)"));
 assert.ok(css.includes("#pm-root #pm-count{grid-column:1;grid-row:1;align-self:start}"));
 assert.ok(css.includes("#pm-root .pm-overview-right{grid-column:2;grid-row:2;"));
});
test("Diagnostics refresh matches Collections geometry and busy/shortcut behavior",()=>{
 const css=asset("diagnostics.css"),js=asset("diagnostics.js");
 const el=html.slice(html.indexOf('<div id="diagnostics-root"'),html.indexOf('<div class="dg-meta"'));
 assert.ok(el.includes('class="dg-refresh-icon lucide lucide-rotate-cw"'));
 assert.ok(el.includes('aria-keyshortcuts="Control+Shift+R"'));
 assert.ok(el.includes('id="dg-refresh-tooltip" role="tooltip"'));
 assert.ok(!el.includes('<span>Refresh</span></button>'));
 assert.ok(css.includes("margin-top:calc(-1 * var(--workspace-panel-overlap))"));
 for(const detail of ["border:1px solid #262626","border-radius:10px","background:#171717","color:#fafafa","width:14px;height:14px","stroke-width:1.7","animation:dg-spin 600ms linear infinite"]){
  assert.ok(css.includes(detail),detail);
 }
 assert.ok(js.includes('refresh.setAttribute("aria-busy","true")'));
 assert.ok(js.includes('event.code!=="KeyR"'));
});
test("Settings, Docs and Projects use the same anchors with no local offset estimates",()=>{
 const settings=asset("settings.css"),docs=asset("project-readme.css"),projects=asset("project-showcase.css");
 assert.ok(settings.includes("margin:calc(-1 * var(--workspace-panel-overlap))"));
 assert.ok(settings.includes(".st-group:first-of-type{margin-top:var(--workspace-summary-controls-gap)}"));
 assert.ok(settings.includes("min-height:var(--workspace-control-size)"));
 assert.ok(docs.includes("margin-top:calc(-1 * var(--workspace-panel-overlap))"));
 assert.ok(html.includes('<div class="page-heading"><h1 id="readme-title">Docs</h1></div>'));
 assert.ok(projects.includes("#project-create{position:absolute;right:0;top:var(--workspace-controls-top)"));
 assert.ok(projects.includes("min-height:var(--workspace-control-size)"));
});
