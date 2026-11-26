import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {ContinuousScene} from "./sampling.mjs";
import {GROUPS,WEIGHTS,diamond,evenNativeDownsample} from "./native-diamond.mjs";
const near=(a,b,e=1e-12)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test("native exact normalization, symmetry, and dyadic impulse",()=>{
 near(GROUPS.reduce((a,g,i)=>a+g.length*WEIGHTS[i],0),1,0);
 for(let y=-5;y<=6;y++)for(let x=-5;x<=6;x++){
  const src=new Float64Array(16*16*4);src[((8+y)*16+8+x)*4]=1;
  const v=evenNativeDownsample(src,16,16).values[(4*8+4)*4];
  const p=[Math.floor(x/2),Math.floor(y/2)];let expected=0;
  GROUPS.forEach((g,i)=>{if(g.some(q=>q[0]===p[0]&&q[1]===p[1]))expected=WEIGHTS[i]/4;});
  near(v,expected,0);
 }
});
test("continuous diamond preserves constant and affine interior fields at arbitrary coordinates and pitch",()=>{
 const w=64,h=64,src=Float64Array.from({length:w*h*4},(_,i)=>{let x=(i>>2)%w,y=Math.floor(i/(4*w));return [1,.01*x+.002*y,.004*x-.003*y,.5][i%4]});
 const s=new ContinuousScene(w,h,src,{origin:[10000,-20000],step:[.25,.5]});
 for(const x of [19.25,24.001,24.000001,36.5])for(const y of [20.125,30.333,40.5])for(const p of [.3,1,2]){
  const X=10000+.25*x,Y=-20000+.5*y;
  const v=diamond(s,X,Y,.25*p,.5*p),a=s.box(X,Y);
  v.forEach((z,i)=>near(z,a[i]));
 }
});
test("native half/FMA mathematical outputs match all eight observed even texture digests",()=>{
 const cases=[[8,6,"51ab7d669fef7faa54f358ea40f526ebd3b82f7f68a14e6c2a0564ba901c5d98","6b9d2f58b78f8a53049d278a4dee5eb67a5ae788a0f96d9f98e1a93b5500e9ff"],[10,8,"0007ab9560117034a7b0049cde52008bfd38cb8d6936b624ce591daff6cefee7","7b63306b82803f6f2c7678af179379f2e99d2c57be094d1686d3c4ff96ab768b"],[16,16,"945ee15c6fbc33c7d01b92703471db6f217970544c4a16cc8a1bdad40a1dc0c5","a26a8d1c3e1bfd79d0ca300a9740194882675253bcb9dcb3f62c80517c195795"],[32,64,"b4563c900055488f7267e34b03391bb5f9cc5e0a861ca5e6d21afd6acbda547e","d5acd707a9bcb679c2a420a7b3effe517de8599b0e5af4107cbaf664360760e1"]];
 for(let i=0;i<cases.length;i++){
  const [w,h,...expected]=cases[i];
  for(let t=0;t<2;t++){
   const src=Float64Array.from({length:w*h*4},(_,j)=>{const x=(j>>2)%w,y=Math.floor(j/(4*w)),k=j%4,v=(17*x*x+13*y*y+11*x*y+7*k*x+19*k*y+23*k+3*i)%127;return t?v*2+(x+y+k)%2:(v-61)/32;});
   const out=evenNativeDownsample(src,w,h,{unorm:!!t}).values;
   let bytes;if(t)bytes=out;else{const a=new ArrayBuffer(out.length*2),d=new DataView(a);out.forEach((v,j)=>d.setFloat16(2*j,v,true));bytes=new Uint8Array(a);}
   assert.equal(createHash("sha256").update(bytes).digest("hex"),expected[t]);
  }
 }
});
