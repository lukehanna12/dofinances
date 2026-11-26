import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {physicalSourceRect,registerGlassPaint,sourceNodesForPane} from "../sites/_apex/assets/home-dashboard/dashboard-glass-source-paint.js";
import {nativeOcclusionHole} from "../sites/_apex/assets/home-dashboard/dashboard-glass-native-occlusion.js";
const base="../sites/_apex/assets/home-dashboard/";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("authored source rect follows actual viewport and legacy scroll coordinates",()=>{
 assert.deepEqual(physicalSourceRect([20,80,45,24],{top:44,dpr:2}),[40,72,90,48]);
 assert.deepEqual(physicalSourceRect([20,80,45,24],{top:-56,dpr:2}),[40,272,90,48]);
 const node={setAttribute:(k,v)=>{assert.equal(k,"data-glass-paint");assert.equal(v,"scene");}};
 assert.equal(registerGlassPaint(node,"scene"),node);
 assert.throws(()=>registerGlassPaint(node,"unknown"),TypeError);
 assert.deepEqual(sourceNodesForPane(null),[]);
});
test("authored sources enter the actual GPU attachment before higher glass samples its mips",()=>{
 const r=read(base+"dashboard-gpu-renderer.js"),p=read(base+"dashboard-glass-source-paint.js");
 assert.match(r,/sourcePainter.draw\(pass,baseSourceEntries,continuous\?"base":"scene","offscreen"\);\s*pass.end\(\);\s*for\(let level=1/);
 assert.doesNotMatch(r,/homeSourceEntries|syncHomeSources/);
 assert.match(r,/pass.draw\(6,end-first,0,tileCount\+first\);\s*sourcePainter.draw\(pass,paint/);
 assert.match(r,/drawRoutePanes\(pass,true\);pass.end\(\);mipComposite/);
 assert.match(r,/drawRouteLayer\(upper,routeActiveLayers\[0\],true\);upper.end\(\);mipComposite/);
 assert.match(p,/premultipliedAlpha:true/);
 assert.match(p,/srcFactor:"one",dstFactor:"one-minus-src-alpha"/);
 assert.match(read("../sites/_apex/assets/public-home.css"),/\[data-glass-paint-owned="route"\]/);
 assert.doesNotMatch(p,/getDisplayMedia|captureStream|html2canvas|drawWindow/);
});

test("ordinary foreground stays native, while Home icon sources stay authored SVG silhouettes",()=>{
 const entry=read("../sites/_apex/assets/public-projects-entry.js");
 const controls=read("../sites/_apex/assets/public-projects-controls.js");
 const mosaic=read(base+"dashboard-mosaic.js"),r=read(base+"dashboard-gpu-renderer.js");
 for(const source of [entry,controls,mosaic])assert.doesNotMatch(source,/\.dataset\.glassPaint\s*=|registerGlassPaint\(/);
 assert.match(entry,/registerGlassSilhouette\(icon\)/);
 assert.match(entry,/title\.dataset\.publicProjectGlass="title"/);
 assert.match(r,/function syncProjectScrollPresentation\(/);
 assert.match(r,/trackTiles\[i\]\.style\.transform="translate3d\("/);
 assert.match(r,/--public-icon-spatial-alpha/);
 assert.match(r,/foreground\.style\.opacity=String\(tileDismissIconOpacity\(progress\)\)/);
 assert.match(r,/mosaic:0,route:routeSourceEntries/);
});

test("higher glass occludes only overlapping native foreground at live opacity",()=>{
 const r={left:20,top:100,width:200,height:240};
 const p={left:170,top:120,width:100,height:130,radius:12,opacity:.5};
 assert.deepEqual(nativeOcclusionHole(r,200,240,p),{x:150,y:20,width:100,height:130,rx:12,ry:12,opacity:.5});
 assert.deepEqual(nativeOcclusionHole(r,100,120,p),{x:75,y:10,width:50,height:65,rx:6,ry:6,opacity:.5});
 assert.equal(nativeOcclusionHole(r,200,240,{...p,opacity:0}),null);
 assert.equal(nativeOcclusionHole(r,200,240,{...p,left:220}),null);
 assert.equal(nativeOcclusionHole(r,200,240,{...p,top:340}),null);
 const renderer=read(base+"dashboard-gpu-renderer.js"),occlusion=read(base+"dashboard-glass-native-occlusion.js");
 assert.match(renderer,/nativeOcclusion.sync\(covers.length\?document.querySelectorAll/);
 assert.match(renderer,/radius:tileData\[p\+4\]\/dpr,opacity:alpha/);
 assert.match(occlusion,/maskUnits:"userSpaceOnUse",maskContentUnits:"userSpaceOnUse"/);
 assert.match(occlusion,/"fill-opacity":p.opacity/);
 assert.doesNotMatch(occlusion,/getImageData|createTexture|drawImage|registerGlassPaint/);
 assert.match(read("../sites/_apex/assets/public-projects.css"),/mask-image:var\(--native-glass-occlusion\)/);
});
