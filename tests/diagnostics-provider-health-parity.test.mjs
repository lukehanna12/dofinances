import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const asset=name=>source("sites/_apex/app/assets/"+name);
const html=source("sites/_apex/app/index.html");

test("Diagnostics health is upper-left on the shared summary track, Refresh lower-right",()=>{
 const css=asset("diagnostics.css"),body=html.slice(html.indexOf('id="diagnostics-root"'),html.indexOf('class="dg-meta"'));
 const status=body.indexOf('class="dg-status" id="dg-health"'),actions=body.indexOf('class="dg-actions"'),refresh=body.indexOf('id="dg-refresh"');
 assert.ok(status>=0&&actions>status&&refresh>actions);
 assert.equal((body.match(/id="dg-health"/g)||[]).length,1);
 assert.ok(css.includes('#diagnostics-root .dg-header{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:var(--workspace-summary-row-height) var(--workspace-control-size);'));
 assert.ok(css.includes('row-gap:var(--workspace-summary-controls-gap)'));
 assert.ok(css.includes('#diagnostics-root .dg-header > .dg-status{grid-column:1;grid-row:1;align-self:start;justify-self:start}'));
 assert.ok(css.includes('#diagnostics-root .dg-actions{grid-column:2;grid-row:2;'));
 assert.ok(css.includes('margin-top:calc(-1 * var(--workspace-panel-overlap))'));
});
test("Provider list marks on all three routes have the Diagnostics healthy green dot and halo",()=>{
 const css=asset("providers.css"),diag=asset("diagnostics.css"),tokens=asset("workspace-wallpapers.css");
 for(const value of ['--workspace-health-green:#30d158','--workspace-health-green-halo:#30d15820','--workspace-skill-evergreen:#55a47b'])
  assert.ok(tokens.includes(value));
 assert.ok(diag.includes('[data-health=healthy] .dg-dot{background:var(--workspace-health-green);box-shadow:0 0 0 3px var(--workspace-health-green-halo)}'));
 assert.ok(css.includes('.pv-provider-mark[data-state="available"]{background:var(--workspace-health-green);box-shadow:0 0 0 3px var(--workspace-health-green-halo)}'));
 assert.ok(css.includes('.pv-provider-mark{display:inline-block;width:7px;height:7px;border-radius:50%'));
 const providers=asset("providers.js");
 assert.ok(providers.includes('const dot=e("span","pv-provider-mark")'));
 assert.ok(providers.includes('dot.dataset.state=statusOf(x)'));
 assert.ok(providers.includes('host.append(root)'));
 for(const route of ['local','external','credentials'])
  assert.ok(html.includes('colosseum/providers/'+route));
});

test("Health dot pulses only while Diagnostics is loading or refreshing",()=>{
 const css=asset("diagnostics.css");
 const js=asset("diagnostics.js");
 const html=source("sites/_apex/app/index.html");
 assert.ok(css.includes("#diagnostics-root .dg-dot{display:inline-block;"));
 assert.match(css,/#diagnostics-root \.dg-dot\{[^}]*animation:none;/);
 assert.ok(css.includes('#diagnostics-root .dg-status[data-checking="true"] .dg-dot{animation:dg-health-pulse 1.6s ease-in-out infinite}'));
 assert.equal((css.match(/animation:dg-health-pulse 1\.6s ease-in-out infinite/g)||[]).length,1);
 assert.ok(html.includes('id="dg-health" role="status" aria-live="polite" data-checking="true"'));
 assert.ok(js.includes('health.dataset.checking=String(value)'));
 assert.ok(js.includes('reportLoading(true);checkStatus(true)'));
 assert.ok(js.includes('reportLoading(false);checkStatus(false)'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce){'));
});

test("Original vivid health green pairs with darker, cooler evergreen paths",()=>{
 const css=asset("workspace-wallpapers.css"),pv=asset("providers.css");
 const tokens=Object.fromEntries([...css.matchAll(/--(workspace-(?:health-green|health-green-halo|skill-evergreen)):(#[a-f0-9]{6,8});/g)]
  .map(([,k,v])=>[k,v]));
 assert.equal(tokens["workspace-health-green"],"#30d158");
 assert.equal(tokens["workspace-health-green-halo"],"#30d15820");
 assert.equal(tokens["workspace-skill-evergreen"],"#55a47b");
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const hue=hex=>{
   const [r,g,b]=rgb(hex).map(n=>n/255);
   const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
   return d===0?0:((max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;
 };
 const indicatorHue=hue(tokens["workspace-health-green"]);
 const pathHue=hue(tokens["workspace-skill-evergreen"]);
 assert.ok(indicatorHue>=130&&indicatorHue<=145);
 assert.ok(pathHue>=145&&pathHue<=160,"Skill paths should lean evergreen, not yellow/olive");
 const luminance=hex=>rgb(hex).map(v=>{
   const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
 }).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const indicator=luminance(tokens["workspace-health-green"]);
 const path=luminance(tokens["workspace-skill-evergreen"]);
 assert.ok(indicator>path*1.45,"Dot must remain perceptibly brighter");
 assert.ok((path+.05)/(luminance("#171717")+.05)>5.9,
   "Evergreen path text must retain high dark-background contrast");
 assert.ok(pv.includes('.pv-provision-mcp[data-kind="skill_files"] .pv-provision-protocol-item code{color:var(--workspace-skill-evergreen)}'));
 assert.ok(pv.includes('.pv-provider-mark[data-state="available"]{background:var(--workspace-health-green)'));
});

test("Provider submenu button left edges match regular sidebar button-to-edge inset",()=>{
 const pv=asset("providers.css");
 const theme=asset("workspace-theme.css");
 const enhanced=asset("workspace-enhancements.css");
 assert.ok(pv.includes(".pv-provider-subnav{padding:2px 0 7px 30px;"));
 assert.ok(pv.includes('.pv-provider-subnav::before{content:"";position:absolute;top:8px;bottom:12px;left:18px;'));
 assert.ok(pv.includes(".pv-provider-subnav{padding-left:30px}"));
 assert.ok(theme.includes("padding: 17px 12px 12px;"));
 assert.ok(enhanced.includes("width:calc(100% - 2px);margin-inline:auto"));
 // Expanded desktop sidebar inset = 12px padding + 1px auto margin.
 // Desktop submenu = 30px padding + 1px auto margin - 18px line.
 assert.equal(12+1,30+1-18);
 // Mobile has no 1px margin on either regular or child links.
 assert.equal(12,30-18);
 const browser=source("scripts/verify-sidebar-olive-health-browser.mjs");
 assert.ok(browser.includes('Emulation.setDeviceMetricsOverride'));
 assert.ok(browser.includes('child')||browser.includes('result.gaps'));
 assert.ok(browser.includes('dataset.checking="false"'));
});
