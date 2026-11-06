import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest,allowedHost} from "../edge/worker.mjs";
test("declared root and nested wildcard pages",async()=>{
  for(const [path,title] of [["/","Wildcard CI probe"],["/nested/hello?x=1","Nested route works"]]){
    const r=await handleRequest(new Request("https://ci-probe.dofinances.com"+path));
    assert.equal(r.status,200);
    assert.match(await r.text(),new RegExp(title));
  }
});
test("missing pages, reserved and deeper hostname paths are 404",async()=>{
  for(const url of ["https://ci-probe.dofinances.com/deleted","https://unknown.dofinances.com/a/b","https://stu.dofinances.com/","https://pay.dofinances.com/","https://a.b.dofinances.com/"]){
    assert.equal((await handleRequest(new Request(url))).status,404,url);
  }
});
test("GoDaddy homepage remains origin by default and www retains redirect",async()=>{
  let n=0;
  const r=await handleRequest(new Request("https://dofinances.com/x"),(req,opts)=>{n++;assert.equal(req.url,"https://dofinances.com/x");assert.equal(opts.cf.resolveOverride,"gd-origin.dofinances.com");return new Response("origin ok",{status:200})});
  assert.equal(r.status,200);assert.equal(n,1);
  const w=await handleRequest(new Request("https://www.dofinances.com/a?b=1"));
  assert.equal(w.status,301);assert.equal(w.headers.get("location"),"https://dofinances.com/a?b=1");
  assert.equal(allowedHost("portfolio.dofinances.com"),true);
});
