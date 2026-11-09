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
  assert.match(component, /window\.matchMedia\("\(max-width: 760px\)"\)/);
  assert.match(component, /window\.matchMedia\("\(max-width: 1279px\)"\)/);
  assert.match(component, /if \(next === "wide"\) setWideCollapsed\(false\)/);
  assert.match(component, /if \(mode !== "wide"\) return/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1279px\)/);
  assert.match(css, /--studio-sidebar-width: 74px/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /translateX\(-100%\)/);
  assert.match(css, /visibility: hidden;/);
  assert.match(css, /pointer-events: none;/);
  assert.match(css, /studio-sidebar-enter-left/);
  assert.match(css, /--studio-entry-offset: 260px/);
  assert.match(css, /calc\(-1 \* var\(--studio-entry-offset\)\)/);
  assert.match(css, /\.studio-sandbox__topbar \{[\s\S]*?height: 66px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /@import|url\(https:|@font-face/);
});

test("resizing starts transitions in the same event, not after paint", async () => {
  const component = await read("../src/components/StudioSidebarSandbox.jsx");
  const css = await read("../src/components/StudioSidebarSandbox.css");
  assert.match(component, /useLayoutEffect\(\(\) => \{/);
  const handler = component.slice(component.indexOf("const resize = () => {"),
    component.indexOf('window.addEventListener("resize", resize)'));
  assert.match(handler, /setSidebarAnimating\(withinDesktop\);\s*setMode\(next\)/);
  assert.match(handler, /setRailEntering\(fromMobile\)/);
  assert.doesNotMatch(component, /useEffect\(\(\) => \{\s*const previous = previousMode/);
  const tablet = css.slice(css.indexOf("@media (min-width: 761px) and (max-width: 1279px)"));
  assert.doesNotMatch(tablet, /\.studio-sandbox \{--studio-sidebar-width: 74px;\}/);
  assert.doesNotMatch(tablet, /\.studio-sandbox--rail \.studio-sandbox__sidebar-head \{height: 71px;\}/);
});
test("offscreen mobile controls are inert and drawer navigation restores focus", async () => {
  const component = await read("../src/components/StudioSidebarSandbox.jsx");
  assert.match(component, /inert=\{mode === "mobile" && !mobileOpen \? true : undefined\}/);
  assert.match(component, /aria-hidden=\{mode === "mobile" && !mobileOpen \? true : undefined\}/);
  assert.match(component, /document\.body\.style\.overflow = "hidden"/);
  assert.match(component, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key === "Tab"/);
  assert.match(component, /mobileMenuRef\.current\?\.focus/);
  assert.match(component, /if \(screen === id\) return/);
  assert.match(component, /aria-expanded=\{mode === "mobile" \? mobileOpen : !collapsed\}/);
});
