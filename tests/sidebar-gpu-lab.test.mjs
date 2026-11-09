import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const get=p=>readFile(new URL(p,import.meta.url),"utf8");

test("isolated GPU lab does not replace real application optical renderer",async()=>{
  const [html,js,workflow]=await Promise.all([
    get("../preview/gpu-lab/index.html"),
    get("../preview/gpu-lab/gpu-lab.js"),
    get("../.github/workflows/app-sidebar-preview.yml")
  ]);
  assert.match(html,/controlled optical experiment/);
  assert.match(html,/not.*production sidebar/si);
  assert.match(js,/mountOracleBackdrop/);
  assert.match(js,/createGPUExperiment/);
  assert.match(js,/const source=sourceImage\(\)/);
  assert.match(js,/source\.pixels,width,height,24/);
  assert.match(js,/svg-scene/);
  assert.match(js,/gpu-scene/);
  assert.match(workflow,/\.app-sidebar-preview\/gpu-lab/);
});

test("WebGPU prototype consumes unchanged Oracle fields, not DOM capture",async()=>{
  const code=await get("../preview/gpu-lab/gpu-renderer.js");
  assert.match(code,/import \{generateOracleField,sidebarFiniteBlurProjection/);
  assert.match(code,/const field=generateOracleField\(width,height,radius\)/);
  assert.match(code,/write\(inner,field.inner\)/);
  assert.match(code,/write\(outer,field.outer\)/);
  assert.match(code,/write\(blur,field.blurMask\)/);
  assert.match(code,/let innerUv=uv \+ \(innerField\.rg-vec2f\(0\.5\)\)\*128\./);
  assert.match(code,/let outerUv=uv \+ \(outerField\.rg-vec2f\(0\.5\)\)\*128\./);
  assert.match(code,/let a=innerField\.b/);
  assert.match(code,/device\.queue\.submit/);
  assert.match(code,/onSubmittedWorkDone/);
  assert.doesNotMatch(code,/html2canvas|toDataURL|captureStream|getDisplayMedia|drawImage|drawWindow|fetch\(/);
});

test("GPU lab establishes no ungrounded pixel-equivalence or speed assertion",async()=>{
  const notes=await get("../preview/gpu-lab/README.md");
  assert.match(notes,/NOT bit-identical/);
  assert.match(notes,/cannot substitute for the\s+actual full-page DOM backdrop/);
  assert.match(notes,/Promotion gate:/);
});
