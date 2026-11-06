import test from "node:test";
import assert from "node:assert/strict";
import {newTotpSecret,totpAt,matchTotp,sealTotp,openTotp,makeRecoveryCodes,recoveryHash,canonicalRecovery,authenticatorUri} from "../edge/auth-mfa.mjs";
import {mailReady,sendAccountEmail} from "../edge/auth-mail.mjs";
test("RFC 6238 SHA-1 TOTP matches standard example",async()=>{
  const secret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(await totpAt(secret,1),"287082");
  assert.equal(await matchTotp(secret,"287082",-1,59000),1);
  assert.equal(await matchTotp(secret,"287082",1,59000),null);
  assert.equal(await totpAt(secret,37037036),"081804");
});
test("MFA seed is random and encrypted with authenticated user-specific AAD",async()=>{
  const secret=newTotpSecret();
  assert.match(secret,/^[A-Z2-7]{32}$/);
  assert.notEqual(secret,newTotpSecret());
  const key="f0".repeat(32);
  const sealed=await sealTotp(secret,key,"account-1");
  assert.ok(sealed.startsWith("v1:"));
  assert.notEqual(sealed,await sealTotp(secret,key,"account-1"));
  assert.equal(await openTotp(sealed,key,"account-1"),secret);
  await assert.rejects(openTotp(sealed,key,"account-2"));
  assert.match(authenticatorUri(secret,"test@example.com"),/otpauth:\/\/totp\//);
});
test("backup codes are random, unique and hashes are scoped to account",async()=>{
  const codes=makeRecoveryCodes();
  assert.equal(codes.length,10);
  assert.equal(new Set(codes).size,10);
  for(const code of codes){
    assert.match(code,/^(?:[0-9A-F]{4}-){5}[0-9A-F]{4}$/);
    assert.equal(canonicalRecovery(code),code.replaceAll("-",""));
    assert.notEqual(await recoveryHash(code,"alice"),await recoveryHash(code,"bob"));
  }
  assert.equal(canonicalRecovery("BAD"),null);
});
test("provider missing fails closed and never attempts outbound email",async()=>{
  assert.equal(mailReady({}),false);
  assert.equal(mailReady({SENDGRID_API_KEY:"old-key",AUTH_EMAIL_FROM:"noreply@dofinances.com"}),false);
  assert.equal(mailReady({MAILTRAP_API_TOKEN:"test",AUTH_EMAIL_FROM:"noreply@dofinances.com"}),true);
  await assert.rejects(sendAccountEmail({}, {to:"x@example.com",kind:"verify",token:"a"}),/not configured/);
});
