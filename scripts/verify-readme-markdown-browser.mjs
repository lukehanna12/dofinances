/*
 * Real-browser regression for in-place README Markdown input rules.
 * Uses an isolated localhost fixture, never account credentials or production.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,mkdtempSync,existsSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const binaries=["google-chrome-stable","google-chrome","chromium","chromium-browser"];
let executable;
for(const name of binaries){
 try{executable=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(executable,"Chromium is required for actual README input checks");
const moduleFile=new URL("../sites/_apex/app/assets/readme-markdown-input-rules.js",import.meta.url);
const historyFile=new URL("../sites/_apex/app/assets/readme-edit-history.js",import.meta.url);
const editorFile=new URL("../sites/_apex/app/assets/readme-editor-interactions.js",import.meta.url);
const fixture=[
 '<!doctype html><html><head><meta charset="utf-8"></head><body>',
 '<article id="readme" contenteditable="true"><p><br></p></article>',
 '<script type="module">',
 'import {installReadmeEditorInteractions} from "/assets/readme-editor-interactions.js";',
 'const root=document.getElementById("readme");',
 'const history=installReadmeEditorInteractions(root);window.__history=history;',
 'window.__rulesReady=true;',
 '</script></body></html>'
].join("\n");
const server=createServer((request,response)=>{
 const files=new Map([
  ["/assets/readme-edit-history.js",historyFile],
  ["/assets/readme-markdown-input-rules.js",moduleFile],
  ["/assets/readme-editor-interactions.js",editorFile]
 ]);
 if(files.has(request.url)){
  response.writeHead(200,{"Content-Type":"text/javascript","Cache-Control":"no-store"});
  response.end(readFileSync(files.get(request.url)));return;
 }
 response.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
 response.end(fixture);
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
const profile=mkdtempSync(join(tmpdir(),"readme-markdown-browser-"));
const chrome=spawn(executable,[
 "--headless=new","--no-sandbox","--disable-dev-shm-usage",
 "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
 "--window-size=1050,850","--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe"]});
let chromeErrors="";
chrome.stderr?.on("data",chunk=>{chromeErrors=(chromeErrors+String(chunk)).slice(-7000);});
let socket;
try{
 let port;
 for(let attempt=0;attempt<120;attempt++){
  if(existsSync(join(profile,"DevToolsActivePort"))){
   port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
  }
  if(chrome.exitCode!==null)throw Error("Chrome exited before debugging was ready.");
  await pause(100);
 }
 assert.ok(port,"Chrome remote debugging port unavailable; executable="+executable+
  "; exit="+chrome.exitCode+"; stderr="+chromeErrors);
 const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let seq=0;const pending=new Map();
 socket.onmessage=event=>{
  const message=JSON.parse(event.data);if(!message.id)return;
  const waiter=pending.get(message.id);if(!waiter)return;
  pending.delete(message.id);
  message.error?waiter.reject(Error(JSON.stringify(message.error))):waiter.resolve(message.result);
 };
 const command=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const result=await command("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error("Browser evaluation failed: "+JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 const until=async(expression,label)=>{
  for(let i=0;i<75;i++){
   if(await evaluate(expression))return;
   await pause(60);
  }
  throw Error("README Markdown did not format: "+label+"; DOM="+
    JSON.stringify(await evaluate('document.getElementById("readme").outerHTML')));
 };
 const reset=()=>evaluate('(()=>{'+
  'const e=document.getElementById("readme");e.replaceChildren();'+
  'const p=document.createElement("p");p.append(document.createElement("br"));e.append(p);'+
  'e.focus();const range=document.createRange();range.setStart(p,0);range.collapse(true);'+
  'const s=getSelection();s.removeAllRanges();s.addRange(range);'+
  'window.__history.reset();return document.activeElement===e;})()');
 const type=async(text,{interval=25}={})=>{
  // Dispatch real keydown/keyup pairs, not IME-style Input.insertText.
  // The latter can clear a contenteditable selection after preventDefault.
  for(const char of text){
   const code=/^[A-Za-z]$/.test(char)?"Key"+char.toUpperCase():
    char===" "?"Space":/^[0-9]$/.test(char)?"Digit"+char:"";
   const keyCode=/^[A-Za-z]$/.test(char)?char.toUpperCase().charCodeAt(0):
    /^[0-9]$/.test(char)?char.charCodeAt(0):char===" "?32:0;
   await command("Input.dispatchKeyEvent",{type:"keyDown",key:char,code,
    text:char,unmodifiedText:char,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
   await command("Input.dispatchKeyEvent",{type:"keyUp",key:char,code,
    windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
   // CDP dispatches keystrokes faster than any physical keyboard. Allow the
   // one-shot Markdown DOM replacement to settle before the next keystroke.
   if(interval)await pause(interval);
  }
 };
 const pressShortcut=async(key,{meta=true,ctrl=false,shift=false}={})=>{
  const modifiers=(meta?4:0)|(ctrl?2:0)|(shift?8:0);
  const windowsVirtualKeyCode=key.toUpperCase().charCodeAt(0);
  await command("Input.dispatchKeyEvent",{type:"rawKeyDown",key,code:"Key"+key.toUpperCase(),
   windowsVirtualKeyCode,nativeVirtualKeyCode:windowsVirtualKeyCode,modifiers});
  await command("Input.dispatchKeyEvent",{type:"keyUp",key,code:"Key"+key.toUpperCase(),
   windowsVirtualKeyCode,nativeVirtualKeyCode:windowsVirtualKeyCode,modifiers});
  await pause(35);
 };
 const pressEnter=async()=>{
  await command("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",text:"\r",unmodifiedText:"\r",windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await command("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 };
 await command("Runtime.enable");await command("Page.enable");
 await command("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/"});
 await until('window.__rulesReady===true',"module load");
 assert.equal(await reset(),true,"README must be focused");
 await type("# ");await until('!!document.querySelector("#readme > h1")',"heading marker");
 const caretDiagnostics='(()=>{const s=getSelection(),a=s?.anchorNode;return {active:document.activeElement?.id,anchor:a?.nodeName,anchorParent:a?.parentElement?.outerHTML?.slice(0,200),offset:s?.anchorOffset,collapsed:s?.isCollapsed,rangeCount:s?.rangeCount,focus:s?.focusNode?.nodeName,editable:document.querySelector("#readme h1")?.isContentEditable};})()';
 console.log("After heading shortcut:",JSON.stringify(await evaluate(caretDiagnostics)));
 await type("Header");
 console.log("After typed heading text:",JSON.stringify(await evaluate(caretDiagnostics)),JSON.stringify(await evaluate('document.getElementById("readme").outerHTML')));
 await until('document.querySelector("#readme h1")?.textContent==="Header"',"heading text");
 await reset();await type("> ");await until('!!document.querySelector("#readme > blockquote > p")',"quote marker");
 await type("Quote");await until('document.querySelector("#readme blockquote p")?.textContent==="Quote"',"quote text");
 await reset();await type("- ");await until('!!document.querySelector("#readme > ul > li")',"bullet list");
 await reset();await type("2. ");await until('document.querySelector("#readme > ol")?.start===2',"numbered list");
 await reset();await type("- [x] ");
 await until('document.querySelector("#readme li input[type=checkbox]")?.checked===true',"task checkbox");
 await reset();await type(String.fromCharCode(96)+"word"+String.fromCharCode(96));
 await until('document.querySelector("#readme code")?.textContent==="word"',"inline code");
 await reset();await type("**bold**");
 await until('document.querySelector("#readme strong")?.textContent==="bold"',"strong emphasis");
 await reset();await type("*italic*");
 await until('document.querySelector("#readme em")?.textContent==="italic"',"italic emphasis");
 await reset();await type("~~removed~~");
 await until('document.querySelector("#readme del")?.textContent==="removed"',"strikethrough");
 await reset();await type("[docs](https://example.com)");
 await until('document.querySelector("#readme a")?.getAttribute("href")==="https://example.com"',"link");
 await reset();await type(String.fromCharCode(96).repeat(3)+"js");await pressEnter();
 await until('!!document.querySelector("#readme pre > code.language-js")',"fenced code");
 await reset();await type("---");await pressEnter();
 await until('!!document.querySelector("#readme > hr")',"horizontal rule");
 // Undo must cross a DOM-changing autoformat boundary, restore its literal
 // Markdown marker and then keep stepping back through ordinary keystrokes.
 await reset();await type("# ");
 await until('!!document.querySelector("#readme > h1")',"history autoformat heading");
 await pressShortcut("z");
 await until('document.querySelector("#readme > p")?.textContent==="# "',"undo autoformat to Markdown marker");
 await pressShortcut("z");
 await until('document.querySelector("#readme > p")?.textContent==="#"',"undo earlier typing past formatting");
 await pressShortcut("z",{meta:true,shift:true});
 await until('document.querySelector("#readme > p")?.textContent==="# "',"redo literal marker");
 await pressShortcut("z",{meta:true,shift:true});
 await until('!!document.querySelector("#readme > h1")',"redo formatted heading");
 await type("more");
 await pressShortcut("z");
 await until('document.querySelector("#readme > h1")?.textContent.replace(/\u200b/g,"")===""',"undo grouped typing after autoformat");
 await pressShortcut("z",{meta:true,shift:true});
 await until('document.querySelector("#readme > h1")?.textContent==="more"',"redo grouped typing after autoformat");

 await reset();await type("`word`");
 await until('document.querySelector("#readme code")?.textContent==="word"',"history inline code");
 await pressShortcut("z");
 await until('document.querySelector("#readme > p")?.textContent==="`word`"',"undo backticks to literal Markdown");
 await pressShortcut("z",{ctrl:true,meta:false,shift:true});
 await until('document.querySelector("#readme code")?.textContent==="word"',"Ctrl+Shift+Z redo inline formatting");
 await pressShortcut("z",{meta:false,ctrl:true});
 await until('document.querySelector("#readme > p")?.textContent==="`word`"',"Ctrl+Z alternate undo");
 await type("!");
 assert.equal(await evaluate("window.__history.canRedo"),false,"New edit must invalidate redo branch");
 await pressShortcut("z");
 await until('document.querySelector("#readme > p")?.textContent==="`word`"',"undo new edit");
 await pressShortcut("y",{meta:false,ctrl:true});
 await until('document.querySelector("#readme > p")?.textContent==="`word`!"',"Ctrl+Y alternate redo");

 await reset();await type("> ");
 await until('!!document.querySelector("#readme > blockquote")',"quote before undo");
 await pressShortcut("z");
 await until('document.querySelector("#readme > p")?.textContent==="> "',"undo quote to literal marker");
 await pressShortcut("z",{meta:true,shift:true});
 await until('!!document.querySelector("#readme > blockquote")',"redo quote formatting");
 console.log("README live Markdown typing plus undo/redo browser tests passed.");
}finally{
 try{socket?.close();}catch{}
 chrome.kill("SIGTERM");
 await new Promise(resolve=>server.close(resolve));
 // Chrome can still be flushing profile files after SIGTERM. Do not let
 // cleanup override the original browser assertion or test result.
 try{rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:120});}
 catch(error){console.warn("Chrome temporary-profile cleanup:",error.message);}
}
