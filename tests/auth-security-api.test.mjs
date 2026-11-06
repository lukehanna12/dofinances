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
    signup:async()=>({status:202,pending:true,delivery:{kind:"verify",to:"test@example.com",token:dummy}}),
  })},
};
const post=(path,body={},env=mock,origin=ORIGIN)=>handleRequest(new Request(ORIGIN+path,{
  method:"POST",headers:{"Origin":origin,"Content-Type":"application/json"},body:JSON.stringify(body)
}),env);
test("configuration reports email service readiness and private MFA setup",async()=>{
  const r=await handleRequest(new Request(ORIGIN+"/api/auth/config"),{...mock,MFA_ENCRYPTION_KEY:"a".repeat(64)});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{emailAvailable:false,mfaAvailable:true});
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
