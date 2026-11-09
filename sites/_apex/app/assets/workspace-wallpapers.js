/* Single shared wallpaper registry for both /app interfaces and the Worker.
 * Originals: Colosseum Wallpapers 0001b9, Cloudflare library-iii.
 * Each blob is SHA-256 addressed at /objects/<sha>.bin. */
export const WORKSPACE_WALLPAPERS = Object.freeze({
  "home": {
    "sha": "3dede3066f1b6ca3eb7dfa4bd4ad077eddbcdb80ca95a7213eb8bc47850ef77b",
    "ext": "webp",
    "name": "clouds-over-rice-terraces.webp",
    "position": "center 46%",
    "footerInk": "#5c5c5c"
  },
  "projects": {
    "sha": "302138334c5973c7fed71a26037e19a8b94fce8433fecce8bad1454474c36a08",
    "ext": "webp",
    "name": "winding-icelandic-river-mountains.webp",
    "position": "center 44%",
    "footerInk": "#454545"
  },
  "settings": {
    "sha": "ca6bf0317dcb6806a536f5d41b8c54cf34446a196e8a5f7265dc5f10c7f3b957",
    "ext": "avif",
    "name": "misty-tropical-forest-hillside.avif",
    "position": "center 45%",
    "footerInk": "#626262"
  },
  "colosseum/utilities": {
    "sha": "c49181be2b93fe24a44774a7c6f4253f23ec3bf0cfc369a318e420d7418f9eb2",
    "ext": "jpg",
    "name": "waterfall-between-mossy-cliffs.jpg",
    "position": "center 43%",
    "footerInk": "#666666"
  },
  "colosseum/collections": {
    "sha": "dcb3d4f1e42bf3aebab2186768a598d17a8aad76e9620a150e268938eee01441",
    "ext": "jpg",
    "name": "misty-alpine-mountain-valley.jpg",
    "position": "center 45%",
    "footerInk": "#303030"
  },
  "colosseum/providers": {
    "sha": "65dbc89fe23cd47bbcdb76d419fde8168f93e4b6af9f70c533732cf7ee6015c7",
    "ext": "jpg",
    "name": "green-water-foam-swirls.jpg",
    "position": "center 47%",
    "footerInk": "#c5d0ca"
  },
  "colosseum/permissions": {
    "sha": "8f54a531db0e7382a7a18c27e0daf5283bfaa8e655fae9da460f21242a3a1ec6",
    "ext": "jpg",
    "name": "autumn-colored-mountain-slopes.jpg",
    "position": "center 45%",
    "footerInk": "#505050"
  },
  "colosseum/diagnostics": {
    "sha": "3203fcc740876cc48c489699ee3f00e5c069fa9a3825cc7afaf2680b836c22cd",
    "ext": "jpg",
    "name": "steam-spewing-yellow-machine.jpg",
    "position": "center 46%",
    "footerInk": "#dedede"
  }
});
export function workspaceWallpaperForRoute(route) {
  const key=route==="colosseum/settings"?"settings":route;
  return WORKSPACE_WALLPAPERS[key]||WORKSPACE_WALLPAPERS.home;
}
export function applyWorkspaceWallpaper(doc,route) {
  const wallpaper=workspaceWallpaperForRoute(route);
  const name=wallpaper.sha+"."+wallpaper.ext;
  // Navigation can be exercised against DOM mocks without a body element.
  if(!doc.body?.style?.setProperty)return wallpaper;
  // Avoid invalidating the painted wallpaper if the same asset is re-selected.
  const set=(key,value)=>{
    if(doc.body.style.getPropertyValue?.(key)!==value)
      doc.body.style.setProperty(key,value);
  };
  set("--workspace-wallpaper-image",'url("https://dofinances.com/wallpapers/'+name+'")');
  set("--workspace-wallpaper-position",wallpaper.position);
  set("--workspace-footer-ink",wallpaper.footerInk);
  if(doc.body.dataset.wallpaper!==name)doc.body.dataset.wallpaper=name;
  if(doc.body.dataset.wallpaperRoute!==route)doc.body.dataset.wallpaperRoute=route;
  return wallpaper;
}

/* Route content must respond immediately even when the next wallpaper is
 * uncached. Decode asynchronously and paint only the latest requested image
 * after the browser has an opportunity to commit the navigation state.
 * Keep at most four decoded images alive to bound memory on small Macs. */
export function initWorkspaceWallpaper(doc=document,win=window){
  const decoded=new Map();
  let generation=0;
  const imageURL=wallpaper=>'https://dofinances.com/wallpapers/'+wallpaper.sha+'.'+wallpaper.ext;
  function warm(route){
    if(typeof win.Image!=="function")return null;
    const wallpaper=workspaceWallpaperForRoute(route);
    const name=wallpaper.sha+"."+wallpaper.ext;
    if(decoded.has(name)){
      const hit=decoded.get(name);
      decoded.delete(name);
      decoded.set(name,hit);
      return hit.ready;
    }
    try{
      const img=new win.Image();
      img.decoding="async";
      let completed;
      if(typeof img.decode==="function"){
        img.src=imageURL(wallpaper);
        completed=Promise.resolve(img.decode()).catch(()=>{});
      }else{
        completed=new Promise(resolve=>{
          img.onload=resolve;img.onerror=resolve;
          img.src=imageURL(wallpaper);
          if(img.complete)resolve();
        });
      }
      decoded.set(name,{img,ready:completed});
      while(decoded.size>4)decoded.delete(decoded.keys().next().value);
      return completed;
    }catch{return null;}
  }
  function show(route,first=false){
    const ticket=++generation;
    const wallpaper=workspaceWallpaperForRoute(route);
    const name=wallpaper.sha+"."+wallpaper.ext;
    if(first||doc.body?.dataset?.wallpaper===name){
      applyWorkspaceWallpaper(doc,route);
      return;
    }
    const paint=()=>{
      if(ticket!==generation)return;
      const commit=()=>{
        if(ticket===generation)applyWorkspaceWallpaper(doc,route);
      };
      if(typeof win.requestAnimationFrame==="function")win.requestAnimationFrame(commit);
      else commit();
    };
    const ready=warm(route);
    if(ready)ready.then(paint,paint);
    else paint();
  }
  return {show,warm};
}
