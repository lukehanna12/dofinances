import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {portalUrl,parseProviderHealth,initColosseumProviders}
  from "../sites/_apex/app/assets/providers.js";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("provider inspector honors Features4 selector/detail structure without autoplay",async()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=await read(path);
    const i=html.indexOf('data-view="colosseum/providers"');
    const next=html.indexOf('data-view="colosseum/permissions"',i);
    assert.ok(i>0&&next>i);
    const fragment=html.slice(i,next);
    assert.match(fragment,/<div class="page-heading"><h1 id="project-providers-title">Providers<\/h1><\/div>/,
      "Providers title retains the existing native alignment");
    assert.ok(fragment.includes('id="pv-root"'));
    for(const id of ["pv-federated-tab","pv-local-tab","pv-list","pv-detail","pv-search","pv-refresh","pv-status"])
      assert.ok(fragment.includes('id="'+id+'"'),"Missing "+id);
    assert.match(fragment,/role="tablist"/);
    assert.match(fragment,/role="tabpanel"/);
    assert.match(fragment,/https:\/\/router\.colosseum\.workers\.dev\/account\/connections/);
    assert.doesNotMatch(fragment,/Nothing here yet|This section is ready for future/);
    assert.ok(html.includes('/app/assets/providers.css'));
    assert.doesNotMatch(fragment,/type="password"|name="token"/,
      "No provider secrets or credential collection in DoFinances");
  }
  const css=await read("../sites/_apex/app/assets/providers.css");
  assert.match(css,/grid-template-columns:minmax\(260px,4fr\) minmax\(0,8fr\)/);
  assert.match(css,/@keyframes pv-panel-enter/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/animation-iteration-count:infinite|animation-name:marquee/i);
  const js=await read("../sites/_apex/app/assets/providers.js");
  assert.match(js,/initColosseumProviders/);
  assert.match(js,/credentials:"same-origin"/);
  assert.match(js,/sections:\["local"\],check:"providers",depth:"standard"/);
  assert.match(js,/\/api\/colosseum\/status/);
  assert.match(js,/\/api\/colosseum\/diagnostics/);
  assert.doesNotMatch(js,/localStorage\.setItem|setInterval\(|Math\.random|sampleData|demoData/);
  assert.equal(typeof initColosseumProviders,"function");
  const dashboard=await read("../sites/_apex/app/assets/dashboard.js");
  assert.match(dashboard,/initColosseumProviders\(\)/);
  const workflow=await read("../.github/workflows/site.yml");
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/providers\.css dist\/app\/assets\/providers\.css/);
  assert.doesNotMatch(workflow,/cp sites\/_apex\/app\/assets\/providers\.js dist\/app\/assets\/providers\.js/,
    "Public Studio should not copy private data client");
});
test("Penpot and cloud reader actions use the real owner-managed portal",()=>{
 assert.equal(portalUrl("000008","configure"),
   "https://router.colosseum.workers.dev/account/providers/configure?uid=000008");
 assert.equal(portalUrl("000008","tools"),
   "https://router.colosseum.workers.dev/account/providers/tools?uid=000008");
 assert.throws(()=>portalUrl("000008&x=1","tools"),/Invalid provider/);
 assert.throws(()=>portalUrl("000008","disconnect"),/Invalid provider/);
});
test("provider health parses real gateway check shape without overstating authorization",()=>{
 const revision="a".repeat(64);
 const report={name:"system.status",collected_at:"2026-11-10T23:00:00Z",
   sections:{local:{status:"healthy",timestamp:"2026-11-10T23:00:01Z",
     layers:[{layer:"providers",metrics:{provider_count:3},checks:[
      {name:"provider:penpot",status:"pass",detail:"4 tool(s); revision "+revision},
      {name:"provider:filesystem",status:"pass",detail:"14 tool(s); revision "+revision},
      {name:"provider:other",status:"warn",detail:"Unavailable"},
      {name:"provider:penpot",status:"pass",detail:"4 tool(s); revision "+revision},
      {name:"not-provider:something",status:"pass",detail:"no"}
     ]}]}}};
 const data=parseProviderHealth(report);
 assert.equal(data.providers.length,3);
 assert.equal(data.expected,3);
 assert.deepEqual(data.providers.map(p=>p.name),["Filesystem","Other","Penpot"]);
 assert.equal(data.providers[0].toolCount,14);
 assert.equal(data.providers[0].revision,revision);
 assert.equal(data.providers[1].status,"degraded");
 assert.equal(data.providers[1].toolCount,null);
 assert.equal(data.overall,"healthy");
 assert.throws(()=>parseProviderHealth({name:"system.status",sections:{}}),/not available/);
 assert.throws(()=>parseProviderHealth({name:"random",sections:{}}),/unexpected format/);
});
