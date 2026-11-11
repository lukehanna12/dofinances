import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyColosseumOwnerJwt} from "../edge/colosseum-owner.mjs";
globalThis.crypto ||= webcrypto;

const issuer="https://test.cloudflareaccess.com",email="owner@example.test";
const cfAud="cloudflare-account-audience",projectAud="colosseum-project-audience";
const seconds=24*60*60,days30=30*seconds;
const encode=data=>Buffer.from(JSON.stringify(data)).toString("base64url");

test("Cloudflare owner Access allows 30 days, never 31; project remains capped at 24 hours",async()=>{
  const {publicKey,privateKey}=await crypto.subtle.generateKey({
    name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),
    hash:"SHA-256"},true,["sign","verify"]);
  const jwk=await crypto.subtle.exportKey("jwk",publicKey);
  const jwks=async()=>({ok:true,json:async()=>({keys:[{...jwk,kid:"30d-verified-test-key"}]})});
  const now=Math.floor(Date.now()/1000);
  async function makeJwt(audience,lifetime,options={}){
    const h=encode({alg:"RS256",kid:"30d-verified-test-key"});
    const payload={iss:issuer,aud:audience,sub:"verified-owner",email,
      iat:now,exp:now+lifetime,...options};
    const s=encode(payload);
    const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,new TextEncoder().encode(h+"."+s));
    return h+"."+s+"."+Buffer.from(signature).toString("base64url");
  }
  const env={COLOSSEUM_ACCESS_ISSUER:issuer,COLOSSEUM_ACCESS_AUD:cfAud,
    COLOSSEUM_OWNER_ACCESS_EMAIL:email};
  const thirty=await makeJwt(cfAud,days30);
  assert.deepEqual(await verifyColosseumOwnerJwt(thirty,env,jwks,days30),{subject:"verified-owner"});
  assert.equal(await verifyColosseumOwnerJwt(thirty,env,jwks),null,
    "Project/default JWT verification must reject tokens longer than 24 hours");
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(cfAud,days30+1),env,jwks,days30),null);
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(cfAud,days30,{email:"attacker@example.test"}),env,jwks,days30),null);
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(projectAud,days30),env,jwks,days30),null);
  await assert.rejects(()=>verifyColosseumOwnerJwt(thirty,env,jwks,days30+1),
    /Invalid Access session lifetime limit/);
  const project={...env,COLOSSEUM_ACCESS_AUD:projectAud};
  assert.deepEqual(await verifyColosseumOwnerJwt(await makeJwt(projectAud,seconds),project,jwks),{subject:"verified-owner"});
  assert.equal(await verifyColosseumOwnerJwt(await makeJwt(projectAud,seconds+1),project,jwks),null);
});
