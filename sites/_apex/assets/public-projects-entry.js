/* Public /projects route: owns card markup, artwork reveal, staggered entry
 * and exact reversed exit. The persistent '/' shell alone owns wallpaper,
 * WebGPU material/canvas, doof, the mosaic and bottom-button dissolution.
 * Project controls intentionally do not navigate or call private APIs.
 */
import {PROJECT_SHOWCASE,PROJECT_CARD_IMAGES,publicProjectIconSource,
  projectShowcaseStatus,sortProjectShowcase,publicProjectImage} from "./public-projects-catalog.js";
import {mountProjectControls} from "./public-projects-controls.js";
import {mountProjectExpansion} from "./public-projects-expand.js";
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
// Keep the logo only until the (possibly unopened) search capsule approaches
// within 5 CSS pixels below its bottom edge in the scrolled Projects route.
const PROJECT_LOGO_SEARCH_GAP_PX=5;
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
  card.style.setProperty("--project-reverse-index",String(Math.min(PROJECT_SHOWCASE.length-1-index,15)));
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
  mountProjectArtworkReveal(photo,card);
  const reveal=()=>{if(!photo.hasAttribute("src"))photo.src=src;};
  for(const name of ["pointerenter","focusin","pointerdown"])
    card.addEventListener(name,reveal,{once:true});
  const shade=el("span","project-showcase-shade");
  shade.setAttribute("aria-hidden","true");
  const content=el("span","project-showcase-content");
  const upper=el("span","project-showcase-upper");
  const top=el("span","project-showcase-top");
  const iconSource=publicProjectIconSource(project.slug);
  const marker=el("span","project-showcase-number"+(iconSource?" project-showcase-number--icon":""),iconSource?undefined:String(index+1));
  marker.setAttribute("aria-hidden","true");
  if(iconSource){
    const icon=el("img","project-showcase-lucide");
    icon.src=iconSource;
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
  const headingRow=el("div","public-projects-heading-row");
  headingRow.append(title);
  head.append(back,headingRow);
  const grid=el("div","project-showcase-grid");
  grid.setAttribute("aria-label","Project cards");
  projects.forEach((project,index)=>grid.append(makeCard(project,index)));
  root.append(head,grid);
  host.replaceChildren(root);
  // The logo remains the original DOM h1, not a duplicated text or image.
  // Projects pins it to body to escape the home's centered, transformed
  // mosaic containing block. Unmount puts it back before Home resumes.
  document.body.dataset.projectsLogoPinned="true";
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
  const routeScroll=root.closest("#public-route-content");
  const logo=document.getElementById("dashboard-title");
  const logoHomeParent=logo?.parentElement??null;
  if(logoHomeParent)document.body.append(logo);
  const searchCapsule=headingRow.querySelector(".public-projects-search-field");
  const logoScrollAbort=new AbortController();
  let logoHidden=false;
  const syncLogoWithScroll=()=>{
    if(closed||exiting||!routeScroll||!logo||!searchCapsule)return;
    // The search capsule exists even while collapsed, and scaleX does not
    // change its vertical position. Measure its real rect, not search state
    // or the input's visibility. Use doof's displayed compact bounds.
    const searchTop=searchCapsule.getBoundingClientRect().top;
    const logoBottom=logo.getBoundingClientRect().bottom;
    const hide=routeScroll.scrollTop>0&&
      searchTop<=logoBottom+PROJECT_LOGO_SEARCH_GAP_PX;
    if(hide===logoHidden)return;
    logoHidden=hide;
    document.body.toggleAttribute("data-projects-logo-hidden",hide);
  };
  // Only native Projects scrolling controls the visibility threshold.
  // A window-width or window-height resize must not change the doof
  // opacity, and no viewport-resize handler should reposition the logo.
  routeScroll?.addEventListener("scroll",syncLogoWithScroll,
    {passive:true,signal:logoScrollAbort.signal});
  syncLogoWithScroll();
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
      logoScrollAbort.abort();
      if(logoHomeParent&&logo?.parentElement===document.body)
        logoHomeParent.append(logo);
      document.body.removeAttribute("data-projects-logo-pinned");
      document.body.removeAttribute("data-projects-logo-hidden");
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
