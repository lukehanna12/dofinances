// Source-verified Utility editorial profile controls.
// The owning page supplies the existing signed owner API. No extra reads,
// polling, local persistence, profile replicas or collection annotations.
const UID=/^[0-9a-f]{6}$/;

export function validateUtilityAnnotation(description,notes,rating) {
 if(typeof description!=="string"||description.length<1||description.length>250||
    description!==description.trim()||/[\u0000-\u001f\u007f]/.test(description))
  throw Error("Description is required, must be 250 characters or fewer, and must be a single paragraph without leading or trailing spaces.");
 if(typeof notes!=="string"||[...notes].length>100||/[\u0000-\u001f\u007f]/.test(notes))
  throw Error("Notes must be 100 characters or fewer, without line breaks.");
 if(rating!==null&&(!Number.isInteger(rating*2)||rating<0.5||rating>5))
  throw Error("Rating must be 0.5–5 in half-star increments.");
 return {description,notes,rating};
}

export function createUtilityAnnotationEditor({root,api,getItem,updated,report}) {
 if(!root||typeof api!=="function"||typeof getItem!=="function"||typeof updated!=="function")
  throw TypeError("A Utilities owner context is required.");
 const dialog=document.createElement("dialog");
 dialog.className="ut-annotation-dialog";
 dialog.setAttribute("aria-labelledby","ut-annotation-title");
 dialog.innerHTML=
  '<form class="ut-annotation-form">'+
  '<p class="ut-annotation-overline">UTILITY PROFILE</p>'+
  '<h2 id="ut-annotation-title">Description, notes &amp; rating</h2>'+
  '<p class="ut-annotation-target" data-annotation-target></p>'+
  '<label for="ut-annotation-description">Description <small>Required · 250 characters</small></label>'+
  '<textarea id="ut-annotation-description" rows="4" maxlength="250" required spellcheck="true" aria-describedby="ut-annotation-description-count"></textarea>'+
  '<p id="ut-annotation-description-count" class="ut-annotation-count" aria-live="polite">0 / 250</p>'+
  '<label for="ut-annotation-notes">Notes <small>Optional · 100 characters</small></label>'+
  '<textarea id="ut-annotation-notes" rows="3" maxlength="100" spellcheck="true" placeholder="Add a note about this utility"></textarea>'+
  '<label for="ut-annotation-rating">Rating <small>Optional · half-star steps</small></label>'+
  '<select id="ut-annotation-rating"><option value="">Unrated</option>'+
  Array.from({length:10},(_,i)=>'<option value="'+((i+1)/2)+'">'+((i+1)/2).toFixed(1)+' / 5</option>').join("")+
  '</select><p class="ut-annotation-error" data-annotation-error role="alert" aria-live="assertive"></p>'+
  '<div class="ut-annotation-actions">'+
  '<button type="button" data-annotation-cancel>Cancel</button>'+
  '<button type="submit" data-annotation-save>Save changes</button></div></form>';
 root.append(dialog);
 const form=dialog.querySelector("form");
 const description=dialog.querySelector("#ut-annotation-description");
 const descriptionCount=dialog.querySelector("#ut-annotation-description-count");
 const updateDescriptionCount=()=>{descriptionCount.textContent=description.value.length+" / 250";};
 description.addEventListener("input",updateDescriptionCount);
 const note=dialog.querySelector("#ut-annotation-notes");
 const rating=dialog.querySelector("#ut-annotation-rating");
 const error=dialog.querySelector("[data-annotation-error]");
 const save=dialog.querySelector("[data-annotation-save]");
 let uid=null,version=0,working=false;
 function open(target){
  if(working||dialog.open||!UID.test(target))return;
  const item=getItem(target);
  if(!item)return;
  uid=target;version=Number.isSafeInteger(item.editorial_version)?item.editorial_version:0;
  description.value=typeof item.description==="string"?item.description:"";
  updateDescriptionCount();
  note.value=typeof item.notes==="string"?item.notes:"";
  rating.value=item.rating==null?"":String(item.rating);
  dialog.querySelector("[data-annotation-target]").textContent=item.name+" · "+uid;
  error.textContent="";
  dialog.showModal();
  description.focus();
 }
 function close(){
  if(working)return;
  dialog.close();
  uid=null;
 }
 root.addEventListener("click",event=>{
  const trigger=event.target.closest("[data-ut-edit-annotation]");
  if(!trigger||!root.contains(trigger))return;
  event.preventDefault();event.stopPropagation();
  open(trigger.dataset.utEditAnnotation);
 },true);
 dialog.querySelector("[data-annotation-cancel]").addEventListener("click",close);
 dialog.addEventListener("cancel",event=>{if(working)event.preventDefault();});
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(working||!uid)return;
  let values;
  try{values=validateUtilityAnnotation(description.value,note.value,rating.value===""?null:Number(rating.value));}
  catch(e){error.textContent=e.message;return;}
  working=true;save.disabled=true;error.textContent="";
  try{
   const result=await api({action:"annotate",uid,...values,expected_version:version});
   if(!result?.ok||result.uid!==uid||!Number.isSafeInteger(result.editorial_version))
    throw Error("Colosseum did not confirm the profile update.");
   updated(uid,{description:result.description??null,notes:result.notes,
    rating:result.rating??null,editorial_version:result.editorial_version});
   report?.("Description, notes and rating saved for "+uid+".");
   working=false;dialog.close();uid=null;
  }catch(e){
   error.textContent=/annotation_conflict/i.test(e.message||"")?
    "This utility profile has changed. Refresh the details before saving, to avoid overwriting someone else's description.":e.message||"Could not save the utility profile.";
  }finally{working=false;save.disabled=false;}
 });
 return {open,dialog};
}
