// Native adaptation of Colosseum utility 0001c4, How It Works 2 (Recovered).
// Numbered image-reveal cards, divided details, no React dependency.
import {WORKSPACE_WALLPAPERS} from "./workspace-wallpapers.js";

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
  "translucence-lab":"lightbulb",
  "github-readme-chrome-extension":"file-pen",
  "chatgpt-chat-save-chrome-extension":"folder-bookmark",
  "terminal-scalars":"square-terminal",
  "unicode-plus":"square-radical",
  "liquid-plexiglass-26":"lens",
  "3d-liquid-glass-26-swift-package":"move-3d",
  "apple-hig-reader":"apple-higs-reader.v4",
  "apple-adobe-fx":"blend",
  "protocol-monitor-pruner":"funnel-code",
  "app-caviar":"opacity",
  "ozoning-board":"treehouse-ozoning.v3",
  "hidden-functions":"hidden-functions",
  "latexcel":"latexcel"
});
export const PROJECT_CARD_IMAGES=Object.freeze({
  "bootscript":"https://uploads7.wikiart.org/images/frederic-remington/buying-polo-ponies-in-the-west-1905.jpg%21Large.jpg",
  "translucence-lab":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg/960px-The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg",
  "github-readme-chrome-extension":"https://upload.wikimedia.org/wikipedia/commons/f/f0/Monet_-_Valley_of_the_Petite_Creuse%2C_1889.jpg",
  "chatgpt-chat-save-chrome-extension":"https://gagosian.com/media/images/exhibitions/2023/takashi-murakami-understanding-the-new-cognitive-domain/c0V9eYeBTMHL_2400x2400.jpg",
  "colosseum":"https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg/960px-Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg",
  "apple-hig-reader":"https://thisishell-assets.s3.amazonaws.com/uploads/interview/image/784/990RiccardoManzotti.jpg",
  "terminal-scalars":"/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp",
  "unicode-plus":"https://d3d00swyhr67nd.cloudfront.net/w1200h1200/collection/NTI/DYP/NTI_DYP_453771-001.jpg",
  "protocol-monitor-pruner":"https://most-famous-paintings.com/media-resize/960/artworks/images-full/76/18/76183ece8e74b1c3404d66a0bc2e70a6.jpg.webp",
  "liquid-plexiglass-26":"https://museum.bucknell.edu/files/2020/07/Warhol_Glasses-scaled.jpg",
  "ozoning-board":"https://upload.wikimedia.org/wikipedia/commons/a/a9/El_Khasne%2C_Petra_Frederic_Edwin_Church.jpg"
});
function fallbackImagePath(index){
 const wallpaper=WORKSPACE_WALLPAPERS[PHOTO_ROUTES[index%PHOTO_ROUTES.length]];
 return wallpaper.path||"/wallpapers/"+wallpaper.sha+"."+wallpaper.ext;
}
function imagePath(project,index){
 return PROJECT_CARD_IMAGES[project.slug]||fallbackImagePath(index);
}
function element(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function row(text){
 const box=element("div","project-showcase-row");
 box.append(element("span","",text));
 return box;
}
function makeCard(project,index,slugRoute){
 const active=!!project.repository||project.docs===true;
 const status=projectShowcaseStatus(project);
 const statusClass=status==="In Progress"?"project-showcase-badge--progress":status==="Active"?"project-showcase-badge--active":"project-showcase-badge--soon";
 const card=element(active?"a":"article","project-showcase-card "+(active?"is-active":"is-coming-soon"));
 card.dataset.projectSlug=project.slug;
 card.style.setProperty("--project-index",String(index));
 card.setAttribute("aria-label",project.name+" · "+status);
 if(active)card.href="#"+slugRoute(project.slug);
 else card.tabIndex=0;

 // Wallpaper objects are already public, SHA-allowlisted and served by our Worker.
 // Do not fetch the full photographic image until hover, focus or touch.
 const photo=element("img","project-showcase-photo");
 photo.alt="";photo.loading="lazy";photo.decoding="async";
 const src=imagePath(project,index);
 const preferred=PROJECT_CARD_IMAGES[project.slug];
 // If an external publisher removes or blocks its file, keep the card usable.
 photo.addEventListener("error",()=>{
  if(preferred&&photo.getAttribute("src")===src)photo.src=fallbackImagePath(index);
 },{once:true});
 photo.addEventListener("load",()=>card.classList.add("is-photo-ready"),{once:true});
 const reveal=()=>{if(!photo.hasAttribute("src"))photo.src=src;};
 card.addEventListener("pointerenter",reveal,{once:true});
 card.addEventListener("focusin",reveal,{once:true});
 card.addEventListener("pointerdown",reveal,{once:true});
 const shade=element("span","project-showcase-shade");
 shade.setAttribute("aria-hidden","true");
 const content=element("span","project-showcase-content");
 const upper=element("span","project-showcase-upper");
 const top=element("span","project-showcase-top");
 const iconName=PROJECT_CARD_ICONS[project.slug];
 const number=element("span","project-showcase-number"+(iconName?" project-showcase-number--icon":""),iconName?undefined:String(index+1));
 number.setAttribute("aria-hidden","true");
 if(iconName){
  const icon=element("img","project-showcase-lucide");
  icon.src="/app/assets/project-icons/"+iconName+".svg";
  icon.width=28;icon.height=28;icon.alt="";icon.decoding="async";
  number.append(icon);
 }
 const badge=element("span","project-showcase-badge "+statusClass,status);
 top.append(number,badge);
 const title=element("span","project-showcase-title",project.name);
 const action=element("span","project-showcase-action",active?"View project":"In development");
 if(active){
  const arrow=document.createElementNS("http://www.w3.org/2000/svg","svg");
  for(const [key,value] of Object.entries({viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true"}))
   arrow.setAttribute(key,value);
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d","M5 12h14m-6-6 6 6-6 6");arrow.append(path);action.append(arrow);
 }
 upper.append(top,title,action);
 const bottom=element("span","project-showcase-details");
 bottom.append(row(project.kind),row(project.repository?"GitHub · "+project.repository:
  project.docs?"Local Docs · Editable":"Repository not yet available"));
 content.append(upper,bottom);
 card.append(photo,shade,content);
 return card;
}
export function renderProjectShowcase(root,projects,slugRoute){
 const canonical=new Set(PROJECT_SHOWCASE.map(p=>p.slug));
 // Account records are authoritative for migrated curated repository links.
 const linkedSlugs=new Set(["bootscript","unicode-plus","translucence-lab","github-readme-chrome-extension","chatgpt-chat-save-chrome-extension"]);
 const account=new Map((Array.isArray(projects)?projects:[])
  .filter(p=>p&&linkedSlugs.has(p.slug)).map(p=>[p.slug,p]));
 // Preserve account-created projects: the curated items always come first.
 const additional=(Array.isArray(projects)?projects:[])
  .filter(p=>p&&typeof p.slug==="string"&&typeof p.name==="string"&&!canonical.has(p.slug)&&p.slug!=="3d-liquid-glass-27-swift-package")
  .map(p=>({slug:p.slug,name:p.name,kind:"Project workspace",repository:p.repository||null}));
 const entries=sortProjectShowcase([...PROJECT_SHOWCASE.map(project=>{
  const saved=account.get(project.slug);
  return saved?{...project,repository:saved.repository||null}:project;
 }),...additional]);
 const fragment=document.createDocumentFragment();
 entries.forEach((project,index)=>fragment.append(makeCard(project,index,slugRoute)));
 root.replaceChildren(fragment);
 return entries.length;
}
