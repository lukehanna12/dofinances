// Account-specific project READMEs: GitHub GFM, safe live editing, preview,
// diff, repository association, and encrypted GitHub connection in Settings.
// All credentials and writes stay behind the authenticated, same-origin Worker.
import {setWorkspaceProjectRegistry} from "./workspace-nav.js";

const $=id=>document.getElementById(id);
const routeSlug=()=>{
 const hash=location.hash.replace(/^#/,"").toLowerCase();
 if(hash==="colosseum/readme")return "colosseum";
 if(hash==="apple-hig-reader/readme")return "apple-hig-reader";
 return /^project\/([a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?)\/readme$/.exec(hash)?.[1]||null;
};
const slugRoute=slug=>slug==="colosseum"?"colosseum/readme":slug==="apple-hig-reader"?"apple-hig-reader/readme":"project/"+slug+"/readme";
const repoValid=value=>/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(value);
function api(path,method="GET",body){
 const opts={method,credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}};
 if(body!==undefined){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(body);}
 if(method!=="GET")opts.headers["Origin"]="https://dofinances.com"; // Browser enforces this regardless.
 return fetch(path,opts).then(async res=>{
  let data;try{data=await res.json();}catch{throw Error("The server returned an invalid response.");}
  if(!res.ok)throw Error(data.error||"Request failed (HTTP "+res.status+").");
  return data;
 });
}
const escapeText=text=>String(text||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function fallbackMarkdown(markdown){
 // Accessible, deliberately limited offline preview for unavailable GitHub
 // rendering. This never treats user-controlled Markdown as HTML.
 return markdown.split(/\r?\n/).map(line=>{
  const match=/^(#{1,6})\s+(.+)$/.exec(line);
  if(match)return "<h"+match[1].length+">"+escapeText(match[2])+"</h"+match[1].length+">";
  return line.trim()?'<p>'+escapeText(line)+'</p>':"";
 }).join("\n");
}
function safeAssetPath(value,project){
 if(!project?.repository||typeof value!=="string")return null;
 if(/^https?:\/\//i.test(value))return null;
 let path=value.split(/[?#]/)[0];
 if(!path||path.startsWith("/")||path.includes("\\")||/%2f|%5c/i.test(path))return null;
 const base=(project.path||"README.md").split("/").slice(0,-1);
 for(const part of path.split("/")){
  if(!part||part===".")continue;
  if(part===".."){if(!base.length)return null;base.pop();continue;}
  if(!/^[A-Za-z0-9._-]+$/.test(part))return null;
  base.push(part);
 }
 if(!/\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(base.join("/")))return null;
 return "/api/projects/"+encodeURIComponent(project.slug)+"/asset?path="+encodeURIComponent(base.join("/"));
}
function sanitizeMarkdown(html,project){
 // Allowlist reconstruction, not blacklist string cleanup: never attach
 // arbitrary HTML, style, SVG, event handlers, iframes, or javascript URLs.
 const doc=new DOMParser().parseFromString("<div>"+html+"</div>","text/html");
 const allowed=new Set("a p h1 h2 h3 h4 h5 h6 span div strong em b i s del ins blockquote pre code kbd samp ul ol li table thead tbody tr th td hr br img input details summary sup sub dl dt dd picture figure figcaption video".split(" "));
 const textAttrs=new Set(["title","alt","aria-label","aria-hidden","role","id","class","align"]);
 const cleanNode=node=>{
  if(node.nodeType===3)return document.createTextNode(node.nodeValue);
  if(node.nodeType!==1)return document.createDocumentFragment();
  const tag=node.localName.toLowerCase();
  if(!allowed.has(tag)){
   const frag=document.createDocumentFragment();
   // Unknown nodes are unwrapped, except known active/executable surfaces.
   if(["script","style","iframe","object","embed","form","button","textarea","svg","math","audio","source","link","meta"].includes(tag))return frag;
   for(const child of node.childNodes)frag.append(cleanNode(child));
   return frag;
  }
  const el=document.createElement(tag);
  for(const {name,value} of node.attributes){
   if(name==="href"&&tag==="a"){
    try{
     const u=new URL(value, "https://github.com/");
     if(/^#[a-zA-Z0-9_:-]{1,120}$/.test(value))el.setAttribute("href","#readme-"+value.slice(1));
     else if(["https:","http:"].includes(u.protocol)){el.href=u.href;el.rel="noopener noreferrer";if(u.origin!==location.origin)el.target="_blank";}
    }catch{}
   }else if(name==="src"&&tag==="img"){
    try{
     const u=new URL(value,"https://github.com/");
     const asset=safeAssetPath(value,project);
     if(asset)el.src=asset;
     else if(["https:","http:"].includes(u.protocol)&&/^https?:\/\//.test(value))el.src=u.href;
    }catch{}
   }else if(name==="type"&&tag==="input"&&value==="checkbox"){el.type="checkbox";el.disabled=true;}
   else if(name==="checked"&&tag==="input"){el.checked=true;el.disabled=true;}
   else if(name==="start"&&tag==="ol"&&/^\d{1,5}$/.test(value))el.setAttribute("start",value);
   else if(name==="colspan"&&["td","th"].includes(tag)&&/^\d{1,2}$/.test(value))el.setAttribute("colspan",value);
   else if(name==="rowspan"&&["td","th"].includes(tag)&&/^\d{1,2}$/.test(value))el.setAttribute("rowspan",value);
   else if(textAttrs.has(name)){
    if(name==="id"&&!/^[a-zA-Z0-9_:-]{1,120}$/.test(value))continue;
    if(name==="class"&&!/^[a-zA-Z0-9_\- ]{1,180}$/.test(value))continue;
    el.setAttribute(name,name==="id"?"readme-"+value:value.slice(0,180));
   }
  }
  for(const child of node.childNodes)el.append(cleanNode(child));
  return el;
 };
 const fragment=document.createDocumentFragment();
 for(const node of doc.body.firstElementChild?.childNodes||[])fragment.append(cleanNode(node));
 return fragment;
}
export function makeReadmeDiff(before,after){
 const a=before.split("\n"),b=after.split("\n"),max=450;
 let lines=[];
 if(a.length>max||b.length>max){
  let common=0;while(common<Math.min(a.length,b.length)&&a[common]===b[common])common++;
  lines=[...a.slice(0,common).map(text=>({type:"context",text})),
    ...a.slice(common).map(text=>({type:"removed",text})),...b.slice(common).map(text=>({type:"added",text}))];
 }else{
  const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>new Uint16Array(n+1));
  for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)
   dp[i][j]=a[i]===b[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  for(let i=0,j=0;i<m||j<n;){
   if(i<m&&j<n&&a[i]===b[j]){lines.push({type:"context",text:a[i]});i++;j++;}
   else if(i<m&&(j===n||dp[i+1][j]>=dp[i][j+1]))lines.push({type:"removed",text:a[i++]});
   else lines.push({type:"added",text:b[j++]});
  }
 }
 // Keep context near changes; the raw textarea always retains every line.
 const changes=lines.flatMap((x,i)=>x.type==="context"?[]:[i]);
 if(!changes.length)return [];
 const keep=new Set();for(const i of changes)for(let j=Math.max(0,i-3);j<=Math.min(lines.length-1,i+3);j++)keep.add(j);
 let out=[],prev=-2;
 [...keep].sort((a,b)=>a-b).forEach(i=>{if(i>prev+1)out.push({type:"context",text:"…"});out.push(lines[i]);prev=i;});
 return out;
}
export function initProjectReadme(){
 const view=$("rm-reading")?.closest(".rm-view");
 const cards=$("project-list"),create=$("project-create"),createDialog=$("project-create-dialog");
 if(!view||!cards||view.dataset.initialized==="true")return;
 view.dataset.initialized="true";
 const edit=$("rm-edit"),confirm=$("rm-confirm"),diffButton=$("rm-diff"),editor=$("rm-editor");
 const textarea=$("rm-markdown"),preview=$("rm-preview"),reading=$("rm-reading"),notice=$("rm-notice");
 const diffPanel=$("rm-diff-panel"),diffContent=$("rm-diff-content");
 const form=$("project-create-form"),repoForm=$("rm-repository-form");
 const state={projects:[],slug:null,source:null,original:"",dirty:false,editing:false,canEdit:false,
   renderTicket:0,loadTicket:0,renderDelay:null,processing:false,loaded:false};
 const say=(message,error=false,success=false,node=notice)=>{
  node.hidden=!message;node.textContent=message||"";node.classList.toggle("rm-error",!!error);node.classList.toggle("rm-success",!!success);
 };
 const active=()=>!!routeSlug()&&!view.hidden;
 const source=()=>state.source;
 const setBusy=flag=>{
  state.processing=flag;
  textarea.disabled=flag;
  confirm.disabled=flag;
  edit.disabled=flag;
 };
 const paintControls=()=>{
  view.classList.toggle("rm-editing",state.editing);
  const dirty=state.editing&&textarea.value!==state.original;
  state.dirty=dirty;
  confirm.hidden=!dirty;
  diffButton.hidden=!dirty;
  edit.setAttribute("aria-label",state.editing?"Cancel README edits":"Edit README");
  $("rm-edit-tooltip").textContent=state.editing?"Cancel editing · ⇧⌘E":"Edit README · ⇧⌘E";
  if(!dirty){diffPanel.hidden=true;diffButton.setAttribute("aria-pressed","false");}
  reading.hidden=state.editing;editor.hidden=!state.editing;
 };
 const exitEdit=()=>{
  state.editing=false;
  textarea.value=state.original;
  ++state.renderTicket;
  paintControls();
 };
 async function renderMarkup(markdown,target,slug){
  const ticket=++state.renderTicket;
  let html;
  try{html=(await api("/api/projects/render","POST",{markdown,slug})).html;}
  catch(error){html=fallbackMarkdown(markdown);if(target===reading&&active())say("GitHub Markdown rendering unavailable; using a basic text preview. "+error.message,true);}
  if(ticket!==state.renderTicket||!view.isConnected)return;
  target.replaceChildren(sanitizeMarkdown(html,{slug,repository:source()?.project?.repository,path:source()?.path}));
 }
 function populateProjectCards(projects){
  const fragment=document.createDocumentFragment();
  for(const p of projects){
   const link=document.createElement("a");link.className="project-card";link.href="#"+slugRoute(p.slug);
   link.setAttribute("aria-label","Open "+p.name+" project");
   const emblem=document.createElement("span");emblem.className="project-emblem large";emblem.textContent=p.name.charAt(0).toUpperCase();
   const copy=document.createElement("span");copy.className="project-card-copy";
   const title=document.createElement("strong");title.textContent=p.name;
   const meta=document.createElement("span");meta.textContent=p.repository||"Local README · No GitHub repository";
   copy.append(title,meta);
   const arrow=document.createElement("span");arrow.className="open-project";
   const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
   icon.setAttribute("class","nav-icon");icon.setAttribute("aria-hidden","true");
   const use=document.createElementNS("http://www.w3.org/2000/svg","use");use.setAttribute("href","#icon-chevron");
   icon.append(use);arrow.append(icon);link.append(emblem,copy,arrow);fragment.append(link);
  }
  cards.replaceChildren(fragment);
  $("project-count").textContent=projects.length+" project"+(projects.length===1?"":"s");
  setWorkspaceProjectRegistry(projects);
 }
 async function loadProjects(){
  try{
   const result=await api("/api/projects");state.projects=result.projects;state.loaded=true;
   populateProjectCards(state.projects);
  }catch(error){say("Could not load project list: "+error.message,true,false,$("project-list-feedback"));}
 }
 async function loadReadme(){
  const slug=routeSlug();
  if(!slug){state.slug=null;exitEdit();return;}
  if(state.editing&&state.dirty){ // Never silently discard a pending editor draft on route change.
   if(!confirm("Discard your unsaved README changes?")){location.hash="#"+slugRoute(state.slug);return;}
  }
  const ticket=++state.loadTicket;
  state.slug=slug;state.source=null;state.original="";state.canEdit=false;state.editing=false;
  reading.textContent="Loading README…";say("");
  $("rm-project-label").textContent=(state.projects.find(p=>p.slug===slug)?.name||slug).toUpperCase();
  $("rm-repository-label").textContent="Loading repository association…";
  textarea.value="";diffContent.replaceChildren();paintControls();
  try{
   const data=await api("/api/projects/"+encodeURIComponent(slug)+"/readme");
   if(ticket!==state.loadTicket||!active())return;
   state.source=data;state.original=data.markdown||"";
   state.canEdit=!!data.canEdit;textarea.value=state.original;
   $("rm-project-label").textContent=(data.project.name||slug).toUpperCase();
   $("rm-repository-label").textContent=data.project.repository?
      data.project.repository+(data.private?" · Private":""):"Local README · No linked GitHub repository";
   $("rm-repository-input").value=data.project.repository||"";
   $("rm-presentation").value=data.project.presentation||"github";
   view.dataset.presentation=data.project.presentation||"github";
   if(data.source==="unavailable"||data.source==="missing"){
    say((data.error||"Repository README unavailable.")+" Showing the project's default README.",true);
   }
   const previousTicket=state.renderTicket;
   void renderMarkup(state.original,reading,slug);
   if(!state.canEdit)edit.setAttribute("data-readonly","true");
   else edit.removeAttribute("data-readonly");
  }catch(error){if(ticket!==state.loadTicket)return;
   reading.textContent="Unable to load this project's README.";
   say(error.message,true);
  }
 }
 async function startEdit(){
  if(!active())return;
  if(state.editing){exitEdit();return;}
  if(!state.source){say("The README is still loading. Please retry.",true);return;}
  if(!state.canEdit){
   const credentials=state.source.requiresConnection;
   say(credentials?
     "Editing is unavailable: configure a GitHub token with Contents: Read and write permission in Settings first.":
     "Editing is not permitted for this repository with your currently validated GitHub credentials. Check repository write access in Settings.",true);
   return;
  }
  say("");
  state.editing=true;textarea.value=state.original;paintControls();
  void renderMarkup(textarea.value,preview,state.slug);
  textarea.focus({preventScroll:true});
 }
 // Internal GitHub heading links scroll within the README, without hijacking
 // the workspace's hash-router navigation or colliding with control IDs.
 for(const container of [reading,preview])container.addEventListener("click",event=>{
  const link=event.target.closest?.('a[href^="#readme-"]');
  if(!link||!container.contains(link))return;
  const target=container.querySelector('[id="'+link.getAttribute("href").slice(1)+'"]');
  if(!target)return;
  event.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});
 });
 edit.addEventListener("click",()=>void startEdit());
 textarea.addEventListener("input",()=>{
  if(!state.editing)return;
  paintControls();
  if(state.renderDelay!==null)clearTimeout(state.renderDelay);
  state.renderDelay=setTimeout(()=>{if(state.editing)void renderMarkup(textarea.value,preview,state.slug)},220);
  if(!diffPanel.hidden)drawDiff();
 });
 function drawDiff(){
  diffContent.replaceChildren();
  const changes=makeReadmeDiff(state.original,textarea.value);
  if(!changes.length){const empty=document.createElement("div");empty.className="rm-diff-empty";empty.textContent="No changes.";diffContent.append(empty);return;}
  for(const line of changes){
   const div=document.createElement("div");div.className="rm-diff-line rm-diff-"+line.type;
   div.textContent=line.text||" ";diffContent.append(div);
  }
 }
 diffButton.addEventListener("click",()=>{
  if(!state.editing||!state.dirty)return;
  diffPanel.hidden=!diffPanel.hidden;
  diffButton.setAttribute("aria-pressed",String(!diffPanel.hidden));
  if(!diffPanel.hidden){drawDiff();diffPanel.scrollIntoView({block:"nearest",behavior:"smooth"});}
 });
 confirm.addEventListener("click",async()=>{
  if(!state.editing||!state.dirty||state.processing)return;
  const content=textarea.value,slug=state.slug;
  setBusy(true);say("Saving README…");
  try{
   const res=await api("/api/projects/"+encodeURIComponent(slug)+"/readme","PUT",
     {markdown:content,sha:state.source?.sha||null,path:state.source?.path||"README.md"});
   if(routeSlug()!==slug){exitEdit();return;}
   state.original=content;state.source={...state.source,sha:res.sha||null,path:res.path||state.source?.path,markdown:content,source:res.local?"local":"github"};
   exitEdit();
   await renderMarkup(content,reading,slug);
   say("README saved"+(res.commit?" to GitHub · "+res.commit.slice(0,8):" locally")+".",false,true);
  }catch(error){say("README not saved: "+error.message,true);}
  finally{setBusy(false);}
 });
 window.addEventListener("keydown",event=>{
  if(!active()||event.defaultPrevented||event.repeat||event.isComposing)return;
  if(event.shiftKey&&(event.metaKey||event.ctrlKey)&&!event.altKey&&event.code==="KeyE"){
   event.preventDefault();void startEdit();
  }
 });
 $("rm-presentation").addEventListener("change",async event=>{
  const slug=state.slug,style=event.target.value;
  if(!slug||!["github","minimal","reader"].includes(style))return;
  try{
   const res=await api("/api/projects/"+slug+"/presentation","PUT",{presentation:style});
   view.dataset.presentation=style;
   say("README presentation updated for "+res.project.name+".",false,true);
  }catch(error){say("Could not update presentation: "+error.message,true);event.target.value=view.dataset.presentation||"github";}
 });
 repoForm.addEventListener("submit",async event=>{
  event.preventDefault();const slug=state.slug;if(!slug||state.processing)return;
  const repository=$("rm-repository-input").value.trim();
  if(repository&&!repoValid(repository)){say("Enter a GitHub repository as owner/name.",true);return;}
  try{
   setBusy(true);
   const result=await api("/api/projects/"+slug+"/repository","PUT",{repository:repository||null});
   say("Repository association updated.",false,true);
   await loadProjects();
   await loadReadme();
  }catch(error){say("Could not update repository: "+error.message,true);}
  finally{setBusy(false);}
 });
 create?.addEventListener("click",()=>{
  $("project-create-error").hidden=true;$("project-create-name").value="";$("project-create-repository").value="";
  createDialog.showModal();$("project-create-name").focus();
 });
 $("project-create-cancel")?.addEventListener("click",()=>createDialog.close());
 form?.addEventListener("submit",async event=>{
  event.preventDefault();const name=$("project-create-name").value.trim(),repository=$("project-create-repository").value.trim();
  if(repository&&!repoValid(repository)){say("Repository must be owner/name.",true,false,$("project-create-error"));return;}
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{
   const data=await api("/api/projects","POST",{name,...(repository?{repository}:{})});
   createDialog.close();await loadProjects();
   location.hash="#"+slugRoute(data.project.slug);
   if(routeSlug()===data.project.slug)void loadReadme();
  }catch(error){say("Project not created: "+error.message,true,false,$("project-create-error"));}
  finally{button.disabled=false;}
 });
 const githubStatus=$("github-readme-status"),githubForm=$("github-readme-form"),githubToken=$("github-readme-token");
 async function refreshConnection(){
  try{
   const c=await api("/api/github/connection");
   githubStatus.textContent=c.connected?"Connected as "+c.login:"Not connected";
   $("github-readme-remove").disabled=!c.connected;
   if(!c.encrypted)say("Server-side token encryption is not configured.",true,false,$("github-readme-feedback"));
  }catch(error){githubStatus.textContent="Connection unavailable";say(error.message,true,false,$("github-readme-feedback"));}
 }
 githubForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const token=githubToken.value.trim();githubToken.value="";
  const button=githubForm.querySelector('button[type="submit"]');button.disabled=true;
  try{
   const state=await api("/api/github/connection","POST",{token});
   say("GitHub repository credentials validated and saved for "+state.login+".",false,true,$("github-readme-feedback"));
   await refreshConnection();if(active())void loadReadme();
  }catch(error){say("Could not connect GitHub: "+error.message,true,false,$("github-readme-feedback"));}
  finally{button.disabled=false;}
 });
 $("github-readme-remove")?.addEventListener("click",async()=>{
  try{
   await api("/api/github/connection","DELETE");
   say("GitHub repository credentials disconnected.",false,true,$("github-readme-feedback"));
   await refreshConnection();if(active())void loadReadme();
  }catch(error){say(error.message,true,false,$("github-readme-feedback"));}
 });
 function routeChanged(){void loadReadme();}
 window.addEventListener("hashchange",routeChanged);
 window.addEventListener("popstate",routeChanged);
 void loadProjects().then(()=>{if(active())void loadReadme()});
 void refreshConnection();
}
