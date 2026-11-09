/* Single shared wallpaper registry for both /app interfaces and the Worker.
 * Originals: Colosseum Wallpapers 0001b9, Cloudflare library-iii.
 * Each blob is SHA-256 addressed at /objects/<sha>.bin. */
export const WORKSPACE_WALLPAPERS = Object.freeze({
  "home": {
    "sha": "3dede3066f1b6ca3eb7dfa4bd4ad077eddbcdb80ca95a7213eb8bc47850ef77b",
    "ext": "webp",
    "name": "clouds-over-rice-terraces.webp",
    "position": "center 46%",
    "footerInk": "#303030"
  },
  "projects": {
    "sha": "302138334c5973c7fed71a26037e19a8b94fce8433fecce8bad1454474c36a08",
    "ext": "webp",
    "name": "winding-icelandic-river-mountains.webp",
    "position": "center 44%",
    "footerInk": "#ebebeb"
  },
  "settings": {
    "sha": "ca6bf0317dcb6806a536f5d41b8c54cf34446a196e8a5f7265dc5f10c7f3b957",
    "ext": "avif",
    "name": "misty-tropical-forest-hillside.avif",
    "position": "center 45%",
    "footerInk": "#303030"
  },
  "colosseum/utilities": {
    "sha": "c49181be2b93fe24a44774a7c6f4253f23ec3bf0cfc369a318e420d7418f9eb2",
    "ext": "jpg",
    "name": "waterfall-between-mossy-cliffs.jpg",
    "position": "center 43%",
    "footerInk": "#ebebeb"
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
    "footerInk": "#303030"
  },
  "colosseum/permissions": {
    "sha": "8f54a531db0e7382a7a18c27e0daf5283bfaa8e655fae9da460f21242a3a1ec6",
    "ext": "jpg",
    "name": "autumn-colored-mountain-slopes.jpg",
    "position": "center 45%",
    "footerInk": "#292929"
  },
  "colosseum/diagnostics": {
    "sha": "3203fcc740876cc48c489699ee3f00e5c069fa9a3825cc7afaf2680b836c22cd",
    "ext": "jpg",
    "name": "steam-spewing-yellow-machine.jpg",
    "position": "center 46%",
    "footerInk": "#ebebeb"
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
  doc.body.style.setProperty("--workspace-wallpaper-image",'url("https://dofinances.com/wallpapers/'+name+'")');
  doc.body.style.setProperty("--workspace-wallpaper-position",wallpaper.position);
  doc.body.style.setProperty("--workspace-footer-ink",wallpaper.footerInk);
  doc.body.dataset.wallpaper=name;
  return wallpaper;
}
