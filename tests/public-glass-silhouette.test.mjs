import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {silhouetteMask,silhouetteHazeMask,silhouetteHazeStrength,registerGlassSilhouette,silhouetteAtlasBytes,MASK_SIZE,MASK_INNER,MASK_RANGE,HAZE_SIZE,HAZE_INNER,HAZE_RANGE} from "../sites/_apex/assets/home-dashboard/dashboard-glass-silhouette.js";
import {coverageGeometry} from "../sites/_apex/assets/home-dashboard/dashboard-glass-vector-coverage.js";
const asset=name=>readFileSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url),"utf8");
test("silhouette preserves authored alpha, signed contour and holes",()=>{
 const a=new Uint8Array(9*9);
 for(let y=2;y<7;y++)for(let x=2;x<7;x++)a[y*9+x]=255;
 a[4*9+4]=0;a[2*9+2]=127;
 const m=silhouetteMask(a,9,9,8);
 assert.equal(m.length,a.length*2);
 for(let i=0;i<a.length;i++)assert.equal(m[2*i],a[i]);
 assert.ok(m[(4*9+4)*2+1]>127,"hole remains outside");
 assert.ok(m[(3*9+3)*2+1]<128,"ink remains inside");
 assert.ok(m[1]>m[(2*9+1)*2+1],"distant background is farther from contour");
 const haze=silhouetteHazeMask(a,9,9);
 assert.equal(haze.length,a.length);
 // Byte-for-byte equivalent to the old third RGBA lane for the same alpha.
 const old= silhouetteMask(a,9,9,HAZE_RANGE);
 for(let i=0;i<a.length;i++)assert.equal(haze[i],old[2*i+1]);
});
test("double spatial resolution, original quantization and physical optical sampling",()=>{
 assert.equal(MASK_INNER,512);assert.equal(MASK_SIZE,544);
 assert.equal(HAZE_INNER,256);assert.equal(HAZE_SIZE,384);
 assert.equal(MASK_RANGE/MASK_INNER,64/256);
 assert.equal(HAZE_RANGE/HAZE_INNER,128/256);
 assert.equal(silhouetteAtlasBytes(16),16*(544*544*2+384*384));
 assert.equal(silhouetteAtlasBytes(32),2*silhouetteAtlasBytes(16));
 const shader=asset("dashboard-gpu-glass.wgsl"),r=asset("dashboard-gpu-renderer.js"),atlas=asset("dashboard-glass-silhouette.js");
 assert.match(shader,/let signed=\(mask\.g-0\.5\)\*256\.0\*scale/);
 assert.match(shader,/let texelStep=2\.0\/544\.0/);
 assert.match(atlas,/format:"rg8unorm"/);
 assert.match(atlas,/format:"r8unorm"/);
 assert.match(atlas,/rasterAlpha\(img,HAZE_SIZE,HAZE_INNER\)/);
 assert.match(r,/binding:13,resource:silhouetteAtlas\.hazeView/);
});
test("adaptive haze is zero in dark pixels, restrained and very soft",()=>{
 assert.equal(silhouetteHazeStrength(.2,0),0);
 assert.equal(silhouetteHazeStrength(.95,0,0),0);
 assert.ok(silhouetteHazeStrength(.4,0)<.04);
 assert.ok(silhouetteHazeStrength(.95,0)<=.16);
 assert.ok(silhouetteHazeStrength(.95,4)<silhouetteHazeStrength(.95,1));
 assert.ok(silhouetteHazeStrength(.95,5.5)>0);
 assert.equal(silhouetteHazeStrength(.95,5/6+6),0);
 assert.equal(silhouetteHazeStrength(.95,0),.16);
 // Only margins shrink. The Gaussian sigma and terminal feather stay fixed.
 assert.equal(silhouetteHazeStrength(.95,.8/6),.16);
 const probe=5/6+3;
 assert.ok(Math.abs(silhouetteHazeStrength(.95,probe)-.08*Math.exp(-.5*((probe-.8/6)/5.4)**2))<1e-12);
 assert.ok(silhouetteHazeStrength(.95,6.5)<.001);
 assert.equal(silhouetteHazeStrength(.95,7),0);
});
test("shared silhouette registration uses Clear tint and same owner fragment",()=>{
 const img={dataset:{}};
 registerGlassSilhouette(img,{tint:"white",opacity:.2});
 assert.equal(img.dataset.glassSilhouetteTint,"white");
 assert.equal(img.dataset.glassSilhouetteOpacity,"0.2");
 const shader=asset("dashboard-gpu-glass.wgsl"),r=asset("dashboard-gpu-renderer.js");
 assert.match(shader,/let luminance=dot\(color,vec3<f32>\(0\.2126,0\.7152,0\.0722\)\)/);
 assert.match(shader,/var shaded=color\*\(1\.0-haze\)/);
 assert.match(shader,/let hazeDistance=\(hazeMask-0\.5\)\*256\.0\*hazeScale\/pointScale/);
 assert.match(shader,/0\.018\*hover/);
 assert.match(shader,/hover\*0\.075/);
 assert.match(shader,/let d=min\(icon\.rect\.z,icon\.rect\.w\)/);
 assert.match(shader,/clearTint\(clearFace\(base,darkFace\),icon.tint,0\.25\)/);
 assert.ok(shader.indexOf("color=mix(color,paint.rgb,clamp(paint.a*region.params.w")<shader.indexOf("color=composeGlassSilhouette(color"));
 assert.match(r,/const iconAnimating=syncGlassIcons\(authDt\)/);
 assert.match(r,/const iconAnimating=syncGlassIcons\(dt\)/);
 assert.match(r,/suppressHover:suppressed/);
 assert.match(r,/owner.matches\("\.is-expanded,\.project-showcase-dissolve-ghost"\)/);
 assert.match(asset("dashboard-glass-source-paint.js"),/if\(el.hasAttribute\("data-glass-icon-owned"\)\)return/);
});

test("native SVG final coverage is independent of 512px optical mask and haze",()=>{
 const g=coverageGeometry([10.25,8.5,91,91],[50.5,80.25,400,300],0);
 assert.equal(g.phaseX,1.75);assert.equal(g.phaseY,1.75);
 assert.equal(g.width,94);assert.equal(g.height,94);
 assert.deepEqual(g.rect,[8.5,6.75,1,1]);
 const shifted=coverageGeometry([10.25,8.5,91,91],[51.5,82.25,400,300],0);
 assert.deepEqual(shifted,g);
 const bloom=coverageGeometry([10.25,8.5,91,91],[50.5,80.25,400,300],1);
 assert.ok(Math.abs(bloom.pw-91*1.085)<1e-10);
 assert.ok(Math.abs(bloom.ph-91*1.065)<1e-10);
 const shader=asset("dashboard-gpu-glass.wgsl"),r=asset("dashboard-gpu-renderer.js"),v=asset("dashboard-glass-vector-coverage.js");
 assert.match(shader,/textureLoad\(silhouetteVectorCoverage,pixel,i32\(icon.coverageMeta.x\)-1,0\)\.r/);
 assert.match(shader,/let iconCoverage=finalSilhouetteCoverage\(icon,local,mask.r\)/);
 assert.match(shader,/mix\(shaded,glass,clamp\(iconCoverage\*icon.params.w/);
 assert.match(v,/new Path2D\(node.getAttribute\("d"\)/);
 assert.match(v,/ctx.stroke\(op.path\)/);
 assert.match(r,/binding:14,resource:reference&&referenceBindingView\?referenceBindingView:silhouetteAtlas.coverageView/);
});

test("haze is display-only and never enters glass optical inputs",()=>{
 const shader=asset("dashboard-gpu-glass.wgsl"),r=asset("dashboard-gpu-renderer.js");
 assert.match(shader,/distanceCSS-0\.8\/6\.0\)\/5\.4/);
 assert.match(shader,/1\.0-smoothstep\(5\.0\/6\.0,5\.0\/6\.0\+6\.0,distanceCSS\)/);
 assert.match(shader,/let haze=select\(0\.0,silhouetteHaze\(luminance,hazeDistance,hover\),state\.tintMeta\.z>=0\.0\)/);
 const optical=shader.slice(shader.indexOf("let signed=(mask.g-0.5)"),shader.indexOf("return mix(shaded,glass"));
 assert.ok(optical.length>1000);
 assert.doesNotMatch(optical,/\bhaze\b(?=[^\n]*[+*\/\-])/);
 assert.match(optical,/let base=clamp\(source\+vec3<f32>\(edge\+hover\*0\.075\)/);
 assert.match(r,/u\[19\]=authUniform\[11\];u\[11\]=0;u\[18\]=-1;/);
 assert.match(r,/authUniform\[18\]=authUsesCompositor\(\)\?1:0/);
});

test("haze atlas crop preserves all retained distance texels exactly",()=>{
 // Same centered authored alpha, different empty gutters. Crop the full
 // old field and compare every retained byte, including interior and holes.
 const big=32,small=24,offset=(big-small)/2;
 const a=new Uint8Array(big*big),b=new Uint8Array(small*small);
 for(let y=9;y<23;y++)for(let x=9;x<23;x++)if((x-15)**2+(y-15)**2<=49&&(x-15)**2+(y-15)**2>=9)a[y*big+x]=255;
 for(let y=0;y<small;y++)b.set(a.subarray((y+offset)*big+offset,(y+offset)*big+offset+small),y*small);
 const full=silhouetteHazeMask(a,big,big),cropped=silhouetteHazeMask(b,small,small);
 for(let y=0;y<small;y++)assert.deepEqual(cropped.subarray(y*small,(y+1)*small),full.subarray((y+offset)*big+offset,(y+offset)*big+offset+small));
 const shader=asset("dashboard-gpu-glass.wgsl");
 assert.match(shader,/hazeUV=iconUV\*\(256\.0\/384\.0\)\+vec2<f32>\(64\.0\/384\.0\)/);
 assert.match(shader,/let hazeOutside=length/);
 assert.ok(64*45.5/256>11);
});
