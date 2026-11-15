// Shared README editing event adapter: production and Chromium regression use
// precisely the same input rules, grouped history, and keyboard semantics.
import {createReadmeEditHistory} from "./readme-edit-history.js";
import {applyReadmeMarkdownInput,applyReadmeMarkdownBeforeInput} from "./readme-markdown-input-rules.js";

export function installReadmeEditorInteractions(root,{
 isEditing=()=>root.isContentEditable,
 onChange=()=>{},
 onImmediateChange=onChange
}={}){
 const history=createReadmeEditHistory(root);
 let composing=false,insertingPaste=false;
 const enabled=()=>!!isEditing();
 const changed=immediate=>immediate?onImmediateChange():onChange();
 const travel=(redo=false,options)=>{
  const moved=redo?history.redo(options):history.undo(options);
  if(moved)changed(true);
  return moved;
 };
 // Key combinations are intercepted before the browser's native contenteditable
 // history. The Edit menu also issues historyUndo/historyRedo beforeinput events.
 root.addEventListener("keydown",event=>{
  if(!enabled()||event.isComposing||composing||event.altKey)return;
  if(!event.metaKey&&!event.ctrlKey)return;
  const z=event.code==="KeyZ"||event.key?.toLowerCase()==="z";
  const y=event.code==="KeyY"||event.key?.toLowerCase()==="y";
  const undo=z&&!event.shiftKey;
  const redo=z&&event.shiftKey||y&&event.ctrlKey&&!event.metaKey&&!event.shiftKey;
  if(!undo&&!redo)return;
  event.preventDefault();event.stopPropagation();
  travel(redo);
 },true);
 root.addEventListener("beforeinput",event=>{
  if(!enabled()||insertingPaste)return;
  if(event.inputType==="historyUndo"||event.inputType==="historyRedo"){
   if(event.cancelable){
    event.preventDefault();travel(event.inputType==="historyRedo");
   }
   return;
  }
  if(composing||event.isComposing)return;
  history.noteBeforeInput(event);
  const hooks={
   prepare:literal=>history.synthesizeInsertion(literal),
   commit:checkpoint=>{
    if(checkpoint)history.push(checkpoint);
    history.record();changed(false);
   },
   cancel:()=>history.discardPending()
  };
  if(applyReadmeMarkdownBeforeInput(root,event,hooks))changed(false);
 });
 root.addEventListener("input",event=>{
  if(!enabled()||insertingPaste)return;
  // Some editing hosts emit a non-cancelable browser-history beforeinput.
  // Restore the authoritative custom frame after that native action instead.
  if(event.inputType==="historyUndo"||event.inputType==="historyRedo"){
   travel(event.inputType==="historyRedo",{skipSync:true});return;
  }
  if(composing||event.isComposing){changed(false);return;}
  const nativeFrame=history.snapshot();
  if(applyReadmeMarkdownInput(root,event)){
   history.push(nativeFrame);history.record();
  }else history.recordNative(event);
  changed(false);
 });
 root.addEventListener("compositionstart",()=>{
  if(!enabled())return;
  composing=true;history.isolate();history.rememberCaret();
 });
 root.addEventListener("compositionend",()=>{
  if(!enabled())return;
  composing=false;
  // One committed IME transaction, not one undo step for every interim glyph.
  queueMicrotask(()=>{
   if(!enabled())return;
   history.record();changed(false);
  });
 });
 root.addEventListener("paste",event=>{
  if(!enabled())return;
  event.preventDefault();
  history.rememberCaret();history.isolate();
  const plain=event.clipboardData?.getData("text/plain")||"";
  insertingPaste=true;
  try{
   // Inserting plain text through the browser retains multiline paste
   // semantics; the fallback never accepts active HTML from the clipboard.
   if(!root.ownerDocument.execCommand("insertText",false,plain)){
    const selection=root.ownerDocument.getSelection?.();
    if(selection?.rangeCount&&root.contains(selection.anchorNode)&&
       root.contains(selection.focusNode)){
     const range=selection.getRangeAt(0);
     range.deleteContents();
     const node=root.ownerDocument.createTextNode(plain);
     range.insertNode(node);
     range.setStartAfter(node);range.collapse(true);
     selection.removeAllRanges();selection.addRange(range);
    }
   }
  }finally{insertingPaste=false;}
  history.record();changed(true);
 });
 root.addEventListener("drop",event=>{if(enabled())event.preventDefault();});
 root.addEventListener("change",event=>{
  if(enabled()&&event.target.matches?.('input[type="checkbox"]')){
   history.record();changed(true);
  }
 });
 return history;
}
