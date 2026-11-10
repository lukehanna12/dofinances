import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORKSPACE_WALLPAPERS,workspaceWallpaperForRoute,applyWorkspaceWallpaper,initWorkspaceWallpaper} from "../sites/_apex/app/assets/workspace-wallpapers.js";

test("nine app routes select eight distinct SHA-addressed wallpapers",()=>{
  const routes=["home","projects","settings","colosseum/utilities","colosseum/collections","colosseum/providers","colosseum/permissions","colosseum/diagnostics","colosseum/settings"];
  const images=routes.map(route=>workspaceWallpaperForRoute(route));
  assert.equal(new Set(images.map(image=>image.sha)).size,8);
  assert.strictEqual(images[2],images[8]);
  for(const {sha,ext,position} of images){
    assert.match(sha,/^[a-f0-9]{64}$/);
    assert.match(ext,/^(jpg|png|webp|avif)$/);
    assert.match(position,/^center [0-9]+%$/);
  }
  assert.equal(Object.keys(WORKSPACE_WALLPAPERS).length,8);
});
test("wallpaper geometry derives both the image and spacer from header height",()=>{
  const css=readFileSync(new URL("../sites/_apex/app/assets/workspace-wallpapers.css",import.meta.url),"utf8");
  assert.match(css,/--workspace-banner-height:202\.65625px/);
  assert.match(css,/body:has\(> #workspace-shell \.view\[data-view="home"\]:not\(\[hidden\]\)\) \{\s*--workspace-banner-height:538px/);
  // Both bars hide 94px; sixfold applies only to the exposed 74px.
  assert.equal(538-(44+50),6*(168-(44+50)));
  // Match the static spacing on either side of the desktop D badge.
  assert.equal(202.65625-165.328125,131.328125-(44+50));
  assert.match(css,/padding-top:calc\(var\(--workspace-banner-height\) - var\(--workspace-header-height\) \+ var\(--workspace-content-leading\)\)/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
});
test("every named page has the exact owner-selected wallpaper",()=>{
  const expected={
    home:"clouds-over-rice-terraces-high-quality.jpg",
    projects:"winding-icelandic-river-mountains.webp",
    settings:"misty-tropical-forest-hillside.avif",
    "colosseum/utilities":"waterfall-between-mossy-cliffs.jpg",
    "colosseum/collections":"misty-alpine-mountain-valley.jpg",
    "colosseum/providers":"green-water-foam-swirls.jpg",
    "colosseum/permissions":"autumn-colored-mountain-slopes.jpg",
    "colosseum/diagnostics":"steam-spewing-yellow-machine.jpg"
  };
  assert.deepEqual(Object.fromEntries(
    Object.entries(WORKSPACE_WALLPAPERS).map(([route,wallpaper])=>[route,wallpaper.name])
  ),expected);
  assert.strictEqual(workspaceWallpaperForRoute("colosseum/settings"),WORKSPACE_WALLPAPERS.settings);
});
test("footer ink colors reflect the six page-specific contrast adjustments",()=>{
  const expected={
    home:"#5c5c5c",
    projects:"#454545",
    settings:"#626262",
    "colosseum/utilities":"#666666",
    "colosseum/collections":"#303030",
    "colosseum/providers":"#c5d0ca",
    "colosseum/permissions":"#505050",
    "colosseum/diagnostics":"#dedede"
  };
  assert.deepEqual(Object.fromEntries(Object.entries(WORKSPACE_WALLPAPERS)
    .map(([route,entry])=>[route,entry.footerInk])),expected);
  assert.strictEqual(workspaceWallpaperForRoute("colosseum/settings"),WORKSPACE_WALLPAPERS.settings);
});
test("Home keeps its original pixels and a near-native desktop foreground",()=>{
  const css=readFileSync(new URL("../sites/_apex/app/assets/workspace-wallpapers.css",import.meta.url),"utf8");
  assert.match(css,/width:min\(100%,1100px\)/);
  assert.match(css,/data-wallpaper-route="home"/);
  assert.match(css,/filter:blur\(10px\)/);
  assert.match(css,/\.workspace-home-art-top/);
  assert.doesNotMatch(css,/\.workspace-home-art-bottom/);
  assert.equal(WORKSPACE_WALLPAPERS.home.sha,
    "656a4d103f5dd4dd4450a9da0954099c686b0e7d6d60f6fbfc35b3e14b2fe4a6");
  assert.equal(WORKSPACE_WALLPAPERS.home.path,"/app/assets/home-rice-terraces-hq.jpg");
});
test("route changes decode new wallpaper outside the immediate navigation turn and discard stale paints",async()=>{
  const variables=new Map(),writes=[];
  const body={
    dataset:{},
    style:{
      getPropertyValue:key=>variables.get(key)||"",
      setProperty:(key,value)=>{variables.set(key,value);writes.push([key,value]);}
    }
  };
  const doc={body};
  const pending=[],frames=[];
  class TestImage{
    set src(url){this.url=url;}
    decode(){return new Promise(resolve=>pending.push({url:this.url,resolve}));}
  }
  const win={Image:TestImage,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}};
  const controller=initWorkspaceWallpaper(doc,win);
  controller.show("home",true);
  assert.equal(body.dataset.wallpaperRoute,"home");
  controller.show("projects");
  controller.show("settings");
  assert.equal(body.dataset.wallpaperRoute,"home","sidebar responds before image decode");
  assert.equal(pending.length,2);
  pending[0].resolve();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(frames.length,0,"superseded route must not schedule its image paint");
  pending[1].resolve();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(body.dataset.wallpaperRoute,"settings");
  const imageWrites=writes.filter(([key])=>key==="--workspace-wallpaper-image").length;
  controller.show("colosseum/settings");
  assert.equal(body.dataset.wallpaperRoute,"colosseum/settings");
  assert.equal(writes.filter(([key])=>key==="--workspace-wallpaper-image").length,imageWrites,
    "two Settings routes must reuse their already-painted wallpaper");
  applyWorkspaceWallpaper(doc,"colosseum/settings");
  assert.equal(writes.filter(([key])=>key==="--workspace-wallpaper-image").length,imageWrites,
    "repeated route should not dirty the full-width wallpaper layer");
});
test("artwork scrolls in document flow, without a fixed bottom overlay",()=>{
  const css=readFileSync(new URL("../sites/_apex/app/assets/workspace-wallpapers.css",import.meta.url),"utf8");
  assert.match(css,/position:absolute;\s*inset:calc\(-1 \* var\(--workspace-top-overpull\)\)/);
  assert.match(css,/body\[data-wallpaper-route="home"\] > \.workspace-home-art-top/);
  assert.match(css,/width:min\(100%,1100px\)/);
  assert.match(css,/background-position:center,var\(--workspace-wallpaper-position,center 46%\)/);
  assert.doesNotMatch(css,/workspace-home-art-bottom|workspace-at-end|::after/);
});

test("Worker proxies only the selected wallpaper paths via library-iii",()=>{
  const router=readFileSync(new URL("../edge/router.mjs",import.meta.url),"utf8");
  const wrangler=JSON.parse(readFileSync(new URL("../edge/wrangler.jsonc",import.meta.url),"utf8"));
  assert.deepEqual(wrangler.services,[{binding:"LIBRARY_III",service:"library-iii"}]);
  assert.match(router,/WALLPAPER_ALLOWLIST\.get\(key\)/);
  assert.match(router,/library-iii\.internal\/objects\//);
});
