import {test} from "node:test";
import {clamp,roundedBoxField,refractionEnvelope,logicalPoint,quantizedUnitUV,boxAxisWeights,reconstructBilinear,integrateBox} from "./reference.mjs";
function check(v,msg="assertion failed"){if(!v)throw new Error(msg);}

function near(a,b,tol=1e-11){check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);}

function closestBoundary(x,y,w,h,r){
  // Independent geometric reference: minimum distance to four segments and four quarter arcs.
  const hx=w/2,hy=h/2,a=hx-r,b=hy-r;
  let best=Infinity;
  for(const sy of [-1,1])best=Math.min(best,Math.hypot(x-clamp(x,-a,a),y-sy*hy));
  for(const sx of [-1,1])best=Math.min(best,Math.hypot(x-sx*hx,y-clamp(y,-b,b)));
  for(const sx of [-1,1])for(const sy of [-1,1]){
    const dx=sx*(x-sx*a),dy=sy*(y-sy*b);
    const d=dx>=0&&dy>=0?Math.abs(Math.hypot(dx,dy)-r):
      Math.min(Math.hypot(dx-r,dy),Math.hypot(dx,dy-r));
    best=Math.min(best,d);
  }
  const inside=Math.abs(x)<=hx&&Math.abs(y)<=hy&&
    (Math.abs(x)<=a||Math.abs(y)<=b||Math.hypot(Math.abs(x)-a,Math.abs(y)-b)<=r);
  return inside?-best:best;
}

function geometryMatrix(){
  let cases=0;
  const shapes=[[64,64,32],[190,52,26],[52,190,26],[180,92,0],[180,92,19],[911.5,8,0],[913,307.5,73.125]];
  for(const [w,h,r] of shapes)for(const scale of [.001,.1,1,8,64,1024]){
    for(const x of [-.82,-.5,-.31,-.07,0,.13,.41,.5,.79])for(const y of [-.83,-.5,-.29,-.09,0,.19,.39,.5,.82]){
      const X=x*w*scale,Y=y*h*scale;
      const field=roundedBoxField(X,Y,w*scale,h*scale,r*scale);
      near(field.distance,closestBoundary(X,Y,w*scale,h*scale,r*scale),3e-10);
      near(field.distance/scale,roundedBoxField(x*w,y*h,w,h,r).distance,3e-10);
      if(field.gradient)near(Math.hypot(...field.gradient),1);
      cases++;
    }
  }
  check(cases===3402);
}

function normalsAndCurvature(){
  const box=roundedBoxField(85,40,180,100,20);
  const eps=1e-4;
  const gx=(roundedBoxField(85+eps,40,180,100,20).distance-roundedBoxField(85-eps,40,180,100,20).distance)/(2*eps);
  const gy=(roundedBoxField(85,40+eps,180,100,20).distance-roundedBoxField(85,40-eps,180,100,20).distance)/(2*eps);
  near(box.gradient[0],gx,1e-8);near(box.gradient[1],gy,1e-8);
  near(box.levelCurvature,1/Math.hypot(15,10));
  near(roundedBoxField(0,50,180,100,20).levelCurvature,0);
  near(roundedBoxField(0,32,64,64,32).levelCurvature,1/32);
  check(roundedBoxField(0,0,64,64,32).gradient===null);
  check(roundedBoxField(90,50,180,100,0).gradient===null);
  check(roundedBoxField(70,50,180,100,20).levelCurvature===null);
}

function samplingMatrix(){
  const densities=[1,1.25,1.5,2,3,4],zooms=[.5,1,2,8,32,128];
  let cases=0;
  for(const rho of densities)for(const zoom of zooms)for(const [x,y] of [[-28,-17],[32,0],[1.125,14.25],[100,23],[-.125,.25]]){
    const originX=-100,originY=-100,rate=rho*zoom;
    const v=logicalPoint((x-originX)*rate,(y-originY)*rate,{originX,originY,density:rho,magnification:zoom});
    near(v.x,x);near(v.y,y);near(v.pixelWidth,1/rate);
    const f=roundedBoxField(v.x,v.y,190,52,26),g=roundedBoxField(x,y,190,52,26);
    near(f.distance,g.distance);
    near(refractionEnvelope(f.distance,-52,18.72).displacement,refractionEnvelope(g.distance,-52,18.72).displacement,1e-7);
    cases++;
  }
  check(cases===180);
}

function envelopeChecks(){
  for(const amount of [-60,-8,0,20])for(const height of [.25,2.88,6,20])for(const t of [-1,0,.00001,.1,.25,.5,.9,.999999,1,1.5]){
    const d=-height*t,T=clamp(t,0,1);
    near(refractionEnvelope(d,amount,height).displacement,amount*(1-Math.sqrt(T*(2-T))),1e-12);
  }
  const d=-3,A=-60,H=20,e=1e-5;
  const analytic=refractionEnvelope(d,A,H);
  near(analytic.derivative,(refractionEnvelope(d+e,A,H).displacement-refractionEnvelope(d-e,A,H).displacement)/(2*e),1e-8);
  check(refractionEnvelope(0,-60,20).derivative===null);
  check(refractionEnvelope(-20,-60,20).displacement===0);
}

function precisionChecks(){
  near(quantizedUnitUV(.5+2**-12),.5,0); // midpoint, even mantissa
  near(quantizedUnitUV(.5+3*2**-12),.5+2**-10,0); // midpoint, odd mantissa rounds up
  near(quantizedUnitUV(2**-25),0,0);
  for(const width of [1024,4096,16384]){
    const u=.75+2**-12;
    near(Math.abs(quantizedUnitUV(u)-u)*width,width/4096,0);
  }
}

function reconstructionChecks(){
  const w=5,h=3,constant=Array(w*h).fill(.375);
  for(const x of [-8,-.25,0,.3,2.75,4,9])for(const y of [-5,0,.65,2,5]){
    near(reconstructBilinear(constant,w,h,x,y),.375);
    near(integrateBox(constant,w,h,x-.73,x+.51,y-.4,y+.7),.375);
  }
  const affine=Array.from({length:w*h},(_,i)=>3*(i%w)-2*Math.floor(i/w)+7);
  near(reconstructBilinear(affine,w,h,1.25,.6),3*1.25-2*.6+7);
  near(integrateBox(affine,w,h,.25,3.75,.1,1.9),3*2-2+7);
  const product=Array.from({length:w*h},(_,i)=>(i%w)*Math.floor(i/w));
  near(integrateBox(product,w,h,.25,3.75,.1,1.9),2);
  const impulse=[0,0,0,0,1];
  near(integrateBox(impulse,5,1,3,4,0,0),.5);
  near(integrateBox(impulse,5,1,4,6,-1,1),1);
  near(integrateBox([1],1,1,-10,100,-2,7),1);
  for(const [lo,hi] of [[-4,-2],[-2,.1],[.3,3.7],[3.9,5],[8,20],[2,2]])near(boxAxisWeights(5,lo,hi).reduce((a,b)=>a+b,0),1);
}

test("geometryMatrix",geometryMatrix);
test("normalsAndCurvature",normalsAndCurvature);
test("samplingMatrix",samplingMatrix);
test("envelopeChecks",envelopeChecks);
test("precisionChecks",precisionChecks);
test("reconstructionChecks",reconstructionChecks);
