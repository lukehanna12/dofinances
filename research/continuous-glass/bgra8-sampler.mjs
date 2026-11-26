// Finite native BGRA8 (encoded UNORM, not linear-light) normalized clamp-edge sampler.
// Rounding structure verified against G14G public Metal half4 sampler.
import {half} from "./native-field.mjs";
const f=Math.fround;
export function axis(u,n){
 const x=Math.max(0,Math.min(n-1,f(f(u)*n)-.5)),a=Math.floor(x);
 return [a,Math.min(n-1,a+1),Math.floor((x-a)*256+.5)];
}
export function sampleBGRA8(src,w,h,u,v,c){
 const [a,b,p]=axis(u,w),[d,e,q]=axis(v,h),at=(x,y)=>src[(y*w+x)*4+c];
 const z=at(a,d)*(256-p)*(256-q)+at(b,d)*p*(256-q)+at(a,e)*(256-p)*q+at(b,e)*p*q;
 return half(Math.floor((z+2048)/4096)/(16*255));
}
export function roundEven(x){const n=Math.floor(x),v=x-n;return n+(v>.5||(v===.5&&n%2!==0)?1:0);}
export function unormByte(x){return Math.max(0,Math.min(255,roundEven(x*255)));}
export function mix32(n){n=n>>>0;n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);return (n^(n>>>16))>>>0;}
export function heldout(w,h,k,n=1024){
 const src=Uint8Array.from({length:w*h*4},(_,j)=>mix32(j+10007*k)&255);
 const points=new Float32Array(n*2);
 for(let j=0;j<n;j++){
  const x=mix32(j+313*k)%(w+2)-1,y=mix32(j+701*k+17)%(h+2)-1;
  points[2*j]=(x+.5+(mix32(j+907*k+57)%1024)/1024)/w;
  points[2*j+1]=(y+.5+(mix32(j+2017*k+113)%1024)/1024)/h;
 }
 return {src,points};
}
