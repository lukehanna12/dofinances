import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import {githubReadme,githubRepository,githubSaveReadme,githubMarkdown,githubRequest,githubIdentity,sealGithubToken,openGithubToken} from "../edge/project-readme.mjs";
import {projectApi} from "../edge/project-api.mjs";
import {makeReadmeDiff} from "../sites/_apex/app/assets/project-readme-ui.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=source("sites/_apex/app/index.html");
const nav=source("sites/_apex/app/assets/workspace-nav.js");
const ui=source("sites/_apex/app/assets/project-readme-ui.js");
const worker=source("edge/worker.mjs");
const api=source("edge/project-api.mjs");
const store=source("edge/auth-store-projects.mjs");
const css=source("sites/_apex/app/assets/project-readme.css");
const registry=source("sites/_apex/app/assets/workspace-wallpapers.js");
const router=source("edge/router.mjs");
const workflow=source(".github/workflows/site.yml");

test("Every project has a README-first route, with earlier sections still addressable",()=>{
 assert.ok(nav.includes('["readme","utilities","collections","providers","permissions","diagnostics","settings"]'));
 assert.ok(nav.includes('["readme","overview"]'));
 assert.ok(nav.includes('if(raw==="colosseum")return "colosseum/readme"'));
 assert.ok(nav.includes('if(raw==="apple-hig-reader")return "apple-hig-reader/readme"'));
 assert.ok(nav.includes('PROJECT_README_PATTERN'));
 assert.ok(nav.includes('route.endsWith("/readme")?"project/readme":route'));
 assert.ok(html.includes('data-view="project/readme"'));
 assert.ok(html.includes('href="#colosseum/readme"'));
 assert.ok(html.includes('href="#apple-hig-reader/readme"'));
 assert.ok(html.includes('nav-icon-asset--readme'));
 assert.ok(router.includes('"/app/colosseum/readme"'));
 assert.ok(router.includes('"/app/apple-hig-reader/readme"'));
 assert.ok(router.includes('^\\/app\\/project\\/'));
});

test("Account-scoped project creation auto-seeds README and stores repository association",()=>{
 assert.ok(worker.includes('export {AuthStore} from "./auth-store-projects.mjs"'));
 assert.ok(store.includes('extends FederatedAuthStore'));
 assert.ok(store.includes('PRIMARY KEY(user_id,slug)'));
 assert.ok(store.includes('const template=name=>"# "+name'));
 assert.ok(store.includes('["colosseum","Colosseum","lukehanna12/colosseum"]'));
 assert.ok(store.includes('["apple-hig-reader","Apple HIG Reader",null]'));
 assert.ok(store.includes('this.sql.exec("INSERT INTO project_records(user_id,slug,name,repository,default_readme'));
 assert.ok(store.includes('projectSetPresentation'));
 assert.ok(store.includes('projectSaveLocal'));
 assert.ok(store.includes('this.sql.exec("DELETE FROM project_records WHERE user_id=?"'));
 assert.ok(api.includes('pathname==="/api/projects"'));
 assert.ok(api.includes('await stub.projectCreate('));
 assert.ok(api.includes('await stub.projectAssociate('));
 assert.ok(ui.includes('location.hash="#"+slugRoute(data.project.slug)'));
 assert.ok(html.includes('id="project-create-dialog"'));
 assert.ok(html.includes('id="project-create-form"'));
});

test("GitHub private credential pathway is encrypted, independently linked, and checked on every write",async()=>{
 assert.ok(store.includes('CREATE TABLE IF NOT EXISTS github_project_connections'));
 assert.ok(store.includes('token_ciphertext TEXT NOT NULL'));
 assert.ok(api.includes('githubIdentity(body.token)'));
 assert.ok(api.includes('sealGithubToken(body.token,secret(env),userId)'));
 assert.ok(api.includes('openGithubToken(r.ciphertext,secret(env),userId)'));
 assert.ok(api.includes('if(!repo.canEdit)'));
 assert.ok(api.includes('githubSaveReadme(project.repository,token,body)'));
 assert.ok(api.includes('request.headers.get("Origin")!=="https://dofinances.com"'));
 assert.ok(!api.includes('COLOSSEUM_ROUTER'));
 assert.ok(html.includes('id="github-readme-form"'));
 assert.ok(html.includes('Contents: Read and write'));
 const secret="example-32-character-development-key-separate-from-identity-oauth";
 const ciphertext=await sealGithubToken("github_pat_1234567890abcdef",secret,"account-1");
 assert.ok(ciphertext.startsWith("v1."));
 assert.ok(!ciphertext.includes("github_pat_"));
 assert.equal(await openGithubToken(ciphertext,secret,"account-1"),"github_pat_1234567890abcdef");
 await assert.rejects(()=>openGithubToken(ciphertext,secret,"account-2"),/operation|decrypt|authentication/i);
});

test("GitHub README retrieval and SHA guarded saves stay on fixed HTTPS GitHub API host",async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith("/repos/org/sample")){
   return Response.json({default_branch:"main",private:true,permissions:{push:true}});
  }
  if(url.endsWith("/repos/org/sample/readme")){
   return Response.json({encoding:"base64",content:Buffer.from("# Hello\n").toString("base64"),sha:"a".repeat(40),path:"README.md",size:8});
  }
  if(opts.method==="PUT"){
   const req=JSON.parse(opts.body);
   assert.equal(req.sha,"a".repeat(40));
   assert.equal(Buffer.from(req.content,"base64").toString("utf8"),"# Updated\n");
   assert.equal(req.content.length%4,0,"GitHub Content API receives padded RFC 4648 base64");
   return Response.json({content:{sha:"b".repeat(40),path:"README.md"},commit:{sha:"c".repeat(40)}});
  }
  throw Error("Unexpected URL "+url);
 };
 const repo=await githubRepository("org/sample","fine-grained-token",fetcher);
 assert.equal(repo.canEdit,true);
 const loaded=await githubReadme("org/sample","fine-grained-token",fetcher);
 assert.equal(loaded.markdown,"# Hello\n");assert.equal(loaded.sha,"a".repeat(40));
 const saved=await githubSaveReadme("org/sample","fine-grained-token",{path:"README.md",markdown:"# Updated\n",sha:"a".repeat(40)},fetcher);
 assert.equal(saved.sha,"b".repeat(40));
 assert.ok(calls.every(x=>x.url.startsWith("https://api.github.com/")));
 assert.ok(calls.some(x=>x.opts.headers.Authorization==="Bearer fine-grained-token"));
 await assert.rejects(()=>githubRequest("/repos/org/sample/../../user",{},fetcher),/Invalid GitHub API path/);
});

test("GitHub renderer uses the GFM Markdown endpoint and constrains its context",async()=>{
 const calls=[];
 const html=await githubMarkdown("# Check","org/sample",null,async(url,init)=>{
  calls.push({url,body:JSON.parse(init.body)});
  return new Response("<h1>Check</h1>",{status:200});
 });
 assert.equal(html,"<h1>Check</h1>");
 assert.deepEqual(calls,[{url:"https://api.github.com/markdown",body:{text:"# Check",mode:"gfm",context:"org/sample"}}]);
});

test("README editing offers larger Collections-style controls, live preview, diff and permission errors",()=>{
 for(const id of ["rm-edit","rm-confirm","rm-diff","rm-markdown","rm-preview","rm-reading","rm-diff-panel",
  "rm-repository-form","rm-presentation","rm-notice"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('aria-keyshortcuts="Meta+Shift+E"'));
 assert.ok(css.includes(".rm-icon-button{width:42px;height:42px"));
 assert.ok(css.includes(".rm-confirm{background:#fff;color:#141414"));
 assert.ok(ui.includes('state.source.requiresConnection'));
 assert.ok(ui.includes('window.confirm("Discard your unsaved README changes?")'));
 assert.ok(ui.indexOf('if(state.editing&&state.dirty)') < ui.indexOf('if(!slug){state.slug=null;exitEdit();return;}'),
   "A draft must not be silently discarded on navigation out of the README screen");
 assert.ok(!ui.includes('if(!confirm("Discard your unsaved README changes?")'));
 assert.ok(ui.includes("GitHub token with Contents: Read and write permission"));
 assert.ok(ui.includes('const dirty=state.editing&&textarea.value!==state.original'));
 assert.ok(ui.includes('confirm.hidden=!dirty'));
 assert.ok(ui.includes('diffButton.hidden=!dirty'));
 assert.ok(ui.includes('state.renderDelay=setTimeout'));
 assert.ok(ui.includes('makeReadmeDiff(state.original,textarea.value)'));
 const diff=makeReadmeDiff("one\ntwo\nthree","one\nchanged\nthree");
 assert.ok(diff.some(line=>line.type==="removed"&&line.text==="two"));
 assert.ok(diff.some(line=>line.type==="added"&&line.text==="changed"));
 assert.deepEqual(makeReadmeDiff("same","same"),[]);
});

test("GitHub visual defaults, three per-project styles and unsafe HTML rebuilding",()=>{
 assert.ok(html.includes('class="rm-reading markdown-body"'));
 assert.ok(html.includes('class="rm-preview-pane"'));
 assert.ok(html.includes('option value="github"'));
 assert.ok(html.includes('option value="minimal"'));
 assert.ok(html.includes('option value="reader"'));
 assert.ok(css.includes('data-presentation="reader"'));
 assert.ok(css.includes('data-presentation="minimal"'));
 assert.ok(source("sites/_apex/app/assets/github-markdown.css").includes(".markdown-body"));
 assert.ok(source("sites/_apex/app/assets/github-markdown-css.LICENSE").includes("MIT License"));
 assert.ok(ui.includes("new DOMParser()"));
 assert.ok(ui.includes("document.createElement(tag)"));
 assert.ok(ui.includes('["script","style","iframe"'));
 assert.ok(ui.includes('el.rel="noopener noreferrer"'));
 assert.ok(ui.includes('target.replaceChildren(sanitizeMarkdown('));
});

test("Exact local README vector, exact text.page paths and original lossless wallpaper",()=>{
 const original=source("sites/_apex/app/assets/readme-screen-sidebar-icon.v1.svg");
 const diff=source("sites/_apex/app/assets/readme-diff-text-page.v1.svg");
 assert.ok(original.includes('viewBox="0 0 28.149 22.0377"'));
 assert.ok(original.includes("Apple Native CoreSVG"));
 assert.ok(diff.includes('data-sf-symbol="text.page"'));
 assert.ok(diff.includes('viewBox="0 0 21.0163 26.7967"'));
 assert.equal((diff.match(/<path d="/g)||[]).length,4);
 assert.ok(html.includes('/app/assets/readme-diff-text-page.v1.svg'));
 assert.ok(registry.includes('ade03e6d5958ddb9e1e5098ad67d46b7f4c801057aa77c85510d846ef8f75091'));
 assert.ok(registry.includes('"golden-ridges-dark-sand.png"'));
 assert.ok(registry.includes('"ext": "png"'));
 assert.ok(router.includes('env.LIBRARY_III.fetch'));
});

test("Production builds keep private README assets off the public Studio Pages app",()=>{
 assert.ok(workflow.includes('command: deploy --config edge/wrangler.jsonc'));
 assert.ok(workflow.includes('cp studio/sidebar/index.html dist/app/index.html'));
 assert.ok(!workflow.includes('cp sites/_apex/app/assets/project-readme-ui.js dist/app/assets/project-readme-ui.js'));
});

test("Projects API enforces account scope, route ownership, payload fields and same-origin saves",async()=>{
 const fakeProject={slug:"sandbox",name:"Sandbox",repository:null,defaultReadme:"# Sandbox\n",presentation:"github"};
 const mutations=[];
 const stub={
  async projectList({userId}){assert.equal(userId,"account-test");return {status:200,projects:[fakeProject]};},
  async projectGet({userId,slug}){return slug==="sandbox"&&userId==="account-test"?{status:200,project:fakeProject}:{status:404,error:"Project not found."};},
  async projectSaveLocal(value){mutations.push(value);return {status:200};},
  async projectSetPresentation(value){mutations.push(value);return {status:200,project:{...fakeProject,presentation:value.presentation}};},
  async projectCreate(value){mutations.push(value);return {status:201,project:{...fakeProject,name:value.name}};},
  async githubProjectConnection(){return {status:200,connected:false,login:null,updatedAt:null};}
 };
 const env={},user={id:"account-test"};
 const make=(path,method="GET",body,origin="https://dofinances.com")=>new Request("https://dofinances.com"+path,{
  method,headers:{"Content-Type":"application/json",...(method!=="GET"?{Origin:origin}:{} )},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 let response=await projectApi(make("/api/projects"),env,"/api/projects",user,stub);
 assert.equal(response.status,200);
 let data=await response.json();
 assert.equal(data.projects[0].name,"Sandbox");
 assert.ok(!Object.hasOwn(data.projects[0],"defaultReadme"));
 response=await projectApi(make("/api/projects/sandbox/readme"),env,"/api/projects/sandbox/readme",user,stub);
 assert.equal(response.status,200);
 data=await response.json();assert.equal(data.source,"local");assert.equal(data.canEdit,true);
 response=await projectApi(make("/api/projects/sandbox/readme","PUT",{markdown:"# Updated",sha:null}),env,"/api/projects/sandbox/readme",user,stub);
 assert.equal(response.status,200);assert.equal(mutations[0].markdown,"# Updated");
 response=await projectApi(make("/api/projects/sandbox/presentation","PUT",{presentation:"reader"}),env,"/api/projects/sandbox/presentation",user,stub);
 assert.equal(response.status,200);assert.equal(mutations[1].presentation,"reader");
 response=await projectApi(make("/api/projects","POST",{name:"Another project"}),env,"/api/projects",user,stub);
 assert.equal(response.status,201);assert.equal(mutations[2].name,"Another project");
 response=await projectApi(make("/api/projects/sandbox/readme","PUT",{markdown:"Injected"},"https://evil.invalid"),env,"/api/projects/sandbox/readme",user,stub);
 assert.equal(response.status,403);
 response=await projectApi(make("/api/projects/unknown/readme"),env,"/api/projects/unknown/readme",user,stub);
 assert.equal(response.status,404);
 response=await projectApi(make("/api/projects/sandbox/readme","PUT",{markdown:"Allowed",surprise:true}),env,"/api/projects/sandbox/readme",user,stub);
 assert.equal(response.status,400);
});
