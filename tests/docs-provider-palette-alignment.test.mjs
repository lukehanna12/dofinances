import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const asset=name=>read("sites/_apex/app/assets/"+name);
const html=read("sites/_apex/app/index.html");
const color=hex=>Array.from({length:3},(_,i)=>parseInt(hex.slice(i*2+1,i*2+3),16));
const hex=rgb=>"#"+rgb.map(n=>n.toString(16).padStart(2,"0")).join("");
const blend=(a,b,f)=>a.map((v,i)=>Math.round(v*(1-f)+b[i]*f));

test("Docs has the exact common page title and non-duplicated README subheading",()=>{
 const source=html.slice(html.indexOf('data-view="project/readme"'),html.indexOf('id="rm-notice"'));
 const css=asset("project-readme.css");
 assert.ok(source.includes('<div class="page-heading"><h1 id="readme-title">Docs</h1></div>'));
 assert.equal((source.match(/<h1\b/g)||[]).length,1);
 assert.ok(source.includes('id="rm-project-label"'));
 assert.ok(source.includes('id="rm-repository-label"'));
 assert.ok(source.includes('id="rm-visibility-badge"'));
 assert.ok(source.indexOf('class="page-heading"')<source.indexOf('class="rm-heading"'));
 assert.ok(css.includes('margin-top:calc(-1 * var(--workspace-panel-overlap))'));
 assert.doesNotMatch(css,/\.rm-heading h1\{/);
 const shared=asset("workspace-enhancements.css");
 assert.ok(shared.includes('.content > .view:not([data-view="dashboard"]) > .page-heading > h1'));
});
test("Docs canvas blends the screenshot-measured top wallpaper with the document at 60%",()=>{
 const css=asset("project-readme.css");
 const doc=color("#0d1117");
 // User screenshot (2026-11-16), whole 536x114 top image, ICC -> sRGB.
 // The wallpaper is textured: use its pixel mean, not one arbitrary pixel.
 const wallpaperMean=[3.58046936,8.83084577,17.04583988];
 const expected=blend(doc,wallpaperMean,.60);
 assert.deepEqual(expected,[7,12,19]);
 assert.equal(hex(expected),"#070c13");
 // Screenshot canvas was [8,16,26] in sRGB: the blue channel exceeded
 // both measured endpoints, which proves why the prior palette looked wrong.
 const oldCanvas=[8,16,26];
 assert.ok(oldCanvas[2]>Math.max(doc[2],wallpaperMean[2]));
 const docsRule='html:has(body > #workspace-shell .view.rm-view[data-view="project/readme"]:not([data-view="dashboard"]):not([hidden])){--ui-canvas:'+hex(expected)+'}';
 assert.ok(css.includes(docsRule));
 // Unlike an existence-only check, this guards the CSS specificity regression
 // that allowed the shared non-Home near-black canvas to override Docs.
 const sharedRule=asset("workspace-title.css").match(/html:has\([^\n]+\)\{--ui-canvas:#0a0a0a\}/)?.[0];
 assert.ok(sharedRule,"Expected the common non-Home canvas rule");
 const specificity=selector=>({
   ids:(selector.match(/#[\w-]+/g)||[]).length,
   attributesAndClasses:(selector.match(/\.[\w-]+|\[[^\]]+\]/g)||[]).length
 });
 const docsSpecificity=specificity(docsRule),sharedSpecificity=specificity(sharedRule);
 assert.ok(docsSpecificity.ids>sharedSpecificity.ids||
   docsSpecificity.ids===sharedSpecificity.ids&&docsSpecificity.attributesAndClasses>sharedSpecificity.attributesAndClasses,
   "Docs canvas must beat the shared non-Home rule in the CSS cascade");
 assert.ok(css.includes('.rm-reading{background:#0d1117'));
 for(let i=0;i<3;i++){
  const lo=Math.min(doc[i],wallpaperMean[i]),hi=Math.max(doc[i],wallpaperMean[i]);
  assert.ok(expected[i]>=lo&&expected[i]<=hi,"The chosen blue must fall between both measured references");
  assert.ok(Math.abs(expected[i]-(.4*doc[i]+.6*wallpaperMean[i]))<=.5);
 }
});
test("Docs footer text screen-blends to a modest brighter tone without changing the wallpaper",()=>{
 const css=asset("workspace-wallpapers.css");
 assert.ok(html.includes('<span class="workspace-footer-text">© DoFinances · 2026</span>'));
 assert.ok(css.includes('body[data-wallpaper-route$="/readme"] > .workspace-footer .workspace-footer-text{'));
 assert.ok(css.includes('color:#546478;opacity:.58;mix-blend-mode:screen;text-shadow:none'));
 assert.ok(css.includes('body[data-wallpaper-route="dashboard"] > .workspace-footer'));
 assert.ok(css.includes('var(--workspace-wallpaper-image,none)'));
 const ink=color("#546478");
 // Image pixel mean is not encoded in Git; test the adaptive Screen blend
 // at low and intermediate background levels, after the source .12 overlay.
 for(const background of [[8,16,27],[30,38,45],[65,77,87]]){
  const displayed=background.map((b,i)=>Math.round(b+(.58*ink[i]*(1-b/255))));
  assert.ok(displayed.every((v,i)=>v>background[i]));
  const inc=displayed.map((v,i)=>v-background[i]);
  assert.ok(inc.every(v=>v>=28&&v<=70),"Text is moderately brighter across modeled photo regions");
 }
});
test("Only Local skill and skill-file paths use cooler evergreen green; Credentials dropdowns use centered single arrows",()=>{
 const js=asset("provider-provisions.js"),css=asset("providers.css");
 assert.ok(js.includes('panel.dataset.kind=key'));
 assert.ok(js.includes('["Installed skills","skills"]'));
 assert.ok(js.includes('["Skill supporting files","skill_files"]'));
 assert.ok(css.includes('.pv-provision-mcp[data-kind="skills"] .pv-provision-protocol-item code'));
 assert.ok(css.includes('.pv-provision-mcp[data-kind="skill_files"] .pv-provision-protocol-item code{color:var(--workspace-skill-evergreen)}'));
 assert.ok(css.includes('#pv-root .pv-provision-protocol-item code{display:block'));
 assert.ok(css.includes('#pv-root[data-mode="credentials"] select.pv-input{'));
 for(const property of ['-webkit-appearance:none;appearance:none','background-position:right 12px center','background-size:14px 14px;padding-right:38px'])
  assert.ok(css.includes(property),property);
 assert.ok(css.includes('.pv-advanced-summary::marker{content:""}'));
 assert.ok(css.includes('transform:translateY(-2px) rotate(45deg)'));
 assert.ok(css.includes('transform:translateY(2px) rotate(225deg)'));
});
