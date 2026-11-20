// File paths and tree DOM for project Docs. Pure path resolution is exported
// for tests; all labels are textContent, never interpolated HTML.
export const emphasizedFile=path=>/\.(?:md|mdx|json|ya?ml|txt)$/i.test(path||"");
export const markdownFile=path=>/\.(?:md|mdx)$/i.test(path||"");
// The Docs heading already contains the file name. Its location contains only
// the repository and the enclosing directory (empty for root-level files).
export const repositoryDirectory=path=>{
 if(typeof path!=="string")return "";
 const segments=path.split("/").filter(Boolean);
 return segments.length>1?segments.slice(0,-1).join("/"):"";
};
export function resolveRepoLink(value,currentPath,repository,branch){
 if(typeof value!=="string"||!value.trim())return null;
 let href=value.trim(),repoPath=null;
 let fragment="",query="";
 if(href.startsWith("#"))return {path:currentPath,fragment:decodeSafe(href.slice(1))};
 if(/^[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith("//")){
  let url;try{url=new URL(href);}catch{return null;}
  if(url.protocol!=="https:"||!repository)return null;
  const parts=url.pathname.split("/").filter(Boolean).map(decodeSafe),repo=repository.split("/");
  if(parts[0]!==repo[0]||parts[1]!==repo[1])return null;
  let tail;
  if(url.hostname==="github.com"&&["blob","raw"].includes(parts[2]))tail=parts.slice(3);
  else if(url.hostname==="raw.githubusercontent.com")tail=parts.slice(2);
  else return null;
  const candidate=(branch||"main").split("/");
  const ref=tail.slice(0,candidate.length);
  if(ref.join("/")!==candidate.join("/")&&ref[0]!=="HEAD")return null;
  repoPath=tail.slice(ref[0]==="HEAD"?1:candidate.length).join("/");
  fragment=decodeSafe(url.hash.slice(1));query=url.search;
 }else{
  const h=href.indexOf("#");if(h>=0){fragment=decodeSafe(href.slice(h+1));href=href.slice(0,h);}
  const q=href.indexOf("?");if(q>=0){query=href.slice(q);href=href.slice(0,q);}
  if(!href)return {path:currentPath,fragment};
  const pathBase=href.startsWith("/")?[]:(currentPath||"").split("/").slice(0,-1);
  repoPath=[...pathBase,href.replace(/^\//,"")].join("/");
 }
 if(/(?:\0|\\)/.test(repoPath)||query.length>512)return null;
 const parts=[];
 for(const raw of repoPath.split("/")){
  let part=decodeSafe(raw);
  if(!part||part===".")continue;
  if(part===".."){if(!parts.length)return null;parts.pop();continue;}
  if(/[\\\u0000-\u001f?#]/u.test(part))return null;
  parts.push(part);
 }
 if(!parts.length||parts.join("/").length>500)return null;
 return {path:parts.join("/"),fragment};
}
function decodeSafe(s){try{return decodeURIComponent(s);}catch{return s;}}
export function repositoryTree(entries){
 const root={name:"",path:"",type:"tree",children:[]},map=new Map([["",root]]);
 for(const entry of entries||[]){
  if(!entry||typeof entry.path!=="string"||!["blob","tree"].includes(entry.type))continue;
  const parts=entry.path.split("/");let prev=root,current="";
  for(let i=0;i<parts.length;i++){
   const name=parts[i];if(!name||name==="."||name==="..")break;
   current=current?current+"/"+name:name;
   let node=map.get(current);
   if(!node){node={name,path:current,type:i===parts.length-1?entry.type:"tree",
    children:[],size:i===parts.length-1?entry.size:null};map.set(current,node);prev.children.push(node);}
   prev=node;
  }
 }
 const sort=node=>{node.children.sort((a,b)=>(a.type==="tree"?0:1)-(b.type==="tree"?0:1)||
   a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
   for(const child of node.children)sort(child);};
 sort(root);return root;
}
export function renderRepositoryTree(target,entries,selectedPath,onChoose){
 const root=repositoryTree(entries);
 const ul=document.createElement("ul");ul.className="rm-file-branch rm-file-root";
 const render=(items,parent,level)=>{
  for(const node of items){
   const li=document.createElement("li");li.className="rm-file-node";
   if(node.type==="tree"){
    const details=document.createElement("details");details.className="rm-file-folder";
    details.open=selectedPath?.startsWith(node.path+"/")||false;
    const sum=document.createElement("summary");
    const icon=document.createElement("span");icon.className="rm-tree-folder-icon";icon.setAttribute("aria-hidden","true");
    sum.append(icon,document.createTextNode(node.name));details.append(sum);
    const nested=document.createElement("ul");nested.className="rm-file-branch";
    render(node.children,nested,level+1);details.append(nested);li.append(details);
   }else{
    const button=document.createElement("button");
    button.type="button";button.className="rm-file-entry";
    if(!emphasizedFile(node.path))button.classList.add("rm-file-muted");
    if(node.path===selectedPath)button.setAttribute("aria-current","true");
    button.title=node.path;
    button.dataset.filePath=node.path;
    button.style.paddingLeft="19px";
    const text=document.createElement("span");text.className="rm-file-name";text.textContent=node.name;
    button.append(text);
    button.addEventListener("click",()=>onChoose(node.path));li.append(button);
   }
   parent.append(li);
  }
 };
 render(root.children,ul,0);target.replaceChildren(ul);
 return root.children.length;
}
