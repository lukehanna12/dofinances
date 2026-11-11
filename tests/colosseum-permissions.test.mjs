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

test("Access Control 0001c7 individual cards retain isolated translucent outline, shadow and radii",()=>{
 assert.match(styles,/\.pm-access-frame\s*\{\s*padding:4px/);
 assert.match(styles,/background:rgba\(255,255,255,\.8\)/);
 assert.match(styles,/backdrop-filter:blur\(12px\)/);
 assert.match(styles,/border-radius:16px/);
 assert.match(styles,/\.pm-access-inner\s*\{border-radius:12px/);
 assert.match(styles,/padding:24px/);
 assert.match(script,/class="pm-access-frame"/);
 assert.ok(!styles.includes("body{"));
 assert.ok(!styles.includes(":root{"));
 assert.ok(!styles.includes("full-window-glass"));
});

test("path creation/removal, five file operations and all three confirmation levels are reachable",()=>{
 for(const field of ["read","write","script","add","delete"])assert.match(index,new RegExp('id="pm-add-'+field+'"'));
 for(const action of ['"prepare"','"confirm"','"cancel"','"activate"','"set_pin"'])
  assert.ok(script.includes(action),action);
 assert.match(script,/row:0,values/);
 assert.match(script,/remove:true/);
 assert.match(script,/reply\.requiresPin/);
 assert.match(script,/severity==="hazard"/);
 assert.match(script,/severity==="warning"/);
 assert.match(script,/setTimeout\(\(\)=>toast.hidden=true,3000\)/);
 for(const name of ['"pm-confirm"','"pm-pin-dialog"','"pm-confirm-cancel"','"pm-confirm-pin"'])
  assert.ok(index.includes(name));
 assert.match(script,/data-exec-key/);
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

test("web client uses same-origin credentials, does not embed tokens, and keeps Sheet untouched",()=>{
 assert.match(script,/credentials:"same-origin"/);
 assert.match(script,/\/api\/colosseum\/permissions/);
 assert.ok(!script.includes("script.google.com"));
 assert.ok(!script.includes("spreadsheets.google.com"));
 assert.ok(!script.includes("localStorage"));
 assert.ok(!script.includes("sessionStorage"));
 assert.ok(!script.includes("apiKey"));
 assert.match(index,/original Sheet and web app will stay intact/);
});

test("Permissions loads when reached via sidebar hash or direct pathname and respects a different hash",()=>{
 assert.match(script,/const hash=location\.hash\.replace/);
 assert.match(script,/return hash\?hash==="colosseum\/permissions":/);
 assert.match(script,/location\.pathname\.replace/);
 assert.match(script,/==="\/app\/colosseum\/permissions"/);
});
