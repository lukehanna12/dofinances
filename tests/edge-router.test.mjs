import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest,allowedHost} from "../edge/worker.mjs";
import {pages} from "../edge/pages.mjs";

test("temporary pages have been deleted",async()=>{
  assert.equal(Object.keys(pages).length,0);
  for(const route of ["/","/nested/hello?x=1","/missing"]){
    const response=await handleRequest(new Request("https://ci-probe.dofinances.com"+route));
    assert.equal(response.status,404,route);
  }
});
test("unknown and reserved hostnames remain unserved",async()=>{
  for(const host of ["unknown.dofinances.com","stu.dofinances.com","pay.dofinances.com","a.b.dofinances.com"]){
    const response=await handleRequest(new Request("https://"+host+"/"));
    assert.equal(response.status,404,host);
  }
});
test("apex and www fail closed if routed accidentally",async()=>{
  for(const host of ["dofinances.com","www.dofinances.com"]){
    const response=await handleRequest(new Request("https://"+host+"/"));
    assert.equal(response.status,503,host);
  }
  assert.equal(allowedHost("portfolio.dofinances.com"),true);
});
