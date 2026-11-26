// Independent real-arithmetic sampled-scene operator; no framebuffer dependence.
// Separate finite native diagnostics; they are not a universal Glass sampler.
import {half} from "./native-field.mjs";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function halfAway(x){
 if(!Number.isFinite(x)||x===0)return x;
 if(x<0)return -halfAway(-x);
 const a=half(x);if(a>=x)return a;
 const step=2**(Math.max(-14,Math.floor(Math.log2(x)))-10);
 return x-a===step/2?a+step:a;
}
export function publicBlitCandidate(src,w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||src.length!==w*h*4)throw new RangeError("Invalid source");
 const dw=Math.max(1,Math.floor(w/2)),dh=Math.max(1,Math.floor(h/2)),out=[];
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const X=clamp((x+.5)*w/dw-.5,0,w-1),Y=clamp((y+.5)*h/dh-.5,0,h-1),ix=Math.floor(X),iy=Math.floor(Y);
  const u=Math.round((X-ix)*256)/256,v=Math.round((Y-iy)*256)/256,jx=Math.min(ix+1,w-1),jy=Math.min(iy+1,h-1);
  for(let c=0;c<4;c++){
   const f=(a,b)=>src[(b*w+a)*4+c];
   out.push(halfAway((1-u)*(1-v)*f(ix,iy)+u*(1-v)*f(jx,iy)+(1-u)*v*f(ix,jy)+u*v*f(jx,jy)));
  }
 }
 return {width:dw,height:dh,values:out};
}
export function finiteConstantMipLOD(lod,levels){
 // Oracle explicit LOD witness: only spatially constant three-level half textures.
 if(!Number.isFinite(lod)||levels.length!==3||!levels.every(x=>Number.isFinite(x)&&half(x)===x))throw new RangeError("Finite three-level half control required");
 const q=clamp(Math.floor(half(lod)*64)/64,0,2),i=Math.min(1,Math.floor(q));
 return Math.fround(levels[i]+(levels[i+1]-levels[i])*(q-i));
}
function checkAxis(n,lo,hi){
 if(!Number.isInteger(n)||n<1||![lo,hi].every(Number.isFinite)||hi<lo)throw new RangeError("Invalid axis");
}
export function axisTerms(n,lo,hi){
 // Sparse, disjoint or overlapping index ranges with constant integrated hat weights.
 // At most nine terms: two clamped tails, two boundary-cell pairs, and three full-cell ranges.
 // Full cells combine to two half endpoints and one unit-weight interior.
 checkAxis(n,lo,hi);
 const result=[],add=(a,b,k)=>{if(a<=b&&k!==0)result.push([a,b,k]);};
 if(n===1)return [[0,0,1]];
 if(hi===lo){
  const x=clamp(lo,0,n-1),i=Math.floor(x),t=x-i;add(i,i,1-t);add(Math.min(i+1,n-1),Math.min(i+1,n-1),t);return result;
 }
 const len=hi-lo;if(!Number.isFinite(len))throw new RangeError("Invalid footprint length");
 add(0,0,Math.max(0,Math.min(hi,0)-lo)/len);
 add(n-1,n-1,Math.max(0,hi-Math.max(lo,n-1))/len);
 const a=Math.max(lo,0),b=Math.min(hi,n-1);
 if(b<=a)return result;
 const start=Math.floor(a),end=Math.ceil(b)-1;
 const partial=(i,x,y)=>{const d=y-x,m=(x+y)/2;add(i,i,d*(1-m)/len);add(i+1,i+1,d*m/len);};
 if(start===end){partial(start,a-start,b-start);return result;}
 partial(start,a-start,1);partial(end,0,b-end);
 if(end>start+1){add(start+1,start+1,.5/len);add(start+2,end-1,1/len);add(end,end,.5/len);}
 return result;
}
export class ContinuousScene{
 constructor(width,height,rgba,{origin=[0,0],step=[1,1]}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4||!Array.from(rgba).every(Number.isFinite)||origin.length!==2||step.length!==2||!origin.every(Number.isFinite)||!step.every(x=>Number.isFinite(x)&&x>0))throw new RangeError("Invalid fixed source");
  this.width=width;this.height=height;this.origin=origin.slice();this.step=step.slice();this.rgba=Float64Array.from(rgba);
  // Node-value summed-area table; geometry/footprint coordinates are independent of source storage.
  const stride=width+1;this.prefix=new Float64Array(stride*(height+1)*4);
  for(let y=0;y<height;y++){
   const sum=[0,0,0,0];
   for(let x=0;x<width;x++)for(let c=0;c<4;c++){
    sum[c]+=rgba[(y*width+x)*4+c];
    this.prefix[((y+1)*stride+x+1)*4+c]=sum[c]+this.prefix[(y*stride+x+1)*4+c];
   }
  }
 }
 rect(a,b,c,d,k){
  // Inclusive node rectangle. Use direct fetch for small support to reduce cancellation.
  if((b-a+1)*(d-c+1)<=16){let z=0;for(let y=c;y<=d;y++)for(let x=a;x<=b;x++)z+=this.rgba[(y*this.width+x)*4+k];return z;}
  const p=(x,y)=>this.prefix[(y*(this.width+1)+x)*4+k];
  return p(b+1,d+1)-p(a,d+1)-p(b+1,c)+p(a,c);
 }
 box(x,y,rx=0,ry=rx){
  if(![x,y,rx,ry].every(Number.isFinite)||rx<0||ry<0)throw new RangeError("Invalid box");
  const X=(x-this.origin[0])/this.step[0],Y=(y-this.origin[1])/this.step[1],a=rx/this.step[0],b=ry/this.step[1];
  const xs=axisTerms(this.width,X-a,X+a),ys=axisTerms(this.height,Y-b,Y+b),out=[0,0,0,0];
  for(const [i,j,wx] of xs)for(const [k,l,wy] of ys)for(let c=0;c<4;c++)out[c]+=wx*wy*this.rect(i,j,k,l,c);
  return out;
 }
}
// This finite mapping is from the Oracle's variable blur level producer;
// exact f32 products, positive bounded domain, and available <= 7.
export function finiteMipSelection(width,height,s0,s1){
 if(![width,height].every(x=>Number.isInteger(x)&&x>0&&x<=4096)||![s0,s1].every(x=>Number.isFinite(x)&&x>0&&x<10000))throw new RangeError("Outside finite input contract");
 const f=Math.fround,p=f(f(s1)*f(1.6)),q=f(f(s0)*f(1.6));
 if(!(p>0&&q>0))throw new RangeError("Underflow");
 const available=Math.min(Math.floor(Math.log2(Math.max(width,height)))+1,Math.max(2,Math.ceil(Math.log2(p))+1));
 if(available>7)throw new RangeError("Outside retained level cap domain");
 return {p,q,available,selected:Math.min(available-1,Math.max(0,Math.floor(Math.log2(q))))};
}
