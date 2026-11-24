import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {planProjectExpansion,projectExpansionMovement,
  projectConveyorPosition,projectConveyorEdge}
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
        const atEdge=projectConveyorPosition(column,columns,shift,edge);
        assert.equal(atEdge.rowOffset,
          column+shift>=columns-1?1:0);
      }
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
  assert.match(controller,/animation\.reverse\(\)/);
  // The selected panel restores the original 620ms easing and the X
  // reverses exactly that WAAPI animation. Every row uses a common
  // 620ms linear conveyor, independent of traveled/remaining distance.
  assert.match(controller,/const EXPAND_MS=620;/);
  assert.match(controller,/const SELECTED_EASING="cubic-bezier\(\.22,\.72,\.24,1\)";/);
  assert.match(controller,/const CONVEYOR_EASING="linear";/);
  assert.match(controller,/duration:EXPAND_MS,easing:CONVEYOR_EASING/);
  assert.match(controller,/const travel=shift\*pitch;/);
  assert.match(controller,/projectConveyorEdge\(col,columns,shift\)/);
  assert.match(controller,/const ghost=node\.cloneNode\(true\)/);
  assert.match(controller,/ghost\.dataset\.projectCardDismissAt/);
  assert.match(controller,/const restoreFrom=Math\.min\(DISMISS_MS,elapsed\);/);
  assert.doesNotMatch(controller,/ROW_CASCADE_MS|delay:380|delay=dissolving|animation\.playbackRate=/);
  assert.match(renderer,/cardRestoreFrom/);
  assert.match(renderer,/cardRestoreFrom:DISMISS_MS\)-elapsed/);
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
