import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("CI smoke checks read the whole stream and retry reset connections",()=>{
 const content=readFileSync(new URL("../.github/workflows/site.yml",import.meta.url),"utf8");
 assert.doesNotMatch(content,/curl[^\n]*\| grep -Fq/);
 assert.match(content,/curl --retry 4 --retry-all-errors --retry-delay 2 -fsSL --max-time 20 https:\/\/dofinances\.com\/ \| grep -F 'DoFinances' >\/dev\/null/);
 assert.match(content,/curl --retry 4 --retry-all-errors --retry-delay 2 -fsSL --max-time 20 https:\/\/www\.dofinances\.com\/ \| grep -F 'DoFinances' >\/dev\/null/);
 assert.match(content,/command = \["curl", "--retry", "5", "--retry-all-errors"/);
 assert.doesNotMatch(content,/echo "\$configuration" \| grep -Fq/);
});
