/* Dynamically discovered Olympus adapter source control. This module never
 * presumes a package-specific tool name or fixed API surface. */
const expanded=new Set(),sourceCache=new Map(),loading=new Set(),pending=new Map();
const el=(tag,cls,text)=>{
 const a=document.createElement(tag);
 if(cls)a.className=cls;
 if(text!==undefined)a.textContent=String(text);
 return a;
};
const append=(root,tag,cls,text)=>{const a=el(tag,cls,text);root.append(a);return a;};
const makeButton=(name,click,secondary=false)=>{
 const b=el("button","pv-provision-button"+(secondary?" is-secondary":""),name);
 b.type="button";b.addEventListener("click",click);return b;
};
const value=(x,defaultValue="")=>x===undefined||x===null?defaultValue:String(x);
const parseObject=(raw,label)=>{
 let o;try{o=JSON.parse(raw||"{}")}catch{throw Error(label+" must contain valid JSON.");}
 if(!o||typeof o!=="object"||Array.isArray(o))throw Error(label+" must be a JSON object.");
 return o;
};
const parseArgs=raw=>{
 let o;try{o=JSON.parse(raw||"[]")}catch{throw Error("Arguments must be a JSON string array.");}
 if(!Array.isArray(o)||o.some(x=>typeof x!=="string"))throw Error("Arguments must be a JSON string array.");
 return o;
};
const modes=[
 ["original","Keep registered adapter"],
 ["installation","Use verified installed MCP executable"],
 ["stdio","Use custom local MCP executable or script"],
 ["http","Connect to a remote or local MCP HTTP endpoint"]
];
export function mountProviderAdapterControl({id,data,container,request,notify,onChanged}){
 const outer=append(container,"section","pv-adapter-section");
 const cfg=data.adapter||{};
 const current=cfg.selection||null;
 const active=current?.mode||"original";
 function notifyError(error){notify(String(error?.message||error),"error");}
 function row(parent,label,{val="",type="text",options=null,hint="",placeholder="",required=false}={}){
  const wrap=append(parent,"label","pv-adapter-field");
  append(wrap,"span","",label);
  const control=el(options?"select":type==="multiline"?"textarea":"input","pv-provision-input");
  if(!options&&type!=="multiline")control.type=type;
  if(options){for(const [v,text] of options){const option=append(control,"option","",text);option.value=v;}}
  if(type==="multiline")control.rows=3;
  control.value=value(val);control.required=required;control.placeholder=placeholder;
  wrap.append(control);
  if(hint)append(wrap,"small","",hint);
  return control;
 }
 async function discoverSources(term=""){
  if(loading.has(id))return;
  loading.add(id);
  try{
   const result=await request({action:"local.adapter.sources",uid:id,query:term.slice(0,200)});
   if(!Array.isArray(result.installations))throw Error("Installed component inventory is unavailable.");
   sourceCache.set(id,result);
   if(outer.isConnected)render();
  }catch(error){notifyError(error);}
  finally{loading.delete(id);}
 }
 function render(){
  outer.replaceChildren();
  const heading=append(outer,"div","pv-provision-head");
  const title=el("div");append(title,"h4","","Adapter implementation");
  append(title,"p","pv-provision-intro","Choose the MCP implementation that this provider runs. Its advertised tools, resources, and prompts are rediscovered automatically after a confirmed switch.");
  heading.append(title,makeButton(expanded.has(id)?"Close adapter settings":"Configure adapter",()=>{
   if(expanded.has(id))expanded.delete(id);else expanded.add(id);
   render();
  },true));
  const status=append(outer,"div","pv-adapter-state");
  append(status,"strong","",active==="original"?"Original registered adapter":modes.find(x=>x[0]===active)?.[1]||active);
  append(status,"small","",current?"Owner-selected source · live connection: "+(cfg.active_type||"unknown"):"No adapter override · "+(cfg.active_type||"unknown"));
  if(!expanded.has(id))return;
  append(outer,"p","pv-provision-warning","Changing an adapter can replace its entire upstream tool list. The local Permissions authority must permit its executable and script. Changes use gateway review, confirmation, live reconnection, verification, and automatic restoration if the new MCP cannot connect.");
  const form=append(outer,"form","pv-adapter-form");
  const mode=row(form,"Adapter source",{val:active,options:modes});
  const fields=append(form,"div","pv-adapter-fields");
  const defaultIdle=current?.idle_seconds??cfg.original?.idleSeconds??1200;
  const idle=row(form,"Idle timeout (seconds)",{val:defaultIdle,type:"number",required:true,
   hint:"0 disables idle shutdown; maximum 86,400."});
  function addFields(){
   fields.replaceChildren();
   const chosen=mode.value;
   if(chosen==="original"){
    const p=cfg.original||{};
    append(fields,"p","pv-provision-muted","The original source will be restored. "+
      (p.command||p.installation?.component||p.url||"Registered MCP endpoint")+" "+
      (p.args?.length?"("+p.args.join(" ")+")":""));
    return;
   }
   if(chosen==="installation"){
    const inst=current?.mode==="installation"?current.installation||{}:{};
    const component=row(fields,"Installed component",{val:inst.component||"",required:true,
     hint:"Component identity from the independent shared installation registry.",
     placeholder:"npm:@scope/package or pypi:package"});
    const saved=sourceCache.get(id);
    const browse=append(fields,"div","pv-adapter-browse");
    const query=el("input","pv-provision-input");query.type="search";query.placeholder="Find registered software";
    browse.append(query,makeButton("Search installations",()=>void discoverSources(query.value),true));
    if(saved){
     const candidates=saved.installations.filter(x=>x.installed);
     const sel=row(fields,"Verified installation",{options:[["","Choose a registered installation"],...candidates.map((x,i)=>[String(i),x.component+" · "+x.version+" · "+x.variant])],
       hint:saved.truncated?"Inventory is truncated; narrow the search.":candidates.length+" verified candidates"});
     sel.addEventListener("change",()=>{
      const x=candidates[Number(sel.value)];if(!x)return;
      component.value=x.component;version.value=x.version;variant.value=x.variant;
      kind.value=x.manager==="pnpm"?"npm-bin":"native";
     });
    }
    const version=row(fields,"Selected version",{val:inst.version||"",placeholder:"Leave empty for independently active version"});
    const variant=row(fields,"Build variant",{val:inst.variant||"",placeholder:"Leave empty unless required"});
    const kind=row(fields,"Entrypoint type",{val:inst.kind||"npm-bin",
     options:[["npm-bin","npm binary"],["native","Native executable"]]});
    const bin=row(fields,"npm binary name",{val:inst.bin||"",placeholder:"Declared package bin"});
    const relative=row(fields,"Native executable relative path",{val:inst.relativeExecutable||"",placeholder:"bin/mcp-server"});
    const args=row(fields,"Command arguments (JSON string array)",{val:JSON.stringify(current?.mode==="installation"?current.args||[]:[]),
      type:"multiline",placeholder:'["--transport", "stdio"]'});
    fields.dataset.section="installation";
    fields._adapterControls={component,version,variant,kind,bin,relative,args};
    if(!saved&&!loading.has(id))void discoverSources();
    return;
   }
   if(chosen==="stdio"){
    const command=row(fields,"Executable path",{val:current?.mode==="stdio"?current.command:"",
      required:true,placeholder:"/opt/homebrew/opt/node@24/bin/node",
      hint:"Absolute path or ~/...; execute access is checked against Permissions."});
    const args=row(fields,"Arguments (JSON string array)",{val:JSON.stringify(current?.mode==="stdio"?current.args||[]:[]),
      type:"multiline",placeholder:'["/path/to/full-mcp-server.mjs"]'});
    const cwd=row(fields,"Working directory (optional)",{val:current?.mode==="stdio"?current.cwd||"":"",
      placeholder:"~/Projects/example"});
    const env=row(fields,"Environment bindings (JSON)",{val:JSON.stringify(current?.mode==="stdio"?current.env_refs||{}:{},null,2),
      type:"multiline",hint:'Map child variable names to gateway environment variable names. Secret values are never displayed.'});
    fields._adapterControls={command,args,cwd,env};
    return;
   }
   if(chosen==="http"){
    const url=row(fields,"MCP endpoint URL",{val:current?.mode==="http"?current.url:"",required:true,
      placeholder:"https://mcp.example.com/mcp",hint:"HTTPS or local loopback HTTP only. Do not put credentials in the URL."});
    const headers=row(fields,"HTTP header bindings (JSON)",{val:JSON.stringify(current?.mode==="http"?current.header_refs||{}:{},null,2),
      type:"multiline",hint:'Map header names to existing gateway environment variable names; secret contents are not returned.'});
    fields._adapterControls={url,headers};
   }
  }
  mode.addEventListener("change",addFields);
  addFields();
  const actions=append(form,"div","pv-provision-actions");
  const submit=append(actions,"button","pv-provision-button","Review adapter switch");submit.type="submit";
  if(current)actions.append(makeButton("Restore original adapter",()=>void prepare(null),true));
  form.addEventListener("submit",event=>{
   event.preventDefault();
   try{
    const type=mode.value,v=fields._adapterControls||{};
    const n=Number(idle.value);
    if(!Number.isInteger(n)||n<0||n>86400)throw Error("Idle timeout must be an integer from 0 to 86400.");
    let selection=null;
    if(type==="installation"){
     const installation={component:v.component.value.trim(),kind:v.kind.value};
     if(v.version.value.trim())installation.version=v.version.value.trim();
     if(v.variant.value.trim())installation.variant=v.variant.value.trim();
     if(installation.kind==="npm-bin")installation.bin=v.bin.value.trim();
     else installation.relativeExecutable=v.relative.value.trim();
     selection={mode:"installation",installation,args:parseArgs(v.args.value),idle_seconds:n};
    }else if(type==="stdio"){
     selection={mode:"stdio",command:v.command.value.trim(),args:parseArgs(v.args.value),
      env_refs:parseObject(v.env.value,"Environment bindings"),idle_seconds:n};
     if(v.cwd.value.trim())selection.cwd=v.cwd.value.trim();
    }else if(type==="http"){
     selection={mode:"http",url:v.url.value.trim(),
      header_refs:parseObject(v.headers.value,"HTTP header bindings"),idle_seconds:n};
    }
    void prepare(selection);
   }catch(error){notifyError(error);}
  });
  const approval=pending.get(id);
  if(approval)renderApproval(approval);
 }
 async function prepare(selection){
  try{
   const response=await request({action:"local.adapter.prepare",uid:id,selection,
    expected_revision:cfg.revision,expected_contract_revision:data.contract_revision});
   if(response.status!=="prepared"||!response.receipt)
    throw Error(response.error||response.summary||"The gateway rejected the proposed adapter.");
   pending.set(id,{receipt:response.receipt,selection,effects:response.effects||[]});
   if(outer.isConnected)render();
   notify("Review the adapter replacement and confirm its effects.");
  }catch(error){notifyError(error);}
 }
 function renderApproval(approval){
  const box=append(outer,"div","pv-provision-confirm");
  append(box,"strong","","Confirm adapter implementation switch");
  append(box,"p","","Only "+id+" will reconnect. A failure to start or verify the replacement restores the previous selection.");
  append(box,"pre","",JSON.stringify({next_adapter:approval.selection||"Original",effects:approval.effects},null,2));
  const actions=append(box,"div","pv-provision-actions");
  actions.append(makeButton("Apply and verify adapter",()=>void commit(approval)));
  actions.append(makeButton("Cancel",()=>{pending.delete(id);render();},true));
 }
 async function commit(approval){
  try{
   const result=await request({action:"local.commit",receipt:approval.receipt});
   if(result.status!=="completed"||result.results?.some(x=>x.status!=="ok"))
    throw Error(result.results?.find(x=>x.status!=="ok")?.error||result.summary||"Adapter replacement failed.");
   pending.delete(id);
   const actual=await request({action:"local.surface",uid:id});
   if(actual.provider_id!==id||!Array.isArray(actual.tools)||
      JSON.stringify(actual.adapter?.selection||null)!==JSON.stringify(approval.selection))
    throw Error("Unable to verify the active adapter selection against the gateway.");
   sourceCache.delete(id);expanded.delete(id);
   onChanged(actual);
   notify("The replacement adapter is connected. Its new upstream provisions were rediscovered.");
  }catch(error){notifyError(error);}
 }
 render();
}
