import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=source("sites/_apex/app/assets/collections.css");
const js=source("sites/_apex/app/assets/collections.js");
const html=source("sites/_apex/app/index.html");

test("No open collection lets the desktop list use all available width",()=>{
  assert.ok(css.includes("#cs-root .cs-layout{margin-top:var(--workspace-summary-controls-gap);display:grid;grid-template-columns:minmax(0,1fr);gap:40px"));
  assert.ok(css.includes("@media(min-width:1024px){"));
  assert.ok(css.includes("grid-template-columns:minmax(0,1fr) minmax(0,0px);"));
  assert.ok(css.includes("#cs-root .cs-layout.cs-detail-open{"));
  assert.ok(css.includes("grid-template-columns:minmax(0,1fr) minmax(0,min(var(--cs-detail-max-width),calc((100% - 64px) * .51219512195)));"));
  assert.ok(css.includes("column-gap:64px;"));
  assert.ok(html.includes('class="cs-layout"'));
});

test("List width, gutter and rightward detail slide share a single fast motion",()=>{
  assert.ok(css.includes("--cs-detail-motion:240ms;--cs-detail-ease:cubic-bezier(.22,1,.36,1)"));
  assert.ok(css.includes("transition:grid-template-columns var(--cs-detail-motion) var(--cs-detail-ease),"));
  assert.ok(css.includes("column-gap var(--cs-detail-motion) var(--cs-detail-ease)"));
  assert.ok(css.includes("transition:opacity var(--cs-detail-motion) var(--cs-detail-ease),transform var(--cs-detail-motion) var(--cs-detail-ease)"));
  assert.ok(css.includes("transform:translateX(56px)"));
  assert.ok(css.includes("#cs-root .cs-layout.cs-detail-open .cs-desktop-detail:not(.cs-empty){opacity:1;transform:translateX(0);pointer-events:auto}"));
  assert.ok(css.includes(".cs-layout.cs-detail-resizing .cs-desktop-detail{overflow:hidden}"));
});

test("Only the first open and final close animate the panel; row swaps reuse it",()=>{
  const render=js.slice(js.indexOf(" function renderCard(){"),js.indexOf(" function syncUtilityChrome(){"));
  assert.ok(render.includes('const wasOpen=layout.classList.contains("cs-detail-open")'));
  assert.ok(render.includes("if(wasOpen!==selected)"));
  assert.ok(render.includes('layout.classList.toggle("cs-detail-open",selected)'));
  assert.ok(render.includes('detail.classList.toggle("cs-empty",!selected)'));
  assert.ok(render.includes('(selected||!layout.classList.contains("cs-detail-resizing"))&&detail.innerHTML!==markup'));
  assert.ok(js.includes('layout.addEventListener("transitionend",finishDesktopDetailMotion)'));
  assert.ok(js.includes('layout.addEventListener("transitioncancel",finishDesktopDetailMotion)'));
  assert.ok(js.includes('if(!state.activeId&&detail.classList.contains("cs-empty"))detail.replaceChildren()'));
  assert.ok(js.includes('const next=state.activeId===id?null:id'));
  assert.ok(js.includes('if(next)void loadDetail(next)'));
  assert.doesNotMatch(js,/ResizeObserver|MutationObserver|requestAnimationFrame|setInterval/);
});

test("Mobile accordion and reduced-motion are independent of desktop split",()=>{
  assert.ok(css.includes('@media(max-width:1023px){\n #cs-root .cs-layout{grid-template-columns:1fr;gap:40px}'));
  assert.ok(css.includes(' #cs-root .cs-desktop-detail{display:none}'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce){'));
  assert.ok(css.includes('transition-duration:.01ms!important'));
  assert.ok(js.includes('window.matchMedia?.("(min-width:1024px) and (prefers-reduced-motion:no-preference)")?.matches'));
  assert.ok(js.includes('!root.closest(".view")?.hidden'));
});

test("Collections alone escapes the shared 1110px workspace max-width",()=>{
  const widthRule=css.slice(css.indexOf("/* Only Collections should escape"),css.indexOf("/* Wide-screen Collections uses one synchronized"));
  assert.match(widthRule,/@media\(min-width:1024px\)/);
  assert.match(widthRule,/html:has\(body > #workspace-shell \.view\[data-view="colosseum\/collections"\]:not\(\[hidden\]\)\)/);
  assert.match(widthRule,/body:has\(> #workspace-shell\) \.content\{max-width:none;width:100%\}/);
  assert.doesNotMatch(widthRule,/padding-inline|padding-right|padding-left|margin-inline|\.main\s*\{/);
});

test("Only the list receives spare width after the former detail ceiling",()=>{
  assert.ok(css.includes("--cs-detail-max-width:479.17px;"));
  assert.ok(css.includes("grid-template-columns:minmax(0,1fr) minmax(0,min(var(--cs-detail-max-width),calc((100% - 64px) * .51219512195)));"));
  const ratio=1.05/(1+1.05),maxWidth=479.17;
  for(const width of [700,800,999.52,1100,1600,2600]){
    const detail=Math.min(maxWidth,(width-64)*ratio);
    const list=width-64-detail;
    assert.ok(detail<=maxWidth+Number.EPSILON,"Details never take unbounded width");
    assert.ok(list>0);
    if(width>=999.52)assert.ok(Math.abs(detail-479.17)<0.02);
  }
});
