import {heldout,sampleBGRA8} from "./bgra8-sampler.mjs";
import {nativeBGRA8Downsample} from "./native-diamond.mjs";
import {createBGRA8GPU} from "./bgra8-gpu.mjs";
const must=(c,m)=>{if(!c)throw Error(m)};
const f16word=(x)=>{const b=new DataView(new ArrayBuffer(2));b.setFloat16(0,x,true);return b.getUint16(0,true);};
const sha=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",v))).map(x=>x.toString(16).padStart(2,"0")).join("");
export async function run(){
 const e=await createBGRA8GPU(),out=[];
 try{
  const sizes=[[16,16],[29,19],[7,11],[64,32],[1,9],[9,1]];
  for(let i=0;i<sizes.length;i++){
   const [w,h]=sizes[i],{src,points}=heldout(w,h,i),v=await e.sample(src,w,h,points);let sampleErrors=0;
   for(let j=0;j<points.length;j+=2)for(let c=0;c<4;c++)sampleErrors+=v[2*j+c]!==f16word(sampleBGRA8(src,w,h,points[j],points[j+1],[2,1,0,3][c]));
   const cpu=nativeBGRA8Downsample(src,w,h),gpu=await e.downsample(src,w,h),again=await e.downsample(src,w,h);let mipErrors=0;
   cpu.values.forEach((v,j)=>{mipErrors+=v!==gpu.values[j]});must(again.values.every((v,j)=>v===gpu.values[j]),"non-repeatable output");
   out.push({w,h,sampleLanes:v.length,sampleErrors,sampleSHA256:await sha(v),mipChannels:cpu.values.length,mipErrors,mipSHA256:await sha(gpu.values)});
  }
  for(let i=4;i<7;i++){
   const [w,h]=[[9,7],[17,11],[63,31]][i-4],src=Uint8Array.from({length:w*h*4},(_,j)=>{const x=(j>>2)%w,y=Math.floor(j/(4*w)),k=j%4,v=(17*x*x+13*y*y+11*x*y+7*k*x+19*k*y+23*k+3*i)%127;return v*2+(x+y+k)%2;});
   const cpu=nativeBGRA8Downsample(src,w,h),gpu=await e.downsample(src,w,h);
   out.push({w,h,mipChannels:cpu.values.length,mipErrors:cpu.values.filter((v,j)=>v!==gpu.values[j]).length,mipSHA256:await sha(gpu.values)});
  }
  must(out.every(x=>!x.sampleErrors&&!x.mipErrors),JSON.stringify(out));
  return {adapter:e.adapter,cases:out};
 }finally{e.dispose();}
}
