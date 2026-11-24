/* GPU-resident original image sources for shared glass regions, never
 * screen/DOM capture. A bounded 512² source grid with real GPU mip levels
 * projects the quarter-scale Regular optics into the browser transport. */
import {PROJECT_SHOWCASE} from "../public-projects-catalog.js";
export const ART_SIZE=512;
export const ART_LAYERS=PROJECT_SHOWCASE.length;
const LAYERS=new Map(PROJECT_SHOWCASE.map((p,i)=>[p.slug,i]));
export const REGION_FLOATS=16;
export function artworkCoverTransform(width,height,iw,ih,sx=1,sy=1,tx=0,ty=0){
 const fit=Math.max(width/iw,height/ih);
 const x=width/(iw*fit*sx),y=height/(ih*fit*sy);
 return [x,y,.5-x*.5-tx/width*x,.5-y*.5-ty/height*y];
}
export function createGlassArtworkAtlas(device,mipPipeline,wake){
 const levels=Math.log2(ART_SIZE)+1;
 const texture=device.createTexture({label:"Public artwork source layers (lazy upload)",
  size:[ART_SIZE,ART_SIZE,ART_LAYERS],mipLevelCount:levels,format:"rgba16float",
  usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|
    GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT});
 const view=texture.createView({dimension:"2d-array"});
 const slots=new Map();
 let disposed=false;
 function sync(card){
  const layer=LAYERS.get(card.dataset.projectSlug);
  const photo=card.querySelector(".project-showcase-photo");
  if(layer===undefined||!photo)return null;
  const source=photo.currentSrc||photo.getAttribute("src");
  if(!source||!photo.complete||!photo.naturalWidth)return null;
  let record=slots.get(layer);
  if(record?.source!==source){
   record={source,ready:false,failed:false};
   slots.set(layer,record);
   card.removeAttribute("data-project-art-gpu-ready");
   createImageBitmap(photo,{resizeWidth:ART_SIZE,resizeHeight:ART_SIZE,resizeQuality:"high"}).then(bitmap=>{
    try{
     if(disposed||slots.get(layer)!==record)return;
     device.queue.copyExternalImageToTexture({source:bitmap},
      {texture,origin:[0,0,layer]},[ART_SIZE,ART_SIZE,1]);
     const encoder=device.createCommandEncoder({label:"Original project artwork mip chain"});
     for(let level=1;level<levels;level++){
      const sub=(mip)=>texture.createView({dimension:"2d",baseArrayLayer:layer,arrayLayerCount:1,baseMipLevel:mip,mipLevelCount:1});
      const group=device.createBindGroup({layout:mipPipeline.getBindGroupLayout(0),entries:[
       {binding:0,resource:sub(level-1)},{binding:1,resource:sub(level)}]});
      const pass=encoder.beginComputePass();pass.setPipeline(mipPipeline);pass.setBindGroup(0,group);
      const size=Math.max(1,ART_SIZE>>level);pass.dispatchWorkgroups(Math.ceil(size/8),Math.ceil(size/8));pass.end();
     }
     device.queue.submit([encoder.finish()]);
     record.ready=true;wake();
    }finally{bitmap.close();}
   }).catch(error=>{record.failed=true;console.warn("Project artwork GPU source",String(error));wake();});
  }
  if(!record.ready)return null;
  if(!card.hasAttribute("data-project-art-gpu-ready"))card.setAttribute("data-project-art-gpu-ready","");
  return {layer,photo,source};
 }
 return {view,sync,dispose(){disposed=true;texture.destroy();slots.clear();}};
}
