/* Owner-authorized catalog search and existing-utility admission.
 * One modal instance serves the desktop card and mobile accordion. The browser
 * never supplies catalog routes or creates catalog entries.
 */
export function admissionSearchArgs(query){
  const raw=String(query??"").normalize("NFKC").trim();
  if(!raw)return null;
  const lower=raw.toLocaleLowerCase("en-US");
  return {action:"list",...(/^[0-9a-f]{1,6}$/.test(lower)?{uid_prefix:lower}:{query:raw}),
    sort:"name_asc",page_size:25};
}
const uidOK=uid=>typeof uid==="string"&&/^[0-9a-f]{6}$/.test(uid);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

export function initCollectionsAdmission({root,getSnapshot,admit,onSaved}){
  const $=id=>root.querySelector("#"+id);
  const dialog=$("cs-admit-dialog"),search=$("cs-admit-search"),
    results=$("cs-admit-results"),status=$("cs-admit-status"),
    add=$("cs-admit-apply"),more=$("cs-admit-more"),
    error=$("cs-admit-error"),cancel=$("cs-admit-cancel");
  let session=null,serial=0,timer=null,controller=null;

  function stopSearch(){
    if(timer!==null){clearTimeout(timer);timer=null;}
    controller?.abort();controller=null;++serial;
  }
  function paint(){
    if(!session)return;
    const current=session;
    const selected=current.selected.size;
    add.disabled=current.saving||selected===0;
    add.textContent=selected?"Add "+selected+" "+(selected===1?"utility":"utilities"):"Add utilities";
    search.disabled=current.saving;
    more.hidden=!current.cursor;
    more.disabled=current.loading||current.saving;
    const existing=new Set(current.item_uids);
    results.innerHTML=current.items.map(item=>{
      const inside=existing.has(item.uid),available=item.enabled===1;
      const chosen=current.selected.has(item.uid),disabled=inside||!available||current.saving;
      return '<button type="button" class="cs-admit-row" data-cs-admit-uid="'+item.uid+
        '" aria-pressed="'+chosen+'" aria-label="'+esc((inside?"Already added: ":!available?
         "Unavailable: ":chosen?"Deselect ":"Select ")+item.name)+'"'+(disabled?' disabled':'')+'>'+
        '<span class="cs-admit-row-main"><span class="cs-admit-row-name">'+esc(item.name)+'</span>'+
        '<span class="cs-admit-row-uid">'+item.uid+'</span></span>'+
        '<span class="cs-admit-row-state">'+(inside?"Added":!available?"Unavailable":
          chosen?"Selected":"Select")+'</span></button>';
    }).join("")||(current.loading?"":'<p class="cs-admit-empty">'+
       (current.query?"No catalog utilities match this search.":"Search by utility name or UID to find an existing catalog entry.")+"</p>");
    status.textContent=current.loading?"Searching live Colosseum catalog…":
      current.items.length?current.items.length+" result"+(current.items.length===1?"":"s")+
        (current.cursor?" · more available":""):"";
  }
  async function load(append=false){
    const s=session;
    if(!s||s.saving||!dialog.open)return;
    const args=admissionSearchArgs(search.value);
    if(append&&!s.cursor)return;
    stopSearch();
    const id=serial;
    s.query=search.value.trim();
    if(!args){
      s.items=[];s.cursor=null;s.loading=false;error.textContent="";
      paint();return;
    }
    const cursor=append?s.cursor:null;
    const abort=new AbortController();controller=abort;
    const watchdog=setTimeout(()=>abort.abort(),25000);
    s.loading=true;error.textContent="";
    if(!append){s.items=[];s.cursor=null;}
    paint();
    try{
      const res=await fetch("/api/colosseum/utilities",{
        method:"POST",credentials:"same-origin",cache:"no-store",signal:abort.signal,
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({...args,...(cursor?{cursor}:{})})
      });
      if(!(res.headers.get("content-type")||"").includes("application/json"))
        throw Error("Colosseum owner authorization is required. Reauthorize from Collections.");
      const data=await res.json();
      if(!res.ok||!Array.isArray(data.items))
        throw Error(data.error||"Catalog search failed (HTTP "+res.status+").");
      if(id!==serial||s!==session||!dialog.open)return;
      const prior=append?s.items:[];
      const seen=new Set(prior.map(item=>item.uid));
      s.items=[...prior,...data.items.filter(item=>item&&uidOK(item.uid)&&
        typeof item.name==="string"&&!seen.has(item.uid))];
      s.cursor=data.next_cursor||null;
    }catch(e){
      if(id!==serial||s!==session||e?.name==="AbortError")return;
      error.textContent=e.message||"Unable to search the catalog.";
      s.cursor=null;
    }finally{
      clearTimeout(watchdog);
      if(id===serial&&s===session){s.loading=false;controller=null;paint();}
    }
  }
  function open(){
    if(session||dialog.open)return;
    const snapshot=getSnapshot();
    if(!snapshot||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<1)return;
    session={...snapshot,item_uids:[...snapshot.item_uids],items:[],
      selected:new Map(),cursor:null,query:"",loading:false,saving:false};
    $("cs-admit-collection").textContent=snapshot.name;
    search.value="";error.textContent="";
    dialog.showModal();paint();search.focus({preventScroll:true});
  }
  async function save(){
    const s=session;if(!s||s.saving||!dialog.open||!s.selected.size)return;
    const now=getSnapshot();
    if(!now||now.id!==s.id||now.name!==s.name||now.revision!==s.revision){
      error.textContent="This collection has changed. Close and reopen Add utilities.";
      return;
    }
    const ids=[...s.selected.keys()].filter(id=>uidOK(id)&&!s.item_uids.includes(id));
    if(!ids.length){error.textContent="Those utilities already belong to the collection.";return;}
    s.saving=true;stopSearch();paint();error.textContent="";
    try{
      const result=await admit({id:s.id,name:s.name,revision:s.revision},ids);
      if(result?.collection_id!==s.id||!Number.isSafeInteger(result.revision)||
         !ids.every(id=>result.item_uids?.includes(id)))
        throw Error("Colosseum did not confirm the membership update. Refresh to check the collection.");
      const saved={...s};
      dialog.close();
      await onSaved(saved,ids);
    }catch(e){
      if(s===session)error.textContent=e.message||"Could not add utilities.";
    }finally{
      s.saving=false;
      if(session===s)paint();
    }
  }
  search.addEventListener("input",()=>{
    if(!session||session.saving)return;
    stopSearch();session.query=search.value.trim();session.items=[];session.cursor=null;
    session.loading=false;error.textContent="";paint();
    if(session.query)timer=setTimeout(()=>{timer=null;void load();},210);
  });
  search.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();void load();}
  });
  results.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-cs-admit-uid]");
    if(!button||button.disabled||!session||session.saving)return;
    const uid=button.dataset.csAdmitUid;
    const item=session.items.find(x=>x.uid===uid);
    if(!item||item.enabled!==1||session.item_uids.includes(uid))return;
    if(session.selected.has(uid))session.selected.delete(uid);
    else session.selected.set(uid,item.name);
    paint();results.querySelector('[data-cs-admit-uid="'+uid+'"]')?.focus({preventScroll:true});
  });
  more.addEventListener("click",()=>{if(session&&!session.loading)void load(true);});
  add.addEventListener("click",()=>void save());
  cancel.addEventListener("click",()=>{if(session&&!session.saving)dialog.close();});
  dialog.addEventListener("cancel",event=>{if(session?.saving)event.preventDefault();});
  dialog.addEventListener("close",()=>{stopSearch();session=null;});
  return {open,close:()=>{if(dialog.open&&!session?.saving)dialog.close();},isOpen:()=>dialog.open};
}
