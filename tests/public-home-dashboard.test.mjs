import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
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
  assert.match(style,/@media\(max-width:1122px\)\{/);
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
  assert.match(style,/-webkit-mask-image:linear-gradient\(to right/);
  assert.match(style,/rgba\(0,0,0,\.25\) 0,/);
  assert.match(style,/mask-size:100vw 100%;/);
  assert.match(style,/mask-position:center top;/);
  assert.doesNotMatch(style,/linear-gradient\(to bottom/,"Do not darken the backdrop vertically");
  const shader=asset("assets/home-dashboard/dashboard-gpu-glass.wgsl");
  assert.match(shader,/let fadeWidth=max\(1\.0,0\.75\*tile\.rect\.z\);/);
  assert.match(shader,/let edgeDistance=min\(in\.position\.x,state\.viewport\.x-in\.position\.x\);/);
  assert.match(shader,/let edgeOpacity=mix\(0\.25,1\.0,clamp\(edgeDistance\/fadeWidth,0\.0,1\.0\)\);/);
  assert.match(shader,/clamp\(tile\.motion\.z,0\.0,1\.0\)\*edgeOpacity/);
  assert.match(style,/\.cta6-center::before\{\s*content:"";\s*position:absolute;/);
  assert.match(style,/width:230px;\s*height:110px;/);
  assert.match(style,/background:radial-gradient\(ellipse at center,\s*rgba\(5,8,13,\.6\) 0%/);
  assert.match(style,/\.cta6-center h1\{\s*position:relative;\s*z-index:1;/);
  assert.doesNotMatch(style,/rgba\(5,8,13,\.7[0-9]/,"Doof oval must never exceed 60% opacity");
  assert.doesNotMatch(style,/\.cta6\{[^}]*width:\s*(?!1080px)\d+px;/);
});
test("Public rendering uses explicitly copied shader and AVIF assets, not private /app paths",()=>{
  const names=["dashboard-mosaic.js","dashboard-gpu-renderer.js","dashboard-home-loader.js",
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
