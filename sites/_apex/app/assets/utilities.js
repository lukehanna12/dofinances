import {formatWorkspaceTime} from "./workspace-nav.js";
import {createUtilityAnnotationEditor} from "./utility-editorial-ui.js";
/* Live Colosseum Utilities — Collections-compatible layout, explicit network I/O.
 * Only the authenticated /api/colosseum/utilities owner bridge can read data.
 * No timers, polling, simulated inventory, or background update checks.
 */
const API="/api/colosseum/utilities";
const CATALOG_API="/api/colosseum/catalog/";
const UID=/^[0-9a-f]{6}$/;
const PAGE_LEFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const PAGE_RIGHT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const PICK_CHECK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
const NAME_PENCIL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15.8 4.7 3.5 3.5M4 20l4.8-1.1L19.6 8.1a2.45 2.45 0 0 0-3.5-3.5L5.3 15.4 4 20Z"/></svg>';
const NAME_APPLY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.4 4.4L19 7.4"/></svg>';
const NAME_CANCEL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ICON_DOWN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=value=>String(value??"").trim();
const parseTags=value=>{
 if(Array.isArray(value))return value.filter(x=>typeof x==="string");
 if(typeof value!=="string")return [];
 try{const a=JSON.parse(value);return Array.isArray(a)?a.filter(x=>typeof x==="string"):[];}catch{return [];}
};
const renderTags=value=>parseTags(value).map(x=>'<span class="ut-tag">'+esc(x)+'</span>').join("");
const displayDate=date=>{const time=new Date(date);return Number.isNaN(time.valueOf())?"—":time.toLocaleString();};
const plain=value=>value==null||value===""?"—":String(value);
const FILTER_GROUPS=[
 ["routes","Route",["cloud","direct","local","ported"]],
 ["classes","Class",null],
 ["types","Type",["server","tool","resource"]],
 ["languages","Language",null],
 ["authors","Author",["self","official","third_party"]],
 ["platforms","Platform",["apple","linux","microsoft","agnostic"]],
 ["source_modes","Source mode",["remote","safe_update","manual_update","user_update"]],
 ["cardinalities","Cardinality",["solo","registry","router","index","directory"]],
 ["ecosystems","Ecosystem",null],
 ["vendors","Vendor",null],
 ["subjects","Subject",null],
 ["collections","Collection",[]]
];
export function utilityFiltersFromFields(rows){
 const result={include:{},exclude:{}};
 for(const row of rows){
  const side=row.mode,field=row.field;
  if(!["include","exclude"].includes(side)||!FILTER_GROUPS.some(x=>x[0]===field))continue;
  const vals=String(row.value||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if(vals.length)result[side][field]=[...new Set(vals)];
 }
 return result;
}
export function utilityCanManage(item){return !!item&&UID.test(item.uid)&&item.enabled!==0&&["direct","cloud"].includes(item.route);}
export function utilityResultLabel(item){return item?.name||item?.uid||"Utility";}
export function utilitySearchIndex(item){
 return [item.name,item.uid,item.description,item.label,item.class,item.author,item.platform,item.route,
  item.type,...parseTags(item.languages_json),...parseTags(item.ecosystems_json),...parseTags(item.subjects_json)]
   .filter(Boolean).join(" ").normalize("NFKC").toLowerCase();
}
const b64bytes=bytes=>{
 let result="";
 for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(result);
};
export function initColosseumUtilities(){
 const root=document.getElementById("ut-root");
 if(!root||root.dataset.ready==="true")return;
 root.dataset.ready="true";
 const $=id=>root.querySelector("#"+id);
 const elements={
  summary:$("ut-summary"),summaryValue:$("ut-summary").querySelector(".ut-summary-value"),status:$("ut-status"),layout:$("ut-layout"),
  list:$("ut-list"),inspector:$("ut-inspector"),pages:$("ut-pages"),count:$("ut-count"),
  query:$("ut-search"),submit:$("ut-search-submit"),filters:$("ut-filters"),
  fields:$("ut-filter-fields"),filterToggle:$("ut-filter-toggle"),clear:$("ut-filters-clear"),
  sort:$("ut-sort"),refresh:$("ut-refresh"),updateResults:$("ut-update-results"),
  add:$("ut-add"),edit:$("ut-edit"),select:$("ut-select"),editor:$("ut-editor"),
  editorTitle:$("ut-editor-title"),editorCopy:$("ut-editor-copy"),editorFields:$("ut-editor-fields"),
  editorForm:$("ut-editor-form"),editorError:$("ut-editor-error"),
  plan:$("ut-editor-plan"),publish:$("ut-editor-publish"),editorCancel:$("ut-editor-cancel"),
  assets:$("ut-assets-section"),files:$("ut-files"),existingFiles:$("ut-existing-files"),
  deleteDialog:$("ut-delete-dialog"),deleteCopy:$("ut-delete-copy"),
  deleteInput:$("ut-delete-confirm"),deleteError:$("ut-delete-error"),
  deletePlan:$("ut-delete-plan"),deletePublish:$("ut-delete-publish"),deleteCancel:$("ut-delete-cancel")
 };
 const s={items:[],page:0,cursors:[null],nextCursor:null,loaded:false,loading:false,working:false,
  activeUid:null,detail:null,detailError:null,detailCache:new Map(),detailSeq:0,requestSeq:0,
  sort:"name_asc",query:"",include:{},exclude:{},collectionChoices:null,collectionChoicePending:false,pageSize:25,total:null,updatedAt:null,selectionMode:false,
  selection:new Set(),selectionTransitioning:false,editMode:false,editTransitioning:false,
   renamingUid:null,renameInitial:"",renameDrafts:new Map(),editorMode:"add",editorItem:null,planned:null,pendingDelete:null,
  fileOffset:0};
 const selectedItem=()=>s.items.find(x=>x.uid===s.activeUid)||null;
 const report=(message,error=false)=>{elements.status.textContent=message||"";elements.status.dataset.error=error?"true":"false";};
 const actionError=error=>{
  const text=String(error?.message||error||"Unable to complete the requested action.");
  report(text,true);
  if(/sign.in|owner|Cloudflare|authoriz|403|401/i.test(text)){
   const link=document.createElement("a");link.href="/api/colosseum/connect?return=utilities";
   link.textContent=" Reauthorize Colosseum";link.style.textDecoration="underline";elements.status.append(link);
  }
 };
 async function fetchJSON(path,body){
  const response=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body)});
  if(!(response.headers.get("Content-Type")||"").includes("application/json"))
   throw Error("Colosseum owner authorization is required.");
  const payload=await response.json();
  if(!response.ok||payload?.error)throw Error(payload?.error||"Request failed (HTTP "+response.status+").");
  return payload;
 }
 const api=payload=>fetchJSON(API,payload);
 const mutation=(kind,payload)=>fetchJSON(CATALOG_API+kind,payload);
 // Single owner request and in-memory cache update: never refetch the entire page.
 createUtilityAnnotationEditor({root,api,
  getItem:uid=>s.detail?.item?.uid===uid?s.detail.item:s.items.find(x=>x.uid===uid),
  updated:(uid,fields)=>{
   s.items=s.items.map(item=>item.uid===uid?{...item,...fields}:item);
   if(s.detail?.item?.uid===uid)s.detail={...s.detail,item:{...s.detail.item,...fields}};
   const detail=s.detailCache.get(uid);
   if(detail?.item)s.detailCache.set(uid,{...detail,item:{...detail.item,...fields}});
   renderList();if(s.activeUid)renderDetail();
  },
  report
 });
 function busy(value){
  s.working=value;
  elements.add.disabled=value||s.editMode||s.selectionMode||s.editTransitioning||s.selectionTransitioning;
  elements.edit.disabled=value||s.selectionMode||s.editTransitioning||s.selectionTransitioning;
  elements.select.disabled=value||s.editMode||s.editTransitioning||s.selectionTransitioning;
  elements.refresh.disabled=value;
  elements.sort.disabled=value||s.editMode||s.selectionMode;
  elements.query.disabled=value||s.editMode||s.selectionMode;
  elements.submit.disabled=value||s.editMode||s.selectionMode;
  elements.filterToggle.disabled=value||s.editMode||s.selectionMode;
 }
 // Share Collections' geometry-measured, non-jumping two-ring loading state.
 function measureSummaryDivider(){
  const value=elements.summaryValue,text=value.firstChild;
  const index=text?.nodeType===3?text.textContent.indexOf(" / "):-1;
  if(index<0||!value.getClientRects().length)return;
  const range=document.createRange(),origin=value.getBoundingClientRect().left;
  range.setStart(text,index);range.setEnd(text,index+3);
  const group=range.getBoundingClientRect();
  range.setStart(text,index+1);range.setEnd(text,index+2);
  const slash=range.getBoundingClientRect();
  const font=parseFloat(getComputedStyle(elements.summary).fontSize);
  if(!(font>0&&group.width>0&&slash.width>0))return;
  elements.summary.style.setProperty("--ut-summary-group-start",((group.left-origin)/font).toFixed(5)+"em");
  elements.summary.style.setProperty("--ut-summary-group-end",((group.right-origin)/font).toFixed(5)+"em");
  elements.summary.style.setProperty("--ut-summary-slash-left",((slash.left-origin)/font).toFixed(5)+"em");
 }
 function setSummaryLoading(value){
  // Once the route is visible, measure the placeholder before the first fetch;
  // Collections uses the same actual-font geometry to center both rings.
  if(value)measureSummaryDivider();
  elements.summary.classList.toggle("ut-summary-loading",value);
  elements.summary.setAttribute("aria-busy",String(value));
  elements.list.classList.toggle("ut-list-loading",value);
  elements.list.setAttribute("aria-busy",String(value));
  elements.refresh.setAttribute("aria-busy",String(value));
 }
 function summary(){
  elements.summaryValue.textContent="TOTAL "+(s.total??"—")+" / UPDATED "+
   (s.updatedAt?formatWorkspaceTime(s.updatedAt,{hour12:true}):"—");
  measureSummaryDivider();
 }
 function skeletons(){
  elements.list.innerHTML=Array.from({length:s.pageSize},(_,i)=>
   '<article class="ut-skeleton" aria-hidden="true"><div class="ut-skeleton-row">'+
   '<span class="ut-skeleton-number">'+String(s.page*s.pageSize+i+1).padStart(2,"0")+'</span>'+
   '<span class="ut-skeleton-copy"><span class="ut-skeleton-bar site-skeleton" data-slot="skeleton"></span>'+
   '<span class="ut-skeleton-sub"><span class="ut-skeleton-uid site-skeleton" data-slot="skeleton"></span>'+
   '<span class="ut-skeleton-separator"> · </span>'+
   '<span class="ut-skeleton-class site-skeleton" data-slot="skeleton"></span></span></span></div></article>').join("");
 }
 function rowsMarkup(){
  if(!s.items.length)return '<p class="ut-empty">'+(s.query||Object.keys(s.include).length||Object.keys(s.exclude).length?
   "No catalog utilities match these search and filter conditions.":"No utilities were returned by the live catalog.")+'</p>';
  return s.items.map((item,i)=>{
   const title=esc(plain(item.name)),uid=esc(item.uid);
   const nameDraft=s.renameDrafts.get(item.uid)?.name??item.name;
   const name=esc(nameDraft),selected=s.selection.has(item.uid),editable=utilityCanManage(item);
   const pickInactive=s.selectionMode?'':' disabled tabindex="-1" aria-hidden="true"';
   const editInactive=s.editMode&&editable?'':' disabled tabindex="-1" aria-hidden="true"';
   return '<article class="ut-row" data-ut-uid="'+uid+'">'+
    '<button type="button" class="ut-row-main" data-ut-open="'+uid+'" aria-expanded="false" aria-controls="ut-panel-'+uid+'"'+(s.editMode||s.selectionMode?' disabled tabindex="-1"':'')+'>'+
    '<span class="ut-row-number">'+String(s.page*s.pageSize+i+1).padStart(2,"0")+'</span>'+
    '<span class="ut-route-icon" data-route="'+esc(item.route||"unknown")+'" aria-label="'+esc(plain(item.route))+' utility" role="img"></span>'+
    '<span class="ut-row-copy"><span class="ut-row-title">'+
    '<span class="ut-title-measure" aria-hidden="true">'+title+'</span>'+
    '<span class="ut-title-compact" aria-hidden="true">'+title+'</span>'+
    '<span class="ut-title-expanded">'+title+'</span></span>'+
    '<span class="ut-row-sub"><span class="ut-row-uid">'+uid+'</span><span class="ut-row-separator"> · </span><span class="ut-row-class">'+esc(plain(item.class))+'</span></span></span>'+
    '<span class="ut-chevron">'+ICON_DOWN+'</span></button>'+
    '<button type="button" class="ut-row-pick" data-ut-pick="'+uid+'" aria-label="'+(selected?'Deselect ':'Select ')+title+'" aria-pressed="'+String(selected)+'"'+pickInactive+'><span class="ut-select-bubble" aria-hidden="true">'+PICK_CHECK+'</span></button>'+
    '<span class="ut-name-field" data-ut-name-field="'+uid+'">'+
     '<span class="ut-name-editor"><span class="ut-name-measure" aria-hidden="true">'+(name||' ')+'</span>'+
     '<input class="ut-inline-name" type="text" data-ut-name="'+uid+'" value="'+name+'" aria-label="Rename '+title+'" maxlength="200" autocomplete="off" spellcheck="false" disabled tabindex="-1" aria-hidden="true">'+
     '<span class="ut-name-underline" aria-hidden="true"></span></span>'+
     (editable?'<button class="ut-name-pencil" type="button" data-ut-start-rename="'+uid+'" aria-label="Rename '+title+'"'+editInactive+'>'+NAME_PENCIL+'</button>':'')+
     '<span class="ut-name-actions" hidden><button class="ut-name-confirm" type="button" data-ut-confirm-rename="'+uid+'" aria-label="Apply name change">'+NAME_APPLY+'</button>'+
     '<button class="ut-name-cancel" type="button" data-ut-cancel-rename="'+uid+'" aria-label="Cancel name change">'+NAME_CANCEL+'</button></span></span>'+
    '<div class="ut-row-panel" id="ut-panel-'+uid+'" role="region" aria-hidden="true"><div class="ut-row-panel-inner">'+
    '<p class="ut-row-description">'+esc(item.description||"Description pending source review")+'</p>'+
    '<div class="ut-mobile-detail" data-ut-mobile></div></div></div></article>';
  }).join("");
 }

 // Matching Collections' transient edit/select modes: neither mode changes
 // persisted data until the owner explicitly finishes an edit.
 const modeLabel=(button,label,id)=>{
  button.setAttribute("aria-label",label);
  button.setAttribute("aria-pressed",String(id==="edit"?s.editMode:s.selectionMode));
  const target=root.querySelector("#ut-"+id+"-tooltip-label");
  if(target)target.textContent=label;
 };
 function syncModes(){
  root.classList.toggle("ut-editing",s.editMode);
  root.classList.toggle("ut-selecting",s.selectionMode);
  modeLabel(elements.edit,s.editMode?"Done editing utilities":"Edit utilities","edit");
  modeLabel(elements.select,s.selectionMode?"Done selecting utilities":"Select utilities","select");
  busy(s.working);
  for(const row of elements.list.querySelectorAll(".ut-row")){
   const uid=row.dataset.utUid,editable=utilityCanManage(s.items.find(x=>x.uid===uid));
   const main=row.querySelector(".ut-row-main");
   if(main){main.disabled=s.editMode||s.selectionMode||s.editTransitioning||s.selectionTransitioning;main.tabIndex=main.disabled?-1:0;}
   const pick=row.querySelector(".ut-row-pick");
   if(pick){
    pick.disabled=!s.selectionMode||s.selectionTransitioning||s.working;
    pick.tabIndex=pick.disabled?-1:0;
    if(pick.disabled)pick.setAttribute("aria-hidden","true");else pick.removeAttribute("aria-hidden");
    const chosen=s.selection.has(uid);
    pick.setAttribute("aria-pressed",String(chosen));
    pick.setAttribute("aria-label",(chosen?"Deselect ":"Select ")+(s.items.find(x=>x.uid===uid)?.name||uid));
   }
   const pencil=row.querySelector(".ut-name-pencil");
   if(pencil){
    pencil.disabled=!s.editMode||!editable||s.editTransitioning||s.working;
    pencil.tabIndex=pencil.disabled?-1:0;
    if(pencil.disabled)pencil.setAttribute("aria-hidden","true");else pencil.removeAttribute("aria-hidden");
   }
   const input=row.querySelector(".ut-inline-name");
   if(input){
    input.disabled=s.renamingUid!==uid||!s.editMode||s.editTransitioning||s.working;
    input.tabIndex=input.disabled?-1:0;
    if(input.disabled)input.setAttribute("aria-hidden","true");else input.removeAttribute("aria-hidden");
   }
   if(s.editMode)sizeInlineName(row.querySelector(".ut-name-field"));
  }
 }
 function sizeInlineName(field){
  const input=field?.querySelector(".ut-inline-name"),measure=field?.querySelector(".ut-name-measure");
  if(!input||!measure)return;
  measure.textContent=input.value||" ";
  const width=Math.ceil(measure.getBoundingClientRect().width+3);
  field.style.setProperty("--ut-inline-name-width",Math.max(24,Math.min(width,Math.max(24,field.clientWidth-75)))+"px");
 }
 function finishInlineRename(restore=false){
  if(!s.renamingUid)return true;
  const uid=s.renamingUid,field=elements.list.querySelector('[data-ut-name-field="'+uid+'"]');
  const input=field?.querySelector(".ut-inline-name");
  const name=restore?s.renameInitial:clean(input?.value).normalize("NFKC").replace(/\s+/gu," ");
  if(!restore&&(!name||name.length>200)){report("A utility name must be 1–200 characters.",true);return false;}
  const item=s.items.find(x=>x.uid===uid);
  if(item&&!restore){
   if(name!==item.name)s.renameDrafts.set(uid,{name,base:{uid,revision:item.revision,updated_at:item.updated_at,name:item.name}});
   else s.renameDrafts.delete(uid);
  }
  if(input)input.value=restore?s.renameInitial:name;
  s.renamingUid=null;s.renameInitial="";
  field?.classList.remove("ut-renaming","ut-underline-extended");
  const actions=field?.querySelector(".ut-name-actions");if(actions)actions.hidden=true;
  const pencil=field?.querySelector(".ut-name-pencil");if(pencil)pencil.hidden=false;
  syncModes();return true;
 }
 function startInlineRename(uid){
  if(!s.editMode||s.editTransitioning||s.working)return;
  const item=s.items.find(x=>x.uid===uid);
  if(!utilityCanManage(item))return;
  if(s.renamingUid===uid)return;
  if(!finishInlineRename())return;
  const field=elements.list.querySelector('[data-ut-name-field="'+uid+'"]');
  const input=field?.querySelector(".ut-inline-name"),actions=field?.querySelector(".ut-name-actions");
  if(!input||!actions)return;
  s.renamingUid=uid;s.renameInitial=input.value;
  actions.hidden=false;
  field.querySelector(".ut-name-pencil").hidden=true;
  field.classList.add("ut-renaming");
  syncModes();sizeInlineName(field);
  const underline=field.querySelector(".ut-name-underline");
  void underline.offsetWidth;
  field.classList.add("ut-underline-extended");
  input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);
 }
 // Native animation completion, not a timer or a polling loop.
 async function waitForMotion(node,property){
  if(!node||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  void getComputedStyle(node).opacity;
  const animations=node.getAnimations().filter(x=>x.transitionProperty===property||x.animationName===property);
  if(animations.length)await Promise.allSettled(animations.map(x=>x.finished));
 }
 async function closeExpandedForMode(){
  const panel=elements.list.querySelector(".ut-row.ut-active .ut-row-panel");
  if(!panel)return;
  s.activeUid=null;s.detail=null;s.detailError=null;++s.detailSeq;
  syncActive();
  await waitForMotion(panel,"grid-template-rows");
 }
 async function enterSelectMode(){
  if(s.selectionMode||s.selectionTransitioning||s.editMode||s.editTransitioning||s.working||!s.loaded)return;
  s.selectionTransitioning=true;syncModes();
  await closeExpandedForMode();
  if(root.closest(".view")?.hidden){s.selectionTransitioning=false;syncModes();return;}
  s.selection.clear();s.selectionMode=true;
  root.classList.add("ut-entering-selection");syncModes();
  await waitForMotion(elements.list.querySelector(".ut-row-pick"),"ut-pick-enter-right");
  root.classList.remove("ut-entering-selection");s.selectionTransitioning=false;syncModes();
 }
 async function exitSelectMode(){
  if(!s.selectionMode||s.selectionTransitioning)return;
  s.selectionTransitioning=true;s.selectionMode=false;
  root.classList.add("ut-leaving-selection");syncModes();
  await waitForMotion(elements.list.querySelector(".ut-row-pick"),"ut-pick-exit-left");
  root.classList.remove("ut-leaving-selection");s.selection.clear();
  s.selectionTransitioning=false;syncModes();
 }
 function toggleSelectMode(){if(s.selectionMode)void exitSelectMode();else void enterSelectMode();}
 function toggleRowPick(uid){
  if(!s.selectionMode||s.selectionTransitioning||s.working||!s.items.some(x=>x.uid===uid))return;
  if(s.selection.has(uid))s.selection.delete(uid);else s.selection.add(uid);
  syncModes();
 }
 async function enterEditMode(){
  if(s.editMode||s.editTransitioning||s.selectionMode||s.selectionTransitioning||s.working||!s.loaded)return;
  s.editTransitioning=true;syncModes();
  await closeExpandedForMode();
  if(root.closest(".view")?.hidden){s.editTransitioning=false;syncModes();return;}
  s.editMode=true;root.classList.add("ut-entering-edit");syncModes();
  await waitForMotion(elements.list.querySelector(".ut-name-field"),"ut-name-enter-right");
  root.classList.remove("ut-entering-edit");s.editTransitioning=false;syncModes();
 }
 async function exitEditMode(){
  if(!s.editMode||s.editTransitioning||s.working||!finishInlineRename())return;
  const changes=[...s.renameDrafts.values()].filter(x=>x.name!==x.base.name);
  if(changes.length){
   busy(true);report("Saving "+changes.length+" utility name"+(changes.length===1?"":"s")+"…");
   try{
    for(const change of changes){
     const body={uid:change.base.uid,phase:"plan",record:{name:change.name},
      expected_revision:change.base.revision,expected_updated_at:change.base.updated_at};
     const plan=await mutation("update",body);
     if(!plan?.manifest_digest)throw Error("Colosseum did not confirm the rename plan for "+change.base.uid);
     const result=await mutation("update",{...body,phase:"publish"});
     if(result?.phase!=="complete")throw Error("Rename requires manual reconciliation for "+change.base.uid+
      (result?.mutation_id?" ("+result.mutation_id+")":""));
     s.renameDrafts.delete(change.base.uid);
    }
   }catch(error){actionError(error);busy(false);syncModes();return;}
   busy(false);
  }
  s.editTransitioning=true;s.editMode=false;
  root.classList.add("ut-leaving-edit");syncModes();
  await waitForMotion(elements.list.querySelector(".ut-name-field"),"ut-name-exit-left");
  root.classList.remove("ut-leaving-edit");
  s.editTransitioning=false;s.renameDrafts.clear();syncModes();
  if(changes.length)void loadPage(0,null);
 }
 function toggleEditMode(){if(s.editMode)void exitEditMode();else void enterEditMode();}
 function syncActive(){
  elements.layout.classList.toggle("ut-open",!!s.activeUid);
  elements.inspector.setAttribute("aria-hidden",String(!s.activeUid));
  elements.inspector.classList.toggle("ut-empty",!s.activeUid);
  for(const el of elements.list.querySelectorAll(".ut-row")){
   const open=el.dataset.utUid===s.activeUid;
   el.classList.toggle("ut-active",open);
   el.querySelector(".ut-row-main")?.setAttribute("aria-expanded",String(open));
   el.querySelector(".ut-row-panel")?.setAttribute("aria-hidden",String(!open));
  }
  syncModes();
 }
 const metadata=(name,value)=>'<div><dt>'+esc(name)+'</dt><dd>'+esc(plain(value))+'</dd></div>';
 const tagSection=(label,tags)=>{
  const content=renderTags(tags);
  return content?'<section class="ut-card-section"><h3>'+esc(label)+'</h3><div class="ut-tag-list">'+content+'</div></section>':"";
 };
 function itemCard(){
  const item=s.detail?.item||selectedItem();
  if(!item)return "";
  if(s.detailError)return '<section class="ut-card" role="alert"><p>'+esc(s.detailError)+'</p></section>';
  if(!s.detail||s.detail.item?.uid!==item.uid)
   return '<section class="ut-card" role="status"><p>Loading live utility details…</p></section>';
  const rows=[
   ["UID",item.uid],["Enabled",item.enabled===0?"No":"Yes"],["Route",item.route],["Class",item.class],["Type",item.type],
   ["Cardinality",item.cardinality],["Platform",item.platform],
   ["Source mode",item.source_mode],["Revision",item.revision],["Created",displayDate(item.source_created_at)],
   ["Last updated",displayDate(item.updated_at)],["Runtime",item.runtime],["Assets",String(s.detail.asset_count??0)]
  ];
  const url=(()=>{try{const u=new URL(item.reference);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}})();
  const files=(s.detail.files||[]).map(f=>'<div class="ut-file"><code>'+esc(f.relative_path)+'</code>'+
   '<small>'+Number(f.size_bytes||0).toLocaleString()+' bytes</small></div>').join("");
  const canEdit=utilityCanManage(item);
  const notes=typeof item.notes==="string"?item.notes:"";
  const rating=typeof item.rating==="number"?item.rating:null;
  const description=typeof item.description==="string"&&item.description?item.description:null;
  const editorialSection='<section class="ut-card-section ut-editorial-section"><h3>Description</h3>'+
   '<p class="ut-verified-description'+(description?'':' ut-editorial-pending')+'">'+
    esc(description||"Pending direct source review; no unverified summary has been assigned.")+'</p>'+
   '<h3>Notes <span class="ut-editorial-optional">optional · 100 characters</span></h3>'+
   '<p class="ut-editorial-note">'+esc(notes||"No notes yet.")+'</p>'+
   '<h3>Rating <span class="ut-editorial-optional">optional · 0.5–5 stars</span></h3>'+
   '<p class="ut-editorial-rating">'+esc(rating===null?"Not rated":rating.toFixed(1)+" / 5")+'</p>'+
   '<button type="button" class="ut-small-button" data-ut-edit-annotation="'+esc(item.uid)+'">Edit notes &amp; rating</button>'+
   '</section>';
  const linked=Array.isArray(s.detail.collection_names)?s.detail.collection_names:[];
  const collectionSection='<section class="ut-card-section"><h3>Collections</h3>'+
    (linked.length?'<div class="ut-tag-list">'+linked.map(name=>'<span class="ut-tag">'+esc(name)+'</span>').join("")+'</div>':
     '<p>Not a direct member of any collection.</p>')+'</section>';
  const authorLabel=plain(item.author).replaceAll("_"," ").replace(/(^| )[a-z]/g,ch=>ch.toUpperCase());
  return '<section class="ut-card" aria-label="'+esc(item.name)+' details>'+
   '<div class="ut-card-header"><div><p class="ut-overline">'+esc(plain(item.route))+' UTILITY</p>'+
   '<h2>'+esc(item.name)+'</h2></div><span class="ut-card-badges">'+
   '<span class="ut-tag ut-author-badge">'+esc(authorLabel)+'</span>'+
   '<span class="ut-tag">#'+esc(item.uid)+'</span></span></div>'+
   editorialSection+'<section class="ut-card-section"><h3>Catalog label</h3><p>'+esc(plain(item.label))+'</p></section>'+
   '<dl class="ut-meta">'+rows.map(([k,v])=>metadata(k,v)).join("")+'</dl>'+
   tagSection("Languages",item.languages_json)+tagSection("Ecosystems",item.ecosystems_json)+
   tagSection("Vendors",item.vendors_json)+tagSection("Subjects",item.subjects_json)+collectionSection+
   '<section class="ut-card-section"><h3>Source & dependencies</h3>'+
   (url?'<p><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(url)+'</a></p>':
      '<p>'+esc(plain(item.reference))+'</p>')+
   '<p>'+esc(plain(item.dependencies))+'</p></section>'+
   '<section class="ut-card-section"><h3>Static assets · '+Number(s.detail.asset_count||0)+'</h3>'+
   (files||'<p>No linked static assets.</p>')+
   (s.detail.files_has_more?'<button type="button" class="ut-small-button" data-ut-more-files>Load more assets</button>':"")+
   '</section>'+
   '<section class="ut-card-section"><h3>Management</h3><div class="ut-card-actions">'+
   (canEdit?'<button type="button" class="ut-small-button" data-ut-edit="'+esc(item.uid)+'">Edit utility</button>'+
     '<button type="button" class="ut-small-button" data-ut-remove="'+esc(item.uid)+'">Remove utility</button>':
     '<p>Catalog edits are available for enabled cloud and direct utilities only.</p>')+
   '</div></section></section>';
 }
 function renderDetail(){
  // Keep the outgoing card mounted during the CSS exit transition.
  if(!s.activeUid)return;
  const card=itemCard();elements.inspector.innerHTML=card;
  elements.list.querySelectorAll("[data-ut-mobile]").forEach(el=>{
   if(el.closest(".ut-row")?.dataset.utUid===s.activeUid){
    el.innerHTML=card;
    el.classList.toggle("ut-detail-ready",!!s.detail&&!s.detailError&&s.detail.item?.uid===s.activeUid);
   }
   else if(el.innerHTML)el.replaceChildren();
  });
 }
 function renderList(){
  elements.list.innerHTML=rowsMarkup();elements.list.setAttribute("aria-busy","false");
  const unfiltered=!s.query&&!Object.keys(s.include).length&&!Object.keys(s.exclude).length;
  const pages=unfiltered&&Number.isSafeInteger(s.total)?Math.max(1,Math.ceil(s.total/s.pageSize)):
   Math.max(1,s.page+1+(s.nextCursor?1:0));
  const current=s.page+1,first=s.page*s.pageSize+1;
  elements.count.textContent=unfiltered&&Number.isSafeInteger(s.total)?
   (s.total?first+"–"+Math.min(first+s.items.length-1,s.total)+" of "+s.total:"0 of 0"):
   (s.items.length?first+"–"+(first+s.items.length-1)+(s.nextCursor?" matching · more available":" matching"):"0 matching utilities");
  if(pages===1)elements.pages.replaceChildren();
  else{
   const from=Math.max(1,Math.min(current-2,pages-4)),to=Math.min(pages,from+4);
   const numbers=new Set([1,pages]);for(let p=from;p<=to;p++)numbers.add(p);
   let previous=0;
   const cells=[...numbers].sort((x,y)=>x-y).map(n=>{
    const dots=n>previous+1?'<span class="ut-page-gap" aria-hidden="true">…</span>':'';
    previous=n;
    return dots+'<button class="ut-page" type="button" data-ut-page="'+n+'" aria-label="Page '+n+'"'+(current===n?' aria-current="page"':'')+'>'+n+'</button>';
   }).join("");
   elements.pages.innerHTML='<button class="ut-page" type="button" data-ut-page="prev" aria-label="Previous utilities page"'+(current===1?' disabled':'')+'>'+PAGE_LEFT+'</button>'+
    cells+'<button class="ut-page" type="button" data-ut-page="next" aria-label="Next utilities page"'+(current===pages?' disabled':'')+'>'+PAGE_RIGHT+'</button>';
  }
  syncActive();renderDetail();
 }
 async function loadPage(index=0,cursor=null){
  const serial=++s.requestSeq;
  s.loading=true;busy(true);
  if(!s.loaded)skeletons();
  setSummaryLoading(true);
  report("");
  try{
   const query=clean(elements.query.value).slice(0,160);
   const args={action:"list",query,sort:elements.sort.value,page_size:s.pageSize,
    include:s.include,exclude:s.exclude,...(index>0?{offset:index*s.pageSize}:{})};
   const result=await api(args);if(serial!==s.requestSeq)return;
   if(!Array.isArray(result.items))throw Error("The catalog returned an unexpected listing.");
   s.items=result.items.filter(x=>UID.test(x?.uid));s.detailCache.clear();s.page=index;
   s.query=query;s.sort=args.sort;s.nextCursor=result.next_cursor||null;
   if(Number.isSafeInteger(result.total_items)&&result.total_items>=0)s.total=result.total_items;
   s.updatedAt=new Date();s.revision=result.catalog_revision||"—";s.loaded=true;
   s.activeUid=null;s.detail=null;s.detailError=null;s.detailSeq++;
   // Preserve transient selections and rename drafts when changing pages.
   // Neither is persisted until the owner confirms the operation.
   summary();renderList();report("");return true;
  }catch(error){if(serial===s.requestSeq){actionError(error);if(!s.loaded){s.items=[];renderList();}}}
  finally{if(serial===s.requestSeq){s.loading=false;setSummaryLoading(false);busy(false);syncModes();}}
 }
 async function loadDetails(uid,{force=false}={}){
  if(!UID.test(uid))return;
  const seq=++s.detailSeq;
  if(!force&&s.detailCache.has(uid)){s.detail=s.detailCache.get(uid);renderDetail();return;}
  try{
   const item=await api({action:"get",uid,files_limit:30,files_offset:0});
   if(seq!==s.detailSeq||s.activeUid!==uid)return;
   if(!item.found)throw Error("This utility no longer exists in the catalog.");
   s.detail=item;s.detailError=null;s.detailCache.set(uid,item);renderDetail();
  }catch(error){if(seq===s.detailSeq&&s.activeUid===uid){actionError(error);s.detail=null;s.detailError=error.message||String(error);renderDetail();}}
 }
 function choose(uid){
  if(s.selectionMode||s.editMode||s.selectionTransitioning||s.editTransitioning)return;
  s.activeUid=s.activeUid===uid?null:uid;
  report("");
  s.detail=null;s.detailError=null;s.detailSeq++;
  syncActive();renderDetail();
  if(s.activeUid)void loadDetails(s.activeUid);
 }
 function renderFilterControls(){
  elements.fields.innerHTML=FILTER_GROUPS.flatMap(([field,label,choices])=>
   ["include","exclude"].map(mode=>
    '<label class="ut-filter-field" data-ut-filter-side="'+mode+'"><span>'+esc(label)+'</span>'+
    (choices?
      '<select data-ut-filter-field="'+field+'" data-ut-filter-mode="'+mode+'"><option value="">Any</option>'+
       choices.map(value=>'<option value="'+esc(value)+'">'+esc(value.replaceAll("_"," "))+'</option>').join("")+'</select>':
      '<input type="text" data-ut-filter-field="'+field+'" data-ut-filter-mode="'+mode+'" placeholder="Comma-separated values" autocomplete="off">')+
    '</label>')).join("");
 }
 // Load collection choices only on first opening of filter controls.
 async function loadCollectionChoices(){
  if(s.collectionChoices||s.collectionChoicePending)return;
  s.collectionChoicePending=true;
  try{
   const choices=[],seen=new Set();
   let cursor=null;
   for(let batch=0;batch<20;batch++){
    const response=await fetch("/api/colosseum/collections",{
     method:cursor?"POST":"GET",credentials:"same-origin",cache:"no-store",
     ...(cursor?{headers:{"Content-Type":"application/json"},
       body:JSON.stringify({action:"list",page_size:100,cursor})}:{})
    });
    if(!response.ok)throw Error("Could not load the live Collections registry (HTTP "+response.status+").");
    const result=await response.json();
    if(!Array.isArray(result.collections))throw Error("Invalid live Collections registry response.");
    choices.push(...result.collections.filter(item=>typeof item?.name==="string"));
    if(!result.next_cursor){cursor=null;break;}
    if(seen.has(result.next_cursor))throw Error("Repeated Collections pagination cursor.");
    seen.add(result.next_cursor);cursor=result.next_cursor;
   }
   if(cursor)throw Error("The Collections registry exceeded the bounded page limit.");
   s.collectionChoices=choices.sort((a,b)=>a.name.localeCompare(b.name));
   for(const select of elements.fields.querySelectorAll('select[data-ut-filter-field="collections"]')){
    const previous=select.value;
    select.innerHTML='<option value="">Any collection</option>'+
      s.collectionChoices.map(item=>'<option value="'+esc(item.name)+'">'+esc(item.name)+'</option>').join("");
    select.value=previous;
   }
  }catch(error){actionError(error);}
  finally{s.collectionChoicePending=false;}
 }
 function gatherFilters(){
  const rows=[...elements.fields.querySelectorAll("[data-ut-filter-field]")].map(el=>({
   field:el.dataset.utFilterField,mode:el.dataset.utFilterMode,value:el.value
  }));
  return utilityFiltersFromFields(rows);
 }
 function filterDot(){
  elements.filterToggle.dataset.active=String(Object.keys(s.include).length+Object.keys(s.exclude).length>0);
 }
 function fieldsMarkup(item={}){
  const val=(key,fallback="")=>esc(item[key]??fallback);
  const input=(key,label,options={})=>'<label class="ut-field'+(options.wide?" ut-wide":"")+'">'+esc(label)+
   (options.select?'<select name="'+key+'">'+options.select.map(x=>'<option value="'+esc(x)+'"'+(x===(item[key]??options.def)?" selected":"")+'>'+esc(x.replaceAll("_"," "))+'</option>').join("")+'</select>':
   options.area?'<textarea name="'+key+'" rows="3" maxlength="2048">'+val(key,options.def)+'</textarea>':
   '<input name="'+key+'" type="text" value="'+val(key,options.def)+'" maxlength="'+(options.max||512)+'"'+(options.required?" required":"")+' autocomplete="off" spellcheck="false">')+
   '</label>';
  const tags=(key)=>parseTags(item[key+"_json"]).join(", ");
  return input("uid","UID (six hexadecimal characters)",{required:true,max:6})+
    input("route","Route",{select:["cloud","direct"],def:"cloud"})+
    input("name","Name",{required:true})+
    input("label","Description",{area:true,wide:true,def:""})+
    input("class","Class (e.g. software/tool)",{required:true,def:"software/tool"})+
    input("reference","Source reference",{required:true,wide:true})+
    input("revision","Revision",{required:true,def:"1.0.0"})+
    input("type","Catalog type",{select:["resource","tool","server"],def:"resource"})+
    input("cardinality","Cardinality",{select:["solo","registry","router","index","directory"],def:"solo"})+
    input("source_mode","Source mode",{select:["user_update","manual_update","safe_update","remote"],def:"user_update"})+
    input("platform","Platform",{select:["agnostic","apple","linux","microsoft"],def:"agnostic"})+
    input("author","Author",{select:["self","official","third_party"],def:"self"})+
    input("runtime","Runtime",{def:"web"})+
    input("dependencies","Dependencies",{area:true,wide:true,def:"none"})+
    input("size","Size",{def:"unknown"})+
    input("github","GitHub location",{def:"No"})+
    input("ecosystems","Ecosystems (comma-separated)",{def:tags("ecosystems")||"Web Platform"})+
    input("vendors","Vendors (comma-separated)",{def:tags("vendors")||"Independent"})+
    input("subjects","Subjects (comma-separated)",{def:tags("subjects")||"Catalog"})+
    input("languages","Languages (comma-separated)",{def:tags("languages")||"Unknown"});
 }
 function editorData(){
  const data=Object.fromEntries(new FormData(elements.editorForm).entries());
  const uid=clean(data.uid).toLowerCase(),route=data.route||s.editorItem?.route;
  if(!UID.test(uid))throw Error("UID must be exactly six lowercase hexadecimal digits.");
  if(!["cloud","direct"].includes(route))throw Error("Only cloud and direct utilities may be managed.");
  for(const k of ["name","label","class","reference","revision"])
   if(!clean(data[k]))throw Error(k+" is required.");
  if(!/^[a-z][a-z0-9-]*(\/[a-z0-9-]+)?$/.test(data.class))
    throw Error("Class must be a canonical category such as software/tool.");
  const record={};
  for(const key of ["route","name","label","class","reference","revision","type","cardinality",
    "source_mode","platform","author","runtime","dependencies","size","github"])record[key]=clean(data[key]);
  record.source_form=route==="direct"?"url":"asset";
  for(const key of ["ecosystems","vendors","subjects","languages"])
   record[key]=clean(data[key]).split(",").map(x=>x.trim()).filter(Boolean);
  for(const key of ["ecosystems","vendors","subjects","languages"])
   if(!record[key].length)throw Error(key+" must contain at least one value.");
  return {uid,record};
 }
 async function assetChanges(){
  const files=[...elements.files.files];
  if(files.length>24)throw Error("Select at most 24 files.");
  let total=0;const add_files=[],asset_payloads={};
  for(const file of files){
   if(!file.name||/[\\/]/.test(file.name)||file.name==="."||file.name==="..")throw Error("Invalid asset filename.");
   total+=file.size;if(total>8388608)throw Error("Selected files exceed 8 MiB.");
   const binary=!/^(text\/|application\/(json|javascript|xml))/.test(file.type)&&
    !/\.(txt|md|js|mjs|ts|tsx|json|css|html|svg|xml|yaml|yml|py|sh|rs|go|toml)$/i.test(file.name);
   add_files.push({relative_path:file.name,media_kind:binary?"bin":"txt",library_key:"iii"});
   asset_payloads[file.name]=b64bytes(new Uint8Array(await file.arrayBuffer()));
  }
  const remove_files=[...elements.existingFiles.querySelectorAll('input[data-ut-remove-file]:checked')]
   .map(el=>el.dataset.utRemoveFile);
  return {add_files,remove_files,asset_payloads};
 }
 function randomUid(){
  const bytes=crypto.getRandomValues(new Uint8Array(3));
  return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
 }
 function editorInputsLocked(locked){
  elements.editorForm.querySelectorAll("input,textarea,select").forEach(input=>input.disabled=locked);
 }
 function resetPlan(){
  if(!s.planned)return;
  s.planned=null;elements.publish.hidden=true;elements.plan.hidden=false;
  elements.plan.textContent="Review changes";elements.editorError.textContent="";
  editorInputsLocked(false);
 }
 function openEditor(mode,item=null){
  if(s.working)return;
  if(mode==="edit"&&!utilityCanManage(item)){report("Only cloud and direct utilities can be edited.",true);return;}
  s.editorMode=mode;s.editorItem=item;s.planned=null;
  elements.editorTitle.textContent=mode==="add"?"Add utility":"Edit "+item.name;
  elements.editorCopy.textContent=mode==="add"?
    "Define a new cloud or direct catalog item. Review the read-only GitHub-first mutation plan before publishing.":
    "Edit this existing catalog record. Changes must pass revision checks and a read-only plan before publishing.";
  elements.editorFields.innerHTML=fieldsMarkup(item||{uid:randomUid()});
  if(mode==="edit")elements.editorFields.querySelector('[name="uid"]').readOnly=true;
  if(mode==="edit"){const routeField=elements.editorFields.querySelector('[name="route"]');routeField.disabled=true;routeField.dataset.originalRoute=item.route;}
  const disabled=mode==="edit"&&item?.route!=="cloud";
  elements.assets.hidden=disabled;
  elements.files.value="";elements.existingFiles.replaceChildren();
  if(mode==="edit"&&item?.route==="cloud"){
   const files=s.detail?.item?.uid===item.uid?s.detail.files||[]:[];
   elements.existingFiles.innerHTML=files.map(f=>
    '<label class="ut-file"><span><input type="checkbox" data-ut-remove-file="'+esc(f.relative_path)+'"> Remove <code>'+esc(f.relative_path)+'</code></span><small>'+
    Number(f.size_bytes||0).toLocaleString()+' B</small></label>').join("");
   if(s.detail?.files_has_more)elements.existingFiles.insertAdjacentHTML("beforeend",
    '<p class="ut-action-note">Only the first '+String(files.length)+' assets are listed here. Load more in the details panel before editing them.</p>');
  }
  elements.editorError.textContent="";elements.plan.hidden=false;elements.publish.hidden=true;
  elements.plan.textContent="Review changes";editorInputsLocked(false);
  elements.editor.showModal();
 }
 async function reviewEditor(){
  if(s.working)return;
  elements.editorError.textContent="";
  try{
   const base=editorData();
   const mode=s.editorMode;
   if(mode==="edit"&&base.uid!==s.editorItem.uid)throw Error("Cannot change a utility UID.");
   const record=mode==="edit"?Object.fromEntries(Object.entries(base.record).filter(([k])=>k!=="route"&&k!=="source_form")):base.record;
   const assets=await assetChanges();
   if(base.record.route==="direct"&&(assets.add_files.length||assets.remove_files.length))
    throw Error("Direct references cannot have managed static assets.");
   if(mode==="edit"&&base.record.route!=="cloud"&&(assets.add_files.length||assets.remove_files.length))
    throw Error("Static assets are available only for cloud items.");
   const body={uid:base.uid,record,phase:"plan"};
   if(assets.add_files.length){body.add_files=assets.add_files;body.asset_payloads=assets.asset_payloads;}
   if(assets.remove_files.length)body.remove_files=assets.remove_files;
   if(mode==="edit"){
    body.expected_revision=s.editorItem.revision;
    body.expected_updated_at=s.editorItem.updated_at;
   }
   busy(true);elements.plan.disabled=true;
   const kind=mode==="add"?"add":"update";
   const result=await mutation(kind,body);
   if(!result?.manifest_digest)throw Error("Colosseum did not supply a reviewable catalog mutation plan.");
   s.planned={kind,body,result};
   elements.editorCopy.textContent="Reviewed "+kind+" plan · "+(result.manifest?.added_files?.length||0)+
    " files added · "+(result.manifest?.removed_files?.length||0)+" removed. Confirm to commit the GitHub-first catalog update.";
   elements.editorError.textContent="";
   elements.plan.hidden=true;elements.publish.hidden=false;
   editorInputsLocked(true);
  }catch(error){elements.editorError.textContent=error.message||String(error);}
  finally{busy(false);elements.plan.disabled=false;}
 }
 async function publishEditor(){
  if(!s.planned||s.working)return;
  const {kind,body}=s.planned;
  try{
   busy(true);elements.publish.disabled=true;
   const result=await mutation(kind,{...body,phase:"publish"});
   if(result?.phase!=="complete")throw Error("Mutation requires reconciliation: "+JSON.stringify({phase:result?.phase,mutation_id:result?.mutation_id,uid:body.uid}));
   elements.editor.close();s.planned=null;s.detailCache.clear();report("Catalog utility "+(kind==="add"?"created":"updated")+".");
   void loadPage(0,null);
  }catch(error){elements.editorError.textContent=error.message||String(error);}
  finally{busy(false);elements.publish.disabled=false;}
 }
 function openDelete(uid){
  const item=s.items.find(x=>x.uid===uid);
  if(!utilityCanManage(item)){report("Only cloud and direct utilities can be removed.",true);return;}
  s.pendingDelete={item,planned:null};
  elements.deleteInput.value="";elements.deleteError.textContent="";
  elements.deletePlan.disabled=true;elements.deletePlan.hidden=false;elements.deletePublish.hidden=true;
  elements.deleteCopy.textContent='Remove "'+item.name+'" ('+item.uid+') from the catalog? Its reference associations will be updated through the GitHub-first transaction. Type the exact name to continue.';
  elements.deleteDialog.showModal();
 }
 async function reviewDelete(){
  const d=s.pendingDelete;if(!d||s.working||elements.deleteInput.value!==d.item.name)return;
  try{
   busy(true);elements.deleteError.textContent="";
   const body={uid:d.item.uid,phase:"plan",expected_revision:d.item.revision,expected_updated_at:d.item.updated_at};
   const plan=await mutation("remove",body);
   if(!plan?.manifest_digest)throw Error("Colosseum did not return a removal plan.");
   d.planned={body,plan};elements.deletePlan.hidden=true;elements.deletePublish.hidden=false;
   elements.deleteInput.disabled=true;elements.deleteCopy.textContent='Removal plan reviewed for "'+d.item.name+'". Confirm removal to publish the catalog transaction.';
  }catch(error){elements.deleteError.textContent=error.message||String(error);}
  finally{busy(false);}
 }
 async function publishDelete(){
  const d=s.pendingDelete;if(!d?.planned||s.working)return;
  try{
   busy(true);
   const result=await mutation("remove",{...d.planned.body,phase:"publish"});
   if(result?.phase!=="complete")throw Error("Removal requires reconciliation: "+JSON.stringify({phase:result?.phase,mutation_id:result?.mutation_id,uid:d.item.uid}));
   elements.deleteDialog.close();s.pendingDelete=null;s.detailCache.clear();
   report('Removed "'+d.item.name+'" from the catalog.');
   void loadPage(0,null);
  }catch(error){elements.deleteError.textContent=error.message||String(error);}
  finally{busy(false);}
 }
 async function moreFiles(){
  if(!s.activeUid||!s.detail?.files_has_more)return;
  try{
   const offset=s.detail.files_next_offset;
   const response=await api({action:"get",uid:s.activeUid,files_limit:30,files_offset:offset});
   if(s.activeUid!==response.item?.uid||!response.found)return;
   s.detail={...response,files:[...(s.detail.files||[]),...(response.files||[])]};
   s.detailCache.set(s.activeUid,s.detail);renderDetail();
  }catch(error){actionError(error);}
 }
 async function checkUpdates(previousSelection=null){
  if(s.working)return;
  try{
   busy(true);
   elements.updateResults.textContent="Checking upstream revision records on request…";
   const chosen=previousSelection||selectedItem();
   const body={action:"updates"};
   if(chosen?.uid&&["safe_update","manual_update"].includes(chosen.source_mode))
    body.inventory_uids=[chosen.uid];
   const data=await api(body);
   const results=Array.isArray(data)?data:Array.isArray(data?.items)?data.items:
    Array.isArray(data?.updates)?data.updates:Array.isArray(data?.results)?data.results:[];
   elements.updateResults.textContent=results.length?
    results.map(x=>plain(x.name||x.inventory_uid)+": "+plain(x.status||"indeterminate")+
     (x.observed_revision&&x.observed_revision!==x.saved_revision?" · revision differs (unverified)":"")).join(" · "):
    "No update candidates were returned. No changes were installed or published.";
  }catch(error){elements.updateResults.textContent=error.message||String(error);}
  finally{busy(false);}
 }
 elements.list.addEventListener("click",event=>{
  const pick=event.target.closest("[data-ut-pick]");
  if(pick){toggleRowPick(pick.dataset.utPick);return;}
  const pencil=event.target.closest("[data-ut-start-rename]");
  if(pencil){startInlineRename(pencil.dataset.utStartRename);return;}
  const confirm=event.target.closest("[data-ut-confirm-rename]");
  if(confirm){finishInlineRename();return;}
  const cancel=event.target.closest("[data-ut-cancel-rename]");
  if(cancel){finishInlineRename(true);return;}
  const open=event.target.closest("[data-ut-open]");
  if(open){choose(open.dataset.utOpen);return;}
  const edit=event.target.closest("[data-ut-edit]");
  if(edit){const item=s.items.find(x=>x.uid===edit.dataset.utEdit);if(item)openEditor("edit",s.detail?.item?.uid===item.uid?s.detail.item:item);return;}
  const remove=event.target.closest("[data-ut-remove]");
  if(remove){openDelete(remove.dataset.utRemove);return;}
  if(event.target.closest("[data-ut-more-files]"))void moreFiles();
 });
 elements.inspector.addEventListener("transitionend",event=>{
  if(event.target===elements.inspector&&event.propertyName==="opacity"&&!s.activeUid)
   elements.inspector.replaceChildren();
 });
 elements.inspector.addEventListener("click",event=>{
  const edit=event.target.closest("[data-ut-edit]");
  if(edit){const item=s.items.find(x=>x.uid===edit.dataset.utEdit);if(item)openEditor("edit",s.detail?.item?.uid===item.uid?s.detail.item:item);return;}
  const remove=event.target.closest("[data-ut-remove]");
  if(remove){openDelete(remove.dataset.utRemove);return;}
  if(event.target.closest("[data-ut-more-files]"))void moreFiles();
 });
 elements.list.addEventListener("input",event=>{
  const field=event.target.closest(".ut-name-field");
  if(field&&s.renamingUid===field.dataset.utNameField)sizeInlineName(field);
 });
 elements.list.addEventListener("keydown",event=>{
  if(!event.target.matches?.("[data-ut-name]"))return;
  if(event.key==="Escape"){event.preventDefault();finishInlineRename(true);}
  else if(event.key==="Enter"){event.preventDefault();finishInlineRename();}
 });
 elements.pages.addEventListener("click",event=>{
  const action=event.target.closest("[data-ut-page]")?.dataset.utPage;
  if(!action||s.working||s.loading||s.selectionTransitioning||s.editTransitioning)return;
  const page=action==="prev"?s.page-1:action==="next"?s.page+1:Number(action)-1;
  if(!Number.isSafeInteger(page)||page<0||page===s.page)return;
  const filtered=!!s.query||!!Object.keys(s.include).length||!!Object.keys(s.exclude).length;
  const max=filtered?s.page+(s.nextCursor?1:0):Math.max(0,Math.ceil((s.total??0)/s.pageSize)-1);
  if(page>max)return;
  // Stage an active inline edit before the page's row DOM is replaced.
  if(s.renamingUid&&!finishInlineRename())return;
  void loadPage(page,null);
 });
 elements.submit.addEventListener("click",()=>{if(!elements.query.disabled)elements.query.focus({preventScroll:true});});
 elements.query.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void loadPage(0,null);}});
 elements.query.addEventListener("search",()=>void loadPage(0,null));
 elements.sort.addEventListener("change",()=>void loadPage(0,null));
 async function refreshCatalog(){
  if(s.working)return;
  const selectedBeforeRefresh=selectedItem();
  s.collectionChoices=null;elements.updateResults.textContent="";
  // Updates are read-only and run only on explicit user refresh.
  // Initial route entry, search, filters and pagination remain list-only.
  if(await loadPage(0,null))await checkUpdates(selectedBeforeRefresh);
 }
 elements.refresh.addEventListener("click",()=>void refreshCatalog());
 elements.filterToggle.addEventListener("click",()=>{
  const open=elements.filters.hidden;elements.filters.hidden=!open;elements.filterToggle.setAttribute("aria-expanded",String(open));
  if(open)void loadCollectionChoices();
 });
 elements.filters.addEventListener("click",event=>{
  const tab=event.target.closest("[data-ut-filter-tab]");
  if(!tab)return;
  const mode=tab.dataset.utFilterTab;
  if(mode!=="include"&&mode!=="exclude")return;
  elements.filters.dataset.mode=mode;
  for(const button of elements.filters.querySelectorAll("[data-ut-filter-tab]"))
    button.setAttribute("aria-pressed",String(button.dataset.utFilterTab===mode));
 });
 elements.filters.addEventListener("submit",event=>{event.preventDefault();
  const filters=gatherFilters();s.include=filters.include;s.exclude=filters.exclude;filterDot();
  elements.filters.hidden=true;elements.filterToggle.setAttribute("aria-expanded","false");
  void loadPage(0,null);
 });
 elements.clear.addEventListener("click",()=>{
  elements.fields.querySelectorAll("input,select").forEach(x=>x.value="");
  s.include={};s.exclude={};filterDot();void loadPage(0,null);
 });
 
 elements.add.addEventListener("click",()=>openEditor("add"));
 elements.edit.addEventListener("click",toggleEditMode);
 elements.select.addEventListener("click",toggleSelectMode);
 // Match Collections' route-scoped ⇧⌘F / ⇧⌘N / ⇧⌘E shortcuts.
 // Refresh includes the read-only update check (⌃⇧R). Never intercept inputs, dialogs,
 // other workspace routes or an unfinished asynchronous catalog mutation.
 window.addEventListener("keydown",event=>{
  if(event.defaultPrevented||event.isComposing||event.repeat||event.altKey||
     root.closest(".view")?.hidden||document.querySelector("dialog[open]"))return;
  const code=event.code||"",letter=(event.key||"").toLowerCase();
  const editable=event.target instanceof Element&&
   !!event.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  if(event.metaKey&&event.shiftKey&&!event.ctrlKey){
   if((code==="KeyF"||letter==="f")&&!elements.query.disabled){
    event.preventDefault();elements.query.focus({preventScroll:true});elements.query.select();return;
   }
   if(editable&&!s.editMode)return;
   if((code==="KeyN"||letter==="n")&&!elements.add.disabled&&!editable){
    event.preventDefault();openEditor("add");return;
   }
   if((code==="KeyE"||letter==="e")&&!elements.edit.disabled){
    event.preventDefault();toggleEditMode();return;
   }
  }else if(event.ctrlKey&&event.shiftKey&&!event.metaKey&&!editable&&
           (code==="KeyR"||letter==="r")&&!elements.refresh.disabled){
   event.preventDefault();void refreshCatalog();
  }
 },{capture:true});
 elements.editorCancel.addEventListener("click",()=>elements.editor.close());
 elements.editor.addEventListener("close",()=>{s.planned=null;});
 elements.editorForm.addEventListener("submit",event=>{event.preventDefault();void publishEditor();});
 elements.plan.addEventListener("click",()=>void reviewEditor());
 elements.editorForm.addEventListener("input",()=>resetPlan());
 elements.editorForm.addEventListener("change",()=>resetPlan());
 elements.editorFields.addEventListener("change",event=>{
  if(event.target?.name==="route")elements.assets.hidden=event.target.value!=="cloud";
 });
 elements.deleteCancel.addEventListener("click",()=>elements.deleteDialog.close());
 elements.deleteInput.addEventListener("input",()=>{elements.deletePlan.disabled=elements.deleteInput.value!==s.pendingDelete?.item?.name;});
 elements.deletePlan.addEventListener("click",()=>void reviewDelete());
 elements.deletePublish.addEventListener("click",()=>void publishDelete());
 elements.deleteDialog.addEventListener("close",()=>{s.pendingDelete=null;elements.deleteInput.disabled=false;});
 renderFilterControls();filterDot();summary();skeletons();setSummaryLoading(true);
 // Request D1 only upon actual Utilities route entry, never on other workspace pages.
 // Navigation commits view.hidden before emitting hashchange/popstate; no observer or timer.
 let routeVisible=false;
 const onRouteVisibility=()=>{
  const visible=!root.closest(".view")?.hidden;
  if(visible&&!routeVisible){routeVisible=true;void loadPage(0,null);}
  else if(!visible){
   routeVisible=false;
   if(!s.working){
    // Collections clears transient edit/select sessions on navigation away.
    s.renamingUid=null;s.renameInitial="";s.renameDrafts.clear();
    s.selectionMode=false;s.selectionTransitioning=false;s.editMode=false;s.editTransitioning=false;
    s.selection.clear();
    root.classList.remove("ut-entering-selection","ut-leaving-selection","ut-entering-edit","ut-leaving-edit");
    syncModes();
    if(elements.editor.open)elements.editor.close();
    if(elements.deleteDialog.open)elements.deleteDialog.close();
   }
  }
 };
 window.addEventListener("hashchange",onRouteVisibility);
 window.addEventListener("popstate",onRouteVisibility);
 onRouteVisibility();
}
