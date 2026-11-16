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
 for(const value of ['--workspace-health-green:#30d158','--workspace-health-green-halo:#30d15820'])
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
