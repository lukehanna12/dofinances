import {makeIndependentSegmentDistance} from "./native-title-reference.mjs";
export async function referenceIconCache(device,packed,names,icons,coverageTexture,side=128){
 const bytes=Uint8Array.from(atob(packed.curves),c=>c.charCodeAt(0)),dv=new DataView(bytes.buffer);
 const texture=device.createTexture({size:[side,side,32],format:"rgba32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const stride=Math.ceil(side/256)*256,coverage=device.createBuffer({size:stride*side*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const enc=device.createCommandEncoder();enc.copyTextureToBuffer({texture:coverageTexture},{buffer:coverage,bytesPerRow:stride,rowsPerImage:side},[side,side,16]);device.queue.submit([enc.finish()]);await coverage.mapAsync(GPUMapMode.READ);
 const alpha=new Uint8Array(coverage.getMappedRange());let samples=0,segments=0;
 try{for(let i=0;i<16;i++){
  const asset=packed.assets[names[i]],curves=[];
  for(let j=0;j<asset.count;j++){const o=(asset.start+j)*48,points=Array.from({length:4},(_,k)=>[asset.origin[0]+asset.scale*dv.getFloat32(o+8*k,true),asset.origin[1]+asset.scale*dv.getFloat32(o+8*k+4,true)]);curves.push(dv.getFloat32(o+32,true)===1?[points[0],points[3]]:points);}
  const ref=makeIndependentSegmentDistance([curves],.0002),d=ref.distance;segments+=ref.edgeCount;
  const lane=icons.slice(i*20,(i+1)*20),[vx,vy,vw,vh]=asset.viewBox,fit=Math.min(lane[2]/vw,lane[3]/vh),cx=lane[0]+lane[2]*.5,cy=lane[1]+lane[3]*.5,step=Math.max(vw,vh)/256,slot=lane[16]-1,w=lane[17],h=lane[18];
  if(w>side||h>side||slot<0)throw Error("Unsupported independent cache extent");
  const output=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   if(alpha[(slot*side+y)*stride+x]===0)continue;
   const X=vx+vw*.5+(lane[12]+(x+.5)/lane[14]-cx)/fit,Y=vy+vh*.5+(lane[13]+(y+.5)/lane[15]-cy)/fit;
   const gx=d(X+step,Y)-d(X-step,Y),gy=d(X,Y+step)-d(X,Y-step),den=Math.max(2*step,Math.hypot(gx,gy)),o=(y*w+x)*4;
   output[o]=d(X,Y)*fit;output[o+1]=gx/den;output[o+2]=gy/den;output[o+3]=1;samples++;
  }
  device.queue.writeTexture({texture,origin:[0,0,slot]},output,{bytesPerRow:w*16,rowsPerImage:h},[w,h,1]);
 }return {texture,view:texture.createView({dimension:"2d-array"}),samples,segments};}
 finally{coverage.unmap();coverage.destroy();}
}
