import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {emphasizedFile,markdownFile,resolveRepoLink,repositoryTree} from "../sites/_apex/app/assets/project-file-browser.js";
import {validRepositoryPath,githubFileTree,githubDocument} from "../edge/project-files.mjs";
import {githubSaveReadme} from "../edge/project-readme.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("sites/_apex/app/index.html");
const ui=read("sites/_apex/app/assets/project-readme-ui.js");
const css=read("sites/_apex/app/assets/project-readme.css");
const icon=read("sites/_apex/app/assets/folder-sfsymbol.20261112.svg");
const api=read("edge/project-api.mjs");

test("More files occupies Confirm's exact action slot and yields to dirty edits",()=>{
 const slot=html.slice(html.indexOf('<span class="rm-control-wrap rm-action-surround rm-files-control">'),
   html.indexOf('<span class="rm-control-wrap rm-action-surround rm-diff-control">'));
 assert.match(slot,/id="rm-confirm"/);
 assert.match(slot,/id="rm-more-files"/);
 assert.match(slot,/aria-keyshortcuts="Meta\+Shift\+M"/);
 assert.match(slot,/id="rm-more-files-tooltip"/);
 assert.match(slot,/<kbd>⇧<\/kbd><kbd>⌘<\/kbd><kbd>M<\/kbd>/);
 assert.ok(slot.indexOf('id="rm-confirm"')<slot.indexOf('id="rm-more-files"'));
 assert.ok(css.includes('.rm-files-control{z-index:7}'));
 assert.ok(css.includes('.rm-more-files:disabled'));
 assert.ok(css.includes('.rm-files-menu[hidden]{display:none!important}'));
 assert.ok(ui.includes('confirm.hidden=!dirty;diffButton.hidden=!dirty;'));
 assert.ok(ui.includes('moreFiles.hidden=dirty;moreFiles.disabled=state.processing||state.editing'));
 assert.ok(ui.includes('if(event.shiftKey&&(event.metaKey||event.ctrlKey)&&!event.altKey&&event.code==="KeyM")'));
 assert.ok(html.includes('aria-label="Edit document"'));
 assert.ok(html.includes('>Edit document</span>'));
});
test("Folder SVG is the actual November 12 SF Symbols Folder geometry",()=>{
 assert.ok(icon.includes('viewBox="0 0 28.4065 22.5459"'));
 assert.ok(icon.includes('M3.59297 22.4425L24.6362 22.4425'));
 assert.ok(css.includes('folder-sfsymbol.20261112.svg'));
});
test("Folder emphasis is visual only; all file types remain present and selectable",()=>{
 for(const ext of ["md","MDX","json","yaml","yml","txt"])assert.equal(emphasizedFile("docs/file."+ext),true);
 for(const ext of ["ts","tsx","png","pdf","py","toml"])assert.equal(emphasizedFile("src/file."+ext),false);
 assert.equal(markdownFile("docs/file.md"),true);
 assert.equal(markdownFile("docs/file.mdx"),true);
 assert.equal(markdownFile("docs/file.json"),false);
 const root=repositoryTree([
  {type:"blob",path:"README.md",size:150},
  {type:"tree",path:"docs"},
  {type:"blob",path:"docs/guide.mdx",size:300},
  {type:"blob",path:"docs/data.json",size:100},
  {type:"blob",path:"docs/photo.png",size:900},
  {type:"blob",path:"src/index.tsx",size:1800}
 ]);
 assert.deepEqual(root.children.map(x=>x.name),["docs","src","README.md"]);
 assert.deepEqual(root.children[0].children.map(x=>x.name),["data.json","guide.mdx","photo.png"]);
 const renderer=read("sites/_apex/app/assets/project-file-browser.js");
 assert.ok(renderer.includes('button.addEventListener("click",()=>onChoose(node.path))'),
   "Even muted file types need live selection handlers");
 assert.ok(renderer.includes('button.classList.add("rm-file-muted")'));
});
test("Relative document links resolve from their current folder and keep fragments",()=>{
 assert.deepEqual(resolveRepoLink("../API/reference.md#methods","docs/guides/README.md",
  "lukehanna12/repo","main"),{path:"docs/API/reference.md",fragment:"methods"});
 assert.deepEqual(resolveRepoLink("./setup.json","docs/README.mdx","lukehanna12/repo","main"),
  {path:"docs/setup.json",fragment:""});
 assert.deepEqual(resolveRepoLink("https://github.com/lukehanna12/repo/blob/main/docs/guide.md#install",
  "README.md","lukehanna12/repo","main"),{path:"docs/guide.md",fragment:"install"});
 assert.deepEqual(resolveRepoLink("https://github.com/lukehanna12/repo/blob/HEAD/docs/guide.md",
  "README.md","lukehanna12/repo","main"),{path:"docs/guide.md",fragment:""});
 assert.equal(resolveRepoLink("../../../outside.md","docs/README.md","lukehanna12/repo","main"),null);
 assert.equal(resolveRepoLink("javascript:alert(1)","README.md","lukehanna12/repo","main"),null);
 assert.equal(resolveRepoLink("https://evil.test/data.md","README.md","lukehanna12/repo","main"),null);
 assert.ok(ui.includes('data-repo-path'));
 assert.ok(ui.includes('void openDocument(docLink.dataset.repoPath,docLink.dataset.repoFragment||"")'));
});
test("Safe GitHub repository listing and file reads preserve authentication and binary selection",async()=>{
 const seen=[];
 const fetcher=async(url,opts)=>{
  seen.push({url,opts});
  if(url.includes("/git/trees/"))return Response.json({tree:[
   {path:"README.md",type:"blob",size:12},{path:"docs",type:"tree"},
   {path:"docs/test.json",type:"blob",size:8},
   {path:"bin/tool",type:"blob",size:250},{path:"../../etc/passwd",type:"blob"}]});
  const path=url.split("/contents/")[1];
  return Response.json({type:"file",path:decodeURIComponent(path),sha:"a".repeat(40),
   size:path==="docs/test.json"?7:250,
   encoding:"base64",content:path==="docs/test.json"?Buffer.from('{"x":1}').toString("base64"):
     Buffer.from([0,1,2]).toString("base64")});
 };
 const tree=await githubFileTree("lukehanna12/repo","test-token","main",fetcher);
 assert.equal(tree.ok,true);
 assert.equal(tree.entries.length,4);
 assert.ok(!tree.entries.some(x=>x.path.startsWith("..")));
 const json=await githubDocument("lukehanna12/repo","test-token","docs/test.json",fetcher);
 assert.equal(json.content,'{"x":1}');assert.equal(json.binary,false);
 const binary=await githubDocument("lukehanna12/repo","test-token","bin/tool",fetcher);
 assert.equal(binary.binary,true);assert.equal(binary.content,null);
 assert.ok(seen.every(x=>x.opts.headers.Authorization==="Bearer test-token"));
 assert.ok(seen.every(x=>x.url.startsWith("https://api.github.com/repos/lukehanna12/repo/")));
 assert.ok(seen.some(x=>x.url.endsWith("/git/trees/main?recursive=1")));
 for(const path of ["../outside.md","/etc/passwd","foo//bar","a\\b","a/../b",""])
  assert.equal(validRepositoryPath(path),false);
 assert.equal(validRepositoryPath("docs/guide.v2.md"),true);
 assert.equal(validRepositoryPath("docs/Hello World.md"),true);
 assert.ok(api.includes('action==="files"||action==="file"'));
 assert.ok(api.includes('await githubDocument('));
 assert.ok(api.includes('await githubFileTree('));
 assert.ok(api.includes('typeof body.sha!=="string"'));
});
test("The existing SHA-guarded save path also accepts non-README documents",async()=>{
 const calls=[];const fetcher=async(url,options)=>{
  calls.push({url,options});return Response.json({content:{sha:"b".repeat(40),path:"docs/data.json"},commit:{sha:"c".repeat(40)}});
 };
 const saved=await githubSaveReadme("lukehanna12/repo","test-token",{
  path:"docs/data.json",sha:"a".repeat(40),markdown:'{"new":true}'},fetcher);
 assert.equal(saved.path,"docs/data.json");
 assert.equal(calls.length,1);assert.match(calls[0].options.body,/docs: update docs\/data.json/);
 assert.equal(JSON.parse(calls[0].options.body).sha,"a".repeat(40));
});
test("Project-page entry resets to README; other project screens retain their last document",()=>{
 assert.ok(ui.includes('const documentsBySlug=new Map()'));
 assert.ok(ui.includes('if(previousRoute==="projects"&&routeSlug())documentsBySlug.delete(routeSlug())'));
 assert.ok(ui.includes('documentsBySlug.set(slug,data.path)'));
 assert.ok(ui.includes('const remembered=documentsBySlug.get(slug)'));
 assert.ok(ui.includes('void openDocument(remembered)'));
 assert.ok(ui.includes('paintDocumentHeader()'));
 assert.ok(ui.includes('reading.textContent="Opening "+path+"…"'));
 assert.ok(ui.includes('return {path:parts.join("/"),fragment}'));
});
