// Finite 25F80/M2 LoginUIKit clock text material.
// Evidence: liquid-plexiglass-oracle@2f4217b4530654e6e9fd432c9834528c0fdd2e89.
// Native parameters and static AIR operators; browser glyph/UV/color transport
// is not a claim of identical private native SDF or G14G execution.
import {decodeFaceHalfRows} from "./dashboard-glass-material.js";
import {distanceTo} from "./dashboard-glass-silhouette.js";

export const CLOCK_TEXT_PROFILE=Object.freeze({
 material:"clock-text",nativeScale:.25,sdfZero:1,sdfOne:-24,sdfBits:10,
 innerAmount:-60,innerHeight:6,outerAmount:0,outerHeight:0,
 blurWord:Math.fround(1.2),bleedWord:8,bleedAmount:64,bleedHeight:8,
 bleedRows:Object.freeze(decodeFaceHalfRows("003cdc84dc0400005900003c7081000064836503003c0000")),
 lodBias:2,holdingWhite:.97021484375,faceOpacity:0,refractionOpacity:0,
 gradientBias:.25,keyHeight:.75,keyAngle:-Math.PI/4,keySpread:50*Math.PI/180,keyAmount:.5,
 fillHeight:.75,fillAngle:3*Math.PI/4,fillSpread:50*Math.PI/180,fillAmount:.5,
 curvature:.7,highlightClamp:Math.fround(1.2)
});
export function registerGlassText(element){
 element.dataset.glassText="clock-text";
 element.dataset.glassMaterial="clock-text";
 return element;
}
export function clockTextMaterialLanes(){
 const p=CLOCK_TEXT_PROFILE;
 return [3,p.innerAmount,p.innerHeight,p.lodBias,...p.bleedRows];
}
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const f32=new Float32Array(1),u32=new Uint32Array(f32.buffer);
export function floatToHalf(x){
 f32[0]=x;const v=u32[0],sign=(v>>>16)&0x8000;
 let e=((v>>>23)&255)-127+15,m=v&0x7fffff;
 if(e>=31)return sign|0x7c00|(Number.isNaN(x)?512:0);
 if(e<=0){
  if(e< -10)return sign;
  m|=0x800000;const n=14-e,q=m>>>n,r=m&((1<<n)-1),h=1<<(n-1);
  return sign|(q+(r>h||(r===h&&(q&1))?1:0));
 }
 let q=m>>>13,r=m&8191;
 if(r>4096||(r===4096&&(q&1)))q++;
 return sign|((e<<10)+q);
}
export const encodeClockDistance=d=>Math.round(clamp((1-d)/25)*1023);
export const decodeClockDistance=q=>1-q*25/1023;

// Browser SDF producer, not the private CoreAnimation producer.
// Preserve exact 10-bit codes as binary16 integers, with independent
// full-physical-pixel normal and antialias coverage lanes.
export function clockTextField(alpha,width,height,dpr=1){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
 alpha.length!==width*height||!Number.isFinite(dpr)||dpr<=0)throw new RangeError("Invalid clock glyph field");
 const w=width+2,h=height+2,padded=new Uint8Array(w*h);
 for(let y=0;y<height;y++)padded.set(alpha.subarray(y*width,(y+1)*width),(y+1)*w+1);
 const inside=distanceTo(padded,w,h,true),outside=distanceTo(padded,w,h,false),field=new Float32Array(w*h);
 for(let i=0;i<field.length;i++){
  const a=padded[i];
  field[i]=a>0&&a<255?(.5-a/255):a>=128?-(Math.sqrt(outside[i])-.5):Math.sqrt(inside[i])-.5;
 }
 const pixels=new Uint16Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const k=(y+1)*w+x+1,i=(y*width+x)*4;
  const gx=(field[k+1]-field[k-1])*.5,gy=(field[k+w]-field[k-w])*.5;
  const norm=Math.hypot(gx,gy),inv=norm>1e-6?1/norm:0;
  pixels[i]=floatToHalf(encodeClockDistance(field[k]/dpr));
  pixels[i+1]=floatToHalf(gx*inv);pixels[i+2]=floatToHalf(gy*inv);
  pixels[i+3]=floatToHalf(alpha[y*width+x]/255);
 }
 return pixels;
}

// Shape an entire authored string (including ligatures, marks, RTL and
// font fallback), never read pixels from the rendered page or wallpaper.
export function rasterClockText(text,style,width,height,dpr){
 const scratch=document.createElement("canvas");scratch.width=width;scratch.height=height;
 const ctx=scratch.getContext("2d",{willReadFrequently:true});if(!ctx)return null;
 try{
  ctx.scale(dpr,dpr);
  ctx.font=style.fontStyle+" "+style.fontWeight+" "+style.fontSize+" "+style.fontFamily;
  ctx.fillStyle="#fff";ctx.textBaseline="alphabetic";ctx.direction=style.direction||"ltr";
  if("letterSpacing" in ctx)ctx.letterSpacing=style.letterSpacing==="normal"?"0px":style.letterSpacing;
  if("fontKerning" in ctx)ctx.fontKerning=style.fontKerning||"auto";
  const metrics=ctx.measureText(text),ascent=metrics.fontBoundingBoxAscent||metrics.actualBoundingBoxAscent||0;
  const descent=metrics.fontBoundingBoxDescent||metrics.actualBoundingBoxDescent||0;
  const baseline=(height/dpr-ascent-descent)*.5+ascent;
  ctx.textAlign=style.direction==="rtl"?"right":"left";
  ctx.fillText(text,style.direction==="rtl"?width/dpr:0,baseline);
  const rgba=ctx.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);let filled=0;
  for(let i=0;i<alpha.length;i++){alpha[i]=rgba[i*4+3];if(alpha[i])filled++;}
  return filled?{pixels:clockTextField(alpha,width,height,dpr),filled}:null;
 }finally{scratch.width=scratch.height=0;}
}
