import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=src("sites/_apex/app/index.html");
const js=src("sites/_apex/app/assets/collections.js");
const css=src("sites/_apex/app/assets/collections.css");
const edge=src("edge/router.mjs");
const dashboard=src("sites/_apex/app/assets/dashboard.js");

test("Collections controller is valid native ES module",async()=>{
 const module=await import("../sites/_apex/app/assets/collections.js");
 assert.equal(typeof module.initColosseumCollections,"function");
});
test("Collections view is isolated from Permissions and wired to the dashboard",()=>{
 assert.match(html,/data-view="colosseum\/collections"[\s\S]*?id="cs-root"/);
 assert.match(html,/id="cs-refresh"/);
 assert.match(html,/id="cs-create"/);
 assert.match(html,/id="cs-form-dialog"/);
 assert.match(html,/id="cs-delete-dialog"/);
 assert.match(html,/href="\/app\/assets\/collections\.css"/);
 assert.match(dashboard,/import \{initColosseumCollections\} from "\.\/collections\.js"/);
 assert.match(dashboard,/initColosseumCollections\(\)/);
 assert.match(html,/data-view="colosseum\/permissions"/);
 assert.doesNotMatch(js,/\/api\/colosseum\/permissions/);
});
test("Exact recovered accordion behavior includes direct collapse and exclusive selection",()=>{
 assert.match(js,/const next=state\.activeId===id\?null:id/);
 assert.match(js,/state\.activeId=next/);
 assert.match(js,/classList\.toggle\("cs-open",open\)/);
 assert.match(js,/aria-expanded/);
 assert.match(css,/grid-template-rows:0fr/);
 assert.match(css,/\.cs-entry\.cs-open \.cs-accordion-panel\{grid-template-rows:1fr/);
});
test("Closing an expanded Collections row shrinks continuously for 450ms",()=>{
 // The old height:62.4px on the parent abruptly clipped the animated panel
 // and jumped the next row upward on the first frame of button collapse.
 assert.doesNotMatch(css,/#cs-root \.cs-entry:not\(\.cs-open\)\{height:/);
 assert.doesNotMatch(css,/#cs-root \.cs-entry:not\(\.cs-open\) h2\{height:100%/);
 assert.match(css,/#cs-root \.cs-trigger\{[^}]*transition:padding \.45s cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-trigger\{[^}]*transition-timing-function:cubic-bezier\(\.4,0,\.2,1\)/);
 assert.match(css,/#cs-root \.cs-accordion-panel\{[^}]*transition:grid-template-rows \.45s cubic-bezier\(\.22,1,\.36,1\),opacity \.45s/);
 assert.match(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-accordion-panel\{transition-timing-function:cubic-bezier\(\.4,0,\.2,1\),cubic-bezier\(\.4,0,\.2,1\),ease\}/);
 assert.match(css,/#cs-root \.cs-entry\.cs-open \.cs-accordion-panel\{grid-template-rows:1fr;opacity:1;visibility:visible\}/);
 // Expanded rows still have automatic header height and natural text wrapping.
 assert.doesNotMatch(css,/#cs-root \.cs-entry\.cs-open\{height:/);
 assert.match(css,/#cs-root \.cs-trigger\{display:flex;align-items:center/);
 assert.match(css,/#cs-root \.cs-trigger \.cs-entry-title\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/#cs-root \.cs-entry-title\{position:relative;display:grid;grid-template-rows:0fr;min-height:1lh;overflow:hidden\}/);
 assert.match(css,/#cs-root \.cs-trigger \.cs-entry-title\{[^}]*transition:color \.2s,grid-template-rows \.45s cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-entry-title\{grid-template-rows:0fr;transition-timing-function:ease,cubic-bezier\(\.4,0,\.2,1\)\}/);
 assert.match(css,/#cs-root \.cs-entry-title \.cs-title-measure\{min-height:0;min-width:0;overflow:hidden;visibility:hidden;white-space:normal\}/);
 assert.match(css,/#cs-root \.cs-entry-title \.cs-title-expanded\{white-space:normal;opacity:0;transition:opacity \.14s linear\}/);
 assert.match(css,/#cs-root \.cs-entry\.cs-open \.cs-title-compact\{opacity:0;transition-delay:\.1s\}/);
 assert.match(css,/#cs-root \.cs-entry\.cs-open \.cs-title-expanded\{opacity:1\}/);
 assert.match(js,/<span class="cs-title-measure" aria-hidden="true"/);
 assert.match(js,/<span class="cs-title-compact" aria-hidden="true"/);
 assert.match(js,/<span class="cs-title-expanded"/);
 assert.doesNotMatch(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-entry-title\{overflow:hidden;white-space:nowrap/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-trigger\{padding:20px 24px 20px 0\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?transition-duration:\.01ms!important/);
});

test("Collection title pixels remain visible and loading rings cannot reflow layout",()=>{
 assert.doesNotMatch(css,/\.cs-entry-title\{display:grid;grid-template-rows:0fr 1fr/);
 assert.match(css,/#cs-root \.cs-entry-title \.cs-title-compact,#cs-root \.cs-entry-title \.cs-title-expanded\{position:absolute;top:0;left:0;right:0/);
 assert.match(css,/#cs-root \.cs-entry-title \.cs-title-measure\{[^}]*visibility:hidden/);
 assert.match(css,/#cs-root \.cs-entry\.cs-open \.cs-title-expanded\{opacity:1\}/);
 assert.match(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-title-compact\{transition-delay:0s\}/);
 assert.match(css,/#cs-root \.cs-summary-loading \.cs-summary-value\{visibility:hidden\}/);
 assert.match(css,/#cs-root \.cs-summary-skeleton\{[^}]*position:absolute;left:0;top:\.32em/);
 assert.match(css,/#cs-root \.cs-trigger\{[^}]*transition:padding \.45s/);
 assert.match(css,/#cs-root \.cs-accordion-panel\{[^}]*transition:grid-template-rows \.45s/);
 assert.doesNotMatch(js,/ResizeObserver|requestAnimationFrame|setInterval/);
});

test("Expanded-row membership skeleton resolves without shifting the header and description",()=>{
 // The client does a single GET for the expanded collection; no polling.
 assert.match(js,/if\(next\)void loadDetail\(next\)/);
 assert.match(js,/const result=await request\("get",\{name:col\.name\}\)/);
 assert.match(js,/if\(seq!==state\.detailSeq\|\|state\.activeId!==id\)return/);
 assert.match(js,/state\.detail=result;syncActions\(\);renderCard\(\)/);
 assert.match(js,/mobile\.classList\.toggle\("cs-members-ready",selected&&!!state\.detail\)/);
 assert.match(css,/#cs-root \.cs-mobile-detail\{display:none;margin-top:24px;overflow-anchor:none\}/);
 assert.match(css,/#cs-root \.cs-desktop-detail\{[^}]*overflow-anchor:none\}/);
 assert.match(css,/@media\(max-width:1023px\)\{[\s\S]*?\.cs-mobile-detail\{display:block;overflow:hidden;max-height:114\.1px;transition:max-height \.45s cubic-bezier\(\.4,0,\.2,1\)\}/);
 assert.match(css,/#cs-root \.cs-mobile-detail\.cs-members-ready\{max-height:540px\}/);
 assert.match(css,/#cs-root \.cs-mobile-detail \.cs-card\{padding:25px 20px;max-height:440px\}/);
 // The initial cap equals the single-line loading card's intrinsic box:
 // 2px border + 50px card padding + 40px loading text padding + 22.1px line.
 assert.ok(Math.abs((2+50+40+13*1.7)-114.1)<0.001);
 assert.match(js,/oldButtons\.every\(\(button,i\)=>button\.dataset\.csAction===newButtons\[i\]\.dataset\.csAction\)/);
 assert.match(js,/if\(button\.disabled!==newButtons\[i\]\.disabled\)button\.disabled=newButtons\[i\]\.disabled/);
 assert.doesNotMatch(js,/ResizeObserver|MutationObserver|requestAnimationFrame|setInterval/);
 assert.doesNotMatch(js,/setTimeout\([^\n]*(?:renderCard|loadDetail|syncActions|cs-members-ready)/);
 // The 450ms collapse, compact row height, and naturally-sized card remain.
 assert.match(css,/#cs-root \.cs-accordion-panel\{[^}]*transition:grid-template-rows \.45s/);
 assert.match(css,/#cs-root \.cs-trigger\{[^}]*min-height:calc\(var\(--cs-row-height\)/);
 assert.doesNotMatch(css,/#cs-root \.cs-card\{[^}]*min-height:/);
});
test("Collection route indicators retain the supplied vector SVGs and replace text capsules",()=>{
  const expected={
    cloud:"cloud-utility.v2.svg",
    direct:"direct-utility.v1.svg",
    local:"local-provider.v1.svg",
    ported:"external-provider.v1.svg"
  };
  for(const [mode,file] of Object.entries(expected)){
    assert.ok(js.includes(mode+':{src:"/app/assets/'+file+'"'),
      "Missing exact SVG file mapping for "+mode);
    const svg=src("sites/_apex/app/assets/"+file);
    assert.ok(svg.startsWith("<svg "),file+" must remain a native SVG");
    assert.match(svg,/viewBox="[^"]+"/);
    assert.match(svg,/<path\s/);
    assert.match(svg,/fill="white"/);
    assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\b(?:href|xlink:href)=|<!DOCTYPE|<\?xml|\.png|data:image/i);
  }
  const cloud=src("sites/_apex/app/assets/cloud-utility.v2.svg");
  assert.equal((cloud.match(/<path\s/g)||[]).length,1,
    "Cloud v2 must be a filled silhouette, without v1's inner outline cutout");
  assert.ok(js.includes('class="cs-utility-route-icon cs-utility-route-icon--\'+routes+\'" src='));
  assert.ok(js.includes("routeIcon.label"),"Route mode must retain a screen-reader label");
  assert.ok(!js.includes('class="cs-utility-route"'),"Text capsules must be removed");
  assert.ok(!css.includes(".cs-utility-route{"),"Capsule styling must be removed");
  assert.ok(css.includes('height:calc(clamp(12px,1.2vw,14.4px) + 11.2px)'));
  assert.ok(css.includes('height:calc(clamp(12px,1.2vw,14.4px) + 8px)'));
  assert.match(css,/#cs-root \.cs-utility-route-icon\{[^}]*width:auto;max-width:none;flex:none;align-self:center;object-fit:contain/);
  // The desktop and compact/mobile values are exactly 80% of the old size.
  for(const [previous,reduced] of [[15,12],[18,14.4],[14,11.2],[10,8]])
    assert.ok(Math.abs(reduced/previous-.8)<1e-10);
});
test("Cloud, Direct, Local, and External SVGs use independent exact relative scaling at all breakpoints",()=>{
  // Initial heights were reduced to 80% in the previous revision. These
  // factors apply to that current state, not to the original capsule sizes.
  const scales={cloud:.9,direct:.85,local:.8,ported:1.1};
  const parts=css.split("@media(max-width:639px){");
  assert.equal(parts.length,2,"Keep the mobile breakpoint and overrides");
  const findSizes=(source,mode)=>{
    const start=source.indexOf("#cs-root .cs-utility-route-icon--"+mode+"{height:calc(clamp(");
    assert.ok(start>=0,"Missing "+mode+" responsive SVG sizing");
    const rule=source.slice(start,source.indexOf("}",start));
    const size=rule.match(/clamp\(([\d.]+)px,([\d.]+)vw,([\d.]+)px\) \+ ([\d.]+)px/);
    assert.ok(size,"SVG "+mode+" must be scaled using geometry-preserving height, not transforms");
    return size.slice(1).map(Number);
  };
  for(const [mode,scale] of Object.entries(scales)){
    const desktop=findSizes(parts[0],mode);
    const mobile=findSizes(parts[1],mode);
    for(const [sizes,base] of [[desktop,[12,1.2,14.4,11.2]],[mobile,[12,1.2,14.4,8]]])
      sizes.forEach((actual,i)=>assert.ok(Math.abs(actual-base[i]*scale)<1e-9,mode+" size factor at component "+i));
    assert.ok(!css.includes(".cs-utility-route-icon--"+mode+"{transform:"),"SVG must never be stretched using transform");
  }
  // Route is selected from a fixed allowlist before adding the variant class.
  assert.match(js,/Object\.hasOwn\(COLLECTION_ROUTE_ICONS,routes\)/);
  assert.ok(js.includes('class="cs-utility-route-icon cs-utility-route-icon--\'+routes+\'" src='));
  assert.match(css,/#cs-root \.cs-utility-route-icon\{[^}]*width:auto;max-width:none;flex:none;align-self:center;object-fit:contain/);
});

test("Collections API session expiry exposes safe owner-only reauthorization",()=>{
 assert.ok(js.includes('const COLLECTIONS_ACCESS_REAUTH="/api/colosseum/connect?return=collections"'));
 assert.match(js,/error instanceof TypeError\)throw accessReauthorizationError/);
 assert.ok(js.includes('error?.name==="AbortError"'),"Network timeout must remain distinct from expired Access");
 assert.ok(js.includes('response.status===403&&/Cloudflare owner verification required/i.test(body.error||"")'));
 assert.ok(js.includes('status.append(" ",link)'));
 assert.equal((js.match(/announce\(error.message,true,false,error.reauthorize===true\)/g)||[]).length,2);
 assert.ok(css.includes('#cs-root .cs-access-reauthorize'));
 assert.ok(edge.includes('if(state.owner&&new URL(request.url).searchParams.get("return")==="collections")'));
 assert.ok(edge.includes('return redirect("/app/#colosseum/collections",303);'));
 assert.ok(!js.includes("setInterval("),"No polling or repeated fetch on authentication failure");
});

test("Collections paginate, utilities scroll at no more than 480px with natural smaller height",()=>{
 assert.match(js,/pageSize:10/);
 assert.match(js,/data-cs-page="prev"/);
 assert.match(js,/data-cs-page="next"/);
 assert.match(js,/aria-current="page"/);
 assert.match(css,/\.cs-card\{[^}]*max-height:480px/);
 assert.doesNotMatch(css,/\.cs-card\{[^}]*min-height:480px/);
 assert.match(css,/\.cs-utility-list\{[^}]*overflow-y:auto/);
 assert.match(css,/\.cs-card\{[^}]*border-radius:24px/);
});
test("Selection mode changes Edit/Select to Remove/Cancel and hides dormant addition",()=>{
 assert.match(js,/if\(state\.selecting\)/);
 assert.match(js,/cs-danger" type="button" data-cs-action="remove"/);
 assert.match(js,/data-cs-action="cancel"/);
 assert.match(js,/data-cs-action="admit" disabled/);
 assert.match(js,/data-cs-action="edit"/);
 assert.match(js,/data-cs-action="select"/);
 assert.match(js,/if\(action==="admit"\)return/);
 assert.doesNotMatch(js,/request\("admit"/);
 assert.match(js,/new Set\(\)/);
});
test("Real writes are owner-protected, revision-bound, and preserve underlying catalog items",()=>{
 assert.match(edge,/const collections=pathname==="\/api\/colosseum\/collections"/);
 assert.match(edge,/if\(!state\.owner\)return json\(\{error:"Only the connected Colosseum administrator may manage collections/);
 assert.match(edge,/Cross-site collection management request denied/);
 assert.match(edge,/collection\.manage/);
 assert.match(js,/request\("create",\{name,description\}\)/);
 assert.match(js,/request\("edit",\{original_name:previous\.name,name,desc:description,expected_revision:revision\}\)/);
 assert.match(js,/request\("evict",\{name:col\.name,item_uids:uids,expected_revision:revision\}\)/);
 assert.match(js,/request\("destroy",\{name:col\.name,expected_revision:revision\}\)/);
 assert.match(js,/Underlying catalog items|underlying catalog items|underlying utilities/);
});
test("Source data is never fabricated and Refresh asks Colosseum for live data",()=>{
 assert.match(js,/const COLLECTIONS_API="\/api\/colosseum\/collections"/);
 assert.match(js,/cache:"no-store"/);
 assert.match(js,/credentials:"same-origin"/);
 assert.match(js,/request\("list",\{\},true\)/);
 assert.match(js,/request\("get",\{name:col\.name\}\)/);
 assert.match(js,/page\.next_cursor/);
 assert.match(js,/refreshButton\.addEventListener/);
});

test("Collections title uses the shared non-Home heading contract without custom offsets",()=>{
 const section=html.match(/<section class="view project-view" data-view="colosseum\/collections"[^>]*>([\s\S]*?)<\/section>/)?.[1]||"";
 assert.match(section,/^\s*<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
 assert.equal((section.match(/id="project-collections-title"/g)||[]).length,1);
 assert.match(section,/<div id="cs-root" class="cs-screen">/);
 assert.doesNotMatch(section,/<div class="cs-head-copy">[\s\S]*?<h1/);
 assert.doesNotMatch(css,/#cs-root \.cs-head h1/);
 assert.doesNotMatch(css,/padding-top:0/);
 assert.doesNotMatch(css,/\.content:has\(> \.view\[data-view="colosseum\/collections"/);
 assert.doesNotMatch(css,/\.content > \.view\[data-view="colosseum\/collections"\] > \.page-heading/);
 assert.doesNotMatch(css,/width:min\(1536px/);
 assert.doesNotMatch(css,/left:50%/);
 assert.doesNotMatch(css,/transform:translateX\(-50%\)/);
 assert.match(css,/#cs-root \.cs-wrap\{width:100%;margin:0;padding:0\}/);
 const common=src("sites/_apex/app/assets/workspace-enhancements.css");
 assert.match(common,/\.view:not\(\[data-view="home"\]\) > \.page-heading > h1/);
});

test("Collections uses one route-scoped black canvas without an overlay",()=>{
 const styles=src("sites/_apex/app/assets/collections.css");
 const wallpapers=src("sites/_apex/app/assets/workspace-wallpapers.css");
 const foundation=src("sites/_apex/assets/site-foundation.css");
 assert.match(styles,/html:has\(body > #workspace-shell \.view\[data-view="colosseum\/collections"\]:not\(\[hidden\]\)\)\s*\{\s*--ui-canvas:#0a0a0a;/);
 assert.doesNotMatch(styles,/#cs-root\s*\{[^}]*background:/);
 assert.match(wallpapers,/html:has\(body > #workspace-shell\)[\s\S]*?background:var\(--ui-canvas,#171717\)/);
 assert.match(wallpapers,/body:has\(> #workspace-shell\)[\s\S]*?background:var\(--ui-canvas,#171717\)/);
 assert.match(foundation,/--ui-canvas: #171717;/);
});

test("Collections summary uses the visitor's last successful refresh time and complete live count",async()=>{
 const {formatCollectionSummary}=await import("../sites/_apex/app/assets/collections.js");
 assert.equal(formatCollectionSummary(new Date(2026,10,11,2,2),11),
   "TOTAL 11 / UPDATED 2:02 AM");
 assert.equal(formatCollectionSummary(new Date(2026,10,11,14,7),0),
   "TOTAL 0 / UPDATED 2:07 PM");
 assert.ok(html.includes('<span class="cs-eyebrow cs-summary-loading" id="cs-summary" aria-live="polite" aria-busy="true">'));
 assert.doesNotMatch(html,/COLOSSEUM \/ COLLECTION LIBRARY/);
 assert.ok(js.includes('summaryValue.textContent=formatCollectionSummary(refreshedAt,state.collections.length)'));
 assert.match(js,/const distinct=good\.filter/);
 assert.match(js,/state\.collections=orderedCollectionTree\(distinct,state\.configEntries\)/);
 assert.match(js,/if\(seq!==state\.loadSeq\)return/);
 assert.match(css,/#cs-root \.cs-eyebrow\{[^}]*position:relative;[^}]*text-transform:uppercase/);
});
test("Collections positions both ring centers symmetrically around the complete space/slash/space delimiter",async()=>{
 const {collectionSummaryGeometry}=await import("../sites/_apex/app/assets/collections.js");
 const geometry=collectionSummaryGeometry(56.3,70.9,62.1,10);
 assert.deepEqual(geometry,[5.63,7.09,6.21]); // Stored in em for fluid font sizes.
 assert.equal(collectionSummaryGeometry(70,60,65,10),null);
 assert.equal(collectionSummaryGeometry(10,30,40,10),null);
 assert.equal(collectionSummaryGeometry(10,30,20,0),null);
 for(const [A,B] of [[5.63,7.09],[6.4,7.8],[9.2,10.9]]){
   const first=B/2,second=A+B/2,dividerMiddle=(A+B)/2;
   assert.equal(first,B/2);                 // TOTAL left (0) to delimiter right B
   assert.ok(Math.abs((first+second)/2-dividerMiddle)<1e-12); // Reflection
   assert.ok(Math.abs((dividerMiddle-first)-(second-dividerMiddle))<1e-12);
 }
 assert.match(css,/\.cs-summary-dot\{[^}]*left:calc\(var\(--cs-summary-group-end,8em\) \/ 2 - \.5em\)/);
 assert.match(css,/\.cs-summary-dot:last-child\{left:calc\(var\(--cs-summary-group-start,6em\) \+ var\(--cs-summary-group-end,8em\) \/ 2 - \.5em\)/);
 assert.match(css,/\.cs-summary-divider\{[^}]*left:var\(--cs-summary-slash-left,7em\)/);
 assert.doesNotMatch(css,/\.cs-summary-skeleton\{[^}]*gap:/);
 assert.match(js,/range\.setEnd\(text,index\+3\); \/\/ Both spaces AND the slash/);
 assert.match(js,/range\.setEnd\(text,index\+2\)/);
 assert.match(js,/window\.localStorage\.getItem\(SUMMARY_GEOMETRY_KEY\)/);
 assert.match(js,/window\.localStorage\.setItem\(SUMMARY_GEOMETRY_KEY,encoded\)/);
 assert.match(js,/let storedGeometry=initialGeometry\?JSON\.stringify\(initialGeometry\):null/);
 assert.match(js,/if\(persist&&encoded!==storedGeometry\)/);
 assert.match(js,/LEGACY_SUMMARY_SHIFT_KEY/);
 assert.match(js,/const oldSlash=shift\/em\+1\.75/);
 assert.match(js,/applyGeometry\(measureSeparator\(summaryValue\),true\)/);
 assert.doesNotMatch(js,/localStorage\.setItem\([^\n]*state\.collections/);
 assert.doesNotMatch(js,/ResizeObserver|requestAnimationFrame|setInterval/);
});

test("Collections content rises while maintaining a margin and the shared title position",()=>{
 assert.match(css,/#cs-root\{[^}]*margin-top:-44px/);
 assert.match(css,/#cs-root\{[^}]*min-height:70vh;margin-top:-44px;padding:0;/);
 assert.doesNotMatch(css,/#cs-root\{padding-bottom:66px\}/);
 assert.doesNotMatch(css,/#cs-root\{margin-top:-28px/);
 assert.match(html,/<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
 assert.doesNotMatch(css,/#cs-root \.cs-head h1/);
 assert.doesNotMatch(css,/#cs-root\{[^}]*position:absolute/);
});

test("Collapsed Collections rows are more compact on desktop and smaller again at minimum width",()=>{
 // The former mobile rule: vertical padding 20px on both sides, 16px text, line-height 1.4.
 const mobileSingleLineHeight=20*2+16*1.4;
 assert.equal(mobileSingleLineHeight,62.4); // historical upper bound
 assert.match(css,/--cs-row-height:54px/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root\{--cs-row-height:48px\}/);
 assert.match(css,/#cs-root \.cs-entry\{--cs-entry-border:0px\}/);
 assert.match(css,/#cs-root \.cs-entry\+\.cs-entry\{border-top:1px solid var\(--cs-border\);--cs-entry-border:1px\}/);
 assert.match(css,/#cs-root \.cs-trigger\{[^}]*min-height:calc\(var\(--cs-row-height\) - var\(--cs-entry-border\)\)/);
 assert.match(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-trigger\{padding:0 24px 0 0;align-items:center;transition-timing-function:cubic-bezier\(\.4,0,\.2,1\),var\(--cs-control-ease\)\}/);
 assert.match(css,/#cs-root \.cs-entry-title\{position:relative;display:grid;grid-template-rows:0fr;min-height:1lh;overflow:hidden\}/);
 assert.match(css,/#cs-root \.cs-trigger \.cs-entry-title\{[^}]*transition:color \.2s,grid-template-rows \.45s cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/#cs-root \.cs-entry:not\(\.cs-open\) \.cs-entry-title\{grid-template-rows:0fr;transition-timing-function:ease,cubic-bezier\(\.4,0,\.2,1\)\}/);
 assert.match(css,/#cs-root \.cs-entry-title \.cs-title-compact\{white-space:nowrap;text-overflow:ellipsis;opacity:1;transition:opacity \.14s linear\}/);
 assert.match(css,/#cs-root \.cs-trigger \.cs-entry-title\{[^}]*font-size:clamp\(14px,1\.35vw,16px\);line-height:1\.4/);
 assert.match(css,/#cs-root \.cs-entry\.cs-open \.cs-accordion-panel\{grid-template-rows:1fr/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-trigger\{padding:20px 24px 20px 0\}/);
 // No global height limit on expanded rows; long titles remain readable there.
 assert.doesNotMatch(css,/#cs-root \.cs-trigger\{[^}]*height:54px/);
 assert.doesNotMatch(css,/#cs-root \.cs-entry\.cs-open \.cs-trigger\{[^}]*height:/);
});

test("Collections inherits the shared horizontal content alignment without independent centering",()=>{
 assert.doesNotMatch(css,/width:min\(1536px/);
 assert.doesNotMatch(css,/#cs-root\s*\{[^}]*padding:0 clamp\(/);
 assert.doesNotMatch(css,/#cs-root \.cs-wrap\{[^}]*padding:0 24px/);
 assert.doesNotMatch(css,/#cs-root \.cs-wrap\{[^}]*max-width:1400px/);
 assert.match(css,/#cs-root \.cs-wrap\{width:100%;margin:0;padding:0\}/);
 const shared=src("sites/_apex/app/assets/workspace-wallpapers.css");
 assert.match(shared,/body:has\(> #workspace-shell\) \.content \{/);
 assert.match(html,/<div class="page-heading"><h1 id="project-collections-title">Collections<\/h1><\/div>/);
});
test("Collections remaining primary content typography scales continuously with window width",()=>{
 for(const selector of [
  "#cs-root .cs-eyebrow",
  "#cs-root .cs-trigger .cs-entry-title", "#cs-root .cs-description",
  "#cs-root .cs-card-label", "#cs-root .cs-utility-name"
 ]){
  const declarations=css.slice(css.indexOf(selector+"{")).match(/^[^}]*\}/)?.[0]||"";
  assert.match(declarations,/font-size:clamp\(/,selector+" must use fluid sizing");
 }
 assert.doesNotMatch(css,/\.cs-trigger \.cs-entry-title\{font-size:18px/);
 assert.doesNotMatch(css,/\.cs-card-label\{font-size:16px/);
});

test("Collections does not duplicate the live count and refresh time below the header",()=>{
 assert.ok(!js.includes('announce("Live Colosseum · "'));
 assert.ok(js.includes('summaryValue.textContent=formatCollectionSummary(refreshedAt,state.collections.length)'));
 assert.ok(js.includes('announce("");'));
 assert.ok(css.includes("#cs-root .cs-source:empty{display:none}"));
 assert.ok(css.includes('#cs-root .cs-source[data-error="true"]'));
 assert.ok(html.includes('<p id="cs-status" class="cs-source" role="status" aria-live="polite"></p>'));
});

test("Collections idle refresh icon uses Lucide rotate-cw with Apple-like stroke",()=>{
 const start=html.indexOf('<button class="cs-button" id="cs-refresh"');
 assert.ok(start>=0);
 const button=html.slice(start,html.indexOf("</button>",start)+9);
 assert.ok(button.includes('class="cs-refresh-icon lucide lucide-rotate-cw"'));
 assert.ok(button.includes('stroke="currentColor" stroke-width="1.7"'));
 assert.ok(button.includes('stroke-linecap="round" stroke-linejoin="round"'));
 assert.ok(button.includes('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>'));
 assert.ok(button.includes('<path d="M21 3v5h-5"/>'));
 assert.ok(button.endsWith("</svg></button>"),"Only the refresh icon should remain visible");
 assert.doesNotMatch(button,/<\/svg>\s*Refresh\s*<\/button>/);
 assert.ok(button.includes('aria-label="Refresh collections directly from Colosseum"'));
 assert.ok(css.includes('#cs-root #cs-refresh{width:36px;min-width:36px;height:36px;padding:0;gap:0;display:inline-flex;align-items:center;justify-content:center}'),
   "Keep idle icon and loading ring centered within the same square button");
 assert.ok(css.includes("#cs-root #cs-refresh .cs-refresh-icon{width:17px;height:17px;stroke-width:1.7}"));
 assert.ok(js.includes('refreshButton.addEventListener("click"'));
});


test("Expanded collection cards omit redundant Colosseum membership caption on desktop and mobile",()=>{
 assert.ok(!js.includes("Collection membership, directly from Colosseum"));
 assert.ok(!css.includes(".cs-caption{"),"Remove obsolete footer spacing");
 assert.ok(js.includes('const markup=selected?cardMarkup():"";'));
 assert.ok(js.includes("if(detail.innerHTML!==markup)detail.innerHTML=markup;"));
 assert.ok(js.includes("if(mobile.innerHTML!==markup)mobile.innerHTML=markup;"),
   "Desktop and mobile must use the same caption-free card");
 assert.ok(js.includes('Revision '),"Retain the actual collection revision and utility summary");
});

test("Collections loading summary uses two synchronized, text-colored circular skeletons",()=>{
 const start=html.indexOf('id="cs-summary"');
 const summary=html.slice(start,html.indexOf("</span></span>",start)+14);
 assert.ok(summary.includes('aria-busy="true"'));
 assert.ok(summary.includes('class="cs-summary-skeleton" aria-hidden="true"'));
 assert.equal((summary.match(/class="cs-summary-dot"/g)||[]).length,2);
 assert.ok(summary.includes('class="cs-summary-divider">/</span>'));
 assert.ok(css.includes('width:1em;height:1em;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;background:transparent;animation:cs-summary-spin 600ms linear infinite'));
 assert.ok(css.includes('@keyframes cs-summary-spin{to{transform:rotate(360deg)}}'));
 assert.equal((css.match(/animation:cs-summary-spin 600ms/g)||[]).length,2); // Both share one keyframe.
 assert.ok(!css.includes('background:currentColor;animation:cs-summary-pulse'));
 assert.ok(css.includes('#cs-root .cs-summary-loading .cs-summary-value{visibility:hidden}'));
 assert.doesNotMatch(css,/#cs-root \.cs-summary-loading \.cs-summary-value\{display:none/);
 assert.match(css,/#cs-root \.cs-summary-skeleton\{display:block;position:absolute;left:0;top:\.32em/);
 assert.ok(css.includes('#cs-root .cs-eyebrow:not(.cs-summary-loading) .cs-summary-skeleton{display:none}'));
 assert.ok(css.includes('#cs-root .cs-summary-dot{animation:none!important;opacity:.65}'));
 assert.ok(js.includes('setSummaryLoading(true);'));
 assert.ok(js.includes('setSummaryLoading(false);'));
 assert.ok(js.includes('summary.classList.toggle("cs-summary-loading",loading)'));
 assert.ok(js.includes('summary.setAttribute("aria-busy",String(loading))'));
 assert.ok(!js.includes("setInterval("));
});
test("Collections legacy live-status skeleton occupies no space, while failures can surface",()=>{
 assert.ok(html.includes('<p id="cs-status" class="cs-source" role="status" aria-live="polite"></p>'));
 assert.ok(css.includes('#cs-root .cs-source:not([data-visible="true"]){position:absolute;width:1px;height:1px;min-height:0;margin:0;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}'));
 assert.ok(js.includes('status.dataset.visible=error||visible?"true":"false"'));
 assert.ok(!js.includes('announce("Live Colosseum · "'));
 assert.ok(js.includes('setSummaryLoading(false); // Preserve last successful values if this refresh failed.'));
});

test("Collections refresh shows a fast arrow-free ring while both skeletons remain synchronized",()=>{
 assert.ok(js.includes('refreshButton.classList.toggle("cs-refreshing",loading)'));
 assert.ok(js.includes('refreshButton.setAttribute("aria-busy",String(loading))'));
 assert.ok(js.includes('summary.classList.toggle("cs-summary-loading",loading)'));
 assert.ok(js.includes('setSummaryLoading(true);'));
 assert.ok(js.includes('setSummaryLoading(false);'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing .cs-refresh-icon{display:none}'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing::before{content:"";display:inline-block;box-sizing:border-box;width:17px;height:17px;flex:none;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:cs-summary-spin 600ms linear infinite}'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing::before{animation:none!important}'));
 assert.ok(css.includes('@keyframes cs-summary-spin{to{transform:rotate(360deg)}}'));
 assert.ok(!css.includes('cs-refreshing .cs-refresh-icon{animation:'));
 assert.equal((css.match(/@keyframes cs-summary-spin/g)||[]).length,1);
 assert.equal((css.match(/animation:cs-summary-spin 600ms/g)||[]).length,2);
 assert.ok(!js.includes('setInterval('));
});

test("Collections update time inherits the shared unpadded-hour convention",async()=>{
 const {formatWorkspaceTime}=await import("../sites/_apex/app/assets/workspace-nav.js");
 const {formatCollectionSummary}=await import("../sites/_apex/app/assets/collections.js");
 const first=new Date(2026,10,11,2,43,9);
 assert.equal(formatWorkspaceTime(first,{hour12:true}),"2:43 AM");
 assert.equal(formatCollectionSummary(first,11),"TOTAL 11 / UPDATED 2:43 AM");
 const afternoon=new Date(2026,10,11,14,5,9);
 assert.equal(formatCollectionSummary(afternoon,7),"TOTAL 7 / UPDATED 2:05 PM");
 assert.ok(js.includes('import {formatWorkspaceTime} from "./workspace-nav.js"'));
 assert.ok(js.includes('formatWorkspaceTime(updatedAt,{hour12:true})'));
 assert.ok(!js.includes('updatedAt.toLocaleTimeString('));
});

test("Collection pagination captions contain only their dynamic range and total",()=>{
  assert.match(js,/const first=\(state\.page-1\)\*state\.pageSize\+1/);
  assert.match(js,/const total=state\.collections\.length/);
  assert.match(js,/textContent=state\.loaded\?[\s\S]*?first\+'–'\+Math\.min\(first\+state\.pageSize-1,state\.collections\.length\)\+' of '\+total:'0 of 0'/);
  assert.match(js,/if\(pages===1\)\{pagination\.innerHTML='';return;\}/);
  assert.doesNotMatch(js,/collections · directly from Colosseum/);
  for(const [total,page,expected] of [[12,1,"1–10 of 12"],[12,2,"11–12 of 12"],[10,1,"1–10 of 10"],[1,1,"1–1 of 1"],[0,1,"0 of 0"]]){
    const first=(page-1)*10+1;
    const label=total?first+"–"+Math.min(first+10-1,total)+" of "+total:"0 of 0";
    assert.equal(label,expected);
  }
});
test("Collections display ten live items per page and keep ordinary last-page pagination",()=>{
 const pageSize=10;
 const collections=Array.from({length:11},(_,i)=>({collection_id:"c"+i}));
 assert.match(js,/page:1,pageSize:10,selecting:false/);
 assert.match(js,/Math\.ceil\(state\.collections\.length\/state\.pageSize\)/);
 assert.match(js,/state\.collections\.slice\(\(state\.page-1\)\*state\.pageSize,state\.page\*state\.pageSize\)/);
 assert.equal(Math.ceil(collections.length/pageSize),2);
 assert.equal(collections.slice(0,pageSize).length,10);
 assert.equal(collections.slice(pageSize,2*pageSize).length,1);
 assert.match(js,/const first=\(state\.page-1\)\*state\.pageSize\+1/);
 assert.match(js,/Math\.min\(first\+state\.pageSize-1,state\.collections\.length\)/);
});

test("Collections canvas retains ten-row capacity with about fifteen percent more bottom breathing room",()=>{
 const row=54,capacity=10,borders=2,navMargin=25,navHeight=36;
 const countMargin=12,countLine=18,countTrailing=12;
 const reservedHeight=row*capacity+borders+navMargin+navHeight+countMargin+countLine+countTrailing;
 assert.equal(reservedHeight,645);
 assert.match(css,/#cs-root \.cs-layout\{[^}]*min-height:calc\(10 \* var\(--cs-row-height\) \+ 2px \+ 25px \+ 36px \+ 12px \+ 18px \+ 12px\)/);
 assert.match(css,/html:has\(body > #workspace-shell \.view\[data-view="colosseum\/collections"\]:not\(\[hidden\]\)\) body:has\(> #workspace-shell\) \.content\{padding-bottom:32px\}/);
 const sharedWallpaper=src("sites/_apex/app/assets/workspace-wallpapers.css");
 assert.match(sharedWallpaper,/body:has\(> #workspace-shell\) \.content \{[\s\S]*?padding-bottom:36px/);
 const previousGap=12+26,newGap=12+32;
 assert.equal(previousGap,38);
 assert.equal(newGap,44);
 assert.ok(Math.abs((newGap-previousGap)/previousGap-.15)<.01);
 assert.match(css,/#cs-root \.cs-trigger\{[^}]*min-height:calc\(var\(--cs-row-height\) - var\(--cs-entry-border\)\)/);
 assert.match(css,/#cs-root \.cs-pagination\{[^}]*margin-top:25px/);
 assert.match(css,/#cs-root \.cs-page\{[^}]*height:36px/);
 assert.match(css,/#cs-root \.cs-countline\{[^}]*margin-top:12px/);
 assert.match(css,/#cs-root\{[^}]*padding:0;/);
 assert.doesNotMatch(css,/#cs-root\{[^}]*padding:0 0 88px/);
 const mobile=css.slice(css.indexOf("@media(max-width:639px){"),css.indexOf("@media(prefers-reduced-motion:reduce){"));
 assert.doesNotMatch(mobile,/#cs-root\{padding-bottom:/);
 // Crucial: do not reserve rows inside the accordion (would pin navigation).
 assert.doesNotMatch(css,/#cs-root \.cs-accordion\{[^}]*min-height:/);
 assert.doesNotMatch(css,/#cs-root \.cs-collection-column\{[^}]*min-height:/);
 assert.match(css,/#cs-root \.cs-layout\{[^}]*align-items:start/);
 assert.doesNotMatch(js,/pageSize:7/);
});


test("Uploaded native SVGs replace only the requested sidebar icons in both shells",()=>{
  const preview=src("studio/sidebar/index.html");
  const navCss=src("sites/_apex/app/assets/workspace-theme.css");
  const workflow=src(".github/workflows/site.yml");
  const routes=[
    ["home","#home","dashboard"],
    ["collections","#colosseum/collections","collections"],
    ["settings","#settings","settings"],
    ["settings","#colosseum/settings","settings"]
  ];
  for(const markup of [html,preview]){
    for(const [route,href,icon] of routes){
      const link='<a class="nav-link" data-route="'+route+'" href="'+href+'"';
      assert.ok(markup.includes(link),'Missing navigation destination '+href);
      const row=markup.slice(markup.indexOf(link),markup.indexOf("</a>",markup.indexOf(link)));
      assert.ok(row.includes('class="nav-icon nav-icon-asset nav-icon-asset--'+icon+'"'),'Incorrect icon at '+href);
      assert.doesNotMatch(row,/<use href="#icon-(?:home|collections|settings)"/);
    }
    assert.match(markup,/data-route="projects"[^>]*><svg class="nav-icon"/);
    assert.match(markup,/data-route="providers"[^>]*><svg class="nav-icon"/);
  }
  assert.match(navCss,/\.nav-link \.nav-icon-asset\{[^}]*width:18px;height:18px;flex:0 0 18px;align-self:center/);
  assert.match(navCss,/-webkit-mask-size:contain;mask-size:contain/);
  for(const [name,view] of [
    ["dashboard-screen-sidebar-icon.v1.svg","0 0 28.9584 25.8029"],
    ["collections-screen-sidebar-icon.v1.svg","0 0 28.4799 27.6055"],
    ["settings-screen-sidebar-icon.v1.svg","0 0 26.7968 26.0794"],
    ["add-collection.v1.svg","0 0 31.9317 23.3643"]
  ]){
    const svg=src("sites/_apex/app/assets/"+name);
    assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes('viewBox="'+view+'"'),name+' geometry changed');
    assert.match(svg,/<path d="[^"]+" fill="white" fill-opacity="0\.85"\/>/);
    assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|<!DOCTYPE|<\?xml|\.png|data:image/i);
    assert.ok(workflow.includes('cp sites/_apex/app/assets/'+name+' dist/app/assets/'+name),'Missing Studio asset '+name);
    assert.ok(workflow.includes('test -s dist/app/assets/'+name),'Missing Studio asset check '+name);
  }
  for(const icon of ["dashboard","collections","settings"])
    assert.ok(navCss.includes('nav-icon-asset--'+icon),'Missing vector mask for '+icon);
});

test("Add collection uses ChatGPT's 36px white send-control geometry and black plus glyph",()=>{
  const desc="Organize your utilities into collections, inspect their live memberships, and manage what belongs together.";
  assert.ok(!html.includes(desc),"Removed introduction must remain absent");
  const start=html.indexOf('id="cs-summary"'),btn=html.indexOf('id="cs-create"'),refresh=html.indexOf('id="cs-refresh"');
  assert.ok(start>=0&&btn>start&&refresh>btn,"New collection remains beneath the live summary");
  const copy=html.slice(html.lastIndexOf('<div class="cs-head-copy">',start),html.indexOf('</div>',start));
  assert.ok(copy.includes('id="cs-create"'));
  assert.doesNotMatch(copy,/<p>/);
  assert.match(copy,/class="cs-create-control"/);
  assert.match(copy,/class="cs-create-icon-button" id="cs-create" type="button" aria-label="Add collection" aria-keyshortcuts="Meta\+Shift\+N"/);
  assert.match(copy,/class="cs-create-plus-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"/);
  assert.ok(copy.includes('M12 3.59998C12.5891 3.59998 13.0666 4.07754 13.0666 4.66664V10.9333H19.3333C19.9224 10.9333 20.4 11.4109 20.4 12C20.4 12.5891 19.9224 13.0666 19.3333 13.0666H13.0666V19.3333C13.0666 19.9224 12.5891 20.4 12 20.4C11.4109 20.4 10.9333 19.9224 10.9333 19.3333V13.0666H4.66664C4.07754 13.0666 3.59998 12.5891 3.59998 12C3.59998 11.4109 4.07754 10.9333 4.66664 10.9333H10.9333V4.66664C10.9333 4.07754 11.4109 3.59998 12 3.59998Z'),"Original 20px ChatGPT composer plus path must be preserved");
  assert.doesNotMatch(copy,/add-collection\.v1\.svg/);
  assert.match(css,/#cs-root \.cs-create-control\{[^}]*margin:16px 0 0 3\.5px/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*width:32\.4px;min-width:32\.4px;height:32\.4px;min-height:32\.4px/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*border-radius:999px/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*background:#fff;color:#101010/);
  assert.match(js,/createButton\.addEventListener\("click",\(\)=>openForm\("create"\)\)/);
});

test("Add collection tooltip mirrors ChatGPT timing and displays the Shift-Command-N shortcut",()=>{
  assert.match(html,/id="cs-create-tooltip" role="tooltip"/);
  assert.match(html,/>Add collection<\/span><span class="cs-create-tooltip-shortcut" aria-label="Shift Command N">/);
  assert.match(html,/<kbd>⇧<\/kbd><kbd>⌘<\/kbd><kbd>N<\/kbd>/);
  assert.match(css,/#cs-root \.cs-create-tooltip\{[^}]*top:calc\(100% \+ 5px\)/);
  assert.match(css,/#cs-root \.cs-create-tooltip\{[^}]*padding:7px 10px/);
  assert.match(css,/#cs-root \.cs-create-tooltip\{[^}]*border-radius:10px/);
  assert.match(css,/#cs-root \.cs-create-tooltip\{[^}]*font-size:12px;font-weight:520/);
  assert.match(css,/transition:opacity \.25s cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(css,/transition-delay:\.15s,\.15s,\.15s/);
  assert.match(css,/#cs-root \.cs-create-icon-button:focus-visible \+ \.cs-create-tooltip/);
  assert.match(js,/window\.addEventListener\("keydown",event=>\{/);
  assert.match(js,/!event\.shiftKey\|\|!event\.metaKey/);
  assert.match(js,/!routeActive\(\)\|\|root\.closest\("\.view"\)\?\.hidden\|\|state\.busy/);
  assert.match(js,/document\.querySelector\("dialog\[open\]"\)/);
  assert.match(js,/event\.preventDefault\(\);\s*openForm\("create"\)/);
});


test("Collections edit mode uses a pencil-to-check transition with Shift-Command-E",()=>{
 assert.match(html,/id="cs-edit" type="button" aria-label="Edit collections"/);
 assert.match(html,/aria-keyshortcuts="Meta\+Shift\+E"/);
 assert.match(html,/id="cs-edit-tooltip" role="tooltip"/);
 assert.match(html,/<kbd>⇧<\/kbd><kbd>⌘<\/kbd><kbd>E<\/kbd>/);
 assert.match(html,/class="cs-edit-pencil"/);
 assert.match(html,/class="cs-edit-check"/);
 assert.match(css,/#cs-root\.cs-editing \.cs-edit-pencil\{opacity:0/);
 assert.match(css,/#cs-root\.cs-editing \.cs-edit-check\{opacity:1/);
 assert.match(js,/event\.code!=="KeyE"/);
 assert.match(js,/if\(!routeActive\(\)\|\|root\.closest\("\.view"\)\?\.hidden/);
});

test("Collections reordering and hidden exposure use only revision-bound ID configuration",()=>{
 assert.match(js,/request\("configure",\{/);
 assert.match(js,/entries:state\.configEntries,expected_configuration_revision:state\.configRevision/);
 assert.match(js,/moveCollectionInConfiguration\(/);
 assert.match(js,/data-cs-drag/);
 assert.match(js,/data-cs-visibility/);
 assert.match(js,/draggable="true"/);
 assert.match(js,/class="cs-inline-name"/);
 assert.match(css,/#cs-root \.cs-visibility-toggle\{[\s\S]*?left:75%/);
 assert.match(css,/@keyframes cs-grip-enter/);
 assert.match(css,/\.cs-entry\.cs-drop-inside/);
 assert.doesNotMatch(js,/localStorage\.setItem\([^)]*config/);
 assert.doesNotMatch(js,/setInterval\(/);
});


test("Collections control swap uses synchronized 20px local fades at the list right edge",()=>{
 assert.match(css,/--cs-control-swap:480ms;--cs-control-ease:cubic-bezier\(\.22,1,\.36,1\)/);
 for(const name of ["cs-grip-enter-right","cs-chevron-exit-left","cs-grip-exit-left","cs-chevron-enter-right"]){
   assert.ok(css.includes("@keyframes "+name+"{"),name+" keyframes");
   assert.ok(css.includes("animation:"+name+" var(--cs-control-swap) var(--cs-control-ease) both"),name+" sync");
 }
 assert.match(css,/@keyframes cs-grip-enter-right\{\s*from\{transform:translate\(20px,-50%\);opacity:0\}\s*to\{transform:translate\(0,-50%\);opacity:1\}/);
 assert.match(css,/#cs-root\.cs-editing \.cs-drag-handle\{left:calc\(100% - 22px\);opacity:1;pointer-events:auto\}/);
 assert.doesNotMatch(css,/#cs-root\.cs-editing \.cs-drag-handle\{left:calc\(var\(--cs-depth/);
 assert.match(css,/#cs-root \.cs-inline-name\{[^}]*left:calc\(36px \+ var\(--cs-depth,0\) \* 17px\)/);
 assert.match(css,/@keyframes cs-grip-exit-left\{\s*from\{transform:translate\(0,-50%\);opacity:1\}\s*to\{transform:translate\(-20px,-50%\);opacity:0\}/);
 assert.match(css,/@keyframes cs-chevron-exit-left\{\s*from\{transform:translate\(0,-50%\);opacity:1\}\s*to\{transform:translate\(-20px,-50%\);opacity:0\}/);
 assert.match(css,/@keyframes cs-chevron-enter-right\{\s*from\{transform:translate\(20px,-50%\);opacity:0\}\s*to\{transform:translate\(0,-50%\);opacity:1\}/);
 assert.match(css,/#cs-root\.cs-editing \.cs-chevron\{opacity:0;right:0;transform:translate\(-20px,-50%\)\}/);
 for(const keyframe of ["cs-grip-enter-right","cs-chevron-exit-left","cs-grip-exit-left","cs-chevron-enter-right"]){
   const body=css.slice(css.indexOf("@keyframes "+keyframe+"{"),css.indexOf("@keyframes "+keyframe+"{")+200);
   assert.doesNotMatch(body,/left:-22px|right:calc\(100%|left:calc\(100%|right:-22px/,keyframe+" must not cross the list");
 }
 assert.match(js,/const off=editing/); 
 assert.match(js,/syncRowEditing\(\)/);
 assert.doesNotMatch(js,/requestAnimationFrame|setInterval|ResizeObserver|MutationObserver/);
});
test("Eye icons reveal promptly after the rearrangement animation completes",()=>{
 assert.ok(css.includes("transition:opacity 160ms var(--cs-control-ease),visibility 0s linear 160ms"));
 assert.ok(css.includes("#cs-root.cs-editing .cs-visibility-toggle{opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}"));
 assert.ok(css.includes("#cs-root .cs-visibility-toggle:disabled{opacity:0}"));
 assert.ok(js.includes("control.disabled=!state.editing||state.editTransitioning"));
 assert.ok(js.includes('await waitForVisualMotion(list.querySelector(".cs-drag-handle"),"cs-grip-enter-right")'));
 assert.ok(css.includes("--cs-control-swap:480ms"));
});
test("Visibility eyes fade into view before rearrangement handles finish entering",()=>{
 const selector="#cs-root.cs-editing.cs-entering-edit .cs-visibility-toggle:disabled{";
 const beginning=css.indexOf(selector);
 assert.ok(beginning>=0,"Entry overlap rule present");
 const rule=css.slice(beginning,css.indexOf("}",beginning)+1);
 assert.ok(rule.includes("visibility:visible;pointer-events:none"),"Eyes visible but inert during animation");
 assert.ok(rule.includes("animation:cs-eye-reveal-with-grip var(--cs-control-swap) linear both"),"Animation shares grip's 480ms timeline");
 assert.ok(css.includes("@keyframes cs-eye-reveal-with-grip{\n 0%,25%{opacity:0}\n 80%,100%{opacity:1}\n}"),"Eye fade completes before 480ms");
 assert.ok(css.includes("#cs-root .cs-visibility-toggle:disabled{opacity:0}"),"Hidden while not entering edit mode");
 assert.ok(js.includes("control.disabled=!state.editing||state.editTransitioning"),"Eye remains disabled during transition");
 assert.ok(css.includes("--cs-control-swap:480ms"));
});
test("Opening edit mode closes an expanded row with the white pencil-position ring",()=>{
 assert.match(js,/async function enterEditMode\(\)/);
 assert.match(js,/const panel=list\.querySelector\("\.cs-entry\.cs-open \.cs-accordion-panel"\)/);
 assert.match(js,/root\.classList\.add\("cs-closing-for-edit"\)/);
 assert.match(js,/await waitForVisualMotion\(panel,"grid-template-rows"\)/);
 assert.match(js,/root\.classList\.remove\("cs-closing-for-edit"\)/);
 assert.match(js,/if\(state\.editing\|\|state\.editTransitioning\|\|state\.collectionSelecting\|\|state\.collectionSelectTransitioning\)return;/);
 assert.match(js,/trigger\.disabled=locked/);
 assert.match(css,/#cs-root\.cs-closing-for-edit \.cs-edit-icon-button::after\{[^}]*border:1\.8px solid #fff/);
 assert.match(css,/animation:cs-edit-spin 600ms linear infinite/);
 assert.match(css,/#cs-root\.cs-editing \.cs-trigger:disabled/);
});
test("Mobile and desktop compact row components scale independently",()=>{
 assert.match(css,/#cs-root \.cs-trigger \.cs-num\{[^}]*width:24px;font-size:11px/);
 assert.match(css,/#cs-root \.cs-chevron\{[^}]*width:14px;height:14px/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-trigger \.cs-num\{width:22px;font-size:10px\}/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-trigger \.cs-entry-title\{font-size:clamp\(12\.5px,2\.7vw,14px\)\}/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?#cs-root \.cs-drag-handle svg\{width:13px;height:13px\}/);
 assert.match(css,/#cs-root \.cs-inline-name\{[\s\S]*?font-size:clamp\(14px,1\.35vw,16px\)/);
});
test("Add circle shrinks 10 percent, refresh is aligned right with edit/add at both breakpoints",()=>{
 assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*width:32\.4px;min-width:32\.4px;height:32\.4px;min-height:32\.4px/);
 assert.match(css,/#cs-root \.cs-create-plus-icon\{[^}]*width:18px;height:18px/);
 assert.match(css,/#cs-root \.cs-head\{[^}]*align-items:flex-end/);
 assert.match(css,/#cs-root \.cs-top-actions\{[^}]*align-self:flex-end;margin-left:auto/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-head\{flex-direction:row;align-items:flex-end;gap:10px\}/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-top-actions\{justify-content:flex-end;align-self:flex-end;margin-left:auto\}/);
});


test("Collections header has a white, unframed Select button after Edit with tooltip but no shortcut",()=>{
 const editIndex=html.indexOf('id="cs-edit" type="button"');
 const selectIndex=html.indexOf('id="cs-select-collections" type="button"');
 const refreshIndex=html.indexOf('id="cs-refresh"');
 assert.ok(editIndex>0&&selectIndex>editIndex&&refreshIndex>selectIndex,"Select must be immediately to the right of Edit");
 const button=html.slice(selectIndex,html.indexOf("</button>",selectIndex)+9);
 assert.ok(button.includes('aria-label="Select collections"'));
 assert.ok(button.includes('aria-pressed="false"'));
 assert.ok(button.includes('class="cs-select-glyph"'));
 assert.ok(button.includes('class="cs-select-done"'));
 assert.ok(!button.includes("aria-keyshortcuts"));
 assert.ok(html.includes('id="cs-select-tooltip" role="tooltip"'));
 const tooltip=html.slice(html.indexOf('id="cs-select-tooltip"'),html.indexOf("</span></span>",html.indexOf('id="cs-select-tooltip"'))+14);
 assert.ok(!tooltip.includes("<kbd>")&&!tooltip.includes("cs-create-tooltip-shortcut"),"Selection tooltip has no keyboard shortcut");
 const control=css.slice(css.indexOf("#cs-root .cs-select-icon-button{"),css.indexOf("}",css.indexOf("#cs-root .cs-select-icon-button{"))+1);
 assert.ok(control.includes("background:transparent"),"Icon must not be encased");
 assert.ok(control.includes("color:#f5f5f5"),"Icon should be white");
 assert.ok(css.includes("#cs-root.cs-collection-selecting .cs-select-done{opacity:1"));
 assert.ok(js.includes('selectButton.addEventListener("click",toggleCollectionSelectMode)'));
});
test("Collection selection is transient and cannot change Colosseum or existing utility membership",()=>{
 assert.ok(js.includes("collectionSelecting:false,selectedCollections:new Set(),collectionSelectTransitioning:false"));
 const beginning=js.indexOf("function toggleCollectionPick(button){");
 const end=js.indexOf("async function enterCollectionSelectMode(){",beginning);
 assert.ok(beginning>=0&&end>beginning);
 const toggle=js.slice(beginning,end);
 assert.ok(toggle.includes("state.selectedCollections.add(id)"));
 assert.ok(toggle.includes("state.selectedCollections.delete(id)"));
 assert.ok(toggle.includes('button.setAttribute("aria-pressed",String(!wasPicked))'));
 assert.ok(toggle.includes('button.setAttribute("aria-label"'));
 assert.ok(!/request\(|fetch\(|configure|localStorage|sessionStorage|collection\.edit/.test(toggle),"Selecting a bubble must not write or persist anything");
 assert.ok(js.includes('data-cs-pick="'));
 assert.ok(js.includes('const picked=state.selectedCollections.has(collection.collection_id)'));
 assert.ok(js.includes('state.selectedCollections.clear()'));
 assert.ok(js.includes('if(button.hasAttribute("data-cs-pick")){toggleCollectionPick(button);return;}'));
 assert.ok(js.includes('state.collectionSelecting=false;state.collectionSelectTransitioning=false;'));
 assert.ok(js.includes('if(state.collectionSelecting||state.collectionSelectTransitioning)resetCollectionSelectMode();'));
 assert.ok(js.includes('state.collectionSelecting?"Done selecting collections":"Select collections"'));
 assert.ok(!html.includes('id="cs-select-collections" type="button" aria-keyshortcuts='));
});
test("Selecting collections uses the same 480ms/20px right-edge control swaps as Edit",()=>{
 assert.ok(css.includes("#cs-root .cs-collection-pick{"));
 assert.ok(css.includes("right:0;display:grid;place-items:center"));
 assert.ok(css.includes("#cs-root.cs-collection-selecting .cs-chevron{opacity:0;right:0;transform:translate(-20px,-50%)}"));
 assert.ok(css.includes("#cs-root.cs-entering-selection .cs-chevron{animation:cs-chevron-exit-left var(--cs-control-swap) var(--cs-control-ease) both}"));
 assert.ok(css.includes("#cs-root.cs-leaving-selection .cs-chevron{animation:cs-chevron-enter-right var(--cs-control-swap) var(--cs-control-ease) both}"));
 assert.ok(css.includes("animation:cs-grip-enter-right var(--cs-control-swap) var(--cs-control-ease) both"));
 assert.ok(css.includes("animation:cs-grip-exit-left var(--cs-control-swap) var(--cs-control-ease) both"));
 assert.ok(css.includes("#cs-root.cs-collection-selecting .cs-collection-pick{opacity:1;visibility:visible;pointer-events:auto}"));
 assert.ok(css.includes("#cs-root .cs-collection-pick[aria-pressed=\"true\"] .cs-select-bubble{background:#fff;border-color:#fff;color:#101010}"));
 assert.ok(css.includes("#cs-root .cs-select-bubble{display:grid;place-items:center;width:18px;height:18px;border:1.5px solid currentColor;border-radius:999px"));
 assert.ok(css.includes("#cs-root .cs-select-bubble svg{width:12px;height:12px;opacity:0"));
 assert.ok(css.includes("#cs-root .cs-collection-pick:disabled{opacity:0;pointer-events:none}"));
 assert.ok(css.includes("#cs-root .cs-collection-pick{width:19px;height:26px}"),"Narrow-window selection control must scale down");
 assert.ok(js.includes('await waitForVisualMotion(list.querySelector(".cs-collection-pick"),"cs-grip-enter-right")'));
 assert.ok(js.includes('await waitForVisualMotion(list.querySelector(".cs-collection-pick"),"cs-grip-exit-left")'));
});
test("Select collapses an open collection with a white spinner before allowing selection",()=>{
 const start=js.indexOf("async function enterCollectionSelectMode(){");
 const end=js.indexOf("async function exitCollectionSelectMode(){",start);
 assert.ok(start>0&&end>start);
 const enter=js.slice(start,end);
 assert.ok(enter.indexOf('root.classList.add("cs-closing-for-selection")')<enter.indexOf('await waitForVisualMotion(panel,"grid-template-rows")'));
 assert.ok(enter.indexOf('await waitForVisualMotion(panel,"grid-template-rows")')<enter.indexOf('root.classList.remove("cs-closing-for-selection")'));
 assert.ok(enter.indexOf('root.classList.remove("cs-closing-for-selection")')<enter.indexOf('state.collectionSelecting=true'));
 assert.ok(enter.includes("state.activeId=null"));
 assert.ok(enter.includes("syncAccordion();renderCard();"));
 assert.ok(css.includes("#cs-root.cs-closing-for-selection .cs-select-icon-button::after{"));
 assert.ok(css.includes("border:1.8px solid #fff;border-top-color:transparent;border-radius:50%"));
 assert.ok(css.includes("animation:cs-edit-spin 600ms linear infinite"));
 assert.ok(css.includes("#cs-root.cs-closing-for-selection .cs-select-icon-button svg{opacity:0}"));
 assert.ok(js.includes("if(state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning)return;"),"Open must not expand during selecting");
 assert.ok(js.includes("const locked=state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning"));
});
test("Done resets checked bubble visuals after the exit animation, with no stale selection next time",()=>{
 const start=js.indexOf("function clearCollectionPicks(){");
 const end=js.indexOf("function toggleCollectionPick(button){",start);
 assert.ok(start>=0&&end>start,"Dedicated transient selection reset");
 const reset=js.slice(start,end);
 assert.ok(reset.includes("state.selectedCollections.clear()"));
 assert.ok(reset.includes('list.querySelectorAll(\'.cs-collection-pick[aria-pressed="true"]\')'));
 assert.ok(reset.includes('button.setAttribute("aria-pressed","false")'));
 assert.ok(reset.includes('button.setAttribute("aria-label","Select "+col.name)'));
 const exit=js.slice(js.indexOf("async function exitCollectionSelectMode(){"),js.indexOf("function resetCollectionSelectMode(){"));
 assert.ok(exit.indexOf('await waitForVisualMotion(list.querySelector(".cs-collection-pick"),"cs-grip-exit-left")')<exit.indexOf("clearCollectionPicks()"),"Wait for full exit fade before reset");
 assert.ok(js.includes('if(!button||state.busy||state.editTransitioning||state.collectionSelectTransitioning)return;'),"Do not paginate while controls are in flight");
});
test("Collection Edit and Select cannot overlap, selected rows survive pagination, and Done clears local selection",()=>{
 assert.ok(js.includes("editButton.disabled=state.busy||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning"));
 assert.ok(js.includes("selectButton.disabled=state.busy||state.editing||state.editTransitioning||state.collectionSelectTransitioning"));
 assert.ok(js.includes("root.classList.toggle(\"cs-collection-selecting\",state.collectionSelecting)"));
 assert.ok(js.includes('pick.disabled=!state.collectionSelecting||state.collectionSelectTransitioning'));
 assert.ok(js.includes('if(pick.disabled)pick.setAttribute("aria-hidden","true")'));
 assert.ok(js.includes('if(state.collectionSelecting){void exitCollectionSelectMode();return;}'));
 const handler=js.slice(js.indexOf('pagination.addEventListener("click"'),js.indexOf('refreshButton.addEventListener("click"'));
 assert.ok(handler.includes("renderRows();renderCard()"));
 assert.ok(!handler.includes("state.selectedCollections.clear()"),"Pagination must preserve current selection");
 const exit=js.slice(js.indexOf("async function exitCollectionSelectMode(){"),js.indexOf("function resetCollectionSelectMode(){"));
 assert.ok(exit.includes("clearCollectionPicks()"));
 assert.ok(exit.includes('root.classList.add("cs-leaving-selection")'));
 assert.ok(exit.includes('root.classList.remove("cs-leaving-selection")'));
 assert.ok(!exit.includes('request('),"Done should never submit selection to server");
});


test("Utility icon centers share the exact External SVG-derived right-side reference axis",()=>{
 const external=src("sites/_apex/app/assets/external-provider.v1.svg");
 const match=external.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
 assert.ok(match,"External route SVG must preserve its intrinsic viewBox");
 const [, , , width,height]=match.map(Number);
 const referenceRatio=width/height;
 assert.ok(Math.abs(referenceRatio-1.19330855)<1e-7,"Slot must derive from External viewBox, not an estimated optical offset");
 const slotStart=css.indexOf("#cs-root .cs-utility-route-slot{");
 assert.ok(slotStart>=0,"Shared reference slot must exist");
 const slot=css.slice(slotStart,css.indexOf("}",slotStart)+1);
 assert.ok(slot.includes("--cs-ported-route-height:calc(clamp(13.2px,1.32vw,15.84px) + 12.32px)"));
 assert.ok(slot.includes("width:calc(var(--cs-ported-route-height) * 1.19330855)"));
 assert.ok(slot.includes("justify-content:center"));
 assert.ok(slot.includes("align-items:center"));
 assert.ok(slot.includes("flex:none;margin-left:auto;align-self:center"));
 assert.ok(css.includes("#cs-root .cs-utility-route-slot{--cs-ported-route-height:calc(clamp(13.2px,1.32vw,15.84px) + 8.8px)}"),"Mobile reference width must follow smaller External height");
 assert.ok(js.includes('<span class="cs-utility-route-slot"><img class="cs-utility-route-icon'),"Every SVG must be centered inside the SAME slot");
 assert.ok(css.includes("#cs-root .cs-utility-route-icon--ported{height:calc(clamp(13.2px,1.32vw,15.84px) + 12.32px)}"),"Desktop external retains its original pixel size");
 for(const route of ["cloud","direct","local","ported"]){
   assert.ok(css.includes("#cs-root .cs-utility-route-icon--"+route+"{height:"),"Preserve independently sized "+route+" icon");
 }
});
test("Select button has the same subtle bounding-box hover glow as Edit",()=>{
 const edit=css.slice(css.indexOf("#cs-root .cs-edit-icon-button:hover:not(:disabled){"),css.indexOf("}",css.indexOf("#cs-root .cs-edit-icon-button:hover:not(:disabled){"))+1);
 const select=css.slice(css.indexOf("#cs-root .cs-select-icon-button:hover:not(:disabled){"),css.indexOf("}",css.indexOf("#cs-root .cs-select-icon-button:hover:not(:disabled){"))+1);
 assert.ok(edit.includes("background:rgba(255,255,255,.065);color:#fff"));
 assert.ok(select.includes("background:rgba(255,255,255,.065);color:#fff"));
 assert.ok(css.includes("border-radius:10px;background:transparent;color:#f5f5f5;cursor:pointer;transition:color .15s ease,background-color .15s ease"));
});
test("Add, Edit, Select live inside the reconstructed ChatGPT composer background shell only",()=>{
 const start=html.indexOf('<div class="cs-control-center" role="group" aria-label="Collection controls">');
 assert.ok(start>0,"Expected self-contained control center");
 const end=html.indexOf("</div>",start);
 assert.ok(end>start);
 const inside=html.slice(start,end);
 for(const id of ['id="cs-create"','id="cs-edit"','id="cs-select-collections"'])
   assert.ok(inside.includes(id),"Must wrap "+id);
 assert.ok(!inside.includes('id="cs-refresh"'),"Refresh must remain outside the composer-like group");
 assert.ok(html.indexOf('id="cs-refresh"')>end);
 const styleStart=css.indexOf("#cs-root .cs-control-center{");
 assert.ok(styleStart>0);
 const block=css.slice(styleStart,css.indexOf("}",styleStart)+1);
 assert.ok(block.includes("background:#212121"),"Measured archived dark composer fill");
 assert.ok(!block.includes("background:#303030"),"Must not use bright elevated surface");
 assert.ok(block.includes("border:0 solid rgba(255,255,255,.05)"),"Computed border width was zero; border-color alone does not mean a visible border");
 assert.ok(!block.includes("border:1px"),"No 1px solid border is rendered");
 assert.ok(block.includes("border-radius:28px"),"Measured composer radius");
 assert.ok(block.includes("min-height:52px"),"Measured collapsed composer height");
 assert.ok(block.includes("padding:5px 8px"),"Measured composer vertical and horizontal inset");
 assert.ok(block.includes("background-clip:padding-box"),"Measured composer clipping behavior");
 assert.ok(block.includes("box-shadow:inset 0 0 1px rgba(255,255,255,.2)"),"Only nontransparent computed shadow is a 1px inset white blur");
 assert.ok(!block.includes("0 1px 2px rgba(0,0,0"),"No invented external shadow");
 assert.ok(block.includes("outline-style:none"),"Composer surface itself has no CSS outline");
 assert.ok(block.includes("width:max-content"),"Do not stretch toolbar across viewport");
 assert.ok(!css.includes("#cs-root .cs-control-center:hover{border-color:"),"Hover must not invent a border the composer lacks");
 assert.ok(!css.includes("#cs-root .cs-control-center:focus-within{border-color:"),"Focus must not invent a border; child focus-visible remains intact");
 for(const name of ["cs-create-control","cs-edit-control","cs-select-control"])
   assert.ok(css.includes(".cs-control-center > ."+name),"Control positions stay inside the existing shell");
 assert.ok(css.includes("Measured source: archived ui-decomposition.json"),"Reference the measured composer surface rather than the speculative reconstruction");
});
