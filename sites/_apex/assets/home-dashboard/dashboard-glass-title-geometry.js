// Continuous vector reference: closed line/quadratic/cubic Bézier contours.
// No raster distance field or fixed tessellation. Bounds are mathematical AABB/control-hull
// bounds with conservative floating-point padding, not interval-arithmetic certification.
// Exact filled-boundary semantics require nonintersecting contours; use outline contours,
// not stroke centerlines. Overlapping/self-intersecting paths are outside this contract.
const lerp=(a,b,t)=>[(1-t)*a[0]+t*b[0],(1-t)*a[1]+t*b[1]];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function point(p){if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw new RangeError("Finite 2D point required");}
function segment(c){if(!Array.isArray(c)||c.length<2||c.length>4)throw new RangeError("Line, quadratic or cubic controls required");c.forEach(point);}
function split(c,t=.5){
 let row=c.slice(),left=[row[0]],right=[row.at(-1)];
 while(row.length>1){row=row.slice(1).map((b,i)=>lerp(row[i],b,t));left.push(row[0]);right.push(row.at(-1));}
 return [left,right.reverse()];
}
export function evaluate(c,t){segment(c);if(!Number.isFinite(t)||t<0||t>1)throw new RangeError("Parameter outside curve");return split(c,t)[0].at(-1);}
function bounds(c,p){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [x,y] of c){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const pad=64*Number.EPSILON*Math.max(1,Math.abs(x0),Math.abs(x1),Math.abs(y0),Math.abs(y1),Math.abs(p[0]),Math.abs(p[1]));
 return Math.max(0,Math.hypot(Math.max(x0-p[0],0,p[0]-x1),Math.max(y0-p[1],0,p[1]-y1))-pad);
}
function closestLine(c,p){
 const [a,b]=c,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
 const t=len===0?0:Math.max(0,Math.min(1,((p[0]-a[0])*(dx/len)+(p[1]-a[1])*(dy/len))/len));
 return {t,point:lerp(a,b,t)};
}
export function closestCurve(c,p,{tolerance=1e-6,maxNodes=200000}={}){
 segment(c);point(p);
 if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isSafeInteger(maxNodes)||maxNodes<1)throw new RangeError("Invalid distance budget");
 // Translate to query-local coordinates to avoid large world origins in the solver.
 const local=c.map(a=>[a[0]-p[0],a[1]-p[1]]),origin=[0,0];
 const shift=a=>[a[0]+p[0],a[1]+p[1]];
 if(c.length===2){const a=closestLine(local,origin),d=Math.hypot(...a.point);return {...a,point:shift(a.point),distance:d,lower:d,upper:d,converged:true,nodes:1};}
 let best={distance:Infinity,t:0,point:local[0]},nodes=0,stack=[{c:local,a:0,b:1,lower:bounds(local,origin)}],discarded=Infinity;
 function candidate(q,t){const d=Math.hypot(...q);if(d<best.distance)best={distance:d,t,point:q};}
 candidate(local[0],0);candidate(local.at(-1),1);
 while(stack.length&&nodes<maxNodes){
  const n=stack.pop();nodes++;
  if(n.lower>=best.distance-tolerance){discarded=Math.min(discarded,n.lower);continue;}
  const m=(n.a+n.b)/2;
  if(m===n.a||m===n.b){discarded=Math.min(discarded,n.lower);continue;}
  const [l,r]=split(n.c);candidate(l.at(-1),m);
  const children=[{c:l,a:n.a,b:m,lower:bounds(l,origin)},{c:r,a:m,b:n.b,lower:bounds(r,origin)}].sort((a,b)=>b.lower-a.lower);
  stack.push(...children);
 }
 const lower=Math.min(best.distance,discarded,...stack.map(n=>n.lower));
 return {...best,point:shift(best.point),lower,upper:best.distance,converged:best.distance-lower<=tolerance,nodes};
}
// Split at roots of y'(t). A monotone interval can contain at most one
// half-open upward/downward crossing. Horizontal extrema cancel by construction.
function extremaY(c){
 const ys=c.map(a=>a[1]),d=ys.slice(1).map((y,i)=>y-ys[i]);
 const magnitude=Math.max(...d.map(Math.abs));if(magnitude===0)return [];
 const z=d.map(x=>x/magnitude);let roots=[];
 if(z.length===2){const a=z[1]-z[0];if(a!==0)roots=[-z[0]/a];}
 if(z.length===3){
  const a=z[0]-2*z[1]+z[2],b=2*(z[1]-z[0]),cc=z[0];
  if(a===0){if(b!==0)roots=[-cc/b];}
  else {const disc=b*b-4*a*cc;if(disc>=0){const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(disc));roots=q===0?[-b/(2*a)]:[q/a,cc/q];}}
 }
 return [...new Set(roots.filter(t=>t>0&&t<1))].sort((a,b)=>a-b);
}
function crossing(c,p){
 const local=c.map(a=>[a[0]-p[0],a[1]-p[1]]);
 const ts=[0,...extremaY(local),1];let winding=0,uncertain=false;
 const eps=128*Number.EPSILON*Math.max(1,...local.flat().map(Math.abs));
 for(let i=1;i<ts.length;i++){
  let lo=ts[i-1],hi=ts[i],a=evaluate(local,lo)[1],b=evaluate(local,hi)[1];
  const dir=a<=0&&b>0?1:b<=0&&a>0?-1:0;if(!dir)continue;
  for(let j=0;j<64;j++){const m=(lo+hi)/2;if(m===lo||m===hi)break;
   const y=evaluate(local,m)[1];if((y<=0)===(dir===1))lo=m;else hi=m;}
  const x=evaluate(local,(lo+hi)/2)[0];
  if(Math.abs(x)<=eps)uncertain=true;else if(x>0)winding+=dir;
 }
 return {winding,uncertain};
}
function signedArea(c){
 const origin=c[0][0],g=Math.sqrt(3/5)/2;
 const nodes=[.5-g,.5,.5+g],weights=[5/18,4/9,5/18];
 let area=0;
 for(const s of c){
  const a=s.map(q=>[q[0]-origin[0],q[1]-origin[1]]),n=a.length-1;
  const derivative=a.slice(1).map((q,i)=>[(q[0]-a[i][0])*n,(q[1]-a[i][1])*n]);
  for(let i=0;i<3;i++){
   const q=evaluate(a,nodes[i]),d=derivative.length===1?derivative[0]:evaluate(derivative,nodes[i]);
   area+=weights[i]*(q[0]*d[1]-q[1]*d[0]);
  }
 }
 return area/2;
}
export function contourField(contours,p,{tolerance=1e-6,fillRule="nonzero",maxNodes=200000}={}){
 point(p);
 if(!Array.isArray(contours)||!contours.length||!["nonzero","evenodd"].includes(fillRule))throw new RangeError("Closed outline contours and valid fill rule required");
 let winding=0,uncertain=false,best=null,lower=Infinity,nodes=0,converged=true;
 for(const c of contours){
  if(!Array.isArray(c)||!c.length)throw new RangeError("Empty contour");
  c.forEach(segment);
  for(let i=0;i<c.length;i++)if(dist(c[i].at(-1),c[(i+1)%c.length][0])!==0)throw new RangeError("Contour is not closed");
 }
 // Under nonzero fill, a same-direction nested contour may not separate filled
 // and empty regions. Classify its two sides using other contours' winding
 // plus its own orientation (signed area from exact polynomial quadrature).
 for(let i=0;i<contours.length;i++){
  const c=contours[i];let outsideWinding=0,classificationUncertain=false;
  for(let j=0;j<contours.length;j++)if(i!==j)for(const s of contours[j]){
   const w=crossing(s,c[0][0]);outsideWinding+=w.winding;classificationUncertain||=w.uncertain;
  }
  const orientation=Math.sign(signedArea(c));
  if(!orientation||classificationUncertain)throw new RangeError("Degenerate or unresolved contour nesting");
  const active=fillRule==="evenodd"||(outsideWinding===0)!==(outsideWinding+orientation===0);
  for(const s of c){
   const w=crossing(s,p);winding+=w.winding;uncertain||=active&&w.uncertain;
   if(!active)continue;
   const a=closestCurve(s,p,{tolerance,maxNodes});nodes+=a.nodes;converged&&=a.converged;
   if(!best||a.distance<best.distance)best=a;lower=Math.min(lower,a.lower);
  }
 }
 if(!best)throw new RangeError("No active boundary");
 const inside=fillRule==="evenodd"?Math.abs(winding)%2===1:winding!==0;
 const signKnown=!uncertain&&lower>0;
 const signedInterval=signKnown?(inside?[-best.upper,-lower]:[lower,best.upper]):[-best.upper,best.upper];
 return {distance:signKnown?(inside?-best.distance:best.distance):null,signedInterval,inside:signKnown?inside:null,
  winding,converged:converged&&best.upper-lower<=tolerance,nodes,nearest:best.point,lower,upper:best.upper,
  // Nearest point alone cannot certify uniqueness at medial axes or seams.
  gradient:null};
}

// Exact curve degree elevation plus monotone-y splitting; no fixed tessellation.
// Assumes simple, mutually disjoint or nested contours, not arbitrary intersections.
export function prepareVectorPath(contours,{fillRule="nonzero",tolerance=1e-4}={}){
 if(!Array.isArray(contours)||!contours.length||!["nonzero","evenodd"].includes(fillRule)||!Number.isFinite(tolerance)||tolerance<=0)throw new RangeError("Invalid path");
 for(const c of contours){
  if(!Array.isArray(c)||!c.length)throw new RangeError("Empty contour");c.forEach(segment);
  for(let i=0;i<c.length;i++)if(dist(c[i].at(-1),c[(i+1)%c.length][0])!==0)throw new RangeError("Unclosed path");
 }
 const active=[];
 for(let i=0;i<contours.length;i++){
  const c=contours[i];let winding=0;
  for(let j=0;j<contours.length;j++)if(i!==j)for(const s of contours[j]){
   const w=crossing(s,c[0][0]);if(w.uncertain)throw new RangeError("Unresolved nesting");winding+=w.winding;
  }
  const sign=Math.sign(signedArea(c));if(!sign)throw new RangeError("Degenerate contour");
  if(fillRule==="evenodd"||(winding===0)!==(winding+sign===0))active.push(c);
 }
 const coords=active.flat(2),minX=Math.min(...coords.map(p=>p[0])),maxX=Math.max(...coords.map(p=>p[0])),minY=Math.min(...coords.map(p=>p[1])),maxY=Math.max(...coords.map(p=>p[1]));
 const origin=[(minX+maxX)/2,(minY+maxY)/2],scale=Math.max(maxX-minX,maxY-minY);
 if(!Number.isFinite(scale)||scale<=0)throw new RangeError("Degenerate path scale");
 const rows=[];
 for(const c of active)for(const s of c){
  const points=s.map(p=>[(p[0]-origin[0])/scale,(p[1]-origin[1])/scale]);
  const pieces=[];let rest=points,last=0;
  for(const t of extremaY(points)){const [left,right]=split(rest,(t-last)/(1-last));pieces.push(left);rest=right;last=t;}
  pieces.push(rest);
  for(const p of pieces){
   const deg=p.length-1;let cubic=p;
   if(deg===1)cubic=[p[0],lerp(p[0],p[1],1/3),lerp(p[0],p[1],2/3),p[1]];
   if(deg===2)cubic=[p[0],lerp(p[0],p[1],2/3),lerp(p[2],p[1],2/3),p[2]];
   rows.push(...cubic.flat(),deg,0,0,0);
  }
 }
 if(!rows.length||rows.length>1024*12)throw new RangeError("Path segment budget exceeded");
 const normalizedTolerance=tolerance/scale;
 if(normalizedTolerance<1e-5)throw new RangeError("Requested path tolerance below Float32 reference guard");
 return {origin,scale,tolerance,normalizedTolerance,curves:Float32Array.from(rows),contours,fillRule};
}

// Word-specific reference geometry. Browser shaping and coverage remain
// authoritative. Never load or export a system font file.
export function prepareTitleWord(asset,text,style,width,height,dpr){
 if(asset?.schema!=="dofinances-projects-word-outline-v1"||text!==asset.text||text!=="Projects"||
   !navigator.platform.includes("Mac")||Number(style.fontWeight)!==550||style.fontStyle!=="normal"||
   !style.fontFamily.includes("system-ui")||style.direction!=="ltr")return null;
 const size=parseFloat(style.fontSize),spacing=parseFloat(style.letterSpacing);
 if(size<51.75-.001||size>69.75+.001||Math.abs(spacing+.035*size)>.002)return null;
 const [a,b]=asset.samples,t=Math.max(0,Math.min(1,(size-a.size)/(b.size-a.size)));
 const c=document.createElement("canvas").getContext("2d");if(!c)return null;
 c.font=style.fontStyle+" "+style.fontWeight+" "+style.fontSize+" "+style.fontFamily;
 c.letterSpacing=style.letterSpacing;c.fontKerning=style.fontKerning||"auto";c.direction="ltr";
 const m=c.measureText(text),expected=(a.metrics[0]+(b.metrics[0]-a.metrics[0])*t)*size;
 if(Math.abs(m.width-expected)>.5||Math.abs(m.fontBoundingBoxAscent-(a.metrics[1]+(b.metrics[1]-a.metrics[1])*t)*size)>1||
 Math.abs(m.fontBoundingBoxDescent-(a.metrics[2]+(b.metrics[2]-a.metrics[2])*t)*size)>1)return null;
 const baseline=(height/dpr-m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)*.5+m.fontBoundingBoxAscent;
 // Prefix widths preserve actual browser kerning/advance placement.
 const positions=[...text].map((ch,i)=>c.measureText(text.slice(0,i+1)).width-c.measureText(ch).width);
 const blend=(x,y)=>Array.isArray(x)?x.map((v,i)=>blend(v,y[i])):x+(y-x)*t;
 const paths=blend(a.paths,b.paths),contours=[];
 paths.forEach((glyph,i)=>{for(const contour of glyph)contours.push(contour.map(seg=>seg.map(pt=>[(positions[i]+pt[0]*size)*dpr,(baseline+pt[1]*size)*dpr])));});
 const model=prepareVectorPath(contours,{tolerance:Math.max(.003,width*1e-5)});
 return {...model,width,height,dpr};
}
