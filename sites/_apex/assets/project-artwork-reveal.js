/* A load event only guarantees the bytes arrived, not that an async-decoded
 * bitmap has reached a drawable frame. If the 500ms image zoom starts at load,
 * the first painted bitmap can pop in partway through the transform.
 *
 * Decode first, then establish the untouched (opacity:0, zoomed) CSS state
 * across a rendering frame before enabling the hover transition. This keeps
 * the exact existing zoom and fade timings and never fetches before hover.
 */
export function mountProjectArtworkReveal(photo,card,frame=requestAnimationFrame){
  let generation=0;
  photo.addEventListener("load",async()=>{
    const revision=++generation;
    const source=photo.currentSrc||photo.src;
    try{
      await photo.decode();
    }catch{
      // Some browsers can reject decode() for a nevertheless valid loaded
      // image; never reveal a broken image or an invalidated old source.
      if(!photo.complete||photo.naturalWidth<=0)return;
    }
    const valid=()=>revision===generation&&photo.isConnected&&
      photo.complete&&photo.naturalWidth>0&&
      (photo.currentSrc||photo.src)===source;
    if(!valid())return;
    // Frame 1 commits the still-hidden zoomed baseline. Frame 2 enables
    // the original CSS transition, already backed by decoded pixels.
    frame(()=>{
      if(!valid())return;
      frame(()=>{
        if(valid())card.classList.add("is-photo-ready");
      });
    });
  });
}
