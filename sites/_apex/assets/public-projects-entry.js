import {registerGlassSilhouette} from "./home-dashboard/dashboard-glass-silhouette.js";
import {registerGlassText} from "./home-dashboard/dashboard-glass-text.js";
/* Public /projects route: owns card markup, artwork reveal, staggered entry
 * and exact reversed exit. The persistent '/' shell alone owns wallpaper,
 * WebGPU material/canvas, doof, the mosaic and bottom-button dissolution.
 * Cards expand locally; the expanded See project link opens a public detail view.
 */
import {PROJECT_SHOWCASE,PROJECT_DESCRIPTIONS,PROJECT_DESCRIPTION_FOOTNOTES,PROJECT_CARD_IMAGES,publicProjectIconSource,
  projectShowcaseStatus,sortProjectShowcase,publicProjectImage,publicProjectArtworkSource,publicProjectHref,projectFromPublicHash} from "./public-projects-catalog.js";
import {projectTitleLines,mountProjectTitleSizing} from "./public-projects-title.js";
import {mountProjectControls} from "./public-projects-controls.js";
import {mountProjectExpansion} from "./public-projects-expand.js";
import {createProjectDiagrams} from "./public-projects-diagrams.js";
import {mountProjectArtworkReveal} from "./project-artwork-reveal.js";
import {DISMISS_MS} from "./home-dashboard/dashboard-public-dismiss.js";
const reduced=matchMedia("(prefers-reduced-motion: reduce)");
// One staggered arrival timeline: back chip at 0ms, both heading and three
// toolbar chips at 165ms, first card at 330ms, then the original 65ms
// per-card cascade. The exact WebGPU pane material is unchanged.
const PROJECT_ENTER_DURATION_MS=500;
const PROJECT_ENTER_HEADING_DELAY_MS=165;
const PROJECT_ENTER_FIRST_CARD_DELAY_MS=330;
const PROJECT_ENTER_STAGGER_MS=65;
const PROJECT_ENTER_TAIL_MS=60;
// Keep in sync with the route-owned CSS reverse stagger and final header exit.
const PROJECT_EXIT_DURATION_MS=420;
const PROJECT_EXIT_STAGGER_MS=45;
const PROJECT_EXIT_TAIL_MS=60;
// The homepage's single 440ms tile dissipation begins after the reversed
// 16-card stagger reaches the first card; preserve its exact optical effect.
const PROJECT_HEADER_DISMISS_DELAY_MS=15*PROJECT_EXIT_STAGGER_MS;
const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
};
function makeCard(project,index,{detail=false}={}){
  const status=projectShowcaseStatus(project);
  const active=Boolean(project.repository||project.docs===true);
  const badgeClass=status==="Review"?"project-showcase-badge--review":
    status==="In Progress"?"project-showcase-badge--progress":
    status==="Ready"?"project-showcase-badge--ready":"project-showcase-badge--soon";
  // Separate interactive siblings: a native expansion button and a real
  // navigation link. Never nest a link inside a native button.
  const card=el("article","project-showcase-card "+(active?"is-active":"is-coming-soon"));
  let trigger=null;
  if(!detail){
    trigger=el("button","project-showcase-trigger");
    trigger.type="button";
    trigger.setAttribute("aria-label","Expand "+project.name+" - "+status);
    trigger.setAttribute("aria-expanded","false");
    card.tabIndex=-1;
  }
  card.dataset.publicProjectGlass="card";
  card.dataset.projectSlug=project.slug;
  card.setAttribute("aria-label",project.name+" - "+status);
  card.style.setProperty("--project-index",String(index));
  card.style.setProperty("--project-reverse-index",String(Math.min(PROJECT_SHOWCASE.length-1-index,15)));
  // The same artwork and project catalog serve both public presentations.
  const photo=el("img","project-showcase-photo");
  photo.alt="";photo.loading="lazy";photo.decoding="async";
  const src=publicProjectArtworkSource(project,index);
  const preferred=PROJECT_CARD_IMAGES[project.slug];
  photo.addEventListener("error",()=>{
    if(preferred&&photo.getAttribute("src")===src){
      photo.src=publicProjectImage({...project,slug:"__fallback__"},index);
    }
  },{once:true});
  mountProjectArtworkReveal(photo,card);
  const reveal=()=>{if(!photo.hasAttribute("src"))photo.src=src;};
  for(const name of ["pointerenter","focusin","pointerdown","click"])
    card.addEventListener(name,reveal,{once:true});
  const artwork=el("span","project-showcase-artwork");
  artwork.setAttribute("aria-hidden","true");
  artwork.append(photo);
  const regularBoundary=el("span","project-showcase-regular-boundary");
  regularBoundary.setAttribute("aria-hidden","true");
  const content=el("span","project-showcase-content");
  // Ordinary card text, badges and actions are native DOM foreground.
  const upper=el("span","project-showcase-upper");
  const top=el("span","project-showcase-top");
  const iconSource=publicProjectIconSource(project.slug);
  const marker=el("span","project-showcase-number"+(iconSource?" project-showcase-number--icon":""),iconSource?undefined:String(index+1));
  marker.setAttribute("aria-hidden","true");
  if(iconSource){
    const icon=el("img","project-showcase-lucide");
    icon.src=iconSource;
    icon.alt="";icon.width=46;icon.height=46;icon.decoding="async";
    registerGlassSilhouette(icon);
    marker.append(icon);
  }
  const badge=el("span","project-showcase-badge "+badgeClass);
  badge.append(el("span","project-showcase-badge-label",status));
  top.append(marker,badge);
  const title=el(detail?"h1":"span","project-showcase-title");
  const lines=projectTitleLines(project.name);
  card.style.setProperty("--project-title-lines",String(lines.length));
  // Preserve original accessible text; all lines inherit one font size.
  lines.forEach((line,i)=>{
    if(i)title.append(document.createTextNode(" "));
    title.append(el("span","project-showcase-title-line",line));
  });
  title.style.setProperty("--project-title-max-size",120/lines.length/1.04+"px");
  const action=el("a","project-showcase-action","See project");
  action.href=publicProjectHref(project);
  action.tabIndex=-1;
  {
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
  upper.append(top,title);
  const description=el("span","project-showcase-description",PROJECT_DESCRIPTIONS[project.slug]);
  description.id="project-description-"+project.slug;
  description.setAttribute("role","paragraph");
  const footnote=PROJECT_DESCRIPTION_FOOTNOTES[project.slug];
  if(footnote)description.append(el("span","project-showcase-description-footnote",footnote));
  description.setAttribute("aria-hidden","true");
  const details=el("span","project-showcase-expanded-detail");
  details.append(description,createProjectDiagrams(project.slug));
  if(!detail)details.append(action);
  content.append(upper,details);
  card.append(artwork,regularBoundary);
  if(trigger)card.append(trigger);
  card.append(content);
  if(detail){photo.loading="eager";reveal();}
  return card;
}
function mountProjectGallery(host,{onBack,onExitComplete,onProject}){
  const projects=sortProjectShowcase(PROJECT_SHOWCASE);
  const root=el("section","public-projects-root");
  root.setAttribute("aria-label","Projects");
  root.style.setProperty("--project-heading-enter-delay",PROJECT_ENTER_HEADING_DELAY_MS+"ms");
  root.style.setProperty("--project-first-card-enter-delay",PROJECT_ENTER_FIRST_CARD_DELAY_MS+"ms");
  const head=el("header","public-projects-header");
  const back=el("button","public-projects-back");
  back.type="button";
  back.dataset.publicProjectGlass="back";
  back.setAttribute("aria-label","Back to homepage");
  back.title="Back to homepage";
  back.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const title=el("h1","public-projects-title","Projects");
  // The DOM heading remains semantic and supplies its computed font shape.
  // The shared WebGPU shader refracts through the GLYPHS, not a text box.
  title.dataset.publicProjectGlass="title";
  registerGlassText(title);
  const headingRow=el("div","public-projects-heading-row");
  headingRow.append(title);
  head.append(back,headingRow);
  const grid=el("div","project-showcase-grid");
  grid.setAttribute("aria-label","Project cards");
  projects.forEach((project,index)=>{
    const card=makeCard(project,index);
    const action=card.querySelector(".project-showcase-action");
    action.addEventListener("click",event=>{
      event.stopPropagation();
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      if(card.classList.contains("is-expanded")&&!root.classList.contains("is-project-reflowing")&&!root.classList.contains("is-exiting"))
        onProject(project);
    });
    grid.append(card);
  });
  root.append(head,grid);
  host.replaceChildren(root);
  mountProjectTitleSizing(root);
  // Route-owned changes extend the live WebGPU submission window. The shared
  // renderer reads each pane's actual DOM rect, never a CSS glass substitute.
  let exiting=false,closed=false,timer=null,headerTimer=null,introFinished=false;
  let controlsAnimating=false,controlTimer=null;
  const settle=()=>{
    if(introFinished&&!controlsAnimating&&!exiting&&!closed)
      root.classList.add("is-settled");
  };
  const animateGlass=durationMs=>{
    if(closed||exiting)return;
    controlsAnimating=true;
    root.classList.remove("is-settled");
    if(controlTimer!==null)clearTimeout(controlTimer);
    controlTimer=setTimeout(()=>{
      controlTimer=null;controlsAnimating=false;settle();
    },reduced.matches?0:durationMs+50);
  };
  const introTimer=setTimeout(()=>{
    introFinished=true;settle();
  },reduced.matches?0:PROJECT_ENTER_FIRST_CARD_DELAY_MS+
    PROJECT_ENTER_DURATION_MS+15*PROJECT_ENTER_STAGGER_MS+PROJECT_ENTER_TAIL_MS);
  const controls=mountProjectControls({root,headingRow,grid,projects,animateGlass});
  const expansion=mountProjectExpansion({root,grid,animateGlass});
  back.addEventListener("click",event=>{
    if(closed||exiting)return;
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    onBack();
  });
  return {
    exit(){
      if(closed||exiting)return;
      exiting=true;expansion.close({immediate:true,restoreFocus:false});
      controls.closeForExit();root.classList.add("is-exiting");
      // In the same time window previously occupied by the header's plain
      // fade, use the HOME SQUARES' single DISMISS_MS optical decoherence.
      // The renderer consumes this timestamp as tile.motion.w; its shader
      // and icon progress helpers are not duplicated by Projects CSS.
      headerTimer=setTimeout(()=>{
        headerTimer=null;
        if(closed)return;
        root.dataset.projectHeaderDismissAt=String(performance.now());
        root.classList.add("is-dissolving-header");
      },reduced.matches?0:PROJECT_HEADER_DISMISS_DELAY_MS);
      // Reverse the same 24px staggered entry geometry, with shorter
      // per-card timing and closer spacing. The shell restores only after
      // the route-owned reverse completes.
      timer=setTimeout(()=>{timer=null;if(!closed)onExitComplete();},
        reduced.matches?0:Math.max(
          PROJECT_EXIT_DURATION_MS+Math.min(projects.length-1,15)*PROJECT_EXIT_STAGGER_MS,
          PROJECT_HEADER_DISMISS_DELAY_MS+DISMISS_MS
        )+PROJECT_EXIT_TAIL_MS);
    },
    unmount(){
      if(closed)return;closed=true;
      if(timer!==null)clearTimeout(timer);
      if(headerTimer!==null)clearTimeout(headerTimer);
      if(controlTimer!==null)clearTimeout(controlTimer);
      clearTimeout(introTimer);
      expansion.unmount();
      controls.unmount();
      root.remove();
    }
  };
}

/* One persistent /projects route, with a gallery and hash-addressable details.
 * Internal catalog slugs never change, so artwork, diagrams and optical
 * vectors continue to use their original single source of truth. */
function mountProjectDetail(host,project,{onBack,onExitComplete}){
  const root=el("section","public-projects-root public-project-detail has-project-expansion");
  root.setAttribute("aria-label",project.name);
  root.dataset.projectDetail=project.slug;
  const head=el("header","public-projects-header");
  const back=el("button","public-projects-back");
  back.type="button";
  back.dataset.publicProjectGlass="back";
  back.dataset.projectDetailBack="";
  back.dataset.glassBackdropLayer="1";
  back.setAttribute("aria-label","Back to Projects");
  back.title="Back to Projects";
  back.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  head.append(back);
  const index=sortProjectShowcase(PROJECT_SHOWCASE).indexOf(project);
  const hero=makeCard(project,index,{detail:true});
  hero.classList.add("is-expanded","project-detail-hero");
  hero.dataset.projectDetailHero="";
  // The existing silhouette stays registered to its original hero pane;
  // move the same node directly above the heading rather than cloning it.
  const title=hero.querySelector(".project-showcase-title");
  title.before(hero.querySelector(".project-showcase-number"));
  const details=hero.querySelector(".project-showcase-expanded-detail");
  details.querySelector(".project-showcase-description").removeAttribute("aria-hidden");
  details.querySelector(".project-showcase-diagrams").removeAttribute("aria-hidden");
  details.classList.add("project-detail-body");
  root.append(head,hero,details);
  host.replaceChildren(root);
  mountProjectTitleSizing(root);
  // The detail view starts immediately below global navigation.
  const abort=new AbortController();
  let closed=false,exiting=false,timer=null;
  const settle=setTimeout(()=>root.classList.add("is-settled"),reduced.matches?0:680);
  back.addEventListener("click",event=>{
    if(!closed&&!exiting&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)onBack();
  },{signal:abort.signal});
  return {
    exit(){
      if(closed||exiting)return;
      exiting=true;root.classList.add("is-exiting","is-dissolving-header");
      root.dataset.projectHeaderDismissAt=String(performance.now());
      timer=setTimeout(onExitComplete,reduced.matches?0:DISMISS_MS+60);
    },
    unmount(){
      if(closed)return;closed=true;abort.abort();clearTimeout(settle);clearTimeout(timer);
      root.remove();
    }
  };
}
export function mountProjects(host,{onBack,onExitComplete}){
  let mounted=null,selected=undefined,closed=false,exiting=false;
  const scroll=host.closest("#public-route-content");
  const syncLocation=()=>{
    if(closed||exiting)return;
    const project=projectFromPublicHash(location.hash);
    if(mounted&&selected===project)return;
    mounted?.unmount();
    selected=project;
    if(scroll)scroll.scrollTop=0;
    const showGallery=()=>{
      if(history.state?.dofinancesProjectDetail){history.back();return;}
      history.replaceState(history.state,"",location.pathname+location.search);
      syncLocation();
    };
    mounted=project?mountProjectDetail(host,project,{onBack:showGallery,onExitComplete}):
      mountProjectGallery(host,{onBack,onExitComplete,onProject:next=>{
        history.pushState({...history.state,dofinancesProjectDetail:true},"",publicProjectHref(next));
        syncLocation();
      }});
    document.title=(project?project.name+" | Projects":"Projects")+" | DoFinances";
  };
  syncLocation();
  return {syncLocation,exit(){exiting=true;mounted?.exit();},
    unmount(){closed=true;mounted?.unmount();mounted=null;}};
}
