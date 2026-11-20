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
  assert.match(style,/\.cta6-bottom-action\{[\s\S]*?flex-wrap:nowrap;/);
  assert.match(style,/\.cta6-action:hover\{[\s\S]*?transform:scale\(1\.03\)/);
  assert.match(style,/\.cta6-action:active\{[\s\S]*?transform:scale\(\.97\)/);
});
test("GitHub mark and Quick Downloads appear in inert public top bar",()=>{
  const nav=home.match(/<nav class="global-menu"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.match(nav,/<button class="public-github global-menu-control" type="button" aria-label="GitHub"/);
  assert.match(nav,/<svg viewBox="0 0 24 24"/);
  const controls=[...nav.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<[^>]*>/g,"").trim()).filter(Boolean);
  assert.deepEqual(controls,["Projects","Quick Downloads","Collections","Providers","Settings"]);
  assert.doesNotMatch(nav,/Colosseum|<a\b|window\.location|onclick=/);
  assert.match(style,/\.global-menu-control:hover\{/);
  assert.match(style,/\.global-menu-control:active\{/);
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
