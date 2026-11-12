import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyColosseumOwnerJwt} from "../edge/colosseum-owner.mjs";

test("only a signed, unexpired Cloudflare Access owner token is accepted",async()=>{
  const keys=await webcrypto.subtle.generateKey({
    name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"
  },true,["sign","verify"]);
  const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
  const kid="owner-key";
  const issuer="https://test-owner.cloudflareaccess.com";
  const env={COLOSSEUM_ACCESS_ISSUER:issuer,CLOUDFLARE_CONNECTION_ACCESS_AUD:"owner-audience",
    COLOSSEUM_OWNER_ACCESS_EMAIL:"owner@example.invalid"};
  const now=Math.floor(Date.now()/1000);
  const encode=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
  const sign=async claims=>{
    const content=encode({alg:"RS256",typ:"JWT",kid})+"."+encode(claims);
    const signature=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      keys.privateKey,new TextEncoder().encode(content));
    return content+"."+Buffer.from(signature).toString("base64url");
  };
  const base={iss:issuer,aud:"owner-audience",sub:"access-owner-user-id",
    email:"owner@example.invalid",iat:now,exp:now+3600};
  let fetchCount=0;
  const fetcher=async()=>{fetchCount++;return {ok:true,json:async()=>({keys:[{...pub,kid}]})};};
  const good=await sign(base);
  assert.deepEqual(await verifyColosseumOwnerJwt(good,env,fetcher),{subject:"access-owner-user-id"});
  assert.equal(fetchCount,1);
  const outsider=await sign({...base,email:"different@example.invalid"});
  assert.equal(await verifyColosseumOwnerJwt(outsider,env,fetcher),null);
  const wrongAudience=await sign({...base,aud:"not-the-owner-application"});
  assert.equal(await verifyColosseumOwnerJwt(wrongAudience,env,fetcher),null);
  assert.equal(await verifyColosseumOwnerJwt(await sign({...base,exp:now-1}),env,fetcher),null);
  assert.equal(await verifyColosseumOwnerJwt(good.slice(0,-4)+"ABCD",env,fetcher),null);
  await assert.rejects(()=>verifyColosseumOwnerJwt(good,{...env,COLOSSEUM_OWNER_ACCESS_EMAIL:""},fetcher));
});
