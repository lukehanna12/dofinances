// Recovered finite G14G variable-blur diamond. Logical reconstruction is real arithmetic;
// the separate dyadic compatibility evaluator preserves observed half operation boundaries.
import {half} from "./native-field.mjs";
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
export function evenNativeDownsample(src,w,h,{unorm=false}={}){
 if(![w,h].every(n=>Number.isInteger(n)&&n>=2&&n%2===0)||src.length!==w*h*4||!Array.from(src).every(x=>Number.isFinite(x)&&(unorm?Number.isInteger(x)&&x>=0&&x<=255:half(x)===x)))throw new RangeError("Finite even-dimension native domain required");
 const dw=w/2,dh=h/2,out=unorm?new Uint8Array(dw*dh*4):new Float64Array(dw*dh*4);
 const val=(x,y,c)=>src[(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*4+c]/(unorm?255:1);
 const roundEven=x=>{const f=Math.floor(x),r=x-f;return r===.5?f+(f%2):Math.round(x);};
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++)for(let c=0;c<4;c++){
  const z=halfDiamond((a,b)=>{let sum=0;for(let v=0;v<2;v++)for(let u=0;u<2;u++)sum+=val(2*(x+a)+u,2*(y+b)+v,c);return sum/4;});
  out[(y*dw+x)*4+c]=unorm?Math.max(0,Math.min(255,roundEven(z*255))):z;
 }
 return {width:dw,height:dh,values:out};
}
