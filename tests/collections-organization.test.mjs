import test from "node:test";
import assert from "node:assert/strict";
import {
 normalizeCollectionConfiguration,orderedCollectionTree,
 moveCollectionInConfiguration,collectionDescendsFrom
} from "../sites/_apex/app/assets/collections-organization.js";
const A="75c57c66-b32d-490d-a113-5811ab73172d";
const B="64cf65ce-be6d-432b-a7c6-26c0c2c9c3aa";
const C="fc2afc2e-e979-40cc-a8b8-bc8f29af62b3";
const D="3f4f6e8b-5494-4377-b0b4-64eea8e00523";
const rows=[{collection_id:A,name:"alpha"},{collection_id:B,name:"beta"},
 {collection_id:C,name:"gamma"},{collection_id:D,name:"delta"}];
test("ID configuration defaults to alphabetical top-level order",()=>{
 const cfg=normalizeCollectionConfiguration(rows,null);
 assert.equal(cfg.revision,0);
 assert.deepEqual(orderedCollectionTree(rows,cfg.entries).map(x=>x.name),["alpha","beta","delta","gamma"]);
 assert.equal(Object.keys(cfg.entries).length,4);
 assert.ok(Object.values(cfg.entries).every(x=>x.parent_id===null&&x.hidden===false));
});
test("Hierarchy and order persist independently of renamed display labels",()=>{
 const source=normalizeCollectionConfiguration(rows,null);
 const moved=moveCollectionInConfiguration(source.entries,C,A,"inside");
 assert.ok(moved);
 assert.equal(moved[C].parent_id,A);
 assert.equal(collectionDescendsFrom(moved,C,A),true);
 const display=orderedCollectionTree(rows,moved);
 assert.equal(display[0].collection_id,A);
 assert.equal(display[1].collection_id,C);
 assert.equal(display[1].collection_depth,1);
 const renamed=rows.map(r=>r.collection_id===C?{...r,name:"renamed"}:r);
 assert.equal(orderedCollectionTree(renamed,moved)[1].name,"renamed");
 const restored=normalizeCollectionConfiguration(renamed,{revision:7,entries:moved});
 assert.equal(restored.revision,7);
 assert.equal(restored.entries[C].parent_id,A);
});
test("Dropping before/after reorders siblings and rejects collection cycles",()=>{
 const c=normalizeCollectionConfiguration(rows,null);
 const inside=moveCollectionInConfiguration(c.entries,B,A,"inside");
 assert.equal(inside[B].parent_id,A);
 assert.equal(moveCollectionInConfiguration(inside,A,B,"inside"),null);
 assert.equal(moveCollectionInConfiguration(inside,A,A,"inside"),null);
 const after=moveCollectionInConfiguration(inside,D,C,"after");
 assert.equal(after[D].parent_id,null);
 assert.deepEqual(orderedCollectionTree(rows,after).filter(x=>x.collection_depth===0).map(x=>x.collection_id),[A,C,D]);
 const before=moveCollectionInConfiguration(after,C,A,"before");
 assert.equal(orderedCollectionTree(rows,before)[0].collection_id,C);
});
test("Hiding a parent is retained by ID, independent of its nested children",()=>{
 const base=normalizeCollectionConfiguration(rows,null);
 const nested=moveCollectionInConfiguration(base.entries,B,A,"inside");
 nested[A].hidden=true;
 const restored=normalizeCollectionConfiguration(rows,{revision:2,entries:nested});
 assert.equal(restored.entries[A].hidden,true);
 assert.equal(restored.entries[B].hidden,false);
 assert.equal(restored.entries[B].parent_id,A);
});

