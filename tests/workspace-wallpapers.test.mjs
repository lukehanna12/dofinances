import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORKSPACE_WALLPAPERS,workspaceWallpaperForRoute} from "../sites/_apex/app/assets/workspace-wallpapers.js";

test("nine app routes select eight distinct SHA-addressed wallpapers",()=>{
  const routes=["home","projects","settings","colosseum/utilities","colosseum/collections","colosseum/providers","colosseum/permissions","colosseum/diagnostics","colosseum/settings"];
  const images=routes.map(route=>workspaceWallpaperForRoute(route));
  assert.equal(new Set(images.map(image=>image.sha)).size,8);
  assert.strictEqual(images[2],images[8]);
  for(const {sha,ext,position} of images){
    assert.match(sha,/^[a-f0-9]{64}$/);
    assert.match(ext,/^(jpg|png|webp|avif)$/);
    assert.match(position,/^center [0-9]+%$/);
  }
  assert.equal(Object.keys(WORKSPACE_WALLPAPERS).length,8);
});
test("wallpaper geometry derives both the image and spacer from header height",()=>{
  const css=readFileSync(new URL("../sites/_apex/app/assets/workspace-wallpapers.css",import.meta.url),"utf8");
  assert.match(css,/height:calc\(var\(--workspace-header-height\) \* 3\)/);
  assert.match(css,/padding-top:calc\(var\(--workspace-header-height\) \* 2 \+ var\(--workspace-content-leading\)\)/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
});
test("Worker proxies only the selected wallpaper paths via library-iii",()=>{
  const router=readFileSync(new URL("../edge/router.mjs",import.meta.url),"utf8");
  const wrangler=JSON.parse(readFileSync(new URL("../edge/wrangler.jsonc",import.meta.url),"utf8"));
  assert.deepEqual(wrangler.services,[{binding:"LIBRARY_III",service:"library-iii"}]);
  assert.match(router,/WALLPAPER_ALLOWLIST\.get\(key\)/);
  assert.match(router,/library-iii\.internal\/objects\//);
});
