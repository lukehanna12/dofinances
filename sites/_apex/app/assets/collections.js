import {formatWorkspaceTime} from "./workspace-nav.js";
/* Live Colosseum Collections — no cached collection records, demo data, or polling.
 * The only write surface is /api/colosseum/collections behind the existing
 * DoFinances session + Cloudflare Access + bound owner + HMAC Router bridge.
 * Inventory admission (+) is intentionally disabled until separately designed.
 */
const COLLECTIONS_API="/api/colosseum/collections";
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
   busy:false,loadSeq:0,detailSeq:0
 };
 const list=$("cs-list"),detail=$("cs-detail"),pagination=$("cs-pagination");
 const status=$("cs-status"),summary=$("cs-summary"),summaryValue=summary.querySelector(".cs-summary-value"),createButton=$("cs-create"),refreshButton=$("cs-refresh");
 const editDialog=$("cs-form-dialog"),deleteDialog=$("cs-delete-dialog");
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
 function announce(message,error=false,visible=false){
   status.textContent=message;
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
   createButton.disabled=value;
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
     const response=await fetch(COLLECTIONS_API,options);
     if(!(response.headers.get("content-type")||"").includes("application/json"))
       throw Error("Colosseum owner verification is required. Connect the project administrator in Settings, then refresh.");
     const body=await response.json();
     if(!response.ok||body.ok!==true){
       const codes={
         collection_revision_conflict:"This collection changed in another session. Refresh before trying again.",
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
   return '<article class="cs-entry" data-cs-id="'+esc(collection.collection_id)+'">'+
     '<h2><button class="cs-trigger" type="button" data-cs-open="'+esc(collection.collection_id)+'" id="cs-trigger-'+n+'" aria-controls="'+id+'" aria-expanded="false">'+
       '<span class="cs-num">'+String(n).padStart(2,"0")+'</span>'+
       '<span class="cs-entry-title"><span class="cs-title-compact" aria-hidden="true">'+esc(collection.name)+'</span>'+
         '<span class="cs-title-expanded">'+esc(collection.name)+'</span></span>'+
       '<span class="cs-chevron">'+CHEVRON+'</span></button></h2>'+
     '<div class="cs-accordion-panel" id="'+id+'" role="region" aria-labelledby="cs-trigger-'+n+'" aria-hidden="true">'+
       '<div class="cs-panel-clip"><div class="cs-panel-inner">'+
         '<p class="cs-description">'+esc(collection.description||"No description provided.")+'</p>'+
         '<div class="cs-actions" data-cs-actions>'+actionMarkup()+'</div>'+
         '<div class="cs-mobile-detail" data-cs-mobile></div>'+
       '</div></div></div></article>';
 }
 function renderPages(){
   const pages=pageCount();state.page=Math.min(Math.max(1,state.page),pages);
   if(pages===1){pagination.innerHTML='';$("cs-countline").textContent=state.loaded?
       state.collections.length+' '+(state.collections.length===1?"collection":"collections")+' · directly from Colosseum':"";return;}
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
   const first=(state.page-1)*state.pageSize+1;
   $("cs-countline").textContent=first+'–'+Math.min(first+state.pageSize-1,state.collections.length)+' of '+state.collections.length+' collections · directly from Colosseum';
 }
 function renderRows(){
   if(!state.loaded){list.innerHTML='<p class="cs-loading">Reading collections directly from Colosseum…</p>';renderPages();return;}
   if(!state.collections.length){list.innerHTML='<p class="cs-loading">No collections yet. Use New collection to create one.</p>';renderPages();return;}
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
   if(open)open.innerHTML=actionMarkup();
 }
 function cardMarkup(){
   const col=activeCollection(),current=state.detail;
   if(!col)return "";
   if(!current)return '<div class="cs-card" role="status"><span class="cs-loading">Loading live collection members…</span></div>';
   const ids=Array.isArray(current.item_uids)?current.item_uids.filter(isUid):[];
   const items=Array.isArray(current.items)?current.items:[];
   const map=new Map(items.filter(x=>x&&isUid(x.uid)).map(x=>[x.uid,x]));
   const names=ids.map(uid=>{
     const item=map.get(uid)||{uid,name:uid};
     const routes=current.routes&&current.routes[uid]&&current.routes[uid].route_mode;
     const route=["cloud","direct","ported","local"].includes(routes)?routes:"";
     const selected=state.selected.has(uid);
     const content=(state.selecting?
       '<input type="checkbox" class="cs-checkbox" data-cs-uid="'+uid+'" aria-label="Select '+esc(item.name||uid)+'"'+(selected?' checked':'')+'>':
       '<span class="cs-dot" aria-hidden="true"></span>')+
       '<span class="cs-utility-info"><span class="cs-utility-name">'+esc(item.name||uid)+'</span>'+
       '<span class="cs-utility-uid">'+uid+'</span></span>'+
       (route?'<span class="cs-utility-route">'+esc(route)+'</span>':'');
     return state.selecting?
       '<label class="cs-utility-row">'+content+'</label>':
       '<div class="cs-utility-row">'+content+'</div>';
   }).join("");
   return '<div class="cs-card"><div class="cs-card-heading"><span class="cs-card-label">'+FOLDER+'Utilities</span>'+
     '<span class="cs-card-badge">'+ids.length+' '+(ids.length===1?'utility':'utilities')+'</span></div>'+
     '<div class="cs-utility-list" role="group" aria-label="Utilities in '+esc(col.name)+'">'+
       (names||'<p class="cs-utility-empty">This collection has no utilities yet.</p>')+
     '</div><div class="cs-summary"><span class="cs-dot" aria-hidden="true"></span>'+
     '<span>Revision '+esc(current.revision)+' · '+ids.length+' '+(ids.length===1?'utility':'utilities')+' in '+esc(col.name)+'</span></div></div>';
 }
 function renderCard(){
   const selected=!!state.activeId;
   detail.classList.toggle("cs-empty",!selected);
   detail.setAttribute("aria-hidden",String(!selected));
   if(selected)detail.innerHTML=cardMarkup()+
     (state.detail?'<p class="cs-caption">Collection membership, directly from Colosseum</p>':'');
   else detail.innerHTML="";
   const mobile=list.querySelector(".cs-entry.cs-open [data-cs-mobile]");
   if(mobile)mobile.innerHTML=selected?cardMarkup()+
     (state.detail?'<p class="cs-caption">Collection membership, directly from Colosseum</p>':''):"";
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
       announce(error.message,true);
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
     state.collections=good.filter(item=>{if(seen.has(item.collection_id))return false;seen.add(item.collection_id);return true;});
     state.loaded=true;
     let chosen=focusId?state.collections.find(x=>x.collection_id===focusId):null;
     if(!chosen&&focusName)chosen=state.collections.find(x=>x.name.toLocaleLowerCase()===focusName.toLocaleLowerCase());
     if(!chosen&&state.activeId)chosen=state.collections.find(x=>x.collection_id===state.activeId);
     state.activeId=chosen?.collection_id||null;
     state.selecting=false;state.selected.clear();state.detail=null;++state.detailSeq;
     if(chosen)state.page=Math.floor(state.collections.indexOf(chosen)/state.pageSize)+1;
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
       announce(error.message,true);
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
 list.addEventListener("click",event=>{
   const button=event.target.closest("button");
   if(!button||state.busy)return;
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
 window.addEventListener("hashchange",()=>{if(routeActive())void loadList();});
 if(routeActive())void loadList();
 else announce("Open Collections to retrieve the live Colosseum collection inventory.");
}
