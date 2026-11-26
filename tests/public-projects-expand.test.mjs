import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {planProjectExpansion,projectExpansionMovement,
  projectConveyorPosition,projectConveyorEdge,projectRowWrapPhases,
  projectForwardCloseFrames,projectDescriptionExtension,projectVerticalExpansionFrames,
  projectCloseDismissDuration,projectCloseReserveFrames}
  from "../sites/_apex/assets/public-projects-expand.js";

test("conveyor preserves a full pitch of separation at every animation sample",()=>{
  for(const columns of [2,3,4,5,6])
    for(let shift=1;shift<columns;shift++){
      for(let frame=0;frame<=100;frame++){
        const progress=frame/100;
        const occupied=Array.from({length:columns},(_,column)=>
          projectConveyorPosition(column,columns,shift,progress));
        for(const row of [0,1]){
          const positions=occupied.filter(p=>p.rowOffset===row).map(p=>p.x)
            .sort((a,b)=>a-b);
          for(let i=1;i<positions.length;i++)
            assert.ok(positions[i]-positions[i-1]>.999999,
              "Overlapping panels: "+JSON.stringify({columns,shift,progress,row,positions}));
        }
      }
      for(let column=0;column<columns;column++){
        const edge=projectConveyorEdge(column,columns,shift);
        assert.ok(edge>=0&&edge<=1);
        const atEdge=projectConveyorPosition(column,columns,shift,
          Math.min(1,edge+1e-7));
        assert.equal(atEdge.rowOffset,
          column+shift>=columns?1:0);
      }
    }
});
test("each wrapped card fades at the viewport seam, not in the rightmost slot",()=>{
  for(let columns=2;columns<=6;columns++)
    for(let shift=1;shift<columns;shift++)
      for(let column=columns-shift;column<columns;column++){
        const {fadeOutStart,seam,fadeInEnd}=
          projectRowWrapPhases(column,columns,shift);
        assert.ok(fadeOutStart>=0&&fadeOutStart<seam);
        assert.ok(seam<fadeInEnd&&fadeInEnd<=1);
        assert.ok(Math.abs((column+shift*seam)-(columns-.5))<1e-9,
          "disappear when the card is half outside the right edge");
        assert.ok(Math.abs((-0.5+shift*(fadeInEnd-seam)))<1e-9,
          "reappear when the card has crossed the left edge");
        const before=projectConveyorPosition(column,columns,shift,
          Math.max(0,seam-1e-4));
        const after=projectConveyorPosition(column,columns,shift,
          Math.min(1,seam+1e-4));
        assert.equal(before.rowOffset,0);
        assert.equal(after.rowOffset,1);
        assert.ok(Math.abs((before.x-after.x)-columns)<.003);
      }
});
test("six-column expansion consumes the selected card's original FULL row",()=>{
  const positions=planProjectExpansion(16,6,8);
  assert.deepEqual(positions[8],{row:2,column:1,span:6});
  for(let index=0;index<6;index++)
    assert.deepEqual(positions[index],{
      row:1,column:index+1,span:1
    });
  // Both left and right neighbors move into the front of the next row.
  assert.deepEqual(positions.slice(6,8).map(x=>[x.row,x.column]),
    [[3,1],[3,2]]);
  assert.deepEqual(positions.slice(9,13).map(x=>[x.row,x.column]),
    [[3,3],[3,4],[3,5],[3,6]]);
  assert.deepEqual(positions.slice(13,16).map(x=>[x.row,x.column]),
    [[4,1],[4,2],[4,3]]);
  assert.equal(projectExpansionMovement(7,6,8,positions[7]),"dissolve");
  assert.equal(projectExpansionMovement(9,6,8,positions[9]),"dissolve");
  assert.equal(projectExpansionMovement(12,6,8,positions[12]),"shift");
  assert.equal(projectExpansionMovement(13,6,8,positions[13]),"wrap");
  assert.equal(projectExpansionMovement(0,6,8,positions[0]),"still");
});
test("first-card expansion cascades across successive full rows",()=>{
  const p=planProjectExpansion(16,6,0);
  assert.deepEqual(p[0],{row:1,column:1,span:6});
  for(let i=1;i<=6;i++)
    assert.deepEqual(p[i],{row:2,column:i,span:1});
  assert.deepEqual(p[7],{row:3,column:1,span:1});
  assert.deepEqual(p[13],{row:4,column:1,span:1});
  assert.equal(projectExpansionMovement(5,6,0,p[5]),"dissolve");
  assert.equal(projectExpansionMovement(6,6,0,p[6]),"shift");
  assert.equal(projectExpansionMovement(7,6,0,p[7]),"wrap");
});
test("all responsive layouts, last-row selections and filtering preserve cards",()=>{
  for(const columns of [1,2,3,4,5,6])
    for(const count of [1,2,5,13,16])
      for(let selected=0;selected<count;selected++){
        const plan=planProjectExpansion(count,columns,selected);
        assert.equal(plan.length,count);
        const spots=new Set();
        for(const [i,position] of plan.entries()){
          assert.ok(position.row>=1&&position.column>=1);
          assert.ok(position.column+position.span-1<=columns);
          for(let col=position.column;col<position.column+position.span;col++){
            const key=position.row+":"+col;
            assert.equal(spots.has(key),false,
              "Overlapping cells for "+JSON.stringify({columns,count,selected,i,key}));
            spots.add(key);
          }
        }
        const cell=plan[selected];
        assert.equal(cell.span,columns);
        assert.equal(cell.row,Math.floor(selected/columns)+1);
      }
  assert.throws(()=>planProjectExpansion(0,6,0),RangeError);
  assert.throws(()=>planProjectExpansion(16,0,0),RangeError);
  assert.throws(()=>planProjectExpansion(16,6,16),RangeError);
});
test("lower-row closures use forward ease-out on precisely reversed spatial paths",()=>{
  const opening=[
    {computedOffset:0,transform:"translate3d(20px,240px,0)",opacity:"1"},
    {computedOffset:0.25,transform:"translate3d(120px,240px,0)",opacity:"1"},
    {computedOffset:0.5,transform:"translate3d(170px,240px,0)",opacity:"0"},
    {computedOffset:0.5001,transform:"translate3d(-290px,0,0)",opacity:"0"},
    {computedOffset:0.75,transform:"translate3d(-110px,0,0)",opacity:"1"},
    {computedOffset:1,transform:"translate3d(0,0,0)",opacity:"1"}
  ];
  const full=projectForwardCloseFrames(opening,1,
    {transform:"matrix(1, 0, 0, 1, 0, 0)",opacity:"1"});
  assert.equal(full.length,opening.length);
  assert.equal(full[0].offset,0);
  assert.equal(full[0].transform,"matrix(1, 0, 0, 1, 0, 0)");
  assert.deepEqual(full.slice(1).map(frame=>frame.offset),
    [.25,.4999,.5,.75,1]);
  assert.equal(full[full.length-1].transform,opening[0].transform);
  assert.equal(full[full.length-1].opacity,"1");
  assert.equal(full[1].transform,opening[4].transform);
  assert.equal(full[3].opacity,"0");
  // An interruption midway through entry must start at the visually
  // presented state; later (unreached) wrap milestones are discarded.
  const partial=projectForwardCloseFrames(opening,.45,
    {transform:"matrix(1, 0, 0, 1, 140, 240)",opacity:".6"});
  assert.equal(partial[0].offset,0);
  assert.equal(partial[0].opacity,"0.6");
  assert.equal(partial.length,3);
  assert.ok(partial[1].offset>0&&partial[1].offset<1);
  assert.equal(partial[1].transform,opening[1].transform);
  assert.equal(partial[partial.length-1].offset,1);
  assert.equal(partial[partial.length-1].transform,opening[0].transform);
  assert.throws(()=>projectForwardCloseFrames(opening,-.01,
    {transform:"none",opacity:"1"}),RangeError);
});
test("expanded project cards retain GPU-owned material and route-local lifecycle",async()=>{
  const asset=name=>readFile(new URL("../sites/_apex/assets/"+name,import.meta.url),"utf8");
  const [controller,entry,controls,renderer,css]=await Promise.all([
    asset("public-projects-expand.js"),
    asset("public-projects-entry.js"),
    asset("public-projects-controls.js"),
    asset("home-dashboard/dashboard-gpu-renderer.js"),
    asset("public-projects.css")
  ]);
  assert.match(entry,/mountProjectExpansion\(\{root,grid,animateGlass\}\)/);
  assert.match(entry,/expansion\.close\(\{immediate:true,restoreFocus:false\}\)/);
  assert.match(entry,/expansion\.unmount\(\)/);
  assert.match(controls,/public-projects:before-filter/);
  assert.match(controller,/tileDismissProgress|projectCardDismissAt/);
  // Neither the clicked pane nor any lower row may reverse WAAPI's
  // ease-out playback. Close paths instead run forward on a fresh clock.
  assert.doesNotMatch(controller,/animation\.reverse\(\)|animation\.updatePlaybackRate\(/);
  assert.match(controller,/const contract=animate\(current\.card,/);
  assert.match(controller,/const contractButton=animate\(closeButton,/);
  assert.match(controller,/duration:EXPAND_MS,easing:SELECTED_EASING/);
  assert.match(controller,/const frames=projectForwardCloseFrames\(/);
  assert.match(controller,/const returning=animate\(node,frames,/);
  // The selected card's X-close is a NEW forward 620ms ease-out, not
  // WAAPI.reverse() of its easing. All siblings share one spatial
  // 620ms ease-out without stagger or different per-row velocities.
  assert.match(controller,/const EXPAND_MS=620;/);
  assert.match(controller,/const SELECTED_EASING="cubic-bezier\(\.22,\.72,\.24,1\)";/);
  assert.match(controller,/const CONVEYOR_EASING=SELECTED_EASING;/);
  assert.match(controller,/duration:EXPAND_MS,easing:CONVEYOR_EASING/);
  assert.match(controller,/const travel=shift\*pitch;/);
  assert.match(controller,/projectRowWrapPhases\(col,columns,shift\)/);
  assert.match(controller,/projectConveyorEdge\(column,columns,shift\)/);
  assert.match(controller,/const ghost=node\.cloneNode\(true\)/);
  assert.match(controller,/ghost\.dataset\.projectCardDismissAt/);
  assert.match(controller,/ghost\.dataset\.projectCardOpticalColumn/);
  // Reset clone tracks: an absolutely-positioned grid child with an
  // explicit gridRow otherwise takes the NEXT row as its containing block.
  assert.match(controller,/ghost\.style\.gridArea="auto"/);
  assert.match(controller,/ghost\.style\.gridRow="auto"/);
  assert.match(controller,/ghost\.style\.gridColumn="auto"/);
  assert.match(controller,/ghost\.dataset\.projectCardDismissAt/);
  // The old 440ms optical opacity multiplier delayed the destination pane
  // on top of WAAPI's entrance fade. Only the original silhouette dissolves.
  assert.doesNotMatch(controller,/node\.dataset\.projectCardAppearAt=|node\.dataset\.projectCardDisappearAt=/);
  assert.doesNotMatch(renderer,/cardAppearStart|cardDisappearStart|tileData\[p\+18\]\*=appearance/);
  assert.match(controller,/\{offset:0,transform:translate\(-travel,0\),opacity:0\}/);
  assert.match(controller,/\{offset:fadeEnd,transform:translate\(-travel\*\(1-fadeEnd\),0\),opacity:1\}/);
  assert.match(controller,/const restoreFrom=Math\.min\(DISMISS_MS,/);
  assert.doesNotMatch(controller,/ROW_CASCADE_MS|delay:380|delay=dissolving|animation\.playbackRate=/);
  assert.match(renderer,/cardRestoreFrom/);
  assert.match(renderer,/cardRestoreFrom:DISMISS_MS\)-/);
  assert.match(renderer,/Math\.max\(0,elapsed\)/);
  assert.match(renderer,/const AUTH_PANE_CAPACITY=32;/);
  assert.match(css,/project-showcase-dissolve-ghost/);

  assert.match(controller,/gridTemplateColumns/);
  assert.match(controller,/position="absolute"/);
  assert.match(renderer,/projectCardDismissAt/);
  assert.match(renderer,/projectCardRestoreAt/);
  assert.match(renderer,/tileDismissProgress\(elapsed,0,col\)/);
  assert.match(renderer,/node\.dataset\.publicProjectGlass==="expand-close"/);
  assert.match(css,/\.project-showcase-expand-close/);
  assert.match(css,/data-auth-gpu-scene="ready"/);
  assert.doesNotMatch(css,/\.has-project-expansion[^{]*\{[^}]*backdrop-filter:[^n]/);
  assert.doesNotMatch(controller,/\bfetch\s*\(|\bnavigate\s*\(/);
});

test("description row adds enough space for measured copy and displaces lower rows on the same clock",()=>{
  assert.equal(projectDescriptionExtension(60,16),152);
  assert.equal(projectDescriptionExtension(220,12),288);
  assert.throws(()=>projectDescriptionExtension(-1,12),RangeError);
  const frames=projectVerticalExpansionFrames([
    {offset:0,transform:"translate3d(-100px,0px,0)",opacity:1},
    {offset:.5,transform:"translate3d(20px,0px,0)",opacity:0},
    {offset:1,transform:"translate3d(0px,0px,0)",opacity:1}
  ],180);
  assert.deepEqual(frames.map(f=>f.transform),[
    "translate3d(-100px,-180px,0)","translate3d(20px,-90px,0)","translate3d(0px,0px,0)"
  ]);
});


test("small close control dissolves before the row completes, releasing badge space continuously",()=>{
  const duration=projectCloseDismissDuration(40,40);
  assert.ok(duration>180&&duration<440&&duration<620);
  assert.ok(projectCloseDismissDuration(20,20)<duration);
  assert.equal(projectCloseDismissDuration(120,120),440);
  const frames=projectCloseReserveFrames(53);
  assert.equal(frames[0].paddingRight,"53px");
  assert.equal(frames.at(-1).paddingRight,"0px");
  for(let i=1;i<frames.length;i++)assert.ok(parseFloat(frames[i].paddingRight)<parseFloat(frames[i-1].paddingRight));
  assert.equal(projectCloseReserveFrames(0).at(-1).paddingRight,"0px");
});

test("Projects heading shares expansion progress but survives direct card handoffs",async()=>{
 const asset=name=>readFile(new URL("../sites/_apex/assets/"+name,import.meta.url),"utf8");
 const [e,css,r,s,c]=await Promise.all(["public-projects-expand.js","public-projects.css","home-dashboard/dashboard-gpu-renderer.js","home-dashboard/dashboard-gpu-glass.wgsl","home-dashboard/dashboard-glass-continuous.js"].map(asset));
 assert.match(e,/if\(!preserveHeading\)setHeadingScale\(\.7,duration,sharedStart\)/);
 assert.match(e,/discard\(\{preserveHeading:true\}\)/);
 assert.match(e,/if\(!card\|\|previous.phase==="closing"\)setHeadingScale/);
 assert.match(e,/setHeadingScale\(1,EXPAND_MS,sharedStart\)/);
 assert.match(css,/scale:var\(--project-heading-scale\);transform-origin:left center/);
 assert.match(css,/margin-bottom:calc\(\(var\(--project-heading-scale\) - 1\)\*1em\*var\(--public-heading-leading\)\)/);
 assert.match(r,/Math.ceil\(naturalWidth\*dpr\)/);
 assert.match(s,/scaledTitleGlyphField\(in.local\/titleScale,in.tileIndex\)/);
 assert.match(c,/evaluateContinuousTitleField\(title,local\)/);
});
