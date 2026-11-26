import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=relative=>readFileSync(new URL("../"+relative,import.meta.url),"utf8");
const app=file("sites/_apex/app/index.html");
const studio=file("studio/sidebar/index.html");
const pv=file("sites/_apex/app/assets/providers.css");
const pm=file("sites/_apex/app/assets/permissions.css");
const pmjs=file("sites/_apex/app/assets/permissions.js");
const dg=file("sites/_apex/app/assets/diagnostics.js");
const dgcss=file("sites/_apex/app/assets/diagnostics.css");
test("Local, External, and Credentials share rounded clickable provider rows with guttered scrollbars",()=>{
 for(const route of ["local","external","credentials"]){
  assert.ok(app.includes('data-view="colosseum/providers/'+route+'"'));
 }
 assert.ok(pv.includes("#pv-root .pv-provider-list{"));
 assert.ok(pv.includes("border:0;padding:0 15px 4px 0;"));
 assert.ok(pv.includes("scrollbar-gutter:stable;"));
 assert.ok(pv.includes("scrollbar-width:thin;scrollbar-color:#4b4b4b transparent;"));
 assert.ok(pv.includes("border:1px solid #292929;border-radius:10px;"));
 assert.ok(pv.includes(".pv-provider-item.is-active{background:#292929;border-color:#565656}"));
 assert.ok(pv.includes(".pv-provider-item:hover:not(.is-active){background:#222;border-color:#414141}"));
 assert.ok(pv.includes(".pv-provider-list{max-height:340px;overflow-y:auto;overflow-x:hidden}"));
 assert.ok(pv.includes(".pv-provider-list{max-height:270px}"));
 assert.ok(!pv.includes("border-bottom:1px solid var(--pv-border);border-radius:0;transition:background .16s ease}"));
});
test("Permissions registry retains its badges while Projects uses spacious capsules",()=>{
 assert.ok(app.includes('<span>Location</span>'));
 assert.ok(app.includes('placeholder="Search locations"'));
 assert.ok(!app.includes('<span>Path / alias</span>'));
 assert.ok(!app.includes('placeholder="Search paths and aliases"'));
 assert.ok(pmjs.includes('<span class="pm-rule-status">'));
 assert.ok(pmjs.includes('(enabled?"Enabled":"Off")'));
 const projects=file("sites/_apex/app/assets/project-showcase.css");
 for(const code of ["border-radius:4px","font-size:9px;font-weight:500;line-height:12px;padding:1px 5px"]){
  assert.ok(pm.includes(code),"Permissions Enabled badge geometry remains unchanged: "+code);
 }
 assert.ok(projects.includes("font-size:9px;font-weight:500;line-height:12px;padding:2px 9px"),
  "Projects badge uses comfortable capsule padding");
 assert.ok(projects.includes("border-radius:999px;white-space:nowrap"),
  "Projects badge uses a fully rounded capsule without wrapping the label");
 // Permissions keeps its original color; Projects receives the new translucent
 // hue families explicitly requested for Ready/Review/In Progress/Coming Soon.
 assert.ok(pm.includes("background:#173827;color:#86efac"));
 assert.ok(projects.includes("background:color(srgb 0.137 0.855 0.349 / 0.09)"));
 assert.ok(projects.includes("background:color(srgb 0.172549 0.403922 0.772549 / 0.1)"));
 assert.ok(pm.includes('.pm-rule-row[data-enabled="true"] .pm-rule-status'));
});
test("Permissions PIN and all execution/lifecycle Save actions use capsule buttons",()=>{
 assert.ok(app.includes('id="pm-pin-edit" class="pm-btn">Manage PIN</button>'));
 assert.ok(!app.includes("Manage hazard PIN"));
 assert.ok(pm.includes("#pm-root #pm-pin-edit{border-radius:9999px;"));
 assert.ok(pm.includes(".pm-exec-field .pm-btn{font-size:11px;min-height:28px;padding:5px 10px;border-radius:9999px}"));
 assert.ok(pmjs.includes('data-exec-save'));
 assert.ok(pmjs.includes('data-lifecycle-save'));
 assert.ok(pmjs.includes('>Save</button>'));
});
test("Execution controls fill both wide columns independently; lifecycle always follows full-width",()=>{
 assert.ok(pm.includes(".pm-policy-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:0"));
 assert.ok(pm.includes(".pm-exec,#pm-root .pm-lifecycle{grid-column:1/-1;min-width:0}"));
 assert.ok(pm.includes("@media(min-width:901px)"));
 assert.ok(pm.includes("#pm-root #pm-execution-fields{"));
 assert.ok(pm.includes("grid-template-columns:repeat(2,minmax(0,1fr));"));
 assert.ok(pm.includes("grid-template-rows:repeat(var(--pm-execution-row-count,1),minmax(0,auto));"));
 assert.ok(pm.includes("grid-auto-flow:column;column-gap:24px"));
 assert.ok(pmjs.includes('Math.max(1,Math.ceil(execFields.length/2))'));
 assert.ok(app.indexOf('id="pm-lifecycle"')>app.indexOf('id="pm-exec"'));
 assert.ok(!pm.includes(".pm-policy-grid{display:grid;grid-template-columns:repeat(2"));
});
test("Execution checkbox states have neutral custom checks, hover/press, focus and accessibility fallbacks",()=>{
 const states=[
  'input[type="checkbox"]{',
  "appearance:none;-webkit-appearance:none;",
  "border:1px solid #5b5b5b;border-radius:5px;background:#171717;",
  'input[type="checkbox"]::after{',
  "border-right:2px solid #171717;border-bottom:2px solid #171717;",
  'input[type="checkbox"]:hover:not(:disabled):not(:checked){',
  'input[type="checkbox"]:active:not(:disabled){transform:scale(.9)}',
  'input[type="checkbox"]:checked{background:#f5f5f5;border-color:#f5f5f5}',
  'input[type="checkbox"]:checked::after{',
  'input[type="checkbox"]:disabled{opacity:.45;cursor:not-allowed}',
  "@media(forced-colors:active){",
  "@media(prefers-reduced-motion:reduce){"
 ];
 for(const entry of states)assert.ok(pm.includes(entry),"Missing checkbox state "+entry);
 assert.ok(pm.includes("#pm-root :is(button,input,select):focus-visible{outline:2px solid #fafafa;outline-offset:2px}"));
 assert.ok(pmjs.includes('data-exec-input type="checkbox"'));
});
test("Diagnostics Query options are retired in both shells without changing refresh authority or defaults",()=>{
 for(const html of [app,studio]){
  const screen=html.slice(html.indexOf('data-view="colosseum/diagnostics"'));
  for(const retired of ["Query options",'id="dg-query"','id="dg-run"','id="dg-check"','id="dg-depth"',"data-dg-section"]){
   assert.ok(!screen.includes(retired),"Retired control "+retired);
  }
  for(const kept of ['id="dg-refresh"','id="dg-top"','id="dg-quotas"','id="dg-workers"','id="dg-local"']){
   assert.ok(screen.includes(kept),"Retain report "+kept);
  }
 }
 assert.ok(dg.includes('sections:["workers","kv","d1","durable_objects","local"]'));
 assert.ok(dg.includes('check:"gateway",depth:"quick"'));
 assert.ok(dg.includes("body:JSON.stringify(DEFAULT_DIAGNOSTICS_OPTIONS)"));
 assert.ok(dg.includes('refresh.addEventListener("click",()=>void collect());'));
 assert.ok(dg.includes('event.preventDefault();void collect();'));
 assert.ok(!dg.includes("optionsFromForm"));
 assert.ok(!dg.includes("dg-query"));
 assert.ok(!dgcss.includes(".dg-controls"));
});

test("Execution controls and Provider lifecycle share compact numeric fields and checkboxes",()=>{
 assert.ok(pm.includes(".pm-exec-field{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,99px) auto 52px;align-items:center;gap:8px;min-height:40px;"));
 assert.ok(pm.includes('.pm-exec-field input[type="number"]{min-width:0;width:100%;height:26px;'));
 assert.ok(pm.includes('height:26px;min-height:26px;'),
  "The global 42px input minimum must not enlarge execution or lifecycle number fields");
 assert.ok(pm.includes('justify-self:end;min-height:15px;'),
  "The global 42px input minimum must not enlarge execution checkboxes");
 assert.ok(pm.includes("border-radius:7px;padding:3px 7px;font-size:11px}"));
 assert.ok(pm.includes("width:15px;height:15px;min-width:15px;justify-self:end;"));
 assert.ok(pm.includes('content:"";display:block;width:4px;height:7px;'));
 assert.ok(pmjs.includes('data-exec-input type="checkbox"'));
 assert.ok(pmjs.includes('data-exec-input type="number"'));
 assert.ok(pmjs.includes('data-lifecycle-input type="number"'));
});
