/* GPU-resident original image sources for shared glass regions, never
 * screen/DOM capture. A bounded 512² source grid with real GPU mip levels
 * projects the raw artwork into the browser backdrop transport. */
import {PROJECT_SHOWCASE} from "../public-projects-catalog.js";
export const ART_SIZE=512;
export const ART_LAYERS=PROJECT_SHOWCASE.length;
const LAYERS=new Map(PROJECT_SHOWCASE.map((p,i)=>[p.slug,i]));
export const REGION_FLOATS=24;
export function artworkCoverTransform(width,height,iw,ih,sx=1,sy=1,tx=0,ty=0){
 const fit=Math.max(width/iw,height/ih);
 const x=width/(iw*fit*sx),y=height/(ih*fit*sy);
 return [x,y,.5-x*.5-tx/width*x,.5-y*.5-ty/height*y];
}
// Preserve source aspect and detail up to a bounded 8 MP / 4096px texture.
// Unlike the 512² optical input, this is a display source, never a blur.
export function artworkDetailSize(width,height,limit=4096){
 const scale=Math.min(1,limit/width,limit/height,Math.sqrt(8*1024*1024/(width*height)));
 return [Math.max(1,Math.floor(width*scale)),Math.max(1,Math.floor(height*scale))];
}
export function createGlassArtworkAtlas(device,mipPipeline,wake,detailMipPipeline){
 const levels=Math.log2(ART_SIZE)+1;
 const texture=device.createTexture({label:"Public artwork source layers (lazy upload)",
  size:[ART_SIZE,ART_SIZE,ART_LAYERS],mipLevelCount:levels,format:"rgba16float",
  usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|
    GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT});
 const view=texture.createView({dimension:"2d-array"});
 const slots=new Map();
 let disposed=false,clock=0;
 const DETAIL_BUDGET=96*1024*1024;
 function releaseDetail(record){
  const view=record.detailView;
  record.detailTexture?.destroy();
  record.detailTexture=null;record.detailView=null;record.detailSize=null;record.detailBytes=0;
  return view;
 }
 function ensureDetail(record,photo,layer){
  if(record.detailView||record.detailPending||record.detailFailed)return;
  record.detailPending=true;
  const size=artworkDetailSize(photo.naturalWidth,photo.naturalHeight,
    Math.min(4096,device.limits.maxTextureDimension2D));
  createImageBitmap(photo,{resizeWidth:size[0],resizeHeight:size[1],resizeQuality:"high"}).then(bitmap=>{
   let detail;
   try{
    if(disposed||slots.get(layer)!==record)return;
    const count=1+Math.floor(Math.log2(Math.max(...size)));
    detail=device.createTexture({label:"Original-aspect project artwork: "+layer,
      size,mipLevelCount:count,format:"rgba8unorm",
      usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|
        GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT});
    device.queue.copyExternalImageToTexture({source:bitmap},{texture:detail},size);
    const encoder=device.createCommandEncoder({label:"Artwork display mip chain"});
    for(let level=1;level<count;level++){
     const sub=mip=>detail.createView({baseMipLevel:mip,mipLevelCount:1});
     const group=device.createBindGroup({layout:detailMipPipeline.getBindGroupLayout(0),entries:[
       {binding:0,resource:sub(level-1)},{binding:1,resource:sub(level)}]});
     const pass=encoder.beginComputePass();pass.setPipeline(detailMipPipeline);pass.setBindGroup(0,group);
     pass.dispatchWorkgroups(Math.ceil(Math.max(1,size[0]>>level)/8),
       Math.ceil(Math.max(1,size[1]>>level)/8));pass.end();
    }
    device.queue.submit([encoder.finish()]);
    record.detailTexture=detail;record.detailView=detail.createView();record.detailSize=size;
    record.detailBytes=Math.ceil(size[0]*size[1]*4*4/3);
    detail=null;record.detailUse=++clock;
   }finally{detail?.destroy();bitmap.close();}
  }).catch(error=>{
   // Keep the same single-fragment ownership if a display upload fails.
   if(disposed||slots.get(layer)!==record)return;
   record.detailFailed=true;record.detailView=texture.createView({dimension:"2d",baseArrayLayer:layer,arrayLayerCount:1});
   record.detailSize=[ART_SIZE,ART_SIZE];record.detailBytes=0;
   console.warn("Project artwork detail source",String(error));
  }).finally(()=>{record.detailPending=false;wake();});
 }
 function sync(card,needsDetail=false,gpuArtwork=true){
  const layer=LAYERS.get(card.dataset.projectSlug);
  const photo=card.querySelector(".project-showcase-photo");
  if(layer===undefined||!photo)return null;
  const source=photo.currentSrc||photo.getAttribute("src");
  if(!source||!photo.complete||!photo.naturalWidth)return null;
  let record=slots.get(layer);
  if(record?.source!==source){
   if(record)releaseDetail(record);
   record={source,ready:false,failed:false,detailUse:0,detailBytes:0};
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
  if(gpuArtwork&&needsDetail){
   record.detailUse=++clock;
   ensureDetail(record,photo,layer);
   if(!record.detailView){card.removeAttribute("data-project-art-gpu-ready");return null;}
  }
  if(!gpuArtwork||record.detailView){
   if(!card.hasAttribute("data-project-art-gpu-ready"))card.setAttribute("data-project-art-gpu-ready","");
  }else card.removeAttribute("data-project-art-gpu-ready");
  return {layer,photo,source,detailView:record.detailView,detailSize:record.detailSize};
 }
 function trimDetails(used){
  const released=[];
  let total=[...slots.values()].reduce((sum,r)=>sum+(r.detailBytes||0),0);
  for(const record of [...slots.values()].sort((a,b)=>a.detailUse-b.detailUse)){
   if(total<=DETAIL_BUDGET)break;
   if(!record.detailTexture||used.has(record.detailView)||record.detailPending)continue;
   // Do not evict a newly requested source while its reveal starts.
   if(clock-record.detailUse<2)continue;
   total-=record.detailBytes;released.push(releaseDetail(record));
  }
  return released;
 }
 return {view,sync,trimDetails,dispose(){
  disposed=true;for(const r of slots.values())releaseDetail(r);texture.destroy();slots.clear();
 }};
}
