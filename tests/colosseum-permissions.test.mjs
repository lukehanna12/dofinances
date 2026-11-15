import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const index=await fs.readFile(new URL("../sites/_apex/app/index.html",import.meta.url),"utf8");
const script=await fs.readFile(new URL("../sites/_apex/app/assets/permissions.js",import.meta.url),"utf8");
const styles=await fs.readFile(new URL("../sites/_apex/app/assets/permissions.css",import.meta.url),"utf8");
const router=await fs.readFile(new URL("../edge/router.mjs",import.meta.url),"utf8");
const dashboard=await fs.readFile(new URL("../sites/_apex/app/assets/dashboard.js",import.meta.url),"utf8");

test("Permissions is an integrated DoFinances project screen, not an isolated standalone panel",()=>{
 assert.match(index, /data-view="colosseum\/permissions"/);
 assert.match(index,/id="pm-root"/);
 const start=index.indexOf('data-view="colosseum/permissions"');
 const end=index.indexOf('data-view="colosseum/diagnostics"',start);
 assert.ok(!index.slice(start,end).includes("Nothing here yet"));
 assert.match(index,/app\/assets\/permissions\.css/);
 assert.match(dashboard,/initColosseumPermissions\(\)/);
 assert.match(dashboard,/from "\.\/permissions\.js"/);
 assert.match(script,/window\.addEventListener\("hashchange"/);
 assert.match(script,/colosseum\/permissions/);
});

test("Permissions uses the Collections and Utilities dark canvas, a compact rule registry and a single focused editor",()=>{
 assert.match(styles, /--ui-canvas:#0a0a0a/);
 assert.match(styles, /--pm-surface:#0a0a0a/);
 assert.match(styles, /\.pm-registry-head/);
 assert.match(styles, /\.pm-rule-row/);
 assert.match(styles, /\.pm-choice-grid/);
 assert.match(styles, /@media\(max-width:650px\)/);
 assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(index,/id="pm-rule-dialog"/);
 assert.match(index,/id="pm-rule-form"/);
 assert.match(index,/id="pm-cards"/);
 assert.match(script,/function ruleRow\(item\)/);
 assert.match(script,/function openRule\(row\)/);
 assert.ok(!script.includes("pm-access-frame"));
 assert.ok(!index.includes('id="pm-add-form"'));
 assert.ok(!styles.includes("full-window-glass"));
 assert.ok(!styles.includes("body{"));
});

test("Filesystem controls remain complete but appear only inside the focused rule editor",()=>{
 for(const field of ["read","write","script","add","delete"])
  assert.match(index,new RegExp('id="pm-rule-'+field+'"'));
 for(const field of ["pm-rule-path","pm-rule-alias","pm-rule-enabled","pm-rule-save","pm-rule-remove"])
  assert.ok(index.includes('id="'+field+'"'));
 for(const action of ['"prepare"','"confirm"','"cancel"','"set_pin"'])
  assert.ok(script.includes(action),action);
 assert.match(script,/row:editingRow,values:readRule\(\)/);
 assert.match(script,/row:editingRow,remove:true/);
 assert.match(script,/reply\.requiresPin/);
 assert.match(script,/severity==="hazard"/);
 assert.match(script,/severity==="warning"/);
 assert.match(script,/setTimeout\(\(\)=>toast.hidden=true,3000\)/);
 for(const name of ['"pm-confirm"','"pm-pin-dialog"','"pm-confirm-cancel"','"pm-confirm-pin"'])
  assert.ok(index.includes(name));
 assert.match(script,/data-exec-key/);
 assert.match(script,/data-lifecycle-key/);
});

test("Effective access is prominent and resolved by the live gateway, not simulated from rule flags",()=>{
 const view=index.slice(index.indexOf('data-view="colosseum/permissions"'),index.indexOf('data-view="colosseum/diagnostics"'));
 assert.ok(view.indexOf('id="pm-effective-form"')<view.indexOf('id="pm-cards"'));
 assert.match(view,/id="pm-effective-result"/);
 assert.match(view,/id="pm-effective-verdict"/);
 assert.match(script,/request\("explain",\{path,operation\}\)/);
 assert.match(script,/d\.policyRule\?\.path/);
 assert.match(script,/decisionRevision/);
 assert.ok(!script.includes("root.append(inspector)"));
});

test("DoFinances enforces its current immutable owner identity and Cloudflare Access before policy mutations",()=>{
 assert.match(router,/const permissions=pathname==="\/api\/colosseum\/permissions"/);
 assert.match(router,/verifyColosseumOwnerJwt/);
 assert.match(router,/colosseumOwnerStatus\(argument\)/);
 assert.match(router,/if\(!state\.owner\)return json\(\{error:"Only the connected Colosseum administrator may manage permissions\."/);
 assert.match(router,/Cross-site permission request denied/);
 assert.match(router,/return colosseumCatalogForward\(request,env,"permissions\.manage"\)/);
 assert.match(router,/const status=new Request\("https:\/\/dofinances\.com\/api\/colosseum\/permissions"/);
 assert.match(router,/\["catalog\.add"[^\n]*"permissions\.manage"/);
});

test("web client uses same-origin credentials and retains no Google Sheets workflow",()=>{
 assert.match(script,/credentials:"same-origin"/);
 assert.match(script,/\/api\/colosseum\/permissions/);
 assert.ok(!script.includes("script.google.com"));
 assert.ok(!script.includes("spreadsheets.google.com"));
 assert.ok(!script.includes("localStorage"));
 assert.ok(!script.includes("sessionStorage"));
 assert.ok(!script.includes("apiKey"));
 assert.ok(!index.includes("id=\"pm-migration\""));
 assert.ok(!script.includes('request("activate")'));
 assert.ok(!script.includes("Google Sheet is still authoritative"));
 assert.ok(!index.includes("Google Sheets remains authoritative"));
});

test("Permissions loads when reached via sidebar hash or direct pathname and respects a different hash",()=>{
 assert.match(script,/const hash=location\.hash\.replace/);
 assert.match(script,/return hash\?hash==="colosseum\/permissions":/);
 assert.match(script,/location\.pathname\.replace/);
 assert.match(script,/==="\/app\/colosseum\/permissions"/);
});
