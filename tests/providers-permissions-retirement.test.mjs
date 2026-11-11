import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const read=path=>fs.readFile(new URL("../"+path,import.meta.url),"utf8");
test("both provider interfaces describe independent local Permissions rather than retired Google Sheets",async()=>{
 const providers=await read("sites/_apex/app/assets/providers.js");
 const preview=await read("studio/sidebar/index.html");
 for(const html of [providers,preview]){
  assert.doesNotMatch(html,/Google Sheets (?:still controls|rules continue to apply|remains authoritative)/);
  assert.match(html,/persistent local Colosseum Permissions authority/);
 }
 assert.match(providers,/provider-specific local permission ceiling/);
 assert.match(providers,/locally enforced Permissions rules continue to apply/);
});
test("independent HIG Reader Apps Script references are retained",async()=>{
 const preview=await read("studio/sidebar/index.html");
 assert.match(preview,/Google Apps Script · HIG API/);
 assert.match(preview,/Google Apps Script · Live documentation reader/);
});
