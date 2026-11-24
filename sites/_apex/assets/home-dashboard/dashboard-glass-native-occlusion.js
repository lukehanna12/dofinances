/* Native foreground occlusion across the DOM / GPU presentation boundary.
 * No custom raster, readback, copy of text, or optical material change.
 * The browser applies a local SVG mask only to intersecting foreground.
 * The higher GPU surface still samples the haze-free GPU underlay. */
const NS="http://www.w3.org/2000/svg";
let serial=0;
const clamp=v=>Math.min(1,Math.max(0,v));
const svg=(doc,tag)=>doc.createElementNS(NS,tag);
function attrs(node,values){
 for(const [k,v] of Object.entries(values))if(node.getAttribute(k)!==String(v))node.setAttribute(k,String(v));
}
// r: viewport rect of native foreground; width/height: its local border box.
// p: viewport rect of the submitted upper GPU pane. Radius is in CSS px.
export function nativeOcclusionHole(r,width,height,p){
 if(!(r.width>0&&r.height>0&&width>0&&height>0&&p.width>0&&p.height>0&&p.opacity>.002))return null;
 if(p.left>=r.left+r.width||p.top>=r.top+r.height||p.left+p.width<=r.left||p.top+p.height<=r.top)return null;
 const sx=width/r.width,sy=height/r.height;
 return {x:(p.left-r.left)*sx,y:(p.top-r.top)*sy,width:p.width*sx,height:p.height*sy,
  rx:Math.min(p.radius,p.width/2)*sx,ry:Math.min(p.radius,p.height/2)*sy,opacity:clamp(p.opacity)};
}
export function createNativeForegroundOcclusion(doc){
 const records=new Map();
 let host=null,defs=null;
 function release(node,e){
  node.removeAttribute("data-native-glass-occluded");
  node.style.removeProperty("--native-glass-occlusion");
  e.mask.remove();records.delete(node);
 }
 function clear(){for(const [node,e] of records)release(node,e);host?.remove();host=defs=null;}
 function ensureHost(){
  if(host)return;
  host=svg(doc,"svg");attrs(host,{width:0,height:0,"aria-hidden":"true",focusable:"false"});
  host.style.cssText="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  defs=svg(doc,"defs");host.append(defs);doc.body.append(host);
 }
 function sync(nodes,panels,applies=()=>true){
  if(!panels.length){clear();return 0;}
  const seen=new Set();
  for(const node of nodes){
   if(!node.isConnected||node.closest("[hidden]"))continue;
   const r=node.getBoundingClientRect();
   const relevant=panels.filter(p=>applies(p,node)&&p.opacity>.002&&p.left<r.right&&p.top<r.bottom&&p.left+p.width>r.left&&p.top+p.height>r.top);
   if(!relevant.length)continue;
   const style=getComputedStyle(node),w=parseFloat(style.width)||node.offsetWidth,h=parseFloat(style.height)||node.offsetHeight;
   const holes=relevant.map(p=>nativeOcclusionHole(r,w,h,p)).filter(Boolean);
   if(!holes.length)continue;
   seen.add(node);
   let e=records.get(node);
   if(!e){
    ensureHost();
    const id="native-glass-occlusion-"+(++serial),mask=svg(doc,"mask"),base=svg(doc,"rect");
    attrs(mask,{id,maskUnits:"userSpaceOnUse",maskContentUnits:"userSpaceOnUse","mask-type":"luminance",x:0,y:0});
    attrs(base,{x:0,y:0,fill:"white"});mask.append(base);defs.append(mask);
    e={mask,base,holes:[]};records.set(node,e);
    node.style.setProperty("--native-glass-occlusion",'url("#'+id+'")');
    node.setAttribute("data-native-glass-occluded","");
   }
   attrs(e.mask,{width:w,height:h});attrs(e.base,{width:w,height:h});
   while(e.holes.length<holes.length){const rect=svg(doc,"rect");e.mask.append(rect);e.holes.push(rect);}
   while(e.holes.length>holes.length)e.holes.pop().remove();
   holes.forEach((p,i)=>attrs(e.holes[i],{x:p.x,y:p.y,width:p.width,height:p.height,rx:p.rx,ry:p.ry,fill:"black","fill-opacity":p.opacity}));
  }
  for(const [node,e] of records)if(!seen.has(node))release(node,e);
  if(!records.size){host?.remove();host=defs=null;}
  return records.size;
 }
 return {sync,clear};
}
