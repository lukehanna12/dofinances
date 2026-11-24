import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const src=await fs.readFile(new URL("../sites/_apex/app/assets/providers.js",import.meta.url),"utf8");
test("RealFaviconGenerator uses direct interactive credentials rather than MCP or OAuth controls",()=>{
 assert.match(src,/d\.uid==="0001d3"&&d\.route_mode==="direct"/);
 const section=src.slice(src.indexOf(" function renderRealFavicon"),src.indexOf(" function remoteDetail"));
 assert.match(section,/password:true/);
 assert.match(section,/keyField\.control\.value=""/);
 assert.match(section,/action:"key",uid:d\.uid,api_key:key/);
 assert.match(section,/action:"launch",uid:d\.uid/);
 assert.match(section,/u\.origin!=="https:\/\/realfavicongenerator\.net"/);
 assert.match(section,/u\.search\|\|u\.hash/);
 assert.match(section,/window\.location\.assign\(u\.href\)/);
 assert.doesNotMatch(section,/oauth_start|grant-tool|localStorage|sessionStorage/);
});
