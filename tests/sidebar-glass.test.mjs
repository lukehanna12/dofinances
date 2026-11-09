import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {glassIndicatorGeometry} from "../sites/_apex/app/assets/sidebar-glass.js";
import {
  ORACLE_TARGET,ORACLE_FINITE_REFRACTION,nativePublicBlurRadius,
  observedBlurWord,airRefractionEnvelope,airThresholdMix,airSupercircleSDF,
  paneField,generateOracleField
} from "../sites/_apex/app/assets/sidebar-glass-oracle.js";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("actual /app navigation remains the exclusive owner of sidebar behavior",async()=>{
  const nav=await read("../sites/_apex/app/assets/workspace-nav.js");
  const boot=await read("../preview/app-sidebar-bootstrap.js");
  const html=await read("../sites/_apex/app/index.html");
  assert.match(boot,/initWorkspaceNavigation\(\)/);
  assert.match(boot,/initLiquidGlassSidebar\(\)/);
  assert.ok(boot.indexOf("initWorkspaceNavigation()")<boot.indexOf("initLiquidGlassSidebar()"));
  assert.match(nav,/const isMobile=.*max-width: 760px/);
  assert.match(nav,/const isCompactRail=.*max-width: 1279px/);
  assert.match(nav,/const PREFERENCE_KEY="dofinances.workspace.sidebar.collapsed"/);
  assert.match(nav,/win\.addEventListener\("hashchange",render\)/);
  assert.match(html,/href="\/app\/assets\/sidebar-glass\.css"/);
  assert.equal((html.match(/id="workspace-sidebar"/g)||[]).length,1);
});

test("selection indicator uses actual active item rectangle, including scrolling",()=>{
  const nav={scrollLeft:0,scrollTop:22,getBoundingClientRect:()=>({left:0,top:70,width:245,height:700})};
  const row={getBoundingClientRect:()=>({left:12,top:211,width:221,height:39})};
  assert.deepEqual(glassIndicatorGeometry(nav,row),{x:12,y:163,width:221,height:39});
  assert.equal(glassIndicatorGeometry(nav,{getBoundingClientRect:()=>({left:0,top:0,width:0,height:0})}),null);
});

test("all 52 held-out public regular/clear radius values match the exact operation order",async()=>{
  const data=JSON.parse(await read("../preview/oracle-evidence/live_public_geometry_radius_heldout.json"));
  assert.equal(data.independent_heldout_count,52);
  assert.equal(data.cases.length,52);
  for(const c of data.cases){
    const actual=nativePublicBlurRadius(c.style,c.width,c.height);
    assert.equal(actual,c.observed_radius,
      c.id+": "+c.style+" "+c.width+"x"+c.height);
  }
  assert.equal(nativePublicBlurRadius("regular",260,900),4);
  assert.equal(nativePublicBlurRadius("regular",74,900),2+((74-48)/112)*2);
  assert.equal(nativePublicBlurRadius("clear",260,900),10);
  assert.throws(()=>nativePublicBlurRadius("prominent",260,900),RangeError);
  assert.throws(()=>nativePublicBlurRadius("regular",0,200),RangeError);
});

test("native selected blur word retains the recorded float32 evaluation sequence",()=>{
  for(const [r,t,s] of [[4,1,.25],[2.5,2,.25],[6.875,1.5,.5]]){
    const expected=Math.fround(Math.fround(r)*
      Math.fround(Math.fround(t*s)*Math.fround(1.6)));
    assert.equal(observedBlurWord(r,t,s),expected);
  }
});

test("refraction uniforms come from the retained 331-case public projection",async()=>{
  const c=JSON.parse(await read("../preview/oracle-evidence/P_to_S_PUBLIC_FINITE_DOMAIN_CONTRACT.json"));
  assert.equal(c.case_count,331);
  for(const [name,value] of [
    ["inner_refraction_amount",ORACLE_FINITE_REFRACTION.innerAmount],
    ["inner_refraction_inv_height",ORACLE_FINITE_REFRACTION.innerInvHeight],
    ["outer_refraction_amount",ORACLE_FINITE_REFRACTION.outerAmount],
    ["outer_refraction_inv_height",ORACLE_FINITE_REFRACTION.outerInvHeight],
    ["refraction_threshold0",ORACLE_FINITE_REFRACTION.threshold0],
    ["refraction_threshold1",ORACLE_FINITE_REFRACTION.threshold1],
    ["refraction_opacity",ORACLE_FINITE_REFRACTION.opacity]
  ]){
    assert.ok(c.field_domains[name].values.some(row=>Number(row.value_repr)===value),
      name+" must occur in the finite public projection");
  }
  assert.equal(ORACLE_TARGET.shader,"glass_background_sdf_no_bleed_lph");
  assert.equal(airRefractionEnvelope(0,-60,.05),-60);
  assert.equal(airRefractionEnvelope(-21,-60,.05),0);
  assert.ok(airRefractionEnvelope(-10,-60,.05)>-60);
  assert.equal(airThresholdMix(-1,-1,-.5,.3),0);
  assert.equal(airThresholdMix(-.5,-1,-.5,.3),Math.fround(.3));
});

test("source-derived supercircle SDF has finite signed geometry",()=>{
  const mid=airSupercircleSDF(0,0,75,46,18);
  const edge=airSupercircleSDF(75,0,75,46,18);
  const beyond=airSupercircleSDF(90,0,75,46,18);
  for(const v of [mid.distance,edge.distance,beyond.distance])
    assert.ok(Number.isFinite(v));
  assert.ok(mid.distance<0,JSON.stringify(mid));
  assert.ok(beyond.distance>edge.distance,JSON.stringify({edge,beyond}));
  const top=paneField(250,0,260,900,24);
  assert.ok(Number.isFinite(top.distance));
});

test("displacement maps are geometry-only, not screen or background captures",()=>{
  const field=generateOracleField(72,98,24);
  assert.equal(field.inner.length,72*98*4);
  assert.equal(field.outer.length,72*98*4);
  assert.equal(field.inner[3],255);
  const center=(49*72+25)*4;
  assert.equal(field.inner[center],128);
  assert.equal(field.inner[center+1],128);
  const edge=(49*72+71)*4;
  assert.ok(field.inner[edge]!==128 || field.inner[edge+1]!==128);
  assert.ok(field.outer[edge]!==128 || field.outer[edge+1]!==128);
});

test("Oracle filter uses the actual browser backdrop, never an embedded wallpaper",async()=>{
  const js=await read("../sites/_apex/app/assets/sidebar-glass-oracle.js");
  const wrapper=await read("../sites/_apex/app/assets/sidebar-glass.js");
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  assert.match(js,/in:"SourceGraphic",stdDeviation/);
  assert.match(js,/feDisplacementMap/);
  assert.match(js,/in:"blurred",in2:"innerMap",scale:128/);
  assert.match(js,/in:"blurred",in2:"outerMap",scale:128/);
  assert.match(js,/outerBlendMask/);
  assert.match(js,/airSupercircleSDF/);
  assert.match(js,/1\.5286649465560913/);
  assert.match(js,/const t=clamp\(f32\(f32\(-distance\)\*f32\(invHeight\)\),0,1\)/);
  assert.match(css,/backdrop-filter:url\("#oracle-glass-native-backdrop"\)/);
  assert.match(css,/--oracle-backdrop-blur/);
  assert.match(wrapper,/mountOracleBackdrop/);
  assert.doesNotMatch(js,/drawGlassWallpaper|textureLod|texImage2D|WebGLRenderingContext|\.getDisplayMedia|html2canvas/);
  assert.doesNotMatch(wrapper,/createSceneBackedGlass|glass-optics|glass-wallpaper/);
  assert.doesNotMatch(css,/\.glass-wallpaper|\.glass-optics|has-refractive-glass/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\.cookie|localStorage/);
});

test("fallbacks are defined for reduced transparency, forced colors and reduced motion",async()=>{
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  assert.match(css,/prefers-reduced-transparency:reduce/);
  assert.match(css,/forced-colors:active/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.shell\.liquid-glass-preview\.has-oracle-backdrop \.sidebar/);
  assert.match(css,/-webkit-backdrop-filter:none;backdrop-filter:none/);
});

test("only the isolated preview publishes the adapter and never the auth dashboard",async()=>{
  const workflow=await read("../.github/workflows/app-sidebar-preview.yml");
  assert.match(workflow,/branches: \[test\/app-sidebar\]/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/test\/app-sidebar'/);
  assert.match(workflow,/cp sites\/_apex\/app\/assets\/sidebar-glass-oracle\.js/);
  assert.match(workflow,/pages deploy .*--branch=app-sidebar-preview/);
  assert.match(workflow,/test ! -e .app-sidebar-preview\/app\/assets\/dashboard\.js/);
  assert.doesNotMatch(workflow,/pages deploy .*--branch=main/);
});
