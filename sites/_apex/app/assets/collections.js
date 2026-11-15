import {formatWorkspaceTime} from "./workspace-nav.js";
import {normalizeCollectionConfiguration,orderedCollectionTree,collectionDescendsFrom,moveCollectionInConfiguration} from "./collections-organization.js";
/* Live Colosseum Collections — no cached collection records, demo data, or polling.
 * The only write surface is /api/colosseum/collections behind the existing
 * DoFinances session + Cloudflare Access + bound owner + HMAC Router bridge.
 * Inventory admission (+) is intentionally disabled until separately designed.
 */
const COLLECTIONS_API="/api/colosseum/collections";
const COLLECTIONS_ACCESS_REAUTH="/api/colosseum/connect?return=collections";
const accessReauthorizationError=message=>{
 const error=Error(message);
 error.reauthorize=true;
 return error;
};
const COLLECTION_ROUTE_ICONS=Object.freeze({
  cloud:{src:"/app/assets/cloud-utility.v2.svg",label:"Cloud utility"},
  direct:{src:"/app/assets/direct-utility.v1.svg",label:"Direct utility"},
  local:{src:"/app/assets/local-provider.v1.svg",label:"Local provider"},
  ported:{src:"/app/assets/external-provider.v3.svg",label:"External provider"}
});
const SUMMARY_GEOMETRY_KEY="dofinances.collections.summary-divider-geometry.v2";
const LEGACY_SUMMARY_SHIFT_KEY="dofinances.collections.summary-slash-shift.v1";
const validSummaryGeometry=value=>Array.isArray(value)&&value.length===3&&
  value.every(n=>Number.isFinite(n)&&n>=0&&n<=1024)&&
  value[0]<value[2]&&value[2]<value[1];
// Store em-based [left edge of " / ", right edge of " / ", left edge of "/"].
// The three tiny scalars survive new page loads and scale with fluid typography.
export function collectionSummaryGeometry(start,end,slash,fontSize){
  if(!Number.isFinite(fontSize)||fontSize<=0)return null;
  const result=[start,end,slash].map(px=>Math.round(px/fontSize*100000)/100000);
  return validSummaryGeometry(result)?result:null;
}

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
// Local, deterministic search: tokenize once, match every term across the
// supplied text fields without polling or additional backend requests.
export function collectionsSearchMatches(text,query){
  const haystack=String(text??"").normalize("NFKC").toLocaleLowerCase("en-US");
  const words=String(query??"").normalize("NFKC").toLocaleLowerCase("en-US").trim().split(/\s+/u).filter(Boolean);
  return words.every(word=>haystack.includes(word));
}
const CHEVRON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const LEFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const RIGHT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const STAR_PATH="M12 1.5 15.26 8.15 22.6 9.22 17.3 14.39 18.55 21.7 12 18.25 5.45 21.7 6.7 14.39 1.4 9.22 8.74 8.15 12 1.5Z";
export function nextCollectionRating(current,clicked){
  // Tapping the currently selected half steps down, and tapping it again refills.
  if(!validCollectionRating(clicked)||clicked===null||clicked===0)return null;
  const previous=validCollectionRating(current)&&current>0?current:null;
  const next=previous===clicked?clicked-.5:clicked;
  return next<=0?null:next;
}
function collectionStarMarkup(rating,{editable=false,memberUid=null}={}){
  const score=validCollectionRating(rating)&&rating>0?rating:null;
  const stars=Array.from({length:5},(_,index)=>{
    const fill=score===null?0:Math.max(0,Math.min(1,score-index))*100;
    const svg='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+STAR_PATH+'"/></svg>';
    const buttons=editable&&isUid(memberUid)?
      '<button type="button" class="cs-star-half" data-half="left" data-cs-member-rating="'+memberUid+'" data-cs-value="'+(index+.5)+'" aria-label="Rate '+(index+.5)+' out of 5"></button>'+
      '<button type="button" class="cs-star-half" data-half="right" data-cs-member-rating="'+memberUid+'" data-cs-value="'+(index+1)+'" aria-label="Rate '+(index+1)+' out of 5"></button>':"";
    return '<span class="cs-star" style="--cs-fill:'+fill+'%"><span class="cs-star-outline">'+svg+'</span><span class="cs-star-fill">'+svg+'</span>'+buttons+'</span>';
  }).join("");
  return '<span class="cs-stars'+(editable?' cs-stars-editable':'')+'" role="group" aria-label="'+(score===null?"Unrated":score+" out of 5 stars")+'">'+stars+'</span>';
}
export function validCollectionRating(value){
  return value===null||(typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=5&&Number.isInteger(value*2));
}
const GRIP='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const PICK_CHECK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
const NAME_PENCIL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15.8 4.7 3.5 3.5M4 20l4.8-1.1L19.6 8.1a2.45 2.45 0 0 0-3.5-3.5L5.3 15.4 4 20Z"/></svg>';
const NAME_APPLY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.4 4.4L19 7.4"/></svg>';
const NAME_CANCEL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
// Clamp a measured glyph width without ever letting it overlap the eye icon.
export function collectionInlineNameWidth(textWidth,availableWidth){
  const available=Math.max(24,Number(availableWidth)||24);
  return Math.min(Math.max(24,available-26),Math.max(24,Math.ceil((Number(textWidth)||0)+10)));
}
// Only names that differ after the same normalization used by Done count
// as changes: adding/removing meaningless spacing does not show a checkmark.
export function collectionInlineNameChanged(initial,draft){
  const canonical=value=>String(value??"").normalize("NFKC").trim().replace(/\s+/gu," ");
  return canonical(initial)!==canonical(draft);
}
const EYE='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.6-6.2 9.5-6.2 9.5 6.2 9.5 6.2-3.6 6.2-9.5 6.2S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18M10 5.9a10.6 10.6 0 0 1 2-.2c5.9 0 9.5 6.3 9.5 6.3a16.8 16.8 0 0 1-2.8 3.2M6.1 7.4C3.8 9.2 2.5 12 2.5 12s3.6 6.3 9.5 6.3c1.1 0 2.2-.2 3.1-.6M10 10a2.8 2.8 0 0 0 3.8 3.8"/></svg>';
const FOLDER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3h8M9 9h6m-6 4h6"/></svg>';
const isUid=value=>/^[0-9a-f]{6}$/.test(value);
export function formatCollectionSummary(updatedAt,count){
  return "TOTAL "+count+" / UPDATED "+formatWorkspaceTime(updatedAt,{hour12:true});
}

export function initColosseumCollections(){
 const root=document.getElementById("cs-root");
 if(!root||root.dataset.ready==="true")return;
 root.dataset.ready="true";
 const $=id=>root.querySelector("#"+id);
 const state={
   collections:[],loaded:false,activeId:null,detail:null,
   collectionQuery:"",utilityQuery:"",
   page:1,pageSize:10,selecting:false,selected:new Set(),
   busy:false,loadSeq:0,detailSeq:0,
   editing:false,configRevision:0,configEntries:{},configDirty:false,
   memberDrafts:new Map(),localEditingId:null,descriptionDraft:null,descriptionEditing:false,
   nameDrafts:new Map(),renamingId:null,renameEpoch:0,renameInitialValue:"",draggingId:null,editTransitioning:false,
   collectionSelecting:false,selectedCollections:new Set(),collectionSelectTransitioning:false
 };
 const list=$("cs-list"),detail=$("cs-detail"),pagination=$("cs-pagination");
 const layout=list.closest(".cs-layout");
 // Let a closed card finish sliding offscreen before removing its content.
 // Native CSS events keep motion synchronized without polling or timers.
 function finishDesktopDetailMotion(event){
   if(event.target!==layout||event.propertyName!=="grid-template-columns")return;
   layout.classList.remove("cs-detail-resizing");
   if(!state.activeId&&detail.classList.contains("cs-empty"))detail.replaceChildren();
 }
 layout.addEventListener("transitionend",finishDesktopDetailMotion);
 layout.addEventListener("transitioncancel",finishDesktopDetailMotion);
 const collectionSearch=$("cs-collection-search"),collectionSearchFocus=$("cs-focus-collection-search");
 const status=$("cs-status"),summary=$("cs-summary"),summaryValue=summary.querySelector(".cs-summary-value"),createButton=$("cs-create"),refreshButton=$("cs-refresh");
 const editDialog=$("cs-form-dialog"),deleteDialog=$("cs-delete-dialog"),contextDialog=$("cs-context-dialog"),editButton=$("cs-edit"),selectButton=$("cs-select-collections");
 let rowContextUid=null;
 const validRating=validCollectionRating;
 const localEditorActive=()=>!!state.localEditingId&&state.localEditingId===state.activeId;
 const membershipKey=(collectionId,uid)=>collectionId+":"+uid;
 const memberAnnotation=uid=>{
   const key=membershipKey(state.activeId,uid);
   const value=state.memberDrafts.get(key)??state.detail?.item_metadata?.[uid];
   return {rating:validRating(value?.rating)&&value.rating>0?value.rating:null,context:typeof value?.context==="string"?value.context:"",hidden:value?.hidden===true};
 };
 function stageMemberAnnotation(uid,changes){
   if(!localEditorActive()||state.busy||!isUid(uid)||
      !state.detail?.item_uids?.includes(uid)||!state.activeId)return;
   const next={...memberAnnotation(uid),...changes};
   // Legacy zero values and explicit unrated both resolve to null.
   if(next.rating===0)next.rating=null;
   if(!validRating(next.rating)||typeof next.context!=="string"||[...next.context].length>250||typeof next.hidden!=="boolean")return;
   const original=state.detail.item_metadata?.[uid];
   const priorRating=validRating(original?.rating)&&original.rating>0?original.rating:null;
   if(next.rating===priorRating&&next.context===(original?.context??"")&&next.hidden===(original?.hidden===true))
     state.memberDrafts.delete(membershipKey(state.activeId,uid));
   else state.memberDrafts.set(membershipKey(state.activeId,uid),next);
   renderCard();
 }
 function readStoredGeometry(){
   try{
     const raw=window.localStorage.getItem(SUMMARY_GEOMETRY_KEY);
     const value=raw===null?null:JSON.parse(raw);
     return validSummaryGeometry(value)?value:null;
   }catch{return null;} // Storage can be disabled; the live API is unaffected.
 }
 let activeGeometry=null;
 const initialGeometry=readStoredGeometry();
 let storedGeometry=initialGeometry?JSON.stringify(initialGeometry):null;
 function applyGeometry(geometry,persist=false){
   if(!validSummaryGeometry(geometry))return;
   const encoded=JSON.stringify(geometry);
   if(encoded!==activeGeometry){
     summary.style.setProperty("--cs-summary-group-start",geometry[0]+"em");
     summary.style.setProperty("--cs-summary-group-end",geometry[1]+"em");
     summary.style.setProperty("--cs-summary-slash-left",geometry[2]+"em");
     activeGeometry=encoded;
   }
   if(persist&&encoded!==storedGeometry){
     try{
       window.localStorage.setItem(SUMMARY_GEOMETRY_KEY,encoded);
       storedGeometry=encoded;
     }catch{}
   }
 }
 if(initialGeometry)applyGeometry(initialGeometry);
 function measureSeparator(value){
   const text=value?.firstChild;
   const index=text?.nodeType===3?text.textContent.indexOf(" / "):-1;
   if(index<0||!value.getClientRects().length)return null;
   const range=document.createRange();
   const origin=value.getBoundingClientRect().left; // Same left boundary as TOTAL.
   range.setStart(text,index);
   range.setEnd(text,index+3); // Both spaces AND the slash.
   const group=range.getBoundingClientRect();
   range.setStart(text,index+1);
   range.setEnd(text,index+2);
   const glyph=range.getBoundingClientRect();
   const fontSize=parseFloat(getComputedStyle(summary).fontSize);
   return group.width>0&&glyph.width>0?
     collectionSummaryGeometry(group.left-origin,group.right-origin,glyph.left-origin,fontSize):null;
 }
 function ensureInitialGeometry(){
   if(activeGeometry!==null)return;
   // Only on the first uncached visit: measure the existing placeholder once.
   const probe=document.createElement("span");
   probe.textContent=summaryValue.textContent;
   probe.style.cssText="position:fixed;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none";
   summary.append(probe);
   let geometry=measureSeparator(probe);
   probe.remove();
   if(!geometry)return;
   try{
     const raw=window.localStorage.getItem(LEGACY_SUMMARY_SHIFT_KEY);
     const shift=raw===null?NaN:Number(raw);
     if(Number.isFinite(shift)&&shift>=0&&shift<=256){
       // Old flex layout: 1em ring + .75em gap before the slash glyph.
       // Reuse its saved expected position, then add the measured widths of
       // the preceding space, slash, and following space.
       const em=parseFloat(getComputedStyle(summary).fontSize);
       const oldSlash=shift/em+1.75;
       const delta=oldSlash-geometry[2];
       geometry=geometry.map(value=>Math.round((value+delta)*100000)/100000);
     }
   }catch{}
   applyGeometry(geometry);
 }
 function announce(message,error=false,visible=false,reauthorize=false){
   status.textContent=message;
   if(reauthorize){
     const link=document.createElement("a");
     link.href=COLLECTIONS_ACCESS_REAUTH;
     link.className="cs-access-reauthorize";
     link.textContent="Reauthorize Colosseum";
     status.append(" ",link);
   }
   status.dataset.error=error?"true":"false";
   status.dataset.visible=error||visible?"true":"false";
 }
 function renderLoadingRows(){
   if(state.loaded)return;
   // First load uses ten natural-height placeholders; never fabricate collection names.
   list.innerHTML=Array.from({length:state.pageSize},(_,i)=>
     '<article class="cs-entry cs-entry--skeleton" aria-hidden="true">'+
     '<div class="cs-skeleton-row"><span class="cs-skeleton-number">'+String(i+1).padStart(2,"0")+'</span>'+
     '<span class="cs-skeleton-bar"></span></div></article>').join("");
 }
 function setSummaryLoading(loading){
   if(loading)ensureInitialGeometry();
   if(loading&&!state.loaded)renderLoadingRows();
   // A single parent state synchronizes pulses, preserving mounted rows and geometry.
   list.classList.toggle("cs-list-loading",loading);
   list.setAttribute("aria-busy",String(loading));
   summary.classList.toggle("cs-summary-loading",loading);
   summary.setAttribute("aria-busy",String(loading));
   refreshButton.classList.toggle("cs-refreshing",loading);
   refreshButton.setAttribute("aria-busy",String(loading));
 }
 function setBusy(value){
   state.busy=value;
   refreshButton.disabled=value||state.editing||state.collectionSelecting||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive();
   createButton.disabled=value||state.editing||state.collectionSelecting||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive();
   editButton.disabled=value||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive();
   selectButton.disabled=value||state.editing||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive();
   collectionSearch.disabled=value||state.editing||state.collectionSelecting||
     state.editTransitioning||state.collectionSelectTransitioning||localEditorActive();
   collectionSearchFocus.disabled=collectionSearch.disabled;
   root.querySelectorAll(".cs-actions button, .cs-utility-toolbar button, .cs-utility-trash").forEach(button=>{
     const action=button.dataset.csAction;
     button.disabled=value||action==="admit"||
       (action==="remove"&&(!state.selecting||!state.selected.size))||
       (action==="edit"&&(state.selecting||!state.detail))||
       (action==="select"&&(localEditorActive()||(!state.selecting&&!state.detail?.item_uids?.length)));
   });
   syncUtilityChrome();
 }
 async function request(action,data={},firstList=false){
   const method=firstList?"GET":"POST";
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),25000);
   const options={method,credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}};
   if(method==="POST"){
     options.headers["Content-Type"]="application/json";
     options.body=JSON.stringify({action,...data});
   }
   try{
     let response;
     try{response=await fetch(COLLECTIONS_API,options);}
     catch(error){
       if(error?.name==="AbortError")throw Error("The Collections request timed out. Try Refresh.");
       if(error instanceof TypeError)throw accessReauthorizationError(
         "Could not reach Colosseum. Your Cloudflare Access session may have expired.");
       throw error;
     }
     if(!(response.headers.get("content-type")||"").includes("application/json"))
       throw accessReauthorizationError("Colosseum owner verification is required. Reauthorize Cloudflare Access to continue.");
     const body=await response.json();
     if(response.status===403&&/Cloudflare owner verification required/i.test(body.error||""))
       throw accessReauthorizationError("Cloudflare owner authorization is required.");
     if(!response.ok||body.ok!==true){
       const codes={
         collection_revision_conflict:"This collection changed in another session. Refresh before trying again.",
         collection_configuration_conflict:"Another session changed the collection organization. Refresh before saving.",
         collection_cycle:"A collection cannot be placed inside itself or one of its descendants.",
         collection_exists:"A collection with that name already exists.",
         collection_name_taken:"A collection with that name already exists.",
         collection_not_found:"That collection no longer exists. Refresh to see the current list.",
         unauthorized:"Collection access was denied by Colosseum.",
         invalid_request:"The requested collection change was rejected.",
         temporarily_unavailable:"The Colosseum collection service is temporarily unavailable."
       };
       throw Error(codes[body.error]||body.error||"Collection request failed (HTTP "+response.status+").");
     }
     return body;
   }finally{clearTimeout(timer);}
 }
 const activeCollection=()=>state.collections.find(item=>item.collection_id===state.activeId)||null;
 const matchingCollections=()=>state.collectionQuery.trim()?
   state.collections.filter(col=>collectionsSearchMatches([col.name,col.description,col.collection_id].join(" "),state.collectionQuery)):
   state.collections;
 const pageCount=()=>Math.max(1,Math.ceil(matchingCollections().length/state.pageSize));
 const pageItems=()=>matchingCollections().slice((state.page-1)*state.pageSize,state.page*state.pageSize);
 const routeActive=()=>{
   const hash=location.hash.replace(/^#/,"").replace(/\/$/,"").toLowerCase();
   return hash?hash==="colosseum/collections":
     location.pathname.replace(/\/+$/,"").toLowerCase()==="/app/colosseum/collections";
 };
 const UTILITY_DONE_SVG='<svg class="cs-utility-done" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4.7 12.1 5 5.1L19.5 7.3"/></svg>';
 // Keep all controls mounted while their native symbols crossfade to Done.
 function utilityToolbarMarkup(){
   const activeEdit=localEditorActive(),activeSelect=state.selecting;
   const enabled=!state.busy&&!!state.detail;
   return '<span class="cs-utility-management">'+
     '<span class="cs-utility-trash-control">'+
       '<button class="cs-utility-trash" type="button" data-cs-action="remove" aria-label="Remove selected utilities"'+(!enabled||!activeSelect||!state.selected.size?' disabled':'')+'>'+
         '<img src="/app/assets/trash-utilities.v1.svg" alt="" aria-hidden="true"></button>'+
       '<span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">Remove selected utilities</span></span></span>'+
     // Add remains disabled, but is outside the joined Edit/Select control.
     '<span class="cs-utility-action-control cs-utility-action-control--add"><button class="cs-utility-action cs-utility-action--add" type="button" data-cs-action="admit" disabled aria-label="Add utilities (coming later)" title="Utility admission will be configured later">'+
         '<img src="/app/assets/add-utilities.v1.svg" alt="" aria-hidden="true"></button>'+
       '<span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">Add utilities (coming later)</span></span></span>'+
     '<span class="cs-utility-toolbar" role="group" aria-label="Utility management">'+
       '<span class="cs-utility-action-control"><button class="cs-utility-action" type="button" data-cs-action="edit" aria-label="'+(activeEdit?'Done editing utilities':'Edit utilities')+'" aria-pressed="'+String(activeEdit)+'"'+(!enabled||activeSelect?' disabled':'')+'>'+
         '<img class="cs-utility-glyph" src="/app/assets/edit-collections.v1.svg" alt="" aria-hidden="true">'+UTILITY_DONE_SVG+'</button>'+
       '<span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">'+(activeEdit?'Done editing utilities':'Edit utilities')+'</span></span></span>'+
       '<span class="cs-utility-action-control"><button class="cs-utility-action" type="button" data-cs-action="select" aria-label="'+(activeSelect?'Done selecting utilities':'Select utilities')+'" aria-pressed="'+String(activeSelect)+'"'+(!enabled||activeEdit||(!activeSelect&&!state.detail?.item_uids?.length)?' disabled':'')+'>'+
         '<img class="cs-utility-glyph" src="/app/assets/select-collections.v3.svg" alt="" aria-hidden="true">'+UTILITY_DONE_SVG+'</button>'+
       '<span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">'+(activeSelect?'Done selecting utilities':'Select utilities')+'</span></span></span></span></span>';
 }
 function rowMarkup(collection,index){
   const n=(state.page-1)*state.pageSize+index+1;
   const id="cs-panel-"+n;
   const uuid=esc(collection.collection_id);
   const entry=state.configEntries[collection.collection_id]||{hidden:false};
   const depth=Math.min(8,Math.max(0,collection.collection_depth||0));
   const draft=state.nameDrafts.get(collection.collection_id)??collection.name;
   const editing=state.editing;
   const picking=state.collectionSelecting;
   const picked=state.selectedCollections.has(collection.collection_id);
   const off=editing?"":' disabled tabindex="-1" aria-hidden="true"';
   const pickOff=picking?"":' disabled tabindex="-1" aria-hidden="true"';
   return '<article class="cs-entry'+(entry.hidden?' cs-is-hidden':'')+'" data-cs-id="'+uuid+'" data-cs-depth="'+depth+'" style="--cs-depth:'+depth+'">'+
     '<h2 class="cs-entry-heading">'+
       '<button class="cs-drag-handle" type="button" draggable="true" data-cs-drag="'+uuid+'" aria-label="Drag '+esc(collection.name)+' to reorder or nest" title="Drag to reorder or move into a collection"'+off+'>'+GRIP+'</button>'+
       '<button class="cs-trigger" type="button" data-cs-open="'+uuid+'" id="cs-trigger-'+n+'" aria-controls="'+id+'" aria-expanded="false"'+(editing||picking?' disabled tabindex="-1"':'')+'>'+
       '<span class="cs-num">'+String(n).padStart(2,"0")+'</span>'+
       '<span class="cs-entry-title"><span class="cs-title-measure" aria-hidden="true">'+esc(collection.name)+'</span>'+
         '<span class="cs-title-compact" aria-hidden="true">'+esc(collection.name)+'</span>'+
         '<span class="cs-title-expanded">'+esc(collection.name)+'</span></span>'+
       '<span class="cs-chevron">'+CHEVRON+'</span></button>'+
       '<button class="cs-collection-pick" type="button" data-cs-pick="'+uuid+'" aria-label="'+(picked?'Deselect ':'Select ')+esc(collection.name)+'" aria-pressed="'+String(picked)+'"'+pickOff+'><span class="cs-select-bubble" aria-hidden="true">'+PICK_CHECK+'</span></button>'+
       '<span class="cs-name-field" data-cs-name-field="'+uuid+'">'+
         '<span class="cs-name-editor">'+
           '<span class="cs-name-measure" aria-hidden="true">'+esc(draft||" ")+'</span>'+
           '<input class="cs-inline-name" type="text" data-cs-name="'+uuid+'" value="'+esc(draft)+'" aria-label="Rename '+esc(collection.name)+'" maxlength="100" autocomplete="off" spellcheck="false" disabled tabindex="-1" aria-hidden="true">'+
           '<span class="cs-name-underline" aria-hidden="true"></span></span>'+
         '<button class="cs-name-pencil" type="button" data-cs-start-rename="'+uuid+'" aria-label="Rename '+esc(collection.name)+'" title="Rename collection"'+off+'>'+NAME_PENCIL+'</button>'+
         '<span class="cs-name-actions" hidden>'+
           '<button class="cs-name-action cs-name-confirm" type="button" data-cs-confirm-rename="'+uuid+'" aria-label="Apply name change" title="Apply name change" disabled tabindex="-1" hidden>'+NAME_APPLY+'</button>'+
           '<button class="cs-name-action cs-name-cancel" type="button" data-cs-cancel-rename="'+uuid+'" aria-label="Cancel name change" title="Cancel name change" disabled tabindex="-1">'+NAME_CANCEL+'</button>'+
         '</span></span>'+
       '<button class="cs-visibility-toggle" type="button" data-cs-visibility="'+uuid+'" aria-label="'+(entry.hidden?'Show ':'Hide ')+esc(collection.name)+' to ChatGPT" aria-pressed="'+String(entry.hidden)+'" title="'+(entry.hidden?'Show to ChatGPT':'Hide from ChatGPT')+'"'+off+'>'+(entry.hidden?EYE_OFF:EYE)+'</button>'+
     '</h2>'+
     '<div class="cs-accordion-panel" id="'+id+'" role="region" aria-labelledby="cs-trigger-'+n+'" aria-hidden="true">'+
       '<div class="cs-panel-clip"><div class="cs-panel-inner">'+
         '<div class="cs-description-inline" data-cs-description-editor>'+
           '<div class="cs-description-read"><span class="cs-description" data-cs-description-read>'+esc(state.localEditingId===collection.collection_id&&state.descriptionDraft!==null?state.descriptionDraft:(collection.description||"No description provided."))+'</span>'+
             '<button type="button" class="cs-description-pencil" data-cs-description-start aria-label="Edit collection description" title="Edit description" hidden>'+NAME_PENCIL+'</button></div>'+
           '<div class="cs-description-write" hidden><span class="cs-description-input-wrap">'+
             '<textarea class="cs-description-input" data-cs-description-input maxlength="2000" rows="3" aria-label="Collection description">'+esc(collection.description||"")+'</textarea>'+
             '<span class="cs-description-underline" aria-hidden="true"></span></span>'+
             '<span class="cs-description-actions">'+
               '<button class="cs-name-action cs-name-confirm" type="button" data-cs-description-confirm aria-label="Confirm description" title="Confirm description">'+NAME_APPLY+'</button>'+
               '<button class="cs-name-action cs-name-cancel" type="button" data-cs-description-cancel aria-label="Cancel description edit" title="Cancel description edit">'+NAME_CANCEL+'</button>'+
             '</span></div></div>'+
         
         '<div class="cs-mobile-detail" data-cs-mobile></div>'+
       '</div></div></div></article>';
 }
 function renderPages(){
   const pages=pageCount();state.page=Math.min(Math.max(1,state.page),pages);
   const first=(state.page-1)*state.pageSize+1;
   const total=matchingCollections().length;
   $("cs-countline").textContent=state.loaded?
     (total?first+'–'+Math.min(first+state.pageSize-1,total)+' of '+total:'0 of 0'):"";
   if(pages===1){pagination.innerHTML='';return;}
   const from=Math.max(1,Math.min(state.page-2,pages-4)),to=Math.min(pages,from+4);
   const numbers=new Set([1,pages]);for(let p=from;p<=to;p++)numbers.add(p);
   let last=0;
   const cells=[...numbers].sort((a,b)=>a-b).map(n=>{
     const gap=n>last+1?'<span aria-hidden="true" class="cs-countline">…</span>':'';
     last=n;
     return gap+'<button type="button" class="cs-page" data-cs-page="'+n+'" aria-label="Page '+n+'"'+
       (state.page===n?' aria-current="page"':'')+'>'+n+'</button>';
   }).join("");
   pagination.innerHTML='<button class="cs-page" type="button" data-cs-page="prev" aria-label="Previous collections page"'+(state.page===1?' disabled':'')+'>'+LEFT+'</button>'+
     cells+'<button class="cs-page" type="button" data-cs-page="next" aria-label="Next collections page"'+(state.page===pages?' disabled':'')+'>'+RIGHT+'</button>';
 }
 function renderRows(){
   // A rebuilt row cannot keep an active editor; the input listener already stored its draft.
   state.renamingId=null;
   if(!state.loaded){list.innerHTML='<p class="cs-loading">Reading collections directly from Colosseum…</p>';renderPages();return;}
   if(!state.collections.length){list.innerHTML='<p class="cs-loading">No collections yet. Use New collection to create one.</p>';renderPages();return;}
   if(!matchingCollections().length){
     list.innerHTML='<p class="cs-loading cs-search-empty">No collections match your search.</p>';
     renderPages();return;
   }
   root.classList.toggle("cs-editing",state.editing);
   root.classList.toggle("cs-collection-selecting",state.collectionSelecting);
   list.innerHTML=pageItems().map(rowMarkup).join("");
   renderPages();syncAccordion();syncRowEditing();
 }
 function syncAccordion(){
   list.querySelectorAll(".cs-entry").forEach(el=>{
     const open=el.dataset.csId===state.activeId;
     el.classList.toggle("cs-open",open);
     el.querySelector(".cs-trigger").setAttribute("aria-expanded",String(open));
     el.querySelector(".cs-accordion-panel").setAttribute("aria-hidden",String(!open));
   });
   syncActions();
   syncDescriptionEditor();
 }
 function syncActions(){
   // Count lives in the footer; update mounted desktop/mobile cards in place.
   const count=Array.isArray(state.detail?.item_uids)?state.detail.item_uids.filter(isUid).length:null;
   const label=count===null?"— utilities":count+" "+(count===1?"utility":"utilities");
   for(const badge of root.querySelectorAll(".cs-summary .cs-inline-utility-count"))
     if(badge.textContent!==label)badge.textContent=label;
 }
 function cardMarkup(){
   const col=activeCollection(),current=state.detail;
   if(!col)return "";
   if(!current)return '<div class="cs-card" role="status"><span class="cs-loading">Loading live collection members…</span></div>';
   const ids=Array.isArray(current.item_uids)?current.item_uids.filter(isUid):[];
   const subcollections=state.collections.filter(x=>state.configEntries[x.collection_id]?.parent_id===col.collection_id);
   const items=Array.isArray(current.items)?current.items:[];
   const map=new Map(items.filter(x=>x&&isUid(x.uid)).map(x=>[x.uid,x]));
   const names=ids.map(uid=>{
     const item=map.get(uid)||{uid,name:uid};
     const routes=current.routes&&current.routes[uid]&&current.routes[uid].route_mode;
     const annotation=memberAnnotation(uid);
     const hasRating=annotation.rating!==null;
     const hasContext=annotation.context.length>0;
     const hiddenMember=annotation.hidden===true;
     const editingMember=localEditorActive();
     // The eye is scoped to this collection's direct membership.
     const visibilityButton=editingMember?
       '<span class="cs-member-visibility-control"><button class="cs-member-visibility" type="button" data-cs-member-visibility="'+uid+'" aria-label="'+(hiddenMember?'Show ':'Hide ')+esc(item.name||uid)+' to ChatGPT in '+esc(col.name)+'" aria-pressed="'+String(hiddenMember)+'" title="'+(hiddenMember?'Show to ChatGPT':'Hide from ChatGPT')+' in this collection">'+(hiddenMember?EYE_OFF:EYE)+'</button><span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">'+(hiddenMember?'Show in this collection':'Hide in this collection')+'</span></span></span>':"";
     const contextButton=editingMember?
       '<span class="cs-context-control"><button class="cs-context-button" type="button" data-cs-member-context="'+uid+'" aria-label="'+(hasContext?'Edit Context':'Add Context')+' for '+esc(item.name||uid)+'" title="'+(hasContext?'Edit Context':'Add Context')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 3V5Z"/><path d="M8 9h8m-8 4h5"/></svg></button><span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">'+(hasContext?'Edit Context':'Add Context')+'</span></span></span>':"";
     const stars=(editingMember||hasRating)?collectionStarMarkup(annotation.rating,{editable:editingMember,memberUid:uid}):"";
     const annotationControls=(editingMember||hasRating)?
       '<span class="cs-member-rating-actions">'+visibilityButton+contextButton+stars+'</span>':"";
     const contextMarkup=hasContext?'<span class="cs-member-context">'+esc(annotation.context)+'</span>':"";
     const routeIcon=Object.hasOwn(COLLECTION_ROUTE_ICONS,routes)?COLLECTION_ROUTE_ICONS[routes]:null;
     const selected=state.selected.has(uid);
     const searchIndex=esc([item.name||uid,uid,annotation.context,routes||""].join(" "));
     // The former right-aligned route icon now occupies a CONSTANT-width
     // left slot in every row, including unknown route modes. Both the name
     // and UID therefore begin at exactly the same horizontal coordinate.
     const content='<span class="cs-utility-route-slot">'+
       (routeIcon?'<span class="cs-utility-route-icon cs-utility-route-icon--'+routes+'" role="img" aria-label="'+routeIcon.label+'"></span>':"")+
       '</span>'+
       '<span class="cs-utility-info"><span class="cs-utility-name">'+esc(item.name||uid)+'</span>'+
         '<span class="cs-utility-uid">'+uid+'</span>'+contextMarkup+'</span>'+
       annotationControls+
       '<span class="cs-utility-trailing">'+
       '<button type="button" class="cs-utility-pick" data-cs-pick-utility="'+uid+'" data-cs-utility-name="'+esc(item.name||uid)+'" aria-label="'+(selected?'Deselect ':'Select ')+esc(item.name||uid)+'" aria-pressed="'+String(selected)+'"'+(!state.selecting?' disabled tabindex="-1" aria-hidden="true"':'')+'><span class="cs-select-bubble" aria-hidden="true">'+PICK_CHECK+'</span></button></span>';
     return '<div class="cs-utility-row'+(hiddenMember?' cs-utility-is-hidden':'')+'" data-cs-utility-index="'+searchIndex+'">'+content+'</div>';
   }).join("");
   return '<div class="cs-card"><div class="cs-card-heading"><span class="cs-card-label">'+FOLDER+'Utilities</span>'+
     utilityToolbarMarkup()+'</div>'+
     '<div class="cs-search cs-utility-search" role="search" aria-label="Search utilities in '+esc(col.name)+'">'+
       '<span class="cs-search-control"><button class="cs-search-focus" type="button" data-cs-focus-utility-search aria-label="Focus utility search" title="Search utilities">'+
         '<img src="/app/assets/magnifying-glass.v2.svg" alt="" aria-hidden="true"></button>'+
         '<span class="cs-create-tooltip" role="tooltip"><span class="cs-create-tooltip-label">Search utilities</span></span></span>'+
       '<input data-cs-utility-search type="search" aria-label="Search utility names, IDs and context" placeholder="Search utilities" autocomplete="off" spellcheck="false" value="'+esc(state.utilityQuery)+'">'+
     '</div>'+
     '<p class="cs-search-results" data-cs-utility-results role="status" aria-live="polite" hidden></p>'+
     '<div class="cs-utility-list" role="group" aria-label="Utilities in '+esc(col.name)+'">'+
       (names||'<p class="cs-utility-empty">This collection has no utilities yet.</p>')+
       '<p class="cs-utility-empty cs-utility-no-results" hidden>No utilities match your search.</p>'+
     '</div>'+(subcollections.length?'<div class="cs-subcollections"><span class="cs-subcollections-label">Subcollections · '+subcollections.length+'</span>'+subcollections.map(child=>
       '<button type="button" class="cs-subcollection-link" data-cs-jump-child="'+esc(child.collection_id)+'">'+esc(child.name)+'</button>').join("")+'</div>':'')+
     '<div class="cs-summary" aria-label="Collection revision and total utilities">'+
     '<span class="cs-card-badge cs-revision-badge" aria-label="Collection revision">Revision '+esc(current.revision)+'</span>'+
     '<span class="cs-card-badge cs-inline-utility-count" aria-label="Total utilities">'+ids.length+' '+(ids.length===1?'utility':'utilities')+'</span></div></div>';
 }
 function filterUtilityRows(){
   const query=state.utilityQuery.trim();
   for(const card of root.querySelectorAll(".cs-card")){
     const input=card.querySelector("[data-cs-utility-search]");
     if(!input)continue;
     if(input.value!==state.utilityQuery)input.value=state.utilityQuery;
     const rows=[...card.querySelectorAll(".cs-utility-row")];
     let shown=0;
     for(const row of rows){
       const visible=collectionsSearchMatches(row.dataset.csUtilityIndex,query);
       row.hidden=!visible;
       if(visible)shown++;
     }
     const empty=card.querySelector(".cs-utility-no-results");
     if(empty)empty.hidden=!query||shown!==0||rows.length===0;
     const results=card.querySelector("[data-cs-utility-results]");
     if(results){
       results.hidden=!query;
       results.textContent=query?shown+" of "+rows.length+" utilities shown":"";
     }
   }
 }
 function renderCard(){
   const selected=!!state.activeId;
   const wasOpen=layout.classList.contains("cs-detail-open");
   // An open-to-open row change replaces the content without reanimating
   // the grid. Only null-to-open and open-to-null animate both columns.
   if(wasOpen!==selected){
     const animate=window.matchMedia?.("(min-width:1024px) and (prefers-reduced-motion:no-preference)")?.matches &&
       !root.closest(".view")?.hidden;
     layout.classList.toggle("cs-detail-resizing",!!animate);
   }
   layout.classList.toggle("cs-detail-open",selected);
   detail.classList.toggle("cs-empty",!selected);
   detail.setAttribute("aria-hidden",String(!selected));
   const markup=selected?cardMarkup():"";
   // On an explicit close, keep the outgoing card painted during its
   // rightward slide. The grid transitionend handler removes it after.
   if((selected||!layout.classList.contains("cs-detail-resizing"))&&detail.innerHTML!==markup)
     detail.innerHTML=markup;
   syncDescriptionEditor();
   const mobile=list.querySelector(".cs-entry.cs-open [data-cs-mobile]");
   if(mobile){
     if(mobile.innerHTML!==markup)mobile.innerHTML=markup;
     // The mobile card belongs to the animating accordion's intrinsic height.
     // Let its loading→populated size grow continuously, rather than changing
     // the 0fr→1fr accordion track's target height in a single frame.
     mobile.classList.toggle("cs-members-ready",selected&&!!state.detail);
   }
   filterUtilityRows();
   syncUtilityChrome();
 }
 // These updates never rebuild a utility row, so entering and exiting
 // selection genuinely animate both the bubble and the route-icon position.
 function syncUtilityChrome(){
   root.classList.toggle("cs-utility-selecting",state.selecting);
   for(const card of root.querySelectorAll(".cs-card")){
     const edit=card.querySelector('.cs-utility-toolbar [data-cs-action="edit"]');
     const select=card.querySelector('.cs-utility-toolbar [data-cs-action="select"]');
     const trash=card.querySelector(".cs-utility-trash");
     const editing=localEditorActive();
     for(const [button,active,name] of [[edit,editing,"editing"],[select,state.selecting,"selecting"]]){
       if(!button)continue;
       const aria=active?"Done "+name+" utilities":name==="editing"?"Edit utilities":"Select utilities";
       button.setAttribute("aria-pressed",String(active));
       button.setAttribute("aria-label",aria);
       const tooltip=button.nextElementSibling?.querySelector(".cs-create-tooltip-label");
       if(tooltip)tooltip.textContent=aria;
       button.disabled=state.busy||!state.detail||
         (name==="editing"?state.selecting:editing||(!state.selecting&&!state.detail.item_uids?.length));
     }
     if(trash)trash.disabled=state.busy||!state.selecting||!state.selected.size;
     for(const pick of card.querySelectorAll(".cs-utility-pick")){
       const uid=pick.dataset.csPickUtility,chosen=state.selected.has(uid);
       pick.setAttribute("aria-pressed",String(chosen));
       pick.setAttribute("aria-label",(chosen?"Deselect ":"Select ")+pick.dataset.csUtilityName);
       pick.disabled=!state.selecting||state.busy;
       pick.tabIndex=pick.disabled?-1:0;
       if(pick.disabled)pick.setAttribute("aria-hidden","true");
       else pick.removeAttribute("aria-hidden");
     }
   }
 }
 function openCollection(id){
   if(state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning)return;
   if(localEditorActive()){announce("Save or cancel this collection's edits before closing or switching collections.",true,true);return;}
   const next=state.activeId===id?null:id;
   state.utilityQuery="";
   state.activeId=next;state.selecting=false;state.selected.clear();state.detail=null;
   ++state.detailSeq;
   syncAccordion();renderCard();
   if(next)void loadDetail(next);
 }
 async function loadDetail(id){
   const seq=++state.detailSeq;
   const col=activeCollection();
   if(!col||col.collection_id!==id)return;
   try{
     const result=await request("get",{name:col.name});
     if(seq!==state.detailSeq||state.activeId!==id)return;
     if(!result.found||result.collection_id!==id)throw Error("Collection changed while loading. Refresh to see its current state.");
     state.detail=result;syncActions();renderCard();
   }catch(error){
     if(seq===state.detailSeq&&state.activeId===id){
       state.detail=null;syncActions();
       const err='<div class="cs-card"><p class="cs-notice cs-error">'+esc(error.message)+'</p></div>';
       detail.innerHTML=err;
       const mobile=list.querySelector(".cs-entry.cs-open [data-cs-mobile]");
       if(mobile)mobile.innerHTML=err;
       announce(error.message,true,false,error.reauthorize===true);
     }
   }
 }
 async function loadList({focusName=null,focusId=null}={}){
   const seq=++state.loadSeq;
   refreshButton.disabled=true;
   setSummaryLoading(true);
   announce("Refreshing live collections from Colosseum…");
   try{
     let page=await request("list",{},true);
     const configuration=page.configuration||null;
     const all=[],cursors=new Set();
     for(let batch=0;batch<100;batch++){
       if(!Array.isArray(page.collections))throw Error("Colosseum returned an invalid collections listing.");
       all.push(...page.collections);
       if(!page.next_cursor)break;
       if(cursors.has(page.next_cursor)||batch===99)throw Error("Colosseum returned an invalid pagination cursor.");
       cursors.add(page.next_cursor);
       page=await request("list",{page_size:100,cursor:page.next_cursor});
     }
     if(seq!==state.loadSeq)return;
     const good=all.filter(item=>item&&typeof item.collection_id==="string"&&
       typeof item.name==="string"&&Number.isInteger(item.revision));
     const seen=new Set();
     const distinct=good.filter(item=>{if(seen.has(item.collection_id))return false;seen.add(item.collection_id);return true;});
     const normalized=normalizeCollectionConfiguration(distinct,configuration);
     state.configRevision=normalized.revision;state.configEntries=normalized.entries;
     state.configDirty=false;state.nameDrafts.clear();
     state.collections=orderedCollectionTree(distinct,state.configEntries);
     state.loaded=true;
     let chosen=focusId?state.collections.find(x=>x.collection_id===focusId):null;
     if(!chosen&&focusName)chosen=state.collections.find(x=>x.name.toLocaleLowerCase()===focusName.toLocaleLowerCase());
     if(!chosen&&state.activeId)chosen=state.collections.find(x=>x.collection_id===state.activeId);
     const visible=matchingCollections();
     if(chosen&&!visible.some(item=>item.collection_id===chosen.collection_id))chosen=null;
     if(!chosen||chosen.collection_id!==state.activeId)state.utilityQuery="";
     state.activeId=chosen?.collection_id||null;
     state.selecting=false;state.selected.clear();state.detail=null;++state.detailSeq;
     if(chosen)state.page=Math.floor(visible.findIndex(x=>x.collection_id===chosen.collection_id)/state.pageSize)+1;
     state.page=Math.min(Math.max(1,state.page),pageCount());
     renderRows();renderCard();
     const refreshedAt=new Date();
     summaryValue.textContent=formatCollectionSummary(refreshedAt,state.collections.length);
     setSummaryLoading(false);
     // One measurement after the load, when the skeleton is hidden.
     // No measurements, reads, observers, or timers in the animation loop.
     applyGeometry(measureSeparator(summaryValue),true);
     announce(""); // The eyebrow already displays the live count and refresh time.
     if(chosen)await loadDetail(chosen.collection_id);
   }catch(error){
     if(seq===state.loadSeq){
       setSummaryLoading(false); // Preserve last successful values if this refresh failed.
       if(!state.loaded)list.innerHTML='<p class="cs-loading">Unable to load collections. Use Refresh to try again.</p>';
       announce(error.message,true,false,error.reauthorize===true);
     }
   }
   finally{if(seq===state.loadSeq)refreshButton.disabled=state.busy||state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive();}
 }
 function syncDescriptionEditor(){
   const editor=list.querySelector(".cs-entry.cs-open [data-cs-description-editor]");
   root.classList.toggle("cs-local-editing",localEditorActive());
   if(!editor)return;
   const active=localEditorActive(),writing=active&&state.descriptionEditing;
   editor.classList.toggle("cs-description-writing",writing);
   const read=editor.querySelector(".cs-description-read"),write=editor.querySelector(".cs-description-write");
   const display=editor.querySelector("[data-cs-description-read]");
   const pencil=editor.querySelector("[data-cs-description-start]");
   const textarea=editor.querySelector("[data-cs-description-input]");
   read.hidden=writing;write.hidden=!writing;pencil.hidden=!active||writing;
   if(!writing){
     const value=state.descriptionDraft??state.detail?.description??activeCollection()?.description??"";
     display.textContent=value||"No description provided.";
     textarea.value=value;
   }
 }
 function beginDescriptionEdit(){
   if(!localEditorActive()||state.busy||state.descriptionEditing)return;
   state.descriptionEditing=true;
   syncDescriptionEditor();
   const editor=list.querySelector(".cs-entry.cs-open [data-cs-description-editor]");
   const input=editor?.querySelector("[data-cs-description-input]");
   if(!input)return;
   const underline=editor.querySelector(".cs-description-underline");
   void underline.offsetWidth;
   editor.classList.add("cs-description-underline-extended");
   input.focus({preventScroll:true});
   input.setSelectionRange(input.value.length,input.value.length);
 }
 function confirmDescriptionEdit(){
   if(!localEditorActive()||!state.descriptionEditing)return true;
   const editor=list.querySelector(".cs-entry.cs-open [data-cs-description-editor]");
   const input=editor?.querySelector("[data-cs-description-input]");
   if(!input)return false;
   const value=input.value.trim();
   if(value.length>2000){announce("Description must be 2,000 characters or fewer.",true,true);input.focus();return false;}
   state.descriptionDraft=value===state.detail?.description?null:value;
   state.descriptionEditing=false;
   editor.classList.remove("cs-description-underline-extended");
   syncDescriptionEditor();
   return true;
 }
 function cancelDescriptionEdit(){
   if(!localEditorActive()||!state.descriptionEditing)return;
   state.descriptionEditing=false;
   list.querySelector(".cs-entry.cs-open [data-cs-description-editor]")?.classList.remove("cs-description-underline-extended");
   syncDescriptionEditor();
 }
 function exitLocalEditor(){
   state.localEditingId=null;state.descriptionDraft=null;state.descriptionEditing=false;
   state.memberDrafts.clear();
   syncDescriptionEditor();syncActions();renderCard();syncEditControl();
 }
 function enterLocalEditor(){
   if(state.busy||!state.activeId||!state.detail||state.selecting||state.editing||
      state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning)return;
   state.localEditingId=state.activeId;state.descriptionDraft=null;state.descriptionEditing=false;
   state.memberDrafts.clear();
   syncDescriptionEditor();syncActions();renderCard();syncEditControl();
 }
 async function finishLocalEditor(){
   if(!localEditorActive()||state.busy||!state.detail)return;
   if(!confirmDescriptionEdit())return;
   const col=activeCollection(),id=state.activeId;
   if(!col)return;
   const description=state.descriptionDraft;
   if(description===null&&!state.memberDrafts.size){exitLocalEditor();return;}
   setBusy(true);
   try{
     let revision=state.detail.revision;
     if(!Number.isSafeInteger(revision))throw Error("Collection revision unavailable. Refresh before editing.");
     if(description!==null){
       const updated=await request("edit",{original_name:col.name,desc:description,expected_revision:revision});
       if(!Number.isSafeInteger(updated.revision))throw Error("Colosseum did not confirm the description revision.");
       revision=updated.revision;col.revision=revision;col.description=description;
       state.detail.revision=revision;state.detail.description=description;state.descriptionDraft=null;
     }
     // Only direct members of this collection may be annotated; every request
     // uses the immediately preceding revision to prevent lost updates.
     for(const [key,annotation] of state.memberDrafts){
       const [collectionId,uid]=key.split(":");
       if(collectionId!==id||!state.detail.item_uids?.includes(uid)||!isUid(uid)||
          !validRating(annotation.rating)||typeof annotation.context!=="string"||typeof annotation.hidden!=="boolean"||
          [...annotation.context].length>250)
         throw Error("A utility annotation is invalid or no longer belongs to this collection.");
       const updated=await request("annotate",{
         name:col.name,item_uid:uid,rating:annotation.rating,context:annotation.context,hidden:annotation.hidden,
         expected_revision:revision
       });
       if(!Number.isSafeInteger(updated.revision))throw Error("Colosseum did not confirm the membership revision.");
       revision=updated.revision;col.revision=revision;
       state.detail.revision=revision;
       state.detail.item_metadata={...(state.detail.item_metadata||{}),[uid]:annotation};
       state.memberDrafts.delete(key);
     }
     exitLocalEditor();
     await loadList({focusId:id});
     announce("Collection description, utility annotations and membership visibility saved.",false,true);
   }catch(error){
     announce(error.message,true,true,error.reauthorize===true);
     // Committed operations were consumed from the draft so retrying cannot
     // overwrite them; pending annotations remain editable after an error.
   }finally{
     setBusy(false);syncActions();syncEditControl();
   }
 }
 function openRowContext(uid){
   if(!localEditorActive()||state.busy||!state.detail?.item_uids?.includes(uid))return;
   rowContextUid=uid;
   const member=state.detail.items?.find(item=>item.uid===uid);
   $("cs-context-title").textContent="Utility context";
   $("cs-context-copy").textContent="Optional context for "+(member?.name||uid)+" in "+(activeCollection()?.name||"this collection")+". Limited to 250 characters.";
   $("cs-row-context").value=memberAnnotation(uid).context;
   $("cs-row-context-error").textContent="";
   contextDialog.showModal();
   $("cs-row-context").focus();
 }
 function saveRowContext(clear=false){
   if(!rowContextUid||!localEditorActive())return;
   const context=clear?"":$("cs-row-context").value;
   if([...context].length>250){$("cs-row-context-error").textContent="Context must be 250 characters or fewer.";return;}
   const uid=rowContextUid;
   rowContextUid=null;contextDialog.close();
   stageMemberAnnotation(uid,{context});
 }
 function openForm(){
   if(state.busy||localEditorActive())return;
   $("cs-form-title").textContent="New collection";
   $("cs-form-copy").textContent="Create an empty collection in Colosseum. Utilities can be added later.";
   $("cs-name").value="";
   $("cs-description").value="";
   $("cs-form-error").textContent="";
   $("cs-form-save").disabled=false;
   editDialog.showModal();
 }
 function editClose(){if(!state.busy&&editDialog.open)editDialog.close();}
 function deleteClose(){if(!state.busy&&deleteDialog.open)deleteDialog.close();}
 function beginDelete(){
   if(!localEditorActive()||!state.detail||!activeCollection()||state.busy)return;
   $("cs-delete-name").textContent=state.detail.name;
   $("cs-delete-copy").textContent="This permanently deletes the collection and removes its memberships. The underlying utilities are preserved. Type the collection name to confirm.";
   $("cs-delete-confirm-name").value="";
   $("cs-delete-apply").disabled=true;
   $("cs-delete-error").textContent="";
   if(editDialog.open)editDialog.close();
   deleteDialog.showModal();
 }
 async function saveForm(event){
   event.preventDefault();if(state.busy)return;
   const name=$("cs-name").value.trim(),description=$("cs-description").value.trim();
   if(!name||name.length>100||description.length>2000){
     $("cs-form-error").textContent="Enter a collection name (up to 100 characters) and description (up to 2,000 characters).";return;
   }
   const previous=activeCollection();
   setBusy(true);$("cs-form-save").disabled=true;$("cs-form-error").textContent="";
   try{
     await request("create",{name,description});
     state.collectionQuery="";collectionSearch.value="";
     editDialog.close();
     await loadList({focusName:name});
   }catch(error){$("cs-form-error").textContent=error.message;announce(error.message,true);}
   finally{setBusy(false);$("cs-form-save").disabled=false;}
 }
 async function deleteCollection(){
   if(state.busy||!state.detail||!activeCollection()||
      $("cs-delete-confirm-name").value!==state.detail.name)return;
   const col=activeCollection(),revision=state.detail.revision;
   setBusy(true);$("cs-delete-apply").disabled=true;
   try{
     await request("destroy",{name:col.name,expected_revision:revision});
     deleteDialog.close();
     state.localEditingId=null;state.descriptionDraft=null;state.descriptionEditing=false;state.memberDrafts.clear();
     state.activeId=null;state.detail=null;await loadList();
     announce('Collection "'+col.name+'" deleted. Its utilities remain in the catalog.',false,true);
   }catch(error){$("cs-delete-error").textContent=error.message;announce(error.message,true);}
   finally{setBusy(false);}
 }
 let pendingEvict=null;
 const evictDialog=$("cs-evict-dialog");
 function openEvictDialog(){
   if(state.busy||!state.selecting||!state.detail||!state.selected.size||evictDialog.open)return;
   const col=activeCollection();
   if(!col||!Number.isSafeInteger(state.detail.revision))return;
   // Only selected direct members may enter the confirmation manifest.
   const uids=state.detail.item_uids.filter(uid=>state.selected.has(uid)&&isUid(uid));
   if(!uids.length)return;
   const names=new Map((Array.isArray(state.detail.items)?state.detail.items:[]).filter(item=>item&&isUid(item.uid)).map(item=>[item.uid,item.name||item.uid]));
   const list=$("cs-evict-items");
   list.replaceChildren(...uids.map(uid=>{
     const item=document.createElement("li");
     item.textContent=names.get(uid)||uid;
     return item;
   }));
   $("cs-evict-collection").textContent=col.name;
   $("cs-evict-count").textContent=uids.length===1?"this utility":"these "+uids.length+" utilities";
   $("cs-evict-error").textContent="";
   $("cs-evict-apply").disabled=false;
   pendingEvict={collectionId:col.collection_id,name:col.name,revision:state.detail.revision,uids};
   evictDialog.showModal();
 }
 async function evictSelected(){
   const pending=pendingEvict,col=activeCollection();
   if(!pending||!evictDialog.open||state.busy||!state.selecting||!state.detail||
      !col||col.collection_id!==pending.collectionId||
      col.name!==pending.name||state.detail.revision!==pending.revision||
      pending.uids.some(uid=>!state.selected.has(uid)||!state.detail.item_uids.includes(uid))){
     if(evictDialog.open)$("cs-evict-error").textContent="The selection changed. Cancel and choose the utilities again.";
     return;
   }
   setBusy(true);$("cs-evict-apply").disabled=true;$("cs-evict-error").textContent="";
   try{
     await request("evict",{name:pending.name,item_uids:pending.uids,expected_revision:pending.revision});
     evictDialog.close();pendingEvict=null;
     // Keep the selected rows mounted for the reverse 480ms transition.
     state.selecting=false;state.selected.clear();syncUtilityChrome();syncActions();
     const visible=[...root.querySelectorAll(".cs-utility-pick")].find(item=>item.getClientRects().length);
     await waitForVisualMotion(visible,"width");
     await loadList({focusId:pending.collectionId});
     announce(pending.uids.length+" "+(pending.uids.length===1?"utility removed":"utilities removed")+
       " from "+pending.name+". Catalog items preserved.",false,true);
   }catch(error){
     $("cs-evict-error").textContent=error.message;
     announce(error.message,true);
   }finally{setBusy(false);syncActions();syncUtilityChrome();}
 }

 function sizeInlineName(field){
   const input=field?.querySelector(".cs-inline-name");
   const measure=field?.querySelector(".cs-name-measure");
   if(!input||!measure)return;
   measure.textContent=input.value||" ";
   // Only measure when typing; keep circle actions clear of the eye icon.
   const reserved=field.classList.contains("cs-renaming")
     ?(field.classList.contains("cs-name-changed")?60:32):26;
   field.style.setProperty("--cs-inline-name-width",
     collectionInlineNameWidth(measure.getBoundingClientRect().width,
       field.clientWidth-(reserved-26))+"px");
 }
 function syncInlineRenameActions(field){
   if(!field||!state.renamingId)return;
   const input=field.querySelector(".cs-inline-name");
   const confirm=field.querySelector(".cs-name-confirm");
   if(!input||!confirm)return;
   const changed=collectionInlineNameChanged(state.renameInitialValue,input.value);
   field.classList.toggle("cs-name-changed",changed);
   confirm.hidden=!changed;
   sizeInlineName(field);
 }
 function finishInlineRename(restore=false){
   const id=state.renamingId;
   if(!id)return;
   // Clear authority before disabling the input, which can trigger focusout.
   state.renamingId=null;
   state.renameEpoch++;
   const field=list.querySelector('[data-cs-name-field="'+id+'"]');
   const input=field?.querySelector(".cs-inline-name");
   const actions=field?.querySelector(".cs-name-actions");
   if(input){
     if(restore)input.value=state.renameInitialValue;
     state.nameDrafts.set(id,input.value);
     input.disabled=true;input.tabIndex=-1;
     input.setAttribute("aria-hidden","true");
   }
   if(actions){
     actions.hidden=true;
     actions.querySelectorAll("button").forEach(button=>{button.disabled=true;button.tabIndex=-1;});
   }
   field?.classList.remove("cs-renaming","cs-caret-pending","cs-underline-extended","cs-name-changed");
   if(input)sizeInlineName(field);
   state.renameInitialValue="";
 }
 function beginInlineRename(button){
   if(!state.editing||state.editTransitioning||state.busy)return;
   const id=button.dataset.csStartRename;
   const field=button.closest(".cs-name-field");
   const input=field?.querySelector(".cs-inline-name");
   const underline=field?.querySelector(".cs-name-underline");
   const actions=field?.querySelector(".cs-name-actions");
   if(!id||!input||!underline||!actions)return;
   finishInlineRename();
   state.renamingId=id;
   const renameEpoch=++state.renameEpoch;
   state.renameInitialValue=input.value;
   actions.hidden=false;
   actions.querySelectorAll("button").forEach(action=>{action.disabled=false;action.tabIndex=0;});
   input.disabled=false;input.tabIndex=0;
   input.removeAttribute("aria-hidden");
   field.classList.add("cs-renaming","cs-caret-pending");
   syncInlineRenameActions(field);
   // Establish the collapsed line before animating; a one-time style read,
   // not a frame loop, gives a deterministic left-to-right start.
   void underline.offsetWidth;
   const revealCaret=()=>{
     if(state.renamingId===id&&state.renameEpoch===renameEpoch&&field.isConnected)
       field.classList.remove("cs-caret-pending");
   };
   if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
     field.classList.add("cs-underline-extended");
     revealCaret();
   }else{
     underline.addEventListener("transitionend",event=>{
       if(event.target===underline&&event.propertyName==="transform")revealCaret();
     },{once:true});
     field.classList.add("cs-underline-extended");
   }
   input.focus({preventScroll:true});
   input.setSelectionRange(input.value.length,input.value.length);
 }
 function syncRowEditing(){
   const locked=state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning;
   list.querySelectorAll(".cs-entry").forEach(entry=>{
     const trigger=entry.querySelector(".cs-trigger");
     if(trigger){trigger.disabled=locked;trigger.tabIndex=locked?-1:0;}
     const field=entry.querySelector(".cs-name-field");
     const editable=entry.querySelector(".cs-inline-name");
     const pencil=entry.querySelector(".cs-name-pencil");
     const drag=entry.querySelector(".cs-drag-handle");
     const visibility=entry.querySelector(".cs-visibility-toggle");
     const canEdit=state.editing&&!state.editTransitioning;
     for(const control of [pencil,drag,visibility]){
       if(!control)continue;
       control.disabled=!canEdit;
       control.tabIndex=control.disabled?-1:0;
       if(control.disabled)control.setAttribute("aria-hidden","true");
       else control.removeAttribute("aria-hidden");
     }
     if(editable){
       editable.disabled=!canEdit||state.renamingId!==entry.dataset.csId;
       editable.tabIndex=editable.disabled?-1:0;
       if(editable.disabled)editable.setAttribute("aria-hidden","true");
       else editable.removeAttribute("aria-hidden");
     }
     if(field&&state.editing)sizeInlineName(field);
     if(drag)drag.draggable=canEdit;
     const pick=entry.querySelector(".cs-collection-pick");
     if(pick){
       pick.disabled=!state.collectionSelecting||state.collectionSelectTransitioning;
       pick.tabIndex=pick.disabled?-1:0;
       if(pick.disabled)pick.setAttribute("aria-hidden","true");
       else pick.removeAttribute("aria-hidden");
     }
   });
 }
 function syncEditControl(){
   root.classList.toggle("cs-editing",state.editing);
   root.classList.toggle("cs-collection-selecting",state.collectionSelecting);
   editButton.setAttribute("aria-label",state.editing?"Done editing collections":"Edit collections");
   editButton.setAttribute("aria-pressed",String(state.editing));
   editButton.setAttribute("aria-busy",String(root.classList.contains("cs-closing-for-edit")));
   editButton.disabled=state.busy||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive();
   $("cs-edit-tooltip-label").textContent=state.editing?"Done editing":"Edit collections";
   selectButton.setAttribute("aria-label",state.collectionSelecting?"Done selecting collections":"Select collections");
   selectButton.setAttribute("aria-pressed",String(state.collectionSelecting));
   selectButton.setAttribute("aria-busy",String(root.classList.contains("cs-closing-for-selection")));
   selectButton.disabled=state.busy||state.editing||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive();
   $("cs-select-tooltip-label").textContent=state.collectionSelecting?"Done selecting":"Select collections";
   refreshButton.disabled=state.busy||state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive();
   createButton.disabled=state.busy||state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive();
   collectionSearch.disabled=state.busy||state.editing||state.editTransitioning||
     state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive();
   collectionSearchFocus.disabled=collectionSearch.disabled;
   syncRowEditing();
 }
 async function waitForVisualMotion(element,property){
   if(!element||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
   // Force the updated style to resolve once; await native CSS animation
   // completion rather than using observers or frame-based polling.
   void getComputedStyle(element).opacity;
   const active=element.getAnimations().filter(animation=>
     animation.transitionProperty===property||animation.animationName===property);
   if(active.length)await Promise.allSettled(active.map(animation=>animation.finished));
   else if(property==="grid-template-rows"){
     // An expand+edit in the same paint turn has no CSS transition to await.
     // Keep the loader for the established 450ms close window in that case.
     await new Promise(resolve=>setTimeout(resolve,450));
   }
 }
 async function enterEditMode(){
   if(state.busy||!state.loaded||state.editing||state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning)return;
   state.editTransitioning=true;
   const panel=list.querySelector(".cs-entry.cs-open .cs-accordion-panel");
   if(panel){
     // Show the white hollow loader in place of the pencil for exactly
     // the existing 450ms accordion collapse, never before or after it.
     root.classList.add("cs-closing-for-edit");
     syncEditControl();
     state.activeId=null;state.detail=null;state.selecting=false;state.selected.clear();
     ++state.detailSeq;
     syncAccordion();renderCard();
     await waitForVisualMotion(panel,"grid-template-rows");
     root.classList.remove("cs-closing-for-edit");
   }
   if(!routeActive()){
     state.editTransitioning=false;resetEditMode();return;
   }
   state.editing=true;state.renamingId=null;state.nameDrafts.clear();state.configDirty=false;
   if(state.collectionQuery){
     state.collectionQuery="";collectionSearch.value="";state.page=1;
     renderRows();
   }
   root.classList.add("cs-entering-edit");
   syncEditControl();
   await waitForVisualMotion(list.querySelector(".cs-drag-handle"),"cs-grip-enter-right");
   root.classList.remove("cs-entering-edit");
   state.editTransitioning=false;syncEditControl();
 }
 async function exitEditMode(refresh=false){
   if(!state.editing)return;
   finishInlineRename();
   state.editTransitioning=true;
   state.editing=false;
   root.classList.add("cs-leaving-edit");
   syncEditControl();
   await waitForVisualMotion(list.querySelector(".cs-drag-handle"),"cs-grip-exit-left");
   root.classList.remove("cs-leaving-edit");
   state.editTransitioning=false;
   state.nameDrafts.clear();state.configDirty=false;
   syncEditControl();
   if(!refresh){renderRows();renderCard();}
 }
 function resetEditMode(){
   finishInlineRename();
   state.editing=false;state.editTransitioning=false;
   state.nameDrafts.clear();state.configDirty=false;
   root.classList.remove("cs-entering-edit","cs-leaving-edit","cs-closing-for-edit");
   syncEditControl();renderRows();renderCard();
 }
 /* Collection selection is transient, client-side only. It does not write to
    Colosseum, alter configuration, or expose any batch action. */
 function clearCollectionPicks(){
   state.selectedCollections.clear();
   // The row DOM stays mounted across the exit animation. Reset its visual
   // bubbles after the fade so a new selection session starts truly empty.
   list.querySelectorAll('.cs-collection-pick[aria-pressed="true"]').forEach(button=>{
     button.setAttribute("aria-pressed","false");
     const col=state.collections.find(item=>item.collection_id===button.dataset.csPick);
     if(col)button.setAttribute("aria-label","Select "+col.name);
   });
 }
 function toggleCollectionPick(button){
   if(!state.collectionSelecting||state.collectionSelectTransitioning||state.busy)return;
   const id=button.dataset.csPick;
   if(!state.collections.some(collection=>collection.collection_id===id))return;
   const wasPicked=state.selectedCollections.has(id);
   if(wasPicked)state.selectedCollections.delete(id);
   else state.selectedCollections.add(id);
   button.setAttribute("aria-pressed",String(!wasPicked));
   const collection=state.collections.find(item=>item.collection_id===id);
   button.setAttribute("aria-label",(wasPicked?"Select ":"Deselect ")+collection.name);
 }
 async function enterCollectionSelectMode(){
   if(state.busy||!state.loaded||state.editing||state.editTransitioning||
      state.collectionSelecting||state.collectionSelectTransitioning)return;
   state.collectionSelectTransitioning=true;
   const panel=list.querySelector(".cs-entry.cs-open .cs-accordion-panel");
   if(panel){
     root.classList.add("cs-closing-for-selection");
     syncEditControl();
     state.activeId=null;state.detail=null;state.selecting=false;state.selected.clear();
     ++state.detailSeq;
     syncAccordion();renderCard();
     await waitForVisualMotion(panel,"grid-template-rows");
     root.classList.remove("cs-closing-for-selection");
   }
   if(!routeActive()){
     resetCollectionSelectMode();return;
   }
   state.collectionSelecting=true;
   state.selectedCollections.clear();
   if(state.collectionQuery){
     state.collectionQuery="";collectionSearch.value="";state.page=1;
     renderRows();
   }
   root.classList.add("cs-entering-selection");
   syncEditControl();
   await waitForVisualMotion(list.querySelector(".cs-collection-pick"),"cs-grip-enter-right");
   root.classList.remove("cs-entering-selection");
   state.collectionSelectTransitioning=false;
   syncEditControl();
 }
 async function exitCollectionSelectMode(){
   if(!state.collectionSelecting||state.collectionSelectTransitioning)return;
   state.collectionSelectTransitioning=true;
   state.collectionSelecting=false;
   root.classList.add("cs-leaving-selection");
   syncEditControl();
   await waitForVisualMotion(list.querySelector(".cs-collection-pick"),"cs-grip-exit-left");
   root.classList.remove("cs-leaving-selection");
   state.collectionSelectTransitioning=false;
   clearCollectionPicks();
   syncEditControl();
 }
 function resetCollectionSelectMode(){
   state.collectionSelecting=false;state.collectionSelectTransitioning=false;
   clearCollectionPicks();
   root.classList.remove("cs-collection-selecting","cs-entering-selection","cs-leaving-selection","cs-closing-for-selection");
   syncEditControl();renderRows();renderCard();
 }
 function toggleCollectionSelectMode(){
   if(state.collectionSelectTransitioning||state.busy||state.editing||state.editTransitioning)return;
   if(state.collectionSelecting){void exitCollectionSelectMode();return;}
   void enterCollectionSelectMode();
 }
 function applyDraftLayout(entries,focusId=null){
   state.configEntries=entries;state.configDirty=true;
   state.collections=orderedCollectionTree(state.collections,entries);
   if(focusId){
     const index=state.collections.findIndex(x=>x.collection_id===focusId);
     if(index>=0)state.page=Math.floor(index/state.pageSize)+1;
   }
   renderRows();renderCard();
 }
 function toggleCollectionVisibility(id){
   const item=state.configEntries[id];if(!state.editing||!item)return;
   const entries=Object.fromEntries(Object.entries(state.configEntries).map(([key,value])=>[key,{...value}]));
   entries[id].hidden=!entries[id].hidden;
   applyDraftLayout(entries,id);
 }
 function moveCollection(sourceId,targetId,position){
   if(!state.editing||state.busy)return false;
   const entries=moveCollectionInConfiguration(state.configEntries,sourceId,targetId,position);
   if(!entries){announce("That collection cannot be moved into itself or its descendants.",true,true);return false;}
   applyDraftLayout(entries,sourceId);
   return true;
 }
 async function finishEditMode(){
   if(!state.editing||state.busy)return;
   finishInlineRename();
   for(const input of list.querySelectorAll(".cs-inline-name")){
     state.nameDrafts.set(input.dataset.csName,input.value);
   }
   const edits=[],seenNames=new Set();
   for(const col of state.collections){
     const proposed=(state.nameDrafts.get(col.collection_id)??col.name).normalize("NFKC").trim().replace(/\s+/gu," ");
     const key=proposed.toLocaleLowerCase("en-US");
     if(!proposed||proposed.length>100||seenNames.has(key)){
       announce("Each collection needs a unique name of no more than 100 characters.",true,true);
       return;
     }
     seenNames.add(key);
     if(proposed!==col.name)edits.push({collection:col,name:proposed});
   }
   if(!edits.length&&!state.configDirty){await exitEditMode();return;}
   setBusy(true);
   try{
     for(const {collection,name} of edits){
       const changed=await request("edit",{
         original_name:collection.name,name,expected_revision:collection.revision
       });
       collection.name=name;
       if(Number.isSafeInteger(changed.revision))collection.revision=changed.revision;
     }
     if(state.configDirty)await request("configure",{
       entries:state.configEntries,expected_configuration_revision:state.configRevision
     });
     await exitEditMode(true);
     await loadList();
     announce("Collection organization saved.",false,true);
   }catch(error){announce(error.message,true,true,error.reauthorize===true);}
   finally{setBusy(false);syncEditControl();}
 }
 function toggleEditMode(){
   if(state.editTransitioning||state.collectionSelecting||state.collectionSelectTransitioning||localEditorActive())return;
   if(state.editing){void finishEditMode();return;}
   void enterEditMode();
 }
 function dragPosition(event,entry){
   if(!event.target.closest(".cs-entry-heading"))return "inside";
   const box=entry.querySelector(".cs-entry-heading").getBoundingClientRect();
   const fraction=(event.clientY-box.top)/Math.max(box.height,1);
   return fraction<.28?"before":fraction>.72?"after":"inside";
 }
 function clearDropHints(){
   list.querySelectorAll(".cs-drop-before,.cs-drop-after,.cs-drop-inside,.cs-dragging").forEach(
     entry=>entry.classList.remove("cs-drop-before","cs-drop-after","cs-drop-inside","cs-dragging"));
 }
 list.addEventListener("input",event=>{
   const input=event.target.closest(".cs-inline-name");
   if(input&&state.editing){
     state.nameDrafts.set(input.dataset.csName,input.value);
     const field=input.closest(".cs-name-field");
     if(state.renamingId===input.dataset.csName)syncInlineRenameActions(field);
     else sizeInlineName(field);
   }
 });
 list.addEventListener("focusout",event=>{
   const input=event.target.closest?.(".cs-inline-name");
   if(!input||state.renamingId!==input.dataset.csName)return;
   if(input.closest(".cs-name-field")?.contains(event.relatedTarget))return;
   finishInlineRename();
 });
 list.addEventListener("keydown",event=>{
   const input=event.target.closest?.(".cs-inline-name");
   if(!input||state.renamingId!==input.dataset.csName)return;
   if(event.key==="Enter"||event.key==="Escape"){
     event.preventDefault();
     const pencil=input.closest(".cs-name-field")?.querySelector(".cs-name-pencil");
     finishInlineRename(event.key==="Escape");
     pencil?.focus({preventScroll:true});
   }
 });
 // Even a click on non-focusable whitespace must dismiss inline renaming.
 document.addEventListener("pointerdown",event=>{
   if(!state.renamingId)return;
   const field=list.querySelector('[data-cs-name-field="'+state.renamingId+'"]');
   if(field&&!field.contains(event.target))finishInlineRename();
 },{capture:true});
 list.addEventListener("dragstart",event=>{
   const handle=event.target.closest("[data-cs-drag]");
   if(!state.editing||!handle||handle.closest(".cs-entry")?.classList.contains("cs-open")){
     event.preventDefault();return;
   }
   state.draggingId=handle.dataset.csDrag;
   event.dataTransfer.effectAllowed="move";
   event.dataTransfer.setData("text/plain",state.draggingId);
   handle.closest(".cs-entry").classList.add("cs-dragging");
 });
 list.addEventListener("dragover",event=>{
   if(!state.editing||!state.draggingId)return;
   const target=event.target.closest(".cs-entry");
   if(!target||target.dataset.csId===state.draggingId)return;
   const zone=dragPosition(event,target);
   if(zone==="inside"&&collectionDescendsFrom(state.configEntries,target.dataset.csId,state.draggingId))return;
   event.preventDefault();event.dataTransfer.dropEffect="move";
   clearDropHints();target.classList.add("cs-drop-"+zone);
 });
 list.addEventListener("drop",event=>{
   if(!state.editing||!state.draggingId)return;
   const target=event.target.closest(".cs-entry");
   event.preventDefault();
   const source=state.draggingId;state.draggingId=null;
   if(!target||target.dataset.csId===source){clearDropHints();return;}
   const zone=dragPosition(event,target),destination=target.dataset.csId;
   clearDropHints();moveCollection(source,destination,zone);
 });
 list.addEventListener("dragend",()=>{state.draggingId=null;clearDropHints();});
 list.addEventListener("keydown",event=>{
   const handle=event.target.closest("[data-cs-drag]");
   if(!handle||!state.editing||!event.altKey||event.metaKey||event.ctrlKey||event.shiftKey)return;
   const id=handle.dataset.csDrag,index=state.collections.findIndex(x=>x.collection_id===id);
   let target=null,zone="after";
   if(event.key==="ArrowUp"&&index>0){target=state.collections[index-1];zone="before";}
   if(event.key==="ArrowDown"&&index<state.collections.length-1){target=state.collections[index+1];zone="after";}
   if(event.key==="ArrowRight"&&index>0){target=state.collections[index-1];zone="inside";}
   if(event.key==="ArrowLeft"&&state.configEntries[id]?.parent_id){
     target=state.collections.find(x=>x.collection_id===state.configEntries[id].parent_id);zone="after";
   }
   if(!target)return;
   event.preventDefault();
   if(moveCollection(id,target.collection_id,zone)){
     list.querySelector('[data-cs-drag="'+id+'"]')?.focus({preventScroll:true});
   }
 });
 function jumpToChild(id){
   if(localEditorActive()){announce("Save or cancel this collection's edits before switching collections.",true,true);return;}
   const index=state.collections.findIndex(x=>x.collection_id===id);
   if(index<0)return;
   state.page=Math.floor(index/state.pageSize)+1;
   renderRows();openCollection(id);
 }
 function handleUtilityAction(action){
   if(!action||state.busy||state.editTransitioning||state.collectionSelectTransitioning)return;
   if(action==="admit")return; // Intentionally dormant.
   if(action==="edit"){
     if(localEditorActive()){void finishLocalEditor();return;}
     enterLocalEditor();return;
   }
   if(action==="delete"){beginDelete();return;}
   if(action==="select"){
     if(state.selecting){
       state.selecting=false;state.selected.clear();syncUtilityChrome();syncActions();
       return;
     }
     if(!state.detail||!state.detail.item_uids?.length||localEditorActive())return;
     state.selecting=true;state.selected.clear();syncUtilityChrome();syncActions();
     return;
   }
   if(action==="remove"){openEvictDialog();return;}
 }

 detail.addEventListener("click",event=>{
   const child=event.target.closest("[data-cs-jump-child]");
   if(child){jumpToChild(child.dataset.csJumpChild);return;}
   const action=event.target.closest(".cs-utility-management button[data-cs-action]");
   if(action&&!action.disabled)handleUtilityAction(action.dataset.csAction);
 });
 // Edit the membership in the currently open collection, never the catalog item.
 // Delegation covers the desktop detail and its mobile accordion counterpart.
 root.addEventListener("click",event=>{
   if(!localEditorActive()||state.busy)return;
   const button=event.target.closest?.("button");
   if(!button)return;
   if(button.hasAttribute("data-cs-member-visibility")){
     const uid=button.dataset.csMemberVisibility;
     if(isUid(uid))stageMemberAnnotation(uid,{hidden:!memberAnnotation(uid).hidden});
     return;
   }
   if(button.hasAttribute("data-cs-member-context")){
     openRowContext(button.dataset.csMemberContext);return;
   }
   if(button.hasAttribute("data-cs-member-rating")){
     const uid=button.dataset.csMemberRating,value=Number(button.dataset.csValue);
     if(!isUid(uid)||!validRating(value))return;
     const inMobile=!!button.closest(".cs-mobile-detail"),half=button.dataset.half;
     stageMemberAnnotation(uid,{rating:nextCollectionRating(memberAnnotation(uid).rating,value)});
     (inMobile?list:detail).querySelector('[data-cs-member-rating="'+uid+'"][data-cs-value="'+value+'"][data-half="'+half+'"]')?.focus({preventScroll:true});
   }
 });
 list.addEventListener("click",event=>{
   const button=event.target.closest("button");
   if(!button||state.busy||state.editTransitioning||state.collectionSelectTransitioning)return;
   if(button.hasAttribute("data-cs-description-start")){beginDescriptionEdit();return;}
   if(button.hasAttribute("data-cs-description-confirm")){confirmDescriptionEdit();return;}
   if(button.hasAttribute("data-cs-description-cancel")){cancelDescriptionEdit();return;}
   if(button.hasAttribute("data-cs-pick")){toggleCollectionPick(button);return;}
   if(button.hasAttribute("data-cs-start-rename")){beginInlineRename(button);return;}
   if(button.hasAttribute("data-cs-confirm-rename")&&state.renamingId===button.dataset.csConfirmRename){
     const pencil=button.closest(".cs-name-field")?.querySelector(".cs-name-pencil");
     finishInlineRename();pencil?.focus({preventScroll:true});return;
   }
   if(button.hasAttribute("data-cs-cancel-rename")&&state.renamingId===button.dataset.csCancelRename){
     const pencil=button.closest(".cs-name-field")?.querySelector(".cs-name-pencil");
     finishInlineRename(true);pencil?.focus({preventScroll:true});return;
   }
   if(button.hasAttribute("data-cs-visibility")){toggleCollectionVisibility(button.dataset.csVisibility);return;}
   if(button.hasAttribute("data-cs-drag"))return;
   if(button.hasAttribute("data-cs-jump-child")){jumpToChild(button.dataset.csJumpChild);return;}
   if(button.hasAttribute("data-cs-open")){openCollection(button.dataset.csOpen);return;}
   handleUtilityAction(button.dataset.csAction);
 });
 root.addEventListener("click",event=>{
   const button=event.target.closest(".cs-utility-pick");
   if(!button||button.disabled||!state.selecting||state.busy||!state.detail)return;
   const uid=button.dataset.csPickUtility;
   if(!isUid(uid)||!state.detail.item_uids?.includes(uid))return;
   if(state.selected.has(uid))state.selected.delete(uid);
   else state.selected.add(uid);
   // Both responsive copies reflect the same transient set in place.
   syncUtilityChrome();
 });
 // Both searches are local projections of already-loaded Colosseum data.
 // Never repaint the utilities card on each keystroke: preserving the input
 // node also preserves focus, caret position and staged item edits.
 collectionSearch.addEventListener("input",()=>{
   if(collectionSearch.disabled)return;
   state.collectionQuery=collectionSearch.value;
   state.page=1;
   if(state.activeId&&!pageItems().some(col=>col.collection_id===state.activeId)){
     state.activeId=null;state.detail=null;state.selecting=false;
     state.selected.clear();state.utilityQuery="";++state.detailSeq;
   }
   renderRows();renderCard();
 });
 collectionSearchFocus.addEventListener("click",()=>{
   if(!collectionSearch.disabled)collectionSearch.focus({preventScroll:true});
 });
 root.addEventListener("input",event=>{
   const input=event.target.closest?.("[data-cs-utility-search]");
   if(!input||!state.detail||!state.activeId)return;
   state.utilityQuery=input.value;
   filterUtilityRows();
 });
 root.addEventListener("click",event=>{
   const button=event.target.closest?.("[data-cs-focus-utility-search]");
   if(button)button.closest(".cs-card")?.querySelector("[data-cs-utility-search]")?.focus({preventScroll:true});
 });
 pagination.addEventListener("click",event=>{
   const button=event.target.closest("[data-cs-page]");
   if(!button||state.busy||state.editTransitioning||state.collectionSelectTransitioning||localEditorActive())return;
   const requested=button.dataset.csPage;
   const page=requested==="prev"?state.page-1:requested==="next"?state.page+1:Number(requested);
   if(!Number.isInteger(page)||page<1||page>pageCount()||page===state.page)return;
   state.page=page;state.activeId=null;state.detail=null;state.selecting=false;state.selected.clear();++state.detailSeq;
   renderRows();renderCard();
 });
 refreshButton.addEventListener("click",()=>{if(!state.busy&&!localEditorActive())void loadList();});
 // Refresh the current Collections inventory on Control-Shift-R. This
 // follows the other route-scoped shortcuts without changing form inputs.
 window.addEventListener("keydown",event=>{
   if(event.defaultPrevented||event.isComposing||event.repeat||
      !event.ctrlKey||!event.shiftKey||event.metaKey||event.altKey)return;
   if(event.code!=="KeyR"&&event.key?.toLowerCase()!=="r")return;
   if(!routeActive()||root.closest(".view")?.hidden||
      refreshButton.disabled||document.querySelector("dialog[open]"))return;
   const target=event.target;
   if(target instanceof Element&&
      target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
   event.preventDefault();
   void loadList();
 },{capture:true});
 // Only collection search has a shortcut. Keep it route-scoped and avoid
 // intercepting browser Find outside this page, active dialogs or other modes.
 window.addEventListener("keydown",event=>{
   if(event.defaultPrevented||event.isComposing||event.repeat||
      !event.metaKey||!event.shiftKey||event.ctrlKey||event.altKey)return;
   if(event.code!=="KeyF"&&event.key?.toLowerCase()!=="f")return;
   if(!routeActive()||root.closest(".view")?.hidden||collectionSearch.disabled||
      document.querySelector("dialog[open]"))return;
   event.preventDefault();
   collectionSearch.focus({preventScroll:true});
   collectionSearch.select();
 },{capture:true});
 createButton.addEventListener("click",()=>{if(!localEditorActive())openForm("create");});
 editButton.addEventListener("click",toggleEditMode);
 selectButton.addEventListener("click",toggleCollectionSelectMode);
 // Match the tooltip's ⇧⌘N hint without interfering with inputs, other
 // workspace routes, open dialogs, or in-flight Colosseum mutations.
 window.addEventListener("keydown",event=>{
   if(event.defaultPrevented||event.isComposing||event.repeat||
      !event.shiftKey||!event.metaKey||event.altKey||event.ctrlKey)return;
   if(event.code!=="KeyN"&&event.key?.toLowerCase()!=="n")return;
   if(!routeActive()||root.closest(".view")?.hidden||state.busy||
      createButton.disabled||document.querySelector("dialog[open]"))return;
   const target=event.target;
   if(target instanceof Element&&
      target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
   event.preventDefault();
   openForm("create");
 },{capture:true});
 // The same route-scoped shortcut policy powers edit mode and its Done state.
 window.addEventListener("keydown",event=>{
   if(event.defaultPrevented||event.isComposing||event.repeat||
      !event.shiftKey||!event.metaKey||event.ctrlKey||event.altKey)return;
   if(event.code!=="KeyE"&&event.key?.toLowerCase()!=="e")return;
   if(!routeActive()||root.closest(".view")?.hidden||state.busy||
      editButton.disabled||document.querySelector("dialog[open]"))return;
   const target=event.target;
   if(!state.editing&&target instanceof Element&&
      target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
   event.preventDefault();toggleEditMode();
 },{capture:true});
 list.addEventListener("keydown",event=>{
   if(!event.target.matches?.("[data-cs-description-input]"))return;
   if(event.key==="Escape"){event.preventDefault();cancelDescriptionEdit();}
   if(event.key==="Enter"&&(event.metaKey||event.ctrlKey)){event.preventDefault();confirmDescriptionEdit();}
 });
 $("cs-context-save").addEventListener("click",()=>saveRowContext());
 $("cs-context-clear").addEventListener("click",()=>saveRowContext(true));
 $("cs-context-cancel").addEventListener("click",()=>contextDialog.close());
 contextDialog.addEventListener("close",()=>{rowContextUid=null;});
 $("cs-form").addEventListener("submit",event=>void saveForm(event));
 $("cs-form-cancel").addEventListener("click",editClose);
 $("cs-delete-cancel").addEventListener("click",deleteClose);
 $("cs-delete-confirm-name").addEventListener("input",()=>{
   $("cs-delete-apply").disabled=$("cs-delete-confirm-name").value!==state.detail?.name||state.busy;
 });
 $("cs-delete-apply").addEventListener("click",()=>void deleteCollection());
 $("cs-evict-cancel").addEventListener("click",()=>{if(!state.busy)evictDialog.close();});
 $("cs-evict-apply").addEventListener("click",()=>void evictSelected());
 evictDialog.addEventListener("close",()=>{pendingEvict=null;});
 evictDialog.addEventListener("cancel",event=>{if(state.busy)event.preventDefault();});
 editDialog.addEventListener("cancel",event=>{if(state.busy)event.preventDefault();});
 deleteDialog.addEventListener("cancel",event=>{if(state.busy)event.preventDefault();});
 window.addEventListener("hashchange",()=>{
   if(routeActive()){if(!localEditorActive())void loadList();return;}
   if(state.localEditingId)exitLocalEditor();
   if(state.selecting){state.selecting=false;state.selected.clear();syncUtilityChrome();}
   if(evictDialog.open&&!state.busy)evictDialog.close();
   if(state.editing||state.editTransitioning)resetEditMode();
   if(state.collectionSelecting||state.collectionSelectTransitioning)resetCollectionSelectMode();
 });
 if(routeActive())void loadList();
 else announce("Open Collections to retrieve the live Colosseum collection inventory.");
}
