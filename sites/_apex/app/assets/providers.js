/* Providers workbench. Inspired by item 0001c8: deliberate left selection
 * and one changing detail pane; never autoplay a permission-management view.
 * No credentials, local policy writes, or speculative connection states. */
const PORTAL="https://router.colosseum.workers.dev";
const ROUTE='[data-view="colosseum/providers"]';
// Catalog snapshot is a directory, not a claim that services are connected.
const FEDERATED=Object.freeze([
 {uid:"000008",name:"Penpot MCP",kind:"Federated MCP",mark:"P"},
 {uid:"0001cd",name:"Apple HIG Reader",kind:"Cloud reader · not federated login",mark:"H",reader:true},
 {uid:"000064",name:"Cloudflare MCP Servers",kind:"Hosted MCP",mark:"C"},
 {uid:"00007c",name:"Context7",kind:"Hosted MCP",mark:"C"},
 {uid:"000004",name:"Design Systems MCP",kind:"Hosted MCP",mark:"D"},
 {uid:"000002",name:"Figma Console MCP",kind:"Hosted MCP",mark:"F"},
 {uid:"000068",name:"GitHub MCP Server",kind:"Hosted MCP",mark:"G"},
 {uid:"000007",name:"Google Docs MCP",kind:"Hosted MCP",mark:"G"},
 {uid:"000001",name:"Google Drive MCP",kind:"Hosted MCP",mark:"G"},
 {uid:"000005",name:"Google Sheets MCP",kind:"Hosted MCP",mark:"G"},
 {uid:"000003",name:"Google Slides MCP",kind:"Hosted MCP",mark:"G"},
 {uid:"000000",name:"Linear MCP",kind:"Hosted MCP",mark:"L"},
 {uid:"00006a",name:"Supabase MCP",kind:"Hosted MCP",mark:"S"}
]);
// Account status and per-tool grants are owned by the Colosseum account portal.
// No login tokens or per-provider secrets are copied into this application.
export function portalUrl(uid,operation="tools"){
 if(!/^[0-9a-f]{6}$/.test(uid)||!["tools","configure"].includes(operation))throw Error("Invalid provider action");
 return PORTAL+"/account/providers/"+operation+"?uid="+encodeURIComponent(uid);
}
export function parseProviderHealth(report){
 if(report?.name!=="system.status"||!report.sections||typeof report.sections!=="object")
   throw Error("The local provider report has an unexpected format.");
 const local=report.sections.local;
 const providerLayer=local?.layers?.find(x=>x?.layer==="providers");
 if(!providerLayer||!Array.isArray(providerLayer.checks))
   throw Error("Local provider details are not available from this report.");
 const ids=new Set();
 const providers=[];
 for(const check of providerLayer.checks){
   const id=typeof check?.name==="string"&&check.name.startsWith("provider:")?check.name.slice(9):"";
   if(!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)||ids.has(id))continue;
   ids.add(id);
   const text=typeof check.detail==="string"?check.detail:"";
   const count=/^(\d+) tool\(s\); revision ([a-f0-9]{64})$/.exec(text);
   providers.push({id,name:id.split("-").map(x=>x==="mcp"?"MCP":x==="cdp"?"CDP":x==="ui"?"UI":x==="api"?"API":x[0].toUpperCase()+x.slice(1)).join(" "),
      status:check.status==="pass"?"available":check.status==="warn"?"degraded":"unavailable",
      toolCount:count?Number(count[1]):null,revision:count?count[2]:null});
 }
 if(!providers.length)throw Error("No individual local providers were reported.");
 providers.sort((a,b)=>a.name.localeCompare(b.name));
 const expected=providerLayer.metrics?.provider_count;
 return {providers,expected:Number.isSafeInteger(expected)?expected:null,
    collectedAt:local.timestamp||report.collected_at||null,overall:local.status||"unknown"};
}
function el(tag,cls,content){
 const v=document.createElement(tag);
 if(cls)v.className=cls;
 if(content!==undefined)v.textContent=String(content);
 return v;
}
function appendText(parent,tag,cls,value){
 const v=el(tag,cls,value);parent.append(v);return v;
}
function tag(label,state){
 const span=el("span","pv-tag",label);
 if(state)span.dataset.state=state;
 return span;
}
function link(label,href,secondary=false){
 const a=el("a","pv-detail-action"+(secondary?" secondary":""),label);
 a.href=href;a.target="_blank";a.rel="noopener noreferrer";return a;
}
function detailHeading(parent,eyebrow,name,mark,description){
 appendText(parent,"p","pv-detail-overline",eyebrow);
 const row=el("div","pv-detail-heading"),icon=el("div","pv-detail-mark",mark),copy=el("div");
 appendText(copy,"h3","",name);
 appendText(copy,"p","pv-detail-description",description);
 row.append(icon,copy);parent.append(row);
}
function detailPairs(parent,rows){
 const dl=el("dl","pv-detail-grid");
 for(const [name,value] of rows){
   const row=el("div");appendText(row,"dt","",name);appendText(row,"dd","",value);dl.append(row);
 }
 parent.append(dl);
}
export function initColosseumProviders(){
 const root=document.getElementById("pv-root");
 if(!root||root.dataset.ready==="true")return;
 root.dataset.ready="true";
 const left=document.getElementById("pv-list"),detail=document.getElementById("pv-detail"),
  status=document.getElementById("pv-status"),search=document.getElementById("pv-search"),
  remoteTab=document.getElementById("pv-federated-tab"),localTab=document.getElementById("pv-local-tab"),
  refresh=document.getElementById("pv-refresh"),localCount=document.getElementById("pv-local-count"),
  pane=document.getElementById("pv-browser"),heading=document.getElementById("pv-index-title"),
  total=document.getElementById("pv-index-total");
 let mode="federated",selection={federated:"000008",local:null},localSnapshot=null,busy=false,authChecked=false;
 const tell=(message,tone)=>{status.textContent=message;status.dataset.tone=tone||"info";};
 const selected=()=>selection[mode];
 const currentItems=()=>mode==="federated"?FEDERATED:(localSnapshot?.providers||[]);
 const choiceId=x=>mode==="federated"?x.uid:x.id;
 function renderList(){
   left.replaceChildren();
   const term=search.value.trim().toLocaleLowerCase();
   const items=currentItems().filter(item=>item.name.toLocaleLowerCase().includes(term)||choiceId(item).toLocaleLowerCase().includes(term));
   total.textContent=String(items.length);
   for(const item of items){
     const id=choiceId(item);
     const button=el("button","pv-provider-item"+(selected()===id?" is-active":""));
     button.type="button";button.setAttribute("aria-pressed",String(selected()===id));
     button.dataset.providerId=id;
     button.append(el("span","pv-provider-icon",mode==="federated"?item.mark:item.name[0]||"?"));
     const copy=el("span");
     appendText(copy,"strong","",item.name);
     appendText(copy,"small","",mode==="federated"?item.kind:
       (item.toolCount===null?"Tool count not reported":item.toolCount+" tools")+" · "+item.status);
     button.append(copy,el("span","pv-chevron","›"));
     button.addEventListener("click",()=>{selection[mode]=id;renderList();renderDetails();});
     left.append(button);
   }
   if(!items.length)left.append(el("p","pv-empty-list",mode==="local"&&!localSnapshot?"Choose ‘Check live’ to retrieve local providers.":"No providers match your search."));
 }
 function renderDetails(){
   detail.replaceChildren();
   detail.classList.remove("is-changing");
   // Restart CSS transition only on explicit selection, not on time-based rotation.
   void detail.offsetWidth;
   detail.classList.add("is-changing");
   const id=selected();
   const item=currentItems().find(x=>choiceId(x)===id);
   if(!item){
     detail.append(el("p","pv-inspector-placeholder",mode==="local"?
       "No local report yet. Select Check live to retrieve actual provider health and tool counts.":"Select a registered provider."));
     return;
   }
   if(mode==="federated"){
     detailHeading(detail,"FEDERATED / CATALOG REGISTRATION",item.name,item.mark,
        item.reader?"A cloud-side documentation reader. This is not a federated user login.":
          "A registered external MCP endpoint. Registration does not establish an active credential or tool grant.");
     const state=el("div","pv-detail-state");
     state.append(tag("Registered in catalog"),tag(item.reader?"Cloud reader":"Connection managed externally"));
     detail.append(state);
     detailPairs(detail,[["Catalog UID",item.uid],["Access type",item.reader?"Built-in read-only adapter":"Federated MCP"],
        ["Credential state","See account portal"],["Tool grants","See account portal"]]);
     const group=el("div","pv-detail-section");
     appendText(group,"h4","","Connection & authorization");
     appendText(group,"p","","These actions open the authenticated Colosseum manager. Credentials, per-tool approvals, and disconnection happen there—not inside this page.");
     if(!item.reader)group.append(link("Configure connection",portalUrl(item.uid,"configure")));
     group.append(link("Discover & approve tools",portalUrl(item.uid,"tools"),!item.reader));
     detail.append(group);
   }else{
     detailHeading(detail,"LOCAL / LIVE GATEWAY",item.name,item.name[0]||"L",
       "A locally registered provider. Gateway availability and permitted tool invocation are distinct.");
     const state=el("div","pv-detail-state");state.append(tag(item.status==="available"?"Gateway available":item.status==="degraded"?"Gateway degraded":"Unavailable",item.status));
     state.append(tag("Contract: not reported"));detail.append(state);
     detailPairs(detail,[["Provider identifier",item.id],["Discovered tools",item.toolCount===null?"Not reported":item.toolCount.toLocaleString()],
        ["Provider revision",item.revision?item.revision.slice(0,14)+"…":"Unavailable"],
        ["Current permission profile","Not exposed by gateway"],
        ["Filesystem / execution","Google Sheets authority"]]);
     const sec=el("div","pv-detail-section");
     appendText(sec,"h4","","Local provider regulation");
     appendText(sec,"p","","The independently managed provider permission contract controls connection, operations, resources, effects, and credential delegation. Google Sheets separately restricts filesystem access and script execution.");
     appendText(sec,"p","","Editing is not available yet: the live gateway has no authorized write interface to the shared permission registry. This page will not claim to change your effective access without a verified enforcement response.");
     sec.append(link("Read provider contract", "https://github.com/lukehanna12/colosseum/blob/main/docs/operations/provider-adapters.md",true));
     detail.append(sec);
   }
 }
 function render(){
   const remote=mode==="federated";
   remoteTab.classList.toggle("active",remote);localTab.classList.toggle("active",!remote);
   remoteTab.setAttribute("aria-selected",String(remote));
   localTab.setAttribute("aria-selected",String(!remote));
   pane.setAttribute("aria-labelledby",remote?"pv-federated-tab":"pv-local-tab");
   heading.textContent=remote?"Registered federated sources":"Live local provider runtimes";
   search.value="";
   refresh.querySelector("span").textContent=remote?"Verify owner":"Check live";
   renderList();renderDetails();
   if(remote)tell("Catalog registration is not a connection status. Open the Colosseum account portal for current credentials and per-tool approvals.");
   else if(localSnapshot)tell("Provider health collected "+formatDate(localSnapshot.collectedAt)+". Local profiles remain independently administered.");
   else tell("Check live to retrieve the gateway's current provider status. Nothing is inferred from the catalog.");
 }
 function formatDate(iso){
   const t=Date.parse(iso);return Number.isFinite(t)?new Date(t).toLocaleString():"at an unknown time";
 }
 async function verifyOwner(){
   if(busy)return;
   busy=true;refresh.disabled=true;
   try{
     const res=await fetch("/api/colosseum/status",{credentials:"same-origin",cache:"no-store"});
     const data=await res.json();
     if(!res.ok)throw Error(data?.error||"Owner verification is unavailable.");
     if(!data.owner)throw Error("This DoFinances account is not the linked Colosseum administrator.");
     tell("Colosseum owner verified. Manage each connection and its grants in the account portal.");
     authChecked=true;
   }catch(e){tell(String(e.message||"Owner verification unavailable."),"error");}
   finally{busy=false;refresh.disabled=false;}
 }
 async function loadLocal(){
   if(busy)return;
   busy=true;refresh.disabled=true;
   tell("Checking the live local provider gateway…");
   const ctrl=new AbortController();
   const timeout=setTimeout(()=>ctrl.abort(),60000);
   try{
     const res=await fetch("/api/colosseum/diagnostics",{
       method:"POST",credentials:"same-origin",cache:"no-store",
       headers:{"Content-Type":"application/json"},body:JSON.stringify({
         sections:["local"],check:"providers",depth:"standard"}),signal:ctrl.signal
     });
     if(!(res.headers.get("content-type")||"").includes("application/json"))throw Error("Owner authentication or provider diagnostics is unavailable.");
     const body=await res.json();
     if(!res.ok)throw Error(body.error||"Provider gateway request failed (HTTP "+res.status+").");
     const snap=parseProviderHealth(body?.name==="system.status"?body:body?.report);
     localSnapshot=snap;
     localCount.textContent=snap.expected===null?snap.providers.length+" checked":snap.expected+" available";
     if(!snap.providers.some(x=>x.id===selection.local))selection.local=snap.providers[0].id;
     tell(snap.providers.length+" individual local providers checked at "+formatDate(snap.collectedAt)+". Profiles are separate from runtime availability.");
     renderList();renderDetails();
   }catch(e){
     tell(e.name==="AbortError"?"Local provider check timed out. Last successful report, if any, is retained.":String(e.message||"Provider check unavailable."),"error");
   }finally{clearTimeout(timeout);busy=false;refresh.disabled=false;}
 }
 remoteTab.addEventListener("click",()=>{if(mode!=="federated"){mode="federated";render();if(!authChecked)void verifyOwner();}});
 localTab.addEventListener("click",()=>{if(mode!=="local"){mode="local";render();if(!localSnapshot)void loadLocal();}});
 const tabs=[remoteTab,localTab];
 tabs.forEach((button,i)=>button.addEventListener("keydown",event=>{
   if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
   event.preventDefault();
   const next=event.key==="Home"?0:event.key==="End"?1:(i+(event.key==="ArrowRight"?1:-1)+2)%2;
   tabs[next].focus();tabs[next].click();
 }));
 refresh.addEventListener("click",()=>{if(mode==="local")void loadLocal();else void verifyOwner();});
 search.addEventListener("input",renderList);
 render();
 function onRoute(){
   if(!document.querySelector(ROUTE)?.hidden&&!authChecked&&!busy)void verifyOwner();
 }
 window.addEventListener("hashchange",()=>window.queueMicrotask(onRoute));
 window.queueMicrotask(onRoute);
}
