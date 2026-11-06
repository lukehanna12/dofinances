import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

test("React + Vite starter has its required entry points", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts.build, "vite build");
  assert.ok(pkg.dependencies.react);
  assert.ok(pkg.dependencies["react-dom"]);
  await stat(new URL("../index.html", import.meta.url));
  await stat(new URL("../src/App.jsx", import.meta.url));
  await stat(new URL("../src/main.jsx", import.meta.url));
});

test("CI deploys only when explicitly enabled", async () => {
  const yaml = await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8");
  assert.match(yaml, /vars\.DEPLOY_ENABLED\s*==\s*'true'/);
  assert.match(yaml, /cloudflare\/wrangler-action@v4/);
  assert.match(yaml, /--project-name=dofinances-studio/);
  assert.match(yaml, /vars\.WILDCARD_DEPLOY_ENABLED\s*==\s*'true'/);
  assert.match(yaml, /CLOUDFLARE_WORKERS_API_TOKEN/);
  assert.match(yaml, /deploy_wildcard/);
  assert.match(yaml, /vars\.WILDCARD_DEPLOY_ENABLED\s*==\s*'true'/);
  assert.match(yaml, /github\.ref\s*==\s*'refs\/heads\/main'/);
});
