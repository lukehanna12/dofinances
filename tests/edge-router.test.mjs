import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest,allowedHost} from "../edge/worker.mjs";

test("apex homepage is Git-managed", async () => {
  const response=await handleRequest(new Request("https://dofinances.com/"));
  assert.equal(response.status,200);
  assert.match(await response.text(),/The site is ready/);
});
test("homepage works under preview wildcard before cutover", async () => {
  const response=await handleRequest(new Request("https://preview-dofinances.dofinances.com/"));
  assert.equal(response.status,200);
  assert.match(await response.text(),/The site is ready/);
});
test("nested paths and query strings are supported by the registry", async () => {
  const response=await handleRequest(new Request("https://dofinances.com/__site_probe?x=1"));
  assert.equal(response.status,200);
  assert.equal(await response.text(),"dofinances-apex-ci-probe");
});
test("www defaults to apex but may have its own page entries",async()=>{
  const response=await handleRequest(new Request("https://www.dofinances.com/deep/path?x=1"));
  assert.equal(response.status,301);
  assert.equal(response.headers.get("location"),"https://dofinances.com/deep/path?x=1");
});
test("missing paths return 404", async () => {
  for (const host of ["dofinances.com","unknown.dofinances.com","preview-dofinances.dofinances.com"]) {
    assert.equal((await handleRequest(new Request("https://"+host+"/missing"))).status,404);
  }
});
test("reserved and deeper hosts are rejected", async () => {
  for(const host of ["stu.dofinances.com","pay.dofinances.com","x.y.dofinances.com","evil.com"]){
    assert.equal(allowedHost(host),false);
    assert.equal((await handleRequest(new Request("https://"+host+"/"))).status,404);
  }
});
test("POST blocked, HEAD content suppressed", async()=>{
  assert.equal((await handleRequest(new Request("https://dofinances.com/",{method:"POST"}))).status,405);
  const head=await handleRequest(new Request("https://dofinances.com/",{method:"HEAD"}));
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
});
