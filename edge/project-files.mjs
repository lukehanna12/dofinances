// GitHub repository browsing for Docs. No token, raw file bytes, or redirects
// are ever exposed to the browser; requests stay under api.github.com.
import {GITHUB_REPOSITORY,githubRequest,githubError} from "./project-readme.mjs";
export function validRepositoryPath(path){
 return typeof path==="string"&&path.length>0&&path.length<=500&&!path.startsWith("/")&&
  !/[\\\u0000-\u001f\u007f]/u.test(path)&&!path.includes("//")&&
  path.split("/").every(part=>part.length>0&&part!=="."&&part!==".."&&!/[?#]/u.test(part));
}
const segments=p=>p.split("/").map(encodeURIComponent).join("/");
async function jsonResult(response){
 const raw=await response.text();
 if(raw.length>8500000)throw Error("GitHub repository listing exceeded the safety limit.");
 try{return JSON.parse(raw);}catch{throw Error("GitHub returned an invalid repository response.");}
}
export async function githubFileTree(repository,token,branch,fetcher=fetch){
 if(!GITHUB_REPOSITORY.test(repository||"")||typeof branch!=="string"||
    !branch||branch.length>180||/[?#\\\u0000-\u001f]/u.test(branch))
   throw Error("Invalid GitHub repository branch.");
 const response=await githubRequest("/repos/"+repository+"/git/trees/"+
  encodeURIComponent(branch)+"?recursive=1",{token},fetcher);
 const data=await jsonResult(response);
 if(!response.ok)return {ok:false,status:response.status,error:githubError(response,data,!!token)};
 if(!Array.isArray(data.tree))return {ok:false,status:502,error:"GitHub returned an invalid repository tree."};
 const filtered=data.tree.filter(entry=>(entry.type==="blob"||entry.type==="tree")&&validRepositoryPath(entry.path));
 return {ok:true,entries:filtered.slice(0,20000).map(entry=>({
  path:entry.path,type:entry.type,size:Number.isFinite(entry.size)?entry.size:null
 })),truncated:!!data.truncated||filtered.length>20000};
}
export async function githubDocument(repository,token,path,fetcher=fetch){
 if(!GITHUB_REPOSITORY.test(repository||"")||!validRepositoryPath(path))throw Error("Invalid document path.");
 const response=await githubRequest("/repos/"+repository+"/contents/"+segments(path),{token},fetcher);
 const data=await jsonResult(response);
 if(!response.ok)return {ok:false,status:response.status,error:githubError(response,data,!!token)};
 if(data.type!=="file"||typeof data.sha!=="string"||!validRepositoryPath(data.path))
  return {ok:false,status:422,error:"This repository entry is not a regular file."};
 const size=Number(data.size)||0;
 const explicitBinary=/\.(?:png|jpe?g|gif|webp|avif|svg|pdf|ico|woff2?|ttf|otf|mp[34]|mov|zip|gz|xz|br|wasm|exe|dmg)$/i.test(data.path);
 let content=null;
 if(!explicitBinary&&size<=180000&&data.encoding==="base64"&&typeof data.content==="string"){
  try{
   const base64=data.content.replace(/\s/g,"");
   const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
   content=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   if(/[\u0000-\u0008\u000e-\u001f]/u.test(content))content=null;
  }catch{content=null;}
 }
 return {ok:true,path:data.path,sha:data.sha,size,content,binary:content===null,
  kind:/\.(?:md|mdx)$/i.test(data.path)?"markdown":"text"};
}
