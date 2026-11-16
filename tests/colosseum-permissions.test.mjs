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

test("Permissions omits the effective-access card and the redundant authority success message",()=>{
 const view=index.slice(index.indexOf('data-view="colosseum/permissions"'),index.indexOf('data-view="colosseum/diagnostics"'));
 assert.ok(!view.includes('id="pm-effective-form"'));
 assert.ok(!view.includes("Check effective access"));
 assert.ok(!styles.includes(".pm-effective-inspector"));
 assert.ok(!script.includes('request("explain"'));
 assert.ok(!script.includes("The local permission authority is active and the gateway enforces its policy."));
 assert.match(script,/show\(available\?"":"The local permission authority is unavailable or stale; edits are disabled\.",!available\)/);
 assert.match(script,/if\(seq===loadSeq\)\{\s*show\(error\.message,true\)/);
 assert.match(script,/finally\{working=false;render\(\);\}/);
});

test("Permissions hides the registry legend and authority metadata, and mirrors Collections refresh behavior",()=>{
 const start=index.indexOf('data-view="colosseum/permissions"');
 const end=index.indexOf('data-view="colosseum/diagnostics"',start);
 const view=index.slice(start,end);
 assert.ok(!view.includes("R = Read"));
 assert.ok(!view.includes('id="pm-source"'));
 assert.ok(!view.includes('id="pm-revision"'));
 assert.ok(!view.includes("Revision 5"));
 assert.ok(!styles.includes(".pm-footnote"));
 assert.match(view,/id="pm-refresh"[^>]*aria-keyshortcuts="Control\+Shift\+R"/);
 assert.match(view,/class="pm-refresh-icon lucide lucide-rotate-cw"/);
 assert.match(view,/M21 12a9 9 0 1 1-9-9/);
 assert.match(view,/id="pm-refresh-tooltip" role="tooltip"/);
 assert.match(view,/<kbd>⌃<\/kbd><kbd>⇧<\/kbd><kbd>R<\/kbd>/);
 assert.match(styles,/#pm-root #pm-refresh:hover:not\(:disabled\)\{background:#262626;border-color:#525252\}/);
 assert.match(styles,/#pm-root #pm-refresh:active:not\(:disabled\)\{transform:translateY\(1px\)\}/);
 assert.match(styles,/#pm-root #pm-refresh\.pm-refreshing::before/);
 assert.match(styles,/animation:pm-refresh-spin 600ms linear infinite/);
 assert.match(script,/event\.code!=="KeyR"&&event\.key\?\.toLowerCase\(\)!=="r"/);
 assert.match(script,/event\.ctrlKey/);
 assert.match(script,/event\.shiftKey/);
 assert.match(script,/root\.closest\("\.view"\)\?\.hidden/);
 assert.match(script,/document\.querySelector\("dialog\[open\]"\)/);
 assert.match(script,/refresh\.setAttribute\("aria-busy","true"\)/);
 assert.match(script,/refresh\.setAttribute\("aria-busy","false"\)/);
});

test("Permissions mirrors Collections' count and rule-loading skeletons without shifting content",()=>{
 const view=index.slice(index.indexOf('data-view="colosseum/permissions"'),index.indexOf('data-view="colosseum/diagnostics"'));
 assert.match(view,/class="pm-eyebrow pm-count-loading"/);
 assert.match(view,/class="pm-count-value"/);
 assert.match(view,/class="pm-count-skeleton"/);
 assert.match(view,/class="pm-count-ring"/);
 assert.match(view,/id="pm-cards"[^>]*aria-busy="true"/);
 assert.match(styles,/\.pm-count-loading \.pm-count-value\{visibility:hidden\}/);
 assert.match(styles,/\.pm-count-ring:first-child/);
 assert.match(styles,/\.pm-count-ring:last-child/);
 assert.match(styles,/\.pm-list-loading/);
 assert.match(styles,/site-skeleton-pulse 2s/);
 assert.match(script,/function alignSummarySkeleton\(\)/);
 assert.match(script,/function showLoadingSkeleton\(\)/);
 assert.match(script,/const skeletonWidths=\[68,56,79,45,72,59,83,52\]/);
 assert.match(script,/if\(state\)return; \/\/ Like Collections/);
 assert.match(script,/summaryLoading\(true\)/);
 assert.match(script,/summaryLoading\(false\)/);
 assert.match(script,/\.classList\.toggle\("pm-list-loading",value\)/);
});

test("Filesystem heading sits on the exact same row as Refresh, with no empty section offset",()=>{
 const view=index.slice(index.indexOf('data-view="colosseum/permissions"'),index.indexOf('data-view="colosseum/diagnostics"'));
 const first=view.indexOf('<section class="pm-section pm-rules-section" aria-labelledby="pm-rules-heading">');
 const summary=view.indexOf('id="pm-count"',first);
 const heading=view.indexOf('class="pm-section-header pm-first-section-header"',summary);
 const refresh=view.indexOf('id="pm-refresh"',heading);
 const toolbar=view.indexOf('class="pm-rule-toolbar"',refresh);
 assert.ok(first>=0&&summary>first&&heading>summary&&refresh>heading&&toolbar>refresh);
 assert.equal((view.match(/id="pm-rules-heading"/g)||[]).length,1);
 assert.match(styles,/#pm-root \.pm-first-section-header\{grid-column:1;grid-row:2;align-self:start;min-width:0;margin:0\}/);
 assert.match(styles,/#pm-root \.pm-overview-right\{grid-column:2;grid-row:2;align-self:start/);
 assert.match(styles,/#pm-root \.pm-section\.pm-rules-section\{margin-top:0\}/);
 assert.match(styles,/grid-template-rows:var\(--workspace-summary-row-height\) minmax\(var\(--workspace-control-size\),auto\)/);
 assert.match(styles,/#pm-root \.pm-rule-toolbar\{display:flex;align-items:center;gap:9px;margin:15px 0 10px\}/);
});

test("Optional device unlock uses platform WebAuthn PRF encryption; gateway PIN remains mandatory",async()=>{
 const vault=await fs.readFile(new URL("../sites/_apex/app/assets/permissions-device-unlock.js",import.meta.url),"utf8");
 const view=index.slice(index.indexOf('data-view="colosseum/permissions"'),index.indexOf('data-view="colosseum/diagnostics"'));
 assert.match(view,/id="pm-device-enroll"/);
 assert.match(view,/id="pm-device-remove"/);
 assert.match(view,/id="pm-confirm-device"/);
 assert.match(view,/id="pm-confirm-pin"/);
 assert.match(script,/from "\.\/permissions-device-unlock\.js"/);
 assert.match(script,/await enrollDeviceUnlock\(pin\)/);
 assert.match(script,/const pin=await unlockDevicePIN\(\)/);
 assert.match(script,/await applyPending\(pin\)/);
 assert.match(script,/await clearDeviceUnlock\(\)\.catch/);
 assert.match(script,/request\("confirm",\{token:pending\.token,pin\}\)/);
 assert.match(vault,/navigator\.credentials\.create/);
 assert.match(vault,/navigator\.credentials\.get/);
 assert.match(vault,/authenticatorAttachment:"platform"/);
 assert.match(vault,/userVerification:"required"/);
 assert.match(vault,/extensions:\{prf:/);
 assert.match(vault,/auth\[32\]&0x04/);
 assert.match(vault,/crypto\.subtle\.encrypt\(\{name:"AES-GCM"/);
 assert.match(vault,/crypto\.subtle\.decrypt\(\{name:"AES-GCM"/);
 assert.match(vault,/indexedDB\.open/);
 assert.ok(!vault.includes("localStorage"));
 assert.ok(!vault.includes("sessionStorage"));
 assert.ok(!vault.includes("fetch("));
 assert.ok(!vault.includes("pin,ENTRY"));
 assert.match(router,/return colosseumCatalogForward\(request,env,"permissions\.manage"\)/);
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
