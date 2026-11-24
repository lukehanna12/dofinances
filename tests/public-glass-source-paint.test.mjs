import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {physicalSourceRect,registerGlassPaint,sourceNodesForPane} from "../sites/_apex/assets/home-dashboard/dashboard-glass-source-paint.js";
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
 assert.match(r,/sourcePainter.draw\(pass,baseSourceEntries,"scene","offscreen"\);\s*pass.end\(\);\s*for\(let level=1/);
 assert.match(r,/sourcePainter.draw\(underlay,homeSourceEntries,"scene","offscreen"\);\s*underlay.end\(\)/);
 assert.match(r,/pass.draw\(6,end-first,0,tileCount\+first\);\s*sourcePainter.draw\(pass,paint/);
 assert.match(r,/drawRoutePanes\(pass,true\);pass.end\(\);mipComposite/);
 assert.match(r,/drawRouteLayer\(upper,routeActiveLayers\[0\],true\);upper.end\(\);mipComposite/);
 assert.match(p,/premultipliedAlpha:true/);
 assert.match(p,/srcFactor:"one",dstFactor:"one-minus-src-alpha"/);
 assert.match(read("../sites/_apex/assets/public-home.css"),/\[data-glass-paint-owned="route"\]/);
 assert.doesNotMatch(p,/getDisplayMedia|captureStream|html2canvas|drawWindow/);
});
