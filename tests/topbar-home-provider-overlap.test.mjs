import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {workspaceRouteDetails} from "../sites/_apex/app/assets/workspace-nav.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("sites/_apex/app/index.html");
const studio=read("studio/sidebar/index.html");
const nav=read("sites/_apex/app/assets/workspace-nav.js");
const theme=read("sites/_apex/app/assets/workspace-theme.css");
const css=read("sites/_apex/app/assets/workspace-enhancements.css");
const providers=read("sites/_apex/app/assets/providers.css");
const tooltips=read("sites/_apex/app/assets/workspace-rail-tooltips.js");

test("Dashboard is no longer a breadcrumb; the far-right Home action uses the sidebar SVG",()=>{
  for(const html of [app,studio]){
    assert.ok(html.includes('<nav class="shadcn-breadcrumbs" id="breadcrumb" aria-label="Breadcrumb" hidden>'));
    assert.ok(!html.includes("data-breadcrumb-root"));
    assert.match(html,/<a id="topbar-dashboard-home" class="topbar-dashboard-home" href="#dashboard" aria-label="Go to Dashboard">/);
    assert.match(html,/id="topbar-dashboard-home"[^>]*><span class="nav-icon-asset nav-icon-asset--dashboard"/);
    assert.equal((html.match(/id="topbar-dashboard-home"/g)||[]).length,1);
  }
  assert.ok(css.includes('margin-right:calc(16px - clamp(18px,3.8vw,54px));'));
  assert.ok(css.includes('#workspace-shell .top-actions{margin-right:0;}'));
  assert.ok(theme.includes(':is(.nav-link,.topbar-dashboard-home) .nav-icon-asset--dashboard'));
  assert.ok(theme.includes('dashboard-screen-sidebar-icon.v1.svg'));
  assert.ok(nav.includes('breadcrumb.hidden=route==="dashboard"'));
  assert.ok(nav.includes('if(!modified)render("dashboard")'));
  assert.equal(workspaceRouteDetails("dashboard").breadcrumb,"");
  assert.equal(workspaceRouteDetails("projects").breadcrumb,"Projects");
  assert.equal(workspaceRouteDetails("settings").breadcrumb,"Settings");
  assert.equal(workspaceRouteDetails("colosseum/utilities").breadcrumb,"Projects / Colosseum / Utilities");
});
test("Provider static prefixes survive loading; ring geometry follows registered/ready/connected groups",()=>{
  const start=app.indexOf('<span class="pv-summary-value" id="pv-summary-value">');
  const part=app.slice(start,app.indexOf('id="pv-summary-updated"',start));
  assert.ok(part.indexOf('class="pv-summary-prefix" id="pv-summary-mode"')>=0);
  assert.ok(part.indexOf('class="pv-summary-prefix"')<part.indexOf('class="pv-summary-group"'));
  assert.ok(!part.slice(part.indexOf('class="pv-summary-group"')).includes('id="pv-summary-mode"'));
  assert.ok(providers.includes('#pv-root.pv-loading .pv-summary-group{visibility:hidden}'));
  assert.ok(providers.includes('#pv-root .pv-summary-group{position:relative;display:inline-block'));
  assert.ok(providers.includes('left:50%;margin:-.5em 0 0 -.5em'));
  const js=read("sites/_apex/app/assets/providers.js");
  assert.ok(js.includes('summaryMode.textContent=(credentials?"CREDENTIALS":"PROVIDERS")+" ·"'));
  assert.ok(js.includes('summaryReadyGroup.hidden=credentials'));
});
test("Only tooltips intersecting the sidebar use the native browser top layer",()=>{
  assert.ok(nav.includes('initOverlappingContentTooltips(doc,win,sidebar)'));
  assert.ok(tooltips.includes('box.right<=glass.left||box.left>=glass.right'));
  assert.ok(tooltips.includes('tip.setAttribute("popover","manual")'));
  assert.ok(tooltips.includes('tip.showPopover()'));
  assert.ok(tooltips.includes('tip.hidePopover()'));
  assert.ok(css.includes('.workspace-tooltip-overlap:popover-open'));
  assert.ok(css.includes('position:fixed!important;inset:auto!important;'));
  assert.ok(css.includes('z-index:2147483647!important;'));
  assert.ok(tooltips.includes('doc.addEventListener("focusin"'));
  assert.ok(tooltips.includes('doc.addEventListener("pointerover"'));
});
