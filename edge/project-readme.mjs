// Fixed-host GitHub repository README adapter. No arbitrary HTTP proxy,
// access tokens are never returned to the browser, and commits are SHA-guarded.
const utf8=new TextEncoder(),decoder=new TextDecoder();
export const GITHUB_REPOSITORY=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const VALID_README_PATH=/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]{1,230}$/;
const headers=token=>({
 "Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
 "User-Agent":"DoFinances-Project-README/1.0",
 ...(token?{"Authorization":"Bearer "+token}:{})
});
const encodeSegments=s=>s.split("/").map(encodeURIComponent).join("/");
function parseEnvelope(s){if(typeof s!=="string"||!/^v1\.[0-9a-f]{24}\.[A-Za-z0-9_-]{16,}$/.test(s))throw Error("Invalid encrypted GitHub token.");return s.split(".");}
function base64url(bytes){let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function fromBase64url(s){const raw=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function encryptionKey(secret){
 if(typeof secret!=="string"||secret.length<32)throw Error("Encrypted GitHub connection storage is not configured.");
 const bytes=await crypto.subtle.digest("SHA-256",utf8.encode("dofinances/github-readme/token-v1|"+secret));
 return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function sealGithubToken(token,secret,userId){
 if(typeof token!=="string"||token.length<12||token.length>1024||/\s/.test(token))throw Error("Enter a valid GitHub personal access token.");
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:utf8.encode("github-readme-v1:"+userId)},
   await encryptionKey(secret),utf8.encode(token));
 return "v1."+Array.from(iv,b=>b.toString(16).padStart(2,"0")).join("")+"."+base64url(new Uint8Array(ciphertext));
}
export async function openGithubToken(envelope,secret,userId){
 const [,ivHex,ciphertext]=parseEnvelope(envelope);
 const iv=Uint8Array.from(ivHex.match(/.{2}/g),v=>parseInt(v,16));
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:utf8.encode("github-readme-v1:"+userId)},
  await encryptionKey(secret),fromBase64url(ciphertext));
 return decoder.decode(plain);
}
export async function githubRequest(path,{token,method="GET",body,accept}={},fetcher=fetch){
 if(!/^\/(?:repos\/[A-Za-z0-9_.%-]+\/[A-Za-z0-9_.%-]+(?:\/[A-Za-z0-9._%/-]+)?|user|markdown)$/.test(path)||
   path.includes("..")||path.includes("//"))throw Error("Invalid GitHub API path.");
 const response=await fetcher("https://api.github.com"+path,{
  method,redirect:"manual",headers:{"Content-Type":"application/json",...headers(token),...(accept?{Accept:accept}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 if(response.status>=300&&response.status<400)throw Error("GitHub returned an unexpected redirect.");
 return response;
}
async function safeJson(response){const text=await response.text();if(text.length>2100000)throw Error("GitHub response exceeded safe size.");try{return JSON.parse(text);}catch{throw Error("GitHub returned an invalid response.");}}
export function githubError(response,details={},connected=false){
 if(response.status===404)return connected?
  "Repository or README not accessible with these GitHub credentials. Check Settings and repository permissions.":
  "GitHub README not available publicly. Connect a GitHub token in Settings to access private repositories.";
 if(response.status===401)return "GitHub rejected the saved credentials. Replace the token in Settings.";
 if(response.status===403)return "GitHub denied this operation. Check token permissions (Contents: Read and write) in Settings.";
 if(response.status===409)return "The README changed on GitHub. Reload it before saving to avoid overwriting another edit.";
 if(response.status===422)return "GitHub rejected the README update. Check the branch, file path, and token permissions.";
 if(response.status===429)return "GitHub rate limit reached. Try again after the limit resets.";
 return String(details.message||"GitHub request failed (HTTP "+response.status+").").slice(0,280);
}
export async function githubIdentity(token,fetcher=fetch){
 const response=await githubRequest("/user",{token},fetcher);
 const data=await safeJson(response);
 if(!response.ok||typeof data.login!=="string")throw Error(githubError(response,data,true));
 return {login:data.login};
}
export async function githubRepository(repository,token,fetcher=fetch){
 if(!GITHUB_REPOSITORY.test(repository||""))throw Error("Repository must be owner/name.");
 const response=await githubRequest("/repos/"+repository,{token},fetcher);
 const data=await safeJson(response);
 if(!response.ok)return {ok:false,status:response.status,error:githubError(response,data,!!token)};
 // Repository permission alone is not sufficient for a contents write; the
 // save endpoint enforces the token's real Github API write capability too.
 return {ok:true,defaultBranch:data.default_branch||null,private:!!data.private,
  canEdit:!!token&&!!(data.permissions?.push||data.permissions?.admin||data.permissions?.maintain)};
}
export async function githubReadme(repository,token,fetcher=fetch){
 if(!GITHUB_REPOSITORY.test(repository||""))throw Error("Repository must be owner/name.");
 const response=await githubRequest("/repos/"+repository+"/readme",{token},fetcher);
 const data=await safeJson(response);
 if(!response.ok)return {ok:false,status:response.status,error:githubError(response,data,!!token)};
 if(data.encoding!=="base64"||typeof data.content!=="string"||typeof data.sha!=="string"||
   typeof data.path!=="string"||!VALID_README_PATH.test(data.path)||
   data.size>180000)return {ok:false,status:422,error:"GitHub README is not a supported text document (maximum 180 KB)."};
 const raw=fromBase64url(data.content.replace(/\s/g,"").replace(/\+/g,"-").replace(/\//g,"_"));
 const markdown=decoder.decode(raw);
 return {ok:true,sha:data.sha,path:data.path,markdown};
}
export async function githubSaveReadme(repository,token,{path="README.md",markdown,sha},fetcher=fetch){
 if(!GITHUB_REPOSITORY.test(repository||"")||!VALID_README_PATH.test(path)||!/^README(?:\.[a-zA-Z0-9_-]{1,15})?$/i.test(path.split("/").pop()))throw Error("Invalid README path.");
 if(typeof markdown!=="string"||markdown.length>180000)throw Error("README exceeds 180 KB.");
 if(sha!==null&&sha!==undefined&&(typeof sha!=="string"||!/^[a-f0-9]{40}$/.test(sha)))throw Error("Invalid README revision.");
 const bytes=utf8.encode(markdown);
 const response=await githubRequest("/repos/"+repository+"/contents/"+encodeSegments(path),
  {token,method:"PUT",body:{message:"docs: update README from DoFinances",content:base64url(bytes).replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(bytes.length/3)*4,"="),...(sha?{sha}:{})}},fetcher);
 const data=await safeJson(response);
 if(!response.ok)return {ok:false,status:response.status,error:githubError(response,data,true)};
 return {ok:true,sha:data.content?.sha||null,path:data.content?.path||path,commit:data.commit?.sha||null};
}
export async function githubMarkdown(markdown,repository,token,fetcher=fetch){
 if(typeof markdown!=="string"||markdown.length>180000)throw Error("README exceeds 180 KB.");
 if(repository&&!GITHUB_REPOSITORY.test(repository))throw Error("Invalid project repository.");
 const response=await githubRequest("/markdown",{token,method:"POST",body:{text:markdown,mode:"gfm",...(repository?{context:repository}:{})}},fetcher);
 const html=await response.text();
 if(!response.ok)throw Error(githubError(response,{message:html.slice(0,100)},!!token));
 if(html.length>1000000)throw Error("Rendered README is too large.");
 return html;
}
