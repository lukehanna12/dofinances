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

test("auth backend uses SQLite Durable Objects without any D1 binding",async()=>{
  const config=JSON.parse(await readFile(new URL("../edge/wrangler.jsonc",import.meta.url),"utf8"));
  assert.equal(config.durable_objects.bindings[0].name,"AUTH_STORE");
  assert.equal(config.keep_vars,true,"Wrangler must preserve externally configured OAuth client IDs");
  assert.equal(config.exports.AuthStore.storage,"sqlite");
  assert.equal(config.vars.AUTH_EMAIL_FROM,"noreply@dofinances.com");
  assert.doesNotMatch(JSON.stringify(config),/d1_databases|r2_buckets/);
  const router=await readFile(new URL("../edge/router.mjs",import.meta.url),"utf8");
  assert.match(router,/sessionCookie/);
  assert.match(router,/getUser/);
  assert.match(router,/redirect\("\/login"\)/);
});

test("email verification, password reset and MFA are isolated from D1",async()=>{
  const {stat}=await import("node:fs/promises");
  for(const path of ["../edge/auth-store-secure.mjs","../edge/auth-mfa.mjs","../edge/auth-mail.mjs",
    "../sites/_apex/verify/index.html","../sites/_apex/reset/index.html"]){
    await stat(new URL(path,import.meta.url));
  }
  const auth=await readFile(new URL("../edge/auth-store-secure.mjs",import.meta.url),"utf8");
  assert.match(auth,/mail_tokens/);
  assert.match(auth,/mfa_challenges/);
  assert.match(auth,/mfa_recovery/);
  assert.match(auth,/verifyFactor/);
  assert.doesNotMatch(auth,/\.D1\.|d1_databases/);
  const worker=await readFile(new URL("../edge/worker.mjs",import.meta.url),"utf8");
  assert.match(worker,/auth-store-federated/);
  const federation=await readFile(new URL("../edge/auth-store-federated.mjs",import.meta.url),"utf8");
  assert.match(federation,/auth-store-secure/);
  assert.match(federation,/UNIQUE\(provider,issuer,subject\)/);
  assert.doesNotMatch(federation,/\.D1\.|d1_databases/);
});
