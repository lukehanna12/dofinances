import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initWorkspaceScroll,sidebarEndShrink} from "../sites/_apex/app/assets/workspace-scroll.js";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("production and Studio use one document-scrolling page beneath sticky navigation",()=>{
  const css=read("../sites/_apex/app/assets/workspace-wallpapers.css");
  const enhanced=read("../sites/_apex/app/assets/workspace-enhancements.css");
  const theme=read("../sites/_apex/app/assets/workspace-theme.css");
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    assert.match(html,/<header class="topbar">/);
    assert.match(html,/id="workspace-scroll"/);
    assert.doesNotMatch(html,/workspace-scroll-end|workspace-home-art-bottom/);
    assert.match(html,/<footer class="workspace-footer" id="workspace-footer"[^>]*>© DoFinances · 2026<\/footer>/);
    assert.ok(html.indexOf('id="workspace-scroll"')<html.indexOf('id="workspace-footer"'));
    assert.ok(html.indexOf('id="workspace-footer"')>html.lastIndexOf('</div>'),"bottom photo footer follows page shell");
    assert.doesNotMatch(html,/workspace-topbar-backdrop/);
    assert.equal((html.match(/data-view="settings"/g)||[]).length,1);
    assert.equal((html.match(/class="workspace-footer"/g)||[]).length,1);
  }
  assert.match(css,/--workspace-banner-height:202\.65625px/);
  assert.match(css,/--workspace-banner-height:538px/);
  assert.match(css,/--workspace-top-overpull:96px/);
  assert.match(css,/--ui-canvas,#171717/);
  assert.match(css,/overscroll-behavior-y:none/);
  assert.match(css,/position:absolute;\s*inset:calc\(-1 \* var\(--workspace-top-overpull\)\)/);
  assert.doesNotMatch(css,/body:has\(> #workspace-shell\)::after|workspace-at-end/);
  assert.match(css,/background-position:center,center bottom/);
  assert.match(css,/\.workspace-scroll \{[\s\S]*?overflow:visible;/);
  assert.match(css,/\.topbar \{\s*position:sticky;/);
  assert.match(css,/\.main,\s*body:has\(> #workspace-shell\.liquid-glass-preview\) \.main \{[\s\S]*?overflow:visible;/);
  assert.match(css,/\.workspace-footer \{[\s\S]*?position:relative;/);
  assert.doesNotMatch(css,/\.workspace-footer \{transition:opacity|opacity:0/);
  assert.match(theme,/\.sidebar \{[\s\S]*?position: sticky;/);
  const studioMaterial=read("../studio/sidebar/sidebar-glass.css");
  assert.doesNotMatch(studioMaterial,/position:fixed;\s*inset:0;/,
    "Studio must not paint a separate fixed decorative page behind the real wallpaper");
  assert.match(studioMaterial,/glass-scene-neutral\) \{[\s\S]*?--workspace-wallpaper-image:/);
  assert.match(studioMaterial,/glass-scene-prism\) \{[\s\S]*?--workspace-wallpaper-image:/);
  assert.doesNotMatch(studioMaterial,/background:linear-gradient\(90deg,rgba\(7,13,17/);
  assert.match(enhanced,/--global-menu-height:44px/);
  assert.match(enhanced,/body:has\(> #workspace-shell\) \.shell\{[\s\S]*?height:auto;/);
  assert.match(enhanced,/body:has\(> #workspace-shell\) \.main,[\s\S]*?height:auto;/);
  assert.doesNotMatch(enhanced,/\.shell\{padding-top:var\(--global-menu-height\);height:100dvh;/);

  const header=css.match(/body:has\(> #workspace-shell\) \.topbar \{([^}]*)\}/)?.[1]||"";
  assert.match(header,/position:sticky/);
  assert.match(header,/z-index:20/);
  const frost=css.match(/body:has\(> #workspace-shell\) \.topbar::before \{([^}]*)\}/)?.[1]||"";
  assert.match(frost,/position:absolute/);
  assert.match(frost,/width:100vw/);
  assert.match(frost,/backdrop-filter:blur\(18px\) saturate\(120%\)/);
  assert.match(css,/\.topbar > \* \{\s*position:relative;\s*z-index:1;/);
  assert.doesNotMatch(css,/\.workspace-topbar-backdrop/);
  const footer=css.match(/> \.workspace-footer \{([^}]*)\}/)?.[1]||"";
  assert.match(footer,/position:relative/);
  assert.match(footer,/background-image:[\s\S]*?--workspace-wallpaper-image/);
  assert.match(footer,/background-position:center,center bottom/);
  assert.match(css,/body\[data-wallpaper-route="home"\] > \.workspace-footer::before/);
  assert.match(css,/body\[data-wallpaper-route="home"\] > \.workspace-footer::after/);
});
test("sticky sidebar contracts at footer boundary without changing its top edge",()=>{
  assert.equal(sidebarEndShrink(900,950),0);
  assert.equal(sidebarEndShrink(900,900),0);
  assert.equal(sidebarEndShrink(900,880),20);
  assert.equal(sidebarEndShrink(900,860),40);
  assert.equal(sidebarEndShrink(900,899.37),0.75);
  assert.equal(sidebarEndShrink(0,860),0);
  const css=read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(css,/height:calc\(100dvh - var\(--global-menu-height\) - var\(--workspace-header-height\) - var\(--workspace-sidebar-gap\) - var\(--workspace-sidebar-bottom-gap\) - var\(--workspace-sidebar-end-shrink,0px\)\)/);
  assert.match(css,/bottom:calc\(var\(--workspace-sidebar-bottom-gap\) \+ 22px \+ var\(--workspace-sidebar-end-shrink,0px\)\)/);
  const handlers={},frames=[],writes=[];
  let shellBottom=1100;
  const shell={getBoundingClientRect:()=>({bottom:shellBottom}),
    style:{setProperty:(key,value)=>writes.push([key,value])}};
  const doc={scrollingElement:{scrollTop:0,scrollHeight:1000,clientHeight:900},
    getElementById:key=>key==="workspace-shell"?shell:null};
  const win={innerHeight:900,addEventListener:(name,handler)=>handlers[name]=handler,
    requestAnimationFrame:fn=>frames.push(fn),
    matchMedia:()=>({matches:false})};
  const {sync}=initWorkspaceScroll(doc,win);
  assert.equal(frames.length,1);
  frames.shift()();
  assert.deepEqual(writes.at(-1),["--workspace-sidebar-end-shrink","0px"]);
  shellBottom=880;
  handlers.scroll();handlers.scroll();
  assert.equal(frames.length,1,"coalesce scroll measurements into one frame");
  frames.shift()();
  assert.deepEqual(writes.at(-1),["--workspace-sidebar-end-shrink","20px"]);
  handlers.scroll();frames.shift()();
  assert.equal(writes.length,2,"skip redundant style mutations");
  shellBottom=860;handlers.resize();frames.shift()();
  assert.deepEqual(writes.at(-1),["--workspace-sidebar-end-shrink","40px"]);
  shellBottom=1200;sync();frames.shift()();
  assert.deepEqual(writes.at(-1),["--workspace-sidebar-end-shrink","0px"]);
});

test("root scrolling guards top, bottom, and right edges while preserving back swipe",()=>{
  const events={};let cancelled=0,scrollCalls=0;
  const root={scrollTop:0,scrollLeft:0,scrollHeight:1600,clientHeight:700,scrollWidth:900,clientWidth:900};
  const doc={scrollingElement:root};
  const win={addEventListener:(name,fn)=>events[name]=fn,scrollTo:({top})=>{scrollCalls++;root.scrollTop=top}};
  const controls=initWorkspaceScroll(doc,win);
  const wheel=(deltaY,deltaX=0)=>({deltaX,deltaY,cancelable:true,preventDefault:()=>cancelled++});
  events.wheel(wheel(-25));assert.equal(cancelled,1,"top upward overpull blocked");
  events.wheel(wheel(25));assert.equal(cancelled,1,"normal downward scrolling allowed");
  root.scrollTop=450;
  events.wheel(wheel(-25));events.wheel(wheel(25));
  assert.equal(cancelled,1,"interior scrolling must not be blocked");
  root.scrollTop=900;
  events.wheel(wheel(25));assert.equal(cancelled,2,"bottom overpull blocked");
  events.wheel(wheel(-25));assert.equal(cancelled,2,"normal upward scrolling allowed");
  events.wheel(wheel(0,35));assert.equal(cancelled,3,"rightward overflow blocked");
  events.wheel(wheel(0,-35));assert.equal(cancelled,3,"back gesture remains available");
  root.scrollTop=0;
  const touch=(x,y)=>({touches:[{clientX:x,clientY:y}],cancelable:true,preventDefault:()=>cancelled++});
  events.touchstart(touch(100,100));events.touchmove(touch(100,110));
  assert.equal(cancelled,4,"top touch rubber-band blocked");
  events.touchmove(touch(110,110));
  assert.equal(cancelled,4,"rightward back swipe allowed");
  events.touchmove(touch(95,110));
  assert.equal(cancelled,5,"outward right-edge swipe blocked");
  events.touchend();
  root.scrollTop=900;
  events.touchstart(touch(100,120));events.touchmove(touch(100,80));
  assert.equal(cancelled,6,"bottom touch rubber-band blocked");
  controls.reset();
  assert.equal(scrollCalls,1);
  assert.equal(root.scrollTop,0);
});
