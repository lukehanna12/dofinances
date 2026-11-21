import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {DISMISS_MS,tileDismissProgress,tileDismissIconOpacity,tileDismissScale,tileDismissDrift,tileDismissBlur}
  from "../sites/_apex/assets/home-dashboard/dashboard-public-dismiss.js";
import {publicIconSpatialAlpha} from "../sites/_apex/assets/home-dashboard/dashboard-public-icon-fade.js";
const asset=(path)=>readFileSync(new URL("../sites/_apex/"+path,import.meta.url),"utf8");
const home=asset("index.html"),style=asset("assets/public-home.css");
const original=asset("app/assets/dashboard-home.css");
const mirrored=asset("assets/home-dashboard/dashboard-home.css");
test("Apex homepage is the independent public copy of the live Dashboard",()=>{
  assert.match(home,/<section class="view dashboard-home" data-view="dashboard"/);
  assert.match(home,/<h1 id="dashboard-title">doof<\/h1>/);
  assert.match(home,/<div id="cta6-mosaic" class="cta6-mosaic"/);
  assert.match(home,/src="\/assets\/home-dashboard\/dashboard-home-loader\.js"/);
  assert.deepEqual(mirrored,original,"Preserve exact private-dashboard lattice and optics styling");
  assert.match(style,/--workspace-wallpaper-image:url\("\/assets\/home-dashboard\/dashboard-cloud-veiled-colorful-fields\.avif"\)!important;/);
  assert.doesNotMatch(home,/\/app\/assets\/|href="\/app"|href="#(?:projects|settings|colosseum)/);
});
test("Three horizontal actions include only one link, to the real sign-in route",()=>{
  const group=home.match(/<div class="cta6-bottom-action"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(group);
  const items=[...group[1].matchAll(/<(a|button)\b[^>]*>([^<]+)<\/\1>/g)].map(m=>[m[1],m[2].trim()]);
  assert.deepEqual(items,[["button","Projects"],["a","Sign in"],["button","Contact"]]);
  assert.match(group[1],/<a class="cta6-action" href="\/login">Sign in<\/a>/);
  assert.match(style,/a\.cta6-action\[href="\/login"\]\{\s*min-width:150px;\s*width:150px;/);
  assert.match(style,/@media\(max-width:760px\)\{[\s\S]*?a\.cta6-action\[href="\/login"\]\{\s*min-width:129px;\s*width:129px;/);
  assert.match(style,/\.cta6-bottom-action\{[\s\S]*?flex-wrap:nowrap;/);
  assert.match(style,/\.cta6-action:hover\{[\s\S]*?transform:scale\(1\.03\)/);
  assert.match(style,/\.cta6-action:active\{[\s\S]*?transform:scale\(\.97\)/);
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
  assert.deepEqual(buttons(desktop),["Projects","Quick Downloads","Collections","Settings"]);
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
  assert.match(style,/--public-logo-oval-x:140px;/);
  assert.match(style,/--public-logo-oval-y:100px;/);
  assert.match(style,/--public-logo-shift:215\.90909px;/);
  assert.match(style,/\.cta6-center h1\{\s*translate:0 calc\(-2\.5 \* var\(--cta6-title-tile\)\);/);
  assert.match(style,/rgba\(0,0,0,\.744\) 60%/,"The opacity ramps quadratically through the oval");
  assert.match(style,/rgba\(0,0,0,\.60\) 0%/,"Squares are 60% opaque at logo center");
  assert.doesNotMatch(style,/linear-gradient\(to bottom/,"Do not darken the backdrop vertically");
  const shader=asset("assets/home-dashboard/dashboard-gpu-glass.wgsl");
  assert.match(shader,/let fadeWidth=max\(1\.0,0\.75\*tile\.rect\.z\);/);
  assert.match(shader,/let edgeDistance=min\(in\.position\.x,state\.viewport\.x-in\.position\.x\);/);
  assert.match(shader,/let edgeOpacity=mix\(0\.25,1\.0,clamp\(edgeDistance\/fadeWidth,0\.0,1\.0\)\);/);
  assert.match(shader,/let logoCenter=vec2<f32>\(/);
  assert.match(shader,/state\.viewport\.y\*0\.5-2\.5\*\(950\.0\/11\.0\)\*state\.viewport\.w/);
  assert.match(shader,/let ovalRadii=vec2<f32>\(140\.0,100\.0\)\*state\.viewport\.w;/);
  assert.match(shader,/let logoOpacity=mix\(0\.60,1\.0,ovalDistance\*ovalDistance\);/);
  assert.match(shader,/let baseAlpha=coverage\*in\.introAlpha\*/);
  assert.match(shader,/if\(dismiss<=0\.0\)\{return vec4<f32>\(color,baseAlpha\);\}/,
    "Normal presentation must be byte-for-byte original material path");
  assert.match(shader,/let plumeScale=vec2<f32>\(1\.0\+0\.40\*bloom,1\.0\+0\.32\*bloom\);/);
  assert.match(shader,/fn poofNoise\(p:vec2<f32>\)/);
  assert.match(shader,/fn poofCloud\(p:vec2<f32>\)/);
  assert.match(shader,/let billow=1\.0-smoothstep\(0\.56,1\.25,billowEdge\);/);
  assert.match(shader,/let smoke=cloudIn\*cloudOut\*billow\*fringe\*0\.43;/);
  assert.match(shader,/return vec4<f32>\(poofColor,clamp\(alpha,0\.0,1\.0\)\);/);
  assert.doesNotMatch(shader,/rightward material exit|let grain=|let front=|let squeeze=|convergent|infinite swipe/,
    "Dismissal is a localized soft poof, never a lateral swipe");
  assert.doesNotMatch(style,/\.cta6-center::before/,"No logo fill or halo");
  assert.doesNotMatch(style,/background:rgba\(5,8,13,\.60\);/);
  assert.doesNotMatch(style,/\.cta6-center h1\s*\{[^}]*background:/,
    "The logo stays unfilled; only its vertical position changes");
  assert.doesNotMatch(asset("app/assets/dashboard-gpu-glass.wgsl"),/logoOpacity|ovalRadii/,
    "The private Dashboard renderer must remain untouched");
  assert.doesNotMatch(style,/\.cta6\{[^}]*width:\s*(?!1080px)\d+px;/);
});
test("Icon fade uses the same shader opacity as each square without cropping moving glyphs",()=>{
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(renderer,/import \{publicIconSpatialAlpha\} from "\.\/dashboard-public-icon-fade\.js";/);
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
  near(publicIconSpatialAlpha(width*dpr/2,logoY,tile,width*dpr,height*dpr,dpr),0.60);
  near(publicIconSpatialAlpha(width*dpr/2,logoY+300*dpr,tile,width*dpr,height*dpr,dpr),1);
  near(publicIconSpatialAlpha(0,logoY+300*dpr,tile,width*dpr,height*dpr,dpr),0.25);
  near(publicIconSpatialAlpha(0.75*tile,logoY+300*dpr,tile,width*dpr,height*dpr,dpr),1);
  // Both independent fades multiply at a point near the left window edge.
  const ovalAtEdge=publicIconSpatialAlpha(0,logoY,tile,width*dpr,height*dpr,dpr);
  near(ovalAtEdge,0.25);
  const midOval=publicIconSpatialAlpha(width*dpr/2,logoY+50*dpr,tile,width*dpr,height*dpr,dpr);
  near(midOval,0.70);
  assert.throws(()=>publicIconSpatialAlpha(10,10,0,100,100),RangeError);
});
test("Notification-inspired dismissal is explicitly provisional and clears all square lanes",()=>{
  assert.equal(DISMISS_MS,620);
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
    assert.ok(Math.abs(middle.x)<=3.4&&Math.abs(exit.x)<=3.4,
      "Poof stays within a few pixels of its tile, never flies offscreen");
    assert.ok(exit.y<0&&exit.y>=-6.001,
      "Smoke rises gently at the original location");
    assert.ok(Math.abs(x+exit.x-x)<4,"The notification's X-close isn't a swipe");
  }
  assert.equal(tileDismissIconOpacity(0),1);
  assert.equal(tileDismissIconOpacity(1),0);
  assert.ok(tileDismissIconOpacity(.5)<1);
  assert.deepEqual(tileDismissScale(0),{x:1,y:1});
  assert.deepEqual(tileDismissScale(1),{x:1.4,y:1.32});
  assert.ok(tileDismissScale(.5).x>1&&tileDismissScale(.5).y>1,
    "Smoke expands instead of imploding");
  assert.ok(tileDismissBlur(.4)>0&&tileDismissBlur(1)>tileDismissBlur(.4));
  assert.ok(tileDismissProgress(200,3,10)>=0&&tileDismissProgress(200,3,0)>=0);
  assert.ok(Math.abs(tileDismissProgress(200,3,10)-
    tileDismissProgress(200,3,0))<.06,
    "X-close poof is nearly simultaneous across the lattice");
  assert.throws(()=>tileDismissDrift(.5,3,4,120,0,1440),RangeError);
  const home=asset("index.html");
  const route=asset("assets/public-home-transition.js");
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(home,/href="\/login"/);
  assert.match(home,/src="\/assets\/public-home-transition\.js"/);
  assert.match(route,/window\.location\.assign\(target\)/);
  assert.match(route,/dofinances:home-dismiss/);
  assert.match(route,/prefers-reduced-motion: reduce/);
  assert.match(renderer,/tileDismissProgress\(elapsedDismiss,trackRows\[i\],trackColumns\[i\]\)/);
  assert.match(renderer,/tileDismissScale\(dissolving\)/);
  assert.match(renderer,/tileDismissDrift\(dissolving,trackRows\[i\],trackColumns\[i\],/);
  assert.match(renderer,/shrink\.x\.toFixed\(5\)/);
  assert.match(renderer,/shrink\.y\.toFixed\(5\)/);
  assert.match(renderer,/tileDismissBlur\(dissolving\)\.toFixed\(3\)/);
  assert.match(renderer,/tileData\[i\*TILE_FLOATS\+19\]=dismissProgress\[i\]/);
  assert.match(style,/data-public-route="leaving"/);
  assert.doesNotMatch(asset("app/assets/dashboard-gpu-renderer.js"),/tileDismissProgress/);
});
test("Public rendering uses explicitly copied shader and AVIF assets, not private /app paths",()=>{
  const names=["dashboard-mosaic.js","dashboard-gpu-renderer.js","dashboard-home-loader.js",
    "dashboard-public-icon-fade.js","dashboard-public-dismiss.js",
    "dashboard-optics.js","dashboard-interaction.js","dashboard-track.js",
    "dashboard-tint.js","sidebar-glass-oracle.js",
    "dashboard-gpu-scene.wgsl","dashboard-gpu-mipmap.wgsl","dashboard-gpu-glass.wgsl",
    "dashboard-cloud-veiled-colorful-fields.avif"];
  for(const name of names)assert.ok(existsSync(new URL("../sites/_apex/assets/home-dashboard/"+name,import.meta.url)),name);
  const renderer=asset("assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(renderer,/const base="\/assets\/home-dashboard\/";/);
  assert.match(renderer,/const url="\/assets\/home-dashboard\/dashboard-cloud-veiled-colorful-fields\.avif";/);
  assert.doesNotMatch(renderer,/"\/app\/assets\//);
  for(const name of ["dashboard-mosaic.js","dashboard-optics.js","dashboard-home-loader.js",
    "dashboard-interaction.js","dashboard-track.js","dashboard-tint.js","sidebar-glass-oracle.js"])
    assert.equal(asset("assets/home-dashboard/"+name),asset("app/assets/"+name),name+" stays in parity");
});
