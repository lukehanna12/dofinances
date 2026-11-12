const API="/api/colosseum/permissions";
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const MIB=1048576,GIB=1073741824;
const UNITS={
 runtime_limit_ms:[60000,"min",1],milestone_limit_ms:[60000,"min",1],
 heartbeat_interval_ms:[1000,"sec",5],input_limit_bytes:[MIB,"MiB",1],output_limit_bytes:[MIB,"MiB",1],
 cpu_percent_limit:[1,"%",25],memory_limit_bytes:[GIB,"GiB",0.25],scratch_limit_bytes:[MIB,"MiB",16],
 cleanup_ttl_ms:[3600000,"hr",1],history_ttl_ms:[3600000,"hr",1],custom_directive_ttl_ms:[3600000,"hr",1],
 cleanup_ceiling_bytes:[MIB,"MiB",8],history_ceiling_bytes:[MIB,"MiB",1],
 custom_directive_ceiling_bytes:[MIB,"MiB",0.0625]
};
const BITS=["read","write","script","add","delete"];
export function initColosseumPermissions(){
 const root=document.getElementById("pm-root");
 if(!root||root.dataset.ready==="true")return;
 root.dataset.ready="true";
 let state=null,working=false,pending=null,loadSeq=0,loaded=false;
 const $=id=>root.querySelector("#"+id);
 const show=(message,error=false)=>{const n=$("pm-notice");n.textContent=message||"";n.dataset.error=error?"true":"false";};
 const canEdit=()=>state?.source==="local"&&state.policyCurrent===true&&!working;
 async function request(action,data={},method="POST"){
  const opts={method,cache:"no-store",credentials:"same-origin",headers:{Accept:"application/json"}};
  if(method==="POST"){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify({action,...data});}
  const abort=new AbortController();opts.signal=abort.signal;
  const timer=setTimeout(()=>abort.abort(),25000);
  try{
   const response=await fetch(API,opts);
   if(!(response.headers.get("content-type")||"").includes("application/json"))
    throw Error("Cloudflare owner verification is required. Connect Colosseum from Settings, then return here.");
   const body=await response.json();
   if(!response.ok||body.ok!==true)throw Error(body.error||"Permission operation failed (HTTP "+response.status+").");
   return body;
  }finally{clearTimeout(timer);}
 }
 async function load(){
  const seq=++loadSeq;
  show("Reading the local gateway's effective permissions…");
  try{
   const reply=await request("status",{},"GET");
   if(seq!==loadSeq)return;
   state=reply;loaded=true;render();show(state.source==="local"&&state.policyCurrent?
    "The local permission authority is active and the gateway enforces its policy.":
    "The local permission authority is unavailable or stale; edits are disabled.",!(state.source==="local"&&state.policyCurrent));
  }catch(error){if(seq===loadSeq)show(error.message,true);}
 }
 const toggle=(name,checked,disabled=false)=>'<label class="pm-switch" title="'+esc(name)+'"><input type="checkbox" data-bit="'+esc(name)+'"'+
  (checked?' checked':'')+(disabled?' disabled':'')+'><span class="pm-track" aria-hidden="true"></span></label>';
 function pathCard(item){
  const [active,alias,location,...bits]=item.values,row=item.row;
  const label=location==="/"?"/ (root)":location.split("/").filter(Boolean).at(-1)||"Unnamed path";
  const disable=!canEdit();
  return '<article class="pm-access-frame" data-row="'+row+'"><div class="pm-access-inner">'+
   '<div class="pm-card-top"><div><h3>'+esc(label)+'</h3><span class="pm-small">Path rule '+row+'</span></div>'+
   '<span class="pm-tag '+(active?'pm-tag-on':'')+'">'+(active?"Active":"Dormant")+'</span></div>'+
   '<div class="pm-fields"><label>Filesystem path<input data-field="path" spellcheck="false" value="'+esc(location)+'"'+(disable?' disabled':'')+'></label>'+
   '<label>Env Var alias<input data-field="alias" spellcheck="false" value="'+esc(alias)+'" placeholder="Optional alias"'+(disable?' disabled':'')+'></label></div>'+
   '<div class="pm-perm-line"><span>Enabled</span>'+toggle("enabled",active,disable)+'</div>'+
   BITS.map((name,i)=>'<div class="pm-perm-line"><span>'+name[0].toUpperCase()+name.slice(1)+'</span>'+toggle(name,bits[i],disable)+'</div>').join("")+
   '<div class="pm-card-actions"><button type="button" data-card-action="remove" class="pm-btn pm-remove"'+(disable?' disabled':'')+'>Remove</button>'+
   '<button type="button" data-card-action="save" class="pm-btn pm-primary"'+(disable?' disabled':'')+'>Save changes</button></div></div></article>';
 }
 function render(){
  if(!state)return;
  const active=state.source==="local";
  $("pm-source").textContent=active?"Independent local authority":"Local authority unavailable";
  $("pm-source").dataset.local=active?"true":"false";
  $("pm-revision").textContent=active?"Revision "+state.revision:"Legacy authorization";
  $("pm-count").textContent=(state.rows?.filter(x=>x.values[0]).length||0)+" active · "+(state.rows?.length||0)+" configured";
  $("pm-pin-status").textContent=state.pinConfigured?"Hazard PIN configured":"Hazard PIN not configured";
  $("pm-pin-edit").disabled=!active;
  $("pm-add-form").querySelectorAll("input,button").forEach(input=>input.disabled=!active);
  $("pm-exec").hidden=!active;
  $("pm-lifecycle").hidden=!active||!state.lifecycle;
  const term=$("pm-filter").value.trim().toLowerCase();
  const visible=state.rows.filter(row=>(row.values[2]+" "+row.values[1]).toLowerCase().includes(term));
  $("pm-cards").innerHTML=visible.map(pathCard).join("")||'<p class="pm-quiet">No paths match this search.</p>';
  if(active){
   $("pm-execution-fields").innerHTML=state.executionFields.map(f=>{
    const value=state.execution[f.key],bool=f.type==="boolean";
    const [scale,unit,step]=UNITS[f.key]||[1,"",1];
    const ctrl=bool?'<input data-exec-input type="checkbox"'+(value?' checked':'')+'>':
     '<input data-exec-input type="number" data-scale="'+scale+'" min="'+f.range[0]/scale+
     '" max="'+f.range[1]/scale+'" step="'+step+'" value="'+value/scale+'">';
    return '<div class="pm-exec-field" data-exec-key="'+esc(f.key)+'"><label>'+esc(f.label)+'</label>'+ctrl+
     (unit?'<span class="pm-small">'+unit+'</span>':'')+
     '<button type="button" class="pm-btn" data-exec-save>Save</button></div>';
   }).join("");
   $("pm-lifecycle-fields").innerHTML=(state.lifecycleFields||[]).map(f=>{
    const value=state.lifecycle?.[f.key],valid=Number.isSafeInteger(value);
    return '<div class="pm-exec-field" data-lifecycle-key="'+esc(f.key)+'"><label>'+esc(f.label)+'</label>'+
     '<input data-lifecycle-input type="number" min="'+f.range[0]+'" max="'+f.range[1]+
     '" step="60" value="'+(valid?value:'')+'"'+(!valid?' disabled':'')+'>'+
     '<span class="pm-small">seconds</span><button type="button" class="pm-btn" data-lifecycle-save'+
     (!canEdit()?' disabled':'')+'>Save</button></div>';
   }).join("");
  }
 }
 function readCard(card){
  const input=key=>card.querySelector('[data-field="'+key+'"]');
  const bit=key=>card.querySelector('[data-bit="'+key+'"]').checked;
  return [bit("enabled"),input("alias").value.trim(),input("path").value.trim(),...BITS.map(bit)];
 }
 async function prepare(data){
  if(!canEdit())return;
  working=true;
  try{
   const reply=await request("prepare",{revision:state.revision,...data});
   if(reply.unchanged){show("No changes to save.");return;}
   if(reply.applied){
    state=reply.state;render();notify(reply.message||"Permissions updated");return;
   }
   pending=reply;
   $("pm-confirm-kind").textContent=reply.severity==="hazard"?"Hazardous change":reply.severity==="warning"?"Warning":"Confirmation";
   $("pm-confirm-title").textContent=reply.title;
   $("pm-confirm-copy").textContent=reply.message;
   $("pm-confirm-pin-label").hidden=!reply.requiresPin;
   $("pm-confirm-pin").value="";
   $("pm-confirm-apply").disabled=!!reply.requiresPin;
   $("pm-confirm-apply").textContent=reply.severity==="hazard"?"Apply change":reply.severity==="warning"?"Continue":"Confirm";
   $("pm-confirm-error").textContent="";
   $("pm-confirm").showModal();
  }catch(error){
   show(error.message,true);await load().catch(()=>{});
  }finally{working=false;}
 }
 let timer=null;
 function notify(message){
  const toast=$("pm-toast");toast.textContent=message;toast.hidden=false;
  clearTimeout(timer);timer=setTimeout(()=>toast.hidden=true,3000);
 }
 $("pm-cards").addEventListener("click",event=>{
  const button=event.target.closest("[data-card-action]");
  if(!button)return;
  const card=button.closest("[data-row]"),row=Number(card.dataset.row);
  if(button.dataset.cardAction==="remove")void prepare({kind:"filesystem",row,remove:true});
  else void prepare({kind:"filesystem",row,values:readCard(card)});
 });
 $("pm-filter").addEventListener("input",render);
 $("pm-add-form").addEventListener("submit",event=>{
  event.preventDefault();
  const values=[$("pm-add-enabled").checked,$("pm-new-alias").value.trim(),$("pm-new-path").value.trim(),
   ...BITS.map(key=>$("pm-add-"+key).checked)];
  void prepare({kind:"filesystem",row:0,values});
 });
 $("pm-execution-fields").addEventListener("click",event=>{
  const b=event.target.closest("[data-exec-save]");if(!b)return;
  const line=b.closest("[data-exec-key]"),input=line.querySelector("[data-exec-input]"),key=line.dataset.execKey;
  const value=input.type==="checkbox"?input.checked:Math.round(Number(input.value)*Number(input.dataset.scale||1));
  void prepare({kind:"execution",key,value});
 });
 $("pm-lifecycle-fields").addEventListener("click",event=>{
  const button=event.target.closest("[data-lifecycle-save]");
  if(!button)return;
  const line=button.closest("[data-lifecycle-key]"),input=line.querySelector("[data-lifecycle-input]");
  const value=Number(input.value);
  if(!Number.isSafeInteger(value)||!input.checkValidity()){show("Enter a valid idle duration in seconds.",true);return;}
  void prepare({kind:"lifecycle",key:line.dataset.lifecycleKey,value});
 });
 $("pm-confirm-pin").addEventListener("input",event=>{$("pm-confirm-apply").disabled=!/^[0-9]{4}$/.test(event.target.value)});
 async function cancel(){
  $("pm-confirm").close();
  const old=pending;pending=null;
  if(old)try{await request("cancel",{token:old.token});}catch{}
 }
 $("pm-confirm-cancel").addEventListener("click",()=>void cancel());
 $("pm-confirm").addEventListener("cancel",event=>{event.preventDefault();void cancel();});
 $("pm-confirm-apply").addEventListener("click",async()=>{
  if(!pending||working)return;working=true;
  try{
   const reply=await request("confirm",{token:pending.token,pin:$("pm-confirm-pin").value});
   pending=null;state=reply.state;$("pm-confirm").close();render();
   show("The local gateway applied the confirmed policy revision.");
  }catch(error){$("pm-confirm-error").textContent=error.message;}
  finally{working=false;}
 });
 $("pm-pin-edit").addEventListener("click",()=>{
  $("pm-pin-current").value="";$("pm-pin-new").value="";$("pm-pin-error").textContent="";$("pm-pin-dialog").showModal();
 });
 $("pm-pin-cancel").addEventListener("click",()=>$("pm-pin-dialog").close());
 $("pm-pin-save").addEventListener("click",async()=>{
  try{const reply=await request("set_pin",{pin:$("pm-pin-new").value,currentPin:$("pm-pin-current").value});
   state=reply;$("pm-pin-dialog").close();render();notify("Hazard PIN updated.");
  }catch(error){$("pm-pin-error").textContent=error.message;}
 });
 $("pm-refresh").addEventListener("click",()=>void load());

 // Non-provider-specific live authority inspector: answers from the gateway,
 // never by reimplementing filesystem rule precedence in the browser.
 const inspector=document.createElement("section");
 inspector.className="pm-effective-inspector";
 inspector.innerHTML='<div class="pm-effective-title"><div><h3>Effective local-work access</h3><p>Ask the active gateway which rule governs a filesystem or execution operation.</p></div></div>'+
  '<form class="pm-effective-form"><label>Absolute path<input name="path" type="text" spellcheck="false" placeholder="/Users/…/project" required></label>'+
  '<label>Operation<select name="operation">'+["read","write","add","delete","write_or_add","execute"].map(x=>'<option value="'+x+'">'+x.replace("_"," ")+'</option>').join("")+'</select></label>'+
  '<button type="submit" class="pm-btn pm-primary">Explain effective permission</button></form>'+
  '<pre class="pm-effective-result" aria-live="polite"></pre>';
 root.append(inspector);
 inspector.querySelector("form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),result=inspector.querySelector(".pm-effective-result");
  const path=form.elements.namedItem("path").value.trim();
  const operation=form.elements.namedItem("operation").value;
  button.disabled=true;result.textContent="Consulting the active Permissions authority…";
  try{
   const data=await request("explain",{path,operation});
   const d=data.decision||{};
   result.textContent=[
    d.allowed?"ALLOWED":"DENIED",
    "Operation: "+operation,
    "Resolved path: "+(d.target||path),
    "Reason: "+(d.reason||"No explanatory reason returned"),
    "Winning rule: "+(d.policyRule?.path||"None"),
    "Authority revision: "+(data.revision??"unknown")
   ].join("\n");
  }catch(err){result.textContent=String(err.message||err);}
  finally{button.disabled=false;}
 });
 const routeActive=()=>{
  const hash=location.hash.replace(/^#/,"").replace(/\/$/,"").toLowerCase();
  return hash?hash==="colosseum/permissions":
    location.pathname.replace(/\/+$/,"").toLowerCase()==="/app/colosseum/permissions";
 };
 window.addEventListener("hashchange",()=>{if(routeActive())void load();});
 if(routeActive())void load();
 else show("Open Permissions to load live gateway policy.");
}
