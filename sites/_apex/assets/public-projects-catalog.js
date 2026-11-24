/* Public, read-only curated snapshot of the private Projects card metadata.
 * No account-owned records or private APIs are queried on the public route.
 * The source test enforces parity with the canonical private catalog. */
import {validateProjectTitle} from "./public-projects-title.js";
export const PROJECT_SHOWCASE=Object.freeze([
 {slug:"bootscript",name:"BootScript",kind:"Developer tooling",repository:"lukehanna12/bootscript",status:"in-progress",docs:true},
 {slug:"translucence-lab",name:"Lightwork",kind:"Translucence experiments",repository:"lukehanna12/lightwork",status:"in-progress",docs:true},
 {slug:"github-readme-chrome-extension",name:"ReadMe GLP",kind:"Browser extension",repository:"lukehanna12/reademe-glp",status:"in-progress",docs:true},
 {slug:"chatgpt-chat-save-chrome-extension",name:"ChatStore",kind:"Browser extension",repository:"lukehanna12/chatstore",status:"in-progress",docs:true},
 {slug:"colosseum",name:"Colosseum",kind:"Development platform",repository:"lukehanna12/colosseum"},
 {slug:"apple-hig-reader",name:"Apple HIGs Reader",kind:"Documentation reader",repository:"lukehanna12/apple-higs-reader",status:"in-progress"},
 {slug:"terminal-scalars",name:"Terminal Scalars",kind:"Terminal utility",repository:null},
 {slug:"unicode-plus",name:"Unicode Plus",kind:"Unicode utility",repository:"lukehanna12/unicode-plus",status:"in-progress"},
 {slug:"liquid-plexiglass-26",name:"Liquid Plexiglass 26",kind:"Material research",repository:null},
 {slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null},
 {slug:"apple-adobe-fx",name:"Apple Adobe FX",kind:"Creative tooling",repository:null},
 {slug:"protocol-monitor-pruner",name:"Protocol Monitor Pruner",kind:"Developer utility",repository:"lukehanna12/protocol-monitor-pruner",status:"in-progress"},
 {slug:"app-caviar",name:"App Caviar",kind:"Application",repository:null},
 {slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null},
 {slug:"hidden-functions",name:"Hidden Functions",kind:"Project",repository:null,status:"coming-soon"},
 {slug:"latexcel",name:"LaTeXceL",kind:"Project",repository:null,status:"coming-soon"}
]);
// Fail at catalog import/build, not after an overlong title has rendered.
PROJECT_SHOWCASE.forEach(project=>validateProjectTitle(project.name));
const PHOTO_ROUTES=Object.freeze([
 "projects","colosseum/readme","colosseum/utilities","colosseum/collections",
 "colosseum/providers","colosseum/permissions","colosseum/diagnostics","settings"
]);
// Preserve the curated order within each status group. A linked repository
// does not silently promote an explicitly In Progress project to Active.
export function projectShowcaseStatus(project){
 if(project.status==="in-progress")return "In Progress";
 if(project.status==="coming-soon")return "Coming Soon";
 return project.repository||project.docs===true?"Active":"Coming Soon";
}
const STATUS_ORDER=Object.freeze({"Active":0,"In Progress":1,"Coming Soon":2});
export function sortProjectShowcase(projects){
 return [...projects].sort((a,b)=>STATUS_ORDER[projectShowcaseStatus(a)]-STATUS_ORDER[projectShowcaseStatus(b)]);
}
// Stable per-project choices. Unassigned items keep their current marker and wallpaper.
// Existing published artwork remains linked to original sources; user-supplied Terminal Scalars art is a local optimized asset.
export const PROJECT_CARD_ICONS=Object.freeze({
  "colosseum":"colosseum-lucide",
  "bootscript":"paint-roller",
  "translucence-lab":"lightwork.v3",
  "github-readme-chrome-extension":"file-pen",
  "chatgpt-chat-save-chrome-extension":"folder-bookmark",
  "terminal-scalars":"terminal-scalars.v2",
  "unicode-plus":"square-radical",
  "liquid-plexiglass-26":"lens",
  "3d-liquid-glass-26-swift-package":"move-3d",
  "apple-hig-reader":"apple-higs-reader.v4",
  "apple-adobe-fx":"apple-adobe-fx.v2",
  "protocol-monitor-pruner":"funnel-code",
  "app-caviar":"opacity",
  "ozoning-board":"treehouse-ozoning.v4",
  "hidden-functions":"hidden-functions",
  "latexcel":"latexcel"
});
/* One public source for project icon asset URLs. Both the Projects cards
 * and the Home mosaic reference this same lookup and exact same SVG file.
 * Styling owns black-on-Home vs white-on-Projects; SVGs stay unmodified. */
export function publicProjectIconSource(slug){
 const icon=PROJECT_CARD_ICONS[slug];
 return icon?"/assets/project-icons/"+icon+".svg":null;
}
export const PROJECT_CARD_IMAGES=Object.freeze({
  "bootscript":"https://uploads7.wikiart.org/images/frederic-remington/buying-polo-ponies-in-the-west-1905.jpg%21Large.jpg",
  "translucence-lab":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg/960px-The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg",
  "github-readme-chrome-extension":"https://upload.wikimedia.org/wikipedia/commons/f/f0/Monet_-_Valley_of_the_Petite_Creuse%2C_1889.jpg",
  "chatgpt-chat-save-chrome-extension":"https://gagosian.com/media/images/exhibitions/2023/takashi-murakami-understanding-the-new-cognitive-domain/c0V9eYeBTMHL_2400x2400.jpg",
  "colosseum":"https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg/960px-Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg",
  "apple-hig-reader":"https://thisishell-assets.s3.amazonaws.com/uploads/interview/image/784/990RiccardoManzotti.jpg",
  "terminal-scalars":"/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp",
  "app-caviar":"/assets/project-art/app-caviar-source.v1.webp",
  "hidden-functions":"https://api.nga.gov/iiif/5fcee9f7-9c78-4432-96c2-4228fc697aa7/full/!800,800/0/default.jpg",
  "latexcel":"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg",
  "unicode-plus":"https://d3d00swyhr67nd.cloudfront.net/w1200h1200/collection/NTI/DYP/NTI_DYP_453771-001.jpg",
  "protocol-monitor-pruner":"https://most-famous-paintings.com/media-resize/960/artworks/images-full/76/18/76183ece8e74b1c3404d66a0bc2e70a6.jpg.webp",
  "liquid-plexiglass-26":"https://museum.bucknell.edu/files/2020/07/Warhol_Glasses-scaled.jpg",
  "ozoning-board":"https://upload.wikimedia.org/wikipedia/commons/a/a9/El_Khasne%2C_Petra_Frederic_Edwin_Church.jpg"
});

const PUBLIC_WALLPAPER_FALLBACKS=Object.freeze([
 "302138334c5973c7fed71a26037e19a8b94fce8433fecce8bad1454474c36a08.webp",
 "ade03e6d5958ddb9e1e5098ad67d46b7f4c801057aa77c85510d846ef8f75091.png",
 "c49181be2b93fe24a44774a7c6f4253f23ec3bf0cfc369a318e420d7418f9eb2.jpg",
 "dcb3d4f1e42bf3aebab2186768a598d17a8aad76e9620a150e268938eee01441.jpg",
 "65dbc89fe23cd47bbcdb76d419fde8168f93e4b6af9f70c533732cf7ee6015c7.jpg",
 "8f54a531db0e7382a7a18c27e0daf5283bfaa8e655fae9da460f21242a3a1ec6.jpg",
 "3203fcc740876cc48c489699ee3f00e5c069fa9a3825cc7afaf2680b836c22cd.jpg",
 "ca6bf0317dcb6806a536f5d41b8c54cf34446a196e8a5f7265dc5f10c7f3b957.avif"
]);
export function publicProjectImage(project,index){
 return PROJECT_CARD_IMAGES[project.slug]||
   "/wallpapers/"+PUBLIC_WALLPAPER_FALLBACKS[index%PUBLIC_WALLPAPER_FALLBACKS.length];
}
