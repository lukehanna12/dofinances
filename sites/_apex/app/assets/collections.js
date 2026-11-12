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
  ported:{src:"/app/assets/external-provider.v1.svg",label:"External provider"}
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
const CHEVRON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const LEFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const RIGHT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const GRIP='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
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
   page:1,pageSize:10,selecting:false,selected:new Set(),
   busy:false,loadSeq:0,detailSeq:0,
   editing:false,configRevision:0,configEntries:{},configDirty:false,
   nameDrafts:new Map(),draggingId:null
 };
 const list=$("cs-list"),detail=$("cs-detail"),pagination=$("cs-pagination");
 const status=$("cs-status"),summary=$("cs-summary"),summaryValue=summary.querySelector(".cs-summary-value"),createButton=$("cs-create"),refreshButton=$("cs-refresh");
 const editDialog=$("cs-form-dialog"),deleteDialog=$("cs-delete-dialog"),editButton=$("cs-edit");
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
 let formMode="create";
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
 function setSummaryLoading(loading){
   if(loading)ensureInitialGeometry();
   summary.classList.toggle("cs-summary-loading",loading);
   summary.setAttribute("aria-busy",String(loading));
   refreshButton.classList.toggle("cs-refreshing",loading);
   refreshButton.setAttribute("aria-busy",String(loading));
 }
 function setBusy(value){
   state.busy=value;
   refreshButton.disabled=value;
   createButton.disabled=value||state.editing;
   editButton.disabled=value;
   root.querySelectorAll(".cs-actions button").forEach(button=>{
     button.disabled=value||button.dataset.csAction==="admit"||
       (button.dataset.csAction==="remove"&&!state.selected.size)||
       ((button.dataset.csAction==="edit"||button.dataset.csAction==="select")&&!state.detail)||
       (button.dataset.csAction==="select"&&!state.detail?.item_uids?.length);
   });
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
 const pageCount=()=>Math.max(1,Math.ceil(state.collections.length/state.pageSize));
 const pageItems=()=>state.collections.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
 const routeActive=()=>{
   const hash=location.hash.replace(/^#/,"").replace(/\/$/,"").toLowerCase();
   return hash?hash==="colosseum/collections":
     location.pathname.replace(/\/+$/,"").toLowerCase()==="/app/colosseum/collections";
 };
 function actionMarkup(){
   const enabled=!state.busy;
   if(state.selecting){
     return '<button class="cs-button cs-danger" type="button" data-cs-action="remove"'+(!enabled||!state.selected.size?' disabled':'')+
       '>Remove'+(state.selected.size?' ('+state.selected.size+')':'')+'</button>'+
       '<button class="cs-button" type="button" data-cs-action="cancel"'+(!enabled?' disabled':'')+'>Cancel</button>';
   }
   return '<button class="cs-button cs-add" type="button" data-cs-action="admit" disabled title="Utility admission will be configured later" aria-label="Add utilities (coming later)">+</button>'+
     '<button class="cs-button" type="button" data-cs-action="edit"'+(!enabled||!state.detail?' disabled':'')+'>Edit</button>'+
     '<button class="cs-button" type="button" data-cs-action="select"'+(!enabled||!state.detail||!state.detail.item_uids?.length?' disabled':'')+'>Select</button>';
 }
 function rowMarkup(collection,index){
   const n=(state.page-1)*state.pageSize+index+1;
   const id="cs-panel-"+n;
   const uuid=esc(collection.collection_id);
   const entry=state.configEntries[collection.collection_id]||{hidden:false};
   const depth=Math.min(8,Math.max(0,collection.collection_depth||0));
   const draft=state.nameDrafts.get(collection.collection_id)??collection.name;
   const editing=state.editing;
   return '<article class="cs-entry'+(entry.hidden?' cs-is-hidden':'')+'" data-cs-id="'+uuid+'" data-cs-depth="'+depth+'" style="--cs-depth:'+depth+'">'+
     '<h2 class="cs-entry-heading">'+
       (editing?'<button class="cs-drag-handle" type="button" draggable="true" data-cs-drag="'+uuid+'" aria-label="Drag '+esc(collection.name)+' to reorder or nest" title="Drag to reorder or move into a collection">'+GRIP+'</button>':'')+
       '<button class="cs-trigger" type="button" data-cs-open="'+uuid+'" id="cs-trigger-'+n+'" aria-controls="'+id+'" aria-expanded="false">'+
       '<span class="cs-num">'+String(n).padStart(2,"0")+'</span>'+
       '<span class="cs-entry-title"><span class="cs-title-measure" aria-hidden="true">'+esc(collection.name)+'</span>'+
         '<span class="cs-title-compact" aria-hidden="true">'+esc(collection.name)+'</span>'+
         '<span class="cs-title-expanded">'+esc(collection.name)+'</span></span>'+
       '<span class="cs-chevron">'+CHEVRON+'</span></button>'+
       (editing?'<input class="cs-inline-name" type="text" data-cs-name="'+uuid+'" value="'+esc(draft)+'" aria-label="Rename '+esc(collection.name)+'" maxlength="100" autocomplete="off" spellcheck="false">':'')+
       (editing?'<button class="cs-visibility-toggle" type="button" data-cs-visibility="'+uuid+'" aria-label="'+(entry.hidden?'Show ':'Hide ')+esc(collection.name)+' to ChatGPT" aria-pressed="'+String(entry.hidden)+'" title="'+(entry.hidden?'Show to ChatGPT':'Hide from ChatGPT')+'">'+(entry.hidden?EYE_OFF:EYE)+'</button>':'')+
     '</h2>'+
     '<div class="cs-accordion-panel" id="'+id+'" role="region" aria-labelledby="cs-trigger-'+n+'" aria-hidden="true">'+
       '<div class="cs-panel-clip"><div class="cs-panel-inner">'+
         '<p class="cs-description">'+esc(collection.description||"No description provided.")+'</p>'+
         '<div class="cs-actions" data-cs-actions>'+actionMarkup()+'</div>'+
         '<div class="cs-mobile-detail" data-cs-mobile></div>'+
       '</div></div></div></article>';
 }
 function renderPages(){
   const pages=pageCount();state.page=Math.min(Math.max(1,state.page),pages);
   const first=(state.page-1)*state.pageSize+1;
   const total=state.collections.length;
   $("cs-countline").textContent=state.loaded?
     (total?first+'–'+Math.min(first+state.pageSize-1,state.collections.length)+' of '+total:'0 of 0'):"";
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
   if(!state.loaded){list.innerHTML='<p class="cs-loading">Reading collections directly from Colosseum…</p>';renderPages();return;}
   if(!state.collections.length){list.innerHTML='<p class="cs-loading">No collections yet. Use New collection to create one.</p>';renderPages();return;}
   root.classList.toggle("cs-editing",state.editing);
   list.innerHTML=pageItems().map(rowMarkup).join("");
   renderPages();syncAccordion();
 }
 function syncAccordion(){
   list.querySelectorAll(".cs-entry").forEach(el=>{
     const open=el.dataset.csId===state.activeId;
     el.classList.toggle("cs-open",open);
     el.querySelector(".cs-trigger").setAttribute("aria-expanded",String(open));
     el.querySelector(".cs-accordion-panel").setAttribute("aria-hidden",String(!open));
   });
   syncActions();
 }
 function syncActions(){
   const open=list.querySelector(".cs-entry.cs-open [data-cs-actions]");
   if(!open)return;
   const replacement=document.createElement("div");
   replacement.innerHTML=actionMarkup();
   const oldButtons=[...open.querySelectorAll(":scope > button")];
   const newButtons=[...replacement.children];
   // The first membership response only changes Edit/Select disabled states.
   // Retain their actual DOM nodes instead of repainting the description's
   // action strip at the moment the loading card resolves.
   if(oldButtons.length===newButtons.length &&
      oldButtons.every((button,i)=>button.dataset.csAction===newButtons[i].dataset.csAction)){
     oldButtons.forEach((button,i)=>{
       if(button.disabled!==newButtons[i].disabled)button.disabled=newButtons[i].disabled;
       if(button.textContent!==newButtons[i].textContent)button.textContent=newButtons[i].textContent;
     });
   }else open.replaceChildren(...replacement.childNodes);
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
     const routeIcon=Object.hasOwn(COLLECTION_ROUTE_ICONS,routes)?COLLECTION_ROUTE_ICONS[routes]:null;
     const selected=state.selected.has(uid);
     const content=(state.selecting?
       '<input type="checkbox" class="cs-checkbox" data-cs-uid="'+uid+'" aria-label="Select '+esc(item.name||uid)+'"'+(selected?' checked':'')+'>':
       '<span class="cs-dot" aria-hidden="true"></span>')+
       '<span class="cs-utility-info"><span class="cs-utility-name">'+esc(item.name||uid)+'</span>'+
       '<span class="cs-utility-uid">'+uid+'</span></span>'+
       (routeIcon?'<img class="cs-utility-route-icon cs-utility-route-icon--'+routes+'" src="'+routeIcon.src+'" alt="'+routeIcon.label+'">':'');
     return state.selecting?
       '<label class="cs-utility-row">'+content+'</label>':
       '<div class="cs-utility-row">'+content+'</div>';
   }).join("");
   return '<div class="cs-card"><div class="cs-card-heading"><span class="cs-card-label">'+FOLDER+'Utilities</span>'+
     '<span class="cs-card-badge">'+ids.length+' '+(ids.length===1?'utility':'utilities')+'</span></div>'+
     '<div class="cs-utility-list" role="group" aria-label="Utilities in '+esc(col.name)+'">'+
       (names||'<p class="cs-utility-empty">This collection has no utilities yet.</p>')+
     '</div>'+(subcollections.length?'<div class="cs-subcollections"><span class="cs-subcollections-label">Subcollections · '+subcollections.length+'</span>'+subcollections.map(child=>
       '<button type="button" class="cs-subcollection-link" data-cs-jump-child="'+esc(child.collection_id)+'">'+esc(child.name)+'</button>').join("")+'</div>':'')+
     '<div class="cs-summary"><span class="cs-dot" aria-hidden="true"></span>'+
     '<span>Revision '+esc(current.revision)+' · '+ids.length+' '+(ids.length===1?'utility':'utilities')+' in '+esc(col.name)+'</span></div></div>';
 }
 function renderCard(){
   const selected=!!state.activeId;
   detail.classList.toggle("cs-empty",!selected);
   detail.setAttribute("aria-hidden",String(!selected));
   const markup=selected?cardMarkup():"";
   if(detail.innerHTML!==markup)detail.innerHTML=markup;
   const mobile=list.querySelector(".cs-entry.cs-open [data-cs-mobile]");
   if(mobile){
     if(mobile.innerHTML!==markup)mobile.innerHTML=markup;
     // The mobile card belongs to the animating accordion's intrinsic height.
     // Let its loading→populated size grow continuously, rather than changing
     // the 0fr→1fr accordion track's target height in a single frame.
     mobile.classList.toggle("cs-members-ready",selected&&!!state.detail);
   }
 }
 function openCollection(id){
   const next=state.activeId===id?null:id;
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
     state.activeId=chosen?.collection_id||null;
     state.selecting=false;state.selected.clear();state.detail=null;++state.detailSeq;
     if(chosen)state.page=Math.floor(state.collections.findIndex(x=>x.collection_id===chosen.collection_id)/state.pageSize)+1;
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
       announce(error.message,true,false,error.reauthorize===true);
     }
   }
   finally{if(seq===state.loadSeq)refreshButton.disabled=state.busy;}
 }
 function openForm(mode){
   if(state.busy)return;
   if(mode==="edit"&&(!activeCollection()||!state.detail||state.selecting))return;
   formMode=mode;
   $("cs-form-title").textContent=mode==="create"?"New collection":"Edit collection";
   $("cs-form-copy").textContent=mode==="create"?
     "Create an empty collection in Colosseum. Utilities can be added later.":
     "Update this collection's name and description. Existing utilities are preserved.";
   $("cs-name").value=mode==="edit"?state.detail.name:"";
   $("cs-description").value=mode==="edit"?state.detail.description:"";
   $("cs-form-error").textContent="";
   $("cs-form-save").disabled=false;
   $("cs-delete-open").hidden=mode!=="edit";
   editDialog.showModal();
 }
 function editClose(){if(!state.busy&&editDialog.open)editDialog.close();}
 function deleteClose(){if(!state.busy&&deleteDialog.open)deleteDialog.close();}
 function beginDelete(){
   if(formMode!=="edit"||!state.detail||!activeCollection())return;
   $("cs-delete-name").textContent=state.detail.name;
   $("cs-delete-copy").textContent="This permanently deletes the collection and removes its memberships. The underlying utilities are preserved. Type the collection name to confirm.";
   $("cs-delete-confirm-name").value="";
   $("cs-delete-apply").disabled=true;
   $("cs-delete-error").textContent="";
   editDialog.close();
   deleteDialog.showModal();
 }
 async function saveForm(event){
   event.preventDefault();if(state.busy)return;
   const name=$("cs-name").value.trim(),description=$("cs-description").value.trim();
   if(!name||name.length>100||description.length>2000){
     $("cs-form-error").textContent="Enter a collection name (up to 100 characters) and description (up to 2,000 characters).";return;
   }
   const previous=activeCollection(),revision=state.detail?.revision;
   if(formMode==="edit"&&(!previous||!Number.isSafeInteger(revision)))return;
   setBusy(true);$("cs-form-save").disabled=true;$("cs-form-error").textContent="";
   try{
     if(formMode==="create")await request("create",{name,description});
     else await request("edit",{original_name:previous.name,name,desc:description,expected_revision:revision});
     editDialog.close();
     await loadList({focusName:name,focusId:formMode==="edit"?previous.collection_id:null});
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
     state.activeId=null;state.detail=null;await loadList();
     announce('Collection "'+col.name+'" deleted. Its utilities remain in the catalog.',false,true);
   }catch(error){$("cs-delete-error").textContent=error.message;announce(error.message,true);}
   finally{setBusy(false);}
 }
 async function evictSelected(){
   if(state.busy||!state.selecting||!state.detail||!state.selected.size)return;
   const col=activeCollection(),uids=[...state.selected],revision=state.detail.revision;
   if(!col)return;
   if(!confirm("Remove "+uids.length+" "+(uids.length===1?"utility":"utilities")+
     " from "+col.name+"? This does not delete the underlying catalog items."))return;
   setBusy(true);
   try{
     await request("evict",{name:col.name,item_uids:uids,expected_revision:revision});
     state.selecting=false;state.selected.clear();
     await loadList({focusId:col.collection_id});
     announce(uids.length+" "+(uids.length===1?"utility evicted":"utilities evicted")+" from "+col.name+". Catalog items preserved.",false,true);
   }catch(error){
     announce(error.message,true);
     if(/changed|conflict/i.test(error.message))void loadList({focusId:col.collection_id});
   }finally{setBusy(false);syncActions();renderCard();}
 }
 function syncEditControl(){
   root.classList.toggle("cs-editing",state.editing);
   editButton.setAttribute("aria-label",state.editing?"Done editing collections":"Edit collections");
   editButton.setAttribute("aria-pressed",String(state.editing));
   $("cs-edit-tooltip-label").textContent=state.editing?"Done editing":"Edit collections";
   refreshButton.disabled=state.busy||state.editing;
   createButton.disabled=state.busy||state.editing;
 }
 function enterEditMode(){
   if(state.busy||!state.loaded)return;
   state.editing=true;state.nameDrafts.clear();state.configDirty=false;
   syncEditControl();renderRows();renderCard();
 }
 function resetEditMode(){
   state.editing=false;state.nameDrafts.clear();state.configDirty=false;
   syncEditControl();renderRows();renderCard();
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
   if(!edits.length&&!state.configDirty){resetEditMode();return;}
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
     state.editing=false;state.nameDrafts.clear();state.configDirty=false;
     syncEditControl();
     await loadList();
     announce("Collection organization saved.",false,true);
   }catch(error){announce(error.message,true,true,error.reauthorize===true);}
   finally{setBusy(false);syncEditControl();}
 }
 function toggleEditMode(){
   if(state.editing){void finishEditMode();return;}
   enterEditMode();
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
   if(input&&state.editing)state.nameDrafts.set(input.dataset.csName,input.value);
 });
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
   const index=state.collections.findIndex(x=>x.collection_id===id);
   if(index<0)return;
   state.page=Math.floor(index/state.pageSize)+1;
   renderRows();openCollection(id);
 }
 detail.addEventListener("click",event=>{
   const button=event.target.closest("[data-cs-jump-child]");
   if(button)jumpToChild(button.dataset.csJumpChild);
 });
 list.addEventListener("click",event=>{
   const button=event.target.closest("button");
   if(!button||state.busy)return;
   if(button.hasAttribute("data-cs-visibility")){toggleCollectionVisibility(button.dataset.csVisibility);return;}
   if(button.hasAttribute("data-cs-drag"))return;
   if(button.hasAttribute("data-cs-jump-child")){jumpToChild(button.dataset.csJumpChild);return;}
   if(button.hasAttribute("data-cs-open")){openCollection(button.dataset.csOpen);return;}
   const action=button.dataset.csAction;if(!action)return;
   if(action==="admit")return; // Intentionally dormant.
   if(action==="edit"){openForm("edit");return;}
   if(action==="select"){
     if(!state.detail||!state.detail.item_uids?.length)return;
     state.selecting=true;state.selected.clear();syncActions();renderCard();return;
   }
   if(action==="cancel"){state.selecting=false;state.selected.clear();syncActions();renderCard();return;}
   if(action==="remove")void evictSelected();
 });
 root.addEventListener("change",event=>{
   const checkbox=event.target.closest(".cs-checkbox");
   if(!checkbox||!state.selecting||state.busy)return;
   const uid=checkbox.dataset.csUid;if(!isUid(uid))return;
   if(checkbox.checked)state.selected.add(uid);else state.selected.delete(uid);
   // Mirror selection in the responsive copy without rebuilding focused inputs.
   root.querySelectorAll(".cs-checkbox").forEach(other=>{if(other!==checkbox&&other.dataset.csUid===uid)other.checked=checkbox.checked;});
   syncActions();
 });
 pagination.addEventListener("click",event=>{
   const button=event.target.closest("[data-cs-page]");
   if(!button||state.busy)return;
   const requested=button.dataset.csPage;
   const page=requested==="prev"?state.page-1:requested==="next"?state.page+1:Number(requested);
   if(!Number.isInteger(page)||page<1||page>pageCount()||page===state.page)return;
   state.page=page;state.activeId=null;state.detail=null;state.selecting=false;state.selected.clear();++state.detailSeq;
   renderRows();renderCard();
 });
 refreshButton.addEventListener("click",()=>{if(!state.busy)void loadList();});
 createButton.addEventListener("click",()=>openForm("create"));
 editButton.addEventListener("click",toggleEditMode);
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
 $("cs-form").addEventListener("submit",event=>void saveForm(event));
 $("cs-form-cancel").addEventListener("click",editClose);
 $("cs-delete-open").addEventListener("click",beginDelete);
 $("cs-delete-cancel").addEventListener("click",deleteClose);
 $("cs-delete-confirm-name").addEventListener("input",()=>{
   $("cs-delete-apply").disabled=$("cs-delete-confirm-name").value!==state.detail?.name||state.busy;
 });
 $("cs-delete-apply").addEventListener("click",()=>void deleteCollection());
 editDialog.addEventListener("cancel",event=>{if(state.busy)event.preventDefault();});
 deleteDialog.addEventListener("cancel",event=>{if(state.busy)event.preventDefault();});
 window.addEventListener("hashchange",()=>{if(routeActive())void loadList();else if(state.editing)resetEditMode();});
 if(routeActive())void loadList();
 else announce("Open Collections to retrieve the live Colosseum collection inventory.");
}
