/* Ghidra's native-instance lifecycle is harness-owned, not an upstream MCP tool.
 * Upstream tools/resources/prompts remain sourced by provider.surface.list. */
const pending=new Map();
function el(tag,klass,text){
  const node=document.createElement(tag);
  if(klass)node.className=klass;
  if(text!==undefined)node.textContent=String(text);
  return node;
}
function add(root,tag,klass,text){
  const node=el(tag,klass,text);root.append(node);return node;
}
function action(label,run,secondary=false){
  const button=el("button","pv-provision-button"+(secondary?" is-secondary":""),label);
  button.type="button";button.addEventListener("click",run);return button;
}
export function mountGhidraLifecycle({id,data,container,request,notify,onChanged}){
 if(id!=="ghidra")return;
 const root=add(container,"section","pv-provision-section");
 const live=data.lifecycle;
 function render(){
  root.replaceChildren();
  const head=add(root,"div","pv-provision-head"),copy=el("div");
  add(copy,"h4","","Ghidra instance lifecycle");
  add(copy,"p","pv-provision-intro",
    "The harness owns on-demand headless instances. The Permissions screen establishes the non-bypassable maximum idle duration. Unowned Ghidra processes are never terminated.");
  head.append(copy);
  if(!live){add(root,"p","pv-provision-error","Ghidra lifecycle controls require the updated local gateway.");return;}
  const stats=add(root,"div","pv-provision-stats");
  const rows=[
    ["Instance",live.running?"Running · owned":live.mode==="attach"?"Attach-only":"Stopped"],
    ["Active leases",live.active_leases],
    ["Effective idle",live.effective_idle_seconds+" sec"],
    ["Permissions ceiling",live.hard_max_idle_seconds+" sec"]
  ];
  for(const [name,value] of rows){
    const card=add(stats,"div","pv-provision-stat");
    add(card,"strong","",value);add(card,"span","",name);
  }
  if(live.last_error)add(root,"p","pv-provision-warning",live.last_error);
  if(live.versions)add(root,"p","pv-provision-muted",
    "Installed Ghidra "+live.versions.ghidra.version+
    " · Extension "+live.versions.extension.version+
    " · MCP bridge "+live.versions.bridge.version);
  if(live.idle_deadline)add(root,"p","pv-provision-muted",
    "Idle deadline: "+new Date(live.idle_deadline).toLocaleString());
  const buttons=add(root,"div","pv-provision-actions");
  if(live.mode==="headless"){
    const start=action("Review start",()=>void stage("start"));
    start.disabled=live.running;buttons.append(start);
  }
  const stop=action("Review graceful stop",()=>void stage("stop"),true);
  stop.disabled=!live.running||live.active_leases>0;buttons.append(stop);
  const form=add(root,"form","pv-provider-form");
  const fields=add(form,"div","pv-provision-actions");
  function field(label,type,value,min,max,step){
    const wrap=add(fields,"label","pv-adapter-field");
    add(wrap,"span","",label);
    const input=add(wrap,"input","pv-provision-input");
    input.type=type;
    if(type==="checkbox")input.checked=!!value;
    else input.value=String(value);
    if(min!==undefined)input.min=String(min);
    if(max!==undefined)input.max=String(max);
    if(step!==undefined)input.step=String(step);
    return input;
  }
  const modeWrap=add(fields,"label","pv-adapter-field");
  add(modeWrap,"span","","Instance mode");
  const mode=add(modeWrap,"select","pv-provision-input");
  for(const [v,title] of [
    ["headless","Start managed headless instance"],
    ["attach","Attach to an existing instance"]
  ]){
    const opt=add(mode,"option","",title);opt.value=v;
  }
  mode.value=live.config.mode;
  const idle=field("Requested idle duration · seconds","number",live.config.idle_seconds,60,43200,60);
  const scripts=field("Enable upstream Ghidra script endpoints","checkbox",live.config.allow_scripts);
  add(root,"p","pv-provision-muted",
    "Scripts remain subject to tool-specific approval and general Permissions gates. Mode and script startup changes require stopping the running instance first. The managed server uses a protected local Unix socket, not a TCP listener.");
  const submit=action("Review lifecycle preferences",()=>{},true);
  submit.type="submit";form.append(submit);
  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(!idle.checkValidity()){
      notify("Enter a valid idle duration.","error");return;
    }
    const config={mode:mode.value,idle_seconds:Number(idle.value),
      allow_scripts:scripts.checked};
    if(Object.keys(config).every(key=>config[key]===live.config[key])){
      notify("Lifecycle settings already match the active configuration.");return;
    }
    void stage("configure",config);
  });
  const decision=pending.get(id);
  if(decision){
    const confirm=add(root,"div","pv-confirm-panel");
    add(confirm,"strong","","Review Ghidra lifecycle "+decision.operation);
    add(confirm,"p","",decision.operation==="stop"?
      "Save and close the project, then stop only the managed instance, provided no operation leases remain.":
      decision.operation==="start"?
      "Start the independently registered Ghidra server and discover its live upstream MCP capabilities.":
      "Apply the requested lifecycle preferences under the separate Permissions ceiling.");
    if(decision.config)add(confirm,"pre","pv-provision-tool-meta",JSON.stringify(decision.config,null,2));
    const choices=add(confirm,"div","pv-provision-actions");
    choices.append(action("Apply confirmed change",()=>void commit()));
    choices.append(action("Cancel",()=>{pending.delete(id);render();},true));
  }
 }
 async function stage(operation,config){
  try {
    const name=operation==="start"?"local.lifecycle.start.prepare":
      operation==="stop"?"local.lifecycle.stop.prepare":"local.lifecycle.configure.prepare";
    const response=await request({action:name,uid:id,...(config?
      {config,expected_revision:live.revision}:{})});
    if(response.status!=="prepared"||!response.receipt)
      throw Error(response.error||response.summary||"Ghidra lifecycle change was not prepared.");
    pending.set(id,{operation,config,receipt:response.receipt});
    render();
  }catch(error){notify(String(error?.message||error),"error");}
 }
 async function commit(){
  const record=pending.get(id);
  if(!record)return;
  try{
    const result=await request({action:"local.commit",receipt:record.receipt});
    if(result.status!=="completed")throw Error(result.summary||"Lifecycle change was not committed.");
    pending.delete(id);
    notify("Ghidra lifecycle change applied by the gateway.");
    onChanged();
  }catch(error){notify(String(error?.message||error),"error");}
 }
 render();
}

