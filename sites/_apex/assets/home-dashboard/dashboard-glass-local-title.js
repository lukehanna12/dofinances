// Browser-local reconstruction of a single authored word's optical boundary.
// No font bytes, glyph tables, DOM snapshots, or persistent outline storage.
// Finite sampled approximation, NOT an exact font outline extractor.
// All coordinates are logical CSS points; framebuffer DPR never enters capture.
const threshold=127.5;
const distance2=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],q=dx*dx+dy*dy,t=q?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/q)):0;return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;};
function simplify(points,tol){
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop();let best=tol*tol,k=-1;for(let i=a+1;i<b;i++){const v=distance2(points[i],points[a],points[b]);if(v>best){best=v;k=i;}}if(k>=0){keep[k]=1;stack.push([a,k],[k,b]);}}
 return points.filter((_,i)=>keep[i]);
}
// Marching squares on pixel CENTER values, with linear edge interpolation.
// Shared edges use canonical integer keys, avoiding epsilon-based stitching.
// Ambiguous saddle cells are rejected (no silent topology change).
export function alphaContours(alpha,w,h,scale,tol=.035,offset=[0,0]){
 if(!Number.isInteger(w)||!Number.isInteger(h)||alpha.length!==w*h||!(scale>0)||!(tol>0))throw RangeError("Invalid alpha contour input");
 const nodes=new Map(),edges=new Map(),add=(key,p)=>{if(!nodes.has(key)){nodes.set(key,p);edges.set(key,[]);}return key;};
 const link=(a,b)=>{edges.get(a).push(b);edges.get(b).push(a);};
 const edge=(x,y,i,v)=>{
  const x0=x+(i===1?1:0),y0=y+(i===2?1:0),vert=i===1||i===3;
  const a=vert?(i===1?v[1]:v[0]):(i===2?v[3]:v[0]),b=vert?(i===1?v[2]:v[3]):(i===2?v[2]:v[1]),t=(threshold-a)/(b-a);
  return add((vert?"v":"h")+":"+x0+":"+y0,[(x0+.5+(vert?0:t))/scale-offset[0],(y0+.5+(vert?t:0))/scale-offset[1]]);
 };
 for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
  const k=y*w+x,a=alpha[k],b=alpha[k+1],c=alpha[k+w+1],d=alpha[k+w];
  const u=a>threshold,v=b>threshold,z=c>threshold,t=d>threshold;
  if(u===v&&v===z&&z===t)continue;
  const e=[];if(u!==v)e.push(0);if(v!==z)e.push(1);if(z!==t)e.push(2);if(t!==u)e.push(3);
  if(e.length!==2)throw Error("Unresolved glyph contour saddle");
  link(edge(x,y,e[0],[a,b,c,d]),edge(x,y,e[1],[a,b,c,d]));
 }
 const contours=[];let rawVertices=0;
 for(const [first,neighbors] of edges){
  if(!neighbors.length)continue;
  if(neighbors.length!==2)throw Error("Open glyph contour");
  const pts=[nodes.get(first)];let prev=first,cur=neighbors[0];
  while(cur!==first){const next=edges.get(cur);if(next.length!==2)throw Error("Unresolved glyph contour graph");pts.push(nodes.get(cur));const k=next[0]===prev?next[1]:next[0];next.length=0;prev=cur;cur=k;}
  neighbors.length=0;rawVertices+=pts.length;
  // Two nondegenerate arcs, each independently simplified. Closing the
  // path by simplifying identical endpoints would hide thin components.
  let far=1;for(let i=2;i<pts.length;i++)if(Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1])>Math.hypot(pts[far][0]-pts[0][0],pts[far][1]-pts[0][1]))far=i;
  const a=simplify(pts.slice(0,far+1),tol),b=simplify([...pts.slice(far),pts[0]],tol),path=[...a,...b.slice(1)];
  if(path.length<4)throw Error("Degenerate glyph contour");
  contours.push(path.slice(1).map((q,i)=>[path[i],q]));
 }
 if(!contours.length)throw Error("Empty glyph outline");
 return {contours,rawVertices,segments:contours.reduce((n,c)=>n+c.length,0)};
}
function capture(text,style,logicalHeight,scale,tol){
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
 const configure=()=>{ctx.font=style.fontStyle+" "+style.fontWeight+" "+style.fontSize+" "+style.fontFamily;ctx.letterSpacing=style.letterSpacing==="normal"?"0px":style.letterSpacing;ctx.fontKerning=style.fontKerning||"auto";ctx.textBaseline="alphabetic";ctx.textAlign="left";ctx.direction="ltr";};
 configure();const m=ctx.measureText(text),padding=4,baseline=(logicalHeight-m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)*.5+m.fontBoundingBoxAscent;
 const w=Math.ceil((Math.max(m.width,m.actualBoundingBoxRight)+2*padding)*scale),h=Math.ceil((logicalHeight+2*padding)*scale);
 if(w*h>10000000)throw Error("Glyph source budget exceeded");
 canvas.width=w;canvas.height=h;
 try{configure();ctx.scale(scale,scale);ctx.fillStyle="#fff";ctx.fillText(text,padding,padding+baseline);
  const data=ctx.getImageData(0,0,w,h).data,alpha=new Uint8Array(w*h);
  for(let i=0;i<alpha.length;i++)alpha[i]=data[4*i+3];
  return {...alphaContours(alpha,w,h,scale,tol,[padding,padding]),scale};
 }finally{canvas.width=canvas.height=0;}
}
// Finite convergence diagnostic, comparing vertices and midpoints in both
// directions. It is not a certified Hausdorff bound on the unknown font.
export function contourDeviation(a,b){
 const seg=b.flat().map(s=>({s,loX:Math.min(s[0][0],s[1][0]),hiX:Math.max(s[0][0],s[1][0]),loY:Math.min(s[0][1],s[1][1]),hiY:Math.max(s[0][1],s[1][1])}));
 const one=v=>{let best=Infinity;for(const q of seg){const dx=Math.max(q.loX-v[0],0,v[0]-q.hiX),dy=Math.max(q.loY-v[1],0,v[1]-q.hiY);if(dx*dx+dy*dy<best)best=Math.min(best,distance2(v,q.s[0],q.s[1]));}return Math.sqrt(best);};let max=0;
 for(const c of a)for(const s of c){max=Math.max(max,one(s[0]),one([(s[0][0]+s[1][0])*.5,(s[0][1]+s[1][1])*.5]));}
 return max;
}
const cache=new Map();
export function localTitleContours(text,style,logicalHeight){
 if(text!=="Projects"||style.direction!=="ltr"||!(logicalHeight>0))return null;
 const key=JSON.stringify([text,style.fontFamily,style.fontSize,style.fontWeight,style.fontStyle,style.letterSpacing,style.fontKerning,logicalHeight,document.fonts?.status]);
 if(cache.has(key))return cache.get(key);
 const t=performance.now();let result=null;
 try{
  const coarse=capture(text,style,logicalHeight,8,.035),middle=performance.now(),fine=capture(text,style,logicalHeight,16,.035),after=performance.now();
  const deviation=Math.max(contourDeviation(coarse.contours,fine.contours),contourDeviation(fine.contours,coarse.contours));
  if(coarse.contours.length!==fine.contours.length||fine.segments>1024||deviation>.18)throw Error("Font contour convergence failed: "+JSON.stringify({deviation,coarse:coarse.segments,fine:fine.segments}));
  result={...fine,deviation,coarseSegments:coarse.segments,buildMs:performance.now()-t,timing:[middle-t,after-middle,performance.now()-after]};
 }catch(error){console.warn("Local heading outline:",String(error));}
 if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
