/* Public /projects route: owns card markup, artwork reveal, staggered entry
 * and exact reversed exit. The persistent '/' shell alone owns wallpaper,
 * WebGPU material/canvas, doof, the mosaic and bottom-button dissolution.
 * Project controls intentionally do not navigate or call private APIs.
 */
import {PROJECT_SHOWCASE,PROJECT_CARD_ICONS,PROJECT_CARD_IMAGES,
  projectShowcaseStatus,sortProjectShowcase,publicProjectImage} from "./public-projects-catalog.js";
const reduced=matchMedia("(prefers-reduced-motion: reduce)");
// Keep in sync with the route-owned CSS reverse stagger and final header exit.
const PROJECT_EXIT_DURATION_MS=420;
const PROJECT_EXIT_STAGGER_MS=45;
const PROJECT_EXIT_TAIL_MS=60;
const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
};
function row(text){
  const item=el("span","project-showcase-row");
  item.append(el("span","",text));
  return item;
}
function makeCard(project,index){
  const status=projectShowcaseStatus(project);
  const active=Boolean(project.repository||project.docs===true);
  const badgeClass=status==="In Progress"?"project-showcase-badge--progress":
    status==="Active"?"project-showcase-badge--active":"project-showcase-badge--soon";
  const card=el("button","project-showcase-card "+(active?"is-active":"is-coming-soon"));
  card.type="button";
  card.dataset.publicProjectGlass="card";
  card.dataset.projectSlug=project.slug;
  card.setAttribute("aria-label",project.name+" · "+status+" · Preview only");
  card.style.setProperty("--project-index",String(index));
  card.style.setProperty("--project-reverse-index",String(Math.min(PROJECT_SHOWCASE.length-1-index,12)));
  // No location changes, hrefs, or private /api/projects calls.
  const photo=el("img","project-showcase-photo");
  photo.alt="";photo.loading="lazy";photo.decoding="async";
  const src=publicProjectImage(project,index);
  const preferred=PROJECT_CARD_IMAGES[project.slug];
  photo.addEventListener("error",()=>{
    if(preferred&&photo.getAttribute("src")===src){
      photo.src=publicProjectImage({...project,slug:"__fallback__"},index);
    }
  },{once:true});
  photo.addEventListener("load",()=>card.classList.add("is-photo-ready"),{once:true});
  const reveal=()=>{if(!photo.hasAttribute("src"))photo.src=src;};
  for(const name of ["pointerenter","focusin","pointerdown"])
    card.addEventListener(name,reveal,{once:true});
  const shade=el("span","project-showcase-shade");
  shade.setAttribute("aria-hidden","true");
  const content=el("span","project-showcase-content");
  const upper=el("span","project-showcase-upper");
  const top=el("span","project-showcase-top");
  const iconName=PROJECT_CARD_ICONS[project.slug];
  const marker=el("span","project-showcase-number"+(iconName?" project-showcase-number--icon":""),iconName?undefined:String(index+1));
  marker.setAttribute("aria-hidden","true");
  if(iconName){
    const icon=el("img","project-showcase-lucide");
    icon.src="/assets/project-icons/"+iconName+".svg";
    icon.alt="";icon.width=28;icon.height=28;icon.decoding="async";
    marker.append(icon);
  }
  const badge=el("span","project-showcase-badge "+badgeClass,status);
  top.append(marker,badge);
  const title=el("span","project-showcase-title",project.name);
  const action=el("span","project-showcase-action",active?"View project":"In development");
  if(active){
    const arrow=document.createElementNS("http://www.w3.org/2000/svg","svg");
    for(const [key,value] of Object.entries({
      viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",
      stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round",
      "stroke-linejoin":"round","aria-hidden":"true"
    }))arrow.setAttribute(key,value);
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d","M5 12h14m-6-6 6 6-6 6");
    arrow.append(path);action.append(arrow);
  }
  upper.append(top,title,action);
  const details=el("span","project-showcase-details");
  details.append(row(project.kind),row(project.repository?"GitHub · "+project.repository:
    project.docs?"Local Docs · Editable":"Repository not yet available"));
  content.append(upper,details);
  card.append(photo,shade,content);
  return card;
}
export function mountProjects(host,{onBack,onExitComplete}){
  const projects=sortProjectShowcase(PROJECT_SHOWCASE);
  const root=el("section","public-projects-root");
  root.setAttribute("aria-label","Projects");
  const head=el("header","public-projects-header");
  const back=el("button","public-projects-back");
  back.type="button";
  back.dataset.publicProjectGlass="back";
  back.setAttribute("aria-label","Back to homepage");
  back.title="Back to homepage";
  back.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const title=el("h1","public-projects-title","Projects");
  head.append(back,title);
  const grid=el("div","project-showcase-grid");
  grid.setAttribute("aria-label","Project cards");
  projects.forEach((project,index)=>grid.append(makeCard(project,index)));
  root.append(head,grid);
  host.replaceChildren(root);
  // Keep WebGPU submitting synchronized frames throughout the stagger.
  // Stop its animation loop once the final card has completed its intro.
  let exiting=false,closed=false,timer=null;
  const introTimer=setTimeout(()=>root.classList.add("is-settled"),
    reduced.matches?0:500+12*65+60);
  back.addEventListener("click",event=>{
    if(closed||exiting)return;
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    onBack();
  });
  return {
    exit(){
      if(closed||exiting)return;
      exiting=true;root.classList.add("is-exiting");
      // Reverse the same 24px staggered entry geometry, with shorter
      // per-card timing and closer spacing. The shell restores only after
      // the route-owned reverse completes.
      timer=setTimeout(()=>{timer=null;if(!closed)onExitComplete();},
        reduced.matches?0:PROJECT_EXIT_DURATION_MS+
          Math.min(projects.length-1,12)*PROJECT_EXIT_STAGGER_MS+
          PROJECT_EXIT_TAIL_MS);
    },
    unmount(){
      if(closed)return;closed=true;
      if(timer!==null)clearTimeout(timer);
      clearTimeout(introTimer);
      root.remove();
    }
  };
}
