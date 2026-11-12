/* Live, source-derived Colosseum provider controls. The upstream MCP, not this
 * interface, defines the available tools, resource templates, and prompts. */
import {mountProviderAdapterControl} from "./provider-adapters.js";
import {mountGhidraLifecycle} from "./provider-ghidra-lifecycle.js";
const cache=new Map(),loading=new Map(),editors=new Map(),filters=new Map(),pending=new Map();
const FIELDS=["targets","targetArrays","readTargetArrays","sourceTargets","destinationTargets","forbiddenFields","effectTargets"];
const CHECKS=["openWorld","filesystemSensitive","scriptSensitive","destructive","allowTargetless"];
const OPERATIONS=["read","write","add","delete","write_or_add","move","execute"];
const node=(tag,cls,content)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(content!==undefined)el.textContent=String(content);
 return el;
};
const add=(parent,tag,cls,value)=>{const child=node(tag,cls,value);parent.append(child);return child;};
const button=(title,fn,secondary=false)=>{
 const b=node("button","pv-provision-button"+(secondary?" is-secondary":""),title);
 b.type="button";b.addEventListener("click",fn);return b;
};
const trimArray=text=>String(text||"").split(",").map(s=>s.trim()).filter(Boolean);
const pretty=s=>String(s).replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").replace(/^./,c=>c.toUpperCase());
export function invalidateLocalProviderProvisions(provider_id){cache.delete(provider_id);}
export function mountLocalProviderProvisions({provider,container,request,notify}){
 const id=provider.provider_id;
 const region=add(container,"section","pv-provision-section");
 if(provider.author==="self"){
  add(region,"p","pv-provision-intro","This separately maintained provider has its own authorization controls.");
  return;
 }
 async function load(force=false){
  if(loading.has(id))return loading.get(id);
  if(force)cache.delete(id);
  const task=(async()=>{
   try{
    const data=await request({action:"local.surface",uid:id});
    if(data.provider_id!==id||!Array.isArray(data.tools)||!/^[a-f0-9]{64}$/.test(data.provisions_revision))
     throw Error("The local provider did not supply a valid live upstream catalog.");
    cache.set(id,{data,error:null});
   }catch(error){cache.set(id,{data:null,error:String(error.message||error)});}
   finally{loading.delete(id);if(region.isConnected)draw();}
  })();
  loading.set(id,task);return task;
 }
 function draw(){
  region.replaceChildren();
  const head=add(region,"div","pv-provision-head");
  const text=node("div");add(text,"h4","","Discovered upstream provisions");
  add(text,"p","pv-provision-intro","Capabilities are read from the connected MCP server. Rules edited here are applied to the running gateway, not merely stored in the page.");
  head.append(text,button("Rediscover",()=>void load(true),true));
  const record=cache.get(id);
  if(!record){add(region,"p","pv-provision-loading","Discovering the current tool, resource and prompt schemas…");if(!loading.has(id))void load();return;}
  if(record.error){add(region,"p","pv-provision-error",record.error);return;}
  const s=record.data,items=s.tools||[];
  mountProviderAdapterControl({id,data:s,container:region,request,notify,
   onChanged:fresh=>{cache.set(id,{data:fresh,error:null});draw();}});
  mountGhidraLifecycle({id,data:s,container:region,request,notify,onChanged:()=>void load(true)});
  const available=items.filter(t=>t.available).length;
  const disabled=items.filter(t=>t.disabled).length;
  const unprepared=items.filter(t=>!t.available&&!t.disabled).length;
  const stats=add(region,"div","pv-provision-stats");
  for(const [label,value] of [["Upstream tools",items.length],["Invokable",available],["Excluded",disabled],["Not prepared",unprepared]])
   {const cell=node("div","pv-provision-stat");add(cell,"strong","",value);add(cell,"span","",label);stats.append(cell);}
  if(s.adapter_scope==="selected_adapter")
   add(region,"p","pv-provision-warning","This installation runs a selected-function software adapter. Rules here can expose everything its MCP advertises, but cannot invent APIs omitted by that adapter.");
  const section=add(region,"div","pv-provision-catalog");
  const top=add(section,"div","pv-provision-toolbar");
  add(top,"h5","","Tools");
  const filter=add(top,"input","pv-provision-filter");filter.type="search";
  filter.placeholder="Filter upstream tools";filter.setAttribute("aria-label","Filter upstream tools");
  filter.value=filters.get(id)||"";
  const list=add(section,"div","pv-provision-tool-list");
  filter.addEventListener("input",()=>{filters.set(id,filter.value);drawTools();});
  function drawTools(){
   list.replaceChildren();
   const term=(filters.get(id)||"").toLowerCase();
   const shown=items.filter(t=>((t.name||"")+" "+(t.title||"")+" "+(t.description||"")).toLowerCase().includes(term));
   for(const tool of shown){
    const card=add(list,"article","pv-provision-tool");
    const title=add(card,"div","pv-provision-tool-header");
    const summary=node("div");add(summary,"strong","pv-provision-tool-name",tool.name);
    add(summary,"span","pv-provision-tool-state",tool.disabled?"Explicitly excluded":tool.available?"Invokable":tool.unavailable_reason||"Not yet invokable");
    title.append(summary,button(editors.get(id)===tool.name?"Close editor":"Regulate",()=>{
     editors.set(id,editors.get(id)===tool.name?null:tool.name);drawTools();
    },true));
    if(tool.description)add(card,"p","pv-provision-tool-description",tool.description);
    const meta=add(card,"p","pv-provision-tool-meta");
    meta.textContent="Effective: "+(tool.effective_policy?.kind||"unclassified")+
     (tool.override?" · owner override":" · provider baseline")+
     " · "+Object.keys(tool.input_schema?.properties||{}).length+" schema fields";
    if(editors.get(id)===tool.name)drawEditor(card,tool,s);
    if(pending.get(id)?.tool_name===tool.name)drawConfirmation(card,tool,s);
   }
   if(!shown.length)add(list,"p","pv-provision-empty","No upstream tools match this filter.");
  }
  drawTools();
  for(const [title,key] of [["Resources","resources"],["Resource templates","resource_templates"],["Prompts","prompts"],["Installed skills","skills"],["Skill supporting files","skill_files"]]){
   const group=s[key]||{};
   const panel=add(region,"section","pv-provision-mcp");
   add(panel,"h5","",title+" · "+(group.items?.length||0));
   if(group.error)add(panel,"p","pv-provision-muted","Upstream discovery: "+group.error);
   else if(!group.items?.length)add(panel,"p","pv-provision-muted","No "+title.toLowerCase()+" advertised.");
   for(const item of group.items||[]){
    const keyName=provisionKey(key,item),row=add(panel,"div","pv-provision-protocol-item");
    add(row,"strong","",item.name||keyName||"Unnamed provision");
    if(item.uri||item.uriTemplate||item.relative_path)
     add(row,"code","",item.uri||item.uriTemplate||item.relative_path);
    if(item.description)add(row,"p","",item.description);
    if(key==="skill_files")add(row,"p","pv-provision-muted",String(item.size_bytes||0)+" bytes · "+String(item.mime_type||"application/octet-stream")+" · Parent: "+String(item.skill_relative_path||"unknown"));
    add(row,"p","pv-provision-tool-state",item.disabled?"Excluded by provider regulation":"Available from upstream");
    const actions=add(row,"div","pv-provision-actions");
    actions.append(button(item.disabled?"Allow":"Exclude",
     ()=>void prepareItem(s,key,keyName,{enabled:!!item.disabled})));
    if(item.override)actions.append(button("Restore baseline",
     ()=>void prepareItem(s,key,keyName,null),true));
    if(key==="skills")actions.append(button("Read skill",async()=>{
     const preview=add(row,"pre","pv-provision-tool-meta","Reading skill document…");
     try{
      const result=await request({action:"local.skill",uid:id,relative_path:keyName});
      preview.textContent=String(result.content||"").slice(0,90000)||"Skill document is empty.";
     }catch(error){preview.textContent="Skill read unavailable: "+String(error.message||error);}
    },true));
    if(key==="skill_files")actions.append(button("Download file",async()=>{
     const status=add(row,"p","pv-provision-muted","Downloading the discovered skill file…");
     try{
      let offset=0,size=null;
      const parts=[];
      do{
       const chunk=await request({action:"local.skill.file",uid:id,relative_path:keyName,
        offset,length:262144});
       if(chunk.encoding!=="base64"||typeof chunk.content!=="string")
        throw Error("Gateway did not return a verified file chunk.");
       const raw=atob(chunk.content);
       const bytes=new Uint8Array(raw.length);
       for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
       parts.push(bytes);
       size=chunk.size_bytes;
       if(chunk.next_offset===null){offset=null;break;}
       if(!Number.isSafeInteger(chunk.next_offset)||chunk.next_offset<=offset)
        throw Error("Non-progressing skill-file chunk.");
       offset=chunk.next_offset;
       status.textContent="Downloaded "+offset+" of "+size+" bytes…";
      }while(offset!==null);
      const blob=new Blob(parts,{type:item.mime_type||"application/octet-stream"});
      if(blob.size!==size)throw Error("Download size mismatch.");
      const url=URL.createObjectURL(blob);
      try{
       const a=document.createElement("a");
       a.href=url;a.download=item.name||"skill-file";a.hidden=true;
       document.body.append(a);a.click();a.remove();
       status.textContent="Verified: "+blob.size+" bytes downloaded.";
      }finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
     }catch(error){status.textContent="Download unavailable: "+String(error.message||error);}
    },true));
    if(pending.get(id)?.kind===key&&pending.get(id)?.name===keyName)
     drawItemConfirmation(row,s);
   }
   if(group.more)add(panel,"p","pv-provision-warning","The upstream inventory exceeded its configured inspection bound; some entries may be missing.");
  }
 }
 function provisionKey(kind,item){
  return kind==="resources"?item.uri:kind==="resource_templates"?item.uriTemplate:
   ["skills","skill_files"].includes(kind)?item.relative_path:item.name;
 }
 async function prepareItem(snapshot,kind,name,rule){
  try{
   const reply=await request({action:"local.item.prepare",uid:id,kind,name,rule,
     expected_revision:snapshot.provisions_revision});
   if(reply.status!=="prepared"||!reply.receipt)
    throw Error(reply.error||reply.summary||"Gateway rejected the provision change.");
   pending.set(id,{kind,name,rule,receipt:reply.receipt,effects:reply.effects||[]});
   draw();
   notify("Review the provision change, then confirm.");
  }catch(error){notify(String(error.message||error),"error");}
 }
 function drawItemConfirmation(row,snapshot){
  const approval=pending.get(id);
  const panel=add(row,"div","pv-provision-confirm");
  add(panel,"strong","","Confirm live "+approval.kind+" regulation");
  add(panel,"pre","",JSON.stringify({name:approval.name,rule:approval.rule,effects:approval.effects},null,2));
  const actions=add(panel,"div","pv-provision-actions");
  actions.append(button("Apply to running gateway",()=>void commitItem(approval)));
  actions.append(button("Cancel",()=>{pending.delete(id);draw();},true));
 }
 async function commitItem(approval){
  try{
   const result=await request({action:"local.commit",receipt:approval.receipt});
   if(result.status!=="completed"||result.results?.some(x=>x.status!=="ok"))
    throw Error(result.summary||"The gateway did not apply the new rule.");
   pending.delete(id);
   const fresh=await request({action:"local.surface",uid:id});
   const actual=fresh[approval.kind]?.items?.find(x=>provisionKey(approval.kind,x)===approval.name);
   if(!actual||(approval.rule===null?actual.override!==null:
      JSON.stringify(actual.override)!==JSON.stringify(approval.rule)))
    throw Error("Live provision regulation verification failed.");
   cache.set(id,{data:fresh,error:null});
   draw();
   notify("Verified: provision regulation is active in the running gateway.");
  }catch(error){notify(String(error.message||error),"error");}
 }
 function control(form,label,current,{options=null,type="text",hint=""}={}){
  const wrap=add(form,"label","pv-provision-form-item");
  add(wrap,"span","",label);
  let entry;
  if(options){entry=add(wrap,"select","pv-provision-input");
   for(const item of options){const option=add(entry,"option","",item);option.value=item;}
   entry.value=current||options[0];
  }else{entry=add(wrap,"input","pv-provision-input");
   entry.type=type;
   if(type==="checkbox")entry.checked=!!current;
   else entry.value=current==null?"":String(current);
  }
  if(hint)add(wrap,"small","",hint);
  return entry;
 }
 function drawEditor(card,tool,s){
  const f=add(card,"form","pv-provision-editor");
  const current=tool.effective_policy||{},properties=Object.keys(tool.input_schema?.properties||{});
  add(f,"p","pv-provision-warning","Changes govern this tool only. A read classification should be used only when the upstream operation is genuinely observational. Filesystem-sensitive tools must map actual schema fields or be explicitly reviewed as targetless.");
  const row=add(f,"div","pv-provision-form-grid"),values={};
  values.enabled=control(row,"Advertise / enable",!tool.disabled,{type:"checkbox"});
  values.kind=control(row,"Tool effect",current.kind||"mutation",{options:["read","mutation"]});
  for(const bit of CHECKS)
   values[bit]=control(row,pretty(bit),!!current[bit],{type:"checkbox"});
  values.operation=control(row,"Filesystem operation",current.operation||"read",{options:OPERATIONS});
  for(const key of FIELDS)
   values[key]=control(row,pretty(key),(current[key]||[]).join(", "),{
    hint:key==="effectTargets"?"Prepared effect labels":properties.length?"Available upstream fields: "+properties.join(", ").slice(0,380):"No named top-level schema fields"});
  const actions=add(f,"div","pv-provision-actions");
  const submit=add(actions,"button","pv-provision-button","Review live regulation");submit.type="submit";
  if(tool.override)actions.append(button("Restore provider baseline",()=>{
   void prepareTool(s,tool,null);
  },true));
  f.addEventListener("submit",event=>{
   event.preventDefault();
   const kind=values.kind.value;
   const rule={enabled:values.enabled.checked,kind,
    preparable:kind==="mutation",
    operation:values.operation.value};
   for(const bit of CHECKS)rule[bit]=values[bit].checked;
   for(const key of FIELDS)rule[key]=trimArray(values[key].value);
   if(kind==="mutation"&&!rule.effectTargets.length)
    rule.effectTargets=["Colosseum "+id+" / "+tool.name];
   if(current.kind==="mutation"&&kind==="read"&&
      !window.confirm("This upstream tool was previously classified as a mutation. Are you certain it is genuinely read-only?"))
    return;
   void prepareTool(s,tool,rule);
  });
 }
 async function prepareTool(s,tool,rule){
  try{
   const reply=await request({action:"local.tool.prepare",uid:id,tool:tool.name,
    expected_revision:s.provisions_revision,rule});
   if(reply.status!=="prepared"||!reply.receipt)throw Error(reply.error||reply.summary||"The gateway rejected this review.");
   pending.set(id,{tool_name:tool.name,rule,receipt:reply.receipt,effects:reply.effects||[]});
   if(region.isConnected)draw();
   notify("Review the prepared effect, then confirm to apply the live change.");
  }catch(error){notify(String(error.message||error),"error");}
 }
 function drawConfirmation(card,tool,s){
  const item=pending.get(id);
  const panel=add(card,"div","pv-provision-confirm");
  add(panel,"strong","","Confirm live tool regulation");
  add(panel,"p","","Provider: "+id+" · Upstream tool: "+tool.name);
  add(panel,"pre","",JSON.stringify({requested_rule:item.rule,effects:item.effects},null,2));
  const actions=add(panel,"div","pv-provision-actions");
  actions.append(button("Apply to running gateway",()=>void commitTool(item,tool,s)));
  actions.append(button("Cancel",()=>{pending.delete(id);draw();},true));
 }
 async function commitTool(item,tool,previous){
  try{
   const result=await request({action:"local.commit",receipt:item.receipt});
   if(result.status!=="completed"||result.results?.some(x=>x.status!=="ok"))
    throw Error(result.summary||"The gateway did not apply this regulation.");
   pending.delete(id);cache.delete(id);
   const fresh=await request({action:"local.surface",uid:id});
   const actual=fresh.tools?.find(t=>t.name===tool.name);
   if(!actual||(item.rule===null?actual.override!==null:
       JSON.stringify(actual.override)!==JSON.stringify(item.rule)))
    throw Error("The new rule could not be verified against the live provider.");
   cache.set(id,{data:fresh,error:null});
   if(region.isConnected)draw();
   notify("Verified: the new provider regulation is effective in the running gateway.");
  }catch(error){notify(String(error.message||error),"error");}
 }
 draw();
}
