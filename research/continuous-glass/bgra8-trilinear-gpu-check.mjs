import {trilinearHeldout,sampleBGRA8Mip} from "./bgra8-sampler.mjs";
import {cases} from "./bgra8-trilinear-fixtures.mjs";
import {createBGRA8LodGPU} from "./bgra8-trilinear-gpu.mjs";
const sha=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",v))).map(x=>x.toString(16).padStart(2,"0")).join("");
export async function run(){
 const e=await createBGRA8LodGPU(),out=[];
 try{for(const [k,w,h,n,native] of cases){
  const {levels,points}=trilinearHeldout(w,h,k,n),gpu=await e.sample(levels,points),again=await e.sample(levels,points),cpu=new DataView(new ArrayBuffer(n*8));
  for(let j=0;j<n;j++)for(let c=0;c<4;c++)cpu.setFloat16(j*8+c*2,sampleBGRA8Mip(levels,points[4*j],points[4*j+1],points[4*j+2],[2,1,0,3][c]),true);
  const hashes=await Promise.all([sha(gpu),sha(again),sha(cpu.buffer)]);
  if(hashes.some(x=>x!==native))throw Error(JSON.stringify({k,native,hashes}));
  out.push({k,w,h,lanes:n*4,sha256:native});
 }return {adapter:e.adapter,cases:out};}finally{e.dispose();}
}
