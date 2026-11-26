// Independent Float64 distance and bounded finite-footprint gradient.
// This is a website adapter reference, not recovered Apple optical normals.
import {closestCurve} from "./vector-field.mjs";
export function packedReference(packed,name){
 const asset=packed.assets[name],bytes=Uint8Array.from(atob(packed.curves),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
  const segments=[];
  for(let j=0;j<asset.count;j++){const offset=(asset.start+j)*48;const a=Array.from({length:4},(_,i)=>[asset.origin[0]+asset.scale*view.getFloat32(offset+i*8,true),asset.origin[1]+asset.scale*view.getFloat32(offset+i*8+4,true)]);if(view.getFloat32(offset+32,true)===1)a.splice(1,2);
   segments.push({a,b:[Math.min(...a.map(p=>p[0])),Math.min(...a.map(p=>p[1])),Math.max(...a.map(p=>p[0])),Math.max(...a.map(p=>p[1]))]});
  }
  const d=(x,y)=>{const ordered=segments.map(({a,b})=>({a,lower:Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-y,0,y-b[3]))})).sort((a,b)=>a.lower-b.lower);let best=Infinity;
   for(const q of ordered){if(q.lower>best)break;const r=closestCurve(q.a,[x,y],{tolerance:1e-5,maxNodes:20000});if(!r.converged)return null;best=Math.min(best,r.distance);}
   let parity=false;for(const {a} of segments){const first=a[0],last=a.at(-1);if(!((first[1]<=y&&last[1]>y)||(last[1]<=y&&first[1]>y)))continue;
    const up=last[1]>first[1];let lo=0,hi=1;
    const evalAt=t=>{let p=a.map(p=>p.slice());while(p.length>1)p=p.slice(1).map((q,i)=>[(1-t)*p[i][0]+t*q[0],(1-t)*p[i][1]+t*q[1]]);return p[0];};
    for(let i=0;i<44;i++){let mid=(lo+hi)/2;if((evalAt(mid)[1]<=y)===up)lo=mid;else hi=mid;}
    if(evalAt((lo+hi)/2)[0]>x)parity=!parity;
   }return (parity?-1:1)*best;
  };
  return d;
}
export function boundedGradient(d,x,y,h){
 const a=d(x+h,y),b=d(x-h,y),c=d(x,y+h),e=d(x,y-h);
 if([a,b,c,e].some(v=>v===null))throw Error("Unresolved reference distance");
 const dx=a-b,dy=c-e,len=Math.hypot(dx,dy),den=Math.max(2*h,len);
 return [dx/den,dy/den];
}
