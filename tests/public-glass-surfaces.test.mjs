import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 GLASS_GEOMETRY_SOURCE,GLASS_SHAPES,GLASS_INTERACTION,
 normalizeGlassCornerRadii,resolveGlassSurface,resolveGlassOpticalGeometry,
 projectFiniteNativeClearGlass,
 selectGlassSdfMode,glassContainsPoint,planGlassLayers,
 classifyGlassContent,glassSpring
} from "../sites/_apex/assets/home-dashboard/dashboard-glass-model.js";
const asset=name=>readFileSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url),"utf8");

test("shared public glass supports square, rectangle, mixed corners, circle and both pill axes",()=>{
 assert.deepEqual(GLASS_SHAPES,["auto","square","rectangle","rounded-rectangle","capsule","circle"]);
 const list=[
  resolveGlassSurface({width:75,height:75,radii:[24,24,24,24]}),
  resolveGlassSurface({width:150,height:58.5,radii:["999px","999px","999px","999px"]}),
  resolveGlassSurface({width:58.5,height:150,radii:["999px","999px","999px","999px"]}),
  resolveGlassSurface({width:40,height:40,radii:["50%","50%","50%","50%"]}),
  resolveGlassSurface({width:200,height:100,radii:[0,0,0,0]}),
  resolveGlassSurface({width:150,height:120,radii:[12,8,24,2]})
 ];
 assert.deepEqual(list.map(x=>x.renderMode),[4,6,6,6,4,5]);
 assert.deepEqual(list.map(x=>x.minDimension),[75,58.5,58.5,40,100,120]);
 assert.deepEqual(list.map(x=>x.shape),["square","capsule","capsule","circle","rectangle","rounded-rectangle"]);
 assert.deepEqual(list[1].radii,[29.25,29.25,29.25,29.25]);
 assert.deepEqual(list[3].cornerLanes,[-20,-20,-20,-20]);
 assert.equal(list[1].nativeMode,4);
 assert.equal(selectGlassSdfMode([-20,-20,-20,-20]),4);
 assert.equal(selectGlassSdfMode([-2,-8,-14,-20]),5);
});

test("CSS corner overlap is globally normalized, scaled capsule uses physical dimensions",()=>{
 assert.deepEqual(normalizeGlassCornerRadii(["999px","999px","999px","999px"],390,40),[20,20,20,20]);
 assert.deepEqual(normalizeGlassCornerRadii([80,80,10,10],100,80),[50,50,6.25,6.25]);
 const scaled=resolveGlassSurface({width:150,height:58.5,scale:2,radii:[29.25,29.25,29.25,29.25]});
 assert.equal(scaled.minDimension,117);
 assert.deepEqual(scaled.radii,[58.5,58.5,58.5,58.5]);
 assert.equal(scaled.renderMode,6);
 assert.throws(()=>resolveGlassSurface({width:150,height:58.5,shape:"circle"}),RangeError);
 assert.throws(()=>normalizeGlassCornerRadii(["20px 25px",0,0,0],150,50),RangeError);
});

test("finite Oracle optical envelopes use THIS surface minimum, never the first square",()=>{
 assert.equal(GLASS_GEOMETRY_SOURCE,"geometry_331_compact/finite-10");
 const square=resolveGlassOpticalGeometry(75,75);
 const capsule=resolveGlassOpticalGeometry(150,58.5);
 const card=resolveGlassOpticalGeometry(350,420);
 assert.equal(square.innerAmount,-60);
 assert.ok(Math.abs(capsule.innerAmount+46.8)<1e-10);
 assert.equal(card.innerAmount,-60);
 assert.equal(capsule.innerHeight,14.625);
 assert.equal(capsule.outerHeight,7.3125);
 assert.equal(card.outerHeight,43.75);
});

test("finite native Clear inputs differ from historical regular-square profile",()=>{
 const capsule=projectFiniteNativeClearGlass(150,58.5);
 const circle=projectFiniteNativeClearGlass(58.5,58.5);
 const rectangle=projectFiniteNativeClearGlass(280,58.5);
 const square=projectFiniteNativeClearGlass(75,75);
 assert.deepEqual(capsule,circle);
 assert.deepEqual(capsule,rectangle);
 assert.equal(capsule.innerAmount,-58.5);
 assert.equal(capsule.innerHeight,20);
 assert.equal(capsule.outerAmount,0);
 assert.equal(capsule.outerHeight,0);
 assert.equal(capsule.nativeInputBlurRadius,5.729166666666667);
 assert.equal(capsule.nativeInputLayerScale,.5);
 assert.equal(square.innerAmount,-60);
 assert.equal(square.innerHeight,20);
 assert.equal(square.nativeInputBlurRadius,6.875);
 assert.match(capsule.scope,/observed native Clear/);
 const thin=projectFiniteNativeClearGlass(100,19);
 assert.equal(thin.innerAmount,-19);
 assert.ok(Math.abs(thin.innerHeight-6.84)<1e-12);
 assert.match(thin.scope,/browser interpolation/);
 assert.equal(thin.evidenceId,"E-P-SWIFTUI-SHAPE-GEOMETRY-FINITE");
});
test("homepage capsules sample live squares in viewport coordinates, never the 1px auth extent",()=>{
 const shader=asset("dashboard-gpu-glass.wgsl");
 const renderer=asset("dashboard-gpu-renderer.js");
 // Home material tag -9 is a capsule on the HOME canvas, even though its
 // negative tag also marks it as a glass pane for shared material stages.
 assert.match(shader,/let homeCapsule=tile\.properties\.y == -9\.0;/);
 assert.match(shader,/let routePane=authPane && !homeCapsule;/);
 assert.match(shader,/var backdropExtent=state\.viewport\.xy;/);
 assert.match(shader,/var backdropPosition=in\.position\.xy;/);
 assert.match(shader,/if\(routePane\)\{\s*backdropExtent\.y=max\(1\.0,state\.fit\.w\);\s*backdropPosition\.y-=state\.pointer\.w;/);
 assert.doesNotMatch(shader,/if\(authPane\)\{\s*backdropExtent\.y=/);
 // The Home uniform intentionally has no auth scroll scene height; its
 // viewport dimensions must remain the complete composited GPU source.
 assert.match(renderer,/uniform\[7\]=0;/);
 assert.match(renderer,/authUniform\[7\]=physicalHeight;/);
 assert.match(renderer,/homeCapsuleGroup=compositeSceneView\?/);
 assert.match(renderer,/pass\.setBindGroup\(0,homeCompositeActive\?homeCapsuleGroup:glassGroup\)/);
 const viewportHeight=900,fragY=720,authExtent=0;
 const brokenUV=fragY/Math.max(1,authExtent);
 const correctedUV=fragY/viewportHeight;
 assert.ok(brokenUV>1,"Old route mistakenly sampled clamp-to-edge");
 assert.ok(correctedUV>0&&correctedUV<1,
   "Home capsule samples a location inside the same scene as its squares");
});
test("shape-aware hit region excludes transparent round-corner pixels",()=>{
 assert.equal(glassContainsPoint([0,0,40,40],[20,20,20,20],0,0),false);
 assert.equal(glassContainsPoint([0,0,40,40],[20,20,20,20],20,0),true);
 assert.equal(glassContainsPoint([100,200,150,58.5],[29.25,29.25,29.25,29.25],100,200),false);
 assert.equal(glassContainsPoint([100,200,150,58.5],[29.25,29.25,29.25,29.25],100,229.25),true);
});

test("content semantics and interaction remain reusable and independent",()=>{
 assert.equal(GLASS_INTERACTION.pressLight,.06);
 assert.equal(classifyGlassContent({text:true}),"text");
 assert.equal(classifyGlassContent({icon:true}),"icon");
 assert.equal(classifyGlassContent({flat:true}),"flat");
 assert.equal(classifyGlassContent({text:true,icon:true}),"mixed");
 assert.equal(classifyGlassContent({text:true,silhouette:true}),"silhouette");
 let value=0,velocity=0;
 for(let i=0;i<100;i++)
  [value,velocity]=glassSpring(value,velocity,1,1/60,GLASS_INTERACTION.hoverEnterRate);
 assert.ok(value>.99&&Math.abs(velocity)<.002);
});

test("layered glass planner rejects cyclic and missing underlays",()=>{
 const layers=planGlassLayers([
  {id:"cta",layer:1,backdrop:"previous-layer"},
  {id:"mosaic",layer:0,backdrop:"scene"}
 ]);
 assert.deepEqual(layers.map(x=>x.id),["mosaic","cta"]);
 assert.throws(()=>planGlassLayers([{layer:0,backdrop:"previous-layer"}]),RangeError);
 assert.throws(()=>planGlassLayers([{layer:2,backdrop:"previous-layer"}]),RangeError);
});

test("public shader reuses native modes, with CSS capsule extension on shared optics",()=>{
 const shader=asset("dashboard-gpu-glass.wgsl");
 const renderer=asset("dashboard-gpu-renderer.js");
 assert.match(shader,/let d=min\(dimensions\.x,dimensions\.y\);/);
 assert.match(shader,/fn cssCapsuleSDF\(/);
 assert.match(shader,/field=cssCapsuleSDF\(in\.local,dimensions\)/);
 assert.match(shader,/fn mode4SDF\(/);
 assert.match(shader,/fn mode5SDF\(/);
 assert.match(renderer,/const surface=resolveGlassSurface\(/);
 assert.match(renderer,/surface\.cornerLanes/);
 assert.match(renderer,/PUBLIC_HOME_GLASS_LAYERS=planGlassLayers\(/);
 assert.doesNotMatch(renderer,/tileData\[p\+6\]=tileData\[6\]/);
});
