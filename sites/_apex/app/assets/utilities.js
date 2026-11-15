/* Live Colosseum Utilities — Collections-compatible layout, explicit network I/O.
 * Only the authenticated /api/colosseum/utilities owner bridge can read data.
 * No timers, polling, simulated inventory, or background update checks.
 */
const API="/api/colosseum/utilities";
const CATALOG_API="/api/colosseum/catalog/";
const UID=/^[0-9a-f]{6}$/;
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
 ["subjects","Subject",null]
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
export function utilityCanManage(item){return !!item&&UID.test(item.uid)&&["direct","cloud"].includes(item.route);}
export function utilityResultLabel(item){return item?.name||item?.uid||"Utility";}
export function utilitySearchIndex(item){
 return [item.name,item.uid,item.label,item.class,item.author,item.platform,item.route,
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
  summary:$("ut-summary"),status:$("ut-status"),layout:$("ut-layout"),
  list:$("ut-list"),inspector:$("ut-inspector"),pages:$("ut-pages"),count:$("ut-count"),
  query:$("ut-search"),submit:$("ut-search-submit"),filters:$("ut-filters"),
  fields:$("ut-filter-fields"),filterToggle:$("ut-filter-toggle"),clear:$("ut-filters-clear"),
  sort:$("ut-sort"),refresh:$("ut-refresh"),updates:$("ut-update-check"),updateResults:$("ut-update-results"),
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
  activeUid:null,detail:null,detailCache:new Map(),detailSeq:0,requestSeq:0,
  sort:"name_asc",query:"",include:{},exclude:{},selectionMode:false,
  selection:new Set(),editorMode:"add",editorItem:null,planned:null,pendingDelete:null,
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
 function busy(value){
  s.working=value;
  elements.add.disabled=value;
  elements.edit.disabled=value||!utilityCanManage(selectedItem());
  elements.select.disabled=value;
  elements.refresh.disabled=value;
  elements.updates.disabled=value;
  elements.sort.disabled=value;
  elements.query.disabled=value;
  elements.submit.disabled=value;
  elements.filterToggle.disabled=value;
 }
 function summary(){
  elements.summary.textContent=s.loaded?
   "CATALOG "+String(s.items.length)+(s.nextCursor?"+":"")+" / REVISION "+(s.revision||"—")+
    " / PAGE "+String(s.page+1):"CATALOG / LOADING";
 }
 function skeletons(){
  elements.list.innerHTML=Array.from({length:10},(_,i)=>'<div class="ut-skeleton" aria-hidden="true"><span>'+String(s.page*25+i+1).padStart(2,"0")+'</span></div>').join("");
 }
 function rowsMarkup(){
  if(!s.items.length)return '<p class="ut-empty">'+(s.query||Object.keys(s.include).length||Object.keys(s.exclude).length?
   "No catalog utilities match these search and filter conditions.":"No utilities were returned by the live catalog.")+'</p>';
  return s.items.map((item,i)=>{
   const title=esc(plain(item.name)),uid=esc(item.uid);
   return '<article class="ut-row" data-ut-uid="'+uid+'">'+
    '<button type="button" class="ut-row-main" data-ut-open="'+uid+'" aria-expanded="false" aria-controls="ut-panel-'+uid+'">'+
    '<span class="ut-row-number">'+String(s.page*25+i+1).padStart(2,"0")+'</span>'+
    '<span class="ut-route-icon" data-route="'+esc(item.route||"unknown")+'" aria-label="'+esc(plain(item.route))+' utility" role="img"></span>'+
    '<span class="ut-row-copy"><span class="ut-row-title">'+title+'</span>'+
    '<span class="ut-row-sub">'+uid+' · '+esc(plain(item.class))+'</span></span>'+
    '<span class="ut-row-side">'+esc(plain(item.author))+'</span><span class="ut-chevron">'+ICON_DOWN+'</span></button>'+
    '<div class="ut-row-panel" id="ut-panel-'+uid+'" aria-hidden="true"><div class="ut-row-panel-inner">'+
    '<p class="ut-row-description">'+esc(plain(item.label))+'</p>'+
    '<div class="ut-mobile-detail" data-ut-mobile></div></div></div></article>';
  }).join("");
 }
 function syncActive(){
  elements.layout.classList.toggle("ut-open",!!s.activeUid);
  elements.inspector.setAttribute("aria-hidden",String(!s.activeUid));
  for(const el of elements.list.querySelectorAll(".ut-row")){
   const open=el.dataset.utUid===s.activeUid;
   el.classList.toggle("ut-active",open);
   el.querySelector(".ut-row-main")?.setAttribute("aria-expanded",String(open));
   el.querySelector(".ut-row-panel")?.setAttribute("aria-hidden",String(!open));
  }
  elements.edit.disabled=s.working||!utilityCanManage(selectedItem());
 }
 const metadata=(name,value)=>'<div><dt>'+esc(name)+'</dt><dd>'+esc(plain(value))+'</dd></div>';
 const tagSection=(label,tags)=>{
  const content=renderTags(tags);
  return content?'<section class="ut-card-section"><h3>'+esc(label)+'</h3><div class="ut-tag-list">'+content+'</div></section>':"";
 };
 function itemCard(){
  const item=s.detail?.item||selectedItem();
  if(!item)return "";
  if(!s.detail||s.detail.item?.uid!==item.uid)
   return '<section class="ut-card" role="status"><p>Loading live utility details…</p></section>';
  const rows=[
   ["UID",item.uid],["Route",item.route],["Class",item.class],["Type",item.type],
   ["Cardinality",item.cardinality],["Author",item.author],["Platform",item.platform],
   ["Source mode",item.source_mode],["Revision",item.revision],["Created",displayDate(item.source_created_at)],
   ["Last updated",displayDate(item.updated_at)],["Runtime",item.runtime],["Assets",String(s.detail.asset_count??0)]
  ];
  const url=(()=>{try{const u=new URL(item.reference);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}})();
  const files=(s.detail.files||[]).map(f=>'<div class="ut-file"><code>'+esc(f.relative_path)+'</code>'+
   '<small>'+Number(f.size_bytes||0).toLocaleString()+' bytes</small></div>').join("");
  const canEdit=utilityCanManage(item);
  return '<section class="ut-card" aria-label="'+esc(item.name)+' details">'+
   '<div class="ut-card-header"><div><p class="ut-overline">'+esc(plain(item.route))+' UTILITY</p>'+
   '<h2>'+esc(item.name)+'</h2></div><span class="ut-tag">#'+esc(item.uid)+'</span></div>'+
   '<p>'+esc(plain(item.label))+'</p><dl class="ut-meta">'+rows.map(([k,v])=>metadata(k,v)).join("")+'</dl>'+
   tagSection("Languages",item.languages_json)+tagSection("Ecosystems",item.ecosystems_json)+
   tagSection("Vendors",item.vendors_json)+tagSection("Subjects / indexed catalog terms",item.subjects_json)+
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
     '<p>Catalog edits are available for cloud and direct utilities only.</p>')+
   '</div></section></section>';
 }
 function renderDetail(){
  const card=itemCard();elements.inspector.innerHTML=card;
  elements.list.querySelectorAll("[data-ut-mobile]").forEach(el=>{
   if(el.closest(".ut-row")?.dataset.utUid===s.activeUid)el.innerHTML=card;
   else if(el.innerHTML)el.replaceChildren();
  });
 }
 function renderList(){
  elements.list.innerHTML=rowsMarkup();elements.list.setAttribute("aria-busy","false");
  elements.pages.innerHTML=(s.page>0?'<button type="button" data-ut-page="prev" aria-label="Previous utilities page">Previous</button>':"")+
   '<button type="button" aria-current="page" disabled>'+String(s.page+1)+'</button>'+
   (s.nextCursor?'<button type="button" data-ut-page="next" aria-label="Next utilities page">Next</button>':"");
  elements.count.textContent=s.items.length?
   String(s.page*25+1)+"–"+String(s.page*25+s.items.length)+(s.nextCursor?" · more available":"")+" · live Colosseum":"0 matching utilities";
  syncActive();renderDetail();
 }
 async function loadPage(index=0,cursor=null){
  const serial=++s.requestSeq;
  s.loading=true;busy(true);
  elements.list.setAttribute("aria-busy","true");
  if(!s.loaded)skeletons();
  report("Loading live catalog utilities…");
  try{
   const query=clean(elements.query.value).slice(0,160);
   const args={action:"list",query,sort:elements.sort.value,page_size:25,
    include:s.include,exclude:s.exclude,...(cursor?{cursor}:{})};
   const result=await api(args);if(serial!==s.requestSeq)return;
   if(!Array.isArray(result.items))throw Error("The catalog returned an unexpected listing.");
   s.items=result.items.filter(x=>UID.test(x?.uid));s.page=index;
   s.query=query;s.sort=args.sort;s.nextCursor=result.next_cursor||null;
   s.revision=result.catalog_revision||"—";s.loaded=true;
   s.activeUid=null;s.detail=null;s.detailSeq++;
   s.selection.clear();s.selectionMode=false;
   elements.select.dataset.mode="off";elements.select.setAttribute("aria-pressed","false");
   s.cursors[index]=cursor;
   s.cursors.length=index+1;
   if(s.nextCursor)s.cursors[index+1]=s.nextCursor;
   summary();renderList();report("");
  }catch(error){if(serial===s.requestSeq){actionError(error);if(!s.loaded){s.items=[];renderList();}}}
  finally{if(serial===s.requestSeq){s.loading=false;busy(false);}}
 }
 async function loadDetails(uid,{force=false}={}){
  if(!UID.test(uid))return;
  const seq=++s.detailSeq;
  if(!force&&s.detailCache.has(uid)){s.detail=s.detailCache.get(uid);renderDetail();return;}
  try{
   const item=await api({action:"get",uid,files_limit:30,files_offset:0});
   if(seq!==s.detailSeq||s.activeUid!==uid)return;
   if(!item.found)throw Error("This utility no longer exists in the catalog.");
   s.detail=item;s.detailCache.set(uid,item);renderDetail();
  }catch(error){if(seq===s.detailSeq&&s.activeUid===uid){actionError(error);s.detail=null;renderDetail();}}
 }
 function choose(uid){
  if(s.selectionMode){
   if(s.selection.has(uid))s.selection.delete(uid);else s.selection.add(uid);
   const chosen=elements.list.querySelector('[data-ut-uid="'+uid+'"]');
   chosen?.querySelector(".ut-pick")?.setAttribute("aria-pressed",String(s.selection.has(uid)));
   elements.count.textContent=s.selection.size+" selected · "+s.items.length+" on this page";
   if(s.selection.size===1){s.activeUid=[...s.selection][0];syncActive();renderDetail();void loadDetails(s.activeUid);}
   return;
  }
  s.activeUid=s.activeUid===uid?null:uid;
  s.detail=null;s.detailSeq++;
  syncActive();renderDetail();
  if(s.activeUid)void loadDetails(s.activeUid);
 }
 function renderFilterControls(){
  elements.fields.innerHTML=FILTER_GROUPS.flatMap(([field,label,choices])=>
   ["include","exclude"].map(mode=>
    '<label class="ut-filter-field"><span>'+esc(mode==="include"?"Include ":"Exclude ")+esc(label)+'</span>'+
    (choices?
      '<select data-ut-filter-field="'+field+'" data-ut-filter-mode="'+mode+'"><option value="">Any</option>'+
       choices.map(value=>'<option value="'+esc(value)+'">'+esc(value.replaceAll("_"," "))+'</option>').join("")+'</select>':
      '<input type="text" data-ut-filter-field="'+field+'" data-ut-filter-mode="'+mode+'" placeholder="Comma-separated values" autocomplete="off">')+
    '</label>')).join("");
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
  const uid=clean(data.uid).toLowerCase(),route=data.route;
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
  if(mode==="edit")elements.editorFields.querySelector('[name="route"]').disabled=true;
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
 async function checkUpdates(){
  if(s.working)return;
  try{
   busy(true);
   elements.updateResults.textContent="Checking upstream revision records on request…";
   const chosen=selectedItem();
   const body={action:"updates"};
   if(chosen?.uid&&["safe_update","manual_update"].includes(chosen.source_mode))
    body.inventory_uids=[chosen.uid];
   const data=await api(body);
   const results=Array.isArray(data)?data:Array.isArray(data?.items)?data.items:
    Array.isArray(data?.updates)?data.updates:Array.isArray(data?.results)?data.results:[];
   elements.updateResults.textContent=results.length?
    results.map(x=>esc(x.name||x.inventory_uid)+": "+esc(x.status||"indeterminate")+
     (x.observed_revision&&x.observed_revision!==x.saved_revision?" · newer upstream revision":"")).join(" · "):
    "No update candidates were returned. No changes were installed or published.";
  }catch(error){elements.updateResults.textContent=error.message||String(error);}
  finally{busy(false);}
 }
 elements.list.addEventListener("click",event=>{
  const open=event.target.closest("[data-ut-open]");
  if(open){choose(open.dataset.utOpen);return;}
  const edit=event.target.closest("[data-ut-edit]");
  if(edit){const item=s.items.find(x=>x.uid===edit.dataset.utEdit);if(item)openEditor("edit",s.detail?.item?.uid===item.uid?s.detail.item:item);return;}
  const remove=event.target.closest("[data-ut-remove]");
  if(remove){openDelete(remove.dataset.utRemove);return;}
  if(event.target.closest("[data-ut-more-files]"))void moreFiles();
 });
 elements.inspector.addEventListener("click",event=>{
  const edit=event.target.closest("[data-ut-edit]");
  if(edit){const item=s.items.find(x=>x.uid===edit.dataset.utEdit);if(item)openEditor("edit",s.detail?.item?.uid===item.uid?s.detail.item:item);return;}
  const remove=event.target.closest("[data-ut-remove]");
  if(remove){openDelete(remove.dataset.utRemove);return;}
  if(event.target.closest("[data-ut-more-files]"))void moreFiles();
 });
 elements.pages.addEventListener("click",event=>{
  const action=event.target.closest("[data-ut-page]")?.dataset.utPage;
  if(action==="prev"&&s.page>0)void loadPage(s.page-1,s.cursors[s.page-1]);
  if(action==="next"&&s.nextCursor)void loadPage(s.page+1,s.nextCursor);
 });
 elements.submit.addEventListener("click",()=>void loadPage(0,null));
 elements.query.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void loadPage(0,null);}});
 elements.query.addEventListener("search",()=>void loadPage(0,null));
 elements.sort.addEventListener("change",()=>void loadPage(0,null));
 elements.refresh.addEventListener("click",()=>void loadPage(0,null));
 elements.filterToggle.addEventListener("click",()=>{
  const open=elements.filters.hidden;elements.filters.hidden=!open;elements.filterToggle.setAttribute("aria-expanded",String(open));
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
 elements.updates.addEventListener("click",()=>void checkUpdates());
 elements.add.addEventListener("click",()=>openEditor("add"));
 elements.edit.addEventListener("click",()=>{const item=selectedItem();if(item)openEditor("edit",s.detail?.item?.uid===item.uid?s.detail.item:item);});
 elements.select.addEventListener("click",()=>{
  s.selectionMode=!s.selectionMode;s.selection.clear();
  elements.select.setAttribute("aria-pressed",String(s.selectionMode));
  elements.select.dataset.mode=s.selectionMode?"on":"off";
  for(const row of elements.list.querySelectorAll(".ut-row")){
   const active=!!s.selectionMode,rowButton=row.querySelector(".ut-row-main");
   const pick=row.querySelector(".ut-pick");
   if(pick)pick.remove();
   if(active)rowButton.insertAdjacentHTML("beforeend",
    '<span class="ut-pick" role="img" aria-label="Select utility" aria-pressed="false">✓</span>');
  }
  elements.count.textContent=s.selectionMode?"Select utilities to inspect; click Select again to exit.":String(s.page*25+1)+"–"+String(s.page*25+s.items.length)+" · live Colosseum";
 });
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
 renderFilterControls();filterDot();summary();skeletons();void loadPage(0,null);
}
