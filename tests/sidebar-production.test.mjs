import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {generateOracleField,projectOracleFieldWidth,projectOracleFieldSize,encodeOracleDisplacement,decodeOracleDisplacement,predictSidebarMotionWidths}
  from "../sites/_apex/app/assets/sidebar-glass-oracle.js";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Production includes exact oracle-backed glass with no preview scenery",async()=>{
  const [css,js,html,dashboard,worker,nav,foundation]=await Promise.all([
    read("../sites/_apex/app/assets/sidebar-glass.css"),
    read("../sites/_apex/app/assets/sidebar-glass.js"),
    read("../sites/_apex/app/index.html"),
    read("../sites/_apex/app/assets/dashboard.js"),
    read("../sites/_apex/app/assets/sidebar-glass-field-worker.js"),
    read("../sites/_apex/app/assets/workspace-nav.js"),
    read("../sites/_apex/assets/site-foundation.css")
  ]);
  assert.match(css,/backdrop-filter:url\("#oracle-glass-native-backdrop"\)/);
  assert.match(css,/margin:8px 0 8px 8px/);
  assert.match(css,/clip-path:inset\(0 0 0 282px\)/);
  assert.doesNotMatch(css,/glass-selection/,"No separate delayed highlight layer");
  assert.doesNotMatch(js,/MutationObserver|requestAnimationFrame|glassIndicatorGeometry/);
  assert.match(css,/\.shell\.liquid-glass-preview \.nav-link\.active\{/);
  assert.doesNotMatch(css,/glass-scene-|body:has\(/);
  assert.doesNotMatch(js,/glass-scene-|topActions|location\.replace|fetch\(/);
  assert.match(js,/mountOracleBackdrop\(/);
  assert.match(html,/href="\/app\/assets\/sidebar-glass\.css"/);
  assert.match(html,/src="\/app\/assets\/dashboard\.js" type="module"/);
  assert.match(dashboard,/initWorkspaceNavigation\(\)/);
  assert.match(dashboard,/await fetch\("\/api\/auth\/me"/);
  assert.match(dashboard,/\/api\/auth\/logout/);
  assert.match(dashboard,/authPost\("mfa\/setup"/);
  assert.match(dashboard,/import\("\.\/sidebar-glass\.js"\)/);
  assert.match(dashboard,/catch\(error=>console\.warn/);
  assert.match(worker,/generateOracleField|projectOracleFieldWidth/);
  assert.match(nav,/is-sidebar-toggling/);
  assert.match(foundation,/--ui-canvas:\s*#171717/);
});

test("Oracle values remain exact across lossless width projection and neutral displacement",()=>{
  assert.equal(encodeOracleDisplacement(0),128);
  assert.equal(decodeOracleDisplacement(128),0);
  const height=640,radius=24;
  const base=generateOracleField(260,height,radius);
  for(const w of [74,100,149,200,260]){
    const expected=generateOracleField(w,height,radius);
    const projected=projectOracleFieldWidth(base,w,radius);
    for(const field of ["inner","outer","blurMask"]){
      assert.deepEqual(projected[field],expected[field],
        field+" fields must be byte-identical at width "+w);
    }
  }
});

test("440px reference projects exact native-derived fields during arbitrary manual drag",()=>{
  for(const h of [113,257]){
    const base=generateOracleField(440,h,24);
    for(const w of [248,260,261,323,389,440]){
      const projected=projectOracleFieldWidth(base,w,24);
      const exact=generateOracleField(w,h,24);
      for(const channel of ["inner","outer","blurMask"])
        assert.deepEqual(projected[channel],exact[channel],
          channel+" mismatch at width "+w+", height "+h);
    }
  }
  const baseline=generateOracleField(260,113,24);
  assert.throws(()=>projectOracleFieldWidth(baseline,440,24),RangeError);
});

test("Oracle retains exact size-keyed cache and warms the actual resized endpoint",async()=>{
  const code=await read("../sites/_apex/app/assets/sidebar-glass-oracle.js");
  const worker=await read("../sites/_apex/app/assets/sidebar-glass-field-worker.js");
  assert.match(code,/CACHE_URL_BUDGET=24\*1024\*1024/);
  assert.match(code,/const key=w\+"x"\+h\+"@"\+corner/);
  assert.match(code,/desired\.w===74\?expanded:desired\.w===expanded\?74:0/);
  assert.match(code,/shell\.classList\.contains\("is-sidebar-resizing"\)/);
  assert.match(code,/for\(const mapped of geometryCache\.values\(\)\)/);
  assert.match(worker,/const baseWidth=w<=260\?260:440/);
  assert.match(worker,/generateOracleField\(baseWidth,referenceHeight,corner\)/);
  assert.match(worker,/projectOracleFieldSize\(base,w,h,corner\)/);
});

test("both desktop motion directions prefetch only exact oracle geometry within bounded memory",async()=>{
  const widths=predictSidebarMotionWidths();
  assert.ok(widths.length>18&&widths.length<45);
  for(const w of [133,201,183,151,213,121,231,103,248,86])
    assert.ok(widths.includes(w),"Missing exact predicted collapse/expand width "+w);
  assert.ok(widths.every(w=>Number.isInteger(w)&&w>74&&w<260));
  const code=await read("../sites/_apex/app/assets/sidebar-glass-oracle.js");
  assert.match(code,/const CACHE_LIMIT=32/);
  assert.match(code,/const SPECULATIVE_BURST=20, SPECULATIVE_TOTAL_LIMIT=24/);
  assert.match(code,/new ResizeObserver\(onPaneResize\)/);
  assert.match(code,/if\(key!==previous&&geometryCache\.has\(key\)\)reconcileReady\(\)/);
  assert.match(code,/function setMaps\(request,urls\)\{[\s\S]*?commitMaterial\(request\.w,request\.h\)/);
  assert.match(code,/if\(node\.getAttribute\("href"\)!==uri\)/);
  assert.doesNotMatch(code,/html2canvas|getDisplayMedia|captureStream|createImageBitmap\(document/);
});

test("vertical resize retains exact stale width-height fields for reverse resizes",async()=>{
  const code=await read("../sites/_apex/app/assets/sidebar-glass-oracle.js");
  assert.doesNotMatch(code,/if\(desired&&request\.h!==desired\.h\)return/);
  assert.match(code,/const oldHeight=desired\?\.h/);
  assert.match(code,/if\(oldHeight!==undefined&&oldHeight!==h\)/);
  assert.match(code,/geometryCache\.set\(request\.key,urls\)/);
  assert.match(code,/const key=w\+"x"\+h\+"@"\+corner/);
  assert.match(code,/if\(field\.key===desired\?\.key&&!field\.prefetch\)/);
  assert.match(code,/CACHE_URL_BUDGET=24\*1024\*1024/);
});

test("reference fields project byte-exactly along both axes for desktop resize",()=>{
  const base=generateOracleField(440,512,24);
  for(const h of [128,129,257,511,512]){
    for(const w of [74,248,260,333,440]){
      const expected=generateOracleField(w,h,24);
      const output=projectOracleFieldSize(base,w,h,24);
      for(const channel of ["inner","outer","blurMask"])
        assert.deepEqual(output[channel],expected[channel],
          channel+" mismatch at "+w+"x"+h);
    }
  }
  assert.throws(()=>projectOracleFieldSize(base,260,127,24),RangeError,
    "Very short panes need direct mode5 generation");
  assert.throws(()=>projectOracleFieldSize(base,440,600,24),RangeError,
    "Do not project beyond the reference height");
});
