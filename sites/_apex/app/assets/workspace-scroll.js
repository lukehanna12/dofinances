/* Keep the browser's root document as the single page scroller so its
 * artwork, gray background, text, and controls have one scroll coordinate.
 * The two header bars and Liquid Glass sidebar are sticky/fixed outside the
 * moving page; never transform them to imitate scrolling.
 *
 * CSS overscroll-behavior guards the vertical root. Wheel/touch guards handle
 * boundary gestures, including Safari rubber-banding, while deliberately
 * allowing the left-edge browser-history back gesture (rightward swipe). */
/* Fast, direct return-to-top: quick ease-out instead of the previous
 * prolonged 93/7 trajectory. No long accelerating/cruising interval. */
const smoothstep=t=>t*t*(3-2*t);
export function topScrollEase(progress){
  const t=Math.max(0,Math.min(1,Number(progress)||0));
  return 1-(1-t)**3;
}
export function topScrollDuration(distance,viewportHeight){
  const screens=Math.max(0,Number(distance)||0)/Math.max(1,Number(viewportHeight)||768);
  // Around 180-260 ms: distant pages move faster instead of scrolling
  // for more than a second. Still slightly adapts to viewport distance.
  return Math.round(Math.min(260,Math.max(170,170+28*Math.sqrt(screens))));
}

export function initWorkspaceScroll(doc=document,win=window) {
  const root=doc.scrollingElement||doc.documentElement;
  if(!root||typeof win.addEventListener!=="function")return {sync(){},reset(){},animateToTop(){}};
  const scrollTop=()=>Math.max(0,root.scrollTop||0);
  const maxY=()=>Math.max(0,root.scrollHeight-root.clientHeight);
  const maxX=()=>Math.max(0,(root.scrollWidth||0)-(root.clientWidth||0));
  const atTop=()=>scrollTop()<=1;
  const atBottom=()=>scrollTop()>=maxY()-1;
  const atRight=()=>Math.max(0,root.scrollLeft||0)>=maxX()-1;
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
  let scrollAnimation=null;
  const cancelTopAnimation=()=>{
    const animation=scrollAnimation;
    if(!animation)return;
    animation.cancelled=true;
    scrollAnimation=null;
    if(animation.frame!==null)win.cancelAnimationFrame?.(animation.frame);
  };
  const animateToTop=()=>{
    // Capture the live scroll position at the click, not on page load.
    // Clicking the same route twice restarts smoothly from the new position.
    cancelTopAnimation();
    const startY=scrollTop();
    if(startY<=1){
      root.scrollTop=0;return;
    }
    if(win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
       typeof win.requestAnimationFrame!=="function"){
      root.scrollTop=0;return;
    }
    const duration=topScrollDuration(startY,root.clientHeight||win.innerHeight||768);
    const now=win.performance?.now?.();
    const animation={
      cancelled:false,frame:null,startTime:Number.isFinite(now)?now:null,
      previousTime:null,lastWrittenY:startY,disturbance:0
    };
    scrollAnimation=animation;
    const tick=timestamp=>{
      if(scrollAnimation!==animation||animation.cancelled)return;
      // RAF timestamps and performance.now() share a monotonic clock.
      // Without performance.now(), count the first frame as progress.
      if(animation.startTime===null)animation.startTime=timestamp-16.67;
      const t=Math.min(1,Math.max(0,(timestamp-animation.startTime)/duration));
      const dt=animation.previousTime===null?16.67:
        Math.max(0,Math.min(80,timestamp-animation.previousTime));
      animation.previousTime=timestamp;
      // Let wheel/touch/keyboard input temporarily displace the page instead
      // of blocking it. Its influence fades and becomes exactly zero at the
      // endpoint, so user input does not cancel the animation or its landing.
      const userDelta=scrollTop()-animation.lastWrittenY;
      if(Math.abs(userDelta)>.5){
        const limit=Math.max(48,Math.min(260,startY*.35));
        animation.disturbance=Math.max(-limit,Math.min(limit,animation.disturbance+userDelta));
      }
      animation.disturbance*=Math.exp(-dt/180);
      // Preserve a temporary manual-scroll displacement; its influence
      // disappears before the quick ease-out completes.
      const release=1-smoothstep(Math.max(0,Math.min(1,(t-.62)/.38)));
      const position=Math.max(0,Math.min(maxY(),
        startY*(1-topScrollEase(t))+animation.disturbance*release));
      root.scrollTop=position;
      animation.lastWrittenY=scrollTop();
      if(t>=1){
        root.scrollTop=0;
        scrollAnimation=null;
      }else animation.frame=win.requestAnimationFrame(tick);
    };
    animation.frame=win.requestAnimationFrame(tick);
  };
  const reset=()=>{
    // Any real route navigation immediately supersedes the prior animation.
    cancelTopAnimation();
    if(scrollTop()>0){
      if(typeof win.scrollTo==="function")win.scrollTo({top:0,left:0,behavior:"instant"});
      else root.scrollTop=0;
    }
  };
  // The sidebar is fixed on desktop, so the root scroll only needs overscroll
  // protection; no per-frame pane geometry or ResizeObserver is necessary.
  return {sync(){},reset,animateToTop};
}
