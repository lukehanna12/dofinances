/* Keep the browser's root document as the single page scroller so its
 * artwork, gray background, text, and controls have one scroll coordinate.
 * The two header bars and Liquid Glass sidebar are sticky/fixed outside the
 * moving page; never transform them to imitate scrolling.
 *
 * CSS overscroll-behavior guards the vertical root. Wheel/touch guards handle
 * boundary gestures, including Safari rubber-banding, while deliberately
 * allowing the left-edge browser-history back gesture (rightward swipe). */
/* At the document's end the shell stops above the scrolling photo footer.
 * Contract the sticky rail by precisely that exposed distance instead of
 * allowing sticky containment to translate its top edge offscreen. */
export function sidebarEndShrink(viewportHeight,shellBottom){
  if(!Number.isFinite(viewportHeight)||!Number.isFinite(shellBottom)||viewportHeight<=0)return 0;
  return Math.round(Math.max(0,viewportHeight-shellBottom)*4)/4;
}
export function initWorkspaceScroll(doc=document,win=window) {
  const root=doc.scrollingElement||doc.documentElement;
  if(!root||typeof win.addEventListener!=="function")return {sync(){},reset(){}};
  const scrollTop=()=>Math.max(0,root.scrollTop||0);
  const maxY=()=>Math.max(0,root.scrollHeight-root.clientHeight);
  const maxX=()=>Math.max(0,(root.scrollWidth||0)-(root.clientWidth||0));
  const atTop=()=>scrollTop()<=1;
  const atBottom=()=>scrollTop()>=maxY()-1;
  const atRight=()=>Math.max(0,root.scrollLeft||0)>=maxX()-1;
  const shell=doc.getElementById?.("workspace-shell");
  let scheduled=false,lastSidebarShrink=null;
  const updateSidebarBoundary=()=>{
    if(!shell?.getBoundingClientRect||!shell.style?.setProperty)return;
    const viewportHeight=win.innerHeight||doc.documentElement?.clientHeight;
    const shrink=win.matchMedia?.("(max-width: 760px)")?.matches?0:
      sidebarEndShrink(viewportHeight,shell.getBoundingClientRect().bottom);
    if(shrink===lastSidebarShrink)return;
    lastSidebarShrink=shrink;
    shell.style.setProperty("--workspace-sidebar-end-shrink",shrink+"px");
  };
  const sync=()=>{
    if(scheduled)return;
    if(typeof win.requestAnimationFrame!=="function"){
      updateSidebarBoundary();
      return;
    }
    scheduled=true;
    win.requestAnimationFrame(()=>{
      scheduled=false;
      updateSidebarBoundary();
    });
  };
  // Only the small end-of-page overlap changes. Reconcile in one frame
  // during scroll, resizing and route/content growth; no layout animation
  // or transform is applied to the glass pane or its children.
  win.addEventListener("scroll",sync,{passive:true});
  win.addEventListener("resize",sync,{passive:true});
  const Resize=win.ResizeObserver??(typeof ResizeObserver==="function"?ResizeObserver:null);
  if(shell&&Resize){
    const observer=new Resize(sync);
    observer.observe(shell);
  }
  const shouldIgnore=event=>!!event?.target?.closest?.(".sidebar-navigation");
  const cancel=event=>{if(event.cancelable)event.preventDefault();};
  win.addEventListener("wheel",event=>{
    if(event.ctrlKey||shouldIgnore(event))return;
    // Do not intercept the rightward swipe that navigates back in history.
    if(Math.abs(event.deltaX)>Math.abs(event.deltaY)){
      if(event.deltaX>0&&atRight())cancel(event);
      return;
    }
    if((event.deltaY<0&&atTop())||(event.deltaY>0&&atBottom()))cancel(event);
  },{passive:false});
  let lastTouch=null;
  win.addEventListener("touchstart",event=>{
    const touch=event.touches?.[0];
    lastTouch=touch?{x:touch.clientX,y:touch.clientY}:null;
  },{passive:true});
  win.addEventListener("touchmove",event=>{
    const touch=event.touches?.[0];
    if(!touch||!lastTouch)return;
    const dx=touch.clientX-lastTouch.x,dy=touch.clientY-lastTouch.y;
    lastTouch={x:touch.clientX,y:touch.clientY};
    if(shouldIgnore(event))return;
    if(Math.abs(dx)>Math.abs(dy)){
      if(dx<0&&atRight())cancel(event); // Right-edge outward pull.
      return; // Rightward back-swipe on the left remains browser-owned.
    }
    if((dy>0&&atTop())||(dy<0&&atBottom()))cancel(event);
  },{passive:false});
  win.addEventListener("touchend",()=>{lastTouch=null},{passive:true});
  win.addEventListener("touchcancel",()=>{lastTouch=null},{passive:true});
  const reset=()=>{
    if(scrollTop()>0){
      if(typeof win.scrollTo==="function")win.scrollTo({top:0,left:0,behavior:"instant"});
      else root.scrollTop=0;
    }
    sync();
  };
  sync();
  return {sync,reset};
}
