import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {glassIndicatorGeometry} from "../sites/_apex/app/assets/sidebar-glass.js";
import {
  ORACLE_TARGET,ORACLE_FINITE_REFRACTION,nativePublicBlurRadius,
  observedBlurWord,airRefractionEnvelope,airThresholdMix,airSupercircleSDF,
  airBlurDistribution,airTextureMipLOD,oracleFaceColorMatrixValues,
  airMode5SDF,ORACLE_CORNER_FLOOR,paneField,generateOracleField,
  ORACLE_SIDEBAR_FINITE_FACTOR,sidebarFiniteBlurProjection
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
  assert.equal(nativePublicBlurRadius("regular",0,200),2);
  assert.throws(()=>nativePublicBlurRadius("regular",-1,200),RangeError);
});

test("native selected blur word retains the recorded float32 evaluation sequence",()=>{
  for(const [r,t,s] of [[4,1,.25],[2.5,2,.25],[6.875,1.5,.5]]){
    const expected=Math.fround(Math.fround(r)*
      Math.fround(Math.fround(t*s)*Math.fround(1.6)));
    assert.equal(observedBlurWord(r,t,s),expected);
  }
});

test("all material constants are a coherent same-case 264-byte Oracle upload",()=>{
  const py=String.raw`
import json,lzma,pathlib,struct
root=pathlib.Path("preview/oracle-evidence")
d=json.loads(lzma.decompress((root/"live_blur_dataflow.json.xz").read_bytes()))
case=next(c for c in d["cases"] if c["binding"]["case"]=="diagnostic_m1_b4.75_z1.0")
b=bytes.fromhex(case["binding_prefix_hex"])
assert len(b)==264
fields={o["name"]:o for line in (root/"uniform_field_layouts.jsonl").read_text().splitlines()
        if (o:=json.loads(line)).get("struct_name")=="GlassBackgroundUniforms"}
def get(name):
    d=fields[name];i=d["byte_offset"]+48;t=d["llvm_type"]
    if t=="float":return struct.unpack_from("<f",b,i)[0]
    if t=="half":return struct.unpack_from("<e",b,i)[0]
    if t=="<4 x half>":return list(struct.unpack_from("<4e",b,i))
    raise ValueError(name)
pairs={"innerAmount":"inner_refraction_amount","innerInvHeight":"inner_refraction_inv_height",
"outerAmount":"outer_refraction_amount","outerInvHeight":"outer_refraction_inv_height",
"threshold0":"refraction_threshold0","threshold1":"refraction_threshold1",
"opacity":"refraction_opacity","faceOpacity":"face_opacity",
"shadowOpacity":"shadow_opacity","shadowFaceOpacity":"shadow_face_opacity",
"holdingToneOpacity":"holding_tone_opacity"}
result={k:get(v) for k,v in pairs.items()}
result["blurAlpha"]=[get("blur_alpha"+str(i)) for i in range(4)]
result["blurDist"]=[get("blur_dist"+str(i)) for i in range(4)]
result["faceMatrix"]=[get("face_cm"+str(i)) for i in range(3)]
print(json.dumps(result))
  `;
  const fromSource=JSON.parse(execFileSync("python3",["-c",py],{encoding:"utf8"}));
  const active=ORACLE_FINITE_REFRACTION;
  assert.equal(active.sourceCase,"diagnostic_m1_b4.75_z1.0");
  for(const [key,v] of Object.entries(fromSource))assert.deepEqual(active[key],v,key);
  assert.equal(ORACLE_TARGET.shader,"glass_background_sdf_no_bleed_lph");
  assert.equal(airRefractionEnvelope(0,active.innerAmount,active.innerInvHeight),active.innerAmount);
  assert.ok(Math.abs(airRefractionEnvelope(-14,active.innerAmount,active.innerInvHeight))<.01);
  assert.equal(airThresholdMix(-1,active.threshold0,active.threshold1,active.opacity),0);
  assert.equal(airThresholdMix(-.5,active.threshold0,active.threshold1,active.opacity),
    Math.fround(active.opacity));
  const matrix=oracleFaceColorMatrixValues().split(" ").map(Number);
  assert.equal(matrix.length,20);
  assert.deepEqual(matrix.slice(0,5),[...active.faceMatrix[0].slice(0,3),0,active.faceMatrix[0][3]]);
});

test("AIR blur-alpha/distance ramps vary sampling strength with the actual signed distance",()=>{
  assert.equal(airBlurDistribution(-40),1);
  assert.equal(airBlurDistribution(-28),1);
  assert.ok(Math.abs(airBlurDistribution(-20)-.8518519)<1e-6);
  assert.ok(Math.abs(airBlurDistribution(-14)-.7407407)<1e-6);
  assert.ok(Math.abs(airBlurDistribution(-7)-.6111111)<1e-6);
  assert.equal(airBlurDistribution(-1),.5);
  assert.equal(airBlurDistribution(-.5),.5);
  assert.ok(airTextureMipLOD(1.6,1)>airTextureMipLOD(1.6,.5));
  assert.ok(airTextureMipLOD(1.6,.5)>0);
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
  const positive=airSupercircleSDF(35.5,.5,36,49,.01);
  const negative=airSupercircleSDF(35.5,.5,36,49,-.01);
  // Source line 1062 fabs(radius): sign must not short-circuit the normal.
  assert.deepEqual(negative,positive);
  const flatRight=paneField(71.5,49.5,72,98,24);
  assert.ok(Number.isFinite(flatRight.nx));
  assert.ok(flatRight.nx>.5,JSON.stringify(flatRight));
  assert.ok(Math.abs(flatRight.ny)<.5,JSON.stringify(flatRight));
});

test("displacement maps are geometry-only, not screen or background captures",()=>{
  const field=generateOracleField(72,98,24);
  assert.equal(field.inner.length,72*98*4);
  assert.equal(field.outer.length,72*98*4);
  assert.equal(field.blurMask.length,72*98*4);
  assert.equal(field.inner[3],255);
  const center=(49*72+25)*4;
  assert.equal(field.inner[center],128);
  assert.equal(field.inner[center+1],128);
  const edge=(49*72+71)*4;
  // In mode5 the straight-edge SDF normal can be zero. The actual
  // four-corner path must displace a bounded corner region; don't require
  // an artist-assumed displacement at the midpoint of the straight edge.
  let innerAffected=0,outerAffected=0;
  for(let i=0;i<field.inner.length;i+=4){
    if(field.inner[i]!==128||field.inner[i+1]!==128)innerAffected++;
    if(field.outer[i]!==128||field.outer[i+1]!==128)outerAffected++;
  }
  assert.ok(innerAffected>0,JSON.stringify({innerAffected,outerAffected,center:[...field.inner.slice(edge,edge+4)]}));
  assert.ok(outerAffected>0,JSON.stringify({innerAffected,outerAffected}));
  assert.equal(field.blurMask[center+2],0);
  const intermediate=(49*72+61)*4;
  assert.ok(field.blurMask[intermediate]>0,"inner path gains a near mip inside the edge");
  assert.ok(field.blurMask[intermediate+1]>0,"outer path gains a near mip inside the edge");
  assert.ok(field.blurMask[edge]<=field.blurMask[intermediate],
    "native refraction-adjusted distance reduces near blur at the rim");
});

test("Oracle filter uses the actual browser backdrop, never an embedded wallpaper",async()=>{
  const js=await read("../sites/_apex/app/assets/sidebar-glass-oracle.js");
  const wrapper=await read("../sites/_apex/app/assets/sidebar-glass.js");
  const css=await read("../sites/_apex/app/assets/sidebar-glass.css");
  assert.match(js,/in:"SourceGraphic",stdDeviation:/);
  assert.match(js,/feDisplacementMap/);
  assert.match(js,/in:"innerBlurred",in2:"innerMap",scale:128/);
  assert.match(js,/in:"outerBlurred",in2:"outerMap",scale:128/);
  assert.match(js,/outerBlendMask/);
  assert.match(js,/result:"innerNearCoverage"/);
  assert.match(js,/result:"outerNearCoverage"/);
  assert.match(js,/in:"nearBlur",in2:"innerNearCoverage"/);
  assert.match(js,/in:"nearBlur",in2:"outerNearCoverage"/);
  assert.match(js,/in:"farBlur",in2:"innerNearCoverage"/);
  assert.match(js,/in:"farBlur",in2:"outerNearCoverage"/);
  assert.match(js,/in:"innerBlurred",in2:"innerMap",scale:128/);
  assert.match(js,/in:"outerBlurred",in2:"outerMap",scale:128/);
  assert.match(js,/innerDistance=f32\(p\.distance\+innerAmount\)/);
  assert.match(js,/outerDistance=f32\(p\.distance\+outerAmount\)/);
  assert.match(js,/in:"composited",type:"matrix"/);
  assert.match(js,/oracleFaceColorMatrixValues\(\)/);
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


test("two independently retained mode5 CPU48→GPU join states decode as signed corner radii",()=>{
  const py=String.raw`
import json,lzma,pathlib,struct
p=pathlib.Path("preview/oracle-evidence/live_mode_joins.json.xz")
d=json.loads(lzma.decompress(p.read_bytes()))
seen={}
for row in d["rows"]:
  b=bytes.fromhex(row["upload"]["source48_hex"])
  assert len(b)==48
  decoded=list(struct.unpack("<12f",b))
  mode=decoded[2]
  assert mode in (4,5)
  key=(row["parameter_case"],mode,tuple(decoded[8:12]))
  seen[key]=seen.get(key,0)+1
print(json.dumps([{"case":k[0],"mode":k[1],"corners":list(k[2]),"joins":v}
 for k,v in sorted(seen.items())]))
  `;
  const rows=JSON.parse(execFileSync("python3",["-c",py],{encoding:"utf8"}));
  assert.equal(rows.filter(x=>x.mode===5).length,2);
  assert.deepEqual(rows.filter(x=>x.mode===5).map(x=>x.corners),[
    [-20,-3,-20,-36],[-12,-28,-44,-6]
  ]);
  for(const row of rows)assert.ok(row.joins>=2,"same-case repeated CPU→GPU joins");
  assert.equal(Math.fround(ORACLE_CORNER_FLOOR),ORACLE_CORNER_FLOOR);
  assert.ok(ORACLE_CORNER_FLOOR>0 && ORACLE_CORNER_FLOOR<.011);
});

test("mode5 follows four mirrored supercircle calls and their signed-distance max",()=>{
  const captured=[
    {x:0,y:0,halfW:130,halfH:70,r:[-20,-3,-20,-36]},
    {x:95,y:61,halfW:130,halfH:70,r:[-20,-3,-20,-36]},
    {x:110,y:-61,halfW:130,halfH:70,r:[-12,-28,-44,-6]},
    {x:-118,y:56,halfW:130,halfH:70,r:[-12,-28,-44,-6]}
  ];
  for(const c of captured){
    const out=airMode5SDF(c.x,c.y,c.halfW,c.halfH,c.r);
    const values=[
      airSupercircleSDF(c.x,c.y,c.halfW,c.halfH,c.r[1]).distance,
      airSupercircleSDF(-c.x,c.y,c.halfW,c.halfH,c.r[0]).distance,
      airSupercircleSDF(c.x,-c.y,c.halfW,c.halfH,c.r[2]).distance,
      airSupercircleSDF(-c.x,-c.y,c.halfW,c.halfH,c.r[3]).distance
    ];
    // In these exact mode5 observed states, the source-computed curvature
    // blend factors saturate to 0, so each call uses the unblended helper.
    assert.ok(Math.abs(out.distance-Math.max(...values))<.002,
      JSON.stringify({c,out,values}));
    assert.ok(Number.isFinite(out.nx)&&Number.isFinite(out.ny));
  }
  const core=paneField(130,450,260,900,24);
  const rightOutside=paneField(272,450,260,900,24);
  assert.ok(core.distance<0,JSON.stringify(core));
  assert.ok(rightOutside.distance>0,JSON.stringify(rightOutside));
});

test("browser sidebar maps left square and right circular CSS corners into four signed mode5 lanes",async()=>{
  const js=await read("../sites/_apex/app/assets/sidebar-glass-oracle.js");
  assert.match(js,/export function airMode5SDF/);
  assert.match(js,/const specs=\[/);
  assert.match(js,/\[x,y,r1,factors\[0\],factors\[3\],1,1\]/);
  assert.match(js,/\[-x,y,r0,factors\[0\],factors\[1\],-1,1\]/);
  assert.match(js,/\[x,-y,r2,factors\[2\],factors\[3\],1,-1\]/);
  assert.match(js,/\[-x,-y,r3,factors\[2\],factors\[1\],-1,-1\]/);
  assert.match(js,/const shape=airMode5SDF\(px,py,w\*\.5,h\*\.5,\[left,right,right,left\]\)/);
  assert.match(js,/1\.891557216644287/);
  assert.match(js,/getComputedStyle\?\.\(sidebar\)/);
  assert.doesNotMatch(js,/drawGlassWallpaper|texImage2D/);
});


test("sidebar finite Float32 blur words exactly reproduce Oracle derived contract",async()=>{
  const contract=JSON.parse(await read("../preview/oracle-evidence/sidebar_blur_scale_finite.json"));
  assert.equal(contract.classification,"DERIVED_FINITE_PREDICTION_NOT_NEW_NATIVE_MEASUREMENT");
  assert.equal(contract.selected_factor_f32_hex,"cdcccc3e");
  assert.equal(ORACLE_SIDEBAR_FINITE_FACTOR,Math.fround(.4));
  assert.equal(contract.scoped_derived_predictions.length,8);
  const f32hex=value=>{
    const buffer=new ArrayBuffer(4),view=new DataView(buffer);
    view.setFloat32(0,value,true);
    return Array.from({length:4},(_,i)=>view.getUint8(i).toString(16).padStart(2,"0")).join("");
  };
  for(const item of contract.scoped_derived_predictions){
    const actual=sidebarFiniteBlurProjection(item.style,item.width,item.height);
    assert.equal(actual.radius,item.radius,item.name+": radius");
    assert.equal(actual.word,item.predicted_blur_word_f32,item.name+": float32 word");
    assert.equal(f32hex(actual.word),item.predicted_blur_word_f32_hex,item.name+": encoded word");
    assert.equal(actual.factor,ORACLE_SIDEBAR_FINITE_FACTOR);
    assert.equal(item.actual_native_encoder_join_observed,false);
  }
  assert.equal(sidebarFiniteBlurProjection("regular",260,900).word,Math.fround(1.6));
  assert.equal(sidebarFiniteBlurProjection("regular",74,900).word,0.9857142567634583);
  assert.equal(sidebarFiniteBlurProjection("regular",274,844).word,Math.fround(1.6));
  assert.equal(contract.proof_limits.unrestricted_final_blur_radius_scale_closed,false);
  assert.equal(contract.validation.new_native_sidebar_size_lldb_replay_completed,false);
});
