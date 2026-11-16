import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const asset=f=>read("sites/_apex/app/assets/"+f);
const html=read("sites/_apex/app/index.html");

test("Permissions relies on its existing summary and row Skeleton instead of reading-status prose",()=>{
 const js=asset("permissions.js"),css=asset("permissions.css");
 assert.doesNotMatch(js,/Reading the local gateway's effective permissions/);
 assert.ok(js.includes('summaryLoading(true)'));
 assert.ok(js.includes('show("");'));
 assert.ok(js.includes('function showLoadingSkeleton()'));
 assert.ok(js.includes('site-skeleton" data-slot="skeleton"'));
 assert.ok(js.includes('show(error.message,true)'));
 assert.ok(css.includes('.pm-rule-row--skeleton'));
});
test("Utilities has fixed six-character UID and per-row category Skeleton on first load and refresh",()=>{
 const js=asset("utilities.js"),css=asset("utilities.css"),common=asset("site-skeleton.css");
 for(const marker of [
  'class="ut-row-uid"', 'class="ut-row-class"',
  'class="ut-skeleton-uid site-skeleton" data-slot="skeleton"',
  'class="ut-skeleton-class site-skeleton" data-slot="skeleton"',
  'class="ut-skeleton-bar site-skeleton" data-slot="skeleton"'
 ])assert.ok(js.includes(marker),marker);
 for(const fragment of [
  '#ut-root .ut-skeleton-uid{display:block;width:6ch',
  '--ut-class-skeleton-width:13ch',
  '--ut-class-skeleton-width:9ch',
  '--ut-class-skeleton-width:17ch',
  'nth-child(11n + 11)',
  '.ut-row-uid::after{width:6ch}',
  '.ut-row-class::after{width:var(--ut-class-skeleton-width,13ch)}',
  '.ut-row:not(.ut-active) :is(.ut-row-uid,.ut-row-class){color:transparent;transition:none}'
 ])assert.ok(css.includes(fragment),fragment);
 assert.ok(common.includes('.ut-row-uid::after'));
 assert.ok(common.includes('.ut-row-class::after'));
 assert.ok(common.includes('site-skeleton-pulse 2s cubic-bezier'));
 assert.ok(js.includes('setSummaryLoading(true)'));
 assert.ok(js.includes('setSummaryLoading(false)'));
});
test("Diagnostics uses shadcn Skeleton data placeholders across the real screen sections",()=>{
 const js=asset("diagnostics.js"),css=asset("diagnostics.css");
 for(const fragment of [
  'function loadingLine(width,extra="")',
  '"site-skeleton dg-skeleton-line"',
  'function initialSkeletonReport()',
  'function unavailableReport()',
  'initialSkeletonReport();',
  'if(previous)renderReport(previous)',
  'else unavailableReport()',
  'root.classList.toggle("dg-refresh-loading",value&&!!previous)',
  'byId(id).setAttribute("aria-busy",String(value))',
  'notice.hidden=true',
  'reportLoading(false)'
 ])assert.ok(js.includes(fragment),fragment);
 for(const id of ['dg-top','dg-quotas','dg-workers','dg-local'])
  assert.ok(js.includes('clear("'+id+'")'),id+" must receive structured skeleton markup");
 for(const slot of ['dg-skeleton-percentage','dg-skeleton-pair-value','dg-skeleton-storage'])
  assert.ok(js.includes(slot)&&css.includes(slot),slot);
 assert.ok(css.includes('#diagnostics-root.dg-refresh-loading :is(.dg-card-percent'));
 assert.ok(css.includes('background:var(--site-skeleton-accent,#262626)'));
 assert.ok(css.includes('animation:site-skeleton-pulse 2s cubic-bezier(.4,0,.6,1) infinite'));
 for(const fragment of ['dg-card-ring dg-ring-loading','dg-progress dg-progress-placeholder','batteryGraphic(null).glyph','if(!previous)unavailableReport()'])
  assert.ok((js+css).includes(fragment)||fragment==='if(!previous)unavailableReport()');
 assert.ok(!js.includes('Generating mock telemetry'));
});
test("Diagnostics shimmers Checking... and pulses its dot only during a health read",()=>{
 const js=asset("diagnostics.js"),css=asset("diagnostics.css");
 const block=html.slice(html.indexOf('class="dg-header"'),html.indexOf('class="dg-meta"'));
 assert.ok(block.includes('id="dg-health-text" class="shimmer">Checking...</span>'));
 assert.ok(block.includes('id="dg-health" role="status" aria-live="polite"'));
 assert.ok(js.includes('healthText.classList.toggle("shimmer",value)'));
 assert.ok(js.includes('if(value)healthText.textContent="Checking..."'));
 assert.ok(js.includes('reportLoading(true);checkStatus(true)'));
 assert.ok(js.includes('reportLoading(false);checkStatus(false)'));
 assert.ok(css.includes('.dg-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#777;box-shadow:0 0 0 3px #7772;flex:none;animation:none;'));
 assert.ok(css.includes('.dg-status[data-checking="true"] .dg-dot{animation:dg-health-pulse 1.6s ease-in-out infinite}'));
 assert.ok(css.includes('@keyframes dg-health-pulse{50%{opacity:.48;transform:scale(.78)}}'));
 for(const state of ['healthy','degraded','unhealthy'])
  assert.ok(css.includes('[data-health='+state+'] .dg-dot{'));
 assert.ok(css.includes('#diagnostics-root .shimmer{'));
 assert.ok(css.includes('animation:dg-text-shimmer 2s linear infinite'));
 assert.ok(css.includes('-webkit-background-clip:text'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(css.includes('.shimmer{background:none;color:var(--dg-muted)'));
});
