/* Public Projects' row-expansion controller.
 * The same WebGPU panes remain owned by dashboard-gpu-renderer.js. This
 * module only plans DOM grid positions and animates actual HTML rectangles.
 * No CSS optical substitute, second canvas or private API is introduced.
 */
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";

// Preserve the original selected-card expansion and forward-eased X close.
// All displaced cards share the exact same temporal progress as the
// widening panel, so the next row does not arrive after expansion ends.
const EXPAND_MS=620;
const SELECTED_EASING="cubic-bezier(.22,.72,.24,1)";
// Match selected-pane progress while retaining a shared conveyor pitch.
const CONVEYOR_EASING=SELECTED_EASING;
const clampInt=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;

/* Pure stable row packing. The clicked card occupies its ENTIRE original row,
 * including the slots on either side. Its rowmates become the first cards in
 * the following row, pushing every subsequent card along in original order.
 * Works for filtering, incomplete final rows and every responsive column count.
 */
export function planProjectExpansion(count,columns,selectedIndex){
  if(!clampInt(count,1,1000)||!clampInt(columns,1,100)||
     !clampInt(selectedIndex,0,count-1))
    throw new RangeError("Invalid public-project expansion geometry");
  const rowStart=Math.floor(selectedIndex/columns)*columns;
  const selectedRow=Math.floor(selectedIndex/columns);
  return Array.from({length:count},(_,index)=>{
    if(index<rowStart)return {
      row:Math.floor(index/columns)+1,column:index%columns+1,span:1
    };
    if(index===selectedIndex)return {row:selectedRow+1,column:1,span:columns};
    const rank=index-rowStart-(index>selectedIndex?1:0);
    return {row:selectedRow+2+Math.floor(rank/columns),
      column:rank%columns+1,span:1};
  });
}
/* Pure conveyor geometry, in column pitches. Every moving pane advances
 * at precisely the same speed; crossing is per-card, never one shared
 * teleport timestamp that causes siblings to overlap at row boundaries.
 * Cards enter the following row one pitch before its left edge. */
export function projectConveyorPosition(column,columns,shift,progress){
  if(!Number.isInteger(column)||!Number.isInteger(columns)||columns<1||
     column<0||column>=columns||!Number.isInteger(shift)||shift<0||
     shift>=columns||!Number.isFinite(progress)||progress<0||progress>1)
    throw new RangeError("Invalid conveyor parameters");
  const advance=column+shift*progress;
  // Wrap only when the panel's center passes the viewport seam: the
  // rightmost panel must not teleport while still fully inside its slot.
  return advance>=columns-.5&&shift>0?
    {rowOffset:1,x:advance-columns}:
    {rowOffset:0,x:advance};
}
export function projectConveyorEdge(column,columns,shift){
  if(!Number.isInteger(column)||!Number.isInteger(columns)||columns<1||
     column<0||column>=columns||!Number.isInteger(shift)||shift<1||shift>=columns)
    throw new RangeError("Invalid conveyor edge");
  return Math.max(0,Math.min(1,(columns-.5-column)/shift));
}
/* One position clock for all rows. A wrap has a half-pitch exit and
 * entrance window, so the old card fades OUT at the right boundary and
 * fades IN from the left edge, instead of disappearing in its last slot.
 * Phase offsets are in the shared eased-position domain. */
export function projectRowWrapPhases(column,columns,shift){
  const seam=projectConveyorEdge(column,columns,shift);
  if(column<columns-shift)
    throw new RangeError("This card does not cross a row boundary");
  return {
    fadeOutStart:Math.max(0,(columns-1-column)/shift),
    seam,
    fadeInEnd:Math.min(1,(columns-column)/shift)
  };
}
export function projectExpansionMovement(index,columns,selectedIndex,position){
  const fromRow=Math.floor(index/columns);
  const selectedRow=Math.floor(selectedIndex/columns);
  const toRow=position.row-1;
  if(index===selectedIndex)return "expanded";
  if(fromRow===selectedRow)return "dissolve";
  return fromRow!==toRow?"wrap":fromRow>=selectedRow?"shift":"still";
}
const box=node=>node.getBoundingClientRect();
const cssPixels=value=>value+"px";
const translate=(x,y)=>"translate3d("+x+"px,"+y+"px,0)";
const hasReduce=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const columnsFor=grid=>{
  // A computed CSS grid template contains resolved pixel tracks, rather than
  // the authored repeat() function. Filtering never changes their count.
  const value=getComputedStyle(grid).gridTemplateColumns;
  return Math.max(1,value.trim().split(/\s+/).filter(Boolean).length);
};
const animate=(element,frames,options)=>{
  if(!element.animate)return null;
  return element.animate(frames,{fill:"both",...options});
};
/* Closing is spatially the inverse of opening, but must NOT be a time
 * reversal: reverse() converts the original ease-out to an ease-in.
 * Retain every intermediate edge-wrap/fade breakpoint and play those
 * spatial states forward with a NEW ease-out clock instead.
 *
 * If X is pressed before expansion finishes, the first keyframe is the
 * element's currently presented transform/opacity. Only already-reached
 * milestones are retained, so contraction doesn't jump ahead to a
 * keyframe that the forward animation never reached. */
export function projectForwardCloseFrames(forwardFrames,progress,current){
  if(!Array.isArray(forwardFrames)||forwardFrames.length<2||
     !Number.isFinite(progress)||progress<0||progress>1||
     !current||typeof current.transform!=="string"||
     !Number.isFinite(Number(current.opacity)))
    throw new RangeError("Invalid project close motion");
  const values=forwardFrames.map((frame,index)=>({
    offset:Number(frame.computedOffset??frame.offset??
      (index/(forwardFrames.length-1))),
    transform:frame.transform,
    opacity:frame.opacity
  }));
  const at=Math.max(0,Math.min(1,progress));
  const result=[{offset:0,transform:current.transform,
    opacity:String(Number(current.opacity))}];
  if(at>0){
    for(let index=values.length-1;index>=0;index--){
      const frame=values[index];
      if(frame.offset>=at-1e-8)continue;
      const offset=Math.max(0,Math.min(1,(at-frame.offset)/at));
      if(offset<=1e-8)continue;
      result.push({offset,transform:frame.transform,opacity:frame.opacity});
    }
  }
  if(result.length===1||result[result.length-1].offset<1-1e-8)
    result.push({offset:1,transform:values[0].transform,
      opacity:values[0].opacity});
  return result;
}

export function mountProjectExpansion({root,grid,animateGlass}){
  const cards=[...grid.querySelectorAll(".project-showcase-card")];
  const closeButton=document.createElement("button");
  closeButton.type="button";
  closeButton.className="project-showcase-expand-close";
  closeButton.dataset.publicProjectGlass="expand-close";
  closeButton.setAttribute("aria-label","Close expanded project");
  closeButton.title="Close expanded project";
  closeButton.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  closeButton.hidden=true;
  grid.append(closeButton);
  const abort=new AbortController();
  let state=null,disposed=false,resizeScheduled=false;
  const rectSnapshot=nodes=>new Map(nodes.map(node=>[node,box(node)]));
  const clearInline=()=>{
    for(const card of cards){
      card.style.gridColumn="";
      card.style.gridRow="";
      card.style.position="";
      card.style.top="";
      card.style.left="";
      card.style.width="";
      card.style.height="";
      card.style.removeProperty("--project-regular-reference-width");
      card.classList.remove("is-expanded");
      card.removeAttribute("data-project-card-dismiss-at");
      card.removeAttribute("data-project-card-restore-at");
      card.removeAttribute("data-project-card-restore-from");
      card.removeAttribute("data-project-card-appear-at");
      card.removeAttribute("data-project-card-disappear-at");
      card.removeAttribute("data-project-card-disappear-from");
      card.removeAttribute("data-project-card-optical-column");
      const foreground=card.querySelector(".project-showcase-content");
      if(foreground){
        foreground.style.removeProperty("opacity");
        foreground.style.removeProperty("filter");
      }
      card.setAttribute("aria-expanded","false");
    }
    root.classList.remove("has-project-expansion");
    closeButton.hidden=true;
    closeButton.style.top="";
    closeButton.style.left="";
  };
  function discard({focus=false}={}){
    if(!state)return;
    const previous=state;
    state=null;
    for(const timeout of previous.timers)clearTimeout(timeout);
    for(const animation of previous.animations)animation.cancel();
    for(const ghost of previous.ghosts)ghost.remove();
    previous.placeholder.remove();
    clearInline();
    if(focus&&!disposed&&root.isConnected&&!previous.card.hidden)
      previous.card.focus({preventScroll:true});
  }
  function open(card,{immediate=false}={}){
    if(disposed||state||card.hidden||root.classList.contains("is-exiting"))return;
    const visible=cards.filter(item=>!item.hidden);
    const selectedIndex=visible.indexOf(card);
    if(selectedIndex<0)return;
    const columns=columnsFor(grid);
    const plan=planProjectExpansion(visible.length,columns,selectedIndex);
    const original=rectSnapshot(visible);
    const gridRect=box(grid);
    const selectedRect=original.get(card);
    // Place all cards in their final grid tracks in one synchronous layout
    // transaction; WAAPI fill:both covers the reflow before the next paint.
    visible.forEach((node,index)=>{
      const position=plan[index];
      node.style.gridRow=String(position.row);
      node.style.gridColumn=position.span===columns&&node===card?
        "1 / -1":String(position.column);
    });
    const expandedRect=box(card);
    const destinations=rectSnapshot(visible);
    const placeholder=document.createElement("div");
    placeholder.className="project-showcase-expanded-slot";
    placeholder.style.gridRow=String(plan[selectedIndex].row);
    placeholder.style.gridColumn="1 / -1";
    placeholder.style.height=cssPixels(expandedRect.height);
    grid.append(placeholder);
    // The expanded pane is a real absolutely positioned DOM rect. Animating
    // left and width (rather than scaleX) preserves text and glass geometry.
    card.style.position="absolute";
    card.style.gridColumn="";
    card.style.gridRow="";
    card.style.top=cssPixels(expandedRect.top-gridRect.top);
    card.style.left=cssPixels(expandedRect.left-gridRect.left);
    card.style.width=cssPixels(expandedRect.width);
    card.style.height=cssPixels(expandedRect.height);
    card.style.setProperty("--project-regular-reference-width",cssPixels(selectedRect.width));
    card.classList.add("is-expanded");
    card.setAttribute("aria-expanded","true");
    root.classList.add("has-project-expansion","project-expansion-was-used");
    // Preserve the same actual WebGPU glass for the X, drawn last on top.
    closeButton.hidden=false;
    closeButton.style.top=cssPixels(expandedRect.top-gridRect.top+13);
    closeButton.style.left=cssPixels(expandedRect.right-gridRect.left-53);
    closeButton.setAttribute("aria-label","Close "+card.dataset.projectSlug+" project");
    const animations=[],timers=[],ghosts=[];
    const duration=immediate||hasReduce()?0:EXPAND_MS;
    const initialTime=performance.now();
    const firstRow=Math.floor(selectedIndex/columns);
    // A short final row only displaces the cards it actually contains.
    const shift=Math.min(columns,visible.length-firstRow*columns)-1;
    const columnGap=Number.parseFloat(getComputedStyle(grid).columnGap)||0;
    const pitch=(gridRect.width+columnGap)/columns;
    const travel=shift*pitch;
    // Keep the original row's optical dissolves on actual DOM clones,
    // while their live cards enter the next row from off the left edge.
    // The clones use the very same square WGSL / tile.motion.w pipeline.
    if(duration){
      for(let index=firstRow*columns;
        index<Math.min(visible.length,(firstRow+1)*columns);index++){
        const node=visible[index];
        if(node===card)continue;
        const before=original.get(node);
        const ghost=node.cloneNode(true);
        ghost.classList.add("project-showcase-dissolve-ghost");
        ghost.setAttribute("aria-hidden","true");
        ghost.tabIndex=-1;
        ghost.inert=true;
        ghost.style.position="absolute";
        // The node was cloned AFTER grid relayout, so it inherits the
        // destination row/column inline styles. An absolutely-positioned
        // CSS grid child with explicit tracks uses THAT grid area as its
        // containing block, offsetting this "original-row" silhouette
        // DOWN into the next row. Reset placement before top/left.
        ghost.style.gridArea="auto";
        ghost.style.gridRow="auto";
        ghost.style.gridColumn="auto";
        ghost.style.top=cssPixels(before.top-gridRect.top);
        ghost.style.left=cssPixels(before.left-gridRect.left);
        ghost.style.width=cssPixels(before.width);
        ghost.style.height=cssPixels(before.height);
        // Only the original-row silhouette undergoes the square shader's
        // 440ms dissolve. The live card fades in as it actually enters
        // the destination row; a second optical alpha clock delayed it.
        const opticalColumn=index-firstRow*columns;
        ghost.dataset.projectCardOpticalColumn=String(opticalColumn);
        ghost.dataset.projectCardDismissAt=String(initialTime);
        grid.append(ghost);
        ghosts.push(ghost);
      }
    }
    const selectedAnimation=duration?animate(card,[
      {left:cssPixels(selectedRect.left-gridRect.left),
       width:cssPixels(selectedRect.width),"--project-regular-progress":"0"},
      {left:cssPixels(expandedRect.left-gridRect.left),
       width:cssPixels(expandedRect.width),"--project-regular-progress":"1"}
    ],{duration,easing:SELECTED_EASING}):null;
    if(selectedAnimation)animations.push(selectedAnimation);
    // X stays attached to the growing card's actual right edge, then follows
    // that same edge backwards at identical velocity during collapse.
    const buttonAnimation=duration?animate(closeButton,[
      {left:cssPixels(selectedRect.right-gridRect.left-53),
       opacity:0,transform:"translate3d(0,-8px,0)"},
      {left:cssPixels(expandedRect.right-gridRect.left-53),
       opacity:1,transform:"translate3d(0,0,0)"}
    ],{duration,easing:SELECTED_EASING}):null;
    if(buttonAnimation)animations.push(buttonAnimation);
    for(let index=0;index<visible.length;index++){
      const node=visible[index];
      if(node===card)continue;
      const before=original.get(node),after=destinations.get(node);
      const role=projectExpansionMovement(index,columns,selectedIndex,plan[index]);
      if(role==="still"||!duration)continue;
      let frames;
      if(role==="dissolve"){
        // The incoming real card moves with every other pane, already
        // fading as it crosses the LEFT edge. The easing is exactly the
        // selected pane's expansion easing, so entry completes together.
        // No independent 440ms optical fade multiplies its WAAPI alpha.
        const destinationColumn=plan[index].column-1;
        const fadeEnd=shift?
          Math.min(1,(shift-destinationColumn)/shift):1;
        frames=[
          {offset:0,transform:translate(-travel,0),opacity:0},
          {offset:fadeEnd,transform:translate(-travel*(1-fadeEnd),0),opacity:1},
          {offset:1,transform:translate(0,0),opacity:1}
        ];
      }else if(role==="shift"){
        // Exactly one shared translation across every downstream row:
        // no proportional-to-distance velocities or differential easing.
        frames=[
          {transform:translate(-travel,0),opacity:1},
          {transform:translate(0,0),opacity:1}
        ];
      }else{
        // All downstream cards use ONE virtual row conveyor. A card
        // travels at the same spatial rate as its rowmates; at the
        // half-pitch viewport seam it is fully invisible for the
        // row switch. The first/last half-pitches are edge fades.
        const col=index%columns;
        const {fadeOutStart,seam,fadeInEnd}=
          projectRowWrapPhases(col,columns,shift);
        const exitX=gridRect.right-before.width+pitch*.5-after.left;
        const entryX=gridRect.left-pitch*.5-after.left;
        const oldY=before.top-after.top;
        frames=[
          {offset:0,transform:translate(before.left-after.left,oldY),opacity:1},
          {offset:fadeOutStart,
            transform:translate(before.left-after.left+travel*fadeOutStart,oldY),
            opacity:1},
          {offset:seam,transform:translate(exitX,oldY),opacity:0},
          {offset:Math.min(1,seam+.0001),transform:translate(entryX,0),opacity:0},
          {offset:fadeInEnd,
            transform:translate(entryX+travel*(fadeInEnd-seam),0),opacity:1},
          {offset:1,transform:translate(0,0),opacity:1}
        ];
      }
      const animation=animate(node,frames,{
        duration:EXPAND_MS,easing:CONVEYOR_EASING
      });
      if(animation)animations.push(animation);
    }
    state={card,placeholder,animations,timers,ghosts,phase:"open",immediate,
      initialTime,selectedAnimation,buttonAnimation,
      initialLeft:selectedRect.left-gridRect.left,
      initialWidth:selectedRect.width,
      initialButtonLeft:selectedRect.right-gridRect.left-53};
    animateGlass(EXPAND_MS+90);
    if(duration){
      closeButton.tabIndex=0;
      closeButton.focus({preventScroll:true});
    }
  }
  function close({immediate=false,restoreFocus=true}={}){
    if(!state||disposed)return;
    if(immediate||hasReduce()||state.immediate){
      discard({focus:restoreFocus});
      animateGlass(90);
      return;
    }
    if(state.phase!=="open")return;
    state.phase="closing";
    const current=state;
    const now=performance.now();
    const animations=current.animations;
    // WAAPI.reverse() flips an ease-out into a perceived ease-IN. That is
    // mechanically symmetric, but wrong for an X-close UI action. Sample
    // actual presented geometry, then give contraction a NEW forward
    // 620ms ease-out. This is explicitly what the user requested.
    const elapsed=Math.min(EXPAND_MS,Math.max(0,
      Number(current.selectedAnimation?.currentTime??EXPAND_MS)));
    const paneStyle=getComputedStyle(current.card);
    const startLeft=Number.parseFloat(paneStyle.left);
    const startWidth=Number.parseFloat(paneStyle.width);
    const startRegularProgress=Number.parseFloat(paneStyle.getPropertyValue("--project-regular-progress"))||0;
    const xStyle=getComputedStyle(closeButton);
    const startButtonLeft=Number.parseFloat(xStyle.left);
    const startButtonOpacity=Number.parseFloat(xStyle.opacity);
    current.selectedAnimation?.cancel();
    current.buttonAnimation?.cancel();
    const contract=animate(current.card,[
      {left:cssPixels(startLeft),width:cssPixels(startWidth),"--project-regular-progress":String(startRegularProgress)},
      {left:cssPixels(current.initialLeft),width:cssPixels(current.initialWidth),"--project-regular-progress":"0"}
    ],{duration:EXPAND_MS,easing:SELECTED_EASING});
    const contractButton=animate(closeButton,[
      {left:cssPixels(startButtonLeft),
        opacity:String(startButtonOpacity),
        transform:"translate3d(0,0,0)"},
      {left:cssPixels(current.initialButtonLeft),
        opacity:"0",transform:"translate3d(0,-8px,0)"}
    ],{duration:EXPAND_MS,easing:SELECTED_EASING});
    if(contract)animations.push(contract);
    if(contractButton)animations.push(contractButton);
    // Neighbors follow the identical route BACK to their old slots, but
    // with the same FORWARD ease-out as the widening pane and X close.
    // Reversing their WAAPI playback was the remaining ease-IN regression.
    const openingNeighbors=animations.filter(animation=>
      animation!==contract&&animation!==contractButton&&
      animation!==current.selectedAnimation&&
      animation!==current.buttonAnimation);
    for(const opening of openingNeighbors){
      const node=opening.effect?.target;
      if(!node)continue;
      const computed=getComputedStyle(node);
      const frames=projectForwardCloseFrames(
        opening.effect.getKeyframes(),
        Math.max(0,Math.min(1,
          Number(opening.effect.getComputedTiming().progress??1))),
        {transform:computed.transform,opacity:computed.opacity}
      );
      opening.cancel();
      const returning=animate(node,frames,{
        duration:EXPAND_MS,easing:CONVEYOR_EASING
      });
      if(returning)animations.push(returning);
    }
    // The original-row dissipating ghosts cohere at the end of closure,
    // with native GPU material. No duplicate CSS glass shader.
    const restoreFrom=Math.min(DISMISS_MS,
      Math.max(0,now-current.initialTime));
    const restoreDelay=EXPAND_MS-restoreFrom;
    for(const ghost of current.ghosts){
      ghost.removeAttribute("data-project-card-dismiss-at");
      ghost.dataset.projectCardRestoreAt=String(now+restoreDelay);
      ghost.dataset.projectCardRestoreFrom=String(restoreFrom);
    }
    animateGlass(EXPAND_MS+90);
    // The old .finished promise may already be resolved; clean up only
    // after the new ease-out closure completes, never in mid-animation.
    if(!animations.length){
      discard({focus:restoreFocus});
    }else{
      current.timers.push(setTimeout(()=>{
        if(state===current&&current.phase==="closing")
          discard({focus:restoreFocus});
      },EXPAND_MS+35));
    }
  }
  for(const card of cards){
    card.setAttribute("aria-expanded","false");
    card.addEventListener("click",()=>{
      if(!state)open(card);
    },{signal:abort.signal});
  }
  closeButton.addEventListener("click",()=>close(),{signal:abort.signal});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&state&&state.phase==="open"){
      close();event.preventDefault();
    }
  },{signal:abort.signal});
  root.addEventListener("public-projects:before-filter",()=>{
    if(state)close({immediate:true,restoreFocus:false});
  },{signal:abort.signal});
  window.addEventListener("resize",()=>{
    if(!state||disposed||resizeScheduled)return;
    resizeScheduled=true;
    requestAnimationFrame(()=>{
      resizeScheduled=false;
      if(!state||disposed)return;
      const card=state.card;
      close({immediate:true,restoreFocus:false});
      if(!card.hidden)open(card,{immediate:true});
    });
  },{signal:abort.signal});
  return {
    close,
    unmount(){
      if(disposed)return;
      discard();
      disposed=true;
      abort.abort();
      closeButton.remove();
    }
  };
}
