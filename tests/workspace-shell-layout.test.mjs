import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initWorkspaceScroll} from "../sites/_apex/app/assets/workspace-scroll.js";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("production app and Studio share stationary shell and copyright band",()=>{
  for(const file of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(file);
    assert.match(html,/<header class="topbar">/);
    assert.match(html,/id="workspace-scroll"/);
    assert.match(html,/class="workspace-scroll-end"/);
    assert.match(html,/<footer class="workspace-footer" id="workspace-footer"[^>]*>© DoFinances · 2026<\/footer>/);
    assert.doesNotMatch(html,/class="eyebrow"/);
    assert.equal((html.match(/data-view="settings"/g)||[]).length,1);
    assert.doesNotMatch(html,/data-view="colosseum\/settings"/);
    assert.equal((html.match(/class="workspace-footer"/g)||[]).length,1);
  }
});

test("workspace dark gray, clean image edges, full-width header shader and stationary navigation",()=>{
  const css=read("../sites/_apex/app/assets/workspace-wallpapers.css");
  const theme=read("../sites/_apex/app/assets/workspace-theme.css");
  const foundation=read("../sites/_apex/assets/site-foundation.css");
  assert.match(foundation,/--ui-canvas:\s*#171717/);
  assert.match(theme,/font-size: clamp\(36px, 4vw, 48px\)/);
  assert.match(css,/--workspace-banner-height:168px/);
  assert.match(css,/--workspace-top-overpull:96px/);
  assert.match(css,/position:fixed;\s*inset:calc\(-1 \* var\(--workspace-top-overpull\)\)/);
  assert.match(css,/height:var\(--workspace-bottom-strip-height\)/);
  assert.doesNotMatch(css,/--workspace-seam/);
  assert.doesNotMatch(css,/border-(?:top|bottom):1px solid/);
  assert.match(css,/background-position:center,center bottom/);
  // Home photo's side mask is intentional; the toolbar shader itself is unmasked.
  const toolbar=css.match(/> \.workspace-topbar-backdrop \{([^}]*)\}/)?.[1]||"";
  assert.match(css,/> \.workspace-topbar-backdrop \{/);
  assert.match(toolbar,/position:fixed/);
  assert.match(toolbar,/inset:0 0 auto/);
  assert.doesNotMatch(toolbar,/mask-image|transform/);
  assert.match(css,/\.topbar::before \{content:none\}/);
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=read(path);
    const glass=html.indexOf('class="workspace-topbar-backdrop"');
    const shell=html.indexOf('id="workspace-shell"');
    assert.ok(glass>0&&glass<shell,"blur must be outside animated main and shell");
    assert.match(html,/class="workspace-home-art workspace-home-art-top"/);
    assert.match(html,/class="workspace-home-art workspace-home-art-bottom"/);
  }
  assert.doesNotMatch(css,/--workspace-sidebar-fade-width/);
  assert.match(css,/backdrop-filter:blur\(18px\) saturate\(120%\)/);
  assert.doesNotMatch(css,/linear-gradient\(180deg,#000/);
  assert.match(css,/\.main,\s*body:has\(> #workspace-shell\.liquid-glass-preview\) \.main \{[\s\S]*?display:flex;[\s\S]*?overflow:hidden;/);
});

test("only content scrolls: bottom overpull prevented while top overpull remains possible",()=>{
  const states=new Set();
  const events={};
  const scroller={
    scrollTop:0,scrollHeight:1200,clientHeight:600,
    addEventListener:(key,fn)=>events[key]=fn,
    scrollTo:({top})=>{scroller.scrollTop=top}
  };
  const body={classList:{toggle:(x,flag)=>flag?states.add(x):states.delete(x)}};
  const doc={body,getElementById:(id)=>id==="workspace-scroll"?scroller:null};
  const win={addEventListener:()=>{}};
  const controls=initWorkspaceScroll(doc,win);
  assert.equal(states.has("workspace-at-end"),false);
  let cancelled=0;
  const event=(dy)=>({deltaY:dy,cancelable:true,preventDefault:()=>cancelled++});
  events.wheel(event(-40));
  assert.equal(cancelled,0);
  scroller.scrollTop=600;
  events.scroll();
  assert.equal(states.has("workspace-at-end"),true);
  events.wheel(event(80));
  assert.equal(cancelled,1);
  events.wheel(event(-80));
  assert.equal(cancelled,1);
  events.touchstart({touches:[{clientY:100}]});
  events.touchmove({touches:[{clientY:70}],cancelable:true,preventDefault:()=>cancelled++});
  assert.equal(cancelled,2);
  controls.reset();
  assert.equal(scroller.scrollTop,0);
  assert.equal(states.has("workspace-at-end"),false);
});
