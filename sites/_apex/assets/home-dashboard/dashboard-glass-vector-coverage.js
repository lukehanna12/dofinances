/* Native framebuffer-pixel final coverage from canonical SVG vectors.
 * The optical distance and haze textures do not participate in this mask. */
const assets=new Map(),CAPACITY=32;
const supported=new Set(["svg","g","path","circle","ellipse","rect","line","polygon","polyline"]);
const properties=["fill","stroke","stroke-width","stroke-linecap","stroke-linejoin","stroke-miterlimit","fill-rule","fill-opacity","stroke-opacity","opacity"];
function geometry(node){
 const p=new Path2D(),n=(key,def=0)=>node.hasAttribute(key)?Number(node.getAttribute(key)):def;
 switch(node.localName){
  case "path":return new Path2D(node.getAttribute("d")||"");
  case "circle":p.arc(n("cx"),n("cy"),Math.max(0,n("r")),0,Math.PI*2);p.closePath();return p;
  case "ellipse":p.ellipse(n("cx"),n("cy"),Math.max(0,n("rx")),Math.max(0,n("ry")),0,0,Math.PI*2);p.closePath();return p;
  case "rect":{
   const x=n("x"),y=n("y"),w=n("width"),h=n("height"),rx=Math.min(w/2,n("rx",n("ry"))),ry=Math.min(h/2,n("ry",n("rx")));
   if(rx>0&&ry>0){p.moveTo(x+rx,y);p.lineTo(x+w-rx,y);p.ellipse(x+w-rx,y+ry,rx,ry,0,-Math.PI/2,0);p.lineTo(x+w,y+h-ry);p.ellipse(x+w-rx,y+h-ry,rx,ry,0,0,Math.PI/2);p.lineTo(x+rx,y+h);p.ellipse(x+rx,y+h-ry,rx,ry,0,Math.PI/2,Math.PI);p.lineTo(x,y+ry);p.ellipse(x+rx,y+ry,rx,ry,0,Math.PI,1.5*Math.PI);p.closePath();}
   else p.rect(x,y,w,h);
   return p;
  }
  case "line":p.moveTo(n("x1"),n("y1"));p.lineTo(n("x2"),n("y2"));return p;
  case "polygon":case "polyline":{
   const a=(node.getAttribute("points")||"").trim().split(/[\s,]+/).map(Number);
   if(a.length>=2){p.moveTo(a[0],a[1]);for(let i=2;i+1<a.length;i+=2)p.lineTo(a[i],a[i+1]);}
   if(node.localName==="polygon")p.closePath();return p;
  }
  default:return null;
 }
}
export function parseSilhouetteSVG(text){
 const root=new DOMParser().parseFromString(text,"image/svg+xml").documentElement;
 if(root.namespaceURI!=="http://www.w3.org/2000/svg"||root.localName!=="svg")throw Error("Not an SVG asset");
 const vb=(root.getAttribute("viewBox")||"").trim().split(/[\s,]+/).map(Number);
 if(vb.length!==4||vb.some(v=>!Number.isFinite(v))||vb[2]<=0||vb[3]<=0)throw Error("SVG viewBox required");
 const ops=[];
 function visit(node,inherited){
  if(!supported.has(node.localName)||["transform","style","class","clip-path","mask","filter","vector-effect","stroke-dasharray"].some(a=>node.hasAttribute(a)))throw Error("Unsupported SVG coverage geometry");
  const s={...inherited};
  for(const key of properties)if(node.hasAttribute(key))s[key]=node.getAttribute(key);
  if(Number(s.opacity)!==1||[s.fill,s.stroke].some(v=>/url\(/.test(v)))throw Error("Unsupported SVG coverage paint");
  if(node.localName==="svg"||node.localName==="g"){for(const child of node.children)visit(child,s);return;}
  const path=geometry(node);
  if(path)ops.push({path,fill:s.fill!=="none",stroke:s.stroke!=="none",width:Number(s["stroke-width"]),cap:s["stroke-linecap"],join:s["stroke-linejoin"],miter:Number(s["stroke-miterlimit"]),rule:s["fill-rule"],fillAlpha:Number(s["fill-opacity"]),strokeAlpha:Number(s["stroke-opacity"])});
 }
 visit(root,{fill:"black",stroke:"none","stroke-width":"1","stroke-linecap":"butt","stroke-linejoin":"miter","stroke-miterlimit":"4","fill-rule":"nonzero","fill-opacity":"1","stroke-opacity":"1",opacity:"1"});
 if(!ops.length)throw Error("Empty SVG silhouette");
 return {viewBox:vb,ops};
}
function requestVectorCoverage(img,wake){
 const src=img.currentSrc||img.src;if(!src)return null;
 let entry=assets.get(src);
 if(!entry){
  entry={status:"pending",model:null};assets.set(src,entry);
  fetch(src,{credentials:"same-origin"}).then(r=>{if(!r.ok)throw Error("SVG fetch failed");return r.text();})
   .then(text=>{entry.model=parseSilhouetteSVG(text);entry.status="ready";})
   .catch(error=>{entry.status="unsupported";entry.error=String(error);})
   .finally(wake);
 }
 return entry;
}
// Match vsGlass owner translation and dismissal scale. Keep the actual
// fractional framebuffer pixel phase rather than stretching a cached bitmap.
export function coverageGeometry(bounds,ownerRect,dismiss=0){
 const t=Math.max(0,Math.min(1,dismiss)),b=t*t*(3-2*t),sx=1+.085*b,sy=1+.065*b;
 const [ox,oy,ow,oh]=ownerRect,[x,y,w,h]=bounds;
 const left=ox+ow*.5+(x-ow*.5)*sx,top=oy+oh*.5+(y-oh*.5)*sy;
 const pw=w*sx,ph=h*sy,ix=Math.floor(left)-1,iy=Math.floor(top)-1;
 const phaseX=left-ix,phaseY=top-iy,width=Math.ceil(phaseX+pw)+1,height=Math.ceil(phaseY+ph)+1;
 return {width,height,pw,ph,w,h,phaseX,phaseY,sx,sy,rect:[x-phaseX/sx,y-phaseY/sy,sx,sy]};
}
function paintCoverage(model,g){
 const canvas=document.createElement("canvas");canvas.width=g.width;canvas.height=g.height;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)throw Error("No vector coverage context");
 try{
  const [vx,vy,vw,vh]=model.viewBox;
  const s=Math.min(g.w/vw,g.h/vh);
  // Preserve the owner's anisotropic dismissal transform, after fitting SVG.
  ctx.setTransform(s*g.sx,0,0,s*g.sy,g.phaseX+((g.w-vw*s)/2-vx*s)*g.sx,g.phaseY+((g.h-vh*s)/2-vy*s)*g.sy);
  ctx.fillStyle=ctx.strokeStyle="#fff";
  for(const op of model.ops){
   if(op.fill){ctx.globalAlpha=op.fillAlpha;ctx.fill(op.path,op.rule);}
   if(op.stroke&&op.width>0){ctx.globalAlpha=op.strokeAlpha;ctx.lineWidth=op.width;ctx.lineCap=op.cap;ctx.lineJoin=op.join;ctx.miterLimit=op.miter;ctx.stroke(op.path);}
  }
  const rgba=ctx.getImageData(0,0,g.width,g.height).data,alpha=new Uint8Array(g.width*g.height);
  for(let i=0;i<alpha.length;i++)alpha[i]=rgba[4*i+3];
  return alpha;
 }finally{canvas.width=canvas.height=0;}
}
export function createVectorCoverageAtlas(device,wake){
 const placeholder=device.createTexture({size:[1,1,1],format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING});
 let texture=null,view=placeholder.createView({dimension:"2d-array"}),side=0,uploads=0;
 const keys=new Map();
 function ensure(size){
  if(texture&&size<=side)return;
  const old=texture,previous=side;side=Math.max(64,2**Math.ceil(Math.log2(size)));
  texture=device.createTexture({label:"Native-pixel SVG final coverage",size:[side,side,CAPACITY],format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC});
  if(old){const encoder=device.createCommandEncoder();encoder.copyTextureToTexture({texture:old},{texture},[previous,previous,CAPACITY]);device.queue.submit([encoder.finish()]);old.destroy();}
  view=texture.createView({dimension:"2d-array"});
 }
 function sync(img,slot,bounds,ownerRect,dismiss){
  const entry=requestVectorCoverage(img,wake);
  if(entry?.status!=="ready"||slot<0||slot>=CAPACITY)return null;
  const g=coverageGeometry(bounds,ownerRect,dismiss),size=Math.max(g.width,g.height);
  if(!Number.isFinite(size)||size>device.limits.maxTextureDimension2D)return null;
  try{
   ensure(size);
   // Reuse unchanged raster across whole-pixel translations. Tolerance
   // of 1/256 physical px prevents float-noise churn.
   const q=v=>Math.round(v*256);
   const key=[img.currentSrc||img.src,g.width,g.height,q(g.w),q(g.h),q(g.sx*256),q(g.sy*256),q(g.phaseX),q(g.phaseY)].join("|");
   const prev=keys.get(slot);
   if(prev===key)return {rect:g.rect,meta:[slot+1,g.width,g.height,0]};
   const alpha=paintCoverage(entry.model,g);
   device.queue.writeTexture({texture,origin:[0,0,slot]},alpha,{bytesPerRow:g.width,rowsPerImage:g.height},[g.width,g.height,1]);
   keys.set(slot,key);uploads++;
   return {rect:g.rect,meta:[slot+1,g.width,g.height,0]};
  }catch(error){console.warn("SVG final coverage:",String(error));return null;}
 }
 return {get view(){return view;},sync,stats(){return {coverageMode:"canonical-svg-native-pixel",coverageUploads:uploads,coverageSide:side,coverageBytes:side*side*CAPACITY};},
  dispose(){texture?.destroy();placeholder.destroy();keys.clear();}};
}
