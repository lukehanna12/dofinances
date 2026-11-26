/* Scene CSS-pixel geometry shared by GPU and fallback. */
const clamp01=v=>Math.max(0,Math.min(1,v));
export const HOME_CENTERED_QUERY="(max-width:760px),(any-pointer:coarse),(min-width:2560px)";
const OLD_SHIFT=2.5*(950/11);
export const publicLogoOvalRadius=(width,referenceWidth)=>{
  if(!Number.isFinite(width)||!Number.isFinite(referenceWidth)||width<=0||referenceWidth<=0)throw new RangeError("Positive finite wordmark widths required");
  return 140*width/referenceWidth;
};
export function homeAperture({width,height,logoWidth,logoHeight,centered,margin=32,bottom=margin}){
  if(centered){
    const shift=Math.min(OLD_SHIFT,Math.max(0,height/2-logoHeight/2-12));
    return [width/2,height/2-shift,width/4,width*100/1280];
  }
  // The clear interior reaches the left and bottom scene edges; only the
  // top and right feather are visible. The feather is inside the margins.
  return [Math.min(width,logoWidth+2*margin),Math.max(0,height-bottom-logoHeight-margin),-margin,0];
}
export function apertureAlpha(x,y,a){
  if(a[2]<0){
    const s=-a[2],t=clamp01(Math.hypot(Math.max(0,x-(a[0]-s)),Math.max(0,a[1]+s-y))/s);
    return t*t*(3-2*t);
  }
  const t=clamp01(Math.hypot((x-a[0])/a[2],(y-a[1])/a[3]));
  return .48+.52*t*t;
}
let aperture=[0,0,320,100];
export const currentPublicLogoOvalRadius=()=>Math.abs(aperture[2]);
export const currentHomeAperture=()=>aperture;
// Independent alpha image for CSS-only browsers, using the same logical
// top/right feather (SVG gradients approximate the smoothstep).
function desktopMask(width,height,top,right,soft){
  const cx=right-soft,cy=top+soft;
  const ramp='<stop offset="0" stop-color="black"/><stop offset=".25" stop-color="#282828"/><stop offset=".5" stop-color="#808080"/><stop offset=".75" stop-color="#d7d7d7"/><stop offset="1" stop-color="white"/>';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><defs>'+
    '<linearGradient id="t" x1="0" y1="1" x2="0" y2="0">'+ramp+'</linearGradient>'+
    '<linearGradient id="r">'+ramp+'</linearGradient><radialGradient id="c">'+ramp+'</radialGradient>'+
    '<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="'+width+'" height="'+height+'">'+
    '<rect width="'+width+'" height="'+height+'" fill="white"/>'+
    '<rect x="0" y="'+cy+'" width="'+cx+'" height="'+Math.max(0,height-cy)+'" fill="black"/>'+
    '<rect x="0" y="'+top+'" width="'+cx+'" height="'+soft+'" fill="url(#t)"/>'+
    '<rect x="'+cx+'" y="'+cy+'" width="'+soft+'" height="'+Math.max(0,height-cy)+'" fill="url(#r)"/>'+
    '<svg x="'+cx+'" y="'+top+'" width="'+soft+'" height="'+soft+'" viewBox="0 0 1 1"><rect x="-1" y="0" width="2" height="2" fill="url(#c)"/></svg>'+
    '</mask></defs><rect width="'+width+'" height="'+height+'" fill="black" mask="url(#m)"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
}
export function observePublicLogoOval(){
  const title=document.getElementById("dashboard-title"),grid=document.getElementById("cta6-mosaic"),scene=title?.closest(".dashboard-home");
  if(!title||!grid||!scene)return;
  const media=matchMedia(HOME_CENTERED_QUERY),probe=document.createElement("span");
  Object.assign(probe.style,{position:"absolute",visibility:"hidden",pointerEvents:"none",display:"inline-block",width:"max-content",whiteSpace:"nowrap"});
  title.parentElement.append(probe);
  let previous="";
  function update(){
    const width=scene.clientWidth,height=scene.clientHeight;
    if(!width||!height)return;
    const style=getComputedStyle(title),centered=media.matches;
    probe.textContent=title.textContent;
    for(const property of ["fontFamily","fontWeight","fontStyle","fontStretch","fontVariant","fontKerning","fontFeatureSettings","fontVariationSettings","textTransform"])probe.style[property]=style[property];
    probe.style.fontSize="45px";
    probe.style.letterSpacing=(parseFloat(style.letterSpacing)/parseFloat(style.fontSize)*45)+"px";
    const referenceWidth=probe.getBoundingClientRect().width;
    if(!(referenceWidth>0))return;
    const size=centered?45*(width/2)/referenceWidth:63;
    document.body.style.setProperty("--public-home-logo-size",size+"px");
    const logoWidth=title.offsetWidth,logoHeight=title.offsetHeight;
    const margin=32,bottom=parseFloat(getComputedStyle(title.parentElement).paddingBottom)||margin;
    const next=homeAperture({width,height,logoWidth,logoHeight,centered,margin,bottom});
    const key=JSON.stringify([next,grid.clientHeight]);
    if(previous===key)return;
    previous=key;aperture=next;
    document.body.dataset.homeLayout=centered?"centered":"corner";
    if(centered){
      document.body.style.setProperty("--public-home-logo-shift",(height/2-next[1])+"px");
      grid.style.setProperty("--public-logo-oval-x",next[2]+"px");
      grid.style.setProperty("--public-logo-oval-y",next[3]+"px");
      grid.style.removeProperty("--public-desktop-aperture");
    }else{
      const top=next[1]-(grid.getBoundingClientRect().top-scene.getBoundingClientRect().top);
      grid.style.setProperty("--public-desktop-aperture",desktopMask(width,grid.clientHeight,top,next[0],-next[2]));
    }
    window.dispatchEvent(new Event("dofinances:logo-oval-change"));
  }
  update();
  if(typeof ResizeObserver!=="undefined"){const ro=new ResizeObserver(update);ro.observe(scene);ro.observe(title);ro.observe(grid);}
  media.addEventListener("change",update);
  window.addEventListener("resize",update);
  new MutationObserver(update).observe(title,{childList:true,characterData:true,subtree:true});
  document.fonts?.ready.then(update);
  document.fonts?.addEventListener?.("loadingdone",update);
}
export function publicIconSpatialAlpha(centerX,centerY,tileWidth,sceneWidth,sceneHeight,dpr=1,a=null){
  if([centerX,centerY,tileWidth,sceneWidth,sceneHeight,dpr].some(v=>!Number.isFinite(v))||tileWidth<=0||sceneWidth<=0||sceneHeight<=0||dpr<=0)throw new RangeError("Positive finite scene dimensions and finite coordinates required");
  const edge=.25+.75*clamp01(Math.min(centerX,sceneWidth-centerX)/Math.max(1,.75*tileWidth));
  const shape=a||[sceneWidth/dpr/2,sceneHeight/dpr/2-OLD_SHIFT,sceneWidth/dpr/4,sceneWidth/dpr*100/1280];
  return edge*apertureAlpha(centerX/dpr,centerY/dpr,shape);
}
