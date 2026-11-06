import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assetCandidates, handleRequest} from "../edge/worker.mjs";

const root = new URL("../sites/_apex/login/", import.meta.url);

test("apex /login is served from the nested login page, independently of Studio", () => {
  assert.deepEqual(assetCandidates("_apex", "/login"),
    ["/_apex/login", "/_apex/login.html", "/_apex/login/index.html"]);
  assert.deepEqual(assetCandidates("_apex", "/login/"), ["/_apex/login/index.html"]);
  assert.deepEqual(assetCandidates("_apex", "/login/assets/auth3.css"),
    ["/_apex/login/assets/auth3.css"]);
});

test("login HTML refers to scoped local assets, not remote JavaScript", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("assets/auth3.css", root), "utf8");
  const script = await readFile(new URL("assets/auth3.js", root), "utf8");

  assert.match(html, /<title>Sign in · Dofinances<\/title>/);
  assert.match(html, /href="\/login\/assets\/auth3\.css"/);
  assert.match(html, /src="\/login\/assets\/auth3\.js"/);
  assert.match(html, /Sign in with (Google|Apple|GitHub)/);
  assert.match(html, /Sign-in unavailable/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<script[^>]*https?:/i);
  assert.match(html, /Content-Security-Policy/);
  assert.match(css, /auth3-enter-left/);
  assert.match(css, /images\.unsplash\.com\/photo-1709562493281-03c47edcb046/);
  assert.match(script, /reportValidity/);
  assert.doesNotMatch(script, /fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|console\.log/);
});

test("router resolves /login and its assets without changing existing routing", async () => {
  const files = new Map([
    ["/_apex/login/index.html", "<h1>Sign in</h1>"],
    ["/_apex/login/assets/auth3.css", ".auth3{display:flex}"],
    ["/_apex/login/assets/auth3.js", "/* static */"],
  ]);
  const env = {ASSETS: {fetch: async request => {
    const path = new URL(request.url).pathname;
    return files.has(path)
      ? new Response(files.get(path), {status:200,headers:{"Content-Type": path.endsWith(".html")?"text/html":"text/plain"}})
      : new Response("not found", {status:404});
  }}};

  for (const url of [
    "https://dofinances.com/login",
    "https://dofinances.com/login/",
    "https://dofinances.com/login/assets/auth3.css",
    "https://dofinances.com/login/assets/auth3.js",
  ]) {
    const response = await handleRequest(new Request(url), env);
    assert.equal(response.status, 200, url);
  }
  const www = await handleRequest(new Request("https://www.dofinances.com/login"), env);
  assert.equal(www.status, 301);
  assert.equal(www.headers.get("location"), "https://dofinances.com/login");
});
