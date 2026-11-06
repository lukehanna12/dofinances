import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../edge/worker.mjs";

test("wildcard host keeps arbitrary path and query", async () => {
  let called = 0;
  const request = new Request("https://portfolio.dofinances.com/ledger/a/b?sort=up");
  const response = await handleRequest(request, async forwarded => {
    called++;
    assert.equal(forwarded.url, "https://dofinances-studio.pages.dev/ledger/a/b?sort=up");
    return new Response("ok", { status: 200 });
  });
  assert.equal(called, 1);
  assert.equal(await response.text(), "ok");
});

test("rejects unrelated hosts without invoking upstream", async () => {
  for (const host of ["dofinances.com", "attacker.com", "evildofinances.com"]) {
    const response = await handleRequest(
      new Request("https://" + host + "/hello"),
      () => { throw Error("Should not fetch"); },
    );
    assert.equal(response.status, 404, host);
  }
});

test("rewrites absolute Pages redirects onto incoming subdomain", async () => {
  const response = await handleRequest(
    new Request("https://studio.dofinances.com/old"),
    async () => new Response(null, { status: 302, headers: { Location: "https://dofinances-studio.pages.dev/new" } }),
  );
  assert.equal(response.headers.get("location"), "https://studio.dofinances.com/new");
});
