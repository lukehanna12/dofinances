import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {verifyColosseumOwnerJwt} from "../edge/colosseum-owner.mjs";
globalThis.crypto ||= webcrypto;

const issuer="https://test.cloudflareaccess.com",email="owner@example.test";
const sharedAudience="owner-access-720h",retiredAudience="retired-access-8h";
const day=86400,days30=30*day;
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");

test("single shared owner Access audience accepts 30 days for both APIs but refuses expired and retired app JWTs",async()=>{
  const {publicKey,privateKey}=await crypto.subtle.generateKey({
    name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),
    hash:"SHA-256"},true,["sign","verify"]);
  const jwk=await crypto.subtle.exportKey("jwk",publicKey);
  const jwks=async()=>({ok:true,json:async()=>({keys:[{...jwk,kid:"owner-shared-app-key"}]})});
  const now=Math.floor(Date.now()/1000);
  const makeJwt=async(audience,lifetime,options={})=>{
    const head=encode({alg:"RS256",kid:"owner-shared-app-key"});
    const payload=encode({iss:issuer,aud:audience,sub:"verified-owner",email,
      iat:now,exp:now+lifetime,...options});
    const unsigned=head+"."+payload;
    const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,new TextEncoder().encode(unsigned));
    return unsigned+"."+Buffer.from(sig).toString("base64url");
  };
  const env={COLOSSEUM_ACCESS_ISSUER:issuer,CLOUDFLARE_CONNECTION_ACCESS_AUD:sharedAudience,
    COLOSSEUM_OWNER_ACCESS_EMAIL:email};
  const thirty=await makeJwt(sharedAudience,days30);
  assert.deepEqual(await verifyColosseumOwnerJwt(thirty,env,jwks),{subject:"verified-owner"});
  assert.deepEqual(await verifyColosseumOwnerJwt(thirty,env,jwks,days30),{subject:"verified-owner"});
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(sharedAudience,days30+1),env,jwks),null);
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(sharedAudience,days30,{email:"not-owner@example.test"}),env,jwks),null);
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(retiredAudience,day/3),env,jwks),null,
    "Old 8-hour app assertions must not authorize any current operation");
  assert.equal(await verifyColosseumOwnerJwt(thirty.slice(0,-4)+"ABCD",env,jwks),null);
  await assert.rejects(()=>verifyColosseumOwnerJwt(thirty,env,jwks,days30+1),
    /Invalid Access session lifetime limit/);
});

test("both protected API families use the same Access JWT audience, with distinct application-level owner bindings",()=>{
  const router=readFileSync(new URL("../edge/router.mjs",import.meta.url),"utf8");
  const config=readFileSync(new URL("../edge/wrangler.jsonc",import.meta.url),"utf8");
  const verifier=readFileSync(new URL("../edge/colosseum-owner.mjs",import.meta.url),"utf8");
  assert.equal((router.match(/verifyColosseumOwnerJwt\(/g)||[]).length,2);
  assert.match(router,/identity=await verifyColosseumOwnerJwt\(request\.headers\.get\("Cf-Access-Jwt-Assertion"\),env,fetch,30\*24\*60\*60\)/);
  assert.match(router,/owner=await verifyColosseumOwnerJwt\(request\.headers\.get\("Cf-Access-Jwt-Assertion"\),accessEnv,fetch,30\*24\*60\*60\)/);
  assert.match(router,/const argument=\{userId:user\.id,accessSubject:identity\.subject\}/);
  assert.match(router,/const accessEnv=\{\.\.\.env,COLOSSEUM_OWNER_ACCESS_EMAIL:ownerEmail\}/);
  assert.ok(config.includes("CLOUDFLARE_CONNECTION_ACCESS_AUD"));
  assert.ok(!config.includes('"COLOSSEUM_ACCESS_AUD"'));
  assert.ok(verifier.includes("env.CLOUDFLARE_CONNECTION_ACCESS_AUD"));
  assert.ok(!verifier.includes("env.COLOSSEUM_ACCESS_AUD"));
});

test("global navigation search uses the uploaded SVG geometry and existing currentColor",()=>{
 const apex=readFileSync(new URL("../sites/_apex/app/index.html",import.meta.url),"utf8");
 const preview=readFileSync(new URL("../studio/sidebar/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../sites/_apex/app/assets/workspace-enhancements.css",import.meta.url),"utf8");
 const svg=readFileSync(new URL("../sites/_apex/app/assets/magnifying-glass.v2.svg",import.meta.url),"utf8");
 const workflow=readFileSync(new URL("../.github/workflows/site.yml",import.meta.url),"utf8");
 for(const html of [apex,preview]){
   assert.match(html,/<button id="global-search-toggle"[^>]+><span class="global-search-icon" aria-hidden="true"><\/span><\/button>/);
   assert.doesNotMatch(html,/<button id="global-search-toggle"[^>]+><svg/);
 }
 assert.match(css,/\.global-menu-icon\{[^}]*color:rgba\(230,230,235,\.82\)/);
 assert.match(css,/#global-search-toggle \.global-search-icon\{[^}]*width:17px;height:17px/);
 assert.match(css,/#global-search-toggle \.global-search-icon\{[^}]*background:currentColor/);
 assert.match(css,/-webkit-mask:url\("\/app\/assets\/magnifying-glass\.v2\.svg"\)/);
 assert.match(svg,/^<svg xmlns=/);
 assert.match(svg,/viewBox="0 0 24\.475 24\.342"/);
 assert.match(svg,/fill="#e6e6eb"/);
 assert.match(svg,/M0 9\.64365C0 14\.9499/);
 assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|<!DOCTYPE|\.png/i);
 assert.match(workflow,/cp sites\/_apex\/app\/assets\/magnifying-glass\.v2\.svg dist\/app\/assets\/magnifying-glass\.v2\.svg/);
});
