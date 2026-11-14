/*
 * Browser-only interaction dynamics for the isolated Dashboard preview.
 * NOT a recovered Apple Glass input/response law. Static SDF/LOD shader
 * equations are kept separate from these reversible, bounded effects.
 * Pure functions: no DOM, timers, network, or native-provider dependency.
 */
export const TILE_FLOATS=20;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const finite=v=>Number.isFinite(v)?v:0;
const makeState=()=>({
  hover:0,hoverVelocity:0,press:0,pressVelocity:0,
  x:0,y:0,vx:0,vy:0
});
function spring(value,velocity,target,dt,rate){
  const offset=value-target;
  const j=velocity+rate*offset;
  const decay=Math.exp(-rate*dt);
  return [target+(offset+j*dt)*decay,(velocity-rate*j*dt)*decay];
}
export function createInteractionController(){
  let bounds=[],state=[],focus=-1,pressed=false,px=-1,py=-1,hasPointer=false;
  function hit(x,y){
    for(let i=bounds.length-1;i>=0;i--){
      const b=bounds[i];
      if(x>=b[0]&&x<=b[0]+b[2]&&y>=b[1]&&y<=b[1]+b[3])return i;
    }
    return -1;
  }
  function configure(rects){
    const previous=state;
    bounds=rects.map(b=>{
      if(!Array.isArray(b)||b.length!==4||b.some(v=>!Number.isFinite(v)))
        throw new TypeError("Four finite tile bounds required");
      return [...b];
    });
    state=bounds.map((b,i)=>{
      const v=previous[i]||makeState();
      if(!previous[i]){v.x=b[2]*.5;v.y=b[3]*.5;}
      return v;
    });
    focus=hasPointer?hit(px,py):-1;
    if(focus<0)pressed=false;
  }
  function move(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)){clear();return -1;}
    const previous=focus, oldX=px, oldY=py;
    px=x;py=y;hasPointer=true;focus=hit(px,py);
    if(focus!==previous)pressed=false;
    if(focus>=0){
      const b=bounds[focus],s=state[focus];
      if(previous===focus && Number.isFinite(oldX) && Number.isFinite(oldY)){
        s.vx=clamp(s.vx+(x-oldX)/Math.max(1,b[2])*3,-1,1);
        s.vy=clamp(s.vy+(y-oldY)/Math.max(1,b[3])*3,-1,1);
      }
    }
    return focus;
  }
  function setPressed(value){pressed=!!value && focus>=0;}
  function clear(){hasPointer=false;focus=-1;pressed=false;px=-1;py=-1;}
  function advance(seconds,reducedMotion=false){
    const dt=clamp(finite(seconds),0,0.05);
    let changing=false;
    for(let i=0;i<state.length;i++){
      const s=state[i],b=bounds[i],hoverTarget=i===focus?1:0;
      const pressTarget=i===focus&&pressed?1:0;
      if(reducedMotion){
        s.hover=hoverTarget;s.press=pressTarget;
        s.hoverVelocity=0;s.pressVelocity=0;s.vx=0;s.vy=0;
      }else{
        [s.hover,s.hoverVelocity]=spring(s.hover,s.hoverVelocity,hoverTarget,dt,hoverTarget?26:18);
        [s.press,s.pressVelocity]=spring(s.press,s.pressVelocity,pressTarget,dt,pressTarget?34:23);
        s.hover=clamp(s.hover,-0.01,1.01);
        s.press=clamp(s.press,-0.01,1.01);
        const decay=Math.exp(-14*dt);s.vx*=decay;s.vy*=decay;
      }
      const targetX=i===focus?clamp(px-b[0],0,b[2]):b[2]*.5;
      const targetY=i===focus?clamp(py-b[1],0,b[3]):b[3]*.5;
      const follow=reducedMotion?1:1-Math.exp(-25*dt);
      s.x+=(targetX-s.x)*follow;s.y+=(targetY-s.y)*follow;
      if(Math.abs(s.hover-hoverTarget)>0.0007 ||
         Math.abs(s.press-pressTarget)>0.0007 ||
         Math.abs(s.hoverVelocity)+Math.abs(s.pressVelocity)>0.001 ||
         Math.abs(s.vx)+Math.abs(s.vy)>0.001 ||
         Math.abs(s.x-targetX)+Math.abs(s.y-targetY)>0.08)changing=true;
    }
    return changing;
  }
  function writeTo(data){
    if(!(data instanceof Float32Array)||data.length!==state.length*TILE_FLOATS)
      throw new TypeError("Full tile buffer with 20 floats per tile required");
    for(let i=0;i<state.length;i++){
      const s=state[i],p=i*TILE_FLOATS+12;
      data[p]=clamp(s.hover,0,1);data[p+1]=clamp(s.press,0,1);
      data[p+2]=s.x;data[p+3]=s.y;
      data[p+4]=s.vx;data[p+5]=s.vy;data[p+6]=0;data[p+7]=0;
    }
  }
  return {
    configure,move,setPressed,clear,advance,writeTo,
    get focusedTile(){return focus;},
    get isPressed(){return pressed;},
    get count(){return state.length;},
    snapshot(){return state.map(s=>({...s}));}
  };
}
