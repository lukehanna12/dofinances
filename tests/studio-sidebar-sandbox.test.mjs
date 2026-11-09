import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("studio sidebar demo is isolated by hostname and never replaces apex login", async () => {
  const app = await read("../src/App.jsx");
  const login = await read("../src/components/Auth3.jsx");
  assert.match(app, /window\.location\.hostname\.toLowerCase\(\) === "stu\.dofinances\.com"/);
  assert.match(app, /\? <StudioSidebarSandbox \/>/);
  assert.match(app, /: <Auth3 \/>/);
  assert.match(login, /await fetch\("\/api\/auth\//);
  const workflow = await read("../.github/workflows/site.yml");
  assert.match(workflow, /cp dist\/index\.html sites\/_apex\/login\/index\.html/);
});
test("sidebar playground has exactly three locally switched sample screens", async () => {
  const component = await read("../src/components/StudioSidebarSandbox.jsx");
  for (const label of ["Utilities","Collections","Providers"])
    assert.match(component,new RegExp('title: "'+label+'"'));
  assert.equal((component.match(/id: "(utilities|collections|providers)"/g)||[]).length,3);
  assert.match(component, /setScreen\(id\)/);
  assert.match(component, /onClick=\{\(\) => navigate\(item\.id\)\}/);
  assert.match(component, /Lorem ipsum dolor sit amet/);
  assert.match(component, /page\.cards\.map/);
  assert.match(component, /page\.rows\.map/);
  assert.match(component, /PREVIEW ONLY/);
  assert.doesNotMatch(component, /fetch\(|location\.assign|window\.open|<a\s|href=/);
});
test("sidebar demo tracks production-inspired responsive states and motion", async () => {
  const component = await read("../src/components/StudioSidebarSandbox.jsx");
  const css = await read("../src/components/StudioSidebarSandbox.css");
  assert.match(component, /window\.innerWidth <= 760/);
  assert.match(component, /window\.innerWidth < 1280 \? "rail" : "wide"/);
  assert.match(component, /if \(mode === "wide" && previous !== "wide"\) setWideCollapsed\(false\)/);
  assert.match(component, /if \(mode !== "wide"\) return/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1279px\)/);
  assert.match(css, /--studio-sidebar-width: 74px/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /translateX\(-100%\)/);
  assert.match(css, /studio-sidebar-enter-left/);
  assert.match(css, /\.studio-sandbox__topbar \{[\s\S]*?height: 66px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /@import|url\(https:|@font-face/);
});
