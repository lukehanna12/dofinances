import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

// The runtime patch changes the deployed Colosseum Worker, not the browser.
// Evaluate the exact replacement functions under a test-only JS context so
// owner/non-owner visibility cannot become a UI-only implementation.
const spec=JSON.parse(readFileSync(new URL("../scripts/colosseum-membership-visibility.patch.json",import.meta.url),"utf8"));
const patch=id=>{
  const entry=spec.patches.find(x=>x.id===id);
  assert.ok(entry,"Missing live Worker patch: "+id);
  return entry.replacement;
};
const ctx={
  JSON,Object,Set,
  fail(code){throw Error(code)},
  annotationRating(v){if(v!==undefined&&v!==null&&(typeof v!=="number"||v<0||v>5||!Number.isInteger(v*2)))throw Error("invalid_request");return v},
  annotationContext(v){if(v!==undefined&&(typeof v!=="string"||[...v].length>250))throw Error("invalid_request");return v},
  collectionMetadata(row){const value=JSON.parse(row.metadata_json||"{}");return {members:value.members||{}}}
};
runInNewContext(patch("metadata-shape")+patch("summary-members"),ctx);
function row(id,members,annotations){
  return {
    id,name:id,description:"test",revision:3,created_at:"2026",updated_at:"2026",
    members_json:JSON.stringify(members),
    routes_json:JSON.stringify(Object.fromEntries(members.map(uid=>[uid,{route_mode:"direct"}]))),
    metadata_json:JSON.stringify({members:annotations})
  };
}
const A=row("A",["a00001","b00002"],{a00001:{hidden:true,context:"A-only secret"},b00002:{rating:4,context:"Visible A"}});
const B=row("B",["a00001"],{a00001:{rating:2.5,context:"Visible B"}});

test("A hidden member stays visible to owner but is absent from consumer get and count",()=>{
  const client=ctx.summary(A,true,false),owner=ctx.summary(A,true,true);
  assert.deepEqual(Array.from(client.item_uids),["b00002"]);
  assert.equal(client.member_count,1);
  assert.equal(Object.hasOwn(client.routes,"a00001"),false);
  assert.equal(Object.hasOwn(client.item_metadata,"a00001"),false);
  assert.equal(ctx.summary(A,false,false).member_count,1);
  assert.equal(owner.member_count,2);
  assert.deepEqual(Array.from(owner.item_uids),["a00001","b00002"]);
  assert.equal(owner.item_metadata.a00001.hidden,true);
});

test("Context-specific hiding in A does not affect the same catalog UID in B",()=>{
  const Bclient=ctx.summary(B,true,false);
  assert.deepEqual(Array.from(Bclient.item_uids),["a00001"]);
  assert.equal(Bclient.item_metadata.a00001.context,"Visible B");
  assert.equal(Bclient.member_count,1);
  assert.equal(ctx.summary(A,true,false).item_uids.includes("a00001"),false);
});

test("Owner-only boolean update preserves the existing membership's rating and context",()=>{
  const old={rating:3.5,context:"Scoped note",hidden:true};
  const modified=ctx.metadataEdit(old,{hidden:false});
  assert.equal(modified.rating,3.5);
  assert.equal(modified.context,"Scoped note");
  assert.equal(modified.hidden,false);
  assert.equal(ctx.metadataEdit(modified,{hidden:true}).hidden,true);
  assert.equal(ctx.metadataEdit(old,{rating:4}).hidden,true);
  assert.throws(()=>ctx.metadataEdit(old,{hidden:"false"}),/invalid_request/);
  assert.throws(()=>ctx.metadataEdit(old,{hidden:null}),/invalid_request/);
});

test("Resolver drops hidden UIDs, routes and annotations without globally hiding the UID",()=>{
 const resolve=runInNewContext(
   "(function(descendants){"+patch("resolved-direct-members")+"return {item_uids:[...members].sort(),routes,item_annotations};})",
   {...ctx}
 );
 const onlyA=resolve([A]);
 assert.deepEqual(Array.from(onlyA.item_uids),["b00002"]);
 assert.equal(Object.hasOwn(onlyA.routes,"a00001"),false);
 assert.equal(onlyA.item_annotations.some(x=>x.item_uid==="a00001"),false);
 const both=resolve([A,B]);
 assert.deepEqual(Array.from(both.item_uids),["a00001","b00002"]);
 assert.equal(both.item_annotations.some(x=>x.collection_id==="A"&&x.item_uid==="a00001"),false);
 assert.equal(both.item_annotations.some(x=>x.collection_id==="B"&&x.item_uid==="a00001"),true);
});

test("The patch guards every access path and preserves ordinary MCP mutation contracts",()=>{
 const map=Object.fromEntries(spec.patches.map(x=>[x.id,x]));
 assert.ok(map["owner-only-membership-annotation"].replacement.includes('if(!owner&&args.hidden!==void 0)fail("unauthorized")'));
 assert.ok(map["owner-only-membership-annotation"].replacement.includes('if(!owner&&metadata.members[args.item_uid]?.hidden===true)fail("collection_member_not_found")'));
 assert.ok(map["evict-hidden-members-protected"].replacement.includes('!owner&&operation==="evict"'));
 assert.ok(map["owner-bridge-allow-hidden"].replacement.includes('"hidden"'));
 assert.ok(map["owner-bridge-hidden-only"].replacement.includes('parameters.hidden===undefined'));
 assert.ok(map["owner-bridge-validate-hidden"].replacement.includes('annotationVisibility(parameters.hidden)'));
 for(const id of ["summary-get","summary-list","summary-annotate","summary-mutate","summary-edit","summary-edit-noop","summary-create"])
   assert.ok(map[id].replacement.includes("owner)"),"Owner-aware summary not applied to "+id);
});
