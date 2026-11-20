// Authenticated Connections overview for Colosseum Credentials.
// DoFinances linked identities are sign-in identities only: they MUST NOT be
// presented as OAuth grants to Drive, Docs, Sheets, Slides, or GitHub contents.
// No OAuth token, email, or client secret is embedded in public site assets.
export const WORKSPACE_GOOGLE_SERVICES=Object.freeze([
 {id:"drive",label:"Google Drive"},
 {id:"docs",label:"Google Docs"},
 {id:"sheets",label:"Google Sheets"},
 {id:"slides",label:"Google Slides"}
]);
const SERVICE_NAMES=Object.freeze({
 drive:/\bgoogle\s+(?:workspace\s+)?drive\b|\bdrive\s+(?:mcp\s+)?google\b/i,
 docs:/\bgoogle\s+(?:workspace\s+)?docs\b|\bdocs\s+(?:mcp\s+)?google\b/i,
 sheets:/\bgoogle\s+(?:workspace\s+)?sheets\b|\bsheets\s+(?:mcp\s+)?google\b/i,
 slides:/\bgoogle\s+(?:workspace\s+)?slides\b|\bslides\s+(?:mcp\s+)?google\b/i
});
export function workspaceGoogleProvider(providers,service){
 const pattern=SERVICE_NAMES[service];
 if(!pattern||!Array.isArray(providers))return null;
 return providers.find(p=>p&&typeof p.name==="string"&&
  typeof p.uid==="string"&&pattern.test(p.name))||null;
}
export function workspaceServiceStatus(provider,registryLoaded=true){
 if(!registryLoaded)return "Checking MCP";
 if(!provider)return "MCP not registered";
 if(provider.status==="connected")return "MCP connected";
 if(provider.status==="pending")return "Authorization pending";
 return "MCP not connected";
}
const el=(tag,className,text)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
function actionLink(text,href){
 const a=el("a","pv-account-link",text);
 a.href=href;return a;
}
function panel(title,subtitle){
 const section=el("section","pv-account-panel");
 const head=el("div","pv-account-heading");
 head.append(el("h3","",title),el("p","",subtitle));section.append(head);
 const body=el("div","pv-account-body");section.append(body);
 return {section,body};
}
function line(parent,label,value){
 const row=el("div","pv-account-line");
 row.append(el("span","pv-account-line-label",label),el("span","pv-account-line-value",value));
 parent.append(row);return row;
}
async function getJson(path){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",
  headers:{"Accept":"application/json"}});
 if(!response.ok)throw Error("HTTP "+response.status);
 return response.json();
}
export function initWorkspaceCredentialHub(root,{providers,onSelectProvider,registryLoaded}){
 const home=el("section","pv-account-hub");
 home.id="pv-account-hub";
 home.setAttribute("aria-label","DoFinances account connections");
 const heading=el("div","pv-account-hub-heading");
 heading.append(el("h2","","Account connections"),el("p","",
  "Use your linked DoFinances identities and existing provider authorizations. No passwords or tokens are entered here."));
 home.append(heading);
 const area=el("div","pv-account-panels");home.append(area);
 const notice=el("p","pv-account-notice","");
 notice.setAttribute("role","status");home.append(notice);
 const overview=root.querySelector(".pv-overview");
 if(overview)overview.after(home);else root.prepend(home);
 let last=null,loading=false,sequence=0;
 function paint(){
  area.replaceChildren();
  const accounts=last?.accounts,config=last?.config,github=last?.github,cloudflare=last?.cloudflare;
  const google=panel("Google Workspace",
    "One Google account identity; independent permissions for each MCP.");
  const identities=accounts?.identities?.filter(x=>x?.provider==="google")||[];
  const identityReady=!!accounts&&!!config;
  const googleRow=line(google.body,"Google sign-in",
   !identityReady?"Connection status unavailable":
   identities.length?identities.map(x=>x.email||"Linked Google account").join(", "):"No linked Google account");
  if(identityReady&&config.federation?.google?.enabled){
   const link=actionLink(identities.length?"Link another Google account":"Link a Google account",
    "/api/auth/oauth/start?provider=google&intent=link");
   link.addEventListener("click",()=>{
    try{sessionStorage.setItem("dofinances.credentials.return.v1","google");}catch{}
   });
   googleRow.append(link);
  }else if(identityReady){
   googleRow.append(el("span","pv-account-hint","Google sign-in is not configured on this site."));
  }
  const services=el("div","pv-account-services");
  services.setAttribute("aria-label","Google Workspace MCPs");
  for(const svc of WORKSPACE_GOOGLE_SERVICES){
   const provider=workspaceGoogleProvider(providers(),svc.id);
   const row=el("div","pv-account-service");
   const copy=el("div","pv-account-service-copy");
   copy.append(el("strong","",svc.label),
    el("span","pv-account-service-status",workspaceServiceStatus(provider,registryLoaded())));
   row.append(copy);
   if(provider){
    const btn=el("button","pv-account-link","Manage MCP");
    btn.type="button";
    btn.addEventListener("click",()=>onSelectProvider(provider.uid));
    row.append(btn);
   }
   services.append(row);
  }
  google.body.append(services);
  google.body.append(el("p","pv-account-help",
   "Linking Google for sign-in does not grant file access. Select Manage MCP on a registered service to complete its own authorization and tool approvals. Choose the same Google account at each consent screen."));
  area.append(google.section);

  const gh=panel("GitHub","Uses the GitHub identity linked to your DoFinances account.");
  const ghIdentities=accounts?.identities?.filter(x=>x?.provider==="github")||[];
  const ghRow=line(gh.body,"DoFinances sign-in",
   !accounts?"Connection status unavailable":
   ghIdentities.length?ghIdentities.map(x=>x.email||x.displayName||"Linked account").join(", "):"Not linked");
  if(accounts&&config?.federation?.github?.enabled&&!ghIdentities.length){
   const link=actionLink("Link GitHub account","/api/auth/oauth/start?provider=github&intent=link");
   link.addEventListener("click",()=>{
    try{sessionStorage.setItem("dofinances.credentials.return.v1","github");}catch{}
   });
   ghRow.append(link);
  }
  line(gh.body,"Repository authorization",
   !github?"Not checked":github.connected?"Authorized for repositories":"No repository access granted");
  gh.body.append(el("p","pv-account-help",
   "Sign-in identity is not a GitHub repository token. Private README reads and writes use the separately authorized repository connection; permissions are never inferred from sign-in."));
  gh.body.append(actionLink("Manage repository access in Settings","#settings"));
  area.append(gh.section);

  const cf=panel("Cloudflare","Uses the Cloudflare connection already associated with your DoFinances user.");
  line(cf.body,"Account authorization",
   !cloudflare?"Status unavailable":cloudflare.connected?"API connected":
   cloudflare.authenticated?"Owner verified; API authorization not connected":"Owner verification required");
  cf.body.append(el("p","pv-account-help",
   "DoFinances uses your saved, user-scoped Cloudflare API connection where authorized. Cloudflare Access identity alone does not confer API permissions."));
  cf.body.append(actionLink("Manage Cloudflare connection in Settings","#settings"));
  area.append(cf.section);
  notice.textContent=loading?"Checking your account connections…":
   "Connection labels reflect actual server responses. MCP authorizations remain independent of sign-in.";
 }
 async function refresh(){
  if(loading)return;
  const seq=++sequence;loading=true;paint();
  const values=await Promise.allSettled([
   getJson("/api/auth/federation/accounts"),getJson("/api/auth/config"),
   getJson("/api/github/connection"),getJson("/api/cloudflare/connection")
  ]);
  if(seq!==sequence)return;
  last=Object.fromEntries(["accounts","config","github","cloudflare"].map((key,i)=>
   [key,values[i].status==="fulfilled"?values[i].value:null]));
  loading=false;paint();
 }
 let opened=false;
 function activate(){
  if(!opened){opened=true;void refresh();}else paint();
 }
 paint();
 return {activate,refresh,render:paint};
}
