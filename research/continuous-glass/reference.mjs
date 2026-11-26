// Experimental continuous reference. Not used by production and not a native-equivalence claim.
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}

function positive(x,name){if(!Number.isFinite(x)||x<=0)throw new RangeError(name+" must be positive and finite");return x;}

function roundedBoxField(x,y,width,height,radius){
  positive(width,"width");positive(height,"height");
  if(![x,y,radius].every(Number.isFinite)||radius<0||radius>Math.min(width,height)/2)throw new RangeError("Invalid point or circular corner radius");
  const a=width/2-radius,b=height/2-radius;
  const qx=Math.abs(x)-a,qy=Math.abs(y)-b;
  const ox=Math.max(qx,0),oy=Math.max(qy,0),rho=Math.hypot(ox,oy);
  const distance=rho+Math.min(Math.max(qx,qy),0)-radius;
  // Euclidean distance, not the recovered Apple supercircle field.
  // At a medial-axis tie or a non-differentiable contour corner, do not invent a normal.
  if(rho===0){
    if(qx===qy)return {distance,gradient:null,levelCurvature:null};
    if(qx>qy)return {distance,gradient:x===0?null:[Math.sign(x),0],levelCurvature:x===0?null:0};
    return {distance,gradient:y===0?null:[0,Math.sign(y)],levelCurvature:y===0?null:0};
  }
  const gradient=[Math.sign(x)*ox/rho,Math.sign(y)*oy/rho];
  // A circle's zero-width core is degenerate, not a straight/arc join.
  const ax=qx>0||(qx===0&&a===0),ay=qy>0||(qy===0&&b===0);
  const join=(qx===0&&a>0)||(qy===0&&b>0);
  return {distance,gradient,levelCurvature:join?null:ax&&ay?1/rho:0};
}

function refractionEnvelope(distance,amount,height){
  positive(height,"height");
  if(!Number.isFinite(distance)||!Number.isFinite(amount))throw new RangeError("Invalid optical parameter");
  const t=clamp(-distance/height,0,1);
  const root=Math.sqrt(t*(2-t));
  // Algebraically equivalent to amount*(1-root), but stable near t=1.
  // No half quantization in this continuous reference; not a native execution claim.
  const displacement=amount*((1-t)*(1-t))/(1+root);
  // The square-root derivative is singular at the outer boundary when amount!=0.
  const derivative=distance===0&&amount!==0?null:
    (t>0&&t<1?amount*(1-t)/(height*root):0);
  return {displacement,derivative};
}

function logicalPoint(rasterX,rasterY,{originX=0,originY=0,density=1,magnification=1}={}){
  const sampling=positive(density,"density")*positive(magnification,"magnification");
  if(![rasterX,rasterY,originX,originY,sampling].every(Number.isFinite))throw new RangeError("Invalid view coordinates");
  return {x:originX+rasterX/sampling,y:originY+rasterY/sampling,pixelWidth:1/sampling};
}

function quantizedUnitUV(u){
  if(!Number.isFinite(u)||u<0||u>1)throw new RangeError("Normalized UV must be in [0,1]");
  if(u===0)return 0;
  const step=2**(Math.max(-14,Math.floor(Math.log2(u)))-10);
  const q=u/step,k=Math.floor(q),f=q-k;
  return (k+(f>.5||(f===.5&&k%2===1)?1:0))*step;
}

function linearWeights(n,x){
  if(!Number.isInteger(n)||n<1||!Number.isFinite(x))throw new RangeError("Invalid axis");
  const v=clamp(x,0,n-1),i=Math.floor(v),j=Math.min(i+1,n-1),t=v-i;
  const w=Array(n).fill(0);w[i]+=1-t;w[j]+=t;return w;
}

function boxAxisWeights(n,lo,hi){
  if(!Number.isInteger(n)||n<1||![lo,hi].every(Number.isFinite)||hi<lo)throw new RangeError("Invalid axis interval");
  if(lo===hi)return linearWeights(n,lo);
  const length=hi-lo;if(!Number.isFinite(length))throw new RangeError("Interval too large");
  const w=Array(n).fill(0);
  if(n===1){w[0]=1;return w;}
  // Integrate the piecewise-linear reconstruction exactly by trapezoids.
  // Outside the sample-center domain it has constant edge extension.
  w[0]+=Math.max(0,Math.min(hi,0)-lo);
  w[n-1]+=Math.max(0,hi-Math.max(lo,n-1));
  const l=Math.max(lo,0),r=Math.min(hi,n-1);
  for(let i=Math.floor(l);i<r;i++){
    const a=Math.max(l,i)-i,b=Math.min(r,i+1)-i,dx=b-a;
    if(dx<=0)continue;
    const mean=(a+b)/2;
    w[i]+=dx*(1-mean);w[i+1]+=dx*mean;
  }
  return w.map(v=>v/length);
}

function weightedGrid(samples,width,height,wx,wy){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
     samples.length!==width*height||wx.length!==width||wy.length!==height)throw new RangeError("Invalid source grid");
  let value=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=samples[y*width+x];if(!Number.isFinite(v))throw new RangeError("Nonfinite source sample");
    value+=v*wx[x]*wy[y];
  }return value;
}

function reconstructBilinear(samples,width,height,x,y){
  return weightedGrid(samples,width,height,linearWeights(width,x),linearWeights(height,y));
}

function integrateBox(samples,width,height,x0,x1,y0,y1){
  // Candidate mathematical box kernel, not an inferred Apple blur kernel.
  return weightedGrid(samples,width,height,boxAxisWeights(width,x0,x1),boxAxisWeights(height,y0,y1));
}

export {clamp,roundedBoxField,refractionEnvelope,logicalPoint,quantizedUnitUV,boxAxisWeights,reconstructBilinear,integrateBox};
