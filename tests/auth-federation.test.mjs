import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
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
  assert.deepEqual(FEDERATION_LIMITS,{google:5,github:3});
  const empty=federationAvailability({});
  assert.ok(Object.values(empty).every(p=>p.enabled===false));
  assert.equal(federationAvailability(credentials).google.enabled,true);
  assert.equal(federationAvailability(credentials).github.enabled,true);
  assert.equal(Object.hasOwn(federationAvailability(credentials),"chatgpt"),false);
  assert.equal(federationProvider({OPENAI_OAUTH_CLIENT_ID:"unused"},"chatgpt"),null);
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

test("Google invalid_client and invalid_grant fail with public-safe, specific codes",async()=>{
  const config=federationProvider(credentials,"google"),txn=newOAuthTransaction();
  const originalFetch=globalThis.fetch;
  try{
    for(const [upstreamError,publicCode] of [
      ["invalid_client","oauth_client_rejected"],["invalid_grant","oauth_code_rejected"],
      ["invalid_request","oauth_request_rejected"]
    ]){
      globalThis.fetch=async()=>Response.json({error:upstreamError,
        error_description:"Do not disclose this provider response"},{status:400});
      await assert.rejects(
        exchangeFederatedIdentity(config,"one-time-auth-code",txn),
        err=>err.code===publicCode && !err.message.includes("provider response")
      );
    }
  } finally{globalThis.fetch=originalFetch;}
});
test("unknown providers stay disabled without exposing any OAuth configuration",()=>{
  assert.equal(federationProvider(credentials,"chatgpt"),null);
  assert.equal(federationProvider(credentials,"apple"),null);
  assert.deepEqual(Object.keys(federationAvailability(credentials)).sort(),["github","google"]);
});

test("all OAuth fetches use Cloudflare-supported manual redirect handling",async()=>{
  const source=await readFile(new URL("../edge/auth-federation.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/redirect:\s*["']error["']/);
  assert.equal((source.match(/redirect:"manual"/g)||[]).length,4);
  assert.match(source,/if\(!res\.ok\)/);
  // In Workers redirect:'error' throws before the request; a 3xx response
  // must be handled explicitly, not followed to an untrusted destination.
  const config=federationProvider(credentials,"google"),txn=newOAuthTransaction();
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async (_url,options)=>{
      assert.equal(options.redirect,"manual");
      return new Response(null,{status:302,headers:{Location:"https://untrusted.example"}});
    };
    await assert.rejects(
      exchangeFederatedIdentity(config,"fake-code",txn),
      error=>error.code==="oauth_provider_redirected"
    );
  }finally{globalThis.fetch=originalFetch;}
});

test("GitHub code exchange uses documented parameters without grant_type",async()=>{
  const cfg=federationProvider(credentials,"github"),txn=newOAuthTransaction();
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async (url,options)=>{
      if(String(url).includes("github.com/login/oauth/access_token")){
        assert.equal(options.method,"POST");
        assert.equal(options.redirect,"manual");
        assert.match(options.headers["User-Agent"],/DoFinances/);
        assert.equal(options.body.get("client_id"),cfg.clientId);
        assert.equal(options.body.get("client_secret"),cfg.secret);
        assert.equal(options.body.get("code"),"test-code");
        assert.equal(options.body.get("code_verifier"),txn.verifier);
        assert.equal(options.body.get("redirect_uri"),"https://dofinances.com/api/auth/oauth/callback/github");
        assert.equal(options.body.has("grant_type"),false);
        return Response.json({access_token:"ephemeral-identity-token"});
      }
      if(String(url).endsWith("/user"))return Response.json({id:1,login:"x"});
      if(String(url).endsWith("/user/emails"))return Response.json([{email:"x@example.com",verified:true,primary:true}]);
      throw new Error("Unexpected URL");
    };
    const id=await exchangeFederatedIdentity(cfg,"test-code",txn);
    assert.equal(id.provider,"github");
  }finally{globalThis.fetch=originalFetch;}
});

test("GitHub provider errors are mapped to safe, actionable codes even with HTTP 200",async()=>{
  const cfg=federationProvider(credentials,"github"),txn=newOAuthTransaction();
  const originalFetch=globalThis.fetch;
  try{
    for(const [upstream,publicCode] of [
      ["incorrect_client_credentials","oauth_client_rejected"],
      ["redirect_uri_mismatch","oauth_callback_mismatch"],
      ["bad_verification_code","oauth_code_rejected"],
      ["unverified_user_email","oauth_github_email_unverified"],
      ["unsupported_grant_type","oauth_grant_rejected"],
      ["invalid_request","oauth_request_rejected"]
    ]){
      for(const status of [200,400]){
        globalThis.fetch=async()=>Response.json({error:upstream,error_description:"private response: must not leak"},{status});
        await assert.rejects(exchangeFederatedIdentity(cfg,"fake",txn),e=>
          e.code===publicCode && !e.message.includes("private response"));
      }
    }
    globalThis.fetch=async()=>Response.json({error:"unknown_error",error_description:"private"},{status:403});
    await assert.rejects(exchangeFederatedIdentity(cfg,"fake",txn),e=>e.code==="oauth_provider_forbidden");
  }finally{globalThis.fetch=originalFetch;}
});
