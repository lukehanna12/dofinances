// Authenticated, account-scoped README and project REST gateway.
// GitHub access is intentionally separate from identity-only OAuth and Colosseum.
import {GITHUB_REPOSITORY,githubIdentity,githubRepository,githubReadme,githubSaveReadme,githubMarkdown,
 sealGithubToken,openGithubToken,githubRequest,githubError} from "./project-readme.mjs";
import {githubFileTree,githubDocument,validRepositoryPath} from "./project-files.mjs";
const NO_STORE={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"};
const json=(body,status=200)=>Response.json(body,{status,headers:NO_STORE});
const secret=env=>env.MFA_ENCRYPTION_KEY||env.GITHUB_PROJECT_TOKEN_ENCRYPTION_KEY;
const SLUG=/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
async function bodyFrom(request,max=185000){
 if(request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase()!=="application/json")
  throw Object.assign(Error("Expected JSON."),{status:415});
 const length=Number(request.headers.get("Content-Length")||0);
 if(!Number.isFinite(length)||length>max)throw Object.assign(Error("Request too large."),{status:413});
 const raw=await request.text();
 if(raw.length>max)throw Object.assign(Error("Request too large."),{status:413});
 let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error("Invalid JSON."),{status:400});}
 if(!body||Array.isArray(body)||typeof body!=="object")throw Object.assign(Error("Expected an object."),{status:400});
 return body;
}
const fields=(body,allowed)=>Object.keys(body).every(x=>allowed.includes(x));
async function storedToken(stub,env,userId){
 const r=await stub.githubProjectConnection({userId,includeCredential:true});
 if(!r.connected)return null;
 if(!secret(env))throw Object.assign(Error("Encrypted GitHub credential storage is unavailable."),{status:503});
 return openGithubToken(r.ciphertext,secret(env),userId);
}
async function findProject(stub,userId,slug){
 const result=await stub.projectGet({userId,slug});
 if(result.status!==200)throw Object.assign(Error(result.error),{status:result.status});
 return result.project;
}
function outcome(result,projection=(r=>r)){
 return result.error?json({error:result.error},result.status):json(projection(result),result.status);
}
function formatGithubError(status,detail,token){
 return json({error:githubError({status},detail,!!token)},status>=400&&status<600?status:502);
}
async function projectReadmeGet(stub,env,userId,slug){
 const project=await findProject(stub,userId,slug);
 if(!project.repository)return json({source:"local",project,markdown:project.defaultReadme,sha:null,path:null,canEdit:true});
 let token=await storedToken(stub,env,userId);
 const credentialsConfigured=!!token;
 let repo=await githubRepository(project.repository,token);
 // A fine-grained PAT may be valid but restricted to different repositories.
 // Never let that block a README which GitHub exposes without authentication.
 if(!repo.ok&&token){
  const publiclyAccessible=await githubRepository(project.repository,null);
  if(publiclyAccessible.ok){repo=publiclyAccessible;token=null;}
 }
 if(!repo.ok)return json({source:"unavailable",project,markdown:project.defaultReadme,
  sha:null,path:null,canEdit:false,error:repo.error,requiresConnection:!credentialsConfigured,githubStatus:repo.status});
 let readme=await githubReadme(project.repository,token);
 if(!readme.ok&&token&&!repo.private){
  const publicReadme=await githubReadme(project.repository,null);
  if(publicReadme.ok){readme=publicReadme;repo={...repo,canEdit:false};}
 }
 if(!readme.ok)return json({source:readme.status===404?"missing":"unavailable",project,
  markdown:project.defaultReadme,sha:null,path:"README.md",canEdit:repo.canEdit,
  error:readme.error,requiresConnection:!credentialsConfigured,githubStatus:readme.status});
 return json({source:"github",project,markdown:readme.markdown,sha:readme.sha,path:readme.path,
  canEdit:repo.canEdit,defaultBranch:repo.defaultBranch,private:repo.private});
}
export async function projectApi(request,env,pathname,user,stub){
 if(!user||!stub)return json({error:"Sign in to manage projects."},401);
 const method=request.method,userId=user.id;
 if(!["GET","POST","PUT","DELETE"].includes(method))return json({error:"Method not allowed."},405);
 if(method!=="GET"&&(request.headers.get("Origin")!=="https://dofinances.com"||
    !["same-origin","none",null].includes(request.headers.get("Sec-Fetch-Site"))))
  return json({error:"Forbidden request origin."},403);
 try{
  if(pathname==="/api/github/connection"){
   if(method==="GET"){
    const r=await stub.githubProjectConnection({userId});
    return json({connected:r.connected,login:r.login,updatedAt:r.updatedAt,encrypted:!!secret(env)});
   }
   if(method==="DELETE"){
    await stub.githubProjectConnectionRemove({userId});
    return json({connected:false,login:null});
   }
   if(method!=="POST")return json({error:"Method not allowed."},405);
   const body=await bodyFrom(request,3500);
   if(!fields(body,["token"]))return json({error:"Unexpected connection field."},400);
   if(!secret(env))return json({error:"Encrypted GitHub credentials are not configured."},503);
   const identity=await githubIdentity(body.token);
   const ciphertext=await sealGithubToken(body.token,secret(env),userId);
   const result=await stub.githubProjectConnectionSave({userId,ciphertext,login:identity.login});
   return outcome(result,r=>({connected:r.connected,login:r.login,updatedAt:r.updatedAt}));
  }
  if(pathname==="/api/projects"){
   if(method==="GET"){
    const r=await stub.projectList({userId});
    return outcome(r,r=>({projects:r.projects.map(({defaultReadme,...p})=>p)}));
   }
   if(method!=="POST")return json({error:"Method not allowed."},405);
   const body=await bodyFrom(request,3000);
   if(!fields(body,["name","repository"]))return json({error:"Unexpected project field."},400);
   const repository=typeof body.repository==="string"?body.repository.trim():null;
   if(repository){
    if(!GITHUB_REPOSITORY.test(repository))return json({error:"Repository must be owner/name."},400);
    const token=await storedToken(stub,env,userId);
    const r=await githubRepository(repository,token);
    if(!r.ok)return json({error:r.error},r.status);
   }
   const result=await stub.projectCreate({userId,name:body.name,repository});
   return outcome(result,r=>{const {defaultReadme,...project}=r.project;return {project};});
  }
  if(pathname==="/api/projects/render"){
   if(method!=="POST")return json({error:"Method not allowed."},405);
   const body=await bodyFrom(request);
   if(!fields(body,["markdown","slug"]))return json({error:"Unexpected rendering field."},400);
   const project=body.slug?await findProject(stub,userId,body.slug):null;
   const token=project?.repository?await storedToken(stub,env,userId):null;
   const html=await githubMarkdown(body.markdown,project?.repository||null,token);
   return json({html});
  }
  const match=/^\/api\/projects\/([a-z0-9-]{1,48})\/(readme|repository|presentation|asset|files|file)$/.exec(pathname);
  if(!match||!SLUG.test(match[1]))return json({error:"Unknown project endpoint."},404);
  const slug=match[1],action=match[2];
  const project=await findProject(stub,userId,slug);
  if(action==="readme"){
   if(method==="GET")return projectReadmeGet(stub,env,userId,slug);
   if(method!=="PUT")return json({error:"Method not allowed."},405);
   const body=await bodyFrom(request);
   if(!fields(body,["markdown","sha","path"])||typeof body.markdown!=="string"||body.markdown.length>180000)
    return json({error:"Invalid README content (180 KB maximum)."},400);
   if(!project.repository){
    const result=await stub.projectSaveLocal({userId,slug,markdown:body.markdown});
    return outcome(result,()=>({saved:true,local:true,sha:null}));
   }
   const token=await storedToken(stub,env,userId);
   if(!token)return json({error:"Editing requires GitHub credentials in Settings with Contents: Read and write.",code:"github_credentials_required"},403);
   const repo=await githubRepository(project.repository,token);
   if(!repo.ok)return json({error:repo.error},repo.status);
   if(!repo.canEdit)return json({error:"Validated GitHub credentials lack permission to push to this repository. Check Contents: Read and write in Settings.",code:"github_write_denied"},403);
   if(!validRepositoryPath(body.path||""))return json({error:"Invalid document path."},400);
   if(typeof body.sha!=="string"||!/^[a-f0-9]{40}$/.test(body.sha))
    return json({error:"Reload this document before saving to obtain its current SHA."},409);
   const saved=await githubSaveReadme(project.repository,token,body);
   return saved.ok?json({saved:true,sha:saved.sha,path:saved.path,commit:saved.commit}):
    json({error:saved.error,code:"github_save_failed"},saved.status);
  }
  if(action==="files"||action==="file"){
   if(method!=="GET")return json({error:"Method not allowed."},405);
   if(!project.repository)return json({error:"This project has no linked GitHub repository."},404);
   let token=await storedToken(stub,env,userId);
   let repo=await githubRepository(project.repository,token);
   if(!repo.ok&&token){
    const publicRepo=await githubRepository(project.repository,null);
    if(publicRepo.ok){token=null;repo=publicRepo;}
   }
   if(!repo.ok)return json({error:repo.error},repo.status);
   const result=action==="files"?
    await githubFileTree(project.repository,token,repo.defaultBranch):
    await githubDocument(project.repository,token,new URL(request.url).searchParams.get("path")||"");
   if(!result.ok)return json({error:result.error},result.status);
   return json({...result,canEdit:repo.canEdit,defaultBranch:repo.defaultBranch,
    repository:project.repository,private:repo.private});
  }
  if(action==="repository"){
   if(method!=="PUT")return json({error:"Method not allowed."},405);
   const body=await bodyFrom(request,1500);
   if(!fields(body,["repository"]))return json({error:"Unexpected repository field."},400);
   const repository=typeof body.repository==="string"?body.repository.trim():null;
   if(repository){
    if(!GITHUB_REPOSITORY.test(repository))return json({error:"Repository must be owner/name."},400);
    const token=await storedToken(stub,env,userId);
    const check=await githubRepository(repository,token);
    if(!check.ok)return json({error:check.error},check.status);
   }
   return outcome(await stub.projectAssociate({userId,slug,repository}),r=>({project:r.project}));
  }
  if(action==="presentation"){
   if(method!=="PUT")return json({error:"Method not allowed."},405);
   const body=await bodyFrom(request,600);
   if(!fields(body,["presentation"]))return json({error:"Unexpected presentation field."},400);
   return outcome(await stub.projectSetPresentation({userId,slug,presentation:body.presentation}),r=>({project:r.project}));
  }
  if(action==="asset"){
   if(method!=="GET")return json({error:"Method not allowed."},405);
   if(!project.repository)return json({error:"No repository."},404);
   const path=new URL(request.url).searchParams.get("path")||"";
   if(!/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]{1,220}\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path))
    return json({error:"Invalid image path."},400);
   const token=await storedToken(stub,env,userId);
   const response=await githubRequest("/repos/"+project.repository+"/contents/"+path.split("/").map(encodeURIComponent).join("/"),{token});
   if(!response.ok)return formatGithubError(response.status,{},token);
   const asset=await response.json();
   if(asset.encoding!=="base64"||asset.size>6000000||typeof asset.content!=="string")
    return json({error:"Image unavailable."},422);
   const bytes=Uint8Array.from(atob(asset.content.replace(/\s/g,"")),c=>c.charCodeAt(0));
   const ext=path.split(".").pop().toLowerCase(),types={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",avif:"image/avif",svg:"image/svg+xml"};
   return new Response(bytes,{headers:{...NO_STORE,"Content-Type":types[ext],"Content-Security-Policy":"sandbox"}});
  }
  return json({error:"Not found."},404);
 }catch(error){
  const status=Number(error?.status)||(/Invalid|exceed|GitHub token|repository|README|credentials|permission/.test(error.message||"")?400:502);
  return json({error:String(error?.message||"Project service unavailable.").slice(0,350)},status>=400&&status<600?status:502);
 }
}
