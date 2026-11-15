import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=source("sites/_apex/app/assets/collections.css");
const js=source("sites/_apex/app/assets/collections.js");
const html=source("sites/_apex/app/index.html");

test("No open collection lets the desktop list use all available width",()=>{
  assert.ok(css.includes("#cs-root .cs-layout{margin-top:48px;display:grid;grid-template-columns:minmax(0,1fr);gap:40px"));
  assert.ok(css.includes("@media(min-width:1024px){"));
  assert.ok(css.includes("grid-template-columns:minmax(0,1fr) minmax(0,0fr);"));
  assert.ok(css.includes("#cs-root .cs-layout.cs-detail-open{"));
  assert.ok(css.includes("grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);"));
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
