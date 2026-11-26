// Recovered finite G14G variable-blur diamond. Logical reconstruction is real arithmetic;
// the separate dyadic compatibility evaluator preserves observed half operation boundaries.
import {half} from "./native-field.mjs";
import {sampleBGRA8,unormByte} from "./bgra8-sampler.mjs";
export const GROUPS=Object.freeze([[[0,-2],[-2,0],[2,0],[0,2]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[0,-1],[-1,0],[1,0],[0,1]],[[0,0]]].map(g=>Object.freeze(g.map(Object.freeze))));
export const WEIGHTS=Object.freeze([.05633544921875,.07708740234375,.0902099609375,.10546875]);
export function diamond(scene,x,y,sx=scene.step[0],sy=scene.step[1]){
 if(![x,y,sx,sy].every(Number.isFinite)||sx<=0||sy<=0)throw new RangeError("Positive logical stage pitch required");
 const out=[0,0,0,0];
 for(let i=0;i<GROUPS.length;i++)for(const [a,b] of GROUPS[i]){
  const v=scene.box(x+2*a*sx,y+2*b*sy);
  for(let c=0;c<4;c++)out[c]+=WEIGHTS[i]*v[c];
 }
 return out;
}
export function halfDiamond(sample){
 const sums=GROUPS.map(g=>g.map(([a,b])=>half(sample(a,b))).reduce((x,y)=>half(x+y)));
 let v=half(sums[3]*WEIGHTS[3]);
 for(const i of [1,2,0])v=half(v+sums[i]*WEIGHTS[i]);
 return v;
}
const toUnorm=unormByte;
// Finite BGRA8 route, including tested odd dimensions. Source and target dimensions
// are explicit; this does not determine which level Core Animation selects.
export function nativeBGRA8Downsample(src,w,h){
 if(!(src instanceof Uint8Array)||![w,h].every(n=>Number.isSafeInteger(n)&&n>0&&n<=4096)||src.length!==w*h*4||Math.max(w,h)<2)throw new RangeError("Invalid BGRA8 mip input");
 const dw=Math.max(1,Math.floor(w/2)),dh=Math.max(1,Math.floor(h/2)),out=new Uint8Array(dw*dh*4),f=Math.fround;
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++)for(let c=0;c<4;c++){
  const v=halfDiamond((a,b)=>sampleBGRA8(src,w,h,f(f(x+a+.5)*f(1/dw)),f(f(y+b+.5)*f(1/dh)),c));
  out[(y*dw+x)*4+c]=toUnorm(v);
 }
 return {width:dw,height:dh,values:out};
}
export function evenNativeDownsample(src,w,h,{unorm=false}={}){
 if(![w,h].every(n=>Number.isInteger(n)&&n>=2&&n%2===0)||src.length!==w*h*4||!Array.from(src).every(x=>Number.isFinite(x)&&(unorm?Number.isInteger(x)&&x>=0&&x<=255:half(x)===x)))throw new RangeError("Finite even-dimension native domain required");
 const dw=w/2,dh=h/2,out=unorm?new Uint8Array(dw*dh*4):new Float64Array(dw*dh*4);
 const val=(x,y,c)=>src[(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*4+c]/(unorm?255:1);
 
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++)for(let c=0;c<4;c++){
  const z=halfDiamond((a,b)=>{let sum=0;for(let v=0;v<2;v++)for(let u=0;u<2;u++)sum+=val(2*(x+a)+u,2*(y+b)+v,c);return sum/4;});
  out[(y*dw+x)*4+c]=unorm?toUnorm(z):z;
 }
 return {width:dw,height:dh,values:out};
}

const EPS=0.00010001659393310547; // binary16 0x068e
// Copy ABI fields are supplied explicitly; no unsupported public-state inference.
export function nativeCopyBase(src,w,h,{base,limits,baseSize,mipSize,noBaseMip,unorm=true}){
 const valid=a=>Array.isArray(a)&&a.every(Number.isSafeInteger);
 if(![w,h].every(n=>Number.isSafeInteger(n)&&n>0)||src.length!==w*h*4||
  !valid(base)||base.length!==2||!valid(limits)||limits.length!==4||!valid(baseSize)||baseSize.length!==2||!valid(mipSize)||mipSize.length!==2||
  !baseSize.every((v,i)=>v===2*mipSize[i])||!mipSize.every(x=>x>0&&x<=4096)||typeof noBaseMip!=="boolean"||
  !Array.from(src).every(x=>Number.isFinite(x)&&(unorm?Number.isInteger(x)&&x>=0&&x<=255:half(x)===x)))throw new RangeError("Invalid copy ABI");
 const [l,t,r,b]=limits;if(l<0||t<0||r>=w||b>=h||r<l||b<t)throw new RangeError("Invalid clamp bounds");
 const [bx,by]=base,[dw,dh]=mipSize;
 const get=(x,y,c)=>src[(Math.max(t,Math.min(b,y))*w+Math.max(l,Math.min(r,x)))*4+c];
 const levels=[];
 const allocate=n=>unorm?new Uint8Array(n):new Float64Array(n);
 if(!noBaseMip){
  const [aw,ah]=baseSize,values=allocate(aw*ah*4);
  for(let y=0;y<ah;y++)for(let x=0;x<aw;x++)for(let c=0;c<4;c++)values[(y*aw+x)*4+c]=get(bx+x,by+y,c);
  levels.push({width:aw,height:ah,values,sourceOrigin:[bx,by],sourcePitch:1});
 }
 const values=allocate(dw*dh*4);
 const val=(x,y,c)=>half(get(x,y,c)/(unorm?255:1));
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++)for(let c=0;c<4;c++){
  let z=halfDiamond((a,b)=>{
   const X=bx+2*(x+a),Y=by+2*(y+b);
   return half(half(half(half(val(X+1,Y,c)+val(X,Y,c))+val(X,Y+1,c))+val(X+1,Y+1,c))*.25);
  });
  if(c<3&&Math.abs(z)<EPS)z=0;
  values[(y*dw+x)*4+c]=unorm?toUnorm(z):z;
 }
 levels.push({width:dw,height:dh,values,sourceOrigin:[bx+.5,by+.5],sourcePitch:2});
 return levels;
}
export function nativeFixedMipChain(src,w,h,options){
 const levels=nativeCopyBase(src,w,h,options);
 const count=options.levelCount??levels.length;
 if(!Number.isSafeInteger(count)||count<levels.length||count>12)throw new RangeError("Invalid mip level count");
 while(levels.length<count){
  const p=levels.at(-1),next=(options.unorm??true)?nativeBGRA8Downsample(p.values,p.width,p.height):evenNativeDownsample(p.values,p.width,p.height,{unorm:false});
  const oldPitch=p.sourcePitchXY??[p.sourcePitch,p.sourcePitch],ratio=[p.width/next.width,p.height/next.height],pitch=ratio.map((v,i)=>v*oldPitch[i]);
  levels.push({...next,sourceOrigin:p.sourceOrigin.map((x,i)=>x+oldPitch[i]*(ratio[i]-1)*.5),sourcePitchXY:pitch,sourcePitch:pitch[0]===pitch[1]?pitch[0]:null});
 }
 return levels;
}
