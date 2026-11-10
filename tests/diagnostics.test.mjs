import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {handleRequest} from "../edge/router.mjs";

const read=async path=>readFile(new URL(path,import.meta.url),"utf8");

test("Diagnostics is a real navigation view with one screen shared by apex and Studio",async()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=await read(path);
    assert.match(html,/data-view="colosseum\/diagnostics"/);
    assert.match(html,/id="diagnostics-root"/);
    assert.doesNotMatch(html,/COLOSSEUM \/ OBSERVABILITY|Cloud consumption, runtime health, and your local gateway/,"Diagnostics intro must remain absent");
    assert.ok(html.includes('<section class="view project-view" data-view="colosseum/diagnostics" hidden aria-labelledby="project-diagnostics-title">\\n          <div class="page-heading"><h1 id="project-diagnostics-title">Diagnostics</h1></div>'.replace('\\n','\n')),
      "Diagnostics title must use the same shared heading position as other screens");
    const diagnostics=html.slice(html.indexOf('data-view="colosseum/diagnostics"'));
    assert.ok(diagnostics.indexOf('aria-labelledby="dg-query-title"')<diagnostics.indexOf('aria-labelledby="dg-overview-title"'),
      "Diagnostic query must be first");
    for(const removed of ["Platform configuration","Static asset libraries","Request controls","Management API","Report integrity","Live clocks ·","Source: Colosseum"])
      assert.ok(!diagnostics.includes(removed),"Diagnostics must not show "+removed);

    for(const id of ["dg-refresh","dg-run","dg-check","dg-depth","dg-quotas","dg-workers","dg-local","global-clock-time","global-clock-zone","clock-zone-select","clock-custom-zone"])
      assert.ok(html.includes('id="'+id+'"'),path+" missing "+id);
    assert.ok(html.includes('/app/assets/diagnostics.css'));
    assert.doesNotMatch(html, /class="global-brand"|class="global-brand-mark"/,"remove only uppermost DoFinances branding");
    assert.doesNotMatch(html,/data-dg-section value="(?:rate_limiting|static_assets|configuration|api_limits)"/);
    for(const zone of ["local","utc","central","custom"])
      assert.ok(html.includes('<option value="'+zone+'">'),"Missing clock preference "+zone);
  }
  const css=await read("../sites/_apex/app/assets/diagnostics.css");
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/font-weight:740;/,"no Diagnostics-specific override of the native page title");
  assert.match(css,/#diagnostics-root \.dg-header/);
});
test("Diagnostics initializes an on-demand, owner-gated system.status client",async()=>{
  const mod=await import("../sites/_apex/app/assets/diagnostics.js");
  assert.equal(typeof mod.initColosseumDiagnostics,"function");
  const js=await read("../sites/_apex/app/assets/diagnostics.js");
  const dashboard=await read("../sites/_apex/app/assets/dashboard.js");
  assert.match(dashboard,/initColosseumDiagnostics\(\)/);
  assert.match(js,/\/api\/colosseum\/diagnostics/);
  assert.match(js,/credentials:"same-origin"/);
  assert.match(js,/data-dg-section/);
  assert.doesNotMatch(js,/renderConfig|renderIntegrity|dg-localtime|dg-utcdate/);
  assert.match(js,/check:byId\("dg-check"\)\.value/);
  assert.match(js,/depth:byId\("dg-depth"\)\.value/);
  assert.doesNotMatch(js,/Math\.random\(|demoData|sampleData|mockData/);
});
const TOKEN="A".repeat(43);
const env={AUTH_STORE:{idFromName:()=>({}),get:()=>({session:async token=>token===TOKEN?{id:"owner-test",email:"test@example.invalid"}:null})}};
test("Diagnostics API remains fail-closed behind session, Origin, Cloudflare Access and owner linkage",async()=>{
  const url="https://dofinances.com/api/colosseum/diagnostics";
  const query=JSON.stringify({sections:["workers","local"],check:"gateway",depth:"quick"});
  const anon=await handleRequest(new Request(url,{method:"POST",headers:{"Origin":"https://dofinances.com","Content-Type":"application/json"},body:query}),env);
  assert.equal(anon.status,401);
  const wrongOrigin=await handleRequest(new Request(url,{method:"POST",headers:{"Cookie":"__Host-dofinances_session="+TOKEN,"Origin":"https://untrusted.invalid","Content-Type":"application/json"},body:query}),env);
  assert.equal(wrongOrigin.status,403);
  const missingAccess=await handleRequest(new Request(url,{method:"POST",headers:{"Cookie":"__Host-dofinances_session="+TOKEN,"Origin":"https://dofinances.com","Content-Type":"application/json"},body:query}),env);
  assert.equal(missingAccess.status,503);
  const get=await handleRequest(new Request(url,{method:"GET"}),env);
  assert.equal(get.status,405);
});
test("Studio cannot fetch private diagnostics or perform account operations",async()=>{
  const script=await read("../studio/sidebar/preview-bootstrap.js");
  assert.match(script,/This is a static layout preview/);
  assert.doesNotMatch(script,/fetch\(/);
  assert.doesNotMatch(script,/previewClocks|dg-utctime|dg-localtime/);
  assert.match(script,/single topbar clock/);
});
test("Global clock uses exactly one persisted, validated timezone selection",async()=>{
  const {initWorkspaceClock}=await import("../sites/_apex/app/assets/workspace-nav.js");
  const elements={};
  for(const name of ["global-clock","global-clock-time","global-clock-zone","clock-zone-select",
    "clock-custom-row","clock-custom-zone","clock-custom-apply","clock-settings-feedback"]){
    const events={},attrs={};
    elements[name]={events,attrs,dataset:{},value:"",hidden:false,textContent:"",title:"",
      addEventListener(type,fn){events[type]=fn;},
      setAttribute(key,value){attrs[key]=value;},removeAttribute(key){delete attrs[key];},
      focus(){}};
  }
  const stored=new Map(),events={};
  const win={localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    setInterval:()=>1,clearInterval(){},addEventListener:(type,fn)=>events[type]=fn};
  const doc={getElementById:id=>elements[id]||null};
  initWorkspaceClock(doc,win);
  const select=elements["clock-zone-select"],clock=elements["global-clock"],
    zone=elements["global-clock-zone"],custom=elements["clock-custom-zone"];
  assert.match(elements["global-clock-time"].textContent,/^\\d{2}:\\d{2}:\\d{2}$/);
  select.value="utc";select.events.change();
  assert.equal(zone.textContent,"UTC");
  select.value="central";select.events.change();
  assert.equal(clock.title.startsWith("America/Chicago"),true);
  select.value="custom";select.events.change();
  assert.equal(elements["clock-custom-row"].hidden,false);
  custom.value="Invalid/Timezone";elements["clock-custom-apply"].events.click();
  assert.equal(custom.attrs["aria-invalid"],"true");
  assert.equal(clock.title.startsWith("America/Chicago"),true,"invalid zones must not take effect");
  custom.value="Asia/Tokyo";elements["clock-custom-apply"].events.click();
  assert.equal(clock.title.startsWith("Asia/Tokyo"),true);
  assert.equal(JSON.parse(stored.get("dofinances.clock.timezone.v1")).mode,"custom");
  assert.equal(JSON.parse(stored.get("dofinances.clock.timezone.v1")).custom,"Asia/Tokyo");
  assert.equal(select.value,"custom");
});
