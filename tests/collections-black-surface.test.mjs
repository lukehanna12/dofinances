import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";

const path=relative=>new URL("../"+relative,import.meta.url);
const read=relative=>readFileSync(path(relative),"utf8");

test("Collections restores the original black workspace canvas and its footer behavior",()=>{
  const css=read("sites/_apex/app/assets/collections.css");
  assert.match(css,/\.view\[data-view="colosseum\/collections"\]:not\(\[hidden\]\)\)\{\s*--ui-canvas:#0a0a0a;/);
  assert.ok(css.includes("background:var(--ui-canvas,#0a0a0a);"));
  assert.ok(css.includes("inset:var(--workspace-banner-height) 0 0;"));
  assert.ok(css.includes("--cs-bg:#0a0a0a"));
  assert.ok(css.includes("body:has(> #workspace-shell)::before"));
  assert.ok(css.includes("> .workspace-footer"));
  assert.doesNotMatch(css,/cs-top-webgpu-strip|cs-strip-top/);
});

test("Collections never mounts the removed WebGPU overlay",()=>{
  const js=read("sites/_apex/app/assets/dashboard.js");
  assert.ok(js.includes('initColosseumCollections();'));
  assert.ok(js.includes('initColosseumUtilities();'));
  assert.doesNotMatch(js,/initCollectionsWebGPUStrip|collections-webgpu-strip/);
});

test("Obsolete Collections strip shaders, harness, and CI wiring are absent",()=>{
  const removed=[
    "sites/_apex/app/assets/collections-webgpu-strip.js",
    "sites/_apex/app/assets/collections-webgpu-strip.wgsl",
    "sites/_apex/app/assets/collections-webgpu-mipmap.wgsl",
    "scripts/verify-collections-webgpu-strip-browser.mjs",
    "tests/collections-webgpu-strip.test.mjs"
  ];
  for(const relative of removed)assert.equal(existsSync(path(relative)),false,relative);
  const workflow=read(".github/workflows/site.yml");
  assert.doesNotMatch(workflow,/collections-webgpu-strip|Verify Collections Clear WebGPU strip/);
  assert.ok(workflow.includes("Verify flat Collections controls in Chromium"));
});

test("Unrelated Collections glass-control resources remain available",()=>{
  for(const relative of [
    "sites/_apex/app/assets/collections-glass.js",
    "sites/_apex/app/assets/collections-glass-public-clear.js",
    "sites/_apex/app/assets/collections-glass-field-worker.js",
    "scripts/verify-collections-glass-browser.mjs"
  ])assert.ok(existsSync(path(relative)),relative);
});
