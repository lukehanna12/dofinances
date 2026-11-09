/* Single shared wallpaper registry for both /app interfaces and the Worker.
 * Originals: Colosseum Wallpapers 0001b9, Cloudflare library-iii.
 * Each blob is SHA-256 addressed at /objects/<sha>.bin. */
export const WORKSPACE_WALLPAPERS = Object.freeze({
  "home": {
    "sha": "937fc1cdf4756a9ceb0da7772e4a8fcff3b197f3ed8904d898e3923ccb29b386",
    "ext": "jpg",
    "name": "misty-fjord-coastal-village.jpg",
    "position": "center 49%"
  },
  "projects": {
    "sha": "d29b17594f91a2dd8388cb4fb0f190013125c0c2fff0a9c1d779130c289d7309",
    "ext": "png",
    "name": "stormy-mountain-lake-rays.png",
    "position": "center 44%"
  },
  "settings": {
    "sha": "ade03e6d5958ddb9e1e5098ad67d46b7f4c801057aa77c85510d846ef8f75091",
    "ext": "png",
    "name": "golden-ridges-dark-sand.png",
    "position": "center 48%"
  },
  "colosseum/utilities": {
    "sha": "8bf11dba5a786e9a396f7aeded17c02a0e0053f27cc94a568ee6d8e71c0cbdf0",
    "ext": "jpg",
    "name": "blue-gray-eroded-hills.jpg",
    "position": "center 46%"
  },
  "colosseum/collections": {
    "sha": "50e820a2a0ca168ddbeb3670afc0823618472fdbd61969a56c6d168666de0cc9",
    "ext": "jpg",
    "name": "autumn-alpine-river-valley.jpg",
    "position": "center 45%"
  },
  "colosseum/providers": {
    "sha": "c3b94c754a35e440165cfea8985f4f699e53958d495cb4011377bf941529d021",
    "ext": "jpg",
    "name": "autumn-forest-black-trunks.jpg",
    "position": "center 45%"
  },
  "colosseum/permissions": {
    "sha": "2ba90f393e4c027410d929dee1f3bfc99a178cce522b1876e01ab314fc26dbb8",
    "ext": "png",
    "name": "golden-aspens-dark-forest.png",
    "position": "center 45%"
  },
  "colosseum/diagnostics": {
    "sha": "816843e6a54c12a3f337fa1d8251575a84b24fd59c0b54709e269378f10cf8b6",
    "ext": "jpg",
    "name": "blue-gray-eroded-badlands.jpg",
    "position": "center 45%"
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
  doc.body.dataset.wallpaper=name;
  return wallpaper;
}
