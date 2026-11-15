// One bounded, selection-aware history for the rendered README editor.
// Unlike a keystroke stack, adjacent native text edits are grouped. Markdown
// transformations, paste, composition, and checkboxes are explicit boundaries.
const CHECKBOX='input[type="checkbox"]';
const DEFAULT_LIMIT=128;
const DEFAULT_BYTES=16*1024*1024;
const GROUP_DELAY_MS=1100;
const BLOCKS="p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre";
function pathTo(root,node){
 if(!node||!root.contains(node))return null;
 const path=[];
 for(let cursor=node;cursor!==root;cursor=cursor.parentNode){
  if(!cursor?.parentNode)return null;
  path.unshift(Array.prototype.indexOf.call(cursor.parentNode.childNodes,cursor));
 }
 return path;
}
function locate(root,path){
 if(!Array.isArray(path))return null;
 let node=root;
 for(const index of path){
  if(!Number.isInteger(index)||index<0||index>=node.childNodes.length)return null;
  node=node.childNodes[index];
 }
 return node;
}
function clamp(node,offset){
 return Math.max(0,Math.min(Number(offset)||0,node.nodeType===3?node.data.length:node.childNodes.length));
}
function selectionState(root){
 const sel=root.ownerDocument.getSelection?.();
 if(!sel||!sel.rangeCount||!root.contains(sel.anchorNode)||!root.contains(sel.focusNode))return null;
 const anchorPath=pathTo(root,sel.anchorNode),focusPath=pathTo(root,sel.focusNode);
 if(!anchorPath||!focusPath)return null;
 return {anchorPath,anchorOffset:sel.anchorOffset,focusPath,focusOffset:sel.focusOffset};
}
// A logical position within the same block is stable across browser text-node
// splits and merges, but changes when a user moves the caret or changes blocks.
function caretKey(root){
 const sel=root.ownerDocument.getSelection?.();
 if(!sel?.isCollapsed||!sel.rangeCount||!root.contains(sel.anchorNode))return null;
 const node=sel.anchorNode;
 const element=node.nodeType===3?node.parentElement:node;
 const block=element?.closest?.(BLOCKS);
 if(!block||!root.contains(block))return null;
 try{
  const range=root.ownerDocument.createRange();
  range.setStart(block,0);range.setEnd(node,sel.anchorOffset);
  return JSON.stringify([pathTo(root,block),range.toString().length]);
 }catch{return null;}
}
function snapshot(root){
 const dom=root.cloneNode(true);
 const oldBoxes=root.querySelectorAll(CHECKBOX),newBoxes=dom.querySelectorAll(CHECKBOX);
 oldBoxes.forEach((box,index)=>{
  if(newBoxes[index]){
   newBoxes[index].checked=box.checked;
   newBoxes[index].toggleAttribute("checked",box.checked);
  }
 });
 const html=dom.innerHTML;
 return {dom,html,selection:selectionState(root),bytes:html.length*2};
}
function restore(root,frame){
 const oldScroll=root.scrollTop,doc=root.ownerDocument,selection=doc.getSelection?.();
 root.replaceChildren(...Array.from(frame.dom.childNodes,node=>node.cloneNode(true)));
 root.scrollTop=oldScroll;
 if(!frame.selection||!selection)return;
 const anchor=locate(root,frame.selection.anchorPath),focus=locate(root,frame.selection.focusPath);
 if(!anchor||!focus)return;
 root.focus({preventScroll:true});
 try{
  selection.setBaseAndExtent(anchor,clamp(anchor,frame.selection.anchorOffset),
   focus,clamp(focus,frame.selection.focusOffset));
 }catch{
  try{
   const range=doc.createRange();
   range.setStart(anchor,clamp(anchor,frame.selection.anchorOffset));
   range.collapse(true);selection.removeAllRanges();selection.addRange(range);
  }catch{}
 }
}
export function createReadmeEditHistory(root,{limit=DEFAULT_LIMIT,maxBytes=DEFAULT_BYTES,groupDelay=GROUP_DELAY_MS}={}){
 if(!root||typeof root.cloneNode!=="function")throw TypeError("A README DOM root is required.");
 const cap=Math.max(2,Math.min(512,Math.floor(Number(limit)||DEFAULT_LIMIT)));
 const budget=Math.max(100000,Number(maxBytes)||DEFAULT_BYTES);
 const delay=Math.max(100,Math.min(3000,Number(groupDelay)||GROUP_DELAY_MS));
 let frames=[],cursor=-1,bytes=0,group=null,pending=null;
 const isolate=()=>{group=null;pending=null;};
 const trim=()=>{
  while(frames.length>2&&(frames.length>cap||bytes>budget)&&cursor>1){
   bytes-=frames.shift().bytes;cursor--;
   if(group)group.index--;
  }
  while(frames.length>cap&&cursor>0){
   bytes-=frames.shift().bytes;cursor--;
   if(group)group.index--;
  }
 };
 const push=frame=>{
  isolate();
  if(!frame)return false;
  const previous=frames[cursor];
  if(previous?.html===frame.html){
   previous.selection=frame.selection;return false;
  }
  if(cursor<frames.length-1){
   for(const discarded of frames.splice(cursor+1))bytes-=discarded.bytes;
  }
  frames.push(frame);bytes+=frame.bytes;cursor=frames.length-1;trim();
  return true;
 };
 const reset=()=>{
  frames=[snapshot(root)];cursor=0;bytes=frames[0].bytes;isolate();
 };
 reset();
 // Structural mutations and administrative changes are always separate steps.
 const record=()=>push(snapshot(root));
 const rememberCaret=()=>{
  if(cursor>=0&&frames[cursor])frames[cursor].selection=selectionState(root);
 };
 const kindFor=inputType=>({
  insertText:"text",deleteContentBackward:"backward",deleteContentForward:"forward"
 })[inputType]||null;
 const noteBeforeInput=event=>{
  const kind=kindFor(event?.inputType);
  pending={kind,start:caretKey(root),at:Date.now()};
  rememberCaret();
 };
 const discardPending=()=>{pending=null;};
 const recordNative=event=>{
  const before=pending;pending=null;
  const afterPosition=caretKey(root),next=snapshot(root);
  if(frames[cursor]?.html===next.html){
   if(frames[cursor])frames[cursor].selection=next.selection;
   return false;
  }
  const now=Date.now(),kind=kindFor(event?.inputType);
  const canGroup=!!kind&&kind===before?.kind&&before.start!==null&&
   afterPosition!==null&&group?.kind===kind&&group.after===before.start&&
   group.index===cursor&&cursor===frames.length-1&&
   now-group.at<=delay;
  if(canGroup){
   bytes-=frames[cursor].bytes;frames[cursor]=next;bytes+=next.bytes;
   group.after=afterPosition;group.at=now;trim();
   return true;
  }
  push(next);
  group=kind&&before?.kind===kind&&before.start!==null&&afterPosition!==null?
   {kind,after:afterPosition,at:now,index:cursor}:null;
  return true;
 };
 const synthesizeInsertion=literal=>{
  if(typeof literal!=="string"||literal.length>10)return null;
  const original=snapshot(root),selected=original.selection;
  if(!selected||selected.anchorOffset!==selected.focusOffset||
   JSON.stringify(selected.anchorPath)!==JSON.stringify(selected.focusPath))return null;
  const clone=original.dom,at=locate(clone,selected.anchorPath);
  if(!at||at.nodeType!==3)return null;
  at.insertData(clamp(at,selected.anchorOffset),literal);
  const offset=selected.anchorOffset+literal.length;
  const next={anchorPath:selected.anchorPath,focusPath:selected.focusPath,
   anchorOffset:offset,focusOffset:offset};
  const html=clone.innerHTML;
  return {dom:clone,html,selection:next,bytes:html.length*2};
 };
 // Only record a genuinely untracked DOM change before time travel. Calling
 // record() on every undo/redo would manufacture entries after DOM restoration.
 const synchronize=()=>{
  const actual=snapshot(root);
  if(frames[cursor]?.html!==actual.html)push(actual);
 };
 const undo=({skipSync=false}={})=>{
  if(!skipSync)synchronize();
  isolate();
  if(cursor<=0)return false;
  cursor--;restore(root,frames[cursor]);return true;
 };
 const redo=({skipSync=false}={})=>{
  if(!skipSync)synchronize();
  isolate();
  if(cursor>=frames.length-1)return false;
  cursor++;restore(root,frames[cursor]);return true;
 };
 const clear=()=>{frames=[];cursor=-1;bytes=0;isolate();};
 return {reset,clear,isolate,record,recordNative,noteBeforeInput,discardPending,
  snapshot:()=>snapshot(root),rememberCaret,synthesizeInsertion,push,undo,redo,
  get canUndo(){return cursor>0;},get canRedo(){return cursor>=0&&cursor<frames.length-1;},
  get length(){return frames.length;},get index(){return cursor;}};
}
