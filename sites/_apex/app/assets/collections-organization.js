/* Owner-only Collections layout configuration, keyed by immutable IDs. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeCollectionConfiguration(collections,configuration){
 const ids=new Set(collections.map(x=>x.collection_id));
 const prior=configuration?.entries&&typeof configuration.entries==="object"?configuration.entries:{};
 const ordered=[...collections].sort((a,b)=>{
   const aa=Number.isInteger(prior[a.collection_id]?.position)?prior[a.collection_id].position:1e9;
   const bb=Number.isInteger(prior[b.collection_id]?.position)?prior[b.collection_id].position:1e9;
   return aa-bb||a.name.localeCompare(b.name);
 });
 const entries={};
 ordered.forEach((col,index)=>{
   const id=col.collection_id,item=prior[id]||{};
   const parent=typeof item.parent_id==="string"&&UUID.test(item.parent_id)&&ids.has(item.parent_id)&&item.parent_id!==id?
     item.parent_id:null;
   entries[id]={position:index,parent_id:parent,hidden:item.hidden===true};
 });
 for(const id of Object.keys(entries)){
   const seen=new Set([id]);let cursor=entries[id].parent_id;
   while(cursor){if(seen.has(cursor)){entries[id].parent_id=null;break;}
     seen.add(cursor);cursor=entries[cursor]?.parent_id||null;}
 }
 const revision=Number.isSafeInteger(configuration?.revision)&&configuration.revision>=0?configuration.revision:0;
 return {revision,entries};
}
export function orderedCollectionTree(collections,entries){
 const byId=new Map(collections.map(x=>[x.collection_id,x]));
 const sorted=[...collections].sort((a,b)=>
   (entries[a.collection_id]?.position??1e9)-(entries[b.collection_id]?.position??1e9)||
   a.name.localeCompare(b.name));
 const children=new Map();
 for(const item of sorted){
   let parent=entries[item.collection_id]?.parent_id||null;
   if(!byId.has(parent)||parent===item.collection_id)parent=null;
   if(!children.has(parent))children.set(parent,[]);
   children.get(parent).push(item);
 }
 const seen=new Set(),out=[];
 function visit(parent,depth){
   for(const item of children.get(parent)||[]){
     if(seen.has(item.collection_id))continue;
     seen.add(item.collection_id);
     out.push({...item,collection_depth:depth});
     visit(item.collection_id,Math.min(depth+1,16));
   }
 }
 visit(null,0);
 for(const item of sorted)if(!seen.has(item.collection_id)){seen.add(item.collection_id);out.push({...item,collection_depth:0});visit(item.collection_id,1);}
 return out;
}
export function collectionDescendsFrom(entries,id,ancestor){
 let cursor=entries[id]?.parent_id||null;const visited=new Set();
 while(cursor){if(cursor===ancestor)return true;
  if(visited.has(cursor))return false;visited.add(cursor);cursor=entries[cursor]?.parent_id||null;}
 return false;
}
export function moveCollectionInConfiguration(entries,draggedId,targetId,position){
 if(!entries[draggedId]||!entries[targetId]||draggedId===targetId||
    !["before","after","inside"].includes(position))return null;
 const parent=position==="inside"?targetId:entries[targetId].parent_id;
 if(parent===draggedId||(parent&&collectionDescendsFrom(entries,parent,draggedId)))return null;
 const next=Object.fromEntries(Object.entries(entries).map(([id,e])=>[id,{...e}]));
 next[draggedId].parent_id=parent??null;
 const order=Object.keys(next).sort((a,b)=>next[a].position-next[b].position).filter(id=>id!==draggedId);
 const targetIndex=order.indexOf(targetId);
 if(targetIndex<0)return null;
 let insertion=targetIndex;
 if(position==="inside")insertion=targetIndex+1;
 else if(position==="after"){
   insertion=targetIndex+1;
   while(insertion<order.length&&collectionDescendsFrom(next,order[insertion],targetId))insertion++;
 }
 order.splice(insertion,0,draggedId);
 order.forEach((id,index)=>{next[id].position=index});
 return next;
}

