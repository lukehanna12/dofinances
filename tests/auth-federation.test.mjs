import test from "node:test";
import assert from "node:assert/strict";
import {federationProvider,federationAvailability,FEDERATION_LIMITS,newOAuthTransaction,
  pkceChallenge,oauthAuthorizeUrl,oauthCookie,readOAuthCookie,expiredOAuthCookie,
  exchangeFederatedIdentity} from "../edge/auth-federation.mjs";

const credentials={
  GOOGLE_OAUTH_CLIENT_ID:"google-test-client",GOOGLE_OAUTH_CLIENT_SECRET:"private-google-secret",
  GITHUB_OAUTH_CLIENT_ID:"github-test-client",GITHUB_OAUTH_CLIENT_SECRET:"private-github-secret"
};
const encoder=new TextEncoder();
const b64u=data=>btoa(String.fromCharCode(...data)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");

test("federation is opt-in and respects the requested provider limits",()=>{
  assert.deepEqual(FEDERATION_LIMITS,{google:5,github:3,chatgpt:1});
  const empty=federationAvailability({});
  assert.ok(Object.values(empty).every(p=>p.enabled===false));
  assert.equal(federationAvailability(credentials).google.enabled,true);
  assert.equal(federationAvailability(credentials).github.enabled,true);
  assert.equal(federationAvailability(credentials).chatgpt.enabled,false);
  assert.equal(federationProvider({OPENAI_OAUTH_CLIENT_ID:"oaiapp_test"},"chatgpt"),null);
  assert.equal(federationProvider({OPENAI_OAUTH_CLIENT_ID:"oaiapp_test",OPENAI_OAUTH_TOKEN_AUTH_METHOD:"none"},"chatgpt").method,"none");
  assert.equal(federationProvider(credentials,"apple"),null);
});
test("OAuth authorization uses exact callbacks, PKCE, state and no secrets in URL",async()=>{
  const transaction=newOAuthTransaction();
  assert.match(transaction.state,/^[A-Za-z0-9_-]{43}$/);
  assert.equal((await pkceChallenge(transaction.verifier)).length,43);
  assert.equal(readOAuthCookie(oauthCookie(transaction.state)),transaction.state);
  assert.match(expiredOAuthCookie(),/Max-Age=0/);
  for(const provider of ["google","github"]){
    const url=new URL(await oauthAuthorizeUrl(federationProvider(credentials,provider),transaction));
    assert.equal(url.searchParams.get("redirect_uri"),"https://dofinances.com/api/auth/oauth/callback/"+provider);
    assert.equal(url.searchParams.get("state"),transaction.state);
    assert.equal(url.searchParams.get("code_challenge_method"),"S256");
    assert.equal(url.searchParams.get("code_challenge"),await pkceChallenge(transaction.verifier));
    assert.ok(!url.href.includes("private-"));
    assert.ok(!url.searchParams.get("scope").includes("repo"));
  }
});
test("Google OIDC verifies RSA signature, nonce, issuer, audience and email_verified",async()=>{
  const keys=await crypto.subtle.generateKey({
    name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"
  },true,["sign","verify"]);
  const publicJwk=await crypto.subtle.exportKey("jwk",keys.publicKey);
  const config=federationProvider(credentials,"google"),txn=newOAuthTransaction();
  const now=Math.floor(Date.now()/1000);
  async function sign(patch={}){
    const header=b64u(encoder.encode(JSON.stringify({alg:"RS256",typ:"JWT",kid:"key1"})));
    const payload=b64u(encoder.encode(JSON.stringify({
      iss:"https://accounts.google.com",aud:config.clientId,sub:"user-google-0001",
      email:"Owner@Example.com",email_verified:true,nonce:txn.nonce,
      iat:now,exp:now+600,...patch
    })));
    const signed=header+"."+payload;
    const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,encoder.encode(signed));
    return signed+"."+b64u(new Uint8Array(sig));
  }
  const originalFetch=globalThis.fetch;
  let idToken=await sign();
  try{
    globalThis.fetch=async url=>{
      if(String(url).includes("oauth2.googleapis.com/token"))
        return Response.json({id_token:idToken});
      if(String(url).includes("googleapis.com/oauth2/v3/certs"))
        return Response.json({keys:[{...publicJwk,kid:"key1",use:"sig",alg:"RS256"}]});
      throw Error("Unexpected endpoint");
    };
    const identity=await exchangeFederatedIdentity(config,"an-authorization-code",txn);
    assert.equal(identity.subject,"user-google-0001");
    assert.equal(identity.email,"owner@example.com");
    assert.equal(identity.verified,true);
    for(const patch of [
      {nonce:"wrong-nonce"},{aud:"other-client"},{iss:"https://attacker.test"},
      {exp:now-300}
    ]){
      idToken=await sign(patch);
      await assert.rejects(exchangeFederatedIdentity(config,"code",txn));
    }
    const intact=await sign();
    const pieces=intact.split(".");
    pieces[2]=(pieces[2][0]==="A"?"B":"A")+pieces[2].slice(1);
    idToken=pieces.join(".");
    await assert.rejects(exchangeFederatedIdentity(config,"code",txn));
  }finally{globalThis.fetch=originalFetch;}
});
test("GitHub identity uses immutable numeric ID and only verified email addresses",async()=>{
  const config=federationProvider(credentials,"github");
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async url=>{
      if(String(url).includes("/login/oauth/access_token"))return Response.json({access_token:"only-for-identity"});
      if(String(url).endsWith("/user"))return Response.json({id:12345678,login:"test-login",email:"not-trusted@example.com"});
      if(String(url).endsWith("/user/emails"))return Response.json([
        {email:"fake@example.com",verified:false,primary:true},
        {email:"verified@example.com",verified:true,primary:false}
      ]);
      throw Error("Unexpected endpoint");
    };
    const identity=await exchangeFederatedIdentity(config,"code",newOAuthTransaction());
    assert.equal(identity.subject,"12345678");
    assert.equal(identity.email,"verified@example.com");
    assert.equal(identity.verified,true);
  }finally{globalThis.fetch=originalFetch;}
});
