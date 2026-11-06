import test from "node:test";
import assert from "node:assert/strict";
import {readFile,stat} from "node:fs/promises";
test("React + Vite build is configured", async () => {
  const pkg=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
  assert.equal(pkg.scripts.build,"vite build");
  await stat(new URL("../index.html",import.meta.url));
  await stat(new URL("../src/App.jsx",import.meta.url));
});
test("both deployments run through gated GitHub Actions", async ()=>{
  const yaml=await readFile(new URL("../.github/workflows/site.yml",import.meta.url),"utf8");
  assert.match(yaml,/vars\.DEPLOY_ENABLED\s*==\s*'true'/);
  assert.match(yaml,/pages deploy dist --project-name=dofinances-studio/);
  assert.match(yaml,/deploy --config edge\/wrangler.jsonc/);
  assert.match(yaml,/cloudflare\/wrangler-action@v4/);
  assert.match(yaml,/needs: build/);
  assert.match(yaml,/name: Download built Studio for apex \/login/);
  assert.match(yaml,/name: Checkout Pages route handler/);
  assert.match(yaml,/name: Package the Studio preview at the apex \/login path/);
  assert.match(yaml,/https:\/\/stu\.dofinances\.com\/login/);
  assert.match(yaml,/https:\/\/dofinances\.com\/login/);
});
