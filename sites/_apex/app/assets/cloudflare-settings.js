// Server-verified Cloudflare account connection. UI contains no credentials beyond
// the short-lived token input, which is cleared immediately after submission.
export function initCloudflareConnection(){
  const id=name=>document.getElementById("cf-"+name);
  if(!id("heading"))return;
  const feedback=id("feedback"),status=id("connection-status"),email=id("owner-email"),
    activeScope=id("active-scope"),expiry=id("expiry"),token=id("token"),
    connectTitle=id("connect-title"),connectButton=id("connect-button"),
    saveScope=id("save-scope"),disconnect=id("disconnect"),form=id("connect-form"),
    scopeForm=id("scope-form"),consolePanel=id("explorer"),disconnectArea=id("disconnect-area");
  let state={connected:false},busy=false;
  const fmtTime=value=>value&&Number.isFinite(Date.parse(value))?
    new Date(value).toLocaleString():"No expiry reported";
  const errorText=e=>String(e?.message||"Something went wrong.");
  function message(text="",error=false){feedback.textContent=text;feedback.dataset.error=String(error);}
  function readList(field){
    const raw=id(field).value.trim();
    if(raw==="*")return "*";
    if(!raw)return [];
    const list=raw.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean);
    if(list.some(s=>!/^[a-fA-F0-9]{32}$/.test(s))||list.length>50)
      throw Error("Enter * or up to 50 valid 32-character resource IDs.");
    return list;
  }
  function policyFromForm(){
    return {mode:id("mode").value,accounts:readList("accounts"),zones:readList("zones"),user:id("user").checked};
  }
  function policyToForm(policy={}){
    id("mode").value=policy.mode||"read";
    id("accounts").value=policy.accounts==="*"||!Array.isArray(policy.accounts)?"*":policy.accounts.join(", ");
    id("zones").value=policy.zones==="*"||!Array.isArray(policy.zones)?"*":policy.zones.join(", ");
    id("user").checked=!!policy.user;
  }
  function show(next){
    state=next;
    status.textContent=next.connected?"Connected":"Not connected";
    status.dataset.state=next.connected?"connected":"disconnected";
    email.textContent=next.email||"Not connected";
    activeScope.textContent=next.connected?(next.policy?.mode==="full"?"Full · user-scoped":"Read-only"):"—";
    expiry.textContent=next.connected?fmtTime(next.expiresOn):"—";
    connectTitle.textContent=next.connected?"Replace connection token":"Add a connection";
    connectButton.textContent=next.connected?"Replace token":"Connect Cloudflare";
    saveScope.disabled=!next.connected||busy;
    disconnect.hidden=!next.connected;
    disconnectArea.hidden=!next.connected;
    consolePanel.hidden=!next.connected;
    if(next.policy)policyToForm(next.policy);
  }
  function setBusy(value){
    busy=value;
    for(const el of [connectButton,disconnect,id("refresh"),id("api-send")])el.disabled=value;
    saveScope.disabled=value||!state.connected;
  }
  async function call(path,method="GET",body){
    const options={method,credentials:"same-origin",cache:"no-store",redirect:"follow"};
    if(body!==undefined){options.headers={"Content-Type":"application/json"};options.body=JSON.stringify(body);}
    const response=await fetch("/api/cloudflare/"+path,options);
    const type=response.headers.get("Content-Type")||"";
    if(!type.includes("application/json"))throw Error("Authenticate with Cloudflare using the button above, then refresh.");
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Cloudflare request failed ("+response.status+").");
    return data;
  }
  async function refresh(){
    try{const fresh=await call("connection");show(fresh);message(fresh.connected?"Cloudflare authorization is available.":"No token connected yet.");}
    catch(e){status.textContent="Authentication needed";status.dataset.state="unauthorized";message(errorText(e),true);}
  }
  id("refresh").addEventListener("click",refresh);
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(busy)return;
    const value=token.value.trim();
    setBusy(true);message("Verifying Cloudflare identity and storing encrypted connection…");
    try{
      const policy=policyFromForm();
      const saved=await call("connection","POST",{token:value,policy});
      show(saved);message("Cloudflare connection saved. You can change scope or remove it at any time.");
    }catch(e){message(errorText(e),true);}
    finally{token.value="";setBusy(false);}
  });
  scopeForm.addEventListener("submit",async event=>{
    event.preventDefault();if(busy||!state.connected)return;
    setBusy(true);message("Updating effective permissions…");
    try{const saved=await call("scope","PUT",policyFromForm());show(saved);message("Permission scope updated.");}
    catch(e){message(errorText(e),true);}
    finally{setBusy(false);}
  });
  id("full-scope").addEventListener("click",()=>{
    id("mode").value="full";id("accounts").value="*";id("zones").value="*";id("user").checked=true;
    message("Full access selected. Save the permission scope to apply this change.");
  });
  disconnect.addEventListener("click",async()=>{
    if(busy||!state.connected)return;
    if(!confirm("Remove Cloudflare access from DoFinances? The token remains in Cloudflare until separately revoked."))return;
    setBusy(true);message("Removing stored Cloudflare credential…");
    try{const result=await call("connection","DELETE");show(result);message("Cloudflare disconnected from DoFinances.");}
    catch(e){message(errorText(e),true);}
    finally{setBusy(false);}
  });
  id("api-form").addEventListener("submit",async event=>{
    event.preventDefault();if(busy||!state.connected)return;
    const output=id("api-output"),raw=id("api-body").value.trim();
    let parsed;
    try{parsed=raw?JSON.parse(raw):undefined;}
    catch{output.textContent="Request body must be valid JSON.";return;}
    setBusy(true);output.textContent="Sending request…";
    try{const result=await call("request","POST",{method:id("api-method").value,path:id("api-path").value.trim(),body:parsed});
      output.textContent=JSON.stringify(result,null,2);}
    catch(e){output.textContent=errorText(e);}
    finally{setBusy(false);}
  });
  if(new URLSearchParams(location.search).get("cloudflare")==="verified"){
    history.replaceState(history.state,"",location.pathname+location.hash);
    message("Cloudflare owner identity verified. You may connect or manage your token.");
  }
  refresh();
}
