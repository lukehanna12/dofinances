import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import {githubReadme,githubRepository,githubSaveReadme,githubMarkdown,githubRequest,githubIdentity,sealGithubToken,openGithubToken} from "../edge/project-readme.mjs";
import {projectApi} from "../edge/project-api.mjs";
import {makeReadmeDiff} from "../sites/_apex/app/assets/project-readme-ui.js";
import {createReadmeMarkdownConverter,preserveReadmeSource} from "../sites/_apex/app/assets/readme-rich-markdown.js";
import {
 readmeInlineRule,readmeBlockRule,applyReadmeMarkdownInput,applyReadmeMarkdownBeforeInput
} from "../sites/_apex/app/assets/readme-markdown-input-rules.js";
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
 assert.ok(nav.includes('["readme","utilities","collections","providers/local","providers/external","providers/credentials","permissions","diagnostics","settings"]'));
 assert.ok(nav.includes('["readme","overview"]'));
 assert.ok(nav.includes('if(raw==="colosseum")return "colosseum/readme"'));
 assert.ok(nav.includes('if(raw==="apple-hig-reader")return "apple-hig-reader/readme"'));
 assert.ok(nav.includes('PROJECT_README_PATTERN'));
 assert.ok(nav.includes('route.endsWith("/readme")?"project/readme":'),"Shared README route remains intact across Studio and production");
 assert.ok(html.includes('data-view="project/readme"'));
 assert.ok(html.includes('href="#colosseum/readme"'));
 assert.ok(html.includes('href="#apple-hig-reader/readme"'));
 assert.ok(html.includes('nav-icon-asset--docs'));
 assert.ok(html.includes('<h1 id="readme-title">README</h1>'));
 assert.ok(nav.includes('settings:"Settings",readme:"Docs"'));
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
 assert.ok(store.includes('["apple-hig-reader","Apple HIGs Reader","lukehanna12/apple-higs-reader"]'));
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
 for(const id of ["rm-edit","rm-confirm","rm-diff","rm-reading","rm-diff-panel",
  "rm-repository-form","rm-presentation","rm-notice"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('aria-keyshortcuts="Meta+Shift+E"'));
 assert.ok(css.includes(".rm-icon-button{width:42px;height:42px"));
 assert.ok(css.includes(".rm-confirm{background:#fff;color:#141414"));
 assert.ok(ui.includes('state.source.requiresConnection'));
 assert.ok(ui.includes('window.confirm("Discard your unsaved README changes?")'));
 assert.ok(ui.indexOf('if(state.editing&&state.dirty)') < ui.indexOf('if(!slug){'),
   "A draft must not be silently discarded on navigation out of the README screen");
 assert.ok(!ui.includes('if(!confirm("Discard your unsaved README changes?")'));
 assert.ok(ui.includes("GitHub token with Contents: Read and write permission"));
 assert.ok(ui.includes('const dirty=state.editing&&state.dirty'));
 assert.ok(ui.includes('confirm.hidden=!dirty'));
 assert.ok(ui.includes('diffButton.hidden=!dirty'));
 assert.ok(ui.includes('state.renderDelay=setTimeout'));
 assert.ok(ui.includes('makeReadmeDiff(state.original,state.draft)'));
 const diff=makeReadmeDiff("one\ntwo\nthree","one\nchanged\nthree");
 assert.ok(diff.some(line=>line.type==="removed"&&line.text==="two"));
 assert.ok(diff.some(line=>line.type==="added"&&line.text==="changed"));
 assert.deepEqual(makeReadmeDiff("same","same"),[]);
});

test("Docs document starts close to the repository label and Diff sits beside Save",()=>{
 const heading=html.slice(html.indexOf('<div class="rm-heading">'),html.indexOf('<p id="rm-notice"'));
 assert.ok(heading.includes('id="rm-repository-label"'));
 assert.ok(heading.includes('class="rm-toolbar"'),"Toolbar shares heading row rather than adding vertical space");
 assert.ok(heading.indexOf('id="rm-diff"')<heading.indexOf('id="rm-confirm"'));
 assert.ok(heading.indexOf('id="rm-confirm"')<heading.indexOf('id="rm-edit"'));
 assert.ok(!heading.includes('<span>Diff</span>'),"Diff is an icon-only control");
 assert.ok(heading.includes('aria-describedby="rm-diff-tooltip"'));
 assert.ok(heading.includes('id="rm-diff-tooltip" class="rm-tooltip" role="tooltip"'));
 assert.ok(css.includes('row-gap:8px;margin-bottom:12px'));
 assert.ok(css.includes('.rm-toolbar{display:flex;flex:0 0 auto;'));
 assert.ok(css.includes('.rm-toolbar-end{display:flex;align-items:center;gap:8px}'));
 assert.ok(css.includes('.rm-diff-button{width:34px;height:34px;min-width:0;'));
 assert.ok(css.includes('border:1px solid transparent;border-radius:999px;'));
 assert.ok(css.includes('.rm-diff-button:is(:hover,:focus-visible,:active),.rm-diff-button[aria-pressed="true"]'));
 assert.ok(css.includes('.rm-control-wrap:has(> .rm-icon-button[hidden]){display:none}'));
});

test("GitHub visual defaults, three per-project styles and unsafe HTML rebuilding",()=>{
 assert.ok(html.includes('class="rm-reading markdown-body"'));
 assert.ok(html.includes('class="rm-reading markdown-body" data-theme="dark" contenteditable="false"'));
 assert.ok(html.includes('rm-control-wrap rm-edit-surround'));
 assert.doesNotMatch(html,/id="rm-markdown"|id="rm-preview"|id="rm-editor"/);
 assert.ok(css.includes('.rm-edit-surround{'));
 assert.ok(css.includes('background:#212121'));
 assert.ok(css.includes('box-shadow:inset 0 0 1px rgba(255,255,255,.2)'));
 assert.ok(ui.includes('reading.contentEditable="true"'));
 assert.ok(ui.includes('state.savedDom=reading.cloneNode(true)'));
 assert.ok(ui.includes('reading.replaceChildren(...Array.from(state.savedDom.childNodes'));
 assert.ok(source("sites/_apex/app/assets/readme-editor-interactions.js").includes('root.addEventListener("input"'));
 assert.ok(ui.includes('converter.turndown(reading)'));
 assert.ok(!ui.includes('renderMarkup(textarea.value'));
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

test("Docs sidebar retains the exact README vector and original wallpaper",()=>{
 const original=source("sites/_apex/app/assets/docs-screen-sidebar-icon.v1.svg");
 const legacy=source("sites/_apex/app/assets/readme-screen-sidebar-icon.v1.svg");
 const theme=source("sites/_apex/app/assets/workspace-theme.css");
 assert.equal(original,legacy,"Docs icon alias must preserve the original SVG");
 assert.ok(theme.includes('nav-icon-asset--docs'));
 assert.ok(theme.includes('/app/assets/docs-screen-sidebar-icon.v1.svg'));
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


test("An existing public README still loads if the saved PAT cannot access that repository",async()=>{
 const encryptionSecret="independent-project-credential-key-which-is-long-enough";
 const encrypted=await sealGithubToken("github_pat_restricted_public_fixture",encryptionSecret,"account-public-test");
 const stub={
  projectGet:async({userId,slug})=>{
   assert.equal(userId,"account-public-test");
   assert.equal(slug,"open");
   return {status:200,project:{slug:"open",name:"Open",repository:"example/open",
    presentation:"github",defaultReadme:"# Placeholder",updatedAt:1}};
  },
  githubProjectConnection:async()=>({status:200,connected:true,ciphertext:encrypted,login:"example"})
 };
 const originalFetch=globalThis.fetch;
 const requests=[];
 globalThis.fetch=async(url,opts)=>{
  const authorized=!!opts.headers.Authorization;
  requests.push({url,authorized});
  if(url==="https://api.github.com/repos/example/open"&&authorized)
   return Response.json({message:"Resource not accessible by personal access token"},{status:403});
  if(url==="https://api.github.com/repos/example/open"&&!authorized)
   return Response.json({default_branch:"main",private:false,permissions:{}});
  if(url==="https://api.github.com/repos/example/open/readme"&&!authorized)
   return Response.json({encoding:"base64",content:Buffer.from("# Public\n").toString("base64"),
     sha:"a".repeat(40),path:"README.md",size:9});
  throw Error("Unexpected request "+url+" authorization="+authorized);
 };
 try{
  const response=await projectApi(new Request("https://dofinances.com/api/projects/open/readme"),
   {MFA_ENCRYPTION_KEY:encryptionSecret},"/api/projects/open/readme",{id:"account-public-test"},stub);
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.source,"github");
  assert.equal(json.markdown,"# Public\n");
  assert.equal(json.canEdit,false,"Restricted token must not confer editing access via anonymous fallback");
  assert.deepEqual(requests.map(x=>x.authorized),[true,false,false]);
 }finally{globalThis.fetch=originalFetch;}
});

test("Reading and live editor use independent, route-bound rendering revisions",()=>{
 assert.ok(ui.includes('readingRenderTicket:0,previewRenderTicket:0,loadTicket:0'));
 assert.ok(ui.includes('const key=target===reading?"readingRenderTicket":"previewRenderTicket";'));
 assert.ok(ui.includes('ticket!==state[key]||state.slug!==slug'),
  "Stale render results must not update a different project's README");
 assert.ok(ui.includes('++state.readingRenderTicket;++state.previewRenderTicket;'),
  "Navigating between projects invalidates both pending render streams");
 assert.ok(ui.includes('++state.loadTicket;++state.readingRenderTicket;'),
  "Leaving the README must invalidate in-flight reads");
 assert.ok(!ui.includes("state.renderTicket"),"The single shared render revision was a race condition");
});


test("Editing is directly on the stable GitHub-rendered document, with no split editor",()=>{
 assert.equal((html.match(/id="rm-reading"/g)||[]).length,1);
 assert.ok(html.includes('id="rm-reading" class="rm-reading markdown-body"'));
 assert.ok(!html.includes('id="rm-editor"')&&!html.includes('id="rm-markdown"')&&!html.includes('id="rm-preview"'));
 assert.ok(!css.includes('.rm-editor{')&&!css.includes('.rm-preview-pane'));
 assert.ok(css.includes('rm-reading[contenteditable="true"]'));
 assert.ok(css.includes('outline:none;caret-color:#f0f6fc'));
 assert.ok(ui.includes('reading.contentEditable="true"'));
 assert.ok(ui.includes('reading.contentEditable="false"'));
 assert.ok(ui.includes('state.savedDom=reading.cloneNode(true)'));
 assert.ok(ui.includes('reading.replaceChildren(...Array.from(state.savedDom.childNodes'));
 const interaction=source("sites/_apex/app/assets/readme-editor-interactions.js");
 assert.ok(ui.includes('installReadmeEditorInteractions(reading'));
 assert.ok(interaction.includes('root.addEventListener("paste"'));
 assert.ok(interaction.includes('event.clipboardData?.getData("text/plain")'));
 assert.ok(interaction.includes('root.addEventListener("drop"'));
 assert.ok(!ui.includes('textarea.focus(')&&!ui.includes('reading.focus('));
 assert.ok(ui.includes('state.draft')&&interaction.includes('root.addEventListener("input"'));
 assert.ok(ui.includes('makeReadmeDiff(state.original,state.draft)'));
 assert.ok(ui.includes('state.source?.sha||null'),"Keep SHA-based concurrency protection");
});

test("The edit control is enclosed by the Collections-style circular surface",()=>{
 const surround=css.slice(css.indexOf(".rm-edit-surround{"),css.indexOf(".rm-edit-surround #rm-edit{"));
 assert.match(surround,/padding:4px/);
 assert.match(surround,/border-radius:999px/);
 assert.match(surround,/background:#212121/);
 assert.match(surround,/box-shadow:inset 0 0 1px rgba\(255,255,255,\.2\)/);
 assert.ok(html.includes('class="rm-control-wrap rm-edit-surround"'));
 assert.ok(css.includes('.rm-edit-surround #rm-edit{width:42px;height:42px}'));
 assert.ok(css.includes('.rm-confirm{background:#fff;color:#141414'));
 assert.ok(html.includes('id="rm-diff"'));
});

test("In-place GFM conversion ships locally, preserving rich and unchanged source",()=>{
 const vendored=source("sites/_apex/app/assets/readme-rich-markdown.js");
 const license=source("sites/_apex/app/assets/readme-rich-markdown.LICENSE");
 assert.ok(vendored.includes("TurndownService"));
 assert.ok(vendored.includes("highlightedCodeBlock"));
 assert.ok(vendored.includes("taskListItems"));
 assert.ok(vendored.includes("tablesPlugin"));
 assert.ok(vendored.includes('converter.addRule("readme-original-link"'));
 assert.ok(vendored.includes('converter.addRule("readme-original-image"'));
 assert.ok(license.includes("MIT License"));
 const c=createReadmeMarkdownConverter();
 assert.equal(c.options.codeBlockStyle,"fenced");
 assert.equal(c.options.headingStyle,"atx");
 assert.equal(typeof c.turndown,"function");
 const original="# Title\n\nOne **bold** word.\n<!-- preserve this comment -->\n";
 const canonical="# Title\n\nOne **bold** word.";
 assert.equal(preserveReadmeSource(original,canonical,canonical),original);
 assert.equal(preserveReadmeSource(original,canonical,"# Title\n\nOne **new** word."),
  "# Title\n\nOne **new** word.\n<!-- preserve this comment -->\n");
 const insertion="# Title\n\nOne **newer bold** word.";
 const patched=preserveReadmeSource(original,canonical,insertion);
 assert.ok(patched.includes("newer bold"));
});


test("Markdown autoformats inline backticks, emphasis, strikethrough and safe links",()=>{
 const tick=String.fromCharCode(96);
 assert.deepEqual(readmeInlineRule(tick+"hello"+tick),{kind:"code",start:0,text:"hello"});
 assert.deepEqual(readmeInlineRule("A "+tick+"word"+tick),{kind:"code",start:2,text:"word"});
 assert.deepEqual(readmeInlineRule(tick.repeat(2)+"has "+tick+" tick"+tick.repeat(2)),
  {kind:"code",start:0,text:"has "+tick+" tick"});
 assert.equal(readmeInlineRule(tick.repeat(3)),null,"Unclosed fence is not inline code");
 assert.deepEqual(readmeInlineRule("**bold**"),{kind:"strong",start:0,text:"bold"});
 assert.deepEqual(readmeInlineRule("__bold__"),{kind:"strong",start:0,text:"bold"});
 assert.deepEqual(readmeInlineRule("*italic*"),{kind:"em",start:0,text:"italic"});
 assert.deepEqual(readmeInlineRule("_italic_"),{kind:"em",start:0,text:"italic"});
 assert.deepEqual(readmeInlineRule("~~removed~~"),{kind:"strike",start:0,text:"removed"});
 assert.deepEqual(readmeInlineRule("***bold italic***"),{kind:"strongEm",start:0,text:"bold italic"});
 assert.deepEqual(readmeInlineRule("Read [docs](https://example.com)"),
  {kind:"link",start:5,text:"docs",href:"https://example.com",title:""});
 assert.deepEqual(readmeInlineRule("![logo](https://example.com/a.png)"),
  {kind:"image",start:0,text:"logo",href:"https://example.com/a.png",title:""});
 assert.equal(readmeInlineRule("word_internal_"),null,"Underscores within identifiers are not emphasis");
 assert.equal(readmeInlineRule("\\*escaped*"),null,"Backslash-escaped Markdown stays literal");
 assert.equal(readmeInlineRule("[X](javascript:evil)"),null,"Unsafe schemes must not turn into links");
 assert.equal(readmeInlineRule("line\n"+tick+"no"+tick),null);
});

test("Markdown autoformats headings, quotes, lists, tasks, code fences and rules",()=>{
 for(let level=1;level<=6;level++){
  assert.deepEqual(readmeBlockRule("#".repeat(level)+" "),{kind:"heading",level});
 }
 assert.equal(readmeBlockRule("#".repeat(7)+" "),null);
 assert.deepEqual(readmeBlockRule("> "),{kind:"quote"});
 for(const marker of ["- ","+ ","* "])assert.deepEqual(readmeBlockRule(marker),{kind:"ul"});
 assert.deepEqual(readmeBlockRule("1. "),{kind:"ol",start:1});
 assert.deepEqual(readmeBlockRule("42) "),{kind:"ol",start:42});
 assert.deepEqual(readmeBlockRule("[ ] ",{inList:true}),{kind:"task",checked:false});
 assert.deepEqual(readmeBlockRule("[x] ",{inList:true}),{kind:"task",checked:true});
 assert.equal(readmeBlockRule("[x] "),null,"Task markers only work inside lists");
 const tick=String.fromCharCode(96);
 assert.deepEqual(readmeBlockRule(tick.repeat(3)+"js",{trigger:"enter"}),{kind:"fence",language:"js"});
 assert.deepEqual(readmeBlockRule(tick.repeat(3)+" "),{kind:"fence",language:""});
 assert.deepEqual(readmeBlockRule("---",{trigger:"enter"}),{kind:"hr"});
 assert.deepEqual(readmeBlockRule("*** ",{trigger:"space"}),{kind:"hr"});
 assert.deepEqual(readmeBlockRule("##\u00a0"),{kind:"heading",level:2},
  "Contenteditable non-breaking spaces must be recognized");
 assert.deepEqual(readmeBlockRule(">\u00a0"),{kind:"quote"});
 assert.equal(readmeBlockRule("##title"),null);
 assert.equal(readmeBlockRule("normal prose "),null);
});

test("Production editor uses the same event engine as the Chromium fixture",()=>{
 const rules=source("sites/_apex/app/assets/readme-markdown-input-rules.js");
 const engine=source("sites/_apex/app/assets/readme-editor-interactions.js");
 assert.ok(ui.includes('import {installReadmeEditorInteractions}'));
 assert.ok(ui.includes('history=installReadmeEditorInteractions(reading,'));
 assert.ok(engine.includes('import {applyReadmeMarkdownInput,applyReadmeMarkdownBeforeInput}'));
 for(const part of [
  'root.addEventListener("beforeinput",event=>','applyReadmeMarkdownBeforeInput(root,event,hooks)',
  'root.addEventListener("input",event=>','applyReadmeMarkdownInput(root,event)',
  'root.addEventListener("compositionstart"','root.addEventListener("compositionend"',
  'root.addEventListener("paste"','root.addEventListener("change"',
  'history.noteBeforeInput(event)','history.recordNative(event)'
 ])assert.ok(engine.includes(part),part);
 assert.ok(ui.includes('scheduleRichDraftUpdate()'));
 assert.ok(ui.includes('converter.turndown(reading)'));
 assert.ok(rules.includes('original.data=CARET_ANCHOR+following;'));
 assert.ok(rules.includes('ctx.node.replaceData(0,ctx.offset,CARET_ANCHOR)'));
 assert.ok(rules.includes('transferChildren(block,caretTarget)'));
 assert.ok(!rules.includes('range.deleteContents();range.insertNode(replacement);'));
 assert.ok(rules.includes('placeCaret('));
 assert.ok(rules.includes('readmeBlockRule(prefix+pendingSpace,{trigger,inList:isList})'));
 assert.ok(rules.includes('return defer(ctx,()=>applyBlock(root,ctx,"space"," ")," ")'));
 assert.ok(rules.includes('return defer(ctx,()=>applyInline(root,ctx,event.data),event.data)'));
 assert.ok(rules.includes('queueMicrotask(()=>{'),"Formatting must not race later keystrokes");
 assert.ok(!rules.includes('setTimeout(()=>{'),"No timer-based Markdown transformation");
 assert.ok(rules.includes('const CARET_ANCHOR="\\u200b"'));
 assert.ok(rules.includes('clearCaretAnchor(root)'));
 assert.ok(ui.includes('converter.turndown(reading).replace(/\\u200b/g,"")'));
 assert.ok(rules.includes('node.parentElement?.closest("code,pre,kbd,samp,a")'));
 assert.ok(html.includes('id="rm-reading" class="rm-reading markdown-body" data-theme="dark" contenteditable="false"'));
 assert.equal(typeof applyReadmeMarkdownInput,"function");
 assert.equal(typeof applyReadmeMarkdownBeforeInput,"function");
});

test("README history isolates formatting but groups adjacent native edits",()=>{
 const history=source("sites/_apex/app/assets/readme-edit-history.js");
 const engine=source("sites/_apex/app/assets/readme-editor-interactions.js");
 for(const fragment of [
  'history.reset()','history.clear()', 'history.rememberCaret()',
  'history.synthesizeInsertion(literal)','history.push(checkpoint)',
  'history.record()','history.undo(options)','history.redo(options)','history.snapshot()'
 ])assert.ok(engine.includes(fragment)||ui.includes(fragment),fragment);
 for(const fragment of [
  'function selectionState(root)','selection.setBaseAndExtent(',
  'const synthesizeInsertion=literal=>','const undo=({skipSync=false}={})=>',
  'const redo=({skipSync=false}={})=>','frames.splice(cursor+1)',
  'oldBoxes.forEach(', 'root.focus({preventScroll:true})',
  'const GROUP_DELAY_MS=1100','const recordNative=event=>',
  'group.after===before.start','const isolate=()=>',
  'const synchronize=()=>'
 ])assert.ok(history.includes(fragment),fragment);
 for(const fragment of [
  'event.inputType==="historyUndo"||event.inputType==="historyRedo"',
  'event.code==="KeyZ"','event.code==="KeyY"',
  'insertingPaste=true','history.recordNative(event)',
  'composing=true','history.isolate()','event.preventDefault()'
 ])assert.ok(engine.includes(fragment),fragment);
 assert.ok(!history.includes('setInterval('));
});

test("Chromium verifies undo past autoformat, redo, and redo-branch invalidation",()=>{
 const runner=source("scripts/verify-readme-markdown-browser.mjs");
 const workflow=source(".github/workflows/site.yml");
 for(const fragment of [
  '"/assets/readme-editor-interactions.js"','installReadmeEditorInteractions(root)',
  '"undo autoformat to Markdown marker"','"undo earlier typing past formatting"',
  '"redo formatted heading"','"undo backticks to literal Markdown"',
  '"Ctrl+Z alternate undo"','"Ctrl+Y alternate redo"',
  '"New edit must invalidate redo branch"',
  '"grouped paragraph undo"','"rapid heading typing redo"',
  '"caret movement isolates undo"','"atomic paste redo"',
  '"single composition undo"','"checkbox redo"'
 ])assert.ok(runner.includes(fragment),fragment);
 assert.ok(workflow.includes("node scripts/verify-readme-markdown-browser.mjs"));
});

