import {glassContainsPoint,glassSpring} from "./dashboard-glass-model.js";
/*
 * Shared public-route hover ownership. Homepage squares continue to use the
 * unmodified dashboard-interaction.js controller, spring and GPU lanes.
 * The card contains its inputs/buttons, so its hover and the topmost
 * nested control must be independently active. Leaving a pane fades its
 * spring in place instead of dragging its hotspot back to the center.
 *
 * The spring constants and velocity limits intentionally match the
 * Dashboard interaction controller; there is no second glow or scaling.
 */
import {TILE_FLOATS} from "./dashboard-interaction.js";

const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const finite=v=>Number.isFinite(v)?v:0;
const spring=glassSpring;
const makeSlot=()=>({
  rect:[-100000,-100000,1,1],radii:[0,0,0,0],inert:true,initialized:false,
  active:false,hover:0,hoverVelocity:0,press:0,pressVelocity:0,
  x:0,y:0,vx:0,vy:0
});
function contains(slot,x,y){
  return !slot.inert&&glassContainsPoint(slot.rect,slot.radii,x,y);
}
export function createAuthGlassHoverController(capacity){
  if(!Number.isSafeInteger(capacity)||capacity<2)
    throw new RangeError("Card and at least one control required");
  const slots=Array.from({length:capacity},makeSlot);
  let px=-1,py=-1,hasPointer=false,pressed=false,controlIndex=-1;
  let independent=false;
  function retargetRects(data,base,mask,mode="nested"){
    if(!(data instanceof Float32Array)||!Number.isSafeInteger(base)||
       base<0||data.length<(base+capacity)*TILE_FLOATS||
       !(mask instanceof Uint8Array)||mask.length<base+capacity)
      throw new TypeError("Whole-scene auth glass rects and hit mask required");
    if(mode!=="nested"&&mode!=="independent")throw new TypeError("Unknown pane layout");
    if(independent!==(mode==="independent"))clear();
    independent=mode==="independent";
    slots.forEach((slot,i)=>{
      const p=(base+i)*TILE_FLOATS;
      slot.rect=[data[p],data[p+1],data[p+2],data[p+3]];
      slot.radii=Array.from(data.subarray(p+8,p+12),Math.abs);
      slot.inert=Boolean(mask[base+i]);
      // The route may mount after the first GPU frame. Never initialize a
      // still-missing pane against the 1px offscreen dummy rectangle.
      if(!slot.initialized&&!slot.inert){
        slot.x=slot.rect[2]*.5;slot.y=slot.rect[3]*.5;
        slot.initialized=true;
      }
    });
    updateTargets();
  }
  function updateTargets(){
    if(independent){
      // Projects cards and the back arrow are siblings, not nested controls.
      // Only the topmost touched pane receives the original hover spring.
      let next=-1;
      if(hasPointer)for(let i=slots.length-1;i>=0;i--){
        if(contains(slots[i],px,py)){next=i;break;}
      }
      slots.forEach((slot,i)=>{
        const active=i===next;
        if(slot.active&&!active){slot.vx=0;slot.vy=0;}
        slot.active=active;
      });
      if(controlIndex!==next)pressed=false;
      controlIndex=next;
      return;
    }
    const card=hasPointer&&contains(slots[0],px,py);
    // The card remains hovered when any contained control has hover.
    // Among overlapping controls only the visually topmost gets focus.
    let next=-1;
    if(card)for(let i=slots.length-1;i>=1;i--){
      if(contains(slots[i],px,py)){next=i;break;}
    }
    // Stop velocity-driven refraction as a pane is left. The outgoing
    // hotspot will then dissolve in place, without a directional recoil.
    slots.forEach((slot,i)=>{
      const active=i===0?card:i===next;
      if(slot.active&&!active){slot.vx=0;slot.vy=0;}
      slot.active=active;
    });
    if(controlIndex!==next)pressed=false;
    controlIndex=next;
    if(!card)pressed=false;
  }
  function move(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)){clear();return;}
    const oldX=px,oldY=py,previous=slots.map(s=>s.active);
    px=x;py=y;hasPointer=true;
    updateTargets();
    slots.forEach((slot,i)=>{
      if(!slot.active||!previous[i]||
         !Number.isFinite(oldX)||!Number.isFinite(oldY))return;
      slot.vx=clamp(slot.vx+(x-oldX)/Math.max(1,slot.rect[2])*3,-1,1);
      slot.vy=clamp(slot.vy+(y-oldY)/Math.max(1,slot.rect[3])*3,-1,1);
    });
  }
  function setPressed(value,{tapImpulse=false}={}){
    const next=Boolean(value)&&(independent?controlIndex>=0:slots[0].active);
    // The Home mosaic deliberately renders at 30fps. Very quick mouse
    // down/up pairs can both arrive between full-scene frames: a normal
    // pressTarget=1 may never be sampled. On a Home CTA only, preserve a
    // small local spring VELOCITY impulse at pointerdown, so the very next
    // GPU frame still shows a brief press even after release. The hover
    // spring, tint and pointer position are not reset or replaced.
    // Projects and nested Sign in have exactly their previous dynamics.
    if(next&&!pressed&&tapImpulse){
      const index=independent?controlIndex:0;
      const slot=slots[index];
      if(slot?.active)slot.pressVelocity=Math.max(slot.pressVelocity,21);
    }
    pressed=next;
  }
  function clear(){
    hasPointer=false;px=-1;py=-1;pressed=false;
    updateTargets();
  }
  function advance(seconds,reducedMotion=false){
    const dt=clamp(finite(seconds),0,.05);
    let changing=false;
    for(let i=0;i<slots.length;i++){
      const slot=slots[i],hoverTarget=slot.active?1:0;
      const pressTarget=slot.active&&pressed?1:0;
      if(reducedMotion){
        slot.hover=hoverTarget;slot.press=pressTarget;
        slot.hoverVelocity=0;slot.pressVelocity=0;
        slot.vx=0;slot.vy=0;
      }else{
        [slot.hover,slot.hoverVelocity]=spring(
          slot.hover,slot.hoverVelocity,hoverTarget,dt,hoverTarget?26:18);
        [slot.press,slot.pressVelocity]=spring(
          slot.press,slot.pressVelocity,pressTarget,dt,pressTarget?34:23);
        slot.hover=clamp(slot.hover,-.01,1.01);
        slot.press=clamp(slot.press,-.01,1.01);
        const decay=Math.exp(-14*dt);
        slot.vx*=decay;slot.vy*=decay;
      }
      if(slot.active){
        const [left,top,w,h]=slot.rect;
        const targetX=clamp(px-left,0,w);
        const targetY=clamp(py-top,0,h);
        const follow=reducedMotion?1:1-Math.exp(-25*dt);
        slot.x+=(targetX-slot.x)*follow;
        slot.y+=(targetY-slot.y)*follow;
        if(Math.abs(slot.x-targetX)+Math.abs(slot.y-targetY)>.08)
          changing=true;
      }
      // Inactive slots deliberately do NOT relax x/y toward their center.
      // Their last hotspot position stays frozen for the entire fade-out.
      if(Math.abs(slot.hover-hoverTarget)>.0007||
         Math.abs(slot.press-pressTarget)>.0007||
         Math.abs(slot.hoverVelocity)+Math.abs(slot.pressVelocity)>.001||
         Math.abs(slot.vx)+Math.abs(slot.vy)>.001)changing=true;
    }
    return changing;
  }
  function writeTo(data,base){
    if(!(data instanceof Float32Array)||!Number.isSafeInteger(base)||
       base<0||data.length<(base+capacity)*TILE_FLOATS)
      throw new TypeError("Full GPU tile buffer required");
    for(let i=0;i<slots.length;i++){
      const slot=slots[i],p=(base+i)*TILE_FLOATS+12;
      data[p]=clamp(slot.hover,0,1);data[p+1]=clamp(slot.press,0,1);
      data[p+2]=slot.x;data[p+3]=slot.y;
      data[p+4]=slot.vx;data[p+5]=slot.vy;
      // Never modify the independent motion opacity / dismissal lanes.
    }
  }
  function snapshot(index){
    if(!Number.isSafeInteger(index)||index<0||index>=capacity)
      throw new RangeError("Unknown sign-in pane");
    const {hover,press,x,y,active,vx,vy}=slots[index];
    return {hover,press,x,y,active,vx,vy};
  }
  return Object.freeze({
    retargetRects,move,setPressed,clear,advance,writeTo,snapshot,
    get cardHovered(){return slots[0].active;},
    get controlHovered(){return controlIndex>=1;},
    get activeControl(){return controlIndex;}
  });
}
