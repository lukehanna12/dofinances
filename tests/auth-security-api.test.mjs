import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest} from "../edge/router.mjs";
const ORIGIN="https://dofinances.com";
const dummy="X".repeat(43);
const mock={
  AUTH_STORE:{idFromName:()=>({}),get:()=>({
    session:async()=>null,
    mfaStatus:async()=>({status:401,error:"Not authenticated."}),
    verifyEmail:async token=>token===dummy?{status:200,verified:true}:{status:400,error:"Invalid token."},
    resetPassword:async args=>args.token===dummy?{status:200,reset:true}:{status:400,error:"Invalid token."},
    finishMfa:async()=>({status:401,error:"Invalid challenge."}),
    federatedAccounts:async()=>({status:401,error:"Not authenticated."}),
    unlinkFederation:async()=>({status:401,error:"Not authenticated."}),
    signup:async()=>({status:202,pending:true,delivery:{kind:"verify",to:"test@example.com",token:dummy}}),
  })},
};
const post=(path,body={},env=mock,origin=ORIGIN)=>handleRequest(new Request(ORIGIN+path,{
  method:"POST",headers:{"Origin":origin,"Content-Type":"application/json"},body:JSON.stringify(body)
}),env);
test("configuration reports email service readiness and private MFA setup",async()=>{
  const r=await handleRequest(new Request(ORIGIN+"/api/auth/config"),{...mock,MFA_ENCRYPTION_KEY:"a".repeat(64)});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{emailAvailable:false,mfaAvailable:true,federation:{google:{enabled:false,max:5},github:{enabled:false,max:3},chatgpt:{enabled:false,max:1}}});
  assert.equal((await handleRequest(new Request(ORIGIN+"/api/auth/mfa/status"),mock)).status,401);
});
test("password recovery and sign-up refuse absent email service",async()=>{
  assert.equal((await post("/api/auth/signup",{email:"test@example.com",password:"strong-test-password"})).status,503);
  assert.equal((await post("/api/auth/password/forgot",{email:"test@example.com"})).status,503);
  assert.equal((await post("/api/auth/verification/request",{email:"test@example.com"})).status,503);
});
test("one-time verification and reset endpoints are POST-only and CSRF protected",async()=>{
  assert.equal((await post("/api/auth/verification/confirm",{token:dummy})).status,200);
  assert.equal((await post("/api/auth/password/reset",{token:dummy,password:"strong-test-password"})).status,200);
  assert.equal((await post("/api/auth/mfa/finish",{challenge:dummy,code:"123456"})).status,401);
  assert.equal((await post("/api/auth/verification/confirm",{token:dummy},mock,"https://evil.example")).status,403);
  assert.equal((await handleRequest(new Request(ORIGIN+"/api/auth/verification/confirm"),mock)).status,405);
});

test("federated sign-in fails closed when provider credentials are not configured",async()=>{
  const response=await handleRequest(new Request(ORIGIN+"/api/auth/oauth/start?provider=google&intent=signin"),mock);
  assert.equal(response.status,303);
  assert.equal(response.headers.get("Location"),"/login?federation_error=unavailable");
  assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.ok(!response.headers.has("Set-Cookie"));
});
test("federated account inspection and unlink are session-bound and origin protected",async()=>{
  assert.equal((await handleRequest(new Request(ORIGIN+"/api/auth/federation/accounts"),mock)).status,401);
  assert.equal((await post("/api/auth/federation/unlink",{id:"00000000-0000-0000-0000-000000000000"},mock,"https://evil.example")).status,403);
  assert.equal((await post("/api/auth/federation/unlink",{id:"00000000-0000-0000-0000-000000000000"})).status,401);
});
