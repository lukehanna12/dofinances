import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseProviderHealth,initColosseumProviders}
  from "../sites/_apex/app/assets/providers.js";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("Providers has three independent, real routes with compact shared controls",async()=>{
 const html=await read("../sites/_apex/app/index.html");
 for(const [key,title] of [["local","Local"],["external","External"],["credentials","Credentials"]]){
  const route='colosseum/providers/'+key;
  assert.match(html,new RegExp('data-view="'+route+'"'));
  assert.match(html,new RegExp('<h1 id="project-providers-'+key+'-title">'+title+'</h1>'));
  assert.ok(html.includes('href="#'+route+'"'));
 }
 const fragment=html.slice(html.indexOf('data-view="colosseum/providers/local"'),
   html.indexOf('data-view="colosseum/permissions"'));
 for(const id of ["pv-root","pv-list","pv-detail","pv-search","pv-refresh","pv-status",
  "pv-summary","pv-external-mount","pv-credentials-mount"])
  assert.ok(fragment.includes('id="'+id+'"'),"Missing "+id);
 assert.doesNotMatch(fragment,/pv-federated-tab|pv-local-tab|pv-portal-link/);
 assert.doesNotMatch(fragment,/router\.colosseum\.workers\.dev\/account\/providers/);
 assert.doesNotMatch(fragment,/Nothing here yet|This section is ready for future/);
 assert.doesNotMatch(fragment,/type="password"|name="token"/);
 const studio=await read("../studio/sidebar/index.html");
 assert.ok(studio.includes('data-view="colosseum/providers"'),
   "The independent Studio reference should be left unchanged");
 const css=await read("../sites/_apex/app/assets/providers.css");
 assert.match(css,/grid-template-columns:minmax\(260px,\.86fr\) minmax\(0,1\.4fr\)/);
 assert.match(css,/@keyframes pv-spin/);
 assert.match(css,/\.pv-provider-item\{[^}]*min-height:54px/);
 assert.match(css,/\.pv-provider-subnav/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/animation-iteration-count:infinite|animation-name:marquee/i);
 const js=await read("../sites/_apex/app/assets/providers.js");
 assert.match(js,/initColosseumProviders/);
 assert.match(js,/credentials:"same-origin"/);
 assert.match(js,/\/api\/colosseum\/providers/);
 for(const capability of ["oauth_start","local.prepare","local.commit","configure","grant","revoke","disconnect","refresh","verify"])
  assert.ok(js.includes(capability),"Missing real provider action "+capability);
 assert.match(js,/revision-bound change|expected_revision/);
 assert.match(js,/actual\.profile/);
 assert.match(js,/const routeMode=\(\)=>/);
 assert.match(js,/state\.mode==="credentials"&&d\.kind!=="builtin"/);
 assert.match(js,/mountLocalProviderProvisions/);
 assert.match(js,/state\.expandedLocal/);
 assert.doesNotMatch(js,/localStorage\.setItem|setInterval\(|Math\.random|sampleData|demoData/);
 assert.equal(typeof initColosseumProviders,"function");
 const dashboard=await read("../sites/_apex/app/assets/dashboard.js");
 assert.match(dashboard,/initColosseumProviders\(\)/);
 const workflow=await read("../.github/workflows/site.yml");
 assert.match(workflow,/cp sites\/_apex\/app\/assets\/providers\.css dist\/app\/assets\/providers\.css/);
 assert.doesNotMatch(workflow,/cp sites\/_apex\/app\/assets\/providers\.js dist\/app\/assets\/providers\.js/);
});
test("Providers routes keep credential mutations in the secure vault and tool grants on External",async()=>{
 const js=await read("../sites/_apex/app/assets/providers.js");
 const router=await read("../edge/router.mjs");
 const html=await read("../sites/_apex/app/index.html");
 assert.match(js,/if\(state\.mode==="credentials"\)\{/);
 assert.match(js,/if\(state\.mode==="credentials"&&d\.kind!=="builtin"\)/);
 assert.match(js,/routeLink\("Manage credentials","credentials",d\.uid\)/);
 assert.match(js,/routeLink\("View tool permissions","federated",d\.uid\)/);
 assert.match(js,/Each approval changes the actual Colosseum invocation grant/);
 assert.match(js,/request\(\{action:"local\.commit",receipt/);
 assert.match(js,/state\.localRevision/);
 assert.match(html,/id="providers-subnavigation"/);
 assert.match(router,/#colosseum\/providers\/credentials/);
 assert.match(js,/aria-busy/);
 assert.match(js,/event\.ctrlKey/);
 assert.match(js,/event\.shiftKey/);
});
test("Providers child navigation is text-only while the parent retains its icon",async()=>{
 const html=await read("../sites/_apex/app/index.html");
 const css=await read("../sites/_apex/app/assets/providers.css");
 const begin=html.indexOf('id="providers-subnavigation"');
 const end=html.indexOf('</div>',begin);
 assert.ok(begin>=0&&end>begin);
 const subnav=html.slice(begin,end);
 for(const child of ["local","external","credentials"]){
  assert.match(subnav,new RegExp('data-route="providers/'+child+'"'));
  assert.match(subnav,new RegExp('href="#colosseum/providers/'+child+'"'));
 }
 assert.doesNotMatch(subnav,/<svg|pv-subnav-glyph|nav-icon/);
 assert.match(html,/data-providers-toggle[^>]*>\s*<span class="nav-icon nav-icon-asset nav-icon-asset--providers"/);
 assert.match(css,/#project-navigation \.pv-provider-child\{[^}]*padding:7px 10px 7px 19px;gap:0/);
 assert.doesNotMatch(css,/pv-subnav-glyph/);
});

test("Public Studio retains its original two-pane Providers geometry alongside private child screens",async()=>{
 const studio=await read("../studio/sidebar/index.html");
 const production=await read("../sites/_apex/app/index.html");
 const css=await read("../sites/_apex/app/assets/providers.css");
 assert.match(studio,/data-view="colosseum\/providers"/);
 assert.match(studio,/class="pv-index"/);
 assert.match(studio,/class="pv-inspector"/);
 assert.match(css,/\.view\[data-view="colosseum\/providers"\] #pv-root \.pv-browser\{display:grid;grid-template-columns:minmax\(260px,4fr\) minmax\(0,8fr\)/);
 assert.match(css,/\.view\[data-view="colosseum\/providers"\] #pv-root \.pv-index/);
 assert.match(css,/@media\(max-width:860px\)/);
 assert.match(production,/data-view="colosseum\/providers\/local"/);
 assert.doesNotMatch(production,/data-view="colosseum\/providers" hidden/);
});

test("Provider management is single-origin, double-authorized and never stores credentials in the browser",async()=>{
 const router=await read("../edge/router.mjs");
 assert.match(router,/pathname==="\/api\/colosseum\/providers"/);
 assert.match(router,/pathname==="\/api\/colosseum\/providers\/callback"/);
 assert.match(router,/colosseumOwnerStatus\(argument\)/);
 assert.match(router,/verifyColosseumOwnerJwt/);
 assert.match(router,/Cross-site provider management request denied/);
 assert.match(router,/"provider\.admin"/);
 const ui=await read("../sites/_apex/app/assets/providers.js");
 assert.doesNotMatch(ui,/localStorage\.setItem|sessionStorage\.setItem|document\.cookie/);
 assert.match(ui,/confirm\(/);
 assert.match(ui,/actual\.profile/);
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
