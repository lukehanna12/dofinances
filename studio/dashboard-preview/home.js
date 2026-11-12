/* Sparse animated Dashboard visual — Colosseum 0001c1, CTA 6.
   Original 16 Lucide SVGs and 11x6 icon coordinates are preserved.
   One original Home JPEG; ~35 DOM tiles, no per-square backdrop filters,
   no time-based JS jobs, polling, canvas, network calls or layout tie to sidebar. */
const ICON_SHAPES={
  "Zap": "<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" />",
  "Boxes": "<path d=\"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z\" /><path d=\"m7 16.5-4.74-2.85\" /><path d=\"m7 16.5 5-3\" /><path d=\"M7 16.5v5.17\" /><path d=\"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z\" /><path d=\"m17 16.5-5-3\" /><path d=\"m17 16.5 4.74-2.85\" /><path d=\"M17 16.5v5.17\" /><path d=\"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z\" /><path d=\"M12 8 7.26 5.15\" /><path d=\"m12 8 4.74-2.85\" /><path d=\"M12 13.5V8\" />",
  "Gauge": "<path d=\"m12 14 4-4\" /><path d=\"M3.34 19a10 10 0 1 1 17.32 0\" />",
  "Layers": "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\" /><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\" /><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\" />",
  "Hexagon": "<path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" />",
  "Cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />",
  "Cpu": "<path d=\"M12 20v2\" /><path d=\"M12 2v2\" /><path d=\"M17 20v2\" /><path d=\"M17 2v2\" /><path d=\"M2 12h2\" /><path d=\"M2 17h2\" /><path d=\"M2 7h2\" /><path d=\"M20 12h2\" /><path d=\"M20 17h2\" /><path d=\"M20 7h2\" /><path d=\"M7 20v2\" /><path d=\"M7 2v2\" /><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" /><rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"1\" />",
  "Database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /><path d=\"M3 12A9 3 0 0 0 21 12\" />",
  "Palette": "<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\" /><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "Aperture": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m14.31 8 5.74 9.94\" /><path d=\"M9.69 8h11.48\" /><path d=\"m7.38 12 5.74-9.94\" /><path d=\"M9.69 16 3.95 6.06\" /><path d=\"M14.31 16H2.83\" /><path d=\"m16.62 12-5.74 9.94\" />",
  "Compass": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\" />",
  "Orbit": "<path d=\"M20.341 6.484A10 10 0 0 1 10.266 21.85\" /><path d=\"M3.659 17.516A10 10 0 0 1 13.74 2.152\" /><circle cx=\"12\" cy=\"12\" r=\"3\" /><circle cx=\"19\" cy=\"5\" r=\"2\" /><circle cx=\"5\" cy=\"19\" r=\"2\" />",
  "Shapes": "<path d=\"M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z\" /><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\" /><circle cx=\"17.5\" cy=\"17.5\" r=\"3.5\" />",
  "Triangle": "<path d=\"M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" />",
  "Diamond": "<path d=\"M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z\" />",
  "Rocket": "<path d=\"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5\" /><path d=\"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09\" /><path d=\"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z\" /><path d=\"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05\" />"
};
const ICON_POSITIONS=[[0,1,"Zap"],[0,5,"Boxes"],[0,8,"Gauge"],[1,0,"Layers"],[1,6,"Hexagon"],[1,9,"Cloud"],[2,1,"Cpu"],[2,9,"Database"],[3,0,"Palette"],[3,10,"Aperture"],[4,2,"Compass"],[4,5,"Orbit"],[4,8,"Shapes"],[5,1,"Triangle"],[5,6,"Diamond"],[5,9,"Rocket"]];
const EXTRA_POSITIONS=[[0,3],[1,3],[1,8],[2,5],[3,6],[4,0],[5,4],[5,10]];
const MICRO_SLOTS=[
  [.08,.17,.66],[.30,.09,.89],[.64,.15,.75],[.85,.29,.93],
  [.14,.38,.83],[.44,.34,.69],[.73,.50,.78],[.22,.63,.94],
  [.53,.72,.65],[.82,.78,.80],[.18,.89,.74]
];
const stage=document.getElementById("dashboard-atmosphere");
const small=document.getElementById("dashboard-tiles-small");
const large=document.getElementById("dashboard-tiles-main");
const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
const PHASE_COUNT=48, CYCLE=76;
let nodes=[],active=new Set(),pointerX=-9999,pointerY=-9999,pointerFrame=0;
let oldWidth=-1,oldHeight=-1;
function unitNoise(n,seed=0){
  const v=Math.sin((n+1)*127.1+seed*311.7)*43758.5453;
  return v-Math.floor(v);
}
function tileElement(spec,seq){
  const el=document.createElement("span");
  el.className="dashboard-cell"+(spec.icon?" dashboard-cell--icon":spec.small?" dashboard-cell--small":" dashboard-cell--quiet");
  el.setAttribute("aria-hidden","true");
  el.style.left=spec.left.toFixed(1)+"px";
  el.style.top=spec.top.toFixed(1)+"px";
  el.style.width=spec.side.toFixed(1)+"px";
  el.style.height=spec.side.toFixed(1)+"px";
  el.style.setProperty("--radius",Math.min(15,Math.max(spec.small?5:9,spec.side*.15)).toFixed(1)+"px");
  el.style.setProperty("--rest",(spec.icon?.19:spec.small?.10:.085).toFixed(3));
  el.style.setProperty("--peak",(spec.icon?.89:spec.small?.46:.60).toFixed(3));
  const phase=((seq+.5)/PHASE_COUNT*CYCLE+unitNoise(seq,9)*.65)%CYCLE;
  el.style.setProperty("--phase",(-phase).toFixed(3)+"s");
  const face=document.createElement("span");
  face.className="dashboard-cell-face";
  if(spec.icon){
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("class","dashboard-cell-icon");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("aria-hidden","true");
    svg.setAttribute("focusable","false");
    svg.innerHTML=ICON_SHAPES[spec.icon];
    face.append(svg);
  }
  el.append(face);
  return el;
}
function rebuild(){
  if(!stage||!small||!large)return;
  const sr=stage.getBoundingClientRect();
  if(sr.width<1||sr.height<1)return;
  if(Math.abs(sr.width-oldWidth)<1&&Math.abs(sr.height-oldHeight)<1)return;
  oldWidth=sr.width;oldHeight=sr.height;
  const mainR=large.getBoundingClientRect();
  const smallR=small.getBoundingClientRect();
  const mobile=sr.width<760;
  const topGap=Math.min(115,Math.max(76,sr.height*.115));
  const bottomGap=Math.min(190,Math.max(115,sr.height*.18));
  const spanY=Math.max(210,sr.height-topGap-bottomGap);
  const unitX=mainR.width/11;
  const unitY=spanY/6;
  const stagedMain=[],stagedSmall=[],records=[];
  const accepted=[];
  let seq=0;
  function setTile(zone,spec){
    const el=tileElement(spec,seq++);
    (zone===large?stagedMain:stagedSmall).push(el);
    const area=zone.getBoundingClientRect();
    records.push({element:el,x:area.left+spec.left+spec.side/2,
      y:area.top+spec.top+spec.side/2,reach:Math.max(95,spec.side*.75+55),side:spec.side});
  }
  function mainTile(row,col,icon,seed){
    const x=(col+.5)*unitX+(unitNoise(seed,2)-.5)*unitX*.12;
    const y=topGap+(row+.5)*unitY+(unitNoise(seed,5)-.5)*unitY*.12;
    const base=Math.min(unitX*.97,unitY*.79,125);
    const boost=icon?.82+unitNoise(seed,11)*.20: .75+unitNoise(seed,14)*.4;
    let side=Math.max(22,base*boost);
    if(!icon&&row===2&&col===5)side=Math.min(126,unitX*1.55,unitY*1.20);
    // Irregular tile scale is checked against every already-placed tile.
    // Neighboring cells do not collide on ultrawide or short viewports.
    for(let attempt=0;attempt<10;attempt++){
      if(accepted.every(t=>Math.abs(x-t.x)>(side+t.side)/2+8||
         Math.abs(y-t.y)>(side+t.side)/2+8))break;
      side*=.88;
    }
    if(side<23)return;
    accepted.push({x,y,side});
    setTile(large,{left:x-side/2,top:y-side/2,side,icon,small:false});
  }
  if(mobile){
    const shortlist=[ICON_POSITIONS[0],ICON_POSITIONS[2],ICON_POSITIONS[5],
      ICON_POSITIONS[7],ICON_POSITIONS[11],ICON_POSITIONS[14]];
    shortlist.forEach(([_,__,name],i)=>{
      const col=[1,5,9][i%3],row=Math.floor(i/3)*2+1;
      mainTile(row,col,name,i+47);
    });
    [[0,6],[4,4]].forEach(([r,c],i)=>mainTile(r,c,null,i+80));
  }else{
    ICON_POSITIONS.forEach(([r,c,name],i)=>mainTile(r,c,name,i+1));
    EXTRA_POSITIONS.forEach(([r,c],i)=>mainTile(r,c,null,i+29));
  }
  // Smaller, sparse squares behind the entire maximum-width sidebar zone.
  for(const [i,[x,y,s]] of MICRO_SLOTS.entries()){
    if(mobile&&i%2===1)continue;
    const diameter=Math.min(mobile?26:38,Math.max(13,smallR.width*.075))*s;
    const cx=x*smallR.width;
    const cy=topGap+y*spanY;
    setTile(small,{left:cx-diameter/2,top:cy-diameter/2,side:diameter,small:true});
  }
  small.replaceChildren(...stagedSmall);
  large.replaceChildren(...stagedMain);
  nodes=records;
  active.clear();
}
function updatePointer(){
  pointerFrame=0;
  if(reduce.matches)return;
  const next=new Set();
  for(const n of nodes){
    const dx=Math.max(0,Math.abs(pointerX-n.x)-n.side*.30);
    const dy=Math.max(0,Math.abs(pointerY-n.y)-n.side*.30);
    const distance=Math.hypot(dx,dy);
    if(distance>=n.reach)continue;
    const strength=Math.pow(1-distance/n.reach,1.8);
    if(strength<.015)continue;
    n.element.style.setProperty("--near",strength.toFixed(3));
    next.add(n);
  }
  for(const n of active)
    if(!next.has(n))n.element.style.removeProperty("--near");
  active=next;
}
function queuePointer(){
  if(!pointerFrame)pointerFrame=requestAnimationFrame(updatePointer);
}
if(stage&&small&&large){
  rebuild();
  window.addEventListener("pointermove",event=>{
    if(event.pointerType==="touch")return;
    pointerX=event.clientX;pointerY=event.clientY;queuePointer();
  },{passive:true});
  window.addEventListener("pointerout",event=>{
    if(event.relatedTarget)return;
    pointerX=-9999;pointerY=-9999;queuePointer();
  },{passive:true});
  window.addEventListener("blur",()=>{
    pointerX=-9999;pointerY=-9999;queuePointer();
  });
  window.addEventListener("resize",()=>{rebuild();queuePointer()},{passive:true});
  reduce.addEventListener?.("change",()=>{
    for(const n of active)n.element.style.removeProperty("--near");
    active.clear();
  });
}
