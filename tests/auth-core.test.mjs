import test from "node:test";
import assert from "node:assert/strict";
import {normalizedEmail,validPassword,randomToken,randomSalt,passwordHash,constantTimeEqual,sessionCookie,expireCookie,parseCookie,sha256} from "../edge/auth-core.mjs";
test("emails and passwords are validated and normalized",()=>{
  assert.equal(normalizedEmail("  Person@Example.COM  "),"person@example.com");
  assert.equal(normalizedEmail("not-an-email"),null);
  assert.equal(validPassword("twelvecharacters"),true);
  assert.equal(validPassword("short"),false);
  assert.equal(validPassword("control\ncharacter"),false);
});
test("opaque sessions use HttpOnly secure cookies",()=>{
  const token=randomToken();
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token,randomToken());
  assert.match(sessionCookie(token),/HttpOnly; Secure; SameSite=Lax/);
  assert.equal(parseCookie("x=1; "+sessionCookie(token)),token);
  assert.equal(parseCookie("x=1"),null);
  assert.match(expireCookie(),/Max-Age=0/);
});
test("PBKDF2 verifies without accepting altered hashes",async()=>{
  const salt=randomSalt();
  const hash=await passwordHash("a-strong-test-password",salt,5000);
  assert.equal(hash.length,64);
  assert.equal(constantTimeEqual(hash,await passwordHash("a-strong-test-password",salt,5000)),true);
  assert.equal(constantTimeEqual(hash,await passwordHash("a-wrong-test-password",salt,5000)),false);
  assert.equal((await sha256("session")).length,64);
});
