import {mode4Field,half} from "./native-field.mjs";
import {writeFileSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const f=Math.fround,rows=[];
for(const [w,h,r] of [[80,64,19],[913,307.5,73.125],[190,52,26],[911.5,8,2]])
 for(let i=1;i<=24;i++)for(let j=1;j<=24;j++){
  const a=mode4Field(w*i/40,h*j/40,w,h,r);
  rows.push([a.k,a.normalized,a.hx,a.hy].map(f));
 }
const data=Buffer.alloc(rows.length*16);
rows.forEach((r,i)=>r.forEach((v,j)=>data.writeFloatLE(v,i*16+j*4)));
const digest=b=>createHash("sha256").update(b).digest("hex");
if(process.argv[2]==="generate"){writeFileSync(process.argv[3],data);console.log("INPUT",rows.length,digest(data));}
else{
 const out=readFileSync(process.argv[3]);assert.equal(out.length,rows.length*4);
 const halfBits=x=>{
  const a=Math.abs(x),s=x<0||Object.is(x,-0)?0x8000:0;
  if(a===0)return s;
  if(a===Infinity)return s|0x7c00;
  if(a<2**-14)return s|Math.round(a/2**-24);
  const e=Math.floor(Math.log2(a));return s|((e+15)<<10)|Math.round((a/2**e-1)*1024);
 };
 let stagedMismatch=0,finalMismatch=0,differ=0;
 rows.forEach(([k,n,x,y],i)=>{
  const a=half(half(Math.min(Math.max(half(x),half(y)),0))+half(f(k*half(n))));
  const b=half(f(f(Math.min(Math.max(x,y),0))+f(k*n)));
  const A=out.readUInt16LE(i*4),B=out.readUInt16LE(i*4+2);
  if(A!==halfBits(a)&&!((A&0x7fff)===0&&a===0))stagedMismatch++;
  if(B!==halfBits(b)&&!((B&0x7fff)===0&&b===0))finalMismatch++;
  if(A!==B)differ++;
 });
 console.log(JSON.stringify({rows:rows.length,sha256:digest(out),stagedMismatch,finalMismatch,castOrderDifferent:differ}));
 assert.equal(stagedMismatch,0);assert.equal(finalMismatch,0);assert.ok(differ>0);
}
