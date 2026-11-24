import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {silhouetteMask,silhouetteHazeStrength,registerGlassSilhouette} from "../sites/_apex/assets/home-dashboard/dashboard-glass-silhouette.js";
const asset=name=>readFileSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url),"utf8");
test("silhouette preserves authored alpha, signed contour and holes",()=>{
 const a=new Uint8Array(9*9);
 for(let y=2;y<7;y++)for(let x=2;x<7;x++)a[y*9+x]=255;
 a[4*9+4]=0;a[2*9+2]=127;
 const m=silhouetteMask(a,9,9,8);
 for(let i=0;i<a.length;i++)assert.equal(m[2*i],a[i]);
 assert.ok(m[(4*9+4)*2+1]>127,"hole remains outside");
 assert.ok(m[(3*9+3)*2+1]<128,"ink remains inside");
 assert.ok(m[1]>m[(2*9+1)*2+1],"distant background is farther from contour");
});
test("adaptive haze is zero in dark pixels, restrained and very soft",()=>{
 assert.equal(silhouetteHazeStrength(.2,0),0);
 assert.equal(silhouetteHazeStrength(.95,0,0),0);
 assert.ok(silhouetteHazeStrength(.4,0)<.04);
 assert.ok(silhouetteHazeStrength(.95,0)<=.20);
 assert.ok(silhouetteHazeStrength(.95,4)<silhouetteHazeStrength(.95,1));
 assert.equal(silhouetteHazeStrength(.95,11),0);
});
test("shared silhouette registration uses Clear tint and same owner fragment",()=>{
 const img={dataset:{}};
 registerGlassSilhouette(img,{tint:"white",opacity:.2});
 assert.equal(img.dataset.glassSilhouetteTint,"white");
 assert.equal(img.dataset.glassSilhouetteOpacity,"0.2");
 const shader=asset("dashboard-gpu-glass.wgsl"),r=asset("dashboard-gpu-renderer.js");
 assert.match(shader,/let luminance=dot\(color,vec3<f32>\(0\.2126,0\.7152,0\.0722\)\)/);
 assert.match(shader,/clearTint\(clearFace\(base,darkFace\),icon.tint,0\.25\)/);
 assert.ok(shader.indexOf("color=mix(color,paint.rgb,clamp(paint.a*region.params.w")<shader.indexOf("color=composeGlassSilhouette(color"));
 assert.match(r,/const iconAnimating=syncGlassIcons\(authDt\)/);
 assert.match(r,/const iconAnimating=syncGlassIcons\(dt\)/);
 assert.match(r,/suppressHover:suppressed/);
 assert.match(r,/owner.matches\("\.is-expanded,\.project-showcase-dissolve-ghost"\)/);
 assert.match(asset("dashboard-glass-source-paint.js"),/if\(el.hasAttribute\("data-glass-icon-owned"\)\)return/);
});
