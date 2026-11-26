import {setBinary16LE} from "./binary16.mjs";
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
   let bytes;if(t)bytes=out;else{const a=new ArrayBuffer(out.length*2),d=new DataView(a);out.forEach((v,j)=>setBinary16LE(d,2*j,v));bytes=new Uint8Array(a);}
   assert.equal(createHash("sha256").update(bytes).digest("hex"),expected[t]);
  }
 }
});

import {nativeCopyBase,nativeFixedMipChain} from "./native-diamond.mjs";
import {fixedMipScenes} from "./native-mip-scenes.mjs";
const hash=a=>createHash("sha256").update(a).digest("hex");
test("complete observed Clear and Regular mip bytes plus explicit source-space phase",()=>{
 const configs=[
 {style:"clear",x:26,width:1,value:136,rows:39,cols:55,hashes:["c8745a3d86c60e73396e2bb15b9de2d5d4c206fd5fdd688108a1a8b768dc8e99","b5f479f7ccb45a3641138b92e5a69cad89d1e9d25f6e5d058571c74b927e31dc","02f7f3b55da57b3f41c79cb1950b11867074c28e12541b3a319bca26aa133322"]},
 {style:"clear",x:27,width:1,value:136,rows:39,cols:55,hashes:["49534ba7034afc55e9140fa4d82c2f3ec00352fd3edcea61350335ae33f12691","1eca3e4057eec6e795b824c68e6cb1bcc4fd72e4c0ad9ffcec8bc673adb1c221","02f7f3b55da57b3f41c79cb1950b11867074c28e12541b3a319bca26aa133322"]},
 {style:"clear",x:26,width:2,value:229,rows:39,cols:55,hashes:["815f66269fb3b0ad53ee6c271e62bca35be6990f0a101e8ec62ccbd0bd54e524","ae693748444d6980e539b297bd09a483e23607a43564f76ae8066d34fc2f88a3","83a54dd4afc05d2572101e3db2b008afa3aca92dce275cf0a0b144780a50b850"]},
 {style:"regular",x:12,width:1,value:89,rows:20,cols:28,hashes:["5cc28ddfd7c855a9fdc7f468ba671d3706316422c03326cb95e986ae99a76959","7eb31c11014138c947c9a395d25a49655470bc1598102530ddcba4adea847ab2"]}
 ];
 for(const c of configs){
  const src=new Uint8Array(64*64*4);
  for(let y=0;y<c.rows;y++)for(let x=0;x<c.cols;x++){const v=x>=c.x&&x<c.x+c.width?c.value:43;src.set([v,v,v,255],(y*64+x)*4);}
  const clear=c.style==="clear";
  const abi=clear?{base:[-21,-21],limits:[0,0,53,37],baseSize:[128,128],mipSize:[64,64],noBaseMip:true,levelCount:3}:{base:[-3,-3],limits:[0,0,25,17],baseSize:[64,64],mipSize:[32,32],noBaseMip:false,levelCount:2};
  const levels=nativeFixedMipChain(src,64,64,abi);assert.deepEqual(levels.map(l=>hash(l.values)),c.hashes);
  const scenes=fixedMipScenes(src,64,64,{...abi,origin:[100,200],step:[.25,.5]});
  assert.deepEqual(scenes.map(s=>s.level.sourcePitch),clear?[2,4,8]:[1,2]);
  assert.deepEqual(scenes.map(s=>s.level.sourceOrigin[0]),clear?[-20.5,-19.5,-17.5]:[-3,-2.5]);
  for(const {level,scene} of scenes)for(const x of [0,1,level.width-1]){
   const v=scene.box(scene.origin[0]+x*scene.step[0],scene.origin[1]);near(v[0],level.values[x*4]/255,1e-15);
  }
 }
});
test("native copy arithmetic matches ten independent crop output hashes",()=>{
 const cases=[
 [18,16,8,6,-3,-2,0,0,16,14,"6ae8bb2a4fdd50cb9cce377d631da373ee844d4a71cce8a57f2e8b67fd84a8fa","217acc363de406c1d1f848869291f2b6a5dfedf3ef5321e647c0edfd6f0de534"],
 [33,27,16,13,1,-4,2,3,30,24,"5dd908d9f00cdd66e438611180ab5490befd4b19c8375c9891f85a738022af3c","90d1664335b78246a0eda84d4bd5645ba319a7867f4c39f79ffb8ffa89e2294f"],
 [64,64,32,32,-9,-7,4,3,53,52,"3727cc71e9b3a310c0398f1c8a4c1d02bd4f93bd195a12f6eaa5fdb46c6309ed","5def336ad8f021cc444bc18fe6d86722ae7b6571a1dcf64a9bf8bad7aab40ba6"],
 [23,17,11,9,3,2,0,0,21,15,"89a26baf3cc971df9726842373c6ae56d66e98f017113f7a4f1af0ff5d4797b3","c69f74a29bf6ecdefedcf9f6755f8a0d221145302c15a31f154c5c7b634519e4"],
 [8,6,4,3,-1,-1,1,1,6,4,"0d440b6e32aa00654b0dee9fefa628f45d25dc6b267c0924225b071397e0e8e3","3e645d14df626679b0f1e96bab330a193a034cf9ea7e7806c4358735479274c1"]];
 for(let i=0;i<cases.length;i++){
  const [w,h,dw,dh,bx,by,l,t,r,b,...expected]=cases[i];
  for(let type=0;type<2;type++){
   const src=Float64Array.from({length:w*h*4},(_,j)=>{const x=(j>>2)%w,y=Math.floor(j/(4*w)),k=j%4,v=(17*x*x+13*y*y+11*x*y+7*k*x+19*k*y+23*k+3*i)%127;return type?v*2+(x+y+k)%2:(v-61)/32;});
   const [out]=nativeCopyBase(src,w,h,{base:[bx,by],limits:[l,t,r,b],baseSize:[2*dw,2*dh],mipSize:[dw,dh],noBaseMip:true,unorm:!!type});
   let bytes;if(type)bytes=out.values;else{const a=new ArrayBuffer(out.values.length*2),d=new DataView(a);out.values.forEach((v,j)=>setBinary16LE(d,2*j,v));bytes=new Uint8Array(a);}
   assert.equal(hash(bytes),expected[type]);
  }
 }
});
