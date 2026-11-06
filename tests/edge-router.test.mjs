import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../edge/worker.mjs";

test("first-level wildcard preserves arbitrary nested paths, encoded characters and queries", async () => {
  const paths = ["/", "/ledger/a/b?sort=up&year=2027", "/anything/hello%20world?x=1", "/a/b/c/d"];
  for (const path of paths) {
    let n = 0;
    const req = new Request("https://portfolio.dofinances.com" + path, {headers: {Cookie:"session=secret",Authorization:"Bearer private"}});
    const result = await handleRequest(req, async forwarded => {
      n++;
      assert.equal(new URL(forwarded.url).pathname + new URL(forwarded.url).search, path);
      assert.equal(new URL(forwarded.url).hostname, "dofinances-studio.pages.dev");
      assert.equal(forwarded.headers.get("cookie"), null);
      assert.equal(forwarded.headers.get("authorization"), null);
      return new Response("ok", {status:200});
    });
    assert.equal(n, 1);
    assert.equal(await result.text(), "ok");
  }
});

test("never proxies apex, reserved hosts, unrelated domains or deeper labels", async () => {
  for (const host of [
    "dofinances.com", "www.dofinances.com", "stu.dofinances.com",
    "pay.dofinances.com", "em5386.dofinances.com",
    "something.stu.dofinances.com", "attacker.com", "evildofinances.com",
  ]) {
    const result = await handleRequest(new Request("https://" + host + "/some/path"), () => {
      throw Error("must never forward " + host);
    });
    assert.equal(result.status, 404, host);
  }
});

test("non-GET methods cannot be forwarded", async () => {
  const result=await handleRequest(new Request("https://alpha.dofinances.com/send",{method:"POST",body:"secret"}),()=>{throw Error("must not forward")});
  assert.equal(result.status,405);
});

test("Pages redirects to the same upstream are rewritten on first-level host", async () => {
  const result = await handleRequest(new Request("https://alpha.dofinances.com/old"), async () =>
    new Response(null, {status:302,headers:{Location:"https://dofinances-studio.pages.dev/new?x=1"}}));
  assert.equal(result.headers.get("location"),"https://alpha.dofinances.com/new?x=1");
});

test("external redirects remain unchanged", async () => {
  const result = await handleRequest(new Request("https://alpha.dofinances.com/old"), async () =>
    new Response(null, {status:302,headers:{Location:"https://example.org/new"}}));
  assert.equal(result.headers.get("location"),"https://example.org/new");
});
