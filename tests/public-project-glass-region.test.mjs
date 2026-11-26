import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {artworkCoverTransform,artworkCSSAlignment,artworkDetailSize,REGION_FLOATS,ART_LAYERS} from "../sites/_apex/assets/home-dashboard/dashboard-glass-artwork.js";
import {resolveInactiveClearRegion} from "../sites/_apex/assets/home-dashboard/dashboard-glass-material.js";
import {serveProjectArtwork} from "../edge/project-artwork.mjs";
import {publicProjectArtworkSource} from "../sites/_apex/assets/public-projects-catalog.js";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("artwork cover and CSS transform map original image coordinates",()=>{
 assert.deepEqual(artworkCoverTransform(200,100,100,100),[1,.5,0,.25]);
 assert.deepEqual(artworkCoverTransform(100,200,100,100),[.5,1,.25,0]);
 const uv=artworkCoverTransform(100,100,100,100,2,2,10,-10);
 assert.ok(uv.every((v,i)=>Math.abs(v-[.5,.5,.2,.3][i])<1e-12));
 assert.equal(REGION_FLOATS,24);assert.equal(ART_LAYERS,16);
});
test("BootScript cover framing keeps the top edge and exposes the entire original left crop",()=>{
 const align=artworkCSSAlignment({objectPosition:"0% 0%",transformOrigin:"0px 0px",width:"261px",height:"250px"});
 assert.deepEqual(align,[0,0,0,0]);
 for(const [w,h] of [[261,250],[165,220],[350,250],[1300,250]]){
  const original=artworkCoverTransform(w,h,1012,701);
  for(const scale of [1.1025,1.15,1.21275]){
   const uv=artworkCoverTransform(w,h,1012,701,scale,scale,0,0,...align);
   assert.equal(uv[2],0);
   assert.equal(uv[3],0);
   assert.ok(Math.abs(uv[0]-original[0]/scale)<1e-12);
   assert.ok(Math.abs(uv[1]-original[1]/scale)<1e-12);
   assert.ok(uv[2]>=0&&uv[2]+uv[0]<=1+1e-12&&uv[3]+uv[1]<=1);
  }
 }
 const centered=artworkCSSAlignment({objectPosition:"50% 50%",transformOrigin:"130.5px 125px",width:"261px",height:"250px"});
 assert.deepEqual(centered,[.5,.5,.5,.5]);
});
test("same-origin remote source only accepts curated project slugs",async()=>{
 assert.equal(publicProjectArtworkSource({slug:"colosseum"},0),"/project-artwork/colosseum");
 assert.equal(publicProjectArtworkSource({slug:"terminal-scalars"},0),"/assets/project-art/terminal-scalars-liquid-symmetry.v3.webp");
 let called=0;
 const mock=async(url,init)=>{called++;assert.match(url,/^https:\/\//);assert.equal(init.redirect,"manual");
   return new Response("image",{headers:{"Content-Type":"image/jpeg"}})};
 const request=path=>new Request("https://dofinances.com"+path);
 const good=await serveProjectArtwork(request("/project-artwork/colosseum"),"/project-artwork/colosseum",mock);
 assert.equal(good.status,200);assert.equal(await good.text(),"image");
 assert.equal((await serveProjectArtwork(request("/project-artwork/bogus"),"/project-artwork/bogus",mock)).status,404);
 assert.equal((await serveProjectArtwork(request("/project-artwork/colosseum?url=x"),"/project-artwork/colosseum",mock)).status,404);
 assert.equal(called,1);
 const alias=await serveProjectArtwork(request("/project-artwork/colosseum"),"/project-artwork/colosseum",async()=>new Response("image",{headers:{"Content-Type":"image/jpg"}}));
 assert.equal(alias.status,200);assert.equal(alias.headers.get("Content-Type"),"image/jpeg");
 const redirect=await serveProjectArtwork(request("/project-artwork/colosseum"),"/project-artwork/colosseum",async()=>new Response(null,{status:302,headers:{Location:"https://example.com/unsafe"}}));
 assert.equal(redirect.status,502);
});
test("region is independently profiled within same GPU instance, and follows each title, Terminal clearance and expansion",()=>{
 const shader=src("sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),render=src("sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),css=src("sites/_apex/assets/public-projects.css"),expand=src("sites/_apex/assets/public-projects-expand.js");
 assert.match(shader,/let split=region.params.x>0.0/);
 assert.match(shader,/artSample\(uv,i32\(region.params.z\)-1/);
 assert.match(shader,/glass=mix\(projectRegionCaptureSample\(innerUV,innerLOD\),/);
 assert.match(shader,/if\(split\)\{[\s\S]*?profile.optics=vec4<f32>\(0.0\)/);
 assert.match(shader,/let darkFace=split \|\| state.tintMeta.y>0.5/);
 assert.match(shader,/let hover=select\(clamp\(tile.interaction.x,0.0,1.0\),0.0,split\|\|dropdown\)/);
 assert.match(shader,/let pressed=select\(clamp\(tile.interaction.y,0.0,1.0\),0.0,split\|\|dropdown\)/);
 assert.match(shader,/if\(localTint.w>0.0 && !split && !dropdown && !clockText\)/);
 const capture=render.slice(render.indexOf("function renderProjectRegionCapture("),render.indexOf("function paintTrack("));
 assert.match(capture,/pass.setPipeline\(compositeBackdropPipeline\);pass.setBindGroup\(0,projectRegionCopyGroup\)/);
 assert.match(capture,/pass.setPipeline\(projectRegionCapturePipeline\)/);
 assert.doesNotMatch(capture,/setPipeline\((glassPipeline|compositeGlassPipeline)\)/);
 assert.match(render,/projectRegionCopyGroup=device.createBindGroup\([\s\S]*?resource:scene.createView\(\{baseMipLevel:halfBase,mipLevelCount:1\}\)/);
 assert.equal((render.match(/renderProjectRegionCapture\(encoder\);/g)||[]).length,2);
 assert.match(render,/glassDrawsInCapture:0,mutuallyExclusiveMaterials:true/);
 assert.match(render,/resolveInactiveClearRegion\(\{width:w,height\}\)/);
 assert.match(render,/boundary.getBoundingClientRect\(\).height/);
 assert.match(css,/--project-terminal-upper-gap:calc\(8px \+ .9\*var\(--project-card-inset\)\)/);
 assert.match(css,/var\(--project-title-ratio/);
 assert.match(css,/1\.04\*var\(--project-title-lines,1\)/);
 assert.match(css,/var\(--project-terminal-title-ratio/);
 assert.match(css,/var\(--project-resting-title-height\)\/var\(--project-terminal-title-height\)/);
 assert.match(render,/halfBase=Math.min\(1,scene.mipLevelCount-1\)/);
 assert.match(css,/var\(--project-regular-progress\)\*var\(--project-expanded-band-height,10%\)/);
 assert.match(expand,/"--project-regular-progress":"1"/);
 assert.match(css,/width:45.5px;height:45.5px/);
});

test("Inactive Clear region has its own dark scheme and native Clear blur",()=>{
 const p=resolveInactiveClearRegion({width:220,height:95});
 assert.equal(p.material,"clear");assert.equal(p.scheme,"dark");assert.equal(p.interactive,false);
 assert.equal(p.nativeInputLayerScale,.5);
 assert.equal(p.nativeInputBlurRadius,5+(95-48)/72*5);
 assert.equal(p.blurWord,Math.fround(Math.fround(p.nativeInputBlurRadius)*Math.fround(.4)));
 assert.equal(resolveInactiveClearRegion({width:700,height:22}).nativeInputBlurRadius,5);
});

test("Project foreground is presented with the fixed wallpaper glass frame",()=>{
 const renderer=src("sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),css=src("sites/_apex/assets/public-home.css");
 assert.match(renderer,/function syncProjectScrollPresentation\(\)/);
 assert.equal((renderer.match(/syncProjectScrollPresentation\(\);/g)||[]).length,2);
 assert.match(renderer,/project\.style\.setProperty\("--project-presented-scroll",offset\)/);
 assert.match(renderer,/if\(fixedProjectRoot\(\)\)\{[\s\S]*?engine\.renderAuthOnly\(\)/);
 assert.match(css,/position:sticky;top:0;height:100%;min-height:0;overflow:clip/);
 assert.match(css,/transform:translateY\(calc\(-1 \* var\(--project-presented-scroll,0px\)\)\)/);
 assert.match(renderer,/if\(key===projectRegionCaptureKey\)return/);
});

test("Internal artwork partition refracts without a synthetic reflective rim",()=>{
 const shader=src("sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl");
 const fragment=shader.slice(shader.indexOf("fn fsGlass("));
 const outer=fragment.indexOf("let silhouetteSigned=signed;");
 const partition=fragment.indexOf("if(topDistance>signed){signed=topDistance;");
 assert.ok(outer>=0&&partition>outer);
 assert.match(fragment,/let rim=exp\(-abs\(silhouetteSigned\)\*1\.16\)/);
 assert.doesNotMatch(fragment,/let rim=exp\(-abs\(signed\)/);
 // Refraction and the actual outer silhouette keep their original paths.
 assert.match(fragment,/let inner=refractionEnvelope\(signed,innerAmount,innerInvHeight\)/);
 assert.match(fragment,/let edge=clamp\(rim\*0\.28,0\.0,0\.28\)/);
 assert.match(fragment,/let signedRatio=nativeHalf1\(-signed\/nativeWidth\)/);
});

test("Artwork and lower glass have one fragment-owned material boundary",()=>{
 const shader=src("sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl");
 const render=src("sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js");
 const css=src("sites/_apex/assets/public-projects.css");
 assert.match(shader,/if\(region.params.x>0.0 && !split\)/);
 assert.match(shader,/textureSampleLevel\(projectArtworkDetail,projectArtworkSampler,uv,lod\)/);
 assert.match(shader,/color=mix\(color,paint.rgb,clamp\(paint.a\*region.params.w/);
 assert.match(css,/\.public-projects-root \.project-showcase-artwork\{\s*visibility:hidden/);
 assert.doesNotMatch(css,/clip-path:inset\(0 0 var\(--project-regular-height\)/);
 assert.match(render,/function drawRoutePanes\(pass,underlay=false\)/);
 assert.match(render,/artworkPresentation:"same-fragment"/);
 assert.deepEqual(artworkDetailSize(1600,1200),[1600,1200]);
 const [w,h]=artworkDetailSize(8000,4000);
 assert.ok(w<=4096&&w*h<=8*1024*1024&&Math.abs(w/h-2)<.002);
});

test("Project artwork stays original except the expanded raw backdrop fade",()=>{
 const css=src("sites/_apex/assets/public-projects.css");
 const entry=src("sites/_apex/assets/public-projects-entry.js");
 const renderer=src("sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js");
 const shader=src("sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl");
 assert.doesNotMatch(css+entry+renderer,/project-showcase-shade/);
 assert.match(renderer,/regionData.set\(\[height\*dpr,profile.blurWord,layer,opacity\],b\)/);
 assert.match(renderer,/regionData\[b\+4\]=shadeAlpha/);
 assert.match(shader,/if\(fade<=0.0\)\{return vec4<f32>\(paint.rgb,alpha\*coverage\);\}/);
 assert.match(shader,/let fade=clamp\(region.optics.x,0.0,1.0\)\*/);
 assert.match(shader,/let combined=alpha\*\(1.0-fade\)\+fade/);
 assert.match(shader,/return vec4<f32>\(rgb,combined\*coverage\)/);
 assert.doesNotMatch(shader,/color\*=1.0-clamp\(region.optics.x/);
});
