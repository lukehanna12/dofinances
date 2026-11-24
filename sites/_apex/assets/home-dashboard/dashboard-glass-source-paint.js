/**
 * Shared authored source compositor. DOM supplies geometry and semantic UI;
 * only registered font glyphs, flat colors, decoded assets and SVG paths
 * are rasterized into a transparent source sprite. No page/screen capture,
 * rendered glass readback, backdrop filter or CPU optical computation.
 */
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const num=(v,f=0)=>Number.isFinite(parseFloat(v))?parseFloat(v):f;
const q=v=>Math.round(v*64)/64;
const positive=r=>r.width>0&&r.height>0;
const colorVisible=v=>v&&v!=="none"&&v!=="transparent"&&v!=="rgba(0, 0, 0, 0)";
function alphaThrough(node,stop=null){
 let a=1;
 for(let el=node;el&&el!==stop;el=el.parentElement){
  const s=getComputedStyle(el);
  if(el.hidden||s.display==="none"||s.visibility==="hidden"||s.visibility==="collapse")return 0;
  a*=clamp(num(s.opacity,1));if(a<=.0001)return 0;
 }
 return a;
}
export function registerGlassPaint(node,placement="foreground"){
 if(!node?.setAttribute||!["scene","foreground"].includes(placement))throw TypeError("Invalid authored glass source");
 node.setAttribute("data-glass-paint",placement);return node;
}
export function sourceNodesForPane(pane){
 if(!pane)return [];
 const owners="[data-public-project-glass],[data-auth-glass-card],[data-auth-glass-input],[data-auth-glass-submit],[data-auth-glass-provider],[data-home-cta-glass],[data-glass-dropdown]";
 return [...pane.querySelectorAll('[data-glass-paint="foreground"]')].filter(n=>n.closest(owners)===pane);
}
export function physicalSourceRect(rect,viewport){
 return [(rect[0]-(viewport.left||0))*viewport.dpr,(rect[1]-viewport.top)*viewport.dpr,rect[2]*viewport.dpr,rect[3]*viewport.dpr];
}
function textShadow(s){
 if(!s||s==="none")return null;
 const m=s.match(/^(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/i);
 return m?[m[1],+m[2],+m[3],+(m[4]||0)]:null;
}
function textFragments(node){
 const text=node.nodeValue||"";
 if(!text.trim())return [];
 const range=document.createRange();range.selectNodeContents(node);
 const rects=[...range.getClientRects()].filter(positive);
 if(rects.length<=1)return rects.length?[{text,rect:rects[0]}]:[];
 const lines=[];
 for(let i=0;i<text.length;){
  const char=String.fromCodePoint(text.codePointAt(i)),end=i+char.length;
  range.setStart(node,i);range.setEnd(node,end);
  const r=range.getBoundingClientRect();i=end;
  if(!positive(r))continue;
  const last=lines.at(-1);
  if(last&&Math.abs(last.rect.top-r.top)<.5){
   last.text+=char;const a=last.rect,l=Math.min(a.left,r.left),t=Math.min(a.top,r.top);
   last.rect={left:l,top:t,width:Math.max(a.left+a.width,r.right)-l,height:Math.max(a.top+a.height,r.bottom)-t};
  }else lines.push({text:char,rect:r});
 }
 return lines;
}
function svgGeometry(el){
 const a=k=>num(el.getAttribute(k));
 switch(el.localName){
 case "path":return ["path",el.getAttribute("d")||""];
 case "circle":return ["ellipse",a("cx"),a("cy"),a("r"),a("r")];
 case "ellipse":return ["ellipse",a("cx"),a("cy"),a("rx"),a("ry")];
 case "rect":return ["rect",a("x"),a("y"),a("width"),a("height"),a("rx")||a("ry")];
 case "line":return ["points",[a("x1"),a("y1"),a("x2"),a("y2")],false];
 case "polyline":case "polygon":return ["points",(el.getAttribute("points")||"").trim().split(/[ ,]+/).map(Number),el.localName==="polygon"];
 default:return null;
 }
}
function makePath(g){
 if(g[0]==="path")return new Path2D(g[1]);
 const p=new Path2D();
 if(g[0]==="ellipse")p.ellipse(g[1],g[2],Math.max(0,g[3]),Math.max(0,g[4]),0,0,Math.PI*2);
 if(g[0]==="rect")p.roundRect(g[1],g[2],g[3],g[4],Math.max(0,g[5]));
 if(g[0]==="points"&&g[1].length>=2){
  p.moveTo(g[1][0],g[1][1]);for(let i=2;i+1<g[1].length;i+=2)p.lineTo(g[1][i],g[1][i+1]);if(g[2])p.closePath();
 }
 return p;
}
function snapshot(node){
 const r=node.getBoundingClientRect(),a=alphaThrough(node);
 if(!positive(r)||a<=.0001||r.right<0||r.left>innerWidth||r.bottom<0||r.top>innerHeight)return null;
 const style=getComputedStyle(node);
 const w=node.offsetWidth||num(style.width,r.width)||r.width;
 const h=node.offsetHeight||num(style.height,r.height)||r.height;
 const sx=r.width/w,sy=r.height/h;
 if(!(sx>0&&sy>0))return null;
 const clipOwner=node.closest(".project-showcase-card");
 const pad=clipOwner?0:Math.ceil(Math.max(4,num((style.filter.match(/blur\(([\d.]+)px\)/)||[])[1])*3,(textShadow(style.textShadow)?.[3]||0)*3+3));
 const local=b=>[q((b.left-r.left)/sx),q((b.top-r.top)/sy),q(b.width/sx),q(b.height/sy)];
 const ops=[],images=[];
 function walk(el,inherited){
  const s=getComputedStyle(el);
  if(el.hidden||s.display==="none"||s.visibility==="hidden"||s.visibility==="collapse")return;
  const alpha=el===node?inherited:inherited*clamp(num(s.opacity,1));
  if(alpha<=.0001)return;
  const b=el.getBoundingClientRect();
  if(!positive(b)&&s.display!=="contents")return;
  if(positive(b)&&colorVisible(s.backgroundColor)){
   const rect=local(b),rad=s.borderTopLeftRadius.endsWith("%")?Math.min(rect[2],rect[3])*num(s.borderTopLeftRadius)/100:num(s.borderTopLeftRadius);
   ops.push({kind:"fill",rect,radius:Math.min(rad,rect[2]/2,rect[3]/2),color:s.backgroundColor,alpha});
  }
  if(el.localName==="img"){
   if(!el.complete||!el.naturalWidth)return;
   const index=images.push(el)-1;
   ops.push({kind:"image",index,src:el.currentSrc||el.src,rect:local(b),fit:s.objectFit,natural:[el.naturalWidth,el.naturalHeight],filter:s.filter,alpha});
   return;
  }
  if(el.localName==="svg"){
   for(const shape of el.querySelectorAll("path,circle,ellipse,rect,line,polyline,polygon")){
    const g=svgGeometry(shape),m=shape.getScreenCTM(),ss=getComputedStyle(shape);
    if(!g||!m||ss.display==="none"||ss.visibility==="hidden")continue;
    const opacity=alpha*alphaThrough(shape,el);
    if(opacity<=.0001)continue;
    ops.push({kind:"svg",geometry:g,matrix:[q(m.a/sx),q(m.b/sy),q(m.c/sx),q(m.d/sy),q((m.e-r.left)/sx),q((m.f-r.top)/sy)],
     fill:ss.fill,stroke:ss.stroke,fillOpacity:num(ss.fillOpacity,1),strokeOpacity:num(ss.strokeOpacity,1),
     strokeWidth:num(ss.strokeWidth,1),cap:ss.strokeLinecap,join:ss.strokeLinejoin,rule:ss.fillRule,alpha:opacity});
   }
   return;
  }
  for(const child of el.childNodes){
   if(child.nodeType===3){
    for(const f of textFragments(child))ops.push({kind:"text",text:f.text,rect:local(f.rect),
     font:[s.fontStyle,s.fontWeight,s.fontSize,s.fontFamily].join(" "),color:s.color,spacing:s.letterSpacing,
     shadow:textShadow(s.textShadow),direction:s.direction,alpha});
   }else if(child.nodeType===1)walk(child,alpha);
  }
 }
 walk(node,1);
 const clip=clipOwner?{rect:local(clipOwner.getBoundingClientRect()),radius:num(getComputedStyle(clipOwner).borderTopLeftRadius)}:null;
 return {rect:[r.left-pad*sx,r.top-pad*sy,r.width+2*pad*sx,r.height+2*pad*sy],
  w:w+2*pad,h:h+2*pad,pad,alpha:a,ops,images,clip,filter:node.localName==="img"?"none":style.filter};
}
function paintRaster(s,dpr){
 const w=Math.max(1,Math.ceil(s.w*dpr)),h=Math.max(1,Math.ceil(s.h*dpr));
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw Error("Authored glyph raster context unavailable");
 ctx.setTransform(dpr,0,0,dpr,s.pad*dpr,s.pad*dpr);
 for(const op of s.ops){
  ctx.save();ctx.globalAlpha=op.alpha;
  const b=op.rect;
  if(op.kind==="fill"){
   ctx.fillStyle=op.color;ctx.beginPath();ctx.roundRect(...b,op.radius);ctx.fill();
  }else if(op.kind==="text"){
   ctx.font=op.font;ctx.fillStyle=op.color;ctx.textBaseline="alphabetic";ctx.textAlign="left";
   if("letterSpacing" in ctx)ctx.letterSpacing=op.spacing==="normal"?"0px":op.spacing;
   if("direction" in ctx)ctx.direction=op.direction||"ltr";
   if(op.shadow){ctx.shadowColor=op.shadow[0];ctx.shadowOffsetX=op.shadow[1]*dpr;ctx.shadowOffsetY=op.shadow[2]*dpr;ctx.shadowBlur=op.shadow[3]*dpr;}
   const m=ctx.measureText(op.text),asc=m.fontBoundingBoxAscent||m.actualBoundingBoxAscent||0,desc=m.fontBoundingBoxDescent||m.actualBoundingBoxDescent||0;
   ctx.fillText(op.text,b[0],b[1]+(b[3]-asc-desc)*.5+asc);
  }else if(op.kind==="image"){
   ctx.filter=op.filter||"none";
   let [x,y,width,height]=b;
   if(op.fit==="contain"||op.fit==="scale-down"){
    const f=Math.min(width/op.natural[0],height/op.natural[1],op.fit==="scale-down"?1:Infinity);
    const nw=op.natural[0]*f,nh=op.natural[1]*f;x+=(width-nw)/2;y+=(height-nh)/2;width=nw;height=nh;
   }
   ctx.drawImage(s.images[op.index],x,y,width,height);
  }else if(op.kind==="svg"){
   ctx.transform(...op.matrix);
   const p=makePath(op.geometry);
   if(colorVisible(op.fill)){ctx.globalAlpha=op.alpha*op.fillOpacity;ctx.fillStyle=op.fill;ctx.fill(p,op.rule==="evenodd"?"evenodd":"nonzero");}
   if(colorVisible(op.stroke)&&op.strokeWidth>0){
    ctx.globalAlpha=op.alpha*op.strokeOpacity;ctx.strokeStyle=op.stroke;ctx.lineWidth=op.strokeWidth;
    ctx.lineCap=op.cap;ctx.lineJoin=op.join;ctx.stroke(p);
   }
  }
  ctx.restore();
 }
 if(s.filter!=="none"||s.clip){
  const result=document.createElement("canvas");result.width=w;result.height=h;
  const out=result.getContext("2d",{willReadFrequently:true});
  if(s.clip){
   out.setTransform(dpr,0,0,dpr,s.pad*dpr,s.pad*dpr);out.beginPath();
   out.roundRect(...s.clip.rect,s.clip.radius);out.clip();out.setTransform(1,0,0,1,0,0);
  }
  if(s.filter!=="none")out.filter=s.filter.replace(/blur\(([\d.]+)px\)/g,(_,v)=>"blur("+(+v*dpr)+"px)");
  out.drawImage(canvas,0,0);canvas.width=canvas.height=0;return result;
 }
 return canvas;
}
// Premultiplied source-over of authored source pixels. All glass optics
// remain entirely in the original shared WGSL shader.
const SHADER=[
 "struct Source {rect:vec4<f32>, viewport:vec4<f32>};",
 "@group(0) @binding(0) var<uniform> source:Source;",
 "@group(0) @binding(1) var paint:texture_2d<f32>;",
 "@group(0) @binding(2) var smp:sampler;",
 "struct V {@builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32>};",
 "@vertex fn vsSource(@builtin(vertex_index) i:u32)->V{",
 " let corners=array<vec2<f32>,6>(vec2<f32>(0,0),vec2<f32>(1,0),vec2<f32>(0,1),vec2<f32>(0,1),vec2<f32>(1,0),vec2<f32>(1,1));",
 " let uv=corners[i];let p=source.rect.xy+uv*source.rect.zw;",
 " var o:V;o.pos=vec4<f32>(2.0*p.x/source.viewport.x-1.0,1.0-2.0*p.y/source.viewport.y,0,1);o.uv=uv;return o;}",
 "@fragment fn fsSource(v:V)->@location(0) vec4<f32>{return textureSample(paint,smp,v.uv)*source.viewport.z;}"
].join("\n");
export function createGlassSourcePainter(device,displayFormat){
 const module=device.createShaderModule({label:"Authored source compositing, no optics",code:SHADER});
 const blend={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}};
 const layout=device.createBindGroupLayout({entries:[
  {binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},
  {binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},
  {binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}
 ]});
 const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
 const make=format=>device.createRenderPipeline({label:"Authored foreground source "+format,layout:pipelineLayout,
  vertex:{module,entryPoint:"vsSource"},fragment:{module,entryPoint:"fsSource",targets:[{format,blend}]},
  primitive:{topology:"triangle-list"}});
 const screen=make(displayFormat),offscreen=make("rgba16float");
 const sampler=device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});
 const cache=new Map();
 let rasterUploads=0,draws=0,serial=0;
 const release=e=>{e.texture?.destroy();for(const b of e.buffers.values())b.destroy();};
 function sync(node,placement,views){
  let e=cache.get(node);
  const s=snapshot(node);
  if(!s||!s.ops.length){node.removeAttribute("data-glass-paint-owned");return null;}
  const dpr=views.scene.dpr;
  const key=JSON.stringify([q(s.w),q(s.h),s.pad,dpr,s.ops,s.clip,s.filter]);
  if(!e){e={key:null,texture:null,buffers:new Map(),groups:new Map(),revision:0};cache.set(node,e);}
  if(e.key!==key){
   const raster=paintRaster(s,dpr),width=raster.width,height=raster.height;
   if(width>device.limits.maxTextureDimension2D||height>device.limits.maxTextureDimension2D)throw Error("Source paint texture exceeds GPU limit");
   if(!e.texture||width!==e.width||height!==e.height){
    e.texture?.destroy();e.texture=device.createTexture({label:"Authored transparent foreground source",
     size:[width,height,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
    e.width=width;e.height=height;e.groups.clear();
   }
   try{device.queue.copyExternalImageToTexture({source:raster},{texture:e.texture,premultipliedAlpha:true},[width,height]);}
   catch{
    // This reads only our own authored glyph/vector/image source raster.
    const raw=raster.getContext("2d").getImageData(0,0,width,height).data;
    const row=Math.ceil(width*4/256)*256,bytes=new Uint8Array(row*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     const a=(y*width+x)*4,b=y*row+x*4,alpha=raw[a+3];
     bytes[b]=Math.round(raw[a]*alpha/255);bytes[b+1]=Math.round(raw[a+1]*alpha/255);bytes[b+2]=Math.round(raw[a+2]*alpha/255);bytes[b+3]=alpha;
    }
    device.queue.writeTexture({texture:e.texture},bytes,{bytesPerRow:row,rowsPerImage:height},[width,height,1]);
   }
   raster.width=raster.height=0;e.key=key;e.revision=++serial;rasterUploads++;
  }
  for(const [name,v] of Object.entries(views)){
   if(!v.width||!v.height)continue;
   if(!e.buffers.has(name))e.buffers.set(name,device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));
   const b=e.buffers.get(name);
   if(!e.groups.has(name))e.groups.set(name,device.createBindGroup({layout,entries:[
    {binding:0,resource:{buffer:b}},{binding:1,resource:e.texture.createView()},{binding:2,resource:sampler}]}));
   device.queue.writeBuffer(b,0,new Float32Array([...physicalSourceRect(s.rect,v),v.width,v.height,s.alpha,0]));
  }
  e.rect=s.rect;e.alpha=s.alpha;e.placement=placement;e.ops=s.ops.length;
  // Only duplicate paint is suppressed; the HTML layout and semantics stay.
  if(node.getAttribute("data-glass-paint-owned")!==placement)node.setAttribute("data-glass-paint-owned",placement);
  return e;
 }
 function draw(pass,entries,view="scene",target="screen"){
  const available=entries.filter(e=>e?.groups.has(view));
  if(!available.length)return false;
  pass.setPipeline(target==="offscreen"?offscreen:screen);
  for(const e of available){pass.setBindGroup(0,e.groups.get(view));pass.draw(6);draws++;}
  return true;
 }
 return {
  sync,draw,
  sweep(){for(const [n,e] of cache)if(!n.isConnected||!n.hasAttribute("data-glass-paint")){release(e);cache.delete(n);n.removeAttribute("data-glass-paint-owned");}},
  invalidate(){for(const e of cache.values())e.key=null;},
  stats(){return {rasterUploads,draws,cached:cache.size,textureBytes:[...cache.values()].reduce((a,e)=>a+(e.width||0)*(e.height||0)*4,0)};},
  dispose(){for(const [n,e] of cache){n.removeAttribute("data-glass-paint-owned");release(e);}cache.clear();}
 };
}
