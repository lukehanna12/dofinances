// Project and repository-credential state belongs to the existing account DO.
// This does not modify Colosseum providers, GitHub sign-in OAuth, or Cloudflare credentials.
import {AuthStore as FederatedAuthStore} from "./auth-store-federated.mjs";
const NOW=()=>Math.floor(Date.now()/1000);
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const repoPattern=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const template=name=>"# "+name+"\n\nWelcome to **"+name+"**.\n\nThis README is the project's default landing page. Associate a GitHub repository to load its README automatically.\n";
const shape=r=>({slug:r.slug,name:r.name,repository:r.repository||null,presentation:r.presentation||"github",updatedAt:r.updated_at,defaultReadme:r.default_readme});
export class AuthStore extends FederatedAuthStore{
 constructor(ctx,env){
  super(ctx,env);
  this.sql.exec("CREATE TABLE IF NOT EXISTS project_records(user_id TEXT NOT NULL,slug TEXT NOT NULL,name TEXT NOT NULL,repository TEXT,default_readme TEXT NOT NULL,presentation TEXT NOT NULL DEFAULT 'github',updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,slug))");
  this.sql.exec("CREATE TABLE IF NOT EXISTS github_project_connections(user_id TEXT PRIMARY KEY,token_ciphertext TEXT NOT NULL,login TEXT NOT NULL,updated_at INTEGER NOT NULL)");
 }
 projectsSeed(userId){
  // Idempotent per-account initialization, also for accounts created pre-projects.
  for(const [slug,name,repository] of [["colosseum","Colosseum","lukehanna12/colosseum"],["apple-hig-reader","Apple HIGs Reader","lukehanna12/apple-higs-reader"]]){
   this.sql.exec("INSERT OR IGNORE INTO project_records(user_id,slug,name,repository,default_readme,presentation,updated_at) VALUES(?,?,?,?,?,'github',?)",userId,slug,name,repository,template(name),NOW());
  }
  // Upgrade previous repository-less Apple Reader records without overriding
  // user-associated repositories or the account's saved README.
  this.sql.exec("UPDATE project_records SET name='Apple HIGs Reader',repository='lukehanna12/apple-higs-reader' WHERE user_id=? AND slug='apple-hig-reader' AND repository IS NULL",userId);
  this.sql.exec("UPDATE project_records SET name='Apple HIGs Reader' WHERE user_id=? AND slug='apple-hig-reader' AND name='Apple HIG Reader'",userId);
 }
 projectList({userId}){
  if(typeof userId!=="string"||!userId)return {status:401,error:"Sign-in required."};
  this.projectsSeed(userId);
  return {status:200,projects:this.sql.exec("SELECT slug,name,repository,default_readme,presentation,updated_at FROM project_records WHERE user_id=? ORDER BY CASE slug WHEN 'colosseum' THEN 0 WHEN 'apple-hig-reader' THEN 1 ELSE 2 END,updated_at,slug",userId).toArray().map(shape)};
 }
 projectGet({userId,slug}){
  if(!slugPattern.test(slug||""))return {status:400,error:"Invalid project identifier."};
  this.projectsSeed(userId);
  const r=this.sql.exec("SELECT slug,name,repository,default_readme,presentation,updated_at FROM project_records WHERE user_id=? AND slug=?",userId,slug).toArray()[0];
  return r?{status:200,project:shape(r)}:{status:404,error:"Project not found."};
 }
 projectCreate({userId,name,repository=null}){
  if(typeof name!=="string"||name.trim().length<2||name.trim().length>80)return {status:400,error:"Project name must be 2–80 characters."};
  const slug=name.trim().normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  if(!slugPattern.test(slug))return {status:400,error:"Choose a project name with letters or numbers."};
  if(repository!==null&&repository!==""&&!repoPattern.test(repository))return {status:400,error:"Repository must be owner/name."};
  this.projectsSeed(userId);
  if(this.sql.exec("SELECT 1 FROM project_records WHERE user_id=? AND slug=?",userId,slug).toArray().length)
   return {status:409,error:"A project with that name already exists."};
  if(this.sql.exec("SELECT COUNT(*) AS n FROM project_records WHERE user_id=?",userId).toArray()[0].n>=50)
   return {status:409,error:"Project limit reached (50)."};
  this.sql.exec("INSERT INTO project_records(user_id,slug,name,repository,default_readme,presentation,updated_at) VALUES(?,?,?,?,?,'github',?)",userId,slug,name,repository||null,template(name.trim()),NOW());
  return {status:201,project:this.projectGet({userId,slug}).project};
 }
 projectAssociate({userId,slug,repository}){
  if(repository!==null&&repository!==""&&!repoPattern.test(repository))
   return {status:400,error:"Repository must be owner/name."};
  const state=this.projectGet({userId,slug});if(state.status!==200)return state;
  this.sql.exec("UPDATE project_records SET repository=?,updated_at=? WHERE user_id=? AND slug=?",repository||null,NOW(),userId,slug);
  return {status:200,project:this.projectGet({userId,slug}).project};
 }
 projectSetPresentation({userId,slug,presentation}){
  if(!["github","minimal","reader"].includes(presentation))return {status:400,error:"Unsupported README presentation."};
  const state=this.projectGet({userId,slug});if(state.status!==200)return state;
  this.sql.exec("UPDATE project_records SET presentation=?,updated_at=? WHERE user_id=? AND slug=?",presentation,NOW(),userId,slug);
  return {status:200,project:this.projectGet({userId,slug}).project};
 }
 projectSaveLocal({userId,slug,markdown}){
  if(typeof markdown!=="string"||markdown.length>180000)return {status:413,error:"README exceeds 180 KB."};
  const state=this.projectGet({userId,slug});if(state.status!==200)return state;
  if(state.project.repository)return {status:409,error:"This README is GitHub-backed; save it through the repository."};
  this.sql.exec("UPDATE project_records SET default_readme=?,updated_at=? WHERE user_id=? AND slug=?",markdown,NOW(),userId,slug);
  return {status:200,project:this.projectGet({userId,slug}).project};
 }
 githubProjectConnection({userId,includeCredential=false}){
  if(typeof userId!=="string"||!userId)return {status:401,error:"Sign-in required."};
  const r=this.sql.exec("SELECT token_ciphertext,login,updated_at FROM github_project_connections WHERE user_id=?",userId).toArray()[0];
  const result={status:200,connected:!!r,login:r?.login||null,updatedAt:r?.updated_at||null};
  if(includeCredential&&r)result.ciphertext=r.token_ciphertext;
  return result;
 }
 githubProjectConnectionSave({userId,ciphertext,login}){
  if(typeof userId!=="string"||!userId||typeof ciphertext!=="string"||!ciphertext.startsWith("v1.")||
    typeof login!=="string"||login.length<1||login.length>100)return {status:400,error:"Invalid GitHub connection."};
  this.sql.exec("INSERT INTO github_project_connections(user_id,token_ciphertext,login,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_ciphertext=excluded.token_ciphertext,login=excluded.login,updated_at=excluded.updated_at",userId,ciphertext,login,NOW());
  return this.githubProjectConnection({userId});
 }
 githubProjectConnectionRemove({userId}){
  this.sql.exec("DELETE FROM github_project_connections WHERE user_id=?",userId);
  return {status:200,connected:false};
 }
 async deleteAccount(args){
  const user=await this.session(args?.token);
  const result=await super.deleteAccount(args);
  if(result.status===204&&user){
   this.sql.exec("DELETE FROM project_records WHERE user_id=?",user.id);
   this.sql.exec("DELETE FROM github_project_connections WHERE user_id=?",user.id);
  }
  return result;
 }
}
