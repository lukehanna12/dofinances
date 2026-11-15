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
 assert.ok(js.includes('for(const badge of root.querySelectorAll(".cs-summary .cs-inline-utility-count"))'));
 assert.ok(js.includes('if(badge.textContent!==label)badge.textContent=label'),
   "Footer badges update without rebuilding mounted controls");
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
    ported:"external-provider.v3.svg"
  };
  for(const [mode,file] of Object.entries(expected)){
    assert.ok(js.includes(mode+':{src:"/app/assets/'+file+'"'),
      "Missing exact SVG file mapping for "+mode);
    const svg=src("sites/_apex/app/assets/"+file);
    assert.ok(svg.startsWith("<svg "),file+" must remain a native SVG");
    assert.match(svg,/viewBox="[^"]+"/);
    assert.match(svg,/<path\s/);
    assert.match(svg,mode==="ported"?/fill="currentColor"/:/fill="white"/);
    assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\b(?:href|xlink:href)=|<!DOCTYPE|<\?xml|\.png|data:image/i);
  }
  const cloud=src("sites/_apex/app/assets/cloud-utility.v2.svg");
  assert.equal((cloud.match(/<path\s/g)||[]).length,1,
    "Cloud v2 must be a filled silhouette, without v1's inner outline cutout");
  assert.ok(js.includes('class="cs-utility-route-icon cs-utility-route-icon--\'+routes+\'" role="img" aria-label="'));
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
  assert.ok(parts.length>=2,"Keep the original mobile breakpoint and its overrides");
  // Other screen components also have their own max-width:639px blocks,
  // including the new skeletons. Find the one containing ALL route sizes.
  const mobilePart=parts.slice(1).find(part=>Object.keys(scales).every(mode=>
    part.includes("#cs-root .cs-utility-route-icon--"+mode+"{height:calc(")));
  assert.ok(mobilePart,"Missing responsive route icon breakpoint");
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
    const mobile=findSizes(mobilePart,mode);
    for(const [sizes,base] of [[desktop,[12,1.2,14.4,11.2]],[mobile,[12,1.2,14.4,8]]])
      sizes.forEach((actual,i)=>assert.ok(Math.abs(actual-base[i]*scale)<1e-9,mode+" size factor at component "+i));
    assert.ok(!css.includes(".cs-utility-route-icon--"+mode+"{transform:"),"SVG must never be stretched using transform");
  }
  // Route is selected from a fixed allowlist before adding the variant class.
  assert.match(js,/Object\.hasOwn\(COLLECTION_ROUTE_ICONS,routes\)/);
  assert.ok(js.includes('class="cs-utility-route-icon cs-utility-route-icon--\'+routes+\'" role="img" aria-label="'));
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
test("Utilities use persistent Done checkmarks and confirmed trash removal",()=>{
 assert.ok(js.includes('const UTILITY_DONE_SVG='));
 assert.ok(js.includes('class="cs-utility-trash"'));
 assert.ok(js.includes('src="/app/assets/trash-utilities.v1.svg"'));
 assert.ok(js.includes('data-cs-action="remove"'));
 assert.ok(js.includes('data-cs-action="admit" disabled'));
 assert.ok(js.includes('data-cs-action="edit"'));
 assert.ok(js.includes('data-cs-action="select"'));
 assert.ok(js.includes('aria-pressed="'));
 assert.ok(js.includes('if(action==="edit"){'));
 assert.ok(js.includes('if(localEditorActive()){void finishLocalEditor();return;}'));
 assert.ok(js.includes('if(action==="select"){'));
 assert.ok(js.includes('if(state.selecting){'));
 assert.ok(js.includes('if(action==="remove"){openEvictDialog();return;}'));
 assert.doesNotMatch(js,/data-cs-action="done"|data-cs-action="discard"|data-cs-action="cancel"/);
 assert.doesNotMatch(js,/request\("admit"/);
});
test("Real writes are owner-protected, revision-bound, and preserve underlying catalog items",()=>{
 assert.match(edge,/const collections=pathname==="\/api\/colosseum\/collections"/);
 assert.match(edge,/if\(!state\.owner\)return json\(\{error:"Only the connected Colosseum administrator may manage collections/);
 assert.match(edge,/Cross-site collection management request denied/);
 assert.match(edge,/collection\.manage/);
 assert.match(js,/request\("create",\{name,description\}\)/);
 assert.match(js,/request\("edit",\{original_name:col\.name,desc:description,expected_revision:revision\}\)/);
 assert.match(js,/request\("evict",\{name:pending\.name,item_uids:pending\.uids,expected_revision:pending\.revision\}\)/);
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
 assert.ok(css.includes('#cs-root #cs-refresh{width:32px;min-width:32px;height:32px;min-height:32px;padding:0;gap:0;display:inline-flex;align-items:center;justify-content:center}'),
   "Keep idle icon and loading ring centered within the same square button");
 assert.ok(css.includes("#cs-root #cs-refresh .cs-refresh-icon{width:14px;height:14px;stroke-width:1.7}"));
 assert.ok(js.includes('refreshButton.addEventListener("click"'));
});


test("Expanded collection cards omit redundant Colosseum membership caption on desktop and mobile",()=>{
 assert.ok(!js.includes("Collection membership, directly from Colosseum"));
 assert.ok(!css.includes(".cs-caption{"),"Remove obsolete footer spacing");
 assert.ok(js.includes('const markup=selected?cardMarkup():"";'));
 assert.ok(js.includes('if((selected||!layout.classList.contains("cs-detail-resizing"))&&detail.innerHTML!==markup)'),
   "Desktop card remains mounted during an exit but is replaced when switching open collections");
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

test("Refresh icon and its loading skeleton match the 14px collection search glyph and stay centered",()=>{ 
 const idle=css.slice(css.indexOf("#cs-root #cs-refresh .cs-refresh-icon{"),css.indexOf("}",css.indexOf("#cs-root #cs-refresh .cs-refresh-icon{"))+1);
 const busy=css.slice(css.indexOf("#cs-root #cs-refresh.cs-refreshing::before{"),css.indexOf("}",css.indexOf("#cs-root #cs-refresh.cs-refreshing::before{"))+1);
 const button=css.slice(css.indexOf("#cs-root #cs-refresh{"),css.indexOf("}",css.indexOf("#cs-root #cs-refresh{"))+1);
 assert.ok(idle.includes("width:14px;height:14px"));
 assert.ok(busy.includes("width:14px;height:14px"));
 assert.ok(button.includes("display:inline-flex;align-items:center;justify-content:center"));
 assert.ok(css.includes("#cs-root .cs-collection-search .cs-search-focus img{width:14px;height:14px}"));
 assert.ok(css.includes("#cs-root #cs-refresh{width:30px;min-width:30px;height:30px;min-height:30px}"));
 assert.ok(!idle.includes("width:17px")&&!busy.includes("width:17px"));
});
test("Collections refresh shows a fast arrow-free ring while both skeletons remain synchronized",()=>{
 assert.ok(js.includes('refreshButton.classList.toggle("cs-refreshing",loading)'));
 assert.ok(js.includes('refreshButton.setAttribute("aria-busy",String(loading))'));
 assert.ok(js.includes('summary.classList.toggle("cs-summary-loading",loading)'));
 assert.ok(js.includes('setSummaryLoading(true);'));
 assert.ok(js.includes('setSummaryLoading(false);'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing .cs-refresh-icon{display:none}'));
 assert.ok(css.includes('#cs-root #cs-refresh.cs-refreshing::before{content:"";display:inline-block;box-sizing:border-box;width:14px;height:14px;flex:none;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:cs-summary-spin 600ms linear infinite}'));
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
  assert.match(js,/const total=matchingCollections\(\)\.length/);
  assert.match(js,/textContent=state\.loaded\?[\s\S]*?first\+'–'\+Math\.min\(first\+state\.pageSize-1,total\)\+' of '\+total:'0 of 0'/);
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
 assert.match(js,/Math\.ceil\(matchingCollections\(\)\.length\/state\.pageSize\)/);
 assert.match(js,/matchingCollections\(\)\.slice\(\(state\.page-1\)\*state\.pageSize,state\.page\*state\.pageSize\)/);
 assert.equal(Math.ceil(collections.length/pageSize),2);
 assert.equal(collections.slice(0,pageSize).length,10);
 assert.equal(collections.slice(pageSize,2*pageSize).length,1);
 assert.match(js,/const first=\(state\.page-1\)\*state\.pageSize\+1/);
 assert.match(js,/Math\.min\(first\+state\.pageSize-1,total\)/);
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
    ["utilities","#colosseum/utilities","utilities"],
    ["collections","#colosseum/collections","collections"],
    ["providers","#colosseum/providers","providers"],
    ["permissions","#colosseum/permissions","permissions"],
    ["diagnostics","#colosseum/diagnostics","diagnostics"],
    ["settings","#settings","settings"],
    ["settings","#colosseum/settings","settings"]
  ];
  for(const markup of [html,preview]){
    for(const [route,href,icon] of routes){
      const link='<a class="nav-link" data-route="'+route+'" href="'+href+'"';
      assert.ok(markup.includes(link),'Missing navigation destination '+href);
      const row=markup.slice(markup.indexOf(link),markup.indexOf("</a>",markup.indexOf(link)));
      assert.ok(row.includes('class="nav-icon nav-icon-asset nav-icon-asset--'+icon+'"'),'Incorrect icon at '+href);
      assert.doesNotMatch(row,/<use href="#icon-(?:home|utilities|collections|providers|permissions|diagnostics|settings)"/);
    }
    assert.match(markup,/data-route="projects"[^>]*><svg class="nav-icon"/);
    assert.ok(markup.includes('data-route="apple-hig-reader/overview"'),"Keep HIG navigation untouched");
  }
  assert.match(navCss,/\.nav-link \.nav-icon-asset\{[^}]*width:18px;height:18px;flex:0 0 18px;align-self:center/);
  assert.match(navCss,/-webkit-mask-size:contain;mask-size:contain/);
  for(const [name,view] of [
    ["dashboard-screen-sidebar-icon.v1.svg","0 0 28.9584 25.8029"],
    ["collections-screen-sidebar-icon.v1.svg","0 0 28.4799 27.6055"],
    ["settings-screen-sidebar-icon.v1.svg","0 0 26.7968 26.0794"],
    ["utilities-screen-sidebar-icon.v1.svg","0 0 29.3483 29.6524"],
    ["providers-screen-sidebar-icon.v1.svg","0 0 32.4458 30.9494"],
    ["permissions-screen-sidebar-icon.v2.svg","0 0 20.5504 25.5361"],
    ["diagnostics-screen-sidebar-icon.v1.svg","0 0 27.9802 22.8475"],
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
  for(const icon of ["dashboard","utilities","collections","providers","permissions","diagnostics","settings"])
    assert.ok(navCss.includes('nav-icon-asset--'+icon),'Missing vector mask for '+icon);
});

test("Add collection preserves native plus.circle.fill geometry before dock enlargement",()=>{
  const desc="Organize your utilities into collections, inspect their live memberships, and manage what belongs together.";
  assert.ok(!html.includes(desc),"Removed introduction must remain absent");
  const start=html.indexOf('id="cs-summary"'),btn=html.indexOf('id="cs-create"'),refresh=html.indexOf('id="cs-refresh"');
  assert.ok(start>=0&&btn>start&&refresh>btn,"New collection remains beneath the live summary");
  const copy=html.slice(html.lastIndexOf('<div class="cs-head-copy">',start),html.indexOf('</div>',start));
  assert.ok(copy.includes('id="cs-create"'));
  assert.doesNotMatch(copy,/<p>/);
  assert.match(copy,/class="cs-create-control"/);
  assert.match(copy,/class="cs-create-icon-button" id="cs-create" type="button" aria-label="Add collection" aria-keyshortcuts="Meta\+Shift\+N"/);
  assert.match(copy,/class="cs-create-plus-icon" width="32" height="32" src="\/app\/assets\/add-collection\.v3\.svg"/);
  assert.ok(copy.includes('add-collection.v3.svg'),"The native plus.circle.fill asset is used");
  assert.ok(src("sites/_apex/app/assets/add-collection.v3.svg").includes('color="#fff"'),"Whole circular symbol renders light on the dark canvas");
  assert.doesNotMatch(copy,/add-collection\.v1\.svg/);
  assert.match(css,/#cs-root \.cs-create-control\{[^}]*margin:16px 0 0 3\.5px/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*width:32\.4px;min-width:32\.4px;height:32\.4px;min-height:32\.4px/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*border-radius:999px/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*background:transparent;color:#fff;line-height:0/);
  assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*box-shadow:none/);
  assert.match(css,/#cs-root \.cs-create-icon-button:hover:not\(:disabled\)\{background:transparent;box-shadow:none\}/);
  assert.match(js,/createButton\.addEventListener\("click",\(\)=>\{if\(!localEditorActive\(\)\)openForm\("create"\);\}\)/);
});

test("Add collection tooltip preserves shortcut timing and floats above the new dock",()=>{
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


test("Collection names use a gray inline pencil, live-width underline, and caret synchronized to the line",async()=>{
  const {collectionInlineNameWidth}=await import("../sites/_apex/app/assets/collections.js");
  assert.equal(collectionInlineNameWidth(49.25,300),60,"Measured glyphs extend a little past the name");
  assert.equal(collectionInlineNameWidth(120,300),130,"Longer names widen the underline proportionally");
  assert.equal(collectionInlineNameWidth(900,170),144,"Long names stop before the eye action");
  assert.equal(collectionInlineNameWidth(0,170),24,"Empty names keep a usable minimum width");
  assert.equal(collectionInlineNameWidth(25,40),24,"Narrow viewports remain bounded");
  assert.match(js,/const NAME_PENCIL='<svg[^']+stroke-width="1\.65"/);
  assert.match(js,/data-cs-start-rename/);
  assert.match(js,/class="cs-name-field"/);
  assert.match(js,/class="cs-name-measure"/);
  assert.match(js,/class="cs-name-underline"/);
  assert.match(css,/#cs-root \.cs-name-pencil\{[^}]*color:#979797;cursor:pointer/);
  assert.match(css,/#cs-root \.cs-inline-name\{[^}]*color:#dedede;-webkit-text-fill-color:#dedede/);
  assert.match(css,/#cs-root \.cs-name-underline\{[^}]*height:1px/);
  assert.match(css,/transform:scaleX\(0\);transform-origin:left center/);
  assert.match(css,/transition:transform 205ms cubic-bezier\(\.14,1,\.25,1\)/);
  assert.match(css,/#cs-root \.cs-underline-extended \.cs-name-underline\{transform:scaleX\(1\)\}/);
  assert.match(css,/#cs-root \.cs-caret-pending \.cs-inline-name\{caret-color:transparent\}/);
  assert.match(js,/underline\.addEventListener\("transitionend",event=>/);
  assert.match(js,/state\.renameEpoch===renameEpoch&&field\.isConnected/,"A stale animation cannot reveal the next editor's caret");
  assert.match(css,/#cs-root \.cs-name-field\{[^}]*right:calc\(25% \+ 18px\)/,"Keep pencil clear of eye icon");
  assert.match(js,/event\.propertyName==="transform"\)revealCaret\(\)/);
  assert.match(js,/input\.focus\(\{preventScroll:true\}\)/);
  assert.match(js,/input\.setSelectionRange\(input\.value\.length,input\.value\.length\)/);
  assert.doesNotMatch(css,/border-bottom:1px dashed #666/,"Old dashed rename border is removed");
});
test("Click-away or Enter commits a row draft locally; Escape restores it before Done saves changes",()=>{
  assert.match(js,/function finishInlineRename\(restore=false\)/);
  assert.match(js,/function beginInlineRename\(button\)/);
  assert.match(js,/list\.addEventListener\("focusout",event=>/);
  assert.match(js,/document\.addEventListener\("pointerdown",event=>/);
  assert.match(js,/if\(field&&!field\.contains\(event\.target\)\)finishInlineRename\(\)/);
  assert.match(js,/finishInlineRename\(event\.key==="Escape"\)/);
  assert.match(js,/if\(restore\)input\.value=state\.renameInitialValue/);
  assert.match(js,/state\.nameDrafts\.set\(id,input\.value\)/);
  assert.match(js,/async function finishEditMode\(\)\{[\s\S]*?finishInlineRename\(\)/);
  assert.match(js,/request\("edit",\{\s*original_name:collection\.name,[\s\S]*?expected_revision:collection\.revision/);
  assert.match(js,/if\(state\.renamingId===input\.dataset\.csName\)syncInlineRenameActions\(field\)/);
  assert.match(js,/measure\.textContent=input\.value\|\|" "/);
  assert.doesNotMatch(js,/setInterval\(|ResizeObserver|MutationObserver|requestAnimationFrame/);
});

test("Rename circles: conditional white checkmark, persistent gray X, and safe focus behavior",async()=>{
 const {collectionInlineNameChanged}=await import("../sites/_apex/app/assets/collections.js");
 assert.equal(collectionInlineNameChanged("Projects","Projects"),false);
 assert.equal(collectionInlineNameChanged("Projects","  Projects  "),false);
 assert.equal(collectionInlineNameChanged("My   projects","My projects"),false);
 assert.equal(collectionInlineNameChanged("Projects","New Projects"),true);
 assert.equal(collectionInlineNameChanged("Projects","Projects!"),true);
 assert.equal(collectionInlineNameChanged("Projects",""),true);
 assert.match(js,/const NAME_APPLY='<svg[^']+<path d="m5 12\.5/);
 assert.match(js,/const NAME_CANCEL='<svg[^']+<path d="M18 6 6 18M6 6l12 12"/);
 assert.match(js,/class="cs-name-actions" hidden/);
 assert.match(js,/class="cs-name-confirm"[^\n]*hidden|class="cs-name-action cs-name-confirm"[^\n]*hidden/);
 assert.match(js,/class="cs-name-action cs-name-cancel"/);
 assert.match(js,/confirm\.hidden=!changed/);
 assert.match(js,/actions\.hidden=false/);
 assert.match(js,/actions\.hidden=true/);
 assert.match(js,/field\.classList\.toggle\("cs-name-changed",changed\)/);
 assert.match(js,/finishInlineRename\(true\);pencil\?\.focus/);
 assert.match(js,/finishInlineRename\(\);pencil\?\.focus/);
 assert.match(js,/\.contains\(event\.relatedTarget\)\)return/);
 assert.match(js,/state\.nameDrafts\.set\(id,input\.value\)/);
 assert.match(css,/#cs-root \.cs-name-action\{[^}]*border:1px solid var\(--cs-border\);border-radius:50%;background:var\(--cs-weak\)/);
 assert.match(css,/#cs-root \.cs-name-confirm\{background:#fff;border-color:#fff;color:#101010\}/);
 assert.match(css,/#cs-root \.cs-name-cancel svg\{stroke-width:1\.9\}/);
 assert.match(css,/#cs-root \.cs-renaming \.cs-name-pencil\{display:none\}/);
 assert.match(css,/#cs-root \.cs-renaming\.cs-name-changed \.cs-name-editor\{max-width:calc\(100% - 60px\)\}/);
 assert.match(js,/collectionInlineNameWidth\(measure\.getBoundingClientRect\(\)\.width,/);
 assert.match(js,/field\.clientWidth-\(reserved-26\)/);
 assert.match(js,/input\.setSelectionRange\(input\.value\.length,input\.value\.length\)/);
 assert.match(js,/event\.propertyName==="transform"\)revealCaret\(\)/);
});

test("Refresh has an icon-only button with an anchored hover and keyboard-focus tooltip",()=>{
 const start=html.indexOf('<span class="cs-refresh-control">');
 assert.ok(start>=0,"Tooltip must be anchored to the refresh icon, not a shared menu");
 const wrap=html.slice(start,html.indexOf("</span></span>",start)+14);
 assert.ok(wrap.includes('id="cs-refresh"'));
 assert.ok(wrap.includes('aria-describedby="cs-refresh-tooltip"'));
 assert.ok(wrap.includes('id="cs-refresh-tooltip" role="tooltip"'));
 assert.ok(wrap.includes('>Refresh</span>'));
 assert.ok(wrap.includes('aria-keyshortcuts="Control+Shift+R"'));
 assert.ok(wrap.includes('class="cs-create-tooltip-shortcut" aria-label="Control Shift R"'));
 assert.ok(wrap.includes('<kbd>⌃</kbd><kbd>⇧</kbd><kbd>R</kbd>'));
 assert.match(css,/#cs-root \.cs-refresh-control\{position:relative;display:inline-flex;width:32px;height:32px/);
 assert.match(css,/#cs-root \.cs-refresh-control \.cs-create-tooltip\{left:auto;right:0/);
 assert.match(css,/#cs-root \.cs-refresh-control:hover \.cs-create-tooltip/);
 assert.match(css,/#cs-root #cs-refresh:focus-visible \+ \.cs-create-tooltip/);
});

test("Collections Control-Shift-R refresh shortcut is route-scoped and ignores unsafe targets",()=>{
  const code=js.slice(js.indexOf("// Refresh the current Collections inventory"),js.indexOf('createButton.addEventListener("click"'));
  assert.ok(code.includes('window.addEventListener("keydown",event=>{'));
  assert.ok(code.includes('!event.ctrlKey||!event.shiftKey||event.metaKey||event.altKey'));
  assert.ok(code.includes('event.code!=="KeyR"&&event.key?.toLowerCase()!=="r"'));
  assert.ok(code.includes('!routeActive()||root.closest(".view")?.hidden'));
  assert.ok(code.includes('refreshButton.disabled||document.querySelector("dialog[open]")'));
  assert.ok(code.includes('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
  assert.ok(code.includes('event.defaultPrevented||event.isComposing||event.repeat'));
  assert.match(code,/event\.preventDefault\(\);\s*void loadList\(\)/);
  assert.ok(code.includes('},{capture:true});'));
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
 assert.match(css,/#cs-root \.cs-name-field\{[^}]*left:calc\(36px \+ var\(--cs-depth,0\) \* 17px\)/);
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
 assert.ok(js.includes("control.disabled=!canEdit"),"Rearrangement controls disable during entry and exit");
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
 assert.ok(js.includes("control.disabled=!canEdit"),"Eye remains disabled during transition");
 assert.ok(css.includes("--cs-control-swap:480ms"));
});
test("Opening edit mode closes an expanded row with the white pencil-position ring",()=>{
 assert.match(js,/async function enterEditMode\(\)/);
 assert.match(js,/const panel=list\.querySelector\("\.cs-entry\.cs-open \.cs-accordion-panel"\)/);
 assert.match(js,/root\.classList\.add\("cs-closing-for-edit"\)/);
 assert.match(js,/await waitForVisualMotion\(panel,"grid-template-rows"\)/);
 assert.match(js,/root\.classList\.remove\("cs-closing-for-edit"\)/);
 assert.match(js,/if\(state\.editTransitioning\|\|state\.collectionSelecting\|\|state\.collectionSelectTransitioning\|\|localEditorActive\(\)\)return;/);
 assert.match(js,/trigger\.disabled=locked/);
 assert.match(js,/const locked=state\.editing\|\|state\.editTransitioning\|\|state\.collectionSelecting\|\|state\.collectionSelectTransitioning/);
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
test("Add, Edit and Select share a 32.4px circular form factor",()=>{
 for(const button of ["create","edit","select"]){
   const selector="cs-"+button+"-icon-button",start=css.indexOf("#cs-root ."+selector+"{");
   assert.ok(start>=0);
   const block=css.slice(start,css.indexOf("}",start));
   assert.ok(block.includes("width:32.4px;min-width:32.4px;height:32.4px;min-height:32.4px"));
   assert.ok(block.includes("border-radius:999px"));
 }
 for(const button of ["edit","select"]){
   assert.ok(css.includes("#cs-root .cs-"+button+"-control{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px"));
   assert.ok(css.includes("border-radius:999px;background:transparent;color:#f5f5f5"));
 }
});

test("Collection search and Refresh occupy one aligned row, retaining list width",()=>{
 const start=html.indexOf('<div class="cs-collection-search-row">');
 const end=html.indexOf('<div class="cs-accordion"',start);
 assert.ok(start>=0&&end>start);
 const markup=html.slice(start,end);
 assert.ok(markup.indexOf('id="cs-collection-search"')>0);
 assert.ok(markup.indexOf('id="cs-refresh"')>markup.indexOf('id="cs-collection-search"'));
 assert.ok(!html.includes('class="cs-top-actions"'));
 assert.ok(css.includes("#cs-root .cs-collection-search-row{display:flex;align-items:center;gap:10px;min-width:0;position:relative;z-index:4;margin-bottom:15px}"));
 assert.ok(css.includes("#cs-root .cs-collection-search{flex:1 1 0;min-width:0}"));
 assert.match(css,/#cs-root \.cs-search-focus\{[^}]*position:absolute;inset:0;display:grid;place-items:center;width:100%;height:100%/);
 assert.match(css,/#cs-root #cs-refresh\{width:32px;min-width:32px;height:32px;min-height:32px/);
 assert.ok(css.includes("#cs-root .cs-search-focus{width:100%;height:100%}"));
 assert.ok(css.includes("#cs-root #cs-refresh{width:30px;min-width:30px;height:30px;min-height:30px}"));
 assert.match(css,/#cs-root \.cs-layout\.cs-detail-open\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,min\(var\(--cs-detail-max-width\),calc\(\(100% - 64px\) \* \.51219512195\)\)\)/);
});

test("Collections header has circular Select after Edit with tooltip and no shortcut",()=>{
 const editIndex=html.indexOf('id="cs-edit" type="button"');
 const selectIndex=html.indexOf('id="cs-select-collections" type="button"');
 const refreshIndex=html.indexOf('id="cs-refresh"');
 assert.ok(editIndex>0&&selectIndex>editIndex&&refreshIndex>selectIndex);
 const button=html.slice(selectIndex,html.indexOf("</button>",selectIndex)+9);
 assert.ok(button.includes('aria-label="Select collections"'));
 assert.ok(button.includes('aria-pressed="false"'));
 assert.ok(button.includes('class="cs-select-glyph"'));
 assert.ok(button.includes('class="cs-select-done"'));
 assert.ok(!button.includes("aria-keyshortcuts"));
 assert.ok(html.includes('id="cs-select-tooltip" role="tooltip"'));
 const tooltip=html.slice(html.indexOf('id="cs-select-tooltip"'),html.indexOf("</span></span>",html.indexOf('id="cs-select-tooltip"'))+14);
 assert.ok(!tooltip.includes("<kbd>")&&!tooltip.includes("cs-create-tooltip-shortcut"));
 const control=css.slice(css.indexOf("#cs-root .cs-select-icon-button{"),css.indexOf("}",css.indexOf("#cs-root .cs-select-icon-button{")));
 assert.ok(control.includes("border-radius:999px"));
 assert.ok(control.includes("color:#f5f5f5"));
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
 assert.ok(js.includes("if(state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning)return;"),"Global Edit and Select must not expand collection rows");
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


test("Every utility name and UID starts at a constant distance from the left edge",()=>{
 const start=js.indexOf("function cardMarkup(){");
 const rowStart=js.indexOf("const content=",start);
 const rowEnd=js.indexOf("return '<div class=\"cs-utility-row'",rowStart);
 assert.ok(start>=0&&rowStart>start&&rowEnd>rowStart);
 const row=js.slice(rowStart,rowEnd);
 assert.ok(row.includes("'<span class=\"cs-utility-route-slot\">'+"),
  "A leading slot must exist for every utility, even with an unknown route");
 assert.ok(row.indexOf("cs-utility-route-slot")<row.indexOf("cs-utility-info"));
 assert.ok(row.indexOf("cs-utility-info")<row.indexOf("cs-utility-trailing"));
 assert.doesNotMatch(row,/cs-dot/,"Do not draw the original left dot");
 assert.ok(row.includes('role="img" aria-label="'),"Keep route image accessibility");
 assert.equal((row.match(/cs-utility-route-slot/g)||[]).length,1,
  "Do not keep a redundant right-hand route icon");
 assert.match(css,/#cs-root \.cs-utility-route-slot\{[^}]*width:24px;min-width:24px;height:29px;flex:0 0 24px/);
 assert.match(css,/#cs-root \.cs-utility-route-slot\{width:21px;min-width:21px;height:24px;flex-basis:21px\}/);
 assert.match(css,/#cs-root \.cs-utility-row\{display:flex;align-items:center;gap:15px/);
 assert.match(css,/#cs-root \.cs-utility-row\{min-height:58px;gap:10px;padding:12px 12px/);
 assert.match(css,/#cs-root \.cs-utility-route-icon\{[^}]*transform:scale\(\.6\);transform-origin:center/);
 for(const route of ["cloud","direct","local","ported"])
  assert.ok(css.includes("#cs-root .cs-utility-route-icon--"+route+"{height:"),
   "Retain the exact measured intrinsic size of "+route+" before scaling 60%");
});
test("Collections stylesheet has balanced CSS declaration blocks",()=>{
 // A missing closing brace can swallow every subsequent selector while still
 // allowing superficial string assertions and the Vite build to pass.
 const withoutCommentsOrStrings=css.replace(/\/\*[\s\S]*?\*\//g,"")
   .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
 let depth=0;
 for(const ch of withoutCommentsOrStrings){
   if(ch==="{")depth++;
   if(ch==="}")depth--;
   assert.ok(depth>=0,"Unexpected closing brace in Collections CSS");
 }
 assert.equal(depth,0,"Unclosed declaration block in Collections CSS");
 for(const action of ["edit","select"]){
   const name="#cs-root .cs-"+action+"-icon-button{";
   const start=css.indexOf(name),end=css.indexOf("}",start);
   assert.ok(start>=0&&end>start,"Missing complete "+action+" style block");
   const style=css.slice(start,end+1);
   assert.ok(style.includes("border-radius:999px"));
   assert.ok(style.includes("background:transparent"));
   assert.ok(style.endsWith("transform .12s ease}"));
   assert.ok(css.slice(end+1).includes("#cs-root .cs-"+action+"-icon-button:hover:not(:disabled){"));
 }
});

test("Select and Edit remain visually unframed until hovered while retaining circular geometry",()=>{
 const edit=css.slice(css.indexOf("#cs-root .cs-edit-icon-button:hover:not(:disabled){"),css.indexOf("}",css.indexOf("#cs-root .cs-edit-icon-button:hover:not(:disabled){")));
 const select=css.slice(css.indexOf("#cs-root .cs-select-icon-button:hover:not(:disabled){"),css.indexOf("}",css.indexOf("#cs-root .cs-select-icon-button:hover:not(:disabled){")));
 assert.ok(edit.includes("background:rgba(255,255,255,.065);color:#fff"));
 assert.ok(select.includes("background:rgba(255,255,255,.065);color:#fff"));
 assert.ok(css.includes("border-radius:999px;background:transparent;color:#f5f5f5;cursor:pointer"));
  assert.ok(!css.includes("#cs-root.cs-editing .cs-edit-icon-button{background:"));
  assert.ok(!css.includes("#cs-root.cs-collection-selecting .cs-select-icon-button{background:"));
});

test("Add, Edit and Select keep their identities within the fixed frosted dock",()=>{
 const start=html.indexOf('<div class="cs-control-center" role="group" aria-label="Collection controls">');
 assert.ok(start>0,"Expected one self-contained control center");
 const end=html.indexOf("</div>",start);
 const inside=html.slice(start,end);
 for(const id of ['id="cs-create"','id="cs-edit"','id="cs-select-collections"'])
  assert.ok(inside.includes(id),"Preserve "+id+" and its click handlers");
 assert.ok(!inside.includes('id="cs-refresh"'),"Refresh remains in the list header");
 assert.ok(html.indexOf('id="cs-refresh"')>end);
 assert.equal((html.match(/class="cs-control-center"/g)||[]).length,1,"No cloned toolbar or duplicate IDs");
 const anchor=css.indexOf("#cs-root .cs-control-center{\n --cs-dock-scale:1.5;");
 assert.ok(anchor>0,"Expected the fixed dock's override after the legacy composer style");
 const block=css.slice(anchor,css.indexOf("}",anchor)+1);
 assert.ok(block.includes("--cs-dock-scale:1.5"));
 assert.ok(block.includes("position:fixed"));
 assert.ok(block.includes("background:rgba(14,15,17,.69)"),"Dock tint matches the lower topbar");
 assert.ok(block.includes("border:0"),"No fake glass rim");
 assert.ok(block.includes("box-shadow:none"),"No inset faux glass outline");
 assert.ok(block.includes("-webkit-backdrop-filter:blur(18px) saturate(120%)"),"Match topbar blur");
 assert.ok(block.includes("backdrop-filter:blur(18px) saturate(120%)"),"Match topbar blur");
 assert.ok(block.includes("width:max-content"),"Dock remains only as wide as its buttons");
 assert.ok(!block.includes("background:#212121"),"The legacy composer style is overridden");
 assert.ok(!css.includes(".cs-control-center.cs-oracle-ready{"),"No active SVG glass optics");
 assert.ok(css.includes(".cs-control-center::before,\n#cs-root .cs-control-center::after{\n content:none;"),
  "No fake glass light/shadow overlays");
 assert.ok(css.includes("font-size:13px;padding:10px 13px"),"Floating tooltips remain legible");
});

test("Collections anchors its top and bottom photo strips under the moving black surface only on this route",()=>{
  const shared=src("sites/_apex/app/assets/workspace-wallpapers.css");
  const start=css.indexOf("/* Collections only: pin the existing wallpaper crops");
  const end=css.indexOf("/* Collections screen:",start);
  assert.ok(start>0 && end>start);
  const scoped=css.slice(start,end);
  const route='html:has(body > #workspace-shell .view[data-view="colosseum/collections"]:not([hidden]))';
  const rules=[...scoped.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.equal(rules.length,5,"Only the five Collections-specific layout overrides are introduced");
  const get=ending=>{
    const matches=rules.filter(([,selector])=>selector.includes(route)&&selector.trim().endsWith(ending));
    assert.equal(matches.length,1,"Expected one Collections-only rule for "+ending);
    return matches[0][2];
  };
  // Shared artwork and footer retain their established document-flow layout.
  assert.match(shared,/position:absolute;\s*inset:calc\(-1 \* var\(--workspace-top-overpull\)\)/);
  assert.match(shared,/> \.workspace-footer \{\s*position:relative;/);
  assert.match(get("body:has(> #workspace-shell)"),/padding-bottom:var\(--workspace-footer-height\)/);
  assert.match(get("body:has(> #workspace-shell)::before"),/position:fixed/);
  assert.match(get("body:has(> #workspace-shell) > #workspace-shell"),/position:relative;\s*z-index:1/);
  assert.match(get("body:has(> #workspace-shell) > #workspace-shell::after"),
    /content:"";\s*position:absolute;\s*inset:var\(--workspace-banner-height\) 0 0;\s*z-index:-1;\s*pointer-events:none;\s*background:var\(--ui-canvas,#0a0a0a\)/);
  assert.match(get("body:has(> #workspace-shell) > .workspace-footer"),
    /position:fixed;\s*inset:auto 0 0;\s*z-index:0/);
  assert.match(html,/<footer class="workspace-footer" id="workspace-footer"[^>]*>© DoFinances · 2026<\/footer>/);
});

test("Rating half-star toggling follows 3/4/5-star examples and collapses zero into unrated",async()=>{
 const {validCollectionRating,nextCollectionRating}=await import("../sites/_apex/app/assets/collections.js");
 for(let i=0;i<=10;i++)assert.equal(validCollectionRating(i/2),true);
 assert.equal(validCollectionRating(null),true);
 for(const invalid of [-0.5,5.5,0.25,undefined,"4.5",NaN,Infinity])
   assert.equal(validCollectionRating(invalid),false);
 assert.equal(nextCollectionRating(3,0.5),0.5);
 assert.equal(nextCollectionRating(0.5,0.5),null);
 assert.equal(nextCollectionRating(4,4),3.5);
 assert.equal(nextCollectionRating(5,5),4.5);
 assert.equal(nextCollectionRating(4.5,5),5);
 assert.equal(nextCollectionRating(null,0.5),0.5);
 assert.equal(nextCollectionRating(0,0.5),0.5);
 assert.equal(nextCollectionRating(3.5,3.5),3);
 assert.equal(nextCollectionRating(3,2.5),2.5);
 assert.equal(nextCollectionRating(0.5,5),5);
 assert.equal(nextCollectionRating(3,3.25),null);
 assert.equal(nextCollectionRating(null,0),null);
});
test("Collection Edit has its own description and member editor, distinct from global organization editing",()=>{
 const section=html.slice(html.indexOf('id="cs-form-dialog"'),html.indexOf('id="cs-delete-dialog"'));
 assert.ok(!section.includes('id="cs-form-rating"'));
 assert.ok(!section.includes('id="cs-context"'));
 assert.ok(section.includes('id="cs-context-dialog"'));
 assert.ok(section.includes('id="cs-row-context" maxlength="250"'));
 assert.ok(!section.includes('id="cs-delete-open"'),"Deletion is available within local editing, not the create dialog");
 assert.ok(js.includes('memberDrafts:new Map(),localEditingId:null,descriptionDraft:null,descriptionEditing:false'));
 assert.ok(js.includes('function enterLocalEditor()'));
 assert.ok(js.includes('function finishLocalEditor()'));
 assert.ok(js.includes('function exitLocalEditor()'));
 assert.ok(js.includes('function beginDescriptionEdit()'));
 assert.ok(js.includes('function confirmDescriptionEdit()'));
 assert.ok(js.includes('function cancelDescriptionEdit()'));
 assert.ok(js.includes('class="cs-description-inline"'));
 assert.ok(js.includes('data-cs-description-start'));
 assert.ok(js.includes('data-cs-description-input'));
 assert.ok(js.includes('data-cs-description-confirm'));
 assert.ok(js.includes('data-cs-description-cancel'));
 assert.ok(js.includes('data-cs-description-editor'));
 assert.ok(css.includes('#cs-root .cs-description-underline'));
 assert.ok(css.includes('#cs-root .cs-description-underline-extended .cs-description-underline'));
 assert.ok(css.includes('#cs-root .cs-description-pencil'));
 assert.ok(css.includes('#cs-root .cs-description-actions'));
 assert.ok(js.includes('if(action==="edit"){'));
 assert.ok(js.includes('enterLocalEditor();return;'));
 assert.ok(js.includes('if(localEditorActive()){void finishLocalEditor();return;}'));
 assert.ok(!js.includes('data-cs-action="discard"'));
 assert.ok(!js.includes('>Delete collection</button>'),"Delete collection must not appear in Utility Edit mode");
 assert.ok(!js.includes('openForm("edit")'));
 assert.ok(!js.includes('cs-edit-utilities-open'));
 assert.ok(!css.includes('.cs-edit-utilities-open'));
});
test("Utility description pencil follows the last visible word with inline flow",()=>{
 assert.ok(js.includes('<div class="cs-description-read"><span class="cs-description" data-cs-description-read>'));
 assert.ok(js.includes("No description provided."));
 assert.ok(css.includes('#cs-root .cs-description-read{display:block;max-width:448px}'));
 assert.ok(css.includes('#cs-root .cs-description-read .cs-description{display:inline;margin:0;white-space:pre-line}'));
 assert.ok(css.includes('display:inline-grid;place-items:center;vertical-align:middle;margin-left:8px'));
 assert.ok(css.includes('#cs-root .cs-description-pencil{margin-left:7px}'));
 assert.ok(!css.includes('#cs-root .cs-description-read{display:flex;'));
});

test("Per-collection member hide/show is owner-only and scoped to that membership",()=>{
 const editor=js.slice(js.indexOf("const memberAnnotation=uid=>{"),js.indexOf("function readStoredGeometry()"));
 const card=js.slice(js.indexOf("function cardMarkup(){"),js.indexOf("function filterUtilityRows(){"));
 const save=js.slice(js.indexOf("async function finishLocalEditor(){"),js.indexOf("function openRowContext(uid){"));
 assert.ok(js.includes('const membershipKey=(collectionId,uid)=>collectionId+":"+uid'));
 assert.ok(editor.includes('const key=membershipKey(state.activeId,uid)'));
 assert.ok(editor.includes('hidden:value?.hidden===true'));
 assert.ok(editor.includes('typeof next.hidden!=="boolean"'));
 assert.ok(editor.includes('next.hidden===(original?.hidden===true)'));
 assert.ok(editor.includes('state.memberDrafts.set(membershipKey(state.activeId,uid),next)'));
 assert.ok(card.includes('const hiddenMember=annotation.hidden===true'));
 assert.ok(card.includes('class="cs-member-visibility-control"'));
 assert.ok(card.includes('data-cs-member-visibility='));
 assert.ok(card.includes('visibilityButton+contextButton+stars'),"Hide/show precedes Context, then stars");
 assert.ok(card.includes('Show in this collection'));
 assert.ok(card.includes('Hide in this collection'));
 assert.ok(card.includes('aria-pressed="'));
 assert.ok(card.includes('cs-utility-is-hidden'));
 assert.ok(js.includes('stageMemberAnnotation(uid,{hidden:!memberAnnotation(uid).hidden})'));
 assert.ok(save.includes('typeof annotation.hidden!=="boolean"'));
 assert.ok(save.includes('name:col.name,item_uid:uid,rating:annotation.rating,context:annotation.context,hidden:annotation.hidden'));
 assert.ok(save.includes('expected_revision:revision'));
 assert.ok(save.includes('state.detail.item_metadata={...(state.detail.item_metadata||{}),[uid]:annotation}'));
 assert.ok(css.includes('#cs-root .cs-member-visibility svg{width:16px;height:16px;pointer-events:none}'));
 assert.ok(css.includes('#cs-root .cs-member-visibility[aria-pressed="true"]{color:#8c8c8c}'));
 assert.ok(css.includes('#cs-root .cs-utility-is-hidden .cs-utility-name{opacity:.54}'));
 assert.ok(!js.includes('request("catalog.update"'),"Never mutate catalog visibility");
});
test("Direct-membership ratings use half-star toggling without zero or X controls",()=>{
 assert.ok(js.includes('state.detail?.item_metadata?.[uid]'));
 assert.ok(js.includes('const annotation=memberAnnotation(uid)'));
 assert.ok(js.includes('const editingMember=localEditorActive()'));
 assert.ok(js.includes('const hasRating=annotation.rating!==null'));
 assert.ok(js.includes('data-cs-member-context'));
 assert.ok(js.includes('data-cs-member-rating'));
 for(const name of ["cs-member-zero","cs-member-clear","cs-star-zero","cs-star-clear"])
   assert.ok(!js.includes(name),"Removed separate zero and X controls: "+name);
 for(const name of [".cs-star-zero",".cs-star-clear"])assert.ok(!css.includes(name));
 assert.ok(js.includes('data-cs-value'));
 assert.ok(js.includes('stageMemberAnnotation(uid,{context})'));
 assert.ok(js.includes('stageMemberAnnotation(uid,{rating:nextCollectionRating(memberAnnotation(uid).rating,value)})'));
 assert.ok(js.includes('if(next.rating===0)next.rating=null'));
 assert.ok(js.includes('const priorRating=validRating(original?.rating)&&original.rating>0?original.rating:null'));
 assert.ok(js.includes('state.memberDrafts.set(membershipKey(state.activeId,uid),next)'));
 assert.ok(js.includes('state.memberDrafts.delete(membershipKey(state.activeId,uid))'));
 assert.ok(js.includes('const annotationControls=(editingMember||hasRating)?'));
 assert.ok(css.includes('#cs-root .cs-member-rating-actions .cs-context-control + .cs-stars{margin-left:8px}'));
 assert.ok(css.includes('#cs-root .cs-member-rating-actions .cs-context-control + .cs-stars{margin-left:6px}'));
 assert.ok(css.includes('#cs-root .cs-star-fill'));
 assert.ok(css.includes('#cs-root .cs-context-control:hover .cs-create-tooltip'));
});
test("Local Done persists description and member annotations with strict serialized revision checks",()=>{
 const begin=js.indexOf('async function finishLocalEditor(){');
 const end=js.indexOf('function openRowContext(uid){',begin);
 const save=js.slice(begin,end);
 assert.ok(begin>0&&end>begin);
 assert.ok(save.includes('confirmDescriptionEdit()'));
 assert.ok(save.includes('request("edit",{original_name:col.name,desc:description,expected_revision:revision})'));
 assert.ok(save.includes('for(const [key,annotation] of state.memberDrafts)'));
 assert.ok(save.includes('collectionId!==id||!state.detail.item_uids?.includes(uid)'));
 assert.ok(save.includes('request("annotate",{'));
 assert.ok(save.includes('name:col.name,item_uid:uid,rating:annotation.rating,context:annotation.context,hidden:annotation.hidden'));
 assert.ok(save.includes('expected_revision:revision'));
 assert.ok(save.includes('revision=updated.revision'));
 assert.ok(save.includes('state.memberDrafts.delete(key)'));
 assert.ok(save.includes('await loadList({focusId:id})'));
 const globalBegin=js.indexOf('async function finishEditMode(){'),globalEnd=js.indexOf('function toggleEditMode(){',globalBegin);
 const globalSave=js.slice(globalBegin,globalEnd);
 assert.ok(globalBegin>0&&globalEnd>globalBegin);
 assert.ok(!globalSave.includes('request("annotate"'));
 assert.ok(globalSave.includes('if(!edits.length&&!state.configDirty)'));
 assert.ok(globalSave.includes('await request("configure"'));
 assert.ok(js.includes('const locked=state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning'));
 assert.ok(js.includes('if(localEditorActive()){announce("Save or cancel this collection'));
 assert.ok(js.includes('if(!button||state.busy||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive())return;'));
 assert.ok(js.includes('selectButton.disabled=state.busy||state.editing||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive()'));
 assert.ok(!js.includes('request("create",{name,description,rating'));
});

// Each asset is traced directly to the corresponding exported symbol in
// ~/Desktop/font/Icons-Real/SFSymbols.20261112.tsx, not reconstructed from CSS.
test("Collections controls use versioned exact SF Symbols assets",()=>{
 const workflow=src(".github/workflows/site.yml");
 const source=[{"file":"add-collection.v3.svg","symbol":"plus.circle.fill","viewBox":"0 0 25.4314 25.0897","paths":[{"d":"M25.0701 12.5399C25.0701 19.4359 19.4359 25.0701 12.5302 25.0701C5.63418 25.0701 0 19.4359 0 12.5399C0 5.63418 5.63418 0 12.5302 0C19.4359 0 25.0701 5.63418 25.0701 12.5399ZM11.8234 7.48379L11.8234 11.8137L7.49356 11.8137C7.07315 11.8137 6.76963 12.1128 6.76963 12.5399C6.76963 12.9348 7.0792 13.2272 7.49356 13.2272L11.8234 13.2272L11.8234 17.5638C11.8234 17.9714 12.1226 18.284 12.5174 18.284C12.9408 18.284 13.2369 17.9842 13.2369 17.5638L13.2369 13.2272L17.5803 13.2272C17.9812 13.2272 18.2938 12.9348 18.2938 12.5399C18.2938 12.1128 17.9939 11.8137 17.5803 11.8137L13.2369 11.8137L13.2369 7.48379C13.2369 7.05664 12.9408 6.75986 12.5174 6.75986C12.1226 6.75986 11.8234 7.06943 11.8234 7.48379Z","fill":"currentColor","opacity":"0.85"}]},{"file":"edit-collections.v1.svg","symbol":"pencil.line","viewBox":"0 0 26.1967 22.5978","paths":[{"d":"M24.4804 20.6072C24.4804 20.9707 24.1806 21.2705 23.8239 21.2705L4.86694 21.2705L5.10297 21.162L6.3228 19.9476L23.8239 19.9476C24.1806 19.9476 24.4804 20.2474 24.4804 20.6072Z","fill":"currentColor","opacity":"0.85"},{"d":"M4.35561 20.0428L18.8857 5.53222L17.1683 3.80204L2.63822 18.3096L1.38725 20.8565C1.27611 21.0876 1.53275 21.3426 1.75775 21.2405ZM19.8398 4.60136L20.9034 3.54755C21.4702 2.99355 21.4873 2.43447 20.9889 1.94277L20.7494 1.70321C20.2765 1.23036 19.6986 1.27919 19.1634 1.80761L18.0992 2.86142Z","fill":"currentColor","opacity":"0.85"}]},{"file":"select-collections.v3.svg","symbol":"pointer.arrow.click","viewBox":"0 0 25.4314 25.6799","paths":[{"d":"M0 12.835C0 17.6216 2.77041 21.8265 6.6665 23.8757C7.53594 24.3628 8.20196 23.1972 7.28027 22.6751C3.80762 20.8395 1.38418 17.1149 1.38418 12.835C1.38418 6.65995 6.35811 1.67928 12.5234 1.67928C18.6985 1.67928 23.6859 6.65995 23.6859 12.835C23.6859 13.2905 24.044 13.5462 24.4038 13.5462C24.7464 13.5462 25.0701 13.2838 25.0701 12.835C25.0701 5.95995 19.3985 0.295101 12.5234 0.295101C5.65811 0.295101 0 5.95995 0 12.835Z","fill":"currentColor","opacity":"0.85"},{"d":"M18.3144 25.6122C18.7684 25.4253 18.9883 24.9127 18.7879 24.4429L16.7405 19.6824L19.6613 19.6867C20.0335 19.686 20.2211 19.2987 19.9668 19.0121L13.076 11.6143C12.8193 11.3449 12.3937 11.5086 12.3899 11.8868L12.441 21.9922C12.4373 22.3808 12.892 22.5213 13.1486 22.2586L15.1411 20.2412L17.1315 25.1393C17.3154 25.5829 17.8452 25.7998 18.3144 25.6122Z","fill":"currentColor","opacity":"0.85"}]}];
 for(const {file,symbol,viewBox,paths} of source){
   const svg=src("sites/_apex/app/assets/"+file);
   assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.ok(svg.includes('data-sf-symbol="'+symbol+'"'));
   assert.ok(svg.includes('data-sf-source="SFSymbols.20261112.tsx"'));
   assert.ok(svg.includes('viewBox="'+viewBox+'"'));
   assert.equal([...svg.matchAll(/<path d="([^"]+)" fill="currentColor" fill-opacity="([^"]+)"\/>/g)].length,paths.length);
   for(const path of paths){
     assert.ok(svg.includes('d="'+path.d+'"'),symbol+" source path differs");
     assert.ok(svg.includes('fill-opacity="'+path.opacity+'"'),symbol+" opacity differs");
   }
   assert.match(html,new RegExp('src="/app/assets/'+file.replaceAll(".","\\.")+'"'));
   assert.match(workflow,new RegExp('cp sites/_apex/app/assets/'+file.replaceAll(".","\\.")+' dist/app/assets/'+file.replaceAll(".","\\.")));
   assert.match(workflow,new RegExp('test -s dist/app/assets/'+file.replaceAll(".","\\.")));
   assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|<!DOCTYPE|<\?xml|data:image/i);
 }
 assert.match(html,/class="cs-edit-check"/);
 assert.match(html,/class="cs-select-done"/);
 assert.match(css,/#cs-root\.cs-closing-for-edit \.cs-edit-icon-button img/);
 assert.match(css,/#cs-root\.cs-closing-for-selection \.cs-select-icon-button img/);
 assert.match(css,/#cs-root \.cs-create-plus-icon\{object-fit:contain\}/);
 assert.doesNotMatch(html,/<svg class="cs-(?:create-plus-icon|edit-pencil|select-glyph)"/);
});

test("Collection and utility search normalize case and match multiple independent terms",async()=>{
 const {collectionsSearchMatches}=await import("../sites/_apex/app/assets/collections.js");
 assert.equal(collectionsSearchMatches("Development Tools","development"),true);
 assert.equal(collectionsSearchMatches("DEVELOPMENT tools","  deveLopMENT    TOOLS  "),true);
 assert.equal(collectionsSearchMatches("Browser Utility 00ab4c production","00ab4c browser"),true);
 assert.equal(collectionsSearchMatches("Creative Tools","creative testing"),false);
 assert.equal(collectionsSearchMatches("Utility",""),true);
 assert.equal(collectionsSearchMatches("Utility","   "),true);
 assert.equal(collectionsSearchMatches("Utilities",null),true);
 assert.equal(collectionsSearchMatches("", "missing"),false);
 assert.equal(collectionsSearchMatches("Équipe","e\u0301quipe"),true);
});


test("Search magnifying-glass buttons fill their entire left-hand bar segments",()=>{
 assert.ok(css.includes("min-width:0;min-height:38px;height:38px;padding:0 10px 0 0"));
 assert.ok(css.includes("position:relative;flex:none;align-self:stretch;width:35px;height:auto"));
 assert.ok(css.includes("position:absolute;inset:0;display:grid;place-items:center;width:100%;height:100%"));
 assert.ok(css.includes("border:0;border-radius:10px 0 0 10px;padding:0;background:transparent"));
 assert.ok(css.includes('#cs-root .cs-search-focus:hover:not(:disabled),#cs-root .cs-search-focus:focus-visible{background:rgba(255,255,255,.055)}'));
 assert.ok(css.includes('#cs-root .cs-search-control{height:auto;width:34px}'));
 assert.ok(css.includes('#cs-root .cs-search:focus-within{border-color:#525252;background:var(--cs-weak)}'));
 assert.ok(!css.includes('border:0;border-radius:7px;padding:0;background:transparent'));
});

test("Utilities selection bubbles animate from the right with mounted rows",()=>{
 const card=js.slice(js.indexOf("function cardMarkup(){"),js.indexOf("function filterUtilityRows(){"));
 const chrome=js.slice(js.indexOf("function syncUtilityChrome(){"),js.indexOf("function openCollection("));
 const handler=js.slice(js.indexOf("function handleUtilityAction(action){"),js.indexOf('detail.addEventListener("click"'));
 assert.ok(card.includes('class="cs-utility-trailing"'));
 assert.ok(card.includes('class="cs-utility-pick" data-cs-pick-utility="'));
 assert.ok(card.includes('class="cs-select-bubble" aria-hidden="true"'));
 assert.ok(!card.includes('class="cs-checkbox"'));
 assert.ok(!card.includes('const content=(state.selecting?'));
 assert.ok(chrome.includes('root.classList.toggle("cs-utility-selecting",state.selecting)'));
 assert.ok(chrome.includes('for(const pick of card.querySelectorAll(".cs-utility-pick"))'));
 assert.ok(chrome.includes('pick.setAttribute("aria-pressed",String(chosen))'));
 assert.ok(chrome.includes('pick.disabled=!state.selecting||state.busy'));
 assert.ok(handler.includes('state.selecting=true;state.selected.clear();syncUtilityChrome();syncActions();'));
 assert.ok(handler.includes('state.selecting=false;state.selected.clear();syncUtilityChrome();syncActions();'));
 assert.ok(!handler.includes("renderCard()"),"Mode changes may not rebuild moving rows");
 assert.ok(css.includes('#cs-root .cs-utility-pick{display:grid;place-items:center;flex:none;width:0;height:28px;margin-left:0'));
 assert.ok(css.includes('transform:translateX(20px);pointer-events:none;transition:width var(--cs-control-swap)'));
 assert.ok(css.includes('#cs-root.cs-utility-selecting .cs-utility-pick{width:26px;margin-left:8px;overflow:visible;opacity:1;visibility:visible;transform:translateX(0)'));
 assert.ok(css.includes('#cs-root .cs-utility-pick[aria-pressed="true"] .cs-select-bubble'));
 assert.ok(js.includes('const button=event.target.closest(".cs-utility-pick")'));
 assert.ok(js.includes('if(!isUid(uid)||!state.detail.item_uids?.includes(uid))return;'));
 assert.ok(!js.includes('root.addEventListener("change",event=>{'));
 assert.ok(js.includes('await waitForVisualMotion(visible,"width")'));
});

test("Native trash confirmation lists exact item names, guards writes and preserves catalog items",()=>{
 const workflow=src(".github/workflows/site.yml");
 const asset=src("sites/_apex/app/assets/trash-utilities.v1.svg");
 assert.ok(asset.includes('viewBox="0 0 24.31 29.6418"'));
 assert.ok(asset.includes('data-sf-symbol="trash" data-sf-source="SFSymbols.20261112.tsx"'));
 assert.ok(asset.includes('color="#ef4444"'));
 assert.match(asset,/<path d="M8\.19824 23\.8266[^"]+" fill="currentColor" fill-opacity="0\.85"\/>/);
 assert.doesNotMatch(asset,/<script|<foreignObject|<image|<!DOCTYPE/i);
 assert.match(css,/#cs-root \.cs-utility-trash-control\{[^}]*width:0;height:var\(--cs-utility-bubble-height\)/);
 assert.ok(css.includes('#cs-root.cs-utility-selecting .cs-utility-trash-control{width:28px;opacity:1;visibility:visible'));
 assert.ok(css.includes('#cs-root .cs-utility-trash:hover:not(:disabled){background:rgba(239,68,68,.14)}'));
 assert.ok(html.includes('id="cs-evict-dialog" aria-labelledby="cs-evict-title" aria-describedby="cs-evict-copy"'));
 for(const id of ["cs-evict-count","cs-evict-collection","cs-evict-items","cs-evict-cancel","cs-evict-apply","cs-evict-error"])
   assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('class="cs-evict-items" id="cs-evict-items"'));
 assert.ok(css.includes('#cs-root .cs-evict-items{max-height:min(260px,34vh);min-height:0;overflow:auto'));
 const confirmation=js.slice(js.indexOf("function openEvictDialog(){"),js.indexOf("function sizeInlineName("));
 assert.ok(confirmation.includes('list.replaceChildren(...uids.map(uid=>{'));
 assert.ok(confirmation.includes('item.textContent=names.get(uid)||uid'));
 assert.ok(confirmation.includes('pendingEvict={collectionId:col.collection_id,name:col.name,revision:state.detail.revision,uids}'));
 assert.ok(confirmation.includes('evictDialog.showModal()'));
 assert.ok(confirmation.includes('if(!pending||!evictDialog.open||state.busy||!state.selecting'));
 assert.ok(confirmation.includes('state.detail.revision!==pending.revision'));
 assert.ok(confirmation.includes('pending.uids.some(uid=>!state.selected.has(uid)||!state.detail.item_uids.includes(uid))'));
 assert.ok(confirmation.includes('await request("evict",{name:pending.name,item_uids:pending.uids,expected_revision:pending.revision})'));
 assert.ok(!confirmation.includes('confirm('),"No browser-native confirmation with unnamed records");
 assert.ok(js.includes('evictDialog.addEventListener("cancel",event=>{if(state.busy)event.preventDefault();})'));
 assert.ok(js.includes('evictDialog.addEventListener("close",()=>{pendingEvict=null;})'));
 assert.ok(!js.includes('cs-create-tooltip-shortcut" aria-label="Remove'));
 assert.ok(workflow.includes("cp sites/_apex/app/assets/trash-utilities.v1.svg dist/app/assets/trash-utilities.v1.svg"));
 assert.ok(workflow.includes("test -s dist/app/assets/trash-utilities.v1.svg"));
});

test("Original route geometry is retained while masked icons match the former #a3a3a3 text",()=>{
 const workflow=src(".github/workflows/site.yml");
 const masks={
   cloud:["cloud-utility.v2.svg","cloud-utility-mask.v1.svg"],
   direct:["direct-utility.v1.svg","direct-utility-mask.v1.svg"],
   local:["local-provider.v1.svg","local-provider-mask.v1.svg"]
 };
 assert.ok(css.includes('--cs-bg:#0a0a0a;--cs-text:#fafafa;--cs-muted:#a3a3a3'));
 assert.ok(css.includes('#cs-root .cs-utility-name{color:#fff;'));
 assert.ok(css.includes('#cs-root .cs-utility-route-icon{background:var(--cs-muted)'));
 assert.ok(js.includes('role="img" aria-label="'));
 for(const [mode,[original,mask]] of Object.entries(masks)){
   const before=src("sites/_apex/app/assets/"+original);
   const after=src("sites/_apex/app/assets/"+mask);
   assert.equal(before.match(/viewBox="[^"]+"/)?.[0],after.match(/viewBox="[^"]+"/)?.[0]);
   const paths=text=>[...text.matchAll(/<path d="([^"]+)"/g)].map(x=>x[1]);
   assert.deepEqual(paths(before),paths(after));
   assert.ok(!after.includes('fill-opacity="0.85"'));
   assert.ok(after.includes('fill-opacity="1"'));
   assert.ok(css.includes('#cs-root .cs-utility-route-icon--'+mode+'{aspect-ratio:'));
   assert.ok(css.includes('mask-image:url("/app/assets/'+mask+'")'));
   assert.ok(workflow.includes("cp sites/_apex/app/assets/"+mask+" dist/app/assets/"+mask));
   assert.ok(workflow.includes("test -s dist/app/assets/"+mask));
 }
 assert.ok(css.includes('width:24px;min-width:24px;height:29px;flex:0 0 24px'));
 assert.ok(css.includes('transform:scale(.6);transform-origin:center'));
});

test("Compact Collection search matches Refresh on both breakpoints without narrowing its edges",()=>{
 assert.ok(css.includes("#cs-root .cs-collection-search-row{display:flex;align-items:center;gap:10px;min-width:0;position:relative;z-index:4;margin-bottom:15px}"));
 assert.ok(css.includes("#cs-root .cs-collection-search{flex:1 1 0;min-width:0}"));
 assert.ok(css.includes("#cs-root .cs-collection-search{height:32px;min-height:32px;border-radius:10px}"));
 assert.ok(css.includes("#cs-root #cs-refresh{width:32px;min-width:32px;height:32px;min-height:32px"));
 assert.ok(css.includes("#cs-root .cs-collection-search .cs-search-control{width:29px}"));
 assert.ok(css.includes("#cs-root .cs-collection-search .cs-search-focus{border-radius:9px 0 0 9px}"));
 assert.ok(css.includes("#cs-root .cs-collection-search .cs-search-focus img{width:14px;height:14px}"));
 assert.ok(css.includes('#cs-root .cs-collection-search input[type="search"]{height:28px;font-size:12px}'));
 assert.ok(css.includes("#cs-root .cs-collection-search{height:30px;min-height:30px;border-radius:9px}"));
 assert.ok(css.includes("#cs-root #cs-refresh{width:30px;min-width:30px;height:30px;min-height:30px}"));
 assert.ok(css.includes("#cs-root .cs-collection-search .cs-search-control{width:27px}"));
 assert.ok(css.includes("#cs-root .cs-collection-search .cs-search-focus img{width:13px;height:13px}"));
 assert.ok(css.includes('#cs-root .cs-collection-search input[type="search"]{height:26px;font-size:11px}'));
 assert.ok(css.includes("#cs-root .cs-utility-search{margin-top:19px;flex:none}"),"Utility search retains its original width and placement");
});

test("Sidebar symbols and legacy Studio externaldrive v2 preserve original source shapes",()=>{
 const navCss=src("sites/_apex/app/assets/workspace-theme.css");
 const workflow=src(".github/workflows/site.yml");
 const entries=[
   ["utilities","utilities-screen-sidebar-icon.v1.svg","wrench.and.screwdriver.fill",2],
   ["providers","providers-screen-sidebar-icon.v1.svg","tray.2.fill",2],
   ["permissions","permissions-screen-sidebar-icon.v2.svg","shield.righthalf.filled",1],
   ["diagnostics","diagnostics-screen-sidebar-icon.v1.svg","chart.bar.xaxis.descending",5]
 ];
 for(const [route,file,symbol,count] of entries){
   const svg=src("sites/_apex/app/assets/"+file);
   assert.ok(svg.includes('data-sf-symbol="'+symbol+'"'));
   assert.equal((svg.match(/<path d="/g)||[]).length,count);
   assert.ok(navCss.includes("nav-icon-asset--"+route));
   assert.ok(navCss.includes('-webkit-mask-image:url("/app/assets/'+file+'")'));
   assert.ok(navCss.includes('mask-image:url("/app/assets/'+file+'")'));
   assert.ok(workflow.includes("cp sites/_apex/app/assets/"+file+" dist/app/assets/"+file));
   assert.ok(workflow.includes("test -s dist/app/assets/"+file));
 }
 const external=src("sites/_apex/app/assets/external-provider.v2.svg");
 const mask=src("sites/_apex/app/assets/external-provider-mask.v2.svg");
 assert.ok(external.includes('data-sf-symbol="externaldrive.fill"'));
 assert.ok(external.includes('viewBox="0 0 28.9096 20.5045"'));
 const paths=source=>[...source.matchAll(/<path d="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(paths(external),paths(mask));
 assert.equal(paths(external).length,1);
 assert.ok(external.includes('fill-opacity="0.85"'));
 assert.ok(mask.includes('fill-opacity="1"'));
 assert.ok(mask.includes('data-mask-source="external-provider.v2.svg"'));
 assert.ok(js.includes('ported:{src:"/app/assets/external-provider.v3.svg",label:"External provider"}'));
 assert.ok(css.includes('#cs-root .cs-utility-route-icon--ported{aspect-ratio:42.9196/20.0701;'));
 assert.ok(css.includes('mask-image:url("/app/assets/external-provider-mask.v3.svg")'));
 assert.ok(workflow.includes("cp sites/_apex/app/assets/external-provider.v2.svg dist/app/assets/external-provider.v2.svg"));
 assert.ok(workflow.includes("test -s dist/app/assets/external-provider-mask.v2.svg"));
});
test("Collections external provider v3 retains two exact TSX symbol paths",()=>{
 const icon=src("sites/_apex/app/assets/external-provider.v3.svg");
 const mask=src("sites/_apex/app/assets/external-provider-mask.v3.svg");
 assert.ok(icon.includes('data-sf-symbol="person.line.dotted.person.fill"'));
 assert.ok(icon.includes('data-sf-source="SFSymbols.20261112.tsx"'));
 assert.ok(icon.includes('viewBox="0 0 42.9196 20.0701"'));
 const paths=svg=>[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(paths(icon).length,2);
 assert.deepEqual(paths(mask),paths(icon));
 assert.ok(paths(icon)[0].startsWith("M9.10811 9.96758C11.6738"));
 assert.ok(paths(icon)[1].startsWith("M17.6011 9.91953C18.0686"));
 assert.ok(icon.includes('fill-opacity="0.85"')&&mask.includes('fill-opacity="1"'));
 assert.ok(css.includes('mask-image:url("/app/assets/external-provider-mask.v3.svg")'));
});
test("Collapsed list rows shimmer on initial load and refresh without reflow",()=>{
 assert.ok(js.includes("function renderLoadingRows(){")&&js.includes("length:state.pageSize"));
 assert.ok(js.includes('if(loading&&!state.loaded)renderLoadingRows();'));
 assert.ok(js.includes('list.classList.toggle("cs-list-loading",loading)'));
 assert.ok(js.includes('list.setAttribute("aria-busy",String(loading))'));
 assert.ok(css.includes(".cs-accordion.cs-list-loading .cs-entry:not(.cs-open) .cs-entry-title::after"));
 assert.ok(css.includes("animation:cs-row-pulse 1.35s linear infinite"));
 assert.ok(css.includes("@keyframes cs-row-pulse{from{background-position:100% 0}to{background-position:0 0}}"));
});
test("Adjacent utility edit/select buttons preserve the separated add control",()=>{
 const a=js.indexOf("cs-utility-action-control--add");
 const toolbar=js.indexOf('<span class="cs-utility-toolbar" role="group"');
 assert.ok(a>0&&toolbar>a&&js.slice(a,toolbar).includes('add-utilities.v1.svg'));
 assert.ok(css.includes('#cs-root .cs-utility-action-control--add{margin-right:4px}'));
 assert.ok(css.includes('border-radius:7px 0 0 7px')&&css.includes('border-radius:0 7px 7px 0'));
});
test("Both search bars match Refresh border states without a hover background",()=>{
 const search=css.slice(css.indexOf("#cs-root .cs-search{"),css.indexOf("}",css.indexOf("#cs-root .cs-search{"))+1);
 assert.ok(search.includes("border:1px solid var(--cs-border);border-radius:11px"));
 assert.ok(search.includes("background:var(--cs-weak)"));
 assert.ok(css.includes("#cs-root .cs-search:hover:not(:focus-within){border-color:#525252}"));
 assert.ok(!css.includes("#cs-root .cs-search:hover:not(:focus-within){border-color:#525252;background:"),"Search hover must not tint the background");
 assert.ok(css.includes("#cs-root .cs-search:focus-within{border-color:#525252;background:var(--cs-weak)}"));
 assert.ok(css.includes('#cs-root .cs-search input[type="search"]::placeholder{color:#595959;opacity:1}'));
 assert.ok(css.includes("#cs-root .cs-utility-search{margin-top:19px;flex:none}"));
});
test("Two matching utility footer bubbles replace the old count badge above Utilities",()=>{
 const row=js.slice(js.indexOf("function rowMarkup("),js.indexOf("function renderPages(){"));
 const controls=js.slice(js.indexOf("const UTILITY_DONE_SVG="),js.indexOf("function rowMarkup("));
 const card=js.slice(js.indexOf("function cardMarkup(){"),js.indexOf("function filterUtilityRows(){"));
 assert.ok(!js.includes("function actionMarkup(){"));
 assert.ok(!row.includes('data-cs-actions'));
 assert.ok(!row.includes('class="cs-card-badge'));
 assert.ok(card.includes("utilityToolbarMarkup()+'</div>'"));
 assert.ok(card.includes('class="cs-summary" aria-label="Collection revision and total utilities"'));
 assert.ok(card.includes('class="cs-card-badge cs-revision-badge" aria-label="Collection revision"'));
 assert.ok(card.includes('class="cs-card-badge cs-inline-utility-count" aria-label="Total utilities"'));
 assert.ok(card.indexOf("cs-revision-badge")<card.indexOf("cs-inline-utility-count"));
 assert.ok(card.includes("Revision '+esc(current.revision)"));
 assert.ok(card.includes("ids.length+' '+(ids.length===1?'utility':'utilities')"));
 assert.ok(!card.includes('<div class="cs-summary"><span class="cs-dot"'));
 const footer=css.slice(css.indexOf("#cs-root .cs-summary{"),css.indexOf("}",css.indexOf("#cs-root .cs-summary{")));
 assert.ok(footer.includes('display:flex;align-items:center;justify-content:space-between;gap:11px'));
 assert.ok(!footer.includes('padding-left:')&&!footer.includes('padding-right:'),"Equal left and right insets");
 assert.ok(css.includes("#cs-root .cs-card-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;height:var(--cs-utility-bubble-height)"));
 assert.ok(css.includes("#cs-root .cs-inline-utility-count{min-width:100px}"));
 assert.ok(js.includes('for(const badge of root.querySelectorAll(".cs-summary .cs-inline-utility-count"))'));
 for(const asset of ["add-utilities.v1.svg","edit-collections.v1.svg","select-collections.v3.svg"])
   assert.ok(controls.includes("/app/assets/"+asset));
 assert.ok(controls.includes('role="group" aria-label="Utility management"'));
 assert.ok(controls.includes('class="cs-utility-management"'));
 assert.ok(controls.includes('Edit utilities'));
 assert.ok(controls.includes('Select utilities'));
 assert.ok(js.includes('const action=event.target.closest(".cs-utility-management button[data-cs-action]")'));
 assert.ok(js.includes('if(action&&!action.disabled)handleUtilityAction(action.dataset.csAction)'));
 assert.ok(js.includes('handleUtilityAction(button.dataset.csAction);'));
 assert.ok(!js.includes('>Delete collection</button>'));
});
test("Add utilities uses a button-filling square glyph, preserving exact original plus void",()=>{
 const add=src("sites/_apex/app/assets/add-utilities.v1.svg");
 const original=src("sites/_apex/app/assets/add-collection.v3.svg");
 const plus=original.match(/M11\.8234 7\.48379L[\s\S]*?(?=Z" fill="currentColor")/)?.[0];
 assert.ok(plus,"Retained native SF plus knock-out contour is available");
 assert.match(add,/viewBox="0 0 25\.0701 25\.0701"/);
 assert.match(add,/d="M0 0H25\.0701V25\.0701H0Z M11\.8234/);
 assert.ok(add.includes(plus+"Z"),"Preserve full exact source plus geometry");
 assert.ok(add.includes('fill-rule="evenodd"'),"Transparent knockout plus is cut out of solid square");
 assert.doesNotMatch(add,/data-sf-symbol="plus\.circle\.fill"/);
 const controls=js.slice(js.indexOf('function utilityToolbarMarkup(){'),js.indexOf("function rowMarkup("));
 assert.match(controls,/data-cs-action="admit" disabled aria-label="Add utilities \(coming later\)"/);
 assert.match(controls,/src="\/app\/assets\/add-utilities\.v1\.svg"/);
 assert.doesNotMatch(controls,/src="\/app\/assets\/add-collection\.v3\.svg"/);
 const collectionButton=html.match(/<button[^>]*id="cs-create"[\s\S]*?<\/button>/)?.[0]||"";
 assert.match(collectionButton,/src="\/app\/assets\/add-collection\.v3\.svg"/);
 assert.match(css,/#cs-root \.cs-utility-action--add\{overflow:hidden\}/);
 assert.match(css,/#cs-root \.cs-utility-action--add img\{width:24px;height:24px;border-radius:inherit;object-fit:fill\}/);
 assert.match(css,/@media\(max-width:639px\)\{[\s\S]*?#cs-root \.cs-utility-action--add img\{width:20px;height:20px\}/);
});

test("Utility management separates Add and tightly joins Edit and Select",()=>{
 assert.ok(css.includes("--cs-utility-bubble-height:34px"));
 assert.ok(css.includes("--cs-utility-bubble-height:28px"));
 assert.ok(css.includes("#cs-root .cs-card-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;height:var(--cs-utility-bubble-height)"));
 assert.ok(css.includes("#cs-root .cs-utility-toolbar{display:inline-flex;align-items:center;justify-content:center;flex:none;gap:0;height:24px;width:max-content;padding:0"));
 assert.ok(css.includes("background:#212121;background-clip:padding-box;box-shadow:inset 0 0 1px rgba(255,255,255,.2)"));
 assert.ok(css.includes("#cs-root .cs-utility-action{position:relative;display:grid;place-items:center;flex:none;width:24px;height:24px;min-height:0;padding:0;border:0;border-radius:7px;background:transparent"));
 assert.ok(css.includes("#cs-root .cs-utility-action--add img{width:24px;height:24px;border-radius:inherit;object-fit:fill}"));
 assert.ok(css.includes("#cs-root .cs-utility-action:not(.cs-utility-action--add):hover:not(:disabled){background:rgba(255,255,255,.065);color:#fff}"));
 assert.ok(css.includes("#cs-root .cs-utility-action{width:20px;height:20px;border-radius:6px}"));
});
test("Both search bars use the exact magnifying glass in the upper top bar and show tooltips",()=>{
 const navStyles=src("sites/_apex/app/assets/workspace-enhancements.css");
 const searchAsset="/app/assets/magnifying-glass.v2.svg";
 assert.ok(navStyles.includes('-webkit-mask:url("'+searchAsset+'")'));
 assert.ok(navStyles.includes('mask:url("'+searchAsset+'")'));
 assert.ok(html.includes('id="global-search-toggle"'));
 assert.ok(html.includes('class="cs-search cs-collection-search" role="search"'));
 assert.ok(html.includes('id="cs-collection-search" type="search"'));
 assert.ok(html.includes('id="cs-focus-collection-search"'));
 assert.ok(html.includes('aria-keyshortcuts="Meta+Shift+F"'));
 assert.ok(html.includes('id="cs-collection-search-tooltip" role="tooltip"'));
 assert.ok(html.includes('aria-label="Shift Command F"'));
 const local=js.slice(js.indexOf('function cardMarkup(){'),js.indexOf('function filterUtilityRows(){'));
 assert.ok(local.includes('class="cs-search cs-utility-search" role="search"'));
 assert.ok(local.includes('data-cs-utility-search type="search"'));
 assert.ok(local.includes('data-cs-focus-utility-search'));
 assert.ok(local.includes('<span class="cs-create-tooltip" role="tooltip">'));
 assert.ok(local.includes('Search utilities'));
 assert.ok(!local.includes('aria-keyshortcuts'),"Utilities have no keyboard shortcut");
 assert.ok(html.includes(searchAsset));
 assert.ok(local.includes(searchAsset));
 assert.ok(css.includes('#cs-root .cs-search-control:hover .cs-create-tooltip'));
 assert.ok(css.includes('#cs-root .cs-search-focus:focus-visible + .cs-create-tooltip'));
 assert.ok(css.includes('#cs-root .cs-collection-search-row{display:flex;align-items:center;gap:10px;min-width:0;position:relative;z-index:4;margin-bottom:15px'));
 assert.ok(css.includes('#cs-root .cs-utility-search{margin-top:19px'));
});
test("Collections search filters paginated collection records without modifying organization",()=>{
 assert.ok(js.includes('collectionQuery:"",utilityQuery:""'));
 assert.ok(js.includes('state.collections.filter(col=>collectionsSearchMatches([col.name,col.description,col.collection_id].join(" "),state.collectionQuery))'));
 assert.ok(js.includes('const pageCount=()=>Math.max(1,Math.ceil(matchingCollections().length/state.pageSize))'));
 assert.ok(js.includes('const pageItems=()=>matchingCollections().slice('));
 assert.ok(js.includes('const total=matchingCollections().length'));
 assert.ok(js.includes('No collections match your search.'));
 assert.ok(js.includes('collectionSearch.addEventListener("input",()=>{'));
 assert.ok(js.includes('state.collectionQuery=collectionSearch.value;'));
 assert.ok(js.includes('state.page=1;'));
 assert.ok(js.includes('!pageItems().some(col=>col.collection_id===state.activeId)'));
 assert.ok(js.includes('const visible=matchingCollections();'));
 assert.ok(js.includes('if(chosen&&!visible.some(item=>item.collection_id===chosen.collection_id))chosen=null'));
 assert.ok(js.includes('if(chosen)state.page=Math.floor(visible.findIndex(x=>x.collection_id===chosen.collection_id)/state.pageSize)+1'));
 assert.ok(js.includes('if(state.collectionQuery){'));
 assert.ok(js.includes('state.collectionQuery="";collectionSearch.value="";state.page=1;'));
 assert.ok(js.includes('collectionSearch.disabled=state.busy||state.editing||state.editTransitioning'));
 assert.ok(js.includes('collectionSearchFocus.disabled=collectionSearch.disabled'));
 const shortcut=js.slice(js.indexOf('// Only collection search has a shortcut.'),js.indexOf('createButton.addEventListener("click"'));
 assert.ok(shortcut.includes('event.code!=="KeyF"'));
 assert.ok(shortcut.includes('!event.metaKey||!event.shiftKey||event.ctrlKey||event.altKey'));
 assert.ok(shortcut.includes('routeActive()'));
 assert.ok(shortcut.includes('document.querySelector("dialog[open]")'));
 assert.ok(shortcut.includes('event.preventDefault()'));
 assert.ok(shortcut.includes('collectionSearch.focus({preventScroll:true})'));
});
test("Utility search keeps desktop/mobile input focus and local editor drafts intact",()=>{
 const card=js.slice(js.indexOf('function cardMarkup(){'),js.indexOf('function filterUtilityRows(){'));
 assert.ok(card.includes('data-cs-utility-index'));
 assert.ok(card.includes('[item.name||uid,uid,annotation.context,routes||""]'));
 assert.ok(card.includes('No utilities match your search.'));
 assert.ok(card.includes('data-cs-utility-results role="status" aria-live="polite"'));
 const filter=js.slice(js.indexOf('function filterUtilityRows(){'),js.indexOf('function renderCard(){'));
 assert.ok(filter.includes('root.querySelectorAll(".cs-card")'));
 assert.ok(filter.includes('collectionsSearchMatches(row.dataset.csUtilityIndex,query)'));
 assert.ok(filter.includes('row.hidden=!visible'));
 assert.ok(filter.includes('if(input.value!==state.utilityQuery)input.value=state.utilityQuery'));
 assert.ok(filter.includes('empty.hidden=!query||shown!==0||rows.length===0'));
 assert.ok(filter.includes('results.textContent=query?shown+" of "+rows.length+" utilities shown":""'));
 assert.ok(!filter.includes('request('));
 assert.ok(!filter.includes('renderCard('));
 assert.ok(js.includes('if(mobile.innerHTML!==markup)mobile.innerHTML=markup'));
 assert.ok(js.includes('filterUtilityRows();'));
 assert.ok(js.includes('root.addEventListener("input",event=>{'));
 assert.ok(js.includes('state.utilityQuery=input.value'));
 assert.ok(js.includes('state.utilityQuery="";'));
 assert.ok(js.includes('if(!input||!state.detail||!state.activeId)return'));
 assert.ok(css.includes('#cs-root .cs-utility-no-results'));
 assert.ok(css.includes('#cs-root .cs-search input[type="search"]'));
});

test("Add collection renders the whole SF Symbol, not an icon inside a CSS circle",()=>{
 const htmlButton=html.match(/<button class="cs-create-icon-button"[^>]*>[\s\S]*?<\/button>/)?.[0]||"";
 const native=src("sites/_apex/app/assets/add-collection.v3.svg");
 assert.match(htmlButton,/add-collection\.v3\.svg/);
 assert.doesNotMatch(htmlButton,/<svg\b|<span\b|<i\b/);
 assert.ok(native.includes('data-sf-symbol="plus.circle.fill"'));
 assert.ok(native.includes('color="#fff"'));
 assert.ok(native.includes('fill-opacity="0.85"'));
 assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*background:transparent;color:#fff/);
 assert.match(css,/#cs-root \.cs-create-icon-button\{[^}]*box-shadow:none/);
 assert.match(css,/#cs-root \.cs-create-plus-icon\{[^}]*width:32\.4px;height:32\.4px/);
 assert.doesNotMatch(css,/#cs-root \.cs-create-icon-button\{[^}]*background:#fff/);
 assert.ok(htmlButton.includes('aria-keyshortcuts="Meta+Shift+N"'));
 assert.ok(htmlButton.includes('aria-describedby="cs-create-tooltip"'));
});

test("Select Collections uses pointer.arrow.click v3 with the original selection behavior",()=>{
 const asset=src("sites/_apex/app/assets/select-collections.v3.svg");
 const workflow=src(".github/workflows/site.yml");
 const markup=html.slice(html.indexOf('id="cs-select-collections"'),html.indexOf('id="cs-select-tooltip"'));
 const source={"viewBox":"0 0 25.4314 25.6799","paths":[{"d":"M0 12.835C0 17.6216 2.77041 21.8265 6.6665 23.8757C7.53594 24.3628 8.20196 23.1972 7.28027 22.6751C3.80762 20.8395 1.38418 17.1149 1.38418 12.835C1.38418 6.65995 6.35811 1.67928 12.5234 1.67928C18.6985 1.67928 23.6859 6.65995 23.6859 12.835C23.6859 13.2905 24.044 13.5462 24.4038 13.5462C24.7464 13.5462 25.0701 13.2838 25.0701 12.835C25.0701 5.95995 19.3985 0.295101 12.5234 0.295101C5.65811 0.295101 0 5.95995 0 12.835Z","fill":"currentColor","opacity":"0.85"},{"d":"M18.3144 25.6122C18.7684 25.4253 18.9883 24.9127 18.7879 24.4429L16.7405 19.6824L19.6613 19.6867C20.0335 19.686 20.2211 19.2987 19.9668 19.0121L13.076 11.6143C12.8193 11.3449 12.3937 11.5086 12.3899 11.8868L12.441 21.9922C12.4373 22.3808 12.892 22.5213 13.1486 22.2586L15.1411 20.2412L17.1315 25.1393C17.3154 25.5829 17.8452 25.7998 18.3144 25.6122Z","fill":"currentColor","opacity":"0.85"}]};
 assert.match(markup,/src="\/app\/assets\/select-collections\.v3\.svg"/);
 assert.ok(!markup.includes("select-collections.v2.svg"));
 assert.ok(asset.includes('data-sf-symbol="pointer.arrow.click"'));
 assert.ok(asset.includes('viewBox="'+source.viewBox+'"'));
 assert.equal([...asset.matchAll(/<path d="([^"]+)" fill="currentColor" fill-opacity="([^"]+)"\/>/g)].length,source.paths.length);
 for(const p of source.paths){
   assert.ok(asset.includes('d="'+p.d+'"'));
   assert.ok(asset.includes('fill-opacity="'+p.opacity+'"'));
 }
 assert.ok(markup.includes('class="cs-select-done"'));
 assert.ok(markup.includes('aria-pressed="false"'));
 assert.ok(markup.includes('aria-describedby="cs-select-tooltip"'));
 assert.ok(css.includes('#cs-root.cs-collection-selecting .cs-select-glyph{opacity:0'));
 assert.ok(css.includes('#cs-root.cs-collection-selecting .cs-select-done{opacity:1'));
 assert.ok(workflow.includes("cp sites/_apex/app/assets/select-collections.v3.svg dist/app/assets/select-collections.v3.svg"));
 assert.ok(workflow.includes("test -s dist/app/assets/select-collections.v3.svg"));
});

test("Joined utility buttons have flat inner faces and a perimeter-fit toolbar",()=>{
 const toolbar=css.match(/#cs-root \.cs-utility-toolbar\{[^}]+\}/)?.[0]||"";
 const buttons=css.match(/#cs-root \.cs-utility-action\{[^}]+\}/)?.[0]||"";
 const trash=css.match(/#cs-root \.cs-utility-trash\{[^}]+\}/)?.[0]||"";
 assert.ok(toolbar.includes("height:24px;width:max-content;padding:0"));
 assert.ok(toolbar.includes("border-radius:7px"));
 assert.ok(!toolbar.includes("border-radius:999px"));
 assert.ok(buttons.includes("width:24px;height:24px"));
 assert.ok(buttons.includes("border-radius:7px"));
 assert.ok(trash.includes("width:24px;height:24px"));
 assert.ok(trash.includes("border-radius:7px"));
 assert.ok(css.includes(" #cs-root .cs-utility-toolbar{gap:0;padding:0;height:20px;border-radius:6px}"));
 assert.ok(css.includes(" #cs-root .cs-utility-action{width:20px;height:20px;border-radius:6px}"));
 assert.ok(css.includes(" #cs-root .cs-utility-trash{width:20px;height:20px;border-radius:6px}"));
 assert.ok(css.includes("#cs-root .cs-utility-action--add img{width:24px;height:24px;border-radius:inherit;object-fit:fill}"));
});

test("Utilities search exactly matches Collection search scale without changing its width",()=>{
 const rules=[
  'height:32px;min-height:32px;border-radius:10px',
  'height:30px;min-height:30px;border-radius:9px',
  'width:29px','width:27px',
  'border-radius:9px 0 0 9px','border-radius:8px 0 0 8px',
  'width:14px;height:14px','width:13px;height:13px',
  'height:28px;font-size:12px','height:26px;font-size:11px'
 ];
 const suffixes=[
  ['',rules[0]],['',rules[1]],
  [' .cs-search-control',rules[2]],[' .cs-search-control',rules[3]],
  [' .cs-search-focus',rules[4]],[' .cs-search-focus',rules[5]],
  [' .cs-search-focus img',rules[6]],[' .cs-search-focus img',rules[7]],
  [' input[type="search"]',rules[8]],[' input[type="search"]',rules[9]]
 ];
 for(const [suffix,body] of suffixes){
   assert.ok(css.includes('#cs-root .cs-collection-search'+suffix+'{'+body+'}'));
   assert.ok(css.includes('#cs-root .cs-utility-search'+suffix+'{'+body+'}'));
 }
 assert.ok(css.includes('#cs-root .cs-utility-search{margin-top:19px;flex:none}'));
 assert.ok(css.includes(' #cs-root .cs-utility-search{margin-top:15px}'));
 assert.doesNotMatch(css,/#cs-root \.cs-utility-search\{[^}]*\bwidth:/);
});
