/* Experimental compositor-owned refraction.
 *
 * Computes the same mode-4 supercircle normal, inner/outer refraction
 * envelopes and 0.300048828125 mix weight as dashboard-gpu-glass.wgsl.
 * It provides those scroll-independent optical fields as data textures to
 * SVG feDisplacementMap. backdrop-filter supplies the *actual* composited
 * background pixels on each native scroll, without a JavaScript scroll
 * callback or a second scrolling photo framebuffer.
 *
 * This is NOT mathematically pixel-identical to WebGPU's per-fragment mip
 * LOD and half-float sampling. Browser support for backdrop-filter:url()
 * (notably Safari/WebKit) also differs. Keep it opt-in until validated.
 *
 * The generated PNGs contain optical field coordinates ONLY; they never
 * capture page pixels, screen pixels, wallpaper imagery or user content.
 */
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const NS="http://www.w3.org/2000/svg";
const MAP_SCALE=128;
const MIX_A=0.300048828125;
function supercircle(ax,ay,hw,hh,r){
  if(r===0)return [Math.max(ax-hw,ay-hh),ax>=hw?1:0,ay>=hh?1:0];
  const ar=Math.abs(r),k=ar*1.5286649465560913;
  const qx=ax-hw,qy=ay-hh;
  const hx=qx+k,hy=qy+k;
  const nx0=Math.max(0,(qx+k)/k),ny0=Math.max(0,(qy+k)/k);
  const rad=Math.hypot(nx0,ny0);
  const big=Math.max(nx0,ny0),small=Math.min(nx0,ny0);
  const u=big>0?clamp(small/big):0;
  const polynomial=(((3.1560099124908447-u*.9260540008544922)*u
    -3.6412200927734375)*u+1.268030047416687)*u+.2685309946537018;
  const denom=1-u*u*clamp(rad)*polynomial;
  const inverse=denom!==0?1/denom:0;
  const rounded=rad+1-inverse;
  const q2x=Math.max(0,nx0*1.5286649465560913-.5286650061607361);
  const q2y=Math.max(0,ny0*1.5286649465560913-.5286650061607361);
  const smooth=Math.hypot(q2x,q2y)*.6541655659675598+.3458344340324402;
  const sign=ny0>nx0?1:-1,control=clamp(.5-sign+sign*u);
  const signed=k*(mix(rounded,smooth,control)-1);
  const d=Math.min(Math.max(hx,hy),0)+signed;
  const n=[Math.max(hx,0),Math.max(hy,0)],len=Math.hypot(...n);
  if(len>0)return [d,n[0]/len,n[1]/len];
  return [d,hx>hy?1:0,hx>hy?0:1];
}
export function originalMode4Field(x,y,width,height,radius){
  const px=x-width*.5,py=height*.5-y;
  const sc=supercircle(Math.abs(px),Math.abs(py),width*.5,height*.5,radius);
  return [sc[0],sc[1]*(px>=0?1:-1),-sc[2]*(py>=0?1:-1)];
}
export function originalRefractionEnvelope(distance,amount,invHeight){
  const t=clamp(-distance*invHeight);
  return amount*(1-Math.sqrt(clamp((2-t)*t)));
}
export function originalOpticalDisplacement(x,y,width,height,radius,materialSize=100,deviceScale=1){
  // The WGSL shader works in physical pixels, not CSS pixels. In particular,
  // its inner-refraction cap is 60 PHYSICAL pixels on a Retina Mac. Return
  // CSS-pixel offsets for SVG feDisplacementMap only after computing the
  // SDF/envelopes in the matching original physical-pixel geometry.
  const scale=Number.isFinite(deviceScale)&&deviceScale>0?deviceScale:1;
  const [signed,nx,ny]=originalMode4Field(x*scale,y*scale,
    width*scale,height*scale,radius*scale);
  const d=materialSize*scale;
  const inner=originalRefractionEnvelope(signed,Math.max(-60,-.8*d),
    1/Math.min(20,.25*d));
  const outer=originalRefractionEnvelope(signed,.2*d,1/(.125*d));
  return {inner:[nx*inner/scale,ny*inner/scale],
    outer:[nx*outer/scale,ny*outer/scale],
    weight:MIX_A*clamp((signed+1)*2),signed};
}
function svgElement(name,attrs={}){
  const el=document.createElementNS(NS,name);
  for(const [name,value] of Object.entries(attrs))el.setAttribute(name,String(value));
  return el;
}
function pixelMap(width,height,radius,materialSize,deviceScale){
  // One optical texel per 1-2 CSS px; the native compositor interpolates
  // maps during scrolling and never waits for per-frame bitmap revisions.
  const scale=Math.min(1,512/Math.max(width,height));
  const w=Math.max(4,Math.ceil(width*scale));
  const h=Math.max(4,Math.ceil(height*scale));
  const result={inner:new Uint8ClampedArray(w*h*4),
    outer:new Uint8ClampedArray(w*h*4),
    alpha:new Uint8ClampedArray(w*h*4)};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=originalOpticalDisplacement((x+.5)*width/w,(y+.5)*height/h,
      width,height,radius,materialSize,deviceScale);
    const i=(y*w+x)*4;
    for(const role of ["inner","outer"]){
      const d=p[role],a=result[role];
      a[i]=Math.round(255*clamp(.5+d[0]/MAP_SCALE));
      a[i+1]=Math.round(255*clamp(.5+d[1]/MAP_SCALE));
      a[i+2]=128;a[i+3]=255;
    }
    const a=result.alpha,v=Math.round(255*p.weight);
    a[i]=v;a[i+1]=v;a[i+2]=v;a[i+3]=v;
  }
  const cvs=document.createElement("canvas");cvs.width=w;cvs.height=h;
  const ctx=cvs.getContext("2d",{willReadFrequently:false});
  if(!ctx)throw Error("Optical map 2D context unavailable");
  return Object.fromEntries(Object.entries(result).map(([key,bytes])=>{
    ctx.putImageData(new ImageData(bytes,w,h),0,0);
    return [key,cvs.toDataURL("image/png")];
  }));
}
function makeFilter(id,width,height,maps){
  const extend=MAP_SCALE/2+8;
  const filter=svgElement("filter",{id,filterUnits:"userSpaceOnUse",
    primitiveUnits:"userSpaceOnUse",x:-extend,y:-extend,
    width:width+2*extend,height:height+2*extend,
    "color-interpolation-filters":"sRGB"});
  const image=(source,result)=>svgElement("feImage",{
    href:maps[source],x:0,y:0,width,height,
    preserveAspectRatio:"none",result
  });
  filter.append(image("inner","innerMap"));
  filter.append(svgElement("feDisplacementMap",{
    in:"SourceGraphic",in2:"innerMap",scale:MAP_SCALE,
    xChannelSelector:"R",yChannelSelector:"G",result:"innerRefracted"
  }));
  filter.append(image("outer","outerMap"));
  filter.append(svgElement("feDisplacementMap",{
    in:"SourceGraphic",in2:"outerMap",scale:MAP_SCALE,
    xChannelSelector:"R",yChannelSelector:"G",result:"outerRefracted"
  }));
  filter.append(image("alpha","mixMap"));
  filter.append(svgElement("feComposite",{
    in:"outerRefracted",in2:"mixMap",operator:"in",result:"outerWeighted"
  }));
  const inverse=svgElement("feComponentTransfer",{
    in:"mixMap",result:"inverseMix"
  });
  inverse.append(svgElement("feFuncA",{type:"table",tableValues:"1 0"}));
  filter.append(inverse);
  filter.append(svgElement("feComposite",{
    in:"innerRefracted",in2:"inverseMix",operator:"in",result:"innerWeighted"
  }));
  // feMerge uses source-over and would inadvertently square the first
  // weight. Arithmetic add gives the exact (1-w)*inner+w*outer mixing
  // of the old shader's two sample contributions (up to SVG precision).
  filter.append(svgElement("feComposite",{
    in:"innerWeighted",in2:"outerWeighted",operator:"arithmetic",
    k1:0,k2:1,k3:1,k4:0,result:"refracted"
  }));
  // Dark-face matrix from the original WGSL: face=0.05+0.75*glass,
  // applied to the browser-composited pixels, not a captured GPU photo.
  filter.append(svgElement("feColorMatrix",{
    in:"refracted",type:"matrix",result:"glassFace",
    values:".75 0 0 0 .05  0 .75 0 0 .05  0 0 .75 0 .05  0 0 0 1 0"
  }));
  return filter;
}
export function initCompositedRefraction(){
  if(typeof document==="undefined"||
     document.body.dataset.authGlassFilter!=="refraction")return ()=>{};
  // Safari/WebKit currently accepts some SVG URL filter syntax without
  // actually applying feDisplacementMap to backdrop pixels. Only enable
  // this opt-in implementation on Chromium-family rendering engines until
  // filter primitive support is confirmed on other native compositors.
  const chromium=/(?:Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent);
  const modeSupported=chromium&&CSS.supports("backdrop-filter",'url("#probe")');
  document.body.dataset.authRefractiveStatus=modeSupported?"initializing":"unsupported";
  if(!modeSupported)return ()=>{};
  const host=svgElement("svg",{
    id:"dof-native-refraction-defs","aria-hidden":"true",width:0,height:0
  });
  host.style.cssText="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const defs=svgElement("defs");host.append(defs);document.body.append(host);
  let observed=new Map(),lastCard=null,dead=false,sequence=0;
  const observers=new Map();
  const build=node=>{
    if(dead||!node.isConnected)return;
    const width=Math.round(node.offsetWidth),height=Math.round(node.offsetHeight);
    if(width<3||height<3)return;
    const css=getComputedStyle(node),radius=Number.parseFloat(css.borderTopLeftRadius)||0;
    const materialSize=Number.parseFloat(getComputedStyle(document.querySelector(".cta6-tile--glass")||node).width)||100;
    const deviceScale=window.devicePixelRatio||1;
    const key=[width,height,radius,materialSize,deviceScale].join("|");
    if(observed.get(node)===key)return;
    const id="dof-refractive-"+(++sequence);
    const filter=makeFilter(id,width,height,pixelMap(width,height,radius,materialSize,deviceScale));
    defs.append(filter);
    observed.set(node,key);
    const old=node.dataset.refractiveFilter;
    node.dataset.refractiveFilter=id;
    node.style.setProperty("--auth-native-refraction",`url(#${id})`);
    if(old)document.getElementById(old)?.remove();
    document.body.dataset.authRefractiveStatus="ready";
  };
  const refresh=()=>{
    if(dead)return;
    const card=document.querySelector(".auth3-root [data-auth-glass-card]");
    if(!card)return;
    // React providers and extra MFA/signup fields can mount *after* the
    // card itself. A same-card early return leaves later controls inheriting
    // its displacement map. Reconcile each actual pane on childList changes.
    if(card!==lastCard){
      for(const observer of observers.values())observer.disconnect();
      observers.clear();observed=new Map();defs.replaceChildren();lastCard=card;
    }
    const nodes=[card,...card.querySelectorAll(
      '[data-auth-glass-input],[data-auth-glass-submit],[data-auth-glass-provider]'
    )];
    const active=new Set(nodes);
    for(const [node,ro] of observers){
      if(active.has(node))continue;
      ro.disconnect();observers.delete(node);observed.delete(node);
      const id=node.dataset.refractiveFilter;
      if(id)document.getElementById(id)?.remove();
    }
    for(const node of nodes){
      if(observers.has(node))continue;
      build(node);
      const ro=new ResizeObserver(()=>build(node));
      ro.observe(node);observers.set(node,ro);
    }
    // Native form controls can be replaced by React without changing
    // card identity, or resized multiple times before MutationObserver
    // delivery. Keep no orphaned filters from past element generations.
    const activeIds=new Set(nodes.map(node=>node.dataset.refractiveFilter).filter(Boolean));
    for(const filter of [...defs.children]){
      if(!activeIds.has(filter.id))filter.remove();
    }
    document.body.dataset.authRefractivePanes=String(nodes.length);
  };
  const onResize=()=>{for(const node of observers.keys())build(node);};
  window.addEventListener("resize",onResize,{passive:true});
  const root=document.getElementById("public-route-content")||document.body;
  const mutation=new MutationObserver(refresh);
  mutation.observe(root,{subtree:true,childList:true});
  refresh();
  return ()=>{
    dead=true;mutation.disconnect();
    window.removeEventListener("resize",onResize);
    for(const observer of observers.values())observer.disconnect();
    host.remove();
    delete document.body.dataset.authRefractiveStatus;
  };
}
