/* Scroll only page content: the topbar and Liquid Glass sidebar are outside
 * this container, so rubber-band movement cannot displace their controls.
 * The top remains elastically scrollable. Only attempts to pull PAST the
 * document's bottom are cancelled (wheel and touch), without scroll traps. */
export function initWorkspaceScroll(doc=document,win=window) {
  const scroll=doc.getElementById("workspace-scroll");
  if(!scroll||!doc.body?.classList)return {sync(){},reset(){}};
  const maxScroll=()=>Math.max(0,scroll.scrollHeight-scroll.clientHeight);
  const atEnd=()=>maxScroll()-scroll.scrollTop<=1.5;
  const syncNow=()=>doc.body.classList.toggle("workspace-at-end",atEnd());
  let queued=false;
  const sync=()=>{
    // Reading scrollHeight immediately after toggling multiple hidden views
    // forces a costly synchronous layout on every navigation. Measure once
    // in the next frame, sharing the result with scroll and ResizeObserver.
    if(typeof win.requestAnimationFrame!=="function"){
      syncNow();
      return;
    }
    if(queued)return;
    queued=true;
    win.requestAnimationFrame(()=>{
      queued=false;
      syncNow();
    });
  };
  const reset=()=>{
    if(scroll.scrollTop>0)scroll.scrollTo?.({top:0,left:0,behavior:"instant"});
    sync();
  };
  scroll.addEventListener("scroll",sync,{passive:true});
  scroll.addEventListener("wheel",event=>{
    if(event.deltaY>0&&atEnd()&&event.cancelable)event.preventDefault();
  },{passive:false});
  let lastTouchY=null;
  scroll.addEventListener("touchstart",event=>{
    lastTouchY=event.touches?.[0]?.clientY??null;
  },{passive:true});
  scroll.addEventListener("touchmove",event=>{
    const y=event.touches?.[0]?.clientY;
    if(y===undefined)return;
    if(lastTouchY!==null&&y<lastTouchY&&atEnd()&&event.cancelable)
      event.preventDefault();
    lastTouchY=y;
  },{passive:false});
  scroll.addEventListener("touchend",()=>{lastTouchY=null},{passive:true});
  win.addEventListener?.("resize",sync);
  const Resize=win.ResizeObserver??(typeof ResizeObserver==="function"?ResizeObserver:null);
  if(Resize){
    const observer=new Resize(sync);
    const content=doc.getElementById("main-content");
    if(content)observer.observe(content);
  }
  sync();
  return {sync,reset};
}
