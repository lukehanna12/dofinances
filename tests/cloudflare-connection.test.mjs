import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import {cloudflareApiPath,normalizedCloudflarePolicy,sealCloudflareToken,
  openCloudflareToken,verifyCloudflareIdentity,cloudflareRequest,
  DEFAULT_CLOUDFLARE_POLICY} from "../edge/cloudflare-connection.mjs";
import {handleRequest} from "../edge/router.mjs";
globalThis.crypto ||= webcrypto;
const account="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const otherAccount="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const zone="cccccccccccccccccccccccccccccccc";
const token="AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";
const secret="9".repeat(64);
const full={mode:"full",accounts:"*",zones:"*",user:true};
test("scope validation rejects unknown fields, duplicates and invalid IDs",()=>{
  assert.deepEqual(normalizedCloudflarePolicy(DEFAULT_CLOUDFLARE_POLICY),DEFAULT_CLOUDFLARE_POLICY);
  assert.deepEqual(normalizedCloudflarePolicy({...full,accounts:[account],zones:[zone]}),{...full,accounts:[account],zones:[zone]});
  for(const invalid of [{...full,extra:true},{...full,mode:"admin"},
    {...full,accounts:["a"]},{...full,accounts:[account,account]},
    {...full,user:"true"},{...full,accounts:null},{...full,zones:[zone,zone]}])
    assert.throws(()=>normalizedCloudflarePolicy(invalid));
});
test("read-only mode forbids all writes",()=>{
  for(const method of ["POST","PUT","PATCH","DELETE"])
    assert.throws(()=>cloudflareApiPath("/accounts/"+account,method,DEFAULT_CLOUDFLARE_POLICY),/reading only/);
  assert.equal(cloudflareApiPath("/accounts","GET",DEFAULT_CLOUDFLARE_POLICY),
    "https://api.cloudflare.com/client/v4/accounts");
});
test("restricted scopes block all other accounts, zones and listings",()=>{
  const restricted={mode:"full",accounts:[account],zones:[zone],user:false};
  assert.equal(cloudflareApiPath("/accounts/"+account+"/workers/scripts","GET",restricted),
    "https://api.cloudflare.com/client/v4/accounts/"+account+"/workers/scripts");
  assert.equal(cloudflareApiPath("/zones/"+zone+"/dns_records?per_page=5","GET",restricted),
    "https://api.cloudflare.com/client/v4/zones/"+zone+"/dns_records?per_page=5");
  for(const path of ["/accounts","/zones","/accounts/"+otherAccount,
    "/zones/"+otherAccount,"/user","/user/tokens","/memberships"])
    assert.throws(()=>cloudflareApiPath(path,"GET",restricted));
});
test("token transport rejects non-Cloudflare host and path traversal",()=>{
  for(const path of ["//evil.invalid/","/accounts/../user",
    "/accounts/%2e%2e/user","/accounts/%2fuser",
    "/accounts/%5cuser","/accounts//"+account,"https://evil.invalid/","/accounts#frag",
    "/accounts\\evil","/accounts/"+account+"/../"+otherAccount])
    assert.throws(()=>cloudflareApiPath(path,"GET",full));
  assert.throws(()=>cloudflareApiPath("/accounts","OPTIONS",full));
});
test("encrypted credentials cannot be decrypted for another DoFinances owner",async()=>{
  const ciphertext=await sealCloudflareToken(token,secret,"owner-uid");
  assert.ok(ciphertext.startsWith("v1:"));
  assert.ok(!ciphertext.includes(token));
  assert.equal(await openCloudflareToken(ciphertext,secret,"owner-uid"),token);
  await assert.rejects(()=>openCloudflareToken(ciphertext,secret,"other-user"));
  await assert.rejects(()=>openCloudflareToken(ciphertext,"0".repeat(64),"owner-uid"));
});
test("Cloudflare identity verification requires an active token and verified owner",async()=>{
  const calls=[];
  const fake=async(url,{headers})=>{
    calls.push([url,headers.Authorization]);
    const path=new URL(url).pathname;
    const value=path.endsWith("/verify")?{success:true,result:{id:"verified-id",status:"active"}}:
      {success:true,result:{id:"unique-owner-id",email:"OWNER@example.test"}};
    return {ok:true,status:200,text:async()=>JSON.stringify(value)};
  };
  const result=await verifyCloudflareIdentity(token,"owner@example.test",fake);
  assert.equal(result.cloudflareUserId,"unique-owner-id");
  assert.equal(calls.length,2);
  assert.ok(calls.every(([,auth])=>auth==="Bearer "+token));
  await assert.rejects(()=>verifyCloudflareIdentity(token,"not-owner@example.test",fake),/verified Cloudflare owner/);
});
test("Cloudflare API forwarding obeys read-only permissions",async()=>{
  const calls=[];
  const fake=async(url,options)=>{
    calls.push([url,options]);
    return {ok:true,status:200,text:async()=>JSON.stringify({success:true,result:[1,2]})};
  };
  const result=await cloudflareRequest(token,{method:"GET",path:"/zones/"+zone},DEFAULT_CLOUDFLARE_POLICY,fake);
  assert.equal(result.body.success,true);
  assert.equal(calls[0][1].headers.Authorization,"Bearer "+token);
  await assert.rejects(()=>cloudflareRequest(token,{method:"DELETE",path:"/zones/"+zone},DEFAULT_CLOUDFLARE_POLICY,fake));
  assert.equal(calls.length,1);
});
test("DoFinances Cloudflare routes require a session and owner Access JWT",async()=>{
  const stub={session:async()=>({id:"owner-uid",email:"owner@example.test"}),
    cloudflareConnectionState:async()=>({status:200,connected:false,policy:DEFAULT_CLOUDFLARE_POLICY})};
  const env={AUTH_STORE:{idFromName:()=>1,get:()=>stub},
    COLOSSEUM_ACCESS_ISSUER:"https://test-cloudflare.cloudflareaccess.com",
    COLOSSEUM_ACCESS_AUD:"old-project-audience",
    CLOUDFLARE_CONNECTION_ACCESS_AUD:"new-cloudflare-audience",
    COLOSSEUM_OWNER_ACCESS_EMAIL:"owner@example.test"};
  const cookie="__Host-dofinances_session="+"a".repeat(43);
  const absent=await handleRequest(new Request("https://dofinances.com/api/cloudflare/connection"),env);
  assert.equal(absent.status,401);
  const unauthorized=await handleRequest(new Request("https://dofinances.com/api/cloudflare/connection",{headers:{Cookie:cookie}}),env);
  assert.equal(unauthorized.status,403);
  assert.equal((await unauthorized.json()).error,"Cloudflare owner verification required.");
  const wrongMethod=await handleRequest(new Request("https://dofinances.com/api/cloudflare/scope",{method:"GET",headers:{Cookie:cookie}}),env);
  assert.equal(wrongMethod.status,405);
});
test("main Settings exposes the independent Cloudflare integration",async()=>{
  const html=await readFile(new URL("../sites/_apex/app/index.html",import.meta.url),"utf8");
  const js=await readFile(new URL("../sites/_apex/app/assets/cloudflare-settings.js",import.meta.url),"utf8");
  const worker=await readFile(new URL("../edge/router.mjs",import.meta.url),"utf8");
  const database=await readFile(new URL("../edge/auth-store-secure.mjs",import.meta.url),"utf8");
  const config=await readFile(new URL("../edge/wrangler.jsonc",import.meta.url),"utf8");
  assert.ok(html.includes('id="cloudflare-account-connection"'));
  assert.ok(html.includes('id="cf-scope-form"')&&html.includes('id="cf-disconnect"'));
  assert.ok(js.includes("/api/cloudflare/"));
  assert.ok(!js.includes("COLOSSEUM_"));
  assert.ok(worker.includes("verifyColosseumOwnerJwt")&&worker.includes("cloudflareAccountApi"));
  assert.ok(database.includes("cloudflare_account_connection")&&database.includes("cloudflareConnectionRemove"));
  assert.ok(config.includes("CLOUDFLARE_CONNECTION_ACCESS_AUD"));
  assert.ok(!html.includes("token_ciphertext"));
});

test("signed owner can connect, scope, execute and disconnect without exposing credentials",async()=>{
  const keys=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
  const jwk=await crypto.subtle.exportKey("jwk",keys.publicKey);
  const issuer="https://cloudflare-account-unit.cloudflareaccess.com",aud="cf-account-audience";
  const t=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
  const raw=enc({alg:"RS256",kid:"cf-owner-key"})+"."+enc({iss:issuer,aud,sub:"owner-sub",
    email:"owner@example.test",iat:t,exp:t+3600});
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(raw));
  const jwt=raw+"."+Buffer.from(sig).toString("base64url");
  const prior=globalThis.fetch, upstream=[];
  globalThis.fetch=async(url,options={})=>{
    upstream.push({url,authorization:options.headers?.Authorization});
    const pathname=new URL(url).pathname;
    const body=pathname.endsWith("/cdn-cgi/access/certs")?{keys:[{...jwk,kid:"cf-owner-key"}]}:
      pathname.endsWith("/user/tokens/verify")?{success:true,result:{id:"token-id",status:"active"}}:
      pathname.endsWith("/user")?{success:true,result:{id:"cf-owner-id",email:"owner@example.test"}}:
      {success:true,result:{ok:true}};
    return new Response(JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json"}});
  };
  let record;
  function exposed(includeCredential=false){
    if(!record)return {status:200,connected:false,policy:DEFAULT_CLOUDFLARE_POLICY};
    const {ciphertext,...rest}=record;
    return {...rest,status:200,connected:!!ciphertext,...(includeCredential?{ciphertext}:{})};
  }
  const stub={
    session:async()=>({id:"owner-uid",email:"owner@example.test"}),
    cloudflareConnectionState:async({includeCredential})=>exposed(includeCredential),
    cloudflareConnectionSave:async data=>{record={...data};return exposed();},
    cloudflareConnectionSetPolicy:async({policy})=>{record.policy=policy;return exposed();},
    cloudflareConnectionRemove:async()=>{record.ciphertext=null;return exposed();}
  };
  const env={AUTH_STORE:{idFromName:()=>1,get:()=>stub},
    COLOSSEUM_ACCESS_ISSUER:issuer,CLOUDFLARE_CONNECTION_ACCESS_AUD:aud,
    COLOSSEUM_OWNER_ACCESS_EMAIL:"owner@example.test",MFA_ENCRYPTION_KEY:secret};
  const headers={Cookie:"__Host-dofinances_session="+"x".repeat(43),
    "Cf-Access-Jwt-Assertion":jwt,Origin:"https://dofinances.com"};
  async function call(method,route,body){
    const req=new Request("https://dofinances.com/api/cloudflare/"+route,{
      method,headers:{...headers,...(body===undefined?{}:{"Content-Type":"application/json"})},
      body:body===undefined?undefined:JSON.stringify(body)});
    const res=await handleRequest(req,env);
    return {status:res.status,result:await res.json()};
  }
  try{
    const initially=await call("GET","connection");
    assert.equal(initially.status,200);assert.equal(initially.result.connected,false);
    assert.equal(initially.result.authenticated,true);
    assert.equal(initially.result.verifiedEmail,"owner@example.test");
    const connected=await call("POST","connection",{token,policy:DEFAULT_CLOUDFLARE_POLICY});
    assert.equal(connected.status,200);assert.equal(connected.result.connected,true);
    assert.equal(connected.result.authenticated,true);
    assert.ok(record.ciphertext.startsWith("v1:"));
    assert.ok(!JSON.stringify(connected).includes(token));
    assert.equal((await call("POST","request",{method:"POST",path:"/accounts/"+account})).status,400);
    assert.equal((await call("POST","request",{method:"GET",path:"/accounts"})).status,200);
    const scoped=await call("PUT","scope",full);
    assert.equal(scoped.status,200);assert.equal(scoped.result.policy.mode,"full");
    assert.equal((await call("POST","request",{method:"POST",path:"/accounts/"+account,body:{name:"test"}})).status,200);
    const removed=await call("DELETE","connection");
    assert.equal(removed.status,200);assert.equal(removed.result.connected,false);
    assert.equal(removed.result.authenticated,true);
    assert.equal(record.ciphertext,null);
    assert.equal((await call("POST","request",{method:"GET",path:"/accounts"})).status,409);
    assert.ok(upstream.filter(x=>x.authorization).every(x=>x.url.startsWith("https://api.cloudflare.com/client/v4/")));
  }finally{globalThis.fetch=prior;}
});


test("Cloudflare account status calls the real Durable Object lookup after an owner signs in",async()=>{
  // The production regression was an executable declaration swallowed by a // comment.
  // Test the actual method body, not a mock implementation of cloudflareConnectionState.
  const source=await readFile(new URL("../edge/auth-store-secure.mjs",import.meta.url),"utf8");
  const match=source.match(/  cloudflareConnectionState\(\{userId,includeCredential=false\}\)\{([\s\S]*?)\n  \}\n  cloudflareConnectionSave\(/);
  assert.ok(match,"Cloudflare connection status method must exist in the deployed Durable Object");
  assert.match(match[1],/^\s*const record=this\.sql\.exec\("SELECT \* FROM cloudflare_account_connection WHERE singleton='owner'"\)/m);
  assert.doesNotMatch(match[1],/^\s*\/\/[^\n]*const record=/m);
  const actualStatusMethod=new Function("return function({userId,includeCredential=false}){"+match[1]+"\n}")();
  const reads=[];
  const emptyStore={sql:{exec(query){reads.push(query);return {toArray:()=>[]}}}};
  assert.deepEqual(actualStatusMethod.call(emptyStore,{userId:"verified-do-user"}),{
    status:200,connected:false,policy:{mode:"read",accounts:"*",zones:"*",user:false}
  });
  assert.equal(reads.length,1);
  const liveRecord={user_id:"verified-do-user",cloudflare_user_id:"verified-cf-user",
    email:"verified@example.test",token_ciphertext:"v1:encrypted-placeholder",
    token_id:"token-id",expires_on:null,policy_json:JSON.stringify({mode:"full",accounts:"*",zones:"*",user:true}),
    connected_at:1234,updated_at:1235,disconnected_at:0};
  const linkedStore={sql:{exec(){return {toArray:()=>[liveRecord]}}}};
  const owner=actualStatusMethod.call(linkedStore,{userId:"verified-do-user"});
  assert.equal(owner.connected,true);
  assert.equal(owner.policy.mode,"full");
  assert.ok(!Object.hasOwn(owner,"ciphertext"),"credentials must never be included in normal status");
  assert.equal(actualStatusMethod.call(linkedStore,{userId:"another-user"}).status,403);
  assert.equal(actualStatusMethod.call(linkedStore,{userId:"verified-do-user",includeCredential:true}).ciphertext,
    "v1:encrypted-placeholder");
});

test("Cloudflare onboarding separates Access verification from an actual API grant",async()=>{
  const html=await readFile(new URL("../sites/_apex/app/index.html",import.meta.url),"utf8");
  const js=await readFile(new URL("../sites/_apex/app/assets/cloudflare-settings.js",import.meta.url),"utf8");
  const router=await readFile(new URL("../edge/router.mjs",import.meta.url),"utf8");
  assert.match(html,/Verify Cloudflare identity/);
  assert.match(html,/Authorize API access/);
  assert.match(html,/Create a user API token in Cloudflare/);
  assert.match(html,/id="cf-connect-button" disabled/);
  assert.match(js,/Identity verified · token required/);
  assert.match(js,/state\.authenticated!==true/);
  assert.match(js,/API access is not connected yet/);
  assert.match(router,/authenticated:true,verifiedEmail:ownerEmail/);
});
