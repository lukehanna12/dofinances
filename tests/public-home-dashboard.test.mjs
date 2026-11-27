import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {DISMISS_MS,tileDismissProgress,tileDismissIconOpacity,tileDismissScale,tileDismissDrift,tileDismissBlur}
  from "../sites/_apex/assets/home-dashboard/dashboard-public-dismiss.js";
import {publicIconSpatialAlpha,publicLogoOvalRadius,homeAperture,apertureAlpha} from "../sites/_apex/assets/home-dashboard/dashboard-public-icon-fade.js";
import {PROJECT_SHOWCASE,PROJECT_CARD_ICONS,sortHomeProjectShowcase,publicProjectIconSource}
  from "../sites/_apex/assets/public-projects-catalog.js";
import {PROJECT_ICON_REVISIONS} from "../sites/_apex/assets/project-icon-revisions.js";
const asset=(path)=>readFileSync(new URL("../sites/_apex/"+path,import.meta.url),"utf8");
const home=asset("index.html"),style=asset("assets/public-home.css");
const original=asset("app/assets/dashboard-home.css");
const mirrored=asset("assets/home-dashboard/dashboard-home.css");
test("Apex homepage is the independent public copy of the live Dashboard",()=>{
  assert.match(home,/<section class="view dashboard-home" data-view="dashboard"/);
  assert.match(home,/<h1 id="dashboard-title" data-glass-text="clock-text" data-glass-material="clock-text">DoFinances<\/h1>/);
  assert.match(home,/<div id="cta6-mosaic" class="cta6-mosaic"/);
  assert.match(home,/src="\/assets\/home-dashboard\/dashboard-home-loader\.js"/);
  assert.deepEqual(mirrored,original,"Preserve exact private-dashboard lattice and optics styling");
  assert.match(style,/--workspace-wallpaper-image:url\("\/assets\/home-dashboard\/dashboard-cloud-veiled-colorful-fields\.avif"\)!important;/);
  assert.doesNotMatch(home,/\/app\/assets\/|href="\/app"|href="#(?:projects|settings|colosseum)/);
});
test("Three responsive actions include only one link, to the real sign-in route",()=>{
  const group=home.match(/<div class="cta6-bottom-action"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(group);
  const items=[...group[1].matchAll(/<(a|button)\b[^>]*>([^<]+)<\/\1>/g)].map(m=>[m[1],m[2].trim()]);
  assert.deepEqual(items,[["button","About"],["button","See Projects"],["a","Sign in"]]);
  assert.match(group[1],/<button class="cta6-action" type="button" data-home-cta-glass data-public-target="\/projects">See Projects<\/button>/);
   assert.equal((group[1].match(/data-home-cta-glass/g)||[]).length,3);
   assert.match(group[1],/<a class="cta6-action" data-home-cta-glass href="\/login">Sign in<\/a>/);
  assert.match(style,/--public-home-cta-width:calc\(100vw \* 5 \/ 12\);/);
  assert.match(style,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(style,/grid-column:1\/-1;/);
  assert.match(style,/\.cta6-action:hover,[\s\S]*?transform:scale\(1\.039\)/);
  assert.match(style,/\.cta6-action:is\(:hover,:focus-visible\):active\{\s*transform:scale\(1\.00783\)/);
  assert.match(style,/transform:scale\(1\.00783\); \/\* 1\.039 \* \.97 \*\//);
  assert.match(style,/\.cta6-action:active\{[\s\S]*?transform:scale\(\.97\)/);
});
test("Home rounded rectangles share WebGPU geometry, tint and press lighting",()=>{
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  const shader=asset("assets/home-dashboard/dashboard-gpu-glass.wgsl");
  assert.match(style,/@property --home-cta-tint\{\s*syntax:"<number>";/);
  assert.match(style,/min-height:58\.5px;\s*height:58\.5px;/);
  assert.match(style,/min-height:48px;\s*height:48px;/);
  assert.match(style,/border-radius:12px;/);
  assert.match(style,/--home-cta-tint 180ms cubic-bezier\(\.2,\.78,\.2,1\)/);
  assert.match(style,/transform:scale\(1\.039\)/);
  assert.match(style,/data-gpu-scene="ready"\] \.dashboard-home \.cta6-bottom-action \.cta6-action\{\s*background:rgb\(0 0 0 \/ calc\(1 - var\(--home-cta-tint\)\)\)!important;/);
  assert.doesNotMatch(style,/data-gpu-scene="ready"\][^{}]*\.cta6-action\{[^}]*background:transparent!important;/);
  assert.match(style,/--home-cta-tint:0;/);
  assert.match(style,/\.cta6-action:hover,[\s\S]*?--home-cta-tint:1;/);
  assert.match(renderer,/HOME_CTA_SELECTOR="\.cta6-bottom-action > \[data-home-cta-glass\]"/);
  assert.match(renderer,/tile\.hasAttribute\("data-home-cta-glass"\)\|\|/);
  assert.match(renderer,/makeLayoutData\(node,dpr,homeCtas\?sceneTop:authOriginTop\(\)\)/);
  assert.match(renderer,/pass\.draw\(6,audit\.homeCtaGlass\.count,0,tileCount\)/);
  assert.match(renderer,/tintModel:"shared-square-film",tintFilmStrength:0\.25,/);
  assert.match(renderer,/pressLightGain:GLASS_INTERACTION\.pressLight,/);
  assert.match(renderer,/let pointerPressFramePending=false;/);
  assert.match(renderer,/trackRunning&&!pointerPressFramePending&&/);
  assert.match(renderer,/authHover\.setPressed\(true,\{tapImpulse:homePress\|\|closePress\}\)/);
  assert.match(renderer,/if\(homeRelease\)pointerPressFramePending=true;/);
  assert.match(renderer,/backdrop:"GPU-composited-moving-squares"/);
  assert.match(renderer,/compositeGlassPipeline=device\.createRenderPipeline\(/);
  assert.match(renderer,/underlay\.draw\(6,tileCount\)/);
  assert.match(renderer,/mip\.setBindGroup\(0,compositeMips\[level-1\]\)/);
  assert.match(renderer,/homeCompositeActive\?homeCapsuleGroup:glassGroup/);
  assert.match(renderer,/entries:entries\(globalsBuffer,compositeSceneView\)/);
  assert.doesNotMatch(renderer,/homeCapsuleGroup=glassGroup/,
    "Capsule glass must not sample the static wallpaper alone");
  assert.match(renderer,/projects\|\|homeCtas\|\|card\?\.hasAttribute\("data-glass-dropdown"\)\?"independent":"nested"/);
  assert.match(shader,/let pointerLight=proximity\*\(hover\*0\.075\+pressed\*0\.06\)/);
  assert.doesNotMatch(shader,/pressEnergy|tile\.properties\.y == -9\.0\)\s*\{?[^}]*pressed/,
    "No CTA-specific interaction intensity");
  assert.match(shader,/let squareFilmStrength=0\.25;/);
  assert.match(shader,/var filmStrength=select\(0\.25,0\.60,authPane\)/);
  assert.match(shader,/if\(tile\.properties\.y == -9\.0\)\{filmStrength=squareFilmStrength;\}/);
  assert.match(shader,/color=clearTint\(color,localTint,filmStrength\)/);
  assert.match(shader,/return mix\(color,pigment\.rgb,clamp\(pigment\.w,0\.0,1\.0\)\*filmStrength\)/);
  assert.doesNotMatch(shader,/greenTransmission|tintProgress|filmStrength=0\.88|pressEnergy/,
    "No alternative capsule-only tint or lighting formula");
  // One instanced geometry shader and one shared SDF/LOD stage for all
  // tile shapes; only the actual DOM corner radii select the silhouette.
  assert.match(shader,/else if\(tile\.properties\.w==4\.0\)\{\s*field=mode4SDF\(/);
  assert.match(shader,/let d=min\(dimensions\.x,select\(dimensions\.y,region\.params\.x,split\)\)/);
  assert.match(shader,/let clearD=d\/pointScale;/);
  assert.match(shader,/let clearInnerAmount=max\(-60\.0,-clearD\)\*pointScale;/);
  assert.match(shader,/let clearInnerHeight=min\(20\.0,0\.36\*clearD\)\*pointScale;/);
  assert.match(shader,/let outerAmount=select\(select\(0\.2\*d,0\.0,authPane\),profile.face0.x,dropdown\);/);
  assert.match(shader,/let outerInvHeight=select\(select\(1\.0\/\(0\.125\*d\),0\.0,authPane\),1\.0\/max\(profile.face0.y,0.001\),dropdown\);/);
  assert.match(renderer,/projectFiniteNativeClearGlass\(/);
  assert.doesNotMatch(shader,/min\(tiles\[0\]\.rect\.z,tiles\[0\]\.rect\.w\)/);
  assert.doesNotMatch(renderer,/tileData\[p\+6\]=tileData\[6\]/);
  assert.match(renderer,/const corners=normalizeGlassCornerRadii\(/);
  assert.match(renderer,/const surface=resolveGlassSurface\(/);
  assert.match(renderer,/surface\.renderMode/);
  assert.match(shader,/field=cssCapsuleSDF\(in\.local,dimensions\)/);
  assert.match(style,/background:rgba\(5,46,23,\.45\)/);
  assert.match(style,/body\.public-home:not\(\[data-gpu-scene="ready"\]\)[^{}]*\.cta6-action:is\(:hover,:focus-visible\)\{[^}]*backdrop-filter:blur\(12px\)/);
  // Transmissive green means the scene's highlights and texture survive
  // with non-zero, channel-dependent contrast, unlike a flat color mix.
  const rgb=[6,27,16].map(v=>v/255);
  const transmission=[.28+rgb[0]*2.4,.40+rgb[1]*2.8,.30+rgb[2]*2.1];
  assert.ok(transmission[1]>transmission[2]&&transmission[2]>transmission[0],
    "Green-filter transmission must prefer green to blue to red");
  assert.ok(transmission.every(v=>v>.3&&v<.76),
    "At full hover, meaningful refracted source contrast must survive in every channel");
});
test("GitHub profile opens in a new tab; remaining public top-bar controls are inert",()=>{
  const nav=home.match(/<nav class="global-menu"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.match(nav,/<a class="public-github global-menu-control" href="https:\/\/github\.com\/lukehanna12" target="_blank" rel="noopener noreferrer" aria-label="GitHub profile \(opens in a new tab\)"/);
  assert.match(nav,/<svg viewBox="0 0 24 24"/);
  const desktop=nav.match(/<div class="global-menu-links"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  const dropdown=nav.match(/<div class="public-menu-panel"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(desktop&&dropdown,"Desktop navigation and mobile dropdown exist");
  const buttons=source=>[...source.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)]
    .map(m=>m[1].replace(/<[^>]*>/g,"").trim()).filter(Boolean);
  assert.deepEqual(buttons(desktop),["Quick Downloads","Projects","FAQs","Settings"]);
  assert.deepEqual(buttons(dropdown),buttons(desktop));
  assert.equal((nav.match(/<a\b/g)||[]).length,1,"GitHub is the only navigation link");
  assert.doesNotMatch(nav,/Colosseum|Providers|window\.location|onclick=/);
  assert.match(style,/\.global-menu-control:hover\{/);
  assert.match(style,/\.global-menu-control:active\{/);
  assert.match(nav,/<button class="global-menu-icon global-menu-control public-menu-toggle" id="public-menu-toggle" type="button" aria-label="Open navigation menu" aria-controls="public-menu-panel" aria-expanded="false"/);
  assert.match(nav,/<div class="public-menu-panel" id="public-menu-panel" aria-label="Navigation options" hidden>/);
  assert.match(home,/src="\/assets\/public-home-menu\.js"/);
  assert.match(style,/@media\(max-width:748px\)\{/);
  assert.doesNotMatch(style,/@media\(max-width:1122px\)/);
  assert.match(asset("assets/public-home-menu.js"),/matchMedia\("\(max-width:748px\)"\)/);
  assert.match(style,/\.global-menu-links\{display:none;\}/);
  assert.match(style,/\.public-menu-panel:not\(\[hidden\]\)\{/);
  const handler=asset("assets/public-home-menu.js");
  assert.match(handler,/toggle\.addEventListener\("click"/);
  assert.match(handler,/event\.key==="Escape"/);
  assert.match(handler,/compact\.addEventListener\("change",close\)/);
});
test("Viewport side fades alter square alpha only, while the photo and logo stay intact",()=>{
  assert.doesNotMatch(home,/public-home-edge-fade/,"Never place a dark scrim over the scene");
  assert.doesNotMatch(style,/\.public-home-edge-fade/);
  assert.match(style,/\.cta6-mosaic\{\s*--public-edge-fade-width:calc\(0\.75 \* \(\(1080px - 10 \* 13px\) \/ 11\)\);/);
  assert.match(style,/-webkit-mask-image:\s*linear-gradient\(to right/);
  assert.match(style,/rgba\(0,0,0,\.25\) 0,/);
  assert.match(style,/mask-image:\s*linear-gradient\(to right/);
  assert.match(style,/mask-size:100vw 100%;/);
  assert.match(style,/mask-position:center top;/);
  assert.match(style,/mask-composite:intersect;/,"Both square alpha fades must combine");
  assert.match(style,/-webkit-mask-composite:source-in;/);
  assert.match(style,/radial-gradient\(ellipse var\(--public-logo-oval-x\) var\(--public-logo-oval-y\)/);
  assert.match(style,/\.cta6-center h1\{\s*translate:0 calc\(-2\.5 \* var\(--cta6-title-tile\)\);/);
  assert.doesNotMatch(style,/linear-gradient\(to bottom/,"Do not darken the backdrop vertically");
  const shader=asset("assets/home-dashboard/dashboard-gpu-glass.wgsl");
  assert.match(shader,/let fadeWidth=max\(1\.0,0\.75\*tile\.rect\.z\);/);
  assert.match(shader,/let edgeDistance=min\(in\.position\.x,state\.viewport\.x-in\.position\.x\);/);
  assert.match(shader,/let edgeOpacity=mix\(0\.25,1\.0,clamp\(edgeDistance\/fadeWidth,0\.0,1\.0\)\);/);
  assert.match(shader,/logoOpacity=mix\(0\.48,1\.0,ovalDistance\*ovalDistance\);/);
  assert.match(shader,/let routeSpatialAlpha=select\(edgeOpacity\*logoOpacity,1\.0,authPane\);/);
  assert.match(shader,/let baseAlpha=coverage\*in\.introAlpha\*/);
  assert.match(shader,/if\(dismiss<=0\.0\)\{return vec4<f32>\(color,baseAlpha\);\}/,
    "Normal presentation must be byte-for-byte original material path");
  assert.match(shader,/let diffuseScale=vec2<f32>\(1\.0\+0\.085\*bloom,1\.0\+0\.065\*bloom\);/);
  assert.match(shader,/fn dissolveNoise\(p:vec2<f32>\)/);
  assert.match(shader,/fn dissolveField\(p:vec2<f32>\)/);
  // The fragment function also declares var field:vec3<f32> for its SDF.
  // Re-declaring that name for dissolve noise invalidates WGSL on real GPUs.
  assert.match(shader,/var field:vec3<f32>;/);
  assert.match(shader,/let noiseField=dissolveField\(/);
  assert.doesNotMatch(shader,/let field=dissolveField\(/,
    "Dissolution noise must not redeclare the SDF variable in WGSL");
  assert.match(shader,/\(noiseField-0\.5\)\*0\.30/);
  assert.match(shader,/\(0\.45\+0\.55\*noiseField\)/);
  assert.match(shader,/let edgeExposure=1\.0-clamp\(-signed\/11\.0,0\.0,1\.0\);/);
  assert.match(shader,/let fringe=\(1\.0-coverage\)\*fringeWindow\*0\.09\*/);
  assert.match(shader,/if\(dismiss>=1\.0\)\{return vec4<f32>\(color,0\.0\);\}/);
  assert.match(shader,/return vec4<f32>\(color,clamp\(alpha,0\.0,1\.0\)\);/);
  assert.doesNotMatch(shader,/smokeColor|poofColor|let smoke=|let billow=/,
    "No unsupported gray smoke or cartoon poof");
  assert.doesNotMatch(shader,/let grain=|let front=|let squeeze=|let contraction=/,
    "No lingering pixel-glitch, swipe-front, or contraction shader expressions");
  assert.doesNotMatch(style,/\.cta6-center::before/,"No logo fill or halo");
  assert.doesNotMatch(style,/background:rgba\(5,8,13,\.60\);/);
  assert.doesNotMatch(style,/\.cta6-center h1\s*\{[^}]*background:/,
    "The logo stays unfilled; only its vertical position changes");
  assert.doesNotMatch(asset("app/assets/dashboard-gpu-glass.wgsl"),/logoOpacity|ovalRadii/,
    "The private Dashboard renderer must remain untouched");
  assert.doesNotMatch(style,/\.cta6\{[^}]*width:\s*(?!1080px)\d+px;/);
});
test("sixteen Home mosaic icons share Projects' canonical SVG sources and stay black",()=>{
 const mosaic=asset("assets/home-dashboard/dashboard-mosaic.js");
 const publicProject=asset("assets/public-projects-entry.js");
 const projectCSS=asset("assets/public-projects.css");
 const homeCSS=asset("assets/public-home.css");
 assert.equal(PROJECT_SHOWCASE.length,16);
 assert.equal(Object.keys(PROJECT_CARD_ICONS).length,16);
 const match=mosaic.match(/const HOME_ICON_POSITIONS=Object\.freeze\((\[[^\n]*\])\)/);
 assert.ok(match,"Preserve the 16 original mosaic slot positions");
 const positions=JSON.parse(match[1]);
 assert.equal(positions.length,16);
 assert.equal(new Set(positions).size,16);
 assert.deepEqual(positions,["0:1","0:5","0:8","1:0","1:6","1:9",
   "2:1","2:9","3:0","3:10","4:2","4:5","4:8","5:1","5:6","5:9"]);
 const ordered=sortHomeProjectShowcase(PROJECT_SHOWCASE);
 assert.ok(ordered.every(p=>publicProjectIconSource(p.slug)===
   "/assets/project-icons/"+PROJECT_CARD_ICONS[p.slug]+".svg?v="+PROJECT_ICON_REVISIONS[PROJECT_CARD_ICONS[p.slug]]));
 for(const project of ordered)assert.ok(
   existsSync(new URL("../sites/_apex"+publicProjectIconSource(project.slug),import.meta.url)),
   "Both public views use an existing SVG for "+project.slug);
 assert.match(mosaic,/const sortedProjects=sortHomeProjectShowcase\(PROJECT_SHOWCASE\)/);
 assert.match(mosaic,/project\?publicProjectIconSource\(project\.slug\)/);
 assert.match(mosaic,/icon\.src=iconSource;/);
 assert.match(mosaic,/tile\.dataset\.homeProjectIcon=project\.slug;/);
 assert.doesNotMatch(mosaic,/tile\.dataset\.projectSlug/,
   "Home icon markers must not collide with Projects card data-project-slug selectors");
 assert.match(publicProject,/const iconSource=publicProjectIconSource\(project\.slug\)/);
 assert.match(publicProject,/icon\.src=iconSource;/);
 assert.doesNotMatch(mosaic,/const icons=\{|<svg class="cta6-icon"/);
 assert.match(homeCSS,/\.cta6-tile--icon img\.cta6-icon\{[^}]*filter:brightness\(0\);/);
 assert.match(projectCSS,/\.project-showcase-lucide\{[^}]*filter:brightness\(0\) invert\(1\)/);
});
test("Icon fade uses the same shader opacity as each square without cropping moving glyphs",()=>{
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(renderer,/trackIcons=all\.map\(cell=>cell\.querySelector\("\.cta6-icon"\)\)/);
  assert.match(renderer,/trackTiles\[i\]\.style\.opacity=\(combinedOpacity\*\s*tileDismissIconOpacity\(dissolving\)\)\.toFixed\(5\);/);
  assert.match(renderer,/const glyphAlpha=publicIconSpatialAlpha\(/);
  assert.match(renderer,/--public-icon-spatial-alpha/);
  assert.match(style,/body\.public-home\[data-gpu-scene="ready"\] \.dashboard-home \.cta6-mosaic\{\s*-webkit-mask-image:none;\s*mask-image:none;/);
  assert.match(style,/body\.public-home\[data-gpu-scene="ready"\] \.dashboard-home \.cta6-tile--webgpu \.cta6-icon\{\s*opacity:var\(--public-icon-spatial-alpha,1\);/);
  // The fallback retains the two original masks; private Dashboard untouched.
  assert.match(style,/mask-composite:intersect;/);
  assert.doesNotMatch(asset("app/assets/dashboard-gpu-renderer.js"),/publicIconSpatialAlpha/);
  assert.doesNotMatch(asset("app/assets/dashboard-home.css"),/public-icon-spatial-alpha/);
  const width=1440,height=856,dpr=2,tile=(950/11)*dpr;
  const logoY=height*dpr*0.5-2.5*(950/11)*dpr;
  const eps=1e-9;
  const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<eps,
    `expected ${expected}, got ${actual}`);
  near(publicIconSpatialAlpha(width*dpr/2,logoY,tile,width*dpr,height*dpr,dpr),0.48);
  near(publicIconSpatialAlpha(width*dpr/2,logoY+300*dpr,tile,width*dpr,height*dpr,dpr),1);
  near(publicIconSpatialAlpha(0,logoY+300*dpr,tile,width*dpr,height*dpr,dpr),0.25);
  near(publicIconSpatialAlpha(0.75*tile,logoY+300*dpr,tile,width*dpr,height*dpr,dpr),1);
  // Both independent fades multiply at a point near the left window edge.
  const ovalAtEdge=publicIconSpatialAlpha(0,logoY,tile,width*dpr,height*dpr,dpr);
  near(ovalAtEdge,0.25);
  const midOval=publicIconSpatialAlpha(width*dpr/2,logoY+(width*100/1280)/2*dpr,tile,width*dpr,height*dpr,dpr);
  near(midOval,0.61);
  assert.throws(()=>publicIconSpatialAlpha(10,10,0,100,100),RangeError);
});
test("Notification-inspired dismissal is explicitly provisional and clears all square lanes",()=>{
  assert.equal(DISMISS_MS,440);
  for(let row=0;row<7;row++)for(let col=0;col<11;col++){
    assert.equal(tileDismissProgress(0,row,col),0);
    assert.equal(tileDismissProgress(DISMISS_MS,row,col),1);
    let previous=0;
    for(const t of [40,200,400,600,800,970]){
      const p=tileDismissProgress(t,row,col);
      assert.ok(p>=previous&&p<=1,"Progress must be monotonic per square");
      previous=p;
    }
    const x=110+col*98,width=86,screen=1440;
    const origin=tileDismissDrift(0,row,col,x,width,screen);
    const middle=tileDismissDrift(.5,row,col,x,width,screen);
    const exit=tileDismissDrift(1,row,col,x,width,screen);
    assert.deepEqual(origin,{x:0,y:0});
    assert.ok(Math.abs(middle.x)<=0.9&&Math.abs(exit.x)<=0.9,
      "Glassy optical breakup must not send tiles offscreen");
    assert.ok(exit.y<0&&exit.y>=-1.151,
      "At most one-pixel local vertical motion");
    assert.ok(Math.abs(x+exit.x-x)<1,"An X-close is not a swipe");
  }
  assert.equal(tileDismissIconOpacity(0),1);
  assert.equal(tileDismissIconOpacity(1),0);
  assert.ok(tileDismissIconOpacity(.5)<1);
  assert.deepEqual(tileDismissScale(0),{x:1,y:1});
  assert.ok(Math.abs(tileDismissScale(1).x-1.085)<1e-12);
  assert.ok(Math.abs(tileDismissScale(1).y-1.065)<1e-12);
  assert.ok(tileDismissScale(.5).x>1&&tileDismissScale(.5).x<1.085,
    "No huge cartoon smoke expansion");
  assert.ok(tileDismissBlur(.4)>0&&tileDismissBlur(1)>tileDismissBlur(.4));
  assert.ok(tileDismissProgress(200,3,10)>=0&&tileDismissProgress(200,3,0)>=0);
  assert.ok(Math.abs(tileDismissProgress(200,3,10)-
    tileDismissProgress(200,3,0))<.06,
    "X-close optical dissolve is nearly simultaneous across the lattice");
  assert.throws(()=>tileDismissDrift(.5,3,4,120,0,1440),RangeError);
  const home=asset("index.html");
  const route=asset("assets/public-home-transition.js");
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(home,/href="\/login"/);
  assert.match(home,/src="\/assets\/public-home-transition\.js"/);
  assert.match(route,/history\.pushState/);
  assert.doesNotMatch(route,/location\.assign/);
  assert.match(route,/dofinances:home-dismiss/);
  assert.match(route,/prefers-reduced-motion: reduce/);
  assert.match(route,/dofinances:home-restore/);
  assert.match(route,/dispatchEvent\(new CustomEvent\("dofinances:home-track-resume"\)\);\s*current\.exit\(\)/);
  assert.match(renderer,/let restoreStart=null;/);
  assert.match(renderer,/let trackResumeRequested=false;/);
  assert.match(renderer,/addEventListener\("dofinances:home-track-resume"/);
  assert.match(renderer,/trackRunning=!reducedMotion\.matches;\s*lastFrameTime=performance\.now\(\);\s*lastMotionSubmission=0;\s*requestRender\(\)/);
  assert.match(renderer,/if\(trackRunning\)\s*trackSeconds\+=/);
  assert.match(renderer,/!reducedMotion\.matches&&\(trackResumeRequested\|\|/);

  assert.match(renderer,/tileDismissProgress\(elapsedDismiss,trackRows\[i\],trackColumns\[i\]\)/);
  assert.match(renderer,/tileDismissScale\(dissolving\)/);
  assert.match(renderer,/tileDismissDrift\(dissolving,trackRows\[i\],trackColumns\[i\],/);
  assert.match(renderer,/\(shrink\.x\*intro\.scale\)\.toFixed\(5\)/);
  assert.match(renderer,/brightness\(0\) blur\("/);
  assert.match(renderer,/\(shrink\.y\*intro\.scale\)\.toFixed\(5\)/);
  assert.match(renderer,/tileDismissBlur\(dissolving\)\.toFixed\(3\)/);
  assert.match(renderer,/tileData\[i\*TILE_FLOATS\+19\]=dismissProgress\[i\]/);
  assert.match(style,/data-public-route="leaving"/);
  assert.doesNotMatch(asset("app/assets/dashboard-gpu-renderer.js"),/tileDismissProgress/);
});
test("Public rendering uses explicitly copied shader and AVIF assets, not private /app paths",()=>{
  const names=["dashboard-mosaic.js","dashboard-gpu-renderer.js","dashboard-home-loader.js",
    "dashboard-public-icon-fade.js","dashboard-public-dismiss.js",
    "dashboard-optics.js","dashboard-interaction.js","dashboard-glass-model.js","dashboard-track.js",
    "dashboard-tint.js","sidebar-glass-oracle.js",
    "dashboard-gpu-scene.wgsl","dashboard-gpu-mipmap.wgsl","dashboard-gpu-glass.wgsl",
    "dashboard-cloud-veiled-colorful-fields.avif"];
  for(const name of names)assert.ok(existsSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url)),name);
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(renderer,/const base="\/assets\/home-dashboard\/";/);
  assert.match(renderer,/const url="\/assets\/home-dashboard\/dashboard-cloud-veiled-colorful-fields\.avif";/);
  assert.doesNotMatch(renderer,/"\/app\/assets\//);
  // The public optics/interaction intentionally diverge from /app to
  // consume the new shared public geometry contract. The authenticated
  // assets are UNCHANGED, not mirrored from the public renderer.
  // Public boot additionally releases its pre-paint gate on module-load failure.
  assert.match(asset("assets/home-dashboard/dashboard-home-loader.js"),/glassStartup="fallback"/);
  assert.doesNotMatch(asset("app/assets/dashboard-home-loader.js"),/glassStartup/);
  for(const name of ["dashboard-track.js","dashboard-tint.js","sidebar-glass-oracle.js"])
    assert.equal(asset("assets/home-dashboard/"+name),asset("app/assets/"+name),name+" stays in parity");
  assert.match(asset("assets/home-dashboard/dashboard-mosaic.js"),
    /import \{PROJECT_SHOWCASE,sortHomeProjectShowcase,publicProjectIconSource\}/);
  assert.doesNotMatch(asset("app/assets/dashboard-mosaic.js"),/public-projects-catalog/,
    "The separate authenticated /app mosaic must remain unchanged");
  assert.match(asset("assets/home-dashboard/dashboard-optics.js"),/resolveGlassOpticalGeometry\(/);
  assert.match(asset("assets/home-dashboard/dashboard-interaction.js"),/glassContainsPoint\(/);
  assert.doesNotMatch(asset("app/assets/dashboard-interaction.js"),/dashboard-glass-model/);
});

test("Public footer centers at bottom and is exactly seven-percent opaque",()=>{
  assert.match(home,/<footer class="workspace-footer" aria-label="Copyright">/);
  assert.match(style,/body\.public-home:has\(> #workspace-shell \.dashboard-home:not\(\[hidden\]\)\) > \.workspace-footer\{[^}]*left:50%!important;[^}]*transform:translateX\(-50%\)!important;[^}]*opacity:\.07!important;/);
  assert.match(style,/@media\(max-width:760px\)\{[\s\S]*\.workspace-footer\{[^}]*left:50%!important;/);
});

test("public bottom row belongs to shell: drops below viewport and reverses on returning",()=>{
  const route=asset("assets/public-home-transition.js");
  assert.match(style,/body\.public-home \.dashboard-home \.cta6-bottom-action\{[^}]*transform:translate3d\(-50%,0,0\);[^}]*transition:transform 440ms[^}]*opacity 390ms/);
  assert.match(style,/body\.public-home\[data-public-route="leaving"\] \.dashboard-home \.cta6-bottom-action\{[^}]*transform:translate3d\(-50%,calc\(100% \+ clamp\(42px,5\.4vh,66px\) \+ env\(safe-area-inset-bottom,0px\) \+ 28px\),0\);[^}]*opacity:0!important;/);
  assert.match(style,/body\.public-home\[data-direct-login="true"\] \.dashboard-home \.cta6-bottom-action\{[^}]*transition:none!important;/);
  assert.match(route,/function dismissHome\(/);
  assert.match(route,/function restoreHome\(\)\{[\s\S]*?body\.dataset\.publicRoute="returning"/);
  const auth=readFileSync(new URL("../src/components/Auth3.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(auth,/cta6-bottom-action|doofinances:home-dismiss|doofinances:home-restore/);
});
test("public top-bar text controls match /app text-link hover, not boxed-button styling",()=>{
  const app=asset("app/assets/workspace-enhancements.css");
  assert.match(app,/\.global-menu-links a,\.global-menu-account\{color:rgba\(230,230,235,\.8\);white-space:nowrap;transition:color 125ms ease;\}/);
  assert.match(app,/\.global-menu a:hover\{color:#fff;text-decoration:none;\}/);
  assert.match(style,/body:is\(\.public-home,\.public-login\) \.global-menu-control\{[\s\S]*?border-radius:0;[\s\S]*?color:rgba\(230,230,235,\.8\);[\s\S]*?transition:color 125ms ease;/);
  assert.match(style,/\.global-menu-control:hover\{\s*background:transparent;\s*color:#fff;/);
  assert.match(style,/\.global-menu-control:active\{\s*background:transparent;\s*color:#fff;\s*transform:none;/);
  assert.match(style,/\.global-menu-icon:hover,[\s\S]*?\.global-menu-icon\[aria-expanded="true"\]\{\s*color:#fff;background:rgba\(255,255,255,\.09\);/);
  assert.doesNotMatch(asset("index.html"),/public-theme\.(js|css)|public-theme-toggle/);
  assert.doesNotMatch(style,/\.global-menu-control:hover\{\s*background:rgba\(255,255,255,\.13\)/);
});

test("home mosaic registers the same glass silhouette optics without a flat duplicate",()=>{
 const mosaic=asset("assets/home-dashboard/dashboard-mosaic.js");
 const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
 assert.match(mosaic,/registerGlassSilhouette\(icon\)/);
 assert.match(asset("assets/public-projects-entry.js"),/registerGlassSilhouette\(icon\)/);
 assert.match(renderer,/trackIconBounds=all\.map/);
 assert.match(renderer,/homeIcons\.push\(/);
 assert.match(renderer,/boundsOverride:bounds/);
 assert.match(renderer,/!movingSlots\.has\(slot\)&&lanes\[19\]>0/);
 assert.match(style,/\.cta6-icon\[data-glass-icon-owned\]\{\s*clip-path:inset\(50%\)!important/);
 assert.match(style,/user-select:none/);
});

test("public DoFinances wordmark shares Projects typography without changing its scale",()=>{
  const projects=asset("assets/public-projects.css");
  for(const field of ["family","weight","leading","tracking"]){
    assert.ok(style.includes("--public-heading-"+field+":"));
    assert.ok(style.includes("var(--public-heading-"+field+")"));
    assert.ok(projects.includes("var(--public-heading-"+field+")"));
  }
  assert.match(style,/body\.public-home #dashboard-title\{[^}]*white-space:nowrap/);
});

test("Home wordmark shares the actual clock-text glass pipeline, not just CSS typography",()=>{
 const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
 const local=asset("assets/home-dashboard/dashboard-glass-local-title.js");
 assert.match(home,/id="dashboard-title" data-glass-text="clock-text" data-glass-material="clock-text"/);
 assert.match(renderer,/ctas\.push\(brand\)/);
  assert.match(renderer,/if\(homeBrand\)\{[\s\S]*?tileDismissProgress\(elapsed,0,5\)[\s\S]*?tileData\[p\+19\]=progress/);
 assert.match(renderer,/pass\.draw\(6,1,0,tileCount\+audit\.homeCtaGlass\.brandSlot\)/);
 assert.match(local,/\["Projects","DoFinances"\]\.includes\(text\)/);
 assert.match(style,/\.cta6-center > #dashboard-title\[data-glass-text-ready\]/);
});

test("Responsive Home aperture geometry and soft boundaries",()=>{
  const a=homeAperture({width:1440,height:900,logoWidth:720,logoHeight:120,centered:true});
  assert.equal(a[2]*2,720);assert.equal(a[3]*2,225);
  for(const [x,y,v] of [[0,0,.48],[a[2]/2,0,.61],[a[2],0,1],[0,a[3]/2,.61],[0,a[3],1]])
    assert.ok(Math.abs(apertureAlpha(a[0]+x,a[1]+y,a)-v)<1e-9);
  const b=homeAperture({width:1440,height:900,logoWidth:825,logoHeight:175,centered:false});
  assert.deepEqual(b,[937,613,-80,0]);
  // Exact 2.5x scaling of the prior aperture about the logo's bottom-left anchor.
  assert.equal(b[0],32+2.5*(394-32));
  assert.equal(b[1],868+2.5*(766-868));
  for(const [x,y,v] of [[100,900,0],[857,693,0],[897,850,.5],[937,850,1],[100,613,1],[100,653,.5],[100,693,0]])assert.equal(apertureAlpha(x,y,b),v);
  assert.deepEqual(homeAperture({width:1024,height:740,logoWidth:660,logoHeight:140,centered:false,feather:64}),[756,504,-64,0]);
  assert.match(asset("assets/home-dashboard/dashboard-gpu-renderer.js"),/uniform\.set\(homeAperture,continuous\?24:20\)/);
  assert.match(asset("assets/home-dashboard/dashboard-home-loader.js"),/observePublicLogoOval\(\)/);
});
