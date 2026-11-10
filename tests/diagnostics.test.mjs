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
    for(const id of ["dg-refresh","dg-run","dg-check","dg-depth","dg-localtime","dg-utctime","dg-quotas","dg-workers","dg-local"])
      assert.ok(html.includes('id="'+id+'"'),path+" missing "+id);
    assert.match(html,/\/app\/assets\/diagnostics\.css/);
  }
  const css=await read("../sites/_apex/app/assets/diagnostics.css");
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/data-view="colosseum\/diagnostics"/);
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
  assert.match(script,/previewClocks/);
});