/* Colosseum 0001c1 / CTA 6, evolved into a quiet full-viewport mosaic.
   Its coordinate-hashed occupancy now packs mixed-size squares, with smaller
   tiles behind the sidebar. All rendering is decorative and network-free.
   Animation uses CSS opacity; cursor only modulates the currently scheduled
   phase with brightness/scale, never changes a phase or introduces polling. */

const stage=document.getElementById("dashboard-atmosphere");
const micro=document.getElementById("dashboard-tiles-small");
const main=document.getElementById("dashboard-tiles-main");

if(stage&&micro&&main){
  const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  let tiles=[];
  let active=new Set();
  let pointerX=-9999,pointerY=-9999,animationFrame=0;
  let width=0,height=0;

  // Deterministic tile identity and timing. This does not use Math.random().
  function noise(row,col,seed=0){
    const n=Math.sin(127.1*row+311.7*col+seed*71.347)*43758.5453;
    return n-Math.floor(n);
  }
  function renderZone(zone,{microZone,seed}){
    const box=zone.getBoundingClientRect();
    if(box.width<1||box.height<1)return [];
    const unit=microZone?25:41;
    const gap=microZone?7:10;
    const step=unit+gap;
    const cols=Math.ceil((box.width+gap)/step);
    const rows=Math.ceil((box.height+gap)/step);
    const used=new Uint8Array(cols*rows);
    const result=[];
    const fragment=document.createDocumentFragment();
    const free=(row,col,span)=>{
      if(row+span>rows||col+span>cols)return false;
      for(let y=row;y<row+span;y++)
        for(let x=col;x<col+span;x++)
          if(used[y*cols+x])return false;
      return true;
    };
    const occupy=(row,col,span)=>{
      for(let y=row;y<row+span;y++)
        for(let x=col;x<col+span;x++)used[y*cols+x]=1;
    };
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        if(used[row*cols+col])continue;
        const anchor=noise(row,col,seed);
        // Interstitial dark cells are intentional breathing space.
        if(anchor<.20)continue;
        const choice=noise(row,col,seed+2);
        let span=microZone?(choice>.70?2:1):
          choice>.925?4:choice>.66?3:choice>.25?2:1;
        while(span>1&&!free(row,col,span))span--;
        if(!free(row,col,span))continue;
        occupy(row,col,span);

        const tile=document.createElement("span");
        tile.className="dashboard-tile";
        tile.setAttribute("aria-hidden","true");
        const material=noise(row,col,seed+7);
        const crest=noise(row,col,seed+11);
        const phase=noise(row,col,seed+17);
        const cycle=92+noise(row,col,seed+19)*26; // 92–118 s
        const side=span*unit+(span-1)*gap;
        const left=col*step+Math.round(gap*.5);
        const top=row*step+Math.round(gap*.5);
        if(material>.947)tile.classList.add("dashboard-tile--glass");
        else if(material>.68)tile.classList.add("dashboard-tile--line");
        const peak=crest>.925?(.71+.12*material):
          crest>.73?(.28+.21*material):
          (.07+.12*material);
        tile.style.left=left+"px";
        tile.style.top=top+"px";
        tile.style.width=side+"px";
        tile.style.height=side+"px";
        tile.style.setProperty("--tile-radius",
          Math.min(17,Math.max(microZone?5:8,side*.14)).toFixed(1)+"px");
        tile.style.setProperty("--peak",peak.toFixed(3));
        tile.style.setProperty("--duration",cycle.toFixed(3)+"s");
        tile.style.setProperty("--delay",(-phase*cycle).toFixed(3)+"s");
        // Respect reduced motion with a calm, nonrandom stationary state.
        tile.style.setProperty("--reduced-alpha",
          (crest>.925?.27:crest>.73?.10:.025).toFixed(3));
        fragment.appendChild(tile);
        result.push({element:tile,
          x:box.left+left+side/2,y:box.top+top+side/2,
          reach:Math.max(110,side*.66+78),size:side});
      }
    }
    zone.replaceChildren(fragment);
    return result;
  }

  function build(){
    const bounds=stage.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    // The only layout inputs are viewport dimensions. Sidebar drag,
    // collapse and rail-breakpoint transitions never rebuild the mosaic.
    if(Math.abs(width-bounds.width)<1&&Math.abs(height-bounds.height)<1)return;
    width=bounds.width;height=bounds.height;
    active.clear();
    tiles=[
      ...renderZone(micro,{microZone:true,seed:13}),
      ...renderZone(main,{microZone:false,seed:29})
    ];
  }

  function applyPointer(){
    animationFrame=0;
    if(reduceMotion.matches)return;
    const next=new Set();
    for(const tile of tiles){
      const dx=Math.max(0,Math.abs(pointerX-tile.x)-tile.size*.32);
      const dy=Math.max(0,Math.abs(pointerY-tile.y)-tile.size*.32);
      const d=Math.hypot(dx,dy);
      if(d>=tile.reach)continue;
      const proximity=Math.pow(1-d/tile.reach,1.8);
      if(proximity<.015)continue;
      tile.element.style.setProperty("--cursor",proximity.toFixed(3));
      next.add(tile);
    }
    for(const tile of active)
      if(!next.has(tile))tile.element.style.removeProperty("--cursor");
    active=next;
  }
  const schedulePointer=()=>{
    if(!animationFrame)animationFrame=requestAnimationFrame(applyPointer);
  };
  const clearPointer=()=>{
    pointerX=-9999;pointerY=-9999;schedulePointer();
  };

  build();
  window.addEventListener("pointermove",event=>{
    if(event.pointerType==="touch")return;
    pointerX=event.clientX;
    pointerY=event.clientY;
    schedulePointer();
  },{passive:true});
  window.addEventListener("pointerout",event=>{
    if(!event.relatedTarget)clearPointer();
  },{passive:true});
  window.addEventListener("blur",clearPointer);
  window.addEventListener("resize",()=>{
    build();schedulePointer();
  },{passive:true});
  document.addEventListener("visibilitychange",()=>{
    stage.classList.toggle("dashboard-paused",document.hidden);
  });
  reduceMotion.addEventListener?.("change",()=>{
    clearPointer();
  });
}
