/* 0001c8 Features4-inspired Providers control plane.
 * One explicit provider selection, one animated inspector, never autoplay.
 * Authority: the double-authenticated DoFinances owner route, Colosseum vault,
 * invoke grants and independently enforced local registry. */
import {mountLocalProviderProvisions,invalidateLocalProviderProvisions} from "./provider-provisions.js";
const API="/api/colosseum/providers";
const ROUTE='[data-view="colosseum/providers"]';
const FIELDS=["connection","operations","resources","effects","credentials"];
const FALLBACK_CHOICES=Object.freeze({
 connection:["stdio","http","browser","native","cli","library"],
 operations:["catalog","discover","reviewed"],
 resources:["none","filesystem","process","application","browser","device","network","account","mixed","unknown"],
 effects:["observe","change","execute","mixed","unknown"],
 credentials:["none","router_vault"]
});
export function parseProviderHealth(report){
 if(report?.name!=="system.status"||!report.sections||typeof report.sections!=="object")
  throw Error("The local provider report has an unexpected format.");
 const layer=report.sections.local?.layers?.find(x=>x?.layer==="providers");
 if(!layer||!Array.isArray(layer.checks))throw Error("Local provider details are not available from this report.");
 const seen=new Set(),providers=[];
 for(const c of layer.checks){
  const id=typeof c?.name==="string"&&c.name.startsWith("provider:")?c.name.slice(9):"";
  if(!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)||seen.has(id))continue;
  seen.add(id);
  const m=/^(\d+) tool\(s\); revision ([a-f0-9]{64})$/.exec(c.detail||"");
  providers.push({id,name:title(id),status:c.status==="pass"?"available":c.status==="warn"?"degraded":"unavailable",
   toolCount:m?Number(m[1]):null,revision:m?m[2]:null});
 }
 if(!providers.length)throw Error("No individual local providers were reported.");
 providers.sort((a,b)=>a.name.localeCompare(b.name));
 const expected=layer.metrics?.provider_count;
 return{providers,expected:Number.isSafeInteger(expected)?expected:null,
  collectedAt:report.sections.local.timestamp||report.collected_at,overall:report.sections.local.status};
}
function title(value){return String(value).split("-").map(s=>["mcp","cdp","api","ui"].includes(s)?s.toUpperCase():s[0]?.toUpperCase()+s.slice(1)).join(" ");}
function e(tag,cls,text){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=String(text);
 return el;
}
function append(parent,tag,cls,text){const el=e(tag,cls,text);parent.append(el);return el;}
function action(text,callback,{secondary=false,disabled=false}={}){
 const b=e("button","pv-detail-action"+(secondary?" secondary":""),text);
 b.type="button";b.disabled=disabled;b.addEventListener("click",callback);return b;
}
function field(label,value,opts={}){
 const wrap=e("label","pv-form-field");
 append(wrap,"span","pv-form-label",label);
 const el=opts.multiline?e("textarea","pv-input"):e("input","pv-input");
 if(!opts.multiline)el.type=opts.password?"password":"text";
 el.value=value??"";el.placeholder=opts.placeholder||"";
 el.autocomplete=opts.password?"new-password":"off";
 if(opts.password)el.autocapitalize="off";
 if(opts.maxLength)el.maxLength=opts.maxLength;
 if(opts.required)el.required=true;
 wrap.append(el);return {wrap,control:el};
}
function marker(label,status){
 const el=e("span","pv-tag",label);
 if(status)el.dataset.state=status;
 return el;
}
function header(target,label,name,symbol,description){
 append(target,"p","pv-detail-overline",label);
 const h=e("div","pv-detail-heading"),icon=e("span","pv-detail-mark",symbol),text=e("div");
 append(text,"h3","",name);append(text,"p","pv-detail-description",description);
 h.append(icon,text);target.append(h);
}
function pairs(target,rows){
 const dl=e("dl","pv-detail-grid");
 for(const [key,value] of rows){const r=e("div");append(r,"dt","",key);append(r,"dd","",value??"—");dl.append(r);}
 target.append(dl);
}
export function initColosseumProviders(){
 const root=document.getElementById("pv-root");if(!root||root.dataset.ready==="true")return;
 root.dataset.ready="true";
 const $=id=>document.getElementById(id);
 const list=$("pv-list"),detail=$("pv-detail"),status=$("pv-status"),search=$("pv-search"),
  remoteTab=$("pv-federated-tab"),localTab=$("pv-local-tab"),refresh=$("pv-refresh"),
  localCount=$("pv-local-count"),remoteCount=$("pv-cloud-count"),indexTitle=$("pv-index-title"),
  total=$("pv-index-total"),browser=$("pv-browser");
 const state={mode:"federated",selected:{federated:null,local:null},
  federated:[],local:[],details:new Map(),choices:FALLBACK_CHOICES,
  localRevision:null,busy:false,loadSeq:0,detailSeq:0,loaded:{federated:false,local:false},
  pending:null};
 const setStatus=(text,tone)=>{status.textContent=text;status.dataset.tone=tone||"info";};
 const active=()=>state.selected[state.mode];
 const items=()=>state[state.mode];
 const key=x=>state.mode==="federated"?x.uid:x.provider_id;
 const item=()=>items().find(x=>key(x)===active())||null;
 async function request(body,method="POST"){
  const opts={method,credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}};
  if(method!=="GET"){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(body);}
  const controller=new AbortController();opts.signal=controller.signal;
  const timer=setTimeout(()=>controller.abort(),65000);
  try{
   const response=await fetch(API,opts);
   if(!(response.headers.get("content-type")||"").includes("application/json"))
    throw Error("Colosseum owner verification is unavailable. Reconnect Cloudflare in Settings.");
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.error==="string"?data.error:"Provider operation failed (HTTP "+response.status+").");
   return data;
  }finally{clearTimeout(timer);}
 }
 const busy=async(fn)=>{
  if(state.busy)return;
  state.busy=true;refresh.disabled=true;
  try{return await fn();}catch(err){setStatus(err?.name==="AbortError"?"Provider operation timed out.":String(err?.message||err),"error");}
  finally{state.busy=false;refresh.disabled=false;}
 };
 function renderList(){
  list.replaceChildren();
  const term=search.value.trim().toLocaleLowerCase();
  const shown=items().filter(x=>(x.name||x.provider_id).toLocaleLowerCase().includes(term)||key(x).toLowerCase().includes(term));
  total.textContent=String(shown.length);
  for(const x of shown){
   const id=key(x),selected=active()===id;
   const b=e("button","pv-provider-item"+(selected?" is-active":""));b.type="button";b.dataset.providerId=id;
   b.setAttribute("aria-pressed",String(selected));b.append(e("span","pv-provider-icon",(x.name||id)[0].toUpperCase()));
   const copy=e("span");
   append(copy,"strong","",x.name||title(id));
   append(copy,"small","",state.mode==="federated"?(x.status==="connected"?"Connected":x.status==="pending"?"Pending verification":x.status==="disconnected"?"Not connected":"Registered")+" · "+x.uid:
      (x.available?"Gateway available":"Unavailable")+" · "+x.tool_count+" tools");
   b.append(copy,e("span","pv-chevron","›"));
   b.addEventListener("click",()=>{
    state.selected[state.mode]=id;state.pending=null;
    renderList();renderDetails();
   });list.append(b);
  }
  if(!shown.length)list.append(e("p","pv-empty-list",state.loaded[state.mode]?
   "No providers match the current filter.":"Retrieving provider data…"));
 }
 function changeMode(mode){
  if(state.mode===mode)return;
  state.mode=mode;state.pending=null;search.value="";
  render();
  if(!state.loaded[mode])void load(mode);
 }
 function render(){
  remoteTab.classList.toggle("active",state.mode==="federated");
  localTab.classList.toggle("active",state.mode==="local");
  remoteTab.setAttribute("aria-selected",String(state.mode==="federated"));
  localTab.setAttribute("aria-selected",String(state.mode==="local"));
  browser.setAttribute("aria-labelledby",state.mode==="federated"?"pv-federated-tab":"pv-local-tab");
  indexTitle.textContent=state.mode==="federated"?"Federated connections":"Local provider contracts";
  refresh.querySelector("span").textContent="Refresh";
  renderList();renderDetails();
 }
 async function load(mode){
  const seq=++state.loadSeq;
  await busy(async()=>{
   setStatus(mode==="local"?"Reading current Mac provider contracts…":"Loading Colosseum connection states…");
   const result=await request(mode==="local"?{action:"local.list"}:null,mode==="local"?"POST":"GET");
   if(seq!==state.loadSeq)return;
   if(mode==="federated"){
    state.federated=Array.isArray(result.providers)?result.providers:[];
    remoteCount.textContent=state.federated.length+" registered";
   }else{
    if(!/^[a-f0-9]{64}$/.test(result.revision)||!Array.isArray(result.providers))
     throw Error("The local gateway did not return an authoritative provider contract.");
    state.local=result.providers.map(x=>{
     if(typeof x.name!=="string"||!x.name.trim()||/^Local\s/i.test(x.name)||
        !["self","official","third_party"].includes(x.author)||
        x.profile?.author!==x.author)
       throw Error("Provider identity or author metadata was not verified upstream.");
     return {...x,name:x.name};
    });
    state.choices=result.choices||FALLBACK_CHOICES;
    state.localRevision=result.revision;
    localCount.textContent=state.local.length+" registered";
   }
   state.loaded[mode]=true;
   if(!itemsFor(mode).some(x=>(mode==="local"?x.provider_id:x.uid)===state.selected[mode]))
    state.selected[mode]=itemsFor(mode)[0]&&(mode==="local"?itemsFor(mode)[0].provider_id:itemsFor(mode)[0].uid);
   if(state.mode===mode){render();setStatus(mode==="federated"?
     "Federated connection states are read from the Colosseum vault and account grants.":
     "Local profiles and effective gateway status were read directly from the independent registry.");}
  });
 }
 function itemsFor(mode){return state[mode];}
 async function details(uid){
  const seq=++state.detailSeq;
  try{
   const data=await request({action:"detail",uid});
   if(seq!==state.detailSeq||state.mode!=="federated"||state.selected.federated!==uid)return;
   state.details.set(uid,data);renderDetails();
  }catch(err){if(seq===state.detailSeq){setStatus(String(err?.message||err),"error");}}
 }
 function reloadAfter(actionName){
  return busy(async()=>{
   const mode=state.mode,uid=active();
   const data=await request(actionName);
   if(data?.status==="rejected"||data?.status==="error")throw Error(data.error||data.summary||"Permission operation rejected");
   if(mode==="federated"){
    state.details.delete(uid);
    state.loaded.federated=false;
    state.busy=false;await load("federated");state.busy=true;
    if(state.selected.federated===uid)await details(uid);
   }
   setStatus("Colosseum confirmed the change. Current grants and connection states were refreshed.");
  });
 }
 function renderDetails(){
  detail.replaceChildren();detail.classList.remove("is-changing");void detail.offsetWidth;detail.classList.add("is-changing");
  const selected=item();
  if(!selected){
   append(detail,"p","pv-inspector-placeholder",
    state.loaded[state.mode]?"No provider is selected.":"Retrieving authorized provider information…");
   return;
  }
  if(state.mode==="local"){localDetail(selected);return;}
  const remote=state.details.get(selected.uid);
  if(!remote){
   append(detail,"p","pv-inspector-placeholder","Loading connection details and live tool grants…");
   void details(selected.uid);return;
  }
  remoteDetail(remote);
 }
 function remoteDetail(d){
  header(detail,"FEDERATED CONNECTION",d.name,(d.name||"?")[0],
   d.kind==="builtin"?"Native, read-only cloud adapter; authorization is per tool.":
    "Hosted MCP connection managed by your existing Colosseum credential vault.");
  const tags=e("div","pv-detail-state");
  tags.append(marker(d.status==="connected"?"Connected":d.status==="pending"?"Verification pending":"Not connected",
   d.status==="connected"?"available":d.status==="pending"?"": "unavailable"));
  tags.append(marker((d.tools||[]).filter(t=>t.approved_effect).length+" authorized tools"));
  detail.append(tags);
  pairs(detail,[["Source UID",d.uid],["Connection",d.kind||"Not connected"],
   ["Approval policy","Per tool"],["Expires",d.expires_at?new Date(d.expires_at).toLocaleString():"Not reported"]]);
  if(d.kind!=="builtin"){
   const section=e("section","pv-detail-section");
   append(section,"h4","","Connection");
   if(d.uid==="000008"){
    append(section,"p","","Penpot accepts an MCP Key or the complete official hosted MCP Server URL. Keys are verified before replacing any existing connection.");
    const form=e("form","pv-provider-form"),keyField=field("Penpot MCP Key","",{password:true,placeholder:"Paste MCP Key"}),
     urlField=field("Alternatively, Penpot MCP Server URL","",{placeholder:"https://design.penpot.app/mcp/stream?userToken=…"});
    form.append(keyField.wrap,urlField.wrap);
    const submit=e("button","pv-detail-action",d.status==="connected"?"Replace verified key":"Save & verify key");submit.type="submit";form.append(submit);
    form.addEventListener("submit",event=>{event.preventDefault();
     if(!confirm("Verify and save this Penpot credential? Existing tool approvals will be revoked on replacement."))return;
     void reloadAfter({action:"key",uid:d.uid,api_key:keyField.control.value,server_url:urlField.control.value});
     keyField.control.value="";urlField.control.value="";
    });
    section.append(form);
    if(d.status==="pending")section.append(action("Verify saved key",()=>void reloadAfter({action:"verify",uid:d.uid}),{secondary:true}));
   }else{
    const form=e("form","pv-provider-form"),cfg=d.oauth||{};
    append(form,"p","", "Configure OAuth on the source provider, then authorize its use here. Updating configuration disconnects the previous authorization.");
    const schema=[
     ["Client ID","client_id"],["Authorization URL","authorize_url"],["Token URL","token_url"],
     ["Issuer URL (optional)","issuer"],["Resource URL (optional)","resource_url"],
     ["Revocation URL (optional)","revocation_url"],["Scopes (space-delimited)","scopes"]];
    const controls={};
    for(const [label,k] of schema){const input=field(label,k==="scopes"?(cfg.scopes||[]).join(" "):cfg[k]||"",{maxLength:k==="client_id"?256:2048});
      form.append(input.wrap);controls[k]=input.control;}
    const typeWrap=e("label","pv-form-field");append(typeWrap,"span","pv-form-label","Client authentication");
    const authSelect=e("select","pv-input");
    for(const method of ["none","client_secret_post","client_secret_basic"]){const option=e("option","",method);option.value=method;authSelect.append(option);}
    authSelect.value=cfg.client_auth_method||"none";typeWrap.append(authSelect);form.append(typeWrap);
    const secret=field(cfg.client_secret_configured?"Client secret (leave blank to retain existing)":"Client secret","",{password:true});
    form.append(secret.wrap);
    const submit=e("button","pv-detail-action","Save OAuth configuration");submit.type="submit";form.append(submit);
    form.addEventListener("submit",event=>{event.preventDefault();
      if(!confirm("Save OAuth configuration? Existing connection and tool approvals will be revoked."))return;
      const values={};for(const [key,control] of Object.entries(controls))values[key]=control.value.trim();
      values.scopes=values.scopes?values.scopes.split(/\s+/):[];
      values.client_auth_method=authSelect.value;values.client_secret=secret.control.value;
      void reloadAfter({action:"configure",uid:d.uid,config:values});
      secret.control.value="";
    });
    section.append(form);
    if(cfg.client_id&&cfg.authorize_url)section.append(action("Authorize with provider",()=>void authorize(d.uid)));
   }
   if(d.status==="connected"){
    section.append(action("Disconnect & revoke credentials",()=>{
     if(confirm("Disconnect "+d.name+"? This revokes saved credentials and every tool approval."))
       void reloadAfter({action:"disconnect",uid:d.uid});
    },{secondary:true}));
    if(d.kind==="oauth")section.append(action("Refresh OAuth token",()=>void reloadAfter({action:"refresh",uid:d.uid}),{secondary:true}));
   }
   detail.append(section);
  }
  const section=e("section","pv-detail-section");
  append(section,"h4","","Tools & authorization");
  append(section,"p","","Each approval changes the actual Colosseum invocation grant. Unapproved tools remain unavailable to clients.");
  if(d.tool_error)append(section,"p","pv-form-error","Discovery unavailable: "+d.tool_error);
  if(!(d.tools||[]).length)append(section,"p","",d.status==="connected"?"No discoverable tools were returned.":"Connect or verify the provider to discover its tools.");
  for(const tool of d.tools||[]){
   const entry=e("div","pv-tool-entry"),row=e("div","pv-tool-heading");
   const title=e("div");append(title,"strong","",tool.name);
   append(title,"span","pv-tool-effect",tool.readOnly?"Provider reports read-only":"May modify external data");
   row.append(title,marker(tool.approved_effect?"Approved: "+tool.approved_effect:"Not approved",tool.approved_effect?"available":""));
   entry.append(row);
   if(tool.description)append(entry,"p","",tool.description);
   entry.append(action(tool.approved_effect?"Revoke tool":"Approve "+(tool.readOnly?"read":"write")+" access",()=>{
     const granting=!tool.approved_effect;
     if(granting&&!confirm("Authorize "+tool.name+"? "+(tool.readOnly?"Read-only":"This tool may modify external data.")+" The grant takes effect immediately."))return;
     void reloadAfter({action:granting?"grant":"revoke",uid:d.uid,tool:tool.name,...(granting?{effect:tool.readOnly?"read":"write"}:{})});
   },{secondary:!!tool.approved_effect}));
   section.append(entry);
  }
  detail.append(section);
 }
 async function authorize(uid){
  await busy(async()=>{
   const data=await request({action:"oauth_start",uid});
   if(typeof data.authorize_url!=="string")throw Error("OAuth authorization did not return a URL.");
   const u=new URL(data.authorize_url);
   if(u.protocol!=="https:")throw Error("OAuth authorization endpoint is not HTTPS.");
   window.location.assign(u.href);
  });
 }
 function localDetail(p){
  header(detail,"LOCAL / INDEPENDENT PERMISSION CONTRACT",p.name,(p.name||"?")[0],
   "Registered Mac provider. Contract changes take effect in the actual local gateway after confirmed application.");
  const tags=e("div","pv-detail-state");
  tags.append(marker(p.available?"Gateway available":"Gateway unavailable",p.available?"available":"unavailable"));
  tags.append(marker(p.configured?"Independent profile present":"Not configured"));
  detail.append(tags);
  pairs(detail,[["Provider ID",p.provider_id],["Connection type",p.connection_type],
   ["Author",p.author],["Discovered tool count",p.tool_count],["Registry revision",state.localRevision?.slice(0,18)+"…"]]);
  const section=e("section","pv-detail-section");
  append(section,"h4","","Provider-specific regulation");
  append(section,"p","","These five fields are the authoritative provider-specific local permission ceiling. The persistent local Colosseum Permissions authority controls filesystem and script execution. A reviewed profile cannot automatically approve unclassified upstream tools.");
  if(!p.configured||!p.profile){
   append(section,"p","pv-form-error","The independent registry does not contain a profile for this provider. No editing is permitted.");
   detail.append(section);return;
  }
  const form=e("form","pv-provider-form"),controls={};
  for(const k of FIELDS){
   const label=e("label","pv-form-field");
   append(label,"span","pv-form-label",title(k));
   const select=e("select","pv-input");
   for(const v of state.choices[k]||FALLBACK_CHOICES[k]){
    const op=e("option","",v);op.value=v;select.append(op);
   }
   select.value=p.profile[k];
   if(k==="connection")select.disabled=true;
   label.append(select);form.append(label);controls[k]=select;
  }
  const save=e("button","pv-detail-action","Review permission change");save.type="submit";form.append(save);
  form.addEventListener("submit",event=>{
   event.preventDefault();
   const profile={...Object.fromEntries(FIELDS.map(k=>[k,controls[k].value])),author:p.profile.author};
   if(FIELDS.every(k=>profile[k]===p.profile[k])){setStatus("No permission fields have changed.");return;}
   void prepareLocal(p.provider_id,profile);
  });
  section.append(form);
  if(state.pending?.provider_id===p.provider_id){
   const panel=e("div","pv-confirm-panel");
   append(panel,"strong","","Confirm effective provider permission change");
   append(panel,"p","","You are changing an independent provider profile. Existing gateway restrictions and locally enforced Permissions rules continue to apply. The prepared authorization expires shortly.");
   pairs(panel,FIELDS.map(k=>[title(k),state.pending.profile[k]]));
   panel.append(action("Apply confirmed change",()=>void commitLocal(),{}));
   panel.append(action("Cancel",()=>{state.pending=null;renderDetails();},{secondary:true}));
   section.append(panel);
  }
  detail.append(section);
  mountLocalProviderProvisions({provider:p,container:detail,request,notify:(message,tone)=>setStatus(message,tone)});
 }
 async function prepareLocal(provider_id,profile){
  await busy(async()=>{
   if(!state.localRevision)throw Error("Local contract revision is unavailable.");
   const result=await request({action:"local.prepare",uid:provider_id,profile,expected_revision:state.localRevision});
   if(result.status!=="prepared"||!result.receipt)throw Error(result.error||"Local gateway rejected the proposed change.");
   state.pending={provider_id,profile,receipt:result.receipt};
   renderDetails();
   setStatus("The local gateway prepared this revision-bound change. Review and explicitly confirm it.");
  });
 }
 async function commitLocal(){
  const pending=state.pending;if(!pending)return;
  await busy(async()=>{
   state.pending=null;
   const reply=await request({action:"local.commit",receipt:pending.receipt});
   if(reply.status!=="completed")throw Error(reply.summary||"Local gateway did not apply the change.");
   const verified=await request({action:"local.list"});
   const actual=verified.providers?.find(x=>x.provider_id===pending.provider_id);
   if(!actual||FIELDS.some(k=>actual.profile?.[k]!==pending.profile[k]))
    throw Error("The gateway did not verify the requested effective provider profile.");
   state.local=verified.providers.map(x=>{if(!x.name||x.profile?.author!==x.author)throw Error("Provider author verification failed");return {...x,name:x.name};});
   invalidateLocalProviderProvisions(pending.provider_id);
   state.localRevision=verified.revision;state.choices=verified.choices||FALLBACK_CHOICES;
   renderList();renderDetails();
   setStatus("Local provider contract changed and verified against the authoritative registry.");
  });
 }
 remoteTab.addEventListener("click",()=>changeMode("federated"));
 localTab.addEventListener("click",()=>changeMode("local"));
 [remoteTab,localTab].forEach((tab,i)=>tab.addEventListener("keydown",ev=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(ev.key))return;
  ev.preventDefault();
  const idx=ev.key==="Home"?0:ev.key==="End"?1:(i+(ev.key==="ArrowRight"?1:-1)+2)%2;
  [remoteTab,localTab][idx].focus();changeMode(idx===0?"federated":"local");
 }));
 search.addEventListener("input",renderList);
 refresh.addEventListener("click",()=>void load(state.mode));
 function onRoute(){
  const active=!document.querySelector(ROUTE)?.hidden;
  if(active&&!state.loaded[state.mode]&&!state.busy)void load(state.mode);
 }
 window.addEventListener("hashchange",()=>window.queueMicrotask(onRoute));
 const url=new URL(location.href);
 const result=url.searchParams.get("providers_result"),error=url.searchParams.get("providers_error");
 if(result||error){
  setStatus(error?"OAuth authorization was not completed: "+error:"OAuth authorization "+result,error?"error":"info");
  url.searchParams.delete("providers_result");url.searchParams.delete("providers_error");
  history.replaceState(history.state,"",url.pathname+url.search+url.hash);
 }
 render();window.queueMicrotask(onRoute);
}
