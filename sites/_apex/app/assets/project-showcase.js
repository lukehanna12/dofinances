// Native adaptation of Colosseum utility 0001c4, How It Works 2 (Recovered).
// Numbered image-reveal cards, divided details, no React dependency.
import {WORKSPACE_WALLPAPERS} from "./workspace-wallpapers.js";

export const PROJECT_SHOWCASE=Object.freeze([
 {slug:"bootscript",name:"BootScript",kind:"Developer tooling",repository:null,status:"in-progress",docs:true},
 {slug:"bootscribe",name:"BootScribe",kind:"Developer tooling",repository:null,status:"in-progress",docs:true},
 {slug:"translucence-lab",name:"Lightwork",kind:"Translucence experiments",repository:"lukehanna12/lightwork",status:"in-progress",docs:true},
 {slug:"github-readme-chrome-extension",name:"ReadMe GLP",kind:"Browser extension",repository:null,status:"in-progress",docs:true},
 {slug:"chatgpt-chat-save-chrome-extension",name:"ChatStore",kind:"Browser extension",repository:"lukehanna12/chatstore",status:"in-progress",docs:true},
 {slug:"colosseum",name:"Colosseum",kind:"Development platform",repository:"lukehanna12/colosseum"},
 {slug:"apple-hig-reader",name:"Apple HIGs Reader",kind:"Documentation reader",repository:"lukehanna12/apple-higs-reader",status:"in-progress"},
 {slug:"terminal-scalars",name:"Terminal Scalars",kind:"Terminal utility",repository:null},
 {slug:"unicode-plus",name:"Unicode Plus",kind:"Unicode utility",repository:"lukehanna12/unicode-plus"},
 {slug:"liquid-plexiglass-26",name:"Liquid Plexiglass 26",kind:"Material research",repository:null},
 {slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null},
 {slug:"apple-adobe-fx",name:"Apple Adobe FX",kind:"Creative tooling",repository:null},
 {slug:"protocol-monitor-pruner",name:"Protocol Monitor Pruner",kind:"Developer utility",repository:"lukehanna12/protocol-monitor-pruner",status:"in-progress"},
 {slug:"app-caviar",name:"App Caviar",kind:"Application",repository:null},
 {slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null}
]);
const PHOTO_ROUTES=Object.freeze([
 "projects","colosseum/readme","colosseum/utilities","colosseum/collections",
 "colosseum/providers","colosseum/permissions","colosseum/diagnostics","settings"
]);
function imagePath(index){
 const wallpaper=WORKSPACE_WALLPAPERS[PHOTO_ROUTES[index%PHOTO_ROUTES.length]];
 return wallpaper.path||"/wallpapers/"+wallpaper.sha+"."+wallpaper.ext;
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
 const status=project.status==="in-progress"?"In Progress":active?"Active":"Coming Soon";
 const statusClass=project.status==="in-progress"?"project-showcase-badge--progress":active?"project-showcase-badge--active":"project-showcase-badge--soon";
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
 const src=imagePath(index);
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
 const number=element("span","project-showcase-number",String(index+1));
 number.setAttribute("aria-hidden","true");
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
 // Account records are authoritative for the three curated repository links.
 const linkedSlugs=new Set(["unicode-plus","translucence-lab","chatgpt-chat-save-chrome-extension"]);
 const account=new Map((Array.isArray(projects)?projects:[])
  .filter(p=>p&&linkedSlugs.has(p.slug)).map(p=>[p.slug,p]));
 // Preserve account-created projects: the curated items always come first.
 const additional=(Array.isArray(projects)?projects:[])
  .filter(p=>p&&typeof p.slug==="string"&&typeof p.name==="string"&&!canonical.has(p.slug)&&p.slug!=="3d-liquid-glass-27-swift-package")
  .map(p=>({slug:p.slug,name:p.name,kind:"Project workspace",repository:p.repository||null}));
 const entries=[...PROJECT_SHOWCASE.map(project=>{
  const saved=account.get(project.slug);
  return saved?{...project,repository:saved.repository||null}:project;
 }),...additional];
 const fragment=document.createDocumentFragment();
 entries.forEach((project,index)=>fragment.append(makeCard(project,index,slugRoute)));
 root.replaceChildren(fragment);
 return entries.length;
}
