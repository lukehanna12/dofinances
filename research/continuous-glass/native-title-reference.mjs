// Independent Float64 signed distance reference for the union-corrected
// native word geometry. Adaptively flatten native polynomial segments,
// then evaluate exact Euclidean segment distance and half-open parity.
function flatten(s,err=.002){
 if(s.length===2)return [s];
 const a=s[0],b=s.at(-1),n=s.length-1;
 // Control-hull bound for deviation from the parameterized chord.
 const dev=Math.max(...s.slice(1,-1).map((p,i)=>{const t=(i+1)/n;return Math.hypot(p[0]-a[0]-(b[0]-a[0])*t,p[1]-a[1]-(b[1]-a[1])*t);}));
 if(dev<=err)return [[a,b]];
 let row=s.slice(),l=[a],r=[b];while(row.length>1){row=row.slice(1).map((q,i)=>[(q[0]+row[i][0])/2,(q[1]+row[i][1])/2]);l.push(row[0]);r.push(row.at(-1));}
 return [...flatten(l,err),...flatten(r.reverse(),err)];
}
export function makeIndependentSegmentDistance(contours,err=.002){
 const edges=contours.flatMap(c=>c.flatMap(s=>flatten(s,err))).map(([a,b])=>{
  const dx=b[0]-a[0],dy=b[1]-a[1];return {x:a[0],y:a[1],dx,dy,inv:dx*dx+dy*dy>0?1/(dx*dx+dy*dy):0,loX:Math.min(a[0],b[0]),hiX:Math.max(a[0],b[0]),loY:Math.min(a[1],b[1]),hiY:Math.max(a[1],b[1])};
 });
 function build(edges){
  const a={loX:Math.min(...edges.map(e=>e.loX)),hiX:Math.max(...edges.map(e=>e.hiX)),loY:Math.min(...edges.map(e=>e.loY)),hiY:Math.max(...edges.map(e=>e.hiY))};
  if(edges.length<=8)return {...a,edges};const axis=a.hiX-a.loX>=a.hiY-a.loY?"X":"Y";
  edges.sort((a,b)=>a["lo"+axis]+a["hi"+axis]-b["lo"+axis]-b["hi"+axis]);const m=edges.length>>1;
  return {...a,left:build(edges.slice(0,m)),right:build(edges.slice(m))};
 }
 const root=build(edges),lower=(a,x,y)=>{const dx=Math.max(a.loX-x,0,x-a.hiX),dy=Math.max(a.loY-y,0,y-a.hiY);return dx*dx+dy*dy;};
 function distance(x,y){
  let best=Infinity,inside=false,stack=[root];
  while(stack.length){const node=stack.pop(),ray=y>=node.loY&&y<node.hiY&&x<node.hiX,near=lower(node,x,y)<best;
   if(!ray&&!near)continue;
   if(node.edges){for(const e of node.edges){
    if(ray&&y>=e.loY&&y<e.hiY&&e.dy!==0&&e.x+(y-e.y)*e.dx/e.dy>x)inside=!inside;
    if(near){const u=x-e.x,v=y-e.y,t=Math.max(0,Math.min(1,(u*e.dx+v*e.dy)*e.inv)),dx=u-t*e.dx,dy=v-t*e.dy;best=Math.min(best,dx*dx+dy*dy);}
   }}else if(lower(node.left,x,y)<lower(node.right,x,y))stack.push(node.right,node.left);else stack.push(node.left,node.right);
  }
  return (inside?-1:1)*Math.sqrt(best);
 }
 return {distance,edgeCount:edges.length};
}export function nativeWordDistance(native,text,style,logicalHeight){
 const size=parseFloat(style.fontSize),sample=[...native.samples,...native.heldout].find(x=>x.size===size);
 if(!sample)throw Error("Exact native size missing");
 const c=document.createElement("canvas").getContext("2d");c.font=style.fontStyle+" "+style.fontWeight+" "+style.fontSize+" "+style.fontFamily;c.letterSpacing=style.letterSpacing;c.fontKerning=style.fontKerning||"auto";
 const m=c.measureText(text),baseline=(logicalHeight-m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)*.5+m.fontBoundingBoxAscent;
 const positions=[...text].map((ch,i)=>c.measureText(text.slice(0,i+1)).width-c.measureText(ch).width);
 const contours=sample.paths.flatMap((glyph,i)=>glyph.map(c=>c.map(s=>s.map(p=>[positions[i]+p[0]*size,baseline+p[1]*size]))));
 return makeIndependentSegmentDistance(contours,.002);
}

export function referenceTitleField(native,text,style,w,h,dpr,alpha,phase=[.5,.5],bounded=false){
 const ref=nativeWordDistance(native,text,style,parseFloat(style.lineHeight)),d=ref.distance,out=new Float32Array(w*h*4),dv=new DataView(alpha.pixels.buffer,alpha.pixels.byteOffset,alpha.pixels.byteLength);
 const get=(x,y)=>dv.getFloat16((Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*8+6,true);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const j=(y*w+x)*4,a=get(x,y);let near=a;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near=Math.max(near,get(x+dx,y+dy));
  if(near<=0){out[j]=1000;continue;}
  const u=(x+phase[0])/dpr,v=(y+phase[1])/dpr,dx=d(u+.5,v)-d(u-.5,v),dy=d(u,v+.5)-d(u,v-.5),n=Math.max(bounded?1:1e-6,Math.hypot(dx,dy));
  out[j]=d(u,v)*dpr;out[j+1]=dx/n;out[j+2]=dy/n;out[j+3]=a;
 }
 return {out,edgeCount:ref.edgeCount};
}
