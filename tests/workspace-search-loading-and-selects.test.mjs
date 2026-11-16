import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const asset=name=>read("sites/_apex/app/assets/"+name);
const app=()=>read("sites/_apex/app/index.html");

test("Provider routes use left and right aligned Collections-style loading rings",async()=>{
 const [html,css,js,collections]=await Promise.all([app(),asset("providers.css"),asset("providers.js"),asset("collections.css")]);
 const block=html.slice(html.indexOf('id="pv-summary"'),html.indexOf('class="pv-status"'));
 for(const id of ["pv-summary-mode","pv-summary-registered","pv-summary-connected","pv-summary-state","pv-summary-updated","pv-summary-updated-time","pv-summary-registered-label","pv-summary-ready-group","pv-summary-divider"])
  assert.ok(block.includes('id="'+id+'"'),"Provider summary needs "+id);
 assert.ok(html.includes('class="pv-workbench pv-loading" id="pv-root"'));
 assert.equal((block.match(/class="pv-summary-group"/g)||[]).length,3);
 assert.ok(block.includes('class="pv-summary-divider" id="pv-summary-divider"> / </span>'));
 assert.ok(block.includes('UPDATED <span id="pv-summary-updated-time">—</span>'));
 assert.doesNotMatch(block,/pv-list-meta|pv-index-title|pv-index-total/);
 assert.ok(css.includes('#pv-root.pv-loading .pv-summary-group{visibility:hidden}'));
 assert.ok(css.includes('#pv-root.pv-loading .pv-summary-group::after{'));
 for(const feature of ['content:""','visibility:visible','width:1em;height:1em','border:1.5px solid currentColor','border-top-color:transparent','border-radius:50%','animation:pv-spin 600ms linear infinite'])
  assert.ok(css.includes(feature),"Missing ring property "+feature);
 assert.ok(css.includes('min-height:var(--workspace-summary-row-height)'));
 assert.ok(css.includes('#pv-root .pv-summary-updated{flex:none;margin-left:auto;text-align:right;'));
 assert.ok(collections.includes('.cs-summary-loading .cs-summary-value{visibility:hidden}'));
 assert.ok(js.includes('summaryMode.textContent=(credentials?"CREDENTIALS":"PROVIDERS")+" ·"'));
 assert.ok(js.includes('summaryRegistered.textContent=String(credentials?ready:rows.length)'));
 assert.ok(js.includes('summaryRegisteredLabel.textContent=credentials?"CONNECTED":"REGISTERED"'));
 assert.ok(js.includes('summaryDivider.hidden=credentials'));
 assert.ok(js.includes('summaryReadyGroup.hidden=credentials'));
 assert.ok(js.includes('summaryConnected.textContent=String(ready)'));
 assert.ok(js.includes('summaryState.textContent="READY"'));
 assert.ok(js.includes('formatWorkspaceTime(updated,{hour12:true})'));
 assert.ok(js.includes('state.refreshedAt[mode]=new Date()'));
 assert.ok(js.includes('summaryUpdated.setAttribute("aria-busy",String(value))'));
 assert.ok(js.includes('root.classList.toggle("pv-loading",value)'));
 assert.doesNotMatch(js,/alignSummarySkeleton|createRange\(/);
 assert.doesNotMatch(css,/--pv-ring-one|--pv-ring-two|\.pv-summary-skeleton/);
});
test("Three Providers routes share a Collections-quality actionable search and tooltip",async()=>{
 const [html,css,js,collections]=await Promise.all([app(),asset("providers.css"),asset("providers.js"),asset("collections.css")]);
 const block=html.slice(html.indexOf('class="pv-search-row"'),html.indexOf('class="pv-refresh-control"'));
 assert.ok(block.includes('class="pv-search-focus" id="pv-search-focus"'));
 assert.ok(block.includes('src="/app/assets/magnifying-glass.v2.svg"'));
 assert.ok(block.includes('aria-keyshortcuts="Meta+Shift+F"'));
 assert.ok(block.includes('aria-describedby="pv-search-tooltip"'));
 assert.ok(block.includes('id="pv-search-tooltip" role="tooltip"'));
 assert.ok(css.includes("#pv-root .pv-search-focus:hover:not(:disabled),#pv-root .pv-search-focus:focus-visible"));
 assert.ok(css.includes("#pv-root .pv-search-control:hover .pv-search-tooltip"));
 assert.ok(css.includes("#pv-root .pv-search-focus:focus-visible + .pv-search-tooltip{transition-delay:0s,0s,0s}"));
 assert.ok(css.includes("transition-delay:.15s,.15s,.15s"));
 assert.ok(css.includes("#pv-root .pv-search-field input[type=\"search\"]:focus-visible"));
 assert.ok(js.includes('$("pv-search-focus").addEventListener("click",()=>search.focus({preventScroll:true}))'));
 assert.ok(js.includes('event.preventDefault();search.focus({preventScroll:true})'));
 assert.ok(collections.includes("cs-search-focus"));
});
test("Permissions search uses the same real button, tooltip, and focus behavior",async()=>{
 const [html,css,js]=await Promise.all([app(),asset("permissions.css"),asset("permissions.js")]);
 const block=html.slice(html.indexOf('class="pm-rule-toolbar"'),html.indexOf('class="pm-registry"'));
 assert.ok(block.includes('class="pm-search" role="search"'));
 assert.ok(block.includes('id="pm-focus-search"'));
 assert.ok(block.includes('src="/app/assets/magnifying-glass.v2.svg"'));
 assert.ok(block.includes('id="pm-search-tooltip" role="tooltip"'));
 assert.ok(block.includes('aria-keyshortcuts="Meta+Shift+F"'));
 assert.ok(css.includes("#pm-root .pm-search-focus:hover:not(:disabled),#pm-root .pm-search-focus:focus-visible"));
 assert.ok(css.includes("#pm-root .pm-search-control:hover .pm-search-tooltip"));
 assert.ok(css.includes("#pm-root .pm-search-focus:focus-visible + .pm-search-tooltip{transition-delay:0s,0s,0s}"));
 assert.ok(css.includes("transition-delay:.15s,.15s,.15s"));
 assert.ok(css.includes("height:var(--workspace-control-size)"));
 assert.ok(js.includes('$("pm-focus-search").addEventListener("click",()=>$("pm-filter").focus({preventScroll:true}))'));
 assert.ok(js.includes('event.preventDefault();$("pm-filter").focus({preventScroll:true})'));
});
test("Settings and Diagnostics chevrons are native-arrow-free and consistently positioned",async()=>{
 const [common,html]=await Promise.all([asset("workspace-theme.css"),app()]);
 for(const id of ["clock-zone-select","dg-check","dg-depth"]){
  assert.ok(html.includes('id="'+id+'"'));
  assert.ok(common.includes("#"+id),"Missing shared select control "+id);
 }
 assert.ok(common.includes("-webkit-appearance:none;appearance:none;"));
 assert.ok(common.includes("background-position:right 12px center"));
 assert.ok(common.includes("background-size:14px 14px;padding-right:38px"));
 assert.ok(common.includes('data:image/svg+xml'));
});
test("Settings personal-access-token placeholder has one compact, vertically centered input line",async()=>{
 const [css,html]=await Promise.all([asset("settings.css"),app()]);
 assert.ok(html.includes('id="github-readme-token" type="password"'));
 assert.ok(css.includes("#st-root #github-readme-token{box-sizing:border-box;height:32px;min-height:32px;max-height:32px;padding:0 11px;line-height:normal;font-size:12px;vertical-align:middle}"));
 assert.ok(css.includes(".rm-settings-form input{min-width:180px;flex:1 1 240px}"));
});
