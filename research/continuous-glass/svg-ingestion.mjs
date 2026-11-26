// Strict authored icon SVG subset. Coordinates are vector data, not pixels.
const number=/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/;
const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const TAU=2*Math.PI;
function arc(p,q,rx,ry,angle,large,sweep,tol){
 rx=Math.abs(rx);ry=Math.abs(ry);
 if(eq(p,q))return [];
 if(!rx||!ry)return [[p,q]];
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=(p[0]-q[0])/2,dy=(p[1]-q[1])/2;
 const x=c*dx+s*dy,y=-s*dx+c*dy;
 const lam=(x/rx)**2+(y/ry)**2;
 if(lam>1){const f=Math.sqrt(lam);rx*=f;ry*=f;}
 const z=(x/rx)**2+(y/ry)**2;
 const f=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(1-z)/z));
 const X=f*rx*y/ry,Y=-f*ry*x/rx;
 const center=[c*X-s*Y+(p[0]+q[0])/2,s*X+c*Y+(p[1]+q[1])/2];
 const start=Math.atan2((y-Y)/ry,(x-X)/rx);
 let delta=Math.atan2((-y-Y)/ry,(-x-X)/rx)-start;
 if(sweep&&delta<0)delta+=TAU;if(!sweep&&delta>0)delta-=TAU;
 // Cubic Hermite approximation in the angle parameter. For every unit projection
 // |f''''| <= max(rx,ry); Hermite remainder <= max(rx,ry)*step^4/384.
 // This is an absolute Euclidean curve error bound in authored units.
 const limit=Math.min(Math.PI/2,(384*tol/Math.max(rx,ry))**.25);
 const n=Math.max(1,Math.ceil(Math.abs(delta)/limit));
 if(!Number.isSafeInteger(n)||n>4096)throw new RangeError("Arc error budget exceeded");
 const point=t=>[center[0]+c*rx*Math.cos(t)-s*ry*Math.sin(t),center[1]+s*rx*Math.cos(t)+c*ry*Math.sin(t)];
 const deriv=t=>[-c*rx*Math.sin(t)-s*ry*Math.cos(t),-s*rx*Math.sin(t)+c*ry*Math.cos(t)];
 const out=[];let from=p;
 for(let i=0;i<n;i++){
  const t=start+delta*i/n,u=start+delta*(i+1)/n,h=(u-t)/3,to=i===n-1?q:point(u),d=deriv(t),e=deriv(u);
  out.push([from,add(from,d.map(v=>v*h)),add(to,e.map(v=>-v*h)),to]);from=to;
 }
 return out;
}
export function parsePath(d,{arcTolerance=1e-4}={}){
 if(typeof d!=="string"||!(arcTolerance>0)||!Number.isFinite(arcTolerance))throw new RangeError("Invalid path");
 let i=0,p=[0,0],start=null,command=null,previous=null,control=null,sub=null;const paths=[];
 const skip=()=>{while(i<d.length&&/[\s,]/.test(d[i]))i++;};
 const read=(flag=false)=>{skip();if(flag){const c=d[i++];if(c!=="0"&&c!=="1")throw Error("Invalid arc flag");return +c;}
  const m=number.exec(d.slice(i));if(!m)throw Error("Expected SVG coordinate at "+i);i+=m[0].length;const n=+m[0];if(!Number.isFinite(n))throw Error("Nonfinite SVG coordinate");return n;};
 const xy=rel=>{const a=[read(),read()];return rel?add(p,a):a;};
 const append=segments=>{if(!sub)throw Error("Path needs initial move");for(const a of segments)sub.segments.push(a);};
 while(true){
  skip();if(i>=d.length)break;
  if(/[a-z]/i.test(d[i]))command=d[i++];else if(!command)throw Error("Expected path command");
  const upper=command.toUpperCase(),rel=command!==upper;
  if(upper==="M"){
   p=xy(rel);start=p;sub={start:p,segments:[],closed:false};paths.push(sub);command=rel?"l":"L";control=null;previous="M";continue;
  }
  if(!sub)throw Error("Path needs initial move");
  if(upper==="Z"){if(!eq(p,start))append([[p,start]]);p=start;sub.closed=true;command=null;previous="Z";control=null;continue;}
  if(sub.closed){sub={start:p,segments:[],closed:false};paths.push(sub);start=p;}
  let q,a,b,next=null;
  switch(upper){
   case "L":q=xy(rel);append([[p,q]]);break;
   case "H":q=[read()+(rel?p[0]:0),p[1]];append([[p,q]]);break;
   case "V":q=[p[0],read()+(rel?p[1]:0)];append([[p,q]]);break;
   case "C":a=xy(rel);b=xy(rel);q=xy(rel);append([[p,a,b,q]]);next=b;break;
   case "S":a=(previous==="C"||previous==="S")?p.map((v,k)=>2*v-control[k]):p;b=xy(rel);q=xy(rel);append([[p,a,b,q]]);next=b;break;
   case "Q":a=xy(rel);q=xy(rel);append([[p,a,q]]);next=a;break;
   case "T":a=(previous==="Q"||previous==="T")?p.map((v,k)=>2*v-control[k]):p;q=xy(rel);append([[p,a,q]]);next=a;break;
   case "A":{const rx=read(),ry=read(),angle=read(),large=read(true),sweep=read(true);q=xy(rel);append(arc(p,q,rx,ry,angle,large,sweep,arcTolerance));break;}
   default:throw Error("Unsupported path command "+command);
  }
  p=q;previous=upper;control=next;
 }
 return paths.filter(s=>s.segments.length);
}
// Explicitly limited XML reader for trusted repository assets; no DTD, entities,
// text, external resources, style sheets or transforms. Reject unsupported markup.
function nodes(xml){
 const stack=[],roots=[];let end=0;
 const tag=/<\s*(\/?)([A-Za-z][\w:-]*)([^<>]*?)(\/?)\s*>/g;let m;
 while((m=tag.exec(xml))){
  if(xml.slice(end,m.index).trim())throw Error("Unsupported XML content");end=tag.lastIndex;
  const [,close,name,raw,self]=m;
  if(close){if(raw.trim()||self||stack.pop()?.name!==name)throw Error("Malformed XML close");continue;}
  const attrs={};let pos=0;const attr=/\s+([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;let a;
  while((a=attr.exec(raw))){if(raw.slice(pos,a.index).trim()||Object.hasOwn(attrs,a[1]))throw Error("Malformed or duplicate attribute");pos=attr.lastIndex;attrs[a[1]]=a[3]??a[4];}
  if(raw.slice(pos).trim())throw Error("Malformed attributes");
  if(Object.values(attrs).some(s=>s.includes("&")))throw Error("XML entities unsupported");
  const n={name,attrs,children:[]};(stack.at(-1)?.children??roots).push(n);if(!self)stack.push(n);
 }
 if(xml.slice(end).trim()||stack.length||roots.length!==1||roots[0].name!=="svg")throw Error("Malformed SVG root");
 return roots[0];
}
const stateKeys=["fill","stroke","stroke-width","stroke-linecap","stroke-linejoin","stroke-miterlimit","fill-rule","fill-opacity","stroke-opacity","opacity"];
const geometryKeys={svg:["xmlns","viewBox","width","height"],g:[],path:["d"],circle:["cx","cy","r"],ellipse:["cx","cy","rx","ry"],rect:["x","y","width","height","rx","ry"],line:["x1","y1","x2","y2"],polygon:["points"],polyline:["points"]};
export function parseIconSVG(xml,{arcTolerance=1e-4}={}){
 const root=nodes(xml),vb=(root.attrs.viewBox??"").trim().split(/[\s,]+/).map(Number);
 if(root.attrs.xmlns!=="http://www.w3.org/2000/svg"||vb.length!==4||!vb.every(Number.isFinite)||vb[2]<=0||vb[3]<=0)throw Error("Explicit SVG namespace and positive viewBox required");
 const ops=[];
 function visit(node,inherit){
  const {name,attrs,children}=node,keys=geometryKeys[name];if(!keys)throw Error("Unsupported SVG element "+name);
  for(const k of Object.keys(attrs))if(!keys.includes(k)&&!stateKeys.includes(k))throw Error("Unsupported SVG attribute "+k);
  const st={...inherit};for(const k of stateKeys)if(k in attrs)st[k]=attrs[k];
  if([st.opacity,st["fill-opacity"],st["stroke-opacity"]].some(v=>+v!==1)||[st.fill,st.stroke].some(v=>/url\(/.test(v)))throw Error("Only opaque solid silhouettes supported");
  if(!["round","butt","square"].includes(st["stroke-linecap"])||!["round","bevel","miter"].includes(st["stroke-linejoin"])||!["nonzero","evenodd"].includes(st["fill-rule"]))throw Error("Unsupported paint state");
  if(name==="svg"||name==="g"){for(const c of children)visit(c,st);return;}
  if(children.length)throw Error("Unexpected child");
  const n=(k,v=0)=>{const x=Number(attrs[k]??v);if(!Number.isFinite(x))throw Error("Invalid geometry "+k);return x;};
  let d;
  if(name==="path")d=attrs.d??"";
  else if(name==="circle"||name==="ellipse"){
   const x=n("cx"),y=n("cy"),rx=name==="circle"?n("r"):n("rx"),ry=name==="circle"?rx:n("ry");if(!(rx>0&&ry>0))throw Error("Invalid ellipse");
   d="M"+(x+rx)+" "+y+"A"+rx+" "+ry+" 0 0 1 "+(x-rx)+" "+y+"A"+rx+" "+ry+" 0 0 1 "+(x+rx)+" "+y+"Z";
  }else if(name==="rect"){
   const x=n("x"),y=n("y"),w=n("width"),h=n("height"),rx=Math.min(w/2,n("rx",n("ry"))),ry=Math.min(h/2,n("ry",n("rx")));if(!(w>0&&h>0)||rx<0||ry<0)throw Error("Invalid rect");
   d=rx&&ry?"M"+(x+rx)+" "+y+"H"+(x+w-rx)+"A"+rx+" "+ry+" 0 0 1 "+(x+w)+" "+(y+ry)+"V"+(y+h-ry)+"A"+rx+" "+ry+" 0 0 1 "+(x+w-rx)+" "+(y+h)+"H"+(x+rx)+"A"+rx+" "+ry+" 0 0 1 "+x+" "+(y+h-ry)+"V"+(y+ry)+"A"+rx+" "+ry+" 0 0 1 "+(x+rx)+" "+y+"Z":"M"+x+" "+y+"h"+w+"v"+h+"h"+(-w)+"Z";
  }else if(name==="line")d="M"+n("x1")+" "+n("y1")+"L"+n("x2")+" "+n("y2");
  else d="M"+attrs.points+(name==="polygon"?"Z":"");
  const subpaths=parsePath(d,{arcTolerance}),width=Number(st["stroke-width"]),miter=Number(st["stroke-miterlimit"]);
  if(!Number.isFinite(width)||width<0||!Number.isFinite(miter)||miter<1)throw Error("Invalid stroke state");
  if(subpaths.length)ops.push({subpaths,fill:st.fill!=="none",stroke:st.stroke!=="none"&&width>0,width,cap:st["stroke-linecap"],join:st["stroke-linejoin"],miter,rule:st["fill-rule"]});
 }
 visit(root,{fill:"black",stroke:"none","stroke-width":"1","stroke-linecap":"butt","stroke-linejoin":"miter","stroke-miterlimit":"4","fill-rule":"nonzero","fill-opacity":"1","stroke-opacity":"1",opacity:"1"});
 if(!ops.length)throw Error("Empty silhouette");return {viewBox:vb,ops,arcTolerance};
}
