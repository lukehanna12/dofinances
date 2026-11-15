// Bounded, selection-aware history for the README rich-text contenteditable.
//
// Browser undo tracks native keystrokes but not our Markdown DOM transforms.
// Using that native stack after a transform can jump across changes, orphan
// the caret, or stop at the formatting boundary. Keep one coherent timeline
// for native input, autoformatting, paste, checkboxes and keyboard redo.
const CHECKBOX='input[type="checkbox"]';
const DEFAULT_LIMIT=128;
const DEFAULT_BYTES=16*1024*1024;
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
export function createReadmeEditHistory(root,{limit=DEFAULT_LIMIT,maxBytes=DEFAULT_BYTES}={}){
 if(!root||typeof root.cloneNode!=="function")throw TypeError("A README DOM root is required.");
 const cap=Math.max(2,Math.min(512,Math.floor(Number(limit)||DEFAULT_LIMIT)));
 const budget=Math.max(100000,Number(maxBytes)||DEFAULT_BYTES);
 let frames=[],cursor=-1,bytes=0;
 const trim=()=>{
  // Drop the oldest checkpoints while preserving at least one undo position.
  while(frames.length>2&&(frames.length>cap||bytes>budget)&&cursor>1){
   bytes-=frames.shift().bytes;cursor--;
  }
  while(frames.length>cap&&cursor>0){
   bytes-=frames.shift().bytes;cursor--;
  }
 };
 const push=frame=>{
  if(!frame)return false;
  const previous=frames[cursor];
  if(previous?.html===frame.html){
   // Moving the caret is not a content edit. Preserve the current position.
   previous.selection=frame.selection;return false;
  }
  if(cursor<frames.length-1){
   for(const discarded of frames.splice(cursor+1))bytes-=discarded.bytes;
  }
  frames.push(frame);bytes+=frame.bytes;cursor=frames.length-1;trim();
  return true;
 };
 const reset=()=>{
  frames=[snapshot(root)];cursor=0;bytes=frames[0].bytes;
 };
 reset();
 const record=()=>push(snapshot(root));
 const rememberCaret=()=>{
  if(cursor>=0&&frames[cursor])frames[cursor].selection=selectionState(root);
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
 const undo=()=>{
  // Capture any native change that was not followed by its input event.
  record();
  if(cursor<=0)return false;
  cursor--;restore(root,frames[cursor]);return true;
 };
 const redo=()=>{
  record();
  if(cursor>=frames.length-1)return false;
  cursor++;restore(root,frames[cursor]);return true;
 };
 const clear=()=>{frames=[];cursor=-1;bytes=0;};
 return {reset,clear,record,snapshot:()=>snapshot(root),rememberCaret,synthesizeInsertion,push,undo,redo,
  get canUndo(){return cursor>0;},get canRedo(){return cursor>=0&&cursor<frames.length-1;},
  get length(){return frames.length;},get index(){return cursor;}};
}
