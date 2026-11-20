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
    assert.ok(diagnostics.includes('aria-labelledby="dg-local-title"'),"Local measurements remain");
    for(const retired of ['Query options','id="dg-query"','id="dg-run"','id="dg-check"','id="dg-depth"','data-dg-section'])
      assert.ok(!diagnostics.includes(retired),"Query options UI must be removed: "+retired);
    for(const removed of ["Platform configuration","Static asset libraries","Request controls","Management API","Report integrity","Live clocks ·","Source: Colosseum"])
      assert.ok(!diagnostics.includes(removed),"Diagnostics must not show "+removed);

    for(const id of ["dg-refresh","dg-quotas","dg-workers","dg-local","global-clock-time","global-clock-seconds","global-clock-zone","clock-zone-select","clock-custom-zone"])
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
test("Quota overview uses circular gauges beside true percentages, never treating unavailable values as zero",async()=>{
 const js=await read("../sites/_apex/app/assets/diagnostics.js");
 const css=await read("../sites/_apex/app/assets/diagnostics.css");
 assert.match(css,/\.dg-card-ring\{[^\n]*conic-gradient/);
 assert.match(css,/\.dg-card-ring\.is-unknown\{[^\n]*border:2px dashed/);
 assert.match(css,/\.dg-card-reading\{[^\n]*display:flex/);
 assert.match(js,/ring\.setAttribute\("aria-hidden","true"\)/);
 assert.match(js,/ring\.style\.setProperty\("--dg-ring-percent",String\(Math\.min\(100,pct\)\)\)/);
 const renderer=js.slice(js.indexOf("function metricCard("),js.indexOf("function sectionOf("));
 assert.doesNotMatch(renderer,/progress\(q\)/,"Overview rings replace top-card bars, not detailed quota bars");
 const {runInNewContext}=await import("node:vm");
 const makeElement=tag=>({
  tag,children:[],dataset:{},classList:{values:new Set(),add(k){this.values.add(k);}},
  attributes:{},style:{values:{},setProperty(key,value){this.values[key]=value;}},
  append(...children){this.children.push(...children);},
  setAttribute(key,value){this.attributes[key]=value;}
 });
 const document={createElement:makeElement};
 const source=js.replace("export function initColosseumDiagnostics","function initColosseumDiagnostics");
 const metricCard=runInNewContext(source+"\nmetricCard",{document,Intl});
 for(const [q,expectedLevel,expectedPct,expectedText] of [
  [{used:25,limit:100},"normal","25","25%"],
  [{used:91,limit:100},"critical","91","91%"],
  [{used:120,limit:100},"critical","100","120%"],
  [null,"unknown",undefined,"—"]
 ]){
  const card=metricCard("Test quota",q);
  assert.equal(card.dataset.level,expectedLevel);
  const reading=card.children[1],ring=reading.children[0],number=reading.children[1];
  assert.equal(ring.attributes["aria-hidden"],"true");
  assert.equal(ring.style.values["--dg-ring-percent"],expectedPct);
  assert.equal(ring.style.values["--dg-ring-target"],expectedPct);
  assert.equal(number.textContent,expectedText);
  if(q===null)assert.ok(ring.classList.values.has("is-unknown"));
 }
});

test("Mac diagnostics combines storage and native battery into one responsive panel",async()=>{
 const js=await read("../sites/_apex/app/assets/diagnostics.js");
 const css=await read("../sites/_apex/app/assets/diagnostics.css");
 const local=js.slice(js.indexOf("function renderLocal(report){"),js.indexOf(" const gateway=panel(",js.indexOf("function renderLocal(report){")));
 assert.match(local,/const mac=panel\("Mac"\)/);
 assert.doesNotMatch(local,/panel\("Mac · battery"|panel\("Mac · storage"/);
 assert.match(local,/summary\.append\(storageReading,batteryGraphic\(m\)\.glyph\)/);
 assert.match(local,/mac\.append\(summary\)/);
 assert.match(local,/host\.append\(mac\)/);
 assert.match(css,/\.dg-storage-panel\{grid-column:1\/-1\}/);
 assert.match(css,/\.dg-mac-summary\{display:flex;align-items:center;justify-content:space-between/);
 assert.match(css,/\.dg-battery-graphic\{[^\n]*flex:0 0 84px;width:84px/);
 assert.match(css,/\.dg-battery-number\{[^\n]*font-size:20px/);
 assert.match(css,/\.dg-battery-bolt-symbol\{[^\n]*width:16px;height:26px/);
 assert.doesNotMatch(css,/\.dg-battery-layout/);
});

test("Native Apple battery assets keep their original CoreSVG geometry and semantic colors",async()=>{
 const base="../sites/_apex/app/assets/battery/";
 const originalNames=["0percent","25percent","50percent","75percent","100percent","100percent.bolt"];
 const originals=await Promise.all(originalNames.map(n=>read(base+"battery."+n+".svg")));
 for(const svg of originals){
  assert.match(svg,/Apple Native CoreSVG 341/);
  assert.match(svg,/viewBox="0 0 35\.9904 (?:16\.024|20\.0588)"/);
 }
 for(const n of [25,50,75,100]){
  const source=originals[n/25];
  const expected=[...source.matchAll(/<path d="([^"]+)" fill="white" fill-opacity="0\.85"\/>/g)][1]?.[1];
  const fill=await read(base+"battery.fill."+n+"percent.svg");
  assert.ok(expected&&fill.includes('d="'+expected+'"'),"native silhouette changed at "+n+"%");
 }
 const bolt=[...originals[5].matchAll(/<path d="([^"]+)" fill="white" fill-opacity="0\.85"\/>/g)][2]?.[1];
 const symbol=await read(base+"battery.bolt.symbol.svg");
 assert.ok(bolt&&symbol.includes('d="'+bolt+'"'));
 const css=await read("../sites/_apex/app/assets/diagnostics.css");
 const js=await read("../sites/_apex/app/assets/diagnostics.js");
 for(const hex of ["#30d158","#ffd600","#ff4245"])assert.ok(css.includes(hex));
 assert.match(css,/battery\.0percent\.svg/);
 assert.match(css,/battery\.bolt\.symbol\.svg/);
 assert.match(css,/battery\.fill\.100percent\.svg/);
 assert.match(js,/batteryGraphic\(m\)/);
 assert.ok(js.includes('glyph.append(make("strong","dg-battery-number",pct===null?"--":quantity(pct,0)));'),
  "Battery graphic must show digits without a percent sign");
 assert.ok(js.includes('"Battery "+quantity(pct,0)+"%"'),
  "Accessible battery label must still identify the charge as a percentage");
 assert.doesNotMatch(js,/Charge level, not battery health or maximum capacity/);
 assert.doesNotMatch(js,/\["Power source",m\.battery_power_source/);
 assert.doesNotMatch(js,/\["Charging",m\.battery_charging/);
 assert.doesNotMatch(js,/visual\.charging\?"Charging"/);
 assert.match(css,/--dg-panel-bg:#111/);
 assert.match(css,/-webkit-text-stroke:2px var\(--dg-panel-bg\)/);
 assert.match(css,/font-size:20px/);
 assert.match(css,/text-shadow:none/);
 assert.match(css,/\.dg-battery-bolt-symbol\{position:absolute;z-index:1/);
 assert.match(css,/\.dg-battery-number\{position:absolute;z-index:2/);
 assert.match(js,/if\(charging\)glyph\.append\(make\("span","dg-battery-bolt-symbol"\)\)/);
 assert.ok(js.indexOf('if(charging)glyph.append(make("span","dg-battery-bolt-symbol"))')<
           js.indexOf('glyph.append(make("strong","dg-battery-number"'),"Bolt must be behind numerical charge");
});

test("Diagnostics initializes an on-demand, owner-gated system.status client",async()=>{
  const mod=await import("../sites/_apex/app/assets/diagnostics.js");
  assert.equal(typeof mod.initColosseumDiagnostics,"function");
  const js=await read("../sites/_apex/app/assets/diagnostics.js");
  const dashboard=await read("../sites/_apex/app/assets/dashboard.js");
  assert.match(dashboard,/initColosseumDiagnostics\(\)/);
  assert.match(js,/\/api\/colosseum\/diagnostics/);
  assert.match(js,/credentials:"same-origin"/);
  assert.doesNotMatch(js,/data-dg-section|optionsFromForm|optionsLabel|dg-query|dg-run|dg-check|dg-depth/);
  assert.doesNotMatch(js,/renderConfig|renderIntegrity|dg-localtime|dg-utcdate/);
  assert.match(js,/DEFAULT_DIAGNOSTICS_OPTIONS=Object.freeze/);
  assert.match(js,/sections:\["workers","kv","d1","durable_objects","local"\]/);
  assert.match(js,/check:"gateway",depth:"quick"/);
  assert.match(js,/body:JSON.stringify\(DEFAULT_DIAGNOSTICS_OPTIONS\)/);
  assert.match(js,/refresh.addEventListener\("click",\(\)=>void collect\(\)\)/);
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
  for(const name of ["global-clock","global-clock-time","global-clock-seconds","global-clock-zone","clock-zone-select",
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
  assert.match(elements["global-clock-time"].textContent,/^(?:\d|1\d|2[0-3]):[0-5]\d$/);
  assert.match(elements["global-clock-seconds"].textContent,/^[0-5]\d$/);
  assert.ok(!elements["global-clock-time"].textContent.endsWith(":"),
    "No colon may separate minutes from the seconds span");
  const rendered=elements["global-clock-time"].textContent+":"+
    elements["global-clock-seconds"].textContent;
  assert.match(rendered,/^(?:\d|1\d|2[0-3]):[0-5]\d:[0-5]\d$/,
    "The split display must preserve the full 24-hour clock");
  select.value="utc";select.events.change();
  assert.equal(zone.textContent,"UTC");
  assert.match(elements["global-clock-seconds"].textContent,/^[0-5]\d$/);
  select.value="central";select.events.change();
  assert.equal(clock.attrs["aria-label"].startsWith("America/Chicago"),true);
  select.value="custom";select.events.change();
  assert.equal(elements["clock-custom-row"].hidden,false);
  custom.value="Invalid/Timezone";elements["clock-custom-apply"].events.click();
  assert.equal(custom.attrs["aria-invalid"],"true");
  assert.equal(clock.attrs["aria-label"].startsWith("America/Chicago"),true,"invalid zones must not take effect");
  custom.value="Asia/Tokyo";elements["clock-custom-apply"].events.click();
  assert.equal(clock.attrs["aria-label"].startsWith("Asia/Tokyo"),true);
  assert.equal(JSON.parse(stored.get("dofinances.clock.timezone.v1")).mode,"custom");
  assert.equal(JSON.parse(stored.get("dofinances.clock.timezone.v1")).custom,"Asia/Tokyo");
  assert.equal(select.value,"custom");
  assert.equal(clock.attrs.title,undefined,"clock must not introduce a native tooltip");
});

test("Shared workspace clock never zero-pads a 24-hour hour, including at midnight",async()=>{
 const {formatWorkspaceTime}=await import("../sites/_apex/app/assets/workspace-nav.js");
 const at=(hour,minute=5,second=9)=>new Date(Date.UTC(2026,10,11,hour,minute,second));
 assert.equal(formatWorkspaceTime(at(0),{timeZone:"UTC",seconds:true}),"0:05:09");
 assert.equal(formatWorkspaceTime(at(1),{timeZone:"UTC",seconds:true}),"1:05:09");
 assert.equal(formatWorkspaceTime(at(9),{timeZone:"UTC",seconds:true}),"9:05:09");
 assert.equal(formatWorkspaceTime(at(10),{timeZone:"UTC",seconds:true}),"10:05:09");
 assert.equal(formatWorkspaceTime(at(13),{timeZone:"UTC",seconds:true}),"13:05:09");
 assert.equal(formatWorkspaceTime(at(23),{timeZone:"UTC",seconds:true}),"23:05:09");
 // Still honors alternate selected zones without inserting a padded hour.
 assert.equal(formatWorkspaceTime(at(0),{timeZone:"America/Chicago",seconds:true}),"18:05:09");
 assert.equal(formatWorkspaceTime(at(0),{timeZone:"Asia/Tokyo",seconds:true}),"9:05:09");
 const navigation=await read("../sites/_apex/app/assets/workspace-nav.js");
 assert.ok(navigation.includes('time.textContent=String(Number(part("hour")))+":"+part("minute");'),
   "Clock paints unpadded hours and zero-padded minutes for the selected zone");
 assert.ok(navigation.includes('hourCycle:display.hour12?"h12":"h23"'),
   "Clock respects the selected 24-hour or Standard format");
 assert.ok(navigation.includes('formatWorkspaceTime(now,{timeZone:"UTC"})'),
   "Clock retains UTC fallback for invalid or unavailable time zones");
});
