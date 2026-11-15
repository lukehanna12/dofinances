// Obsidian-like Markdown input rules for the existing GitHub-rendered README.
// This module changes only the affected DOM range. No rerendering, hidden
// textarea, external editor, or polling; the selection/caret remains in place.
const NODE_TEXT=3,NODE_ELEMENT=1;
const BLOCK_SELECTOR="p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre";
const FENCE=/^\x60{3}([A-Za-z0-9_+#.-]{0,32})\s*$/;
const RULE_ENDING=/[\x60*_~)]/;

function escapedAt(text,index){
 let backslashes=0;
 for(let i=index-1;i>=0&&text[i]==="\\";i--)backslashes++;
 return (backslashes&1)!==0;
}
export function readmeInlineRule(prefix){
 if(typeof prefix!=="string"||prefix.length>2000||prefix.includes("\n"))return null;

 // Complete inline link or image: [text](https://host/path) or ![alt](./image.png).
 // Never interpret an executable URL scheme as a link.
 const link=/(!?)\[([^\]\n]{1,200})\]\(([^()\s]{1,800})(?:\s+"([^"\n]{1,150})")?\)$/.exec(prefix);
 if(link){
  const start=prefix.length-link[0].length;
  if(!escapedAt(prefix,start)&&!/^(?:javascript|data|vbscript|file):/i.test(link[3])&&
   (/^(?:https?:\/\/|mailto:|#|\.{0,2}\/|[A-Za-z0-9_-])/i.test(link[3]))){
   return {kind:link[1]?"image":"link",start,text:link[2],href:link[3],title:link[4]||""};
  }
 }
 // Backticks are rendered immediately on the closing delimiter (including
 // multi-backtick code spans with a literal backtick in their contents).
 for(let count=3;count>=1;count--){
  const marker="\x60".repeat(count);
  if(!prefix.endsWith(marker))continue;
  const end=prefix.length-count,start=prefix.lastIndexOf(marker,end-1);
  if(start<0||start+count>=end||escapedAt(prefix,start))continue;
  const text=prefix.slice(start+count,end);
  if(text.includes(marker))continue;
  // A fence at the beginning of a line belongs to the block-level rule.
  if(count===3&&start===0&&!text.trim())continue;
  return {kind:"code",start,text};
 }

 const patterns=[
  {kind:"strongEm",pattern:/(\*{3}|_{3})(\S(?:[^\n]*?\S)?)\1$/},
  {kind:"strong",pattern:/(\*{2}|_{2})(\S(?:[^\n]*?\S)?)\1$/},
  {kind:"strike",pattern:/(~{2})(\S(?:[^\n]*?\S)?)\1$/},
  {kind:"em",pattern:/(\*|_)(\S(?:[^\n]*?\S)?)\1$/}
 ];
 for(const {kind,pattern} of patterns){
  const m=pattern.exec(prefix);
  if(!m)continue;
  const start=prefix.length-m[0].length;
  const preceding=prefix[start-1]||"";
  if(escapedAt(prefix,start))continue;
  if(preceding&&/[\p{L}\p{N}_*~]/u.test(preceding))continue;
  if(m[2].includes(m[1])||!m[2].trim())continue;
  return {kind,start,text:m[2]};
 }
 return null;
}

export function readmeBlockRule(prefix,{trigger="space",inList=false}={}){
 if(typeof prefix!=="string"||prefix.length>160)return null;
 // Chromium may represent a just-typed trailing space as a nonbreaking space
 // in contenteditable. Match it as ordinary Markdown whitespace.
 prefix=prefix.replace(/\u00a0/g," ");
 // Enter after a fence opens a fenced code block, preserving its language.
 if(trigger==="enter"){
  const m=FENCE.exec(prefix);
  if(m)return {kind:"fence",language:m[1]||""};
 }
 if(trigger!=="space"&&trigger!=="enter")return null;
 if(inList&&/^\[(?: |x|X)\] $/.test(prefix))
  return {kind:"task",checked:/^\[[xX]\]/.test(prefix)};
 const heading=/^(#{1,6}) $/.exec(prefix);
 if(heading&&trigger==="space")return {kind:"heading",level:heading[1].length};
 if(prefix==="> "&&trigger==="space")return {kind:"quote"};
 if(/^[-+*] $/.test(prefix)&&trigger==="space")return {kind:"ul"};
 const ordered=/^([1-9][0-9]{0,4})[.)] $/.exec(prefix);
 if(ordered&&trigger==="space")return {kind:"ol",start:Number(ordered[1])};
 if(/^(?:---|\*\*\*|___) ?$/.test(prefix)&&
  (trigger==="enter"||prefix.endsWith(" ")))return {kind:"hr"};
 if(trigger==="space"&&FENCE.test(prefix))return {kind:"fence",language:FENCE.exec(prefix)[1]||""};
 return null;
}

function selectedCaret(root){
 const doc=root.ownerDocument,selection=doc.getSelection?.();
 if(!selection||!selection.isCollapsed||!selection.rangeCount)return null;
 const range=selection.getRangeAt(0);
 if(!root.contains(range.startContainer))return null;
 let node=range.startContainer,offset=range.startOffset;
 if(node.nodeType===NODE_ELEMENT){
  const child=node.childNodes[offset-1];
  if(!child||child.nodeType!==NODE_TEXT)return null;
  node=child;offset=node.length;
 }
 if(node.nodeType!==NODE_TEXT)return null;
 return {doc,selection,node,offset};
}
function nearestBlock(root,node){
 let block=node.parentElement?.closest?.(BLOCK_SELECTOR)||null;
 if(block===root||!block||!root.contains(block))return null;
 // Ignore editing inside code, tables, and other structures where a Markdown
 // syntax conversion would corrupt the surrounding GitHub-rich document.
 if(block.closest("table")||node.parentElement?.closest("code,pre,kbd,samp"))return null;
 return block;
}
function prefixToCaret(ctx,block){
 const range=ctx.doc.createRange();
 range.setStart(block,0);
 range.setEnd(ctx.node,ctx.offset);
 return {range,prefix:range.toString()};
}
function placeCaret(doc,element,offset=0){
 const selection=doc.getSelection?.();
 if(!selection)return;
 const r=doc.createRange();
 r.setStart(element,Math.min(offset,element.nodeType===NODE_TEXT?element.length:element.childNodes.length));
 r.collapse(true);
 selection.removeAllRanges();selection.addRange(r);
}
const CARET_ANCHOR="\u200b";
function fillEmpty(doc,node){
 // A zero-width text anchor (not an empty BR-only element) keeps Chromium's
 // Selection attached when contenteditable replaces an empty heading/list.
 if(!node.childNodes.length)node.append(doc.createTextNode(CARET_ANCHOR));
}
function clearCaretAnchor(root){
 const selection=root.ownerDocument.getSelection?.();
 const node=selection?.anchorNode;
 if(!node||node.nodeType!==NODE_TEXT||!node.data.includes(CARET_ANCHOR))return;
 const offset=selection.anchorOffset;
 const removedBefore=node.data.slice(0,offset).split(CARET_ANCHOR).length-1;
 node.data=node.data.split(CARET_ANCHOR).join("");
 if(selection.isCollapsed)placeCaret(root.ownerDocument,node,Math.max(0,offset-removedBefore));
}
function transferChildren(from,to){
 while(from.firstChild)to.append(from.firstChild);
}
function applyInline(root,ctx,pendingEnding=""){
 if(ctx.node.parentElement?.closest("code,pre,kbd,samp,a"))return false;
 const prefix=ctx.node.data.slice(0,ctx.offset)+pendingEnding;
 if(prefix.length>2000)return false;
 const rule=readmeInlineRule(prefix);
 if(!rule)return false;
 const doc=ctx.doc,range=doc.createRange();
 range.setStart(ctx.node,rule.start);range.setEnd(ctx.node,ctx.offset);
 let replacement;
 switch(rule.kind){
  case "code":replacement=doc.createElement("code");replacement.textContent=rule.text;break;
  case "strong":replacement=doc.createElement("strong");replacement.textContent=rule.text;break;
  case "em":replacement=doc.createElement("em");replacement.textContent=rule.text;break;
  case "strike":replacement=doc.createElement("del");replacement.textContent=rule.text;break;
  case "strongEm":
   replacement=doc.createElement("strong");
   const em=doc.createElement("em");em.textContent=rule.text;replacement.append(em);break;
  case "link":{
   replacement=doc.createElement("a");
   replacement.textContent=rule.text;
   replacement.setAttribute("href",rule.href);
   replacement.setAttribute("data-readme-original-href",rule.href);
   replacement.rel="noopener noreferrer";
   if(/^https?:\/\//i.test(rule.href))replacement.target="_blank";
   if(rule.title)replacement.title=rule.title;
   break;
  }
  case "image":{
   // Avoid placing an arbitrary origin image in the document. The backend
   // image association handler is applied by the regular README renderer
   // on save; here a safe inline image uses only HTTPS (no data/javascript).
   if(!/^https:\/\//i.test(rule.href))return false;
   replacement=doc.createElement("img");
   replacement.alt=rule.text;replacement.src=rule.href;
   replacement.setAttribute("data-readme-original-src",rule.href);
   if(rule.title)replacement.title=rule.title;
   break;
  }
  default:return false;
 }
 range.deleteContents();range.insertNode(replacement);
 placeCaret(doc,replacement.parentNode,
  Array.prototype.indexOf.call(replacement.parentNode.childNodes,replacement)+1);
 return true;
}
function applyBlock(root,ctx,trigger,pendingSpace=""){
 const block=nearestBlock(root,ctx.node);
 if(!block)return false;
 const {range,prefix}=prefixToCaret(ctx,block);
 const isList=block.localName==="li";
 const rule=readmeBlockRule(prefix+pendingSpace,{trigger,inList:isList});
 if(!rule)return false;
 if(isList&&rule.kind!=="task")return false;
 // Do not collapse existing structure if a nested inline element precedes
 // the marker; the rule applies to plain Markdown text at the block start.
 if(!block.textContent?.startsWith(prefix))return false;

 const doc=ctx.doc;
 if(rule.kind==="task"){
  range.deleteContents();
  const box=doc.createElement("input");box.type="checkbox";
  box.checked=rule.checked;box.disabled=false;
  block.insertBefore(box,block.firstChild);
  const spacer=doc.createTextNode(" ");
  box.after(spacer);
  placeCaret(doc,spacer,1);
  return true;
 }
 range.deleteContents();
 let container,caretTarget;
 switch(rule.kind){
  case "heading":
   container=doc.createElement("h"+rule.level);caretTarget=container;
   transferChildren(block,caretTarget);fillEmpty(doc,caretTarget);break;
  case "quote":
   container=doc.createElement("blockquote");
   caretTarget=doc.createElement("p");
   transferChildren(block,caretTarget);fillEmpty(doc,caretTarget);
   container.append(caretTarget);break;
  case "ul":
  case "ol":
   container=doc.createElement(rule.kind);
   if(rule.kind==="ol"&&rule.start!==1)container.start=rule.start;
   caretTarget=doc.createElement("li");
   transferChildren(block,caretTarget);fillEmpty(doc,caretTarget);
   container.append(caretTarget);break;
  case "fence":
   container=doc.createElement("pre");
   caretTarget=doc.createElement("code");
   if(rule.language)caretTarget.className="language-"+rule.language;
   // A text node allows a caret inside an initially empty code block.
   caretTarget.append(doc.createTextNode(CARET_ANCHOR));
   container.append(caretTarget);break;
  case "hr":
   container=doc.createElement("hr");
   caretTarget=doc.createElement("p");
   fillEmpty(doc,caretTarget);
   block.replaceWith(container,caretTarget);
   placeCaret(doc,caretTarget.firstChild,caretTarget.firstChild.length);
   return true;
  default:return false;
 }
 block.replaceWith(container);
 if(caretTarget.firstChild?.nodeType===NODE_TEXT)
  placeCaret(doc,caretTarget.firstChild,caretTarget.firstChild.length);
 else placeCaret(doc,caretTarget,0);
 return true;
}
function handleCodeEnter(root,ctx){
 const code=ctx.node.parentElement?.closest("pre > code");
 if(!code||!root.contains(code))return false;
 const doc=ctx.doc,range=doc.getSelection().getRangeAt(0);
 const line=ctx.node.data.slice(0,ctx.offset).split("\n").at(-1);
 // An explicit closing fence exits the block on Enter.
 if(/^\x60{3}\s*$/.test(line)){
  const prefix=doc.createRange();
  const block=code.closest("pre");
  prefix.setStart(ctx.node,ctx.offset-line.length);
  prefix.setEnd(ctx.node,ctx.offset);prefix.deleteContents();
  const next=doc.createElement("p");next.append(doc.createElement("br"));
  block.after(next);placeCaret(doc,next,0);
  return true;
 }
 range.deleteContents();
 const newline=doc.createTextNode("\n");
 range.insertNode(newline);placeCaret(doc,newline,1);
 return true;
}

/** Convert a newly typed space or closing delimiter into rendered GFM. */
export function applyReadmeMarkdownInput(root,event){
 if(!root||event?.isComposing)return false;
 clearCaretAnchor(root);
 if(event?.inputType?.startsWith?.("delete"))return false;
 if(event?.inputType!=="insertText")return false;
 const ctx=selectedCaret(root);
 if(!ctx)return false;
 if(event.data===" "||event.data==="\u00a0")return applyBlock(root,ctx,"space");
 if(typeof event.data==="string"&&event.data.length===1&&RULE_ENDING.test(event.data))
  return applyInline(root,ctx);
 return false;
}
/** Handle Enter before the browser splits a fence or horizontal-rule line. */
export function applyReadmeMarkdownBeforeInput(root,event){
 if(!root||!event?.cancelable||event.isComposing)return false;
 // Removing the active text node synchronously inside beforeinput can make
 // Chromium revoke its Selection when the key event finishes. Cancel the
 // trigger, then transform in a one-shot post-event task. This is neither
 // polling nor a document re-render; the caret stays in the same document.
 const defer=(ctx,operation)=>{
  event.preventDefault();
  setTimeout(()=>{
   if(!root.isConnected||!root.isContentEditable||!root.contains(ctx.node))return;
   operation();
  },0);
  return true;
 };
 if(event.inputType==="insertText"&&typeof event.data==="string"){
  const ctx=selectedCaret(root);
  if(ctx){
   if(event.data===" "||event.data==="\u00a0"){
    const block=nearestBlock(root,ctx.node);
    if(block){
     const {prefix}=prefixToCaret(ctx,block);
     const rule=readmeBlockRule(prefix+" ",{trigger:"space",inList:block.localName==="li"});
     if(rule&&(!["task"].includes(rule.kind)||block.localName==="li"))
      return defer(ctx,()=>applyBlock(root,ctx,"space"," "));
    }
   }else if(event.data.length===1&&RULE_ENDING.test(event.data)&&
      !ctx.node.parentElement?.closest("code,pre,kbd,samp,a")){
    const rule=readmeInlineRule(ctx.node.data.slice(0,ctx.offset)+event.data);
    if(rule&&(rule.kind!=="image"||/^https:\/\//i.test(rule.href)))
     return defer(ctx,()=>applyInline(root,ctx,event.data));
   }
  }
 }
 // Selected text + a backtick is a one-gesture inline-code shortcut.
 if(event.inputType==="insertText"&&event.data==="\x60"){
  const selection=root.ownerDocument.getSelection?.();
  if(selection&&!selection.isCollapsed&&selection.rangeCount&&
    root.contains(selection.anchorNode)&&root.contains(selection.focusNode)){
   const range=selection.getRangeAt(0).cloneRange();
   if(!range.startContainer.parentElement?.closest("code,pre")){
    const content=selection.toString();
    if(content&&!content.includes("\n")){
     event.preventDefault();
     setTimeout(()=>{
      if(!root.isConnected||!root.isContentEditable||!root.contains(range.startContainer))return;
      const code=root.ownerDocument.createElement("code");code.textContent=content;
      range.deleteContents();range.insertNode(code);
      placeCaret(root.ownerDocument,code.parentNode,
       Array.prototype.indexOf.call(code.parentNode.childNodes,code)+1);
     },0);
     return true;
    }
   }
  }
 }
 if(!["insertParagraph","insertLineBreak"].includes(event.inputType))return false;
 const ctx=selectedCaret(root);
 if(!ctx)return false;
 if(ctx.node.parentElement?.closest("pre > code"))
  return defer(ctx,()=>handleCodeEnter(root,ctx));
 const block=nearestBlock(root,ctx.node);
 if(!block||!["p","div"].includes(block.localName))return false;
 const {prefix}=prefixToCaret(ctx,block);
 const rule=readmeBlockRule(prefix,{trigger:"enter"});
 if(!rule||!["fence","hr"].includes(rule.kind))return false;
 return defer(ctx,()=>applyBlock(root,ctx,"enter"));
}
