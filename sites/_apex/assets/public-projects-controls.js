/* Route-owned public Projects controls.
 * The shell remains owner of the GPU canvas/material and homepage transitions.
 * These controls own only DOM geometry, interaction, accessibility and
 * search/filter state. All [data-public-project-glass] surfaces are drawn
 * by the existing homepage glassPipeline, never a CSS glass imitation.
 */
import {registerGlassDropdown} from "./home-dashboard/dashboard-glass-dropdown.js";
export const PROJECT_FILTER_CATEGORIES=Object.freeze([
  "Applications","Extensions","Plugins","Add-ons","CLIs"
]);
// Public catalog already declares each project's kind. Keep one explicit
// editorial grouping for every kind rather than claiming private metadata.
export const PROJECT_CATEGORY_BY_KIND=Object.freeze({
  "Developer tooling":"CLIs",
  "Translucence experiments":"Applications",
  "Browser extension":"Extensions",
  "Development platform":"Applications",
  "Documentation reader":"Applications",
  "Terminal utility":"CLIs",
  "Unicode utility":"Applications",
  "Material research":"Add-ons",
  "Swift package":"Add-ons",
  "Creative tooling":"Plugins",
  "Developer utility":"CLIs",
  "Application":"Applications",
  "Project":"Applications"
});
export function projectMatchesFilters(project,query="",selectedCategories=new Set()){
  const selected=selectedCategories instanceof Set?
    selectedCategories:new Set(selectedCategories);
  const category=PROJECT_CATEGORY_BY_KIND[project.kind];
  if(!category||selected.size>0&&!selected.has(category))return false;
  const term=String(query).trim().toLocaleLowerCase();
  if(!term)return true;
  return [project.name,project.kind,project.repository,project.slug]
    .some(value=>String(value||"").toLocaleLowerCase().includes(term));
}
const svg=(body,extra="")=>
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" '+extra+'>'+body+'</svg>';
const SEARCH_ICON=svg('<circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.5 4.5"/>');
// The filter icon is a three-stroke, narrowing-line filter glyph. The SAME
// physical strokes rotate/translate into an upward chevron and return on
// collapse; there are no overlapping SVGs or cross-faded glyph replacements.
const FILTER_MORPH_ICON=svg(
  '<path class="public-projects-filter-morph-left" d="M5 7.5h14"/>'+
  '<path class="public-projects-filter-morph-right" d="M7 12h10"/>'+
  '<path class="public-projects-filter-morph-tail" d="M9.5 16.5h5"/>',
  'class="public-projects-icon-morph"');
const X_ICON=svg('<path d="M6 6l12 12M18 6 6 18"/>');
const CHECK_ICON=svg('<path d="m5 12 4 4L19 6"/>');
const GITHUB_ICON='<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.557 21.925c.563.104.769-.244.769-.542 0-.268-.01-.976-.015-1.915-3.127.679-3.787-1.507-3.787-1.507-.511-1.298-1.248-1.645-1.248-1.645-1.021-.697.077-.683.077-.683 1.129.079 1.723 1.16 1.723 1.16 1.003 1.721 2.63 1.224 3.27.936.101-.727.392-1.224.714-1.506-2.496-.284-5.12-1.248-5.12-5.558 0-1.228.438-2.231 1.158-3.018-.117-.285-.502-1.428.11-2.977 0 0 .943-.302 3.094 1.153A10.775 10.775 0 0 1 12 6.43c.956.004 1.918.129 2.817.379 2.149-1.455 3.09-1.153 3.09-1.153.613 1.549.227 2.692.112 2.977.722.787 1.156 1.79 1.156 3.018 0 4.32-2.628 5.271-5.132 5.549.403.349.763 1.038.763 2.093 0 1.511-.014 2.731-.014 3.102 0 .301.204.652.774.54A11.253 11.253 0 0 0 12 .75z"/></svg>';
const SEARCH_EXPAND_MS=320;
const FILTER_DROP_MS=270;
const el=(tag,className)=>{
  const node=document.createElement(tag);
  node.className=className;
  return node;
};
const namedButton=(className,label,role)=>{
  const node=el("button",className);
  node.type="button";
  node.setAttribute("aria-label",label);
  node.dataset.publicProjectGlass=role;
  return node;
};
export function mountProjectControls({root,headingRow,grid,projects,animateGlass}){
  const cards=[...grid.querySelectorAll(".project-showcase-card")];
  if(cards.length!==projects.length)
    throw new Error("Public project catalog and card count must match");
  const toolbar=el("div","public-projects-toolbar");
  toolbar.setAttribute("role","group");
  toolbar.setAttribute("aria-label","Project tools");

  const searchWrap=el("div","public-projects-search-wrap");
  const searchButton=namedButton("public-projects-tool-button public-projects-search-button",
    "Search projects","search");
  searchButton.innerHTML=SEARCH_ICON;
  searchButton.setAttribute("aria-expanded","false");

  const searchField=el("div","public-projects-search-field");
  searchField.dataset.publicProjectGlass="search-field";
  searchField.innerHTML=SEARCH_ICON;
  const input=el("input","public-projects-search-input");
  input.type="search";input.placeholder="Search projects";
  input.setAttribute("aria-label","Search projects");
  input.setAttribute("autocomplete","off");
  input.setAttribute("spellcheck","false");
  input.disabled=true;
  searchField.append(input);

  const cancel=namedButton("public-projects-search-cancel","Cancel project search","search-cancel");
  cancel.innerHTML=X_ICON;
  cancel.setAttribute("aria-hidden","true");
  cancel.tabIndex=-1;
  searchWrap.append(searchButton,searchField,cancel);

  const filterWrap=el("div","public-projects-filter-wrap");
  const filterButton=namedButton("public-projects-tool-button public-projects-filter-button",
    "Filter projects","filter");
  filterButton.innerHTML=FILTER_MORPH_ICON;
  filterButton.setAttribute("aria-haspopup","true");
  filterButton.setAttribute("aria-controls","public-projects-filter-options");
  filterButton.setAttribute("aria-expanded","false");

  const filterPanel=el("div","public-projects-filter-panel");
  filterPanel.dataset.publicProjectGlass="filter-dropdown";
  filterPanel.id="public-projects-filter-options";
  filterPanel.setAttribute("role","group");
  filterPanel.setAttribute("aria-label","Filter projects by type");
  filterPanel.setAttribute("aria-hidden","true");
  filterPanel.inert=true;
  const selected=new Set();
  const options=new Map();
  for(const category of PROJECT_FILTER_CATEGORIES){
    const option=el("button","public-projects-filter-option");
    option.type="button";
    option.setAttribute("aria-pressed","false");
    option.dataset.category=category;
    const label=el("span","public-projects-filter-label");
    label.textContent=category;
    const check=el("span","public-projects-filter-check");
    check.innerHTML=CHECK_ICON;
    check.setAttribute("aria-hidden","true");
    option.append(label,check);
    filterPanel.append(option);
    options.set(category,option);
  }
  const disposeDropdown=registerGlassDropdown(filterPanel,{options:options.values()});
  filterWrap.append(filterButton,filterPanel);

  const github=el("a","public-projects-tool-button public-projects-github-button");
  github.dataset.publicProjectGlass="github";
  github.href="https://github.com/lukehanna12";
  github.target="_blank";github.rel="noopener noreferrer";
  github.setAttribute("aria-label","Open GitHub profile in a new tab");
  github.title="GitHub";
  github.innerHTML=GITHUB_ICON;
  for(const pane of [searchButton,searchField,cancel,filterButton,github]){
    const icon=pane.querySelector("svg");if(icon)icon.dataset.glassPaint="foreground";
  }
  toolbar.append(searchWrap,filterWrap,github);
  headingRow.append(toolbar);

  const empty=el("p","public-projects-empty");
  empty.textContent="No projects match your search and filters.";
  empty.setAttribute("role","status");
  empty.setAttribute("aria-live","polite");
  empty.hidden=true;
  grid.after(empty);

  let query="",searchState="closed",filterOpen=false,disposed=false;
  let searchTimer=null;
  const abort=new AbortController();
  function applyFilters(){
    // A filter changes the visible packing; clear any full-row overlay first.
    root.dispatchEvent(new Event("public-projects:before-filter"));
    let count=0,changed=false;
    for(let i=0;i<projects.length;i++){
      const visible=projectMatchesFilters(projects[i],query,selected);
      if(cards[i].hidden===visible){
        cards[i].hidden=!visible;changed=true;
      }
      if(visible)count++;
    }
    empty.hidden=count!==0;
    root.dataset.visibleProjects=String(count);
    // The renderer observes classes, not [hidden]. Wake the same real GPU
    // pane pass as card geometry collapses/reflows, with no glass fallback.
    if(changed)animateGlass(170);
  }
  const focusInput=()=>{
    if(disposed||searchState!=="opening")return;
    searchState="open";
    searchWrap.classList.add("is-ready");
    searchButton.tabIndex=-1;
    searchButton.setAttribute("aria-hidden","true");
    cancel.tabIndex=0;
    cancel.setAttribute("aria-hidden","false");
    input.focus({preventScroll:true});
    animateGlass(190);
  };
  function expandSearch(){
    if(disposed||searchState==="opening"||searchState==="open")return;
    if(filterOpen)closeFilters();
    clearTimeout(searchTimer);
    searchState="opening";
    input.disabled=false;
    searchButton.setAttribute("aria-expanded","true");
    searchWrap.classList.add("is-expanded");
    animateGlass(SEARCH_EXPAND_MS+90);
    searchTimer=setTimeout(focusInput,reducedMotion()?0:SEARCH_EXPAND_MS);
  }
  function collapseSearch({restoreFocus=true}={}){
    if(disposed||searchState==="closed"||searchState==="closing")return;
    clearTimeout(searchTimer);
    searchState="closing";
    input.blur();input.disabled=true;input.value="";
    query="";applyFilters();
    searchWrap.classList.remove("is-ready","is-expanded");
    searchButton.setAttribute("aria-expanded","false");
    searchButton.setAttribute("aria-hidden","false");
    cancel.setAttribute("aria-hidden","true");
    cancel.tabIndex=-1;
    searchButton.tabIndex=0;
    animateGlass(SEARCH_EXPAND_MS+70);
    searchTimer=setTimeout(()=>{
      if(disposed)return;
      searchState="closed";
      if(restoreFocus)searchButton.focus({preventScroll:true});
    },reducedMotion()?0:SEARCH_EXPAND_MS);
  }
  function openFilters(){
    if(disposed||filterOpen)return;
    filterOpen=true;
    filterWrap.classList.add("is-open");
    filterButton.setAttribute("aria-expanded","true");
    filterButton.setAttribute("aria-label","Collapse project filters");
    filterPanel.setAttribute("aria-hidden","false");
    filterPanel.inert=false;
    animateGlass(FILTER_DROP_MS+70);
  }
  function closeFilters(){
    if(disposed||!filterOpen)return;
    filterOpen=false;
    filterWrap.classList.remove("is-open");
    filterButton.setAttribute("aria-expanded","false");
    filterButton.setAttribute("aria-label","Filter projects");
    filterPanel.setAttribute("aria-hidden","true");
    filterPanel.inert=true;
    animateGlass(FILTER_DROP_MS+70);
  }
  function reducedMotion(){
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  searchButton.addEventListener("click",expandSearch,{signal:abort.signal});
  cancel.addEventListener("click",()=>collapseSearch(),{signal:abort.signal});
  input.addEventListener("input",()=>{
    query=input.value;
    applyFilters();
  },{signal:abort.signal});
  filterButton.addEventListener("click",()=>{
    if(filterOpen)closeFilters();else openFilters();
  },{signal:abort.signal});
  for(const [category,option] of options){
    option.addEventListener("click",()=>{
      if(selected.has(category))selected.delete(category);
      else selected.add(category);
      const active=selected.has(category);
      option.classList.toggle("is-selected",active);
      option.setAttribute("aria-pressed",String(active));
      applyFilters();
    },{signal:abort.signal});
  }
  document.addEventListener("pointerdown",event=>{
    if(filterOpen&&!filterWrap.contains(event.target))closeFilters();
  },{capture:true,signal:abort.signal});
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    if(filterOpen){
      closeFilters();filterButton.focus({preventScroll:true});
      event.preventDefault();
    }else if(searchState!=="closed"){
      collapseSearch();event.preventDefault();
    }
  },{signal:abort.signal});
  applyFilters();
  return {
    closeForExit(){
      // Only the Projects route can request exit; the homepage does not own
      // or inspect search/filter state.
      clearTimeout(searchTimer);
      filterWrap.classList.remove("is-open");
      filterOpen=false;
      filterPanel.inert=true;
      searchWrap.classList.remove("is-ready","is-expanded");
      searchState="closed";input.blur();
    },
    unmount(){
      if(disposed)return;
      disposed=true;
      clearTimeout(searchTimer);
      abort.abort();disposeDropdown();
      empty.remove();toolbar.remove();
    }
  };
}
