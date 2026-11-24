/* Public Projects' row-expansion controller.
 * The same WebGPU panes remain owned by dashboard-gpu-renderer.js. This
 * module only plans DOM grid positions and animates actual HTML rectangles.
 * No CSS optical substitute, second canvas or private API is introduced.
 */
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";

// Preserve the original selected-card expansion and forward-eased X close.
// All displaced cards share the exact same temporal progress as the
// widening panel, so the next row does not arrive after expansion ends.
export const EXPAND_MS=620;
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
// The new description space is measured at the full destination width.
// Its minimum leaves enough artwork beneath the material's upper edge.
export function projectDescriptionExtension(textHeight,inset){
  if(!Number.isFinite(textHeight)||textHeight<0||!Number.isFinite(inset)||inset<0)
    throw new RangeError("Invalid description dimensions");
  return Math.max(152,Math.ceil(textHeight+2*inset+44));
}
// Apply the same eased vertical progress to every lower row, including
// the two sides of a zero-opacity horizontal conveyor seam.
export function projectVerticalExpansionFrames(frames,extra){
  return frames.map((frame,index)=>{
    const progress=frame.offset??index/(frames.length-1);
    const match=/^translate3d\(([-\d.e+]+)px,([-\d.e+]+)px,0\)$/.exec(frame.transform);
    if(!match)throw new Error("Expected an unscaled conveyor translation");
    return {...frame,transform:translate(Number(match[1]),Number(match[2])-extra*(1-progress))};
  });
}
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
  closeButton.dataset.glassBackdropLayer="1";
  closeButton.setAttribute("aria-label","Close expanded project");
  closeButton.title="Close expanded project";
  closeButton.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  closeButton.querySelector("svg").dataset.glassPaint="foreground";
  closeButton.hidden=true;
  grid.append(closeButton);
  const abort=new AbortController();
  let state=null,disposed=false,resizeScheduled=false;
  const rectSnapshot=nodes=>new Map(nodes.map(node=>[node,box(node)]));
  function releasePointerFocus(){
    const active=document.activeElement;
    if(active===closeButton||cards.includes(active))active.blur();
  }
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
      card.style.removeProperty("--project-description-space");
      card.style.removeProperty("--project-expanded-band-height");
      card.removeAttribute("aria-describedby");
      card.querySelector(".project-showcase-description")?.setAttribute("aria-hidden","true");
      card.querySelector(".project-showcase-diagrams")?.setAttribute("aria-hidden","true");
      card.classList.remove("is-expanded","is-contracting");
      card.style.removeProperty("--project-regular-progress");
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
    root.classList.remove("has-project-expansion","is-project-reflowing","is-project-retargeting");
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
  function open(card,{immediate=false,keyboard=false}={}){
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
    const baseRect=box(card);
    const description=card.querySelector(".project-showcase-description");
    const inset=Number.parseFloat(getComputedStyle(card.querySelector(".project-showcase-content")).paddingLeft)||16;
    const details=card.querySelector(".project-showcase-details");
    const diagrams=card.querySelector(".project-showcase-diagrams");
    const extra=projectDescriptionExtension(details.getBoundingClientRect().height,inset);
    card.style.setProperty("--project-description-space",cssPixels(extra));
    card.style.setProperty("--project-expanded-band-height",cssPixels(baseRect.height*.1+extra));
    // Set the real expanded grid row height before measuring every final
    // destination. The spacer takes exactly that height when the pane
    // becomes absolute; no independently animated layout is introduced.
    card.style.height=cssPixels(baseRect.height+extra);
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
    card.setAttribute("aria-describedby",description.id+" "+diagrams.id);
    description.setAttribute("aria-hidden","false");
    diagrams.setAttribute("aria-hidden","false");
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
        ghost.querySelector(".project-showcase-description")?.removeAttribute("id");
        ghost.querySelector(".project-showcase-diagrams")?.removeAttribute("id");
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
       width:cssPixels(selectedRect.width),height:cssPixels(selectedRect.height),"--project-regular-progress":"0"},
      {left:cssPixels(expandedRect.left-gridRect.left),
       width:cssPixels(expandedRect.width),height:cssPixels(expandedRect.height),"--project-regular-progress":"1"}
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
        const oldY=before.top-after.top+extra;
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
      frames=projectVerticalExpansionFrames(frames,extra);
      const animation=animate(node,frames,{
        duration:EXPAND_MS,easing:CONVEYOR_EASING
      });
      if(animation)animations.push(animation);
    }
    const sharedStart=document.timeline?.currentTime;
    if(Number.isFinite(sharedStart))for(const motion of animations)motion.startTime=sharedStart;
    state={card,placeholder,animations,timers,ghosts,phase:"open",immediate,
      initialTime,selectedAnimation,buttonAnimation,
      initialLeft:selectedRect.left-gridRect.left,
      initialWidth:selectedRect.width,initialHeight:selectedRect.height,
      initialButtonLeft:selectedRect.right-gridRect.left-53};
    animateGlass(EXPAND_MS+90);
    if(duration){
      const current=state;
      root.classList.add("is-project-reflowing");
      current.timers.push(setTimeout(()=>{
        if(state===current&&current.phase==="open"){
          root.classList.remove("is-project-reflowing");
          animateGlass(90);
        }
      },EXPAND_MS));
    }
    closeButton.tabIndex=0;
    if(keyboard)closeButton.focus({preventScroll:true});
  }
  // Retarget directly from live presentation into a single destination
  // layout. No collapsed frame, queued close/open, scaling, or duplicate
  // artwork. The old and new panels share one forward 620ms easing clock.
  function retarget(card,{keyboard=false,restoreFocus=false}={}){
    if(disposed||!state||card?.hidden||root.classList.contains("is-exiting"))return;
    const previous=state,old=previous.card;
    if(card===old&&previous.phase!=="closing")return;
    const visible=cards.filter(node=>!node.hidden);
    const origin=box(grid);
    const presented=new Map(visible.map(node=>{
      const r=box(node),style=getComputedStyle(node);
      return [node,{left:r.left-origin.left,top:r.top-origin.top,width:r.width,height:r.height,
        opacity:Number(style.opacity),regular:Number(style.getPropertyValue("--project-regular-progress"))||0,
        descriptionSpace:style.getPropertyValue("--project-description-space"),
        expandedBand:style.getPropertyValue("--project-expanded-band-height")}];
    }));
    const x=box(closeButton),xOpacity=Number(getComputedStyle(closeButton).opacity)||0;
    const xStart={left:x.left-origin.left,top:x.top-origin.top,opacity:xOpacity};
    const focused=document.activeElement===closeButton;
    discard();
    if(card)open(card,{immediate:true,keyboard:false});
    const destinationOrigin=box(grid);
    // The scrollport can clamp when a bottom-row expansion changes the
    // row count. Convert the sampled screen coordinates into the NEW
    // grid origin so the first animated frame is still continuous.
    const originDX=origin.left-destinationOrigin.left,originDY=origin.top-destinationOrigin.top;
    for(const rect of presented.values()){rect.left+=originDX;rect.top+=originDY;}
    xStart.left+=originDX;xStart.top+=originDY;
    const destinations=new Map(visible.map(node=>{
      const r=box(node);
      return [node,{left:r.left-destinationOrigin.left,top:r.top-destinationOrigin.top,width:r.width,height:r.height}];
    }));
    if(!card)state={card:old,placeholder:document.createElement("div"),animations:[],timers:[],ghosts:[],phase:"closing",direct:true,immediate:false};
    const current=state;
    current.direct=true;current.immediate=false;
    current.phase=card?"open":"closing";
    if(hasReduce()){
      if(!card)discard({focus:restoreFocus});
      else if(keyboard)closeButton.focus({preventScroll:true});
      animateGlass(90);return;
    }
    root.classList.add("is-project-reflowing","is-project-retargeting");
    for(const node of visible){
      const from=presented.get(node),to=destinations.get(node);
      const dx=from.left-to.left,dy=from.top-to.top;
      const changesSize=Math.abs(from.width-to.width)>.5||Math.abs(from.height-to.height)>.5;
      const contracts=node!==card&&(from.regular>.001||changesSize);
      if(contracts){
        node.classList.add("is-contracting");
        node.style.setProperty("--project-regular-reference-width",cssPixels(to.width));
        if(from.descriptionSpace)node.style.setProperty("--project-description-space",from.descriptionSpace);
        if(from.expandedBand)node.style.setProperty("--project-expanded-band-height",from.expandedBand);
      }
      const frames=[
        {transform:translate(dx,dy),opacity:String(from.opacity)},
        {transform:translate(0,0),opacity:"1"}
      ];
      if(changesSize||node===card||contracts){
        frames[0].width=cssPixels(from.width);frames[0].height=cssPixels(from.height);
        frames[1].width=cssPixels(to.width);frames[1].height=cssPixels(to.height);
        frames[0]["--project-regular-progress"]=String(from.regular);
        frames[1]["--project-regular-progress"]=node===card?"1":"0";
      }
      // Row-crossing siblings recede through the crossing, then return
      // on the same eased-position clock. Stationary cards do not fade.
      if(node!==card&&!contracts&&Math.abs(dy)>from.height*.5&&Math.abs(dx)>from.width*.5)
        frames.splice(1,0,{transform:translate(dx*.5,dy*.5),opacity:"0",offset:.5});
      if(changesSize||Math.abs(dx)>.5||Math.abs(dy)>.5||from.opacity<.999||contracts){
        const motion=animate(node,frames,{duration:EXPAND_MS,easing:SELECTED_EASING});
        if(motion)current.animations.push(motion);
      }
    }
    // One close button transfers to the new pane. Its alpha recedes
    // during the handoff and returns along the incoming right edge.
    const endpoint=destinations.get(card??old),incoming=presented.get(card??old);
    const outgoing=presented.get(old),outgoingEnd=destinations.get(old);
    const anchor=(from,to,t)=>({
      left:cssPixels(from.left+from.width+(to.left+to.width-from.left-from.width)*t-53),
      top:cssPixels(from.top+(to.top-from.top)*t+13)
    });
    closeButton.hidden=false;
    closeButton.style.top=cssPixels(endpoint.top+13);
    closeButton.style.left=cssPixels(endpoint.left+endpoint.width-53);
    const buttonFrames=[
      {left:cssPixels(xStart.left),top:cssPixels(xStart.top),opacity:String(xStart.opacity)},
      {offset:.20,...anchor(outgoing,outgoingEnd,.20),opacity:"0"},
      // The transfer occurs only at zero opacity, while both panel edges
      // keep moving. The incoming button thereafter follows its own edge.
      {offset:.2001,...anchor(incoming,endpoint,.2001),opacity:"0"},
      {left:closeButton.style.left,top:closeButton.style.top,opacity:card?"1":"0"}
    ];
    const buttonMotion=animate(closeButton,buttonFrames,{duration:EXPAND_MS,easing:SELECTED_EASING});
    if(buttonMotion)current.animations.push(buttonMotion);
    const sharedStart=document.timeline?.currentTime;
    if(Number.isFinite(sharedStart))for(const motion of current.animations)motion.startTime=sharedStart;
    if(keyboard&&card)closeButton.focus({preventScroll:true});
    else if(focused)closeButton.blur();
    current.timers.push(setTimeout(()=>{
      if(state!==current)return;
      if(!card){discard({focus:restoreFocus});animateGlass(90);return;}
      for(const motion of current.animations)motion.cancel();
      current.animations.length=0;
      for(const node of visible){
        node.classList.remove("is-contracting");
        if(node!==card){
          node.style.removeProperty("--project-regular-reference-width");
          node.style.removeProperty("--project-description-space");
          node.style.removeProperty("--project-expanded-band-height");
        }
      }
      root.classList.remove("is-project-reflowing","is-project-retargeting");
      animateGlass(90);
    },EXPAND_MS+16));
    animateGlass(EXPAND_MS+90);
  }
  function close({immediate=false,restoreFocus=false}={}){
    if(!state||disposed)return;
    if(immediate||hasReduce()||state.immediate){
      discard({focus:restoreFocus});
      animateGlass(90);
      return;
    }
    if(state.phase!=="open")return;
    if(state.direct){retarget(null,{restoreFocus});return;}
    state.phase="closing";
    root.classList.add("is-project-reflowing");
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
    const startHeight=Number.parseFloat(paneStyle.height);
    const startRegularProgress=Number.parseFloat(paneStyle.getPropertyValue("--project-regular-progress"))||0;
    const xStyle=getComputedStyle(closeButton);
    const startButtonLeft=Number.parseFloat(xStyle.left);
    const startButtonOpacity=Number.parseFloat(xStyle.opacity);
    current.selectedAnimation?.cancel();
    current.buttonAnimation?.cancel();
    const contract=animate(current.card,[
      {left:cssPixels(startLeft),width:cssPixels(startWidth),height:cssPixels(startHeight),"--project-regular-progress":String(startRegularProgress)},
      {left:cssPixels(current.initialLeft),width:cssPixels(current.initialWidth),height:cssPixels(current.initialHeight),"--project-regular-progress":"0"}
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
    card.addEventListener("click",event=>{
      const keyboard=event.detail===0;
      if(!keyboard)releasePointerFocus();
      if(!state)open(card,{keyboard});
      else if(state.card!==card||state.phase==="closing")retarget(card,{keyboard});
    },{signal:abort.signal});
  }
  closeButton.addEventListener("click",event=>{
    const keyboard=event.detail===0;
    if(!keyboard)releasePointerFocus();
    close({restoreFocus:keyboard});
  },{signal:abort.signal});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&state&&state.phase==="open"){
      close({restoreFocus:true});event.preventDefault();
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
      const card=state.card,closing=state.phase==="closing";
      close({immediate:true,restoreFocus:false});
      if(!closing&&!card.hidden){open(card,{immediate:true});state.immediate=false;state.direct=true;}
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
