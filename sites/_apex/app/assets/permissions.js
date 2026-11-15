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
 let state=null,working=false,pending=null,loadSeq=0,editingRow=null,decisionRevision=null;
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
   state=reply;closeRule();render();show(state.source==="local"&&state.policyCurrent?
    "The local permission authority is active and the gateway enforces its policy.":
    "The local permission authority is unavailable or stale; edits are disabled.",!(state.source==="local"&&state.policyCurrent));
  }catch(error){if(seq===loadSeq)show(error.message,true);}
 }

 const rowValues=item=>Array.isArray(item?.values)?item.values:[];
 const allRows=()=>Array.isArray(state?.rows)?state.rows:[];
 const pencil='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5 4 4 M4 20l4.5-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.5 16z"/></svg>';
 function ruleRow(item){
  const [enabled,alias,path,...bits]=rowValues(item);
  const label=alias||((String(path)==="/")?"/ (root)":String(path||"").split("/").filter(Boolean).at(-1))||"Unnamed path";
  const access=BITS.map((bit,i)=>{
   const granted=!!bits[i];
   const desc=(enabled?"":"Rule disabled; ")+bit+" "+(granted?"configured":"not granted");
   return '<span class="pm-permission-cell" role="img" title="'+esc(desc)+'" aria-label="'+esc(desc)+'">'+
    '<span class="pm-permission-mark" data-allowed="'+granted+'" aria-hidden="true">'+(granted?"✓":"–")+'</span></span>';
  }).join("");
  return '<div class="pm-rule-row" data-row="'+item.row+'" data-enabled="'+!!enabled+'">'+
   '<button class="pm-rule-main" type="button" data-edit-rule="'+item.row+'" title="Edit '+esc(label)+'" aria-label="Edit rule for '+esc(path)+'">'+
   '<span class="pm-rule-title">'+esc(label)+'</span><span class="pm-rule-path">'+esc(path)+'</span></button>'+
   '<div class="pm-operations">'+access+'</div>'+
   '<span class="pm-rule-status">'+(enabled?"Enabled":"Off")+'</span>'+
   '<button class="pm-edit-rule" type="button" data-edit-rule="'+item.row+'" title="Edit rule" aria-label="Edit filesystem rule '+esc(path)+'"'+(!canEdit()?' disabled':'')+'>'+pencil+'</button></div>';
 }
 function render(){
  if(!state)return;
  const rows=allRows(),local=state.source==="local",current=local&&state.policyCurrent===true;
  $("pm-source").textContent=current?"Local authority active":local?"Local policy out of date":"Local authority unavailable";
  $("pm-source").dataset.local=String(current);
  $("pm-revision").textContent=local?"Revision "+state.revision:"";
  $("pm-count").textContent=rows.length+" RULES / "+rows.filter(x=>!!rowValues(x)[0]).length+" ENABLED";
  $("pm-add").disabled=!canEdit();
  $("pm-pin-status").textContent=state.pinConfigured?"Hazard PIN configured":"Hazard PIN not configured";
  $("pm-pin-edit").disabled=!canEdit();
  $("pm-pin-settings").hidden=!local;
  $("pm-exec").hidden=!local;
  $("pm-lifecycle").hidden=!local||!state.lifecycle;
  $("pm-effective-submit").disabled=!local;
  if(decisionRevision!==null&&decisionRevision!==state.revision){
   $("pm-effective-result").hidden=true;decisionRevision=null;
  }
  const term=$("pm-filter").value.trim().toLowerCase();
  const visible=rows.filter(row=>(String(rowValues(row)[2]||"")+" "+String(rowValues(row)[1]||"")).toLowerCase().includes(term));
  $("pm-cards").innerHTML=visible.map(ruleRow).join("")||
   '<p class="pm-empty">'+(term?"No filesystem rules match this search.":"No filesystem rules configured.")+'</p>';
  if(local){
   $("pm-execution-fields").innerHTML=(state.executionFields||[]).map(f=>{
    const value=state.execution?.[f.key],bool=f.type==="boolean";
    const [scale,unit,step]=UNITS[f.key]||[1,"",1];
    const id="pm-exec-"+esc(f.key);
    const ctrl=bool?'<input id="'+id+'" data-exec-input type="checkbox"'+(value?' checked':'')+(!canEdit()?' disabled':'')+'>':
     '<input id="'+id+'" data-exec-input type="number" data-scale="'+scale+'" min="'+f.range[0]/scale+
     '" max="'+f.range[1]/scale+'" step="'+step+'" value="'+(Number(value)/scale)+'"'+(!canEdit()?' disabled':'')+'>';
    return '<div class="pm-exec-field" data-exec-key="'+esc(f.key)+'"><label for="'+id+'">'+esc(f.label)+'</label>'+ctrl+
     '<span class="pm-small">'+esc(unit)+'</span><button type="button" class="pm-btn" data-exec-save'+
     (!canEdit()?' disabled':'')+'>Save</button></div>';
   }).join("");
   $("pm-lifecycle-fields").innerHTML=(state.lifecycleFields||[]).map(f=>{
    const value=state.lifecycle?.[f.key],valid=Number.isSafeInteger(value);
    const id="pm-lifecycle-"+esc(f.key);
    return '<div class="pm-exec-field" data-lifecycle-key="'+esc(f.key)+'"><label for="'+id+'">'+esc(f.label)+'</label>'+
     '<input id="'+id+'" data-lifecycle-input type="number" min="'+f.range[0]+'" max="'+f.range[1]+
     '" step="60" value="'+(valid?value:'')+'"'+(!valid||!canEdit()?' disabled':'')+'>'+
     '<span class="pm-small">sec</span><button type="button" class="pm-btn" data-lifecycle-save'+
     (!canEdit()?' disabled':'')+'>Save</button></div>';
   }).join("");
  }
 }
 function closeRule(){
  if($("pm-rule-dialog").open)$("pm-rule-dialog").close();
  editingRow=null;
 }
 function openRule(row){
  if(!canEdit())return;
  const item=row===0?null:allRows().find(x=>Number(x.row)===Number(row));
  if(row!==0&&!item){show("The selected rule is no longer available.",true);return;}
  editingRow=row;
  const values=item?rowValues(item):[true,"","",false,false,false,false,false];
  $("pm-rule-title").textContent=item?"Edit filesystem rule":"Add filesystem rule";
  $("pm-rule-subtitle").textContent=item?"Rule "+row+" · policy revision "+state.revision:"New rule · policy revision "+state.revision;
  $("pm-rule-path").value=values[2]||"";
  $("pm-rule-alias").value=values[1]||"";
  $("pm-rule-enabled").checked=!!values[0];
  BITS.forEach((bit,i)=>{$("pm-rule-"+bit).checked=!!values[i+3];});
  $("pm-rule-remove").hidden=!item;
  $("pm-rule-save").textContent=item?"Save changes":"Add rule";
  $("pm-rule-dialog").showModal();
  $("pm-rule-path").focus();
 }
 function readRule(){
  return [$("pm-rule-enabled").checked,$("pm-rule-alias").value.trim(),$("pm-rule-path").value.trim(),
    ...BITS.map(bit=>$("pm-rule-"+bit).checked)];
 }
 async function prepare(data){
  if(!canEdit())return;
  working=true;
  try{
   const reply=await request("prepare",{revision:state.revision,...data});
   if(reply.unchanged){show("No changes to save.");return;}
   if(reply.applied){
    state=reply.state;closeRule();render();notify(reply.message||"Permissions updated");return;
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
   show(error.message,true);closeRule();await load().catch(()=>{});
  }finally{working=false;render();}
 }
 let timer=null;
 function notify(message){
  const toast=$("pm-toast");toast.textContent=message;toast.hidden=false;
  clearTimeout(timer);timer=setTimeout(()=>toast.hidden=true,3000);
 }

 $("pm-cards").addEventListener("click",event=>{
  const b=event.target.closest("[data-edit-rule]");
  if(b)openRule(Number(b.dataset.editRule));
 });
 $("pm-filter").addEventListener("input",render);
 $("pm-add").addEventListener("click",()=>openRule(0));
 $("pm-rule-close").addEventListener("click",closeRule);
 $("pm-rule-cancel").addEventListener("click",closeRule);
 $("pm-rule-dialog").addEventListener("close",()=>{editingRow=null;});
 $("pm-rule-form").addEventListener("submit",event=>{
  event.preventDefault();
  if(editingRow===null||!canEdit()||!$("pm-rule-form").reportValidity())return;
  void prepare({kind:"filesystem",row:editingRow,values:readRule()});
 });
 $("pm-rule-remove").addEventListener("click",()=>{
  if(editingRow!==null&&editingRow!==0&&canEdit())
   void prepare({kind:"filesystem",row:editingRow,remove:true});
 });
 $("pm-execution-fields").addEventListener("click",event=>{
  const b=event.target.closest("[data-exec-save]");if(!b)return;
  const line=b.closest("[data-exec-key]"),input=line.querySelector("[data-exec-input]"),key=line.dataset.execKey;
  if(!canEdit()||!input.checkValidity()||(input.type==="number"&&(input.value.trim()===""||!Number.isFinite(Number(input.value))))){
   show("Enter a valid execution limit.",true);return;
  }
  const value=input.type==="checkbox"?input.checked:Math.round(Number(input.value)*Number(input.dataset.scale||1));
  void prepare({kind:"execution",key,value});
 });
 $("pm-lifecycle-fields").addEventListener("click",event=>{
  const button=event.target.closest("[data-lifecycle-save]");
  if(!button)return;
  const line=button.closest("[data-lifecycle-key]"),input=line.querySelector("[data-lifecycle-input]");
  const value=Number(input.value);
  if(!canEdit()||input.value.trim()===""||!Number.isSafeInteger(value)||!input.checkValidity()){show("Enter a valid idle duration in seconds.",true);return;}
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
   pending=null;state=reply.state;$("pm-confirm").close();closeRule();render();
   show("The local gateway applied the confirmed policy revision.");
  }catch(error){$("pm-confirm-error").textContent=error.message;}
  finally{working=false;render();}
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


 // Inspect the effective authorization through the gateway, never via a
 // client-side reimplementation of path precedence.
 const resetDecision=()=>{$("pm-effective-result").hidden=true;decisionRevision=null;};
 $("pm-effective-form").addEventListener("input",resetDecision);
 $("pm-effective-form").addEventListener("change",resetDecision);
 $("pm-effective-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=$("pm-effective-submit"),out=$("pm-effective-result");
  const form=event.currentTarget;
  const path=form.elements.namedItem("path").value.trim();
  const operation=form.elements.namedItem("operation").value;
  if(!path||!state||state.source!=="local")return;
  button.disabled=true;out.hidden=false;out.dataset.verdict="";
  $("pm-effective-verdict").textContent="Checking…";
  $("pm-effective-meta").textContent="";
  $("pm-effective-reason").textContent="Consulting the active gateway.";
  try{
   const data=await request("explain",{path,operation}),d=data.decision||{};
   decisionRevision=data.revision??null;
   out.dataset.verdict=d.allowed===true?"allowed":"denied";
   $("pm-effective-verdict").textContent=d.allowed===true?"Allowed":"Denied";
   $("pm-effective-meta").textContent="Operation: "+operation+" · Revision "+(data.revision??"unknown");
   $("pm-effective-reason").textContent="Resolved path: "+(d.target||path)+"\n"+
    "Reason: "+(d.reason||"No explanatory reason returned")+"\n"+
    "Winning rule: "+(d.policyRule?.path||"None");
  }catch(error){
   out.dataset.verdict="error";$("pm-effective-verdict").textContent="Unable to check";
   $("pm-effective-meta").textContent="";
   $("pm-effective-reason").textContent=String(error.message||error);
  }finally{button.disabled=!state||state.source!=="local";}
 });
 document.addEventListener("keydown",event=>{
  if(!routeActive()||!event.metaKey||!event.shiftKey||event.altKey||event.key.toLowerCase()!=="n"||
     event.target.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]')||
     root.querySelector("dialog[open]"))return;
  event.preventDefault();openRule(0);
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
