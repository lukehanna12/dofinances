/* Public Projects' row-expansion controller.
 * The same WebGPU panes remain owned by dashboard-gpu-renderer.js. This
 * module only plans DOM grid positions and animates actual HTML rectangles.
 * No CSS optical substitute, second canvas or private API is introduced.
 */
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";

// One common, constant-speed clock for selected-width, displacement, wrap,
// disappearance, re-entry and the close glyph. Reverse never uses a second
// faster timing curve or the previous row-stagger schedule.
const EXPAND_MS=760;
const REAPPEAR_MS=EXPAND_MS-DISMISS_MS;
const MOTION_EASING="linear";
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
      card.classList.remove("is-expanded");
      card.removeAttribute("data-project-card-dismiss-at");
      card.removeAttribute("data-project-card-restore-at");
      card.removeAttribute("data-project-card-restore-from");
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
    card.classList.add("is-expanded");
    card.setAttribute("aria-expanded","true");
    root.classList.add("has-project-expansion","project-expansion-was-used");
    // Preserve the same actual WebGPU glass for the X, drawn last on top.
    closeButton.hidden=false;
    closeButton.style.top=cssPixels(expandedRect.top-gridRect.top+13);
    closeButton.style.left=cssPixels(expandedRect.right-gridRect.left-53);
    closeButton.setAttribute("aria-label","Close "+card.dataset.projectSlug+" project");
    const animations=[],timers=[];
    const duration=immediate||hasReduce()?0:EXPAND_MS;
    const selectedAnimation=duration?animate(card,[
      {left:cssPixels(selectedRect.left-gridRect.left),
       width:cssPixels(selectedRect.width)},
      {left:cssPixels(expandedRect.left-gridRect.left),
       width:cssPixels(expandedRect.width)}
    ],{duration,easing:MOTION_EASING}):null;
    if(selectedAnimation)animations.push(selectedAnimation);
    // X stays attached to the growing card's actual right edge, then follows
    // that same edge backwards at identical velocity during collapse.
    const buttonAnimation=duration?animate(closeButton,[
      {left:cssPixels(selectedRect.right-gridRect.left-53),
       opacity:0,transform:"translate3d(0,-8px,0)"},
      {left:cssPixels(expandedRect.right-gridRect.left-53),
       opacity:1,transform:"translate3d(0,0,0)"}
    ],{duration,easing:MOTION_EASING}):null;
    if(buttonAnimation)animations.push(buttonAnimation);
    const originalColumnWidth=selectedRect.width;
    const initialTime=performance.now();
    let longest=duration;
    for(let index=0;index<visible.length;index++){
      const node=visible[index];
      if(node===card)continue;
      const before=original.get(node),after=destinations.get(node);
      const role=projectExpansionMovement(index,columns,selectedIndex,plan[index]);
      if(role==="still")continue;
      const dx=before.left-after.left,dy=before.top-after.top;
      const from=translate(dx,dy);
      let frames;
      if(role==="shift"){
        frames=[{transform:from,opacity:1},
          {transform:translate(0,0),opacity:1}];
      }else{
        const toRight=translate(gridRect.right-after.left+originalColumnWidth*.45,dy);
        const fromLeft=translate(gridRect.left-after.left-originalColumnWidth*.75,0);
        const dissolving=role==="dissolve";
        // Every row and every direction crosses the invisible wrap point
        // at the SAME instant. Only the square's optical decay determines
        // how the selected rowmates lose coherence during the first phase.
        const join=DISMISS_MS/EXPAND_MS;
        frames=[
          {offset:0,transform:from,opacity:1},
          {offset:join,transform:dissolving?translate(dx+10,dy-1):toRight,opacity:0},
          {offset:join+.0001,transform:fromLeft,opacity:0},
          {offset:1,transform:translate(0,0),opacity:1}
        ];
        if(dissolving&&duration){
          node.dataset.projectCardDismissAt=String(initialTime);
          timers.push(setTimeout(()=>
            node.removeAttribute("data-project-card-dismiss-at"),
          DISMISS_MS+20));
        }
      }
      if(duration){
        const animation=animate(node,frames,{
          duration:EXPAND_MS,easing:MOTION_EASING
        });
        if(animation)animations.push(animation);
      }
    }
    state={card,placeholder,animations,timers,longest,phase:"open",immediate};
    animateGlass(longest+90);
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
    // All animations share one duration, zero delay and a LINEAR timebase,
    // so playing backward has exactly the same constant speed as opening.
    // Even an X click midway through opening reverses continuously.
    const elapsed=Math.min(EXPAND_MS,Math.max(0,
      Number(animations[0]?.currentTime??EXPAND_MS)));
    for(const animation of animations){
      try{animation.reverse()}catch{animation.cancel()}
    }
    // The selected row's peers regain their original optical coherence in
    // the LAST DISMISS_MS of that same common reverse clock. If closed early,
    // resume from their actual partial fade, not from full disappearance.
    const selectedIndex=cards.filter(c=>!c.hidden).indexOf(current.card);
    const columns=columnsFor(grid);
    const originalRow=Math.floor(selectedIndex/columns);
    const restoreDelay=Math.max(0,elapsed-DISMISS_MS);
    const restoreFrom=Math.min(DISMISS_MS,elapsed);
    for(const node of cards){
      if(node===current.card||node.hidden)continue;
      const position=cards.filter(c=>!c.hidden).indexOf(node);
      if(Math.floor(position/columns)!==originalRow)continue;
      node.removeAttribute("data-project-card-dismiss-at");
      node.dataset.projectCardRestoreAt=String(now+restoreDelay);
      node.dataset.projectCardRestoreFrom=String(restoreFrom);
      current.timers.push(setTimeout(()=>{
        node.removeAttribute("data-project-card-restore-at");
        node.removeAttribute("data-project-card-restore-from");
      },elapsed+30));
    }
    animateGlass(elapsed+90);
    const finish=Promise.all(animations.map(animation=>
      animation.finished.catch(()=>{})));
    void finish.then(()=>{
      if(state===current&&current.phase==="closing")
        discard({focus:restoreFocus});
    });
    // On browsers without WAAPI, avoid retaining the overlay indefinitely.
    if(!animations.length)discard({focus:restoreFocus});
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
