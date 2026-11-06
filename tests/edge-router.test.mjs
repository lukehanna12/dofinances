import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assetCandidates, handleRequest, siteFolder} from "../edge/worker.mjs";

const mock = {
  ASSETS: {fetch:async request => {
    const path = new URL(request.url).pathname;
    const contents = {
      "/_apex/index.html":"<h1>Dofinances</h1>",
      "/_apex/login/index.html":"<h1>Sign in · Dofinances</h1>",
      "/_apex/assets/app-compiled.js":"compiled-preview",
      "/_apex/notes/2026/index.html":"<h1>Notes</h1>",
      "/_www/independent.html":"<h1>Independent www page</h1>",
      "/ci-probe/index.html":"<h1>Probe works</h1>",
      "/ci-probe/assets/status.txt":"probe-marker",
    };
    return Object.hasOwn(contents,path)
      ? new Response(contents[path],{status:200,headers:{"Content-Type":path.endsWith(".html")?"text/html":"text/plain"}})
      : new Response("missing",{status:404});
  }},
};
test("host classification keeps studio and service domains separate",()=>{
  assert.equal(siteFolder("dofinances.com"),"_apex");
  assert.equal(siteFolder("www.dofinances.com"),"_www");
  assert.equal(siteFolder("portfolio.dofinances.com"),"portfolio");
  for(const host of ["stu.dofinances.com","pay.dofinances.com","a.b.dofinances.com","evil.com"])
    assert.equal(siteFolder(host),null,host);
});
test("nested pages and static assets map to hostname-specific files",()=>{
  assert.deepEqual(assetCandidates("_apex","/"),["/_apex/index.html"]);
  assert.deepEqual(assetCandidates("_apex","/notes/2026"),["/_apex/notes/2026","/_apex/notes/2026.html","/_apex/notes/2026/index.html"]);
  assert.deepEqual(assetCandidates("portfolio","/assets/site.css"),["/portfolio/assets/site.css"]);
});
test("apex and wildcard pages use the assets binding",async()=>{
  for(const [url,text] of [
    ["https://dofinances.com/","Dofinances"],
    ["https://dofinances.com/notes/2026?sort=desc","Notes"],
    ["https://ci-probe.dofinances.com/","Probe works"],
    ["https://ci-probe.dofinances.com/assets/status.txt","probe-marker"],
  ]){
    const result=await handleRequest(new Request(url),mock);
    assert.equal(result.status,200,url);
    assert.match(await result.text(),new RegExp(text));
  }
});
test("apex /login resolves the built preview without changing hostname",async()=>{
  for(const path of ["/login","/login/"]){
    const response=await handleRequest(new Request("https://dofinances.com"+path),mock);
    assert.equal(response.status,200,path);
    assert.match(await response.text(),/Sign in · Dofinances/);
  }
  const asset=await handleRequest(new Request("https://dofinances.com/assets/app-compiled.js"),mock);
  assert.equal(asset.status,200);
  assert.equal(await asset.text(),"compiled-preview");
});
test("www can have independent files or redirect to apex",async()=>{
  const page=await handleRequest(new Request("https://www.dofinances.com/independent.html"),mock);
  assert.equal(page.status,200);
  const redirect=await handleRequest(new Request("https://www.dofinances.com/other?x=1"),mock);
  assert.equal(redirect.status,301);
  assert.equal(redirect.headers.get("location"),"https://dofinances.com/other?x=1");
});
test("deleted and unconfigured pages produce 404",async()=>{
  for(const url of ["https://dofinances.com/removed","https://portfolio.dofinances.com/","https://ci-probe.dofinances.com/removed"]){
    assert.equal((await handleRequest(new Request(url),mock)).status,404,url);
  }
});
test("HEAD and POST are handled safely",async()=>{
  const head=await handleRequest(new Request("https://dofinances.com/",{method:"HEAD"}),mock);
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
  assert.equal((await handleRequest(new Request("https://dofinances.com/",{method:"POST"}),mock)).status,405);
});
test("repository includes initial Git-owned homepage files",async()=>{
  const html=await readFile(new URL("../sites/_apex/index.html",import.meta.url),"utf8");
  assert.match(html,/Dofinances/);
});
