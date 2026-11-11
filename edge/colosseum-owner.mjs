import {constantTimeEqual, normalizedEmail} from "./auth-core.mjs";

// The public Access audience and issuer are pinned in Wrangler configuration;
// the sole allowed owner email remains a Worker secret. A header alone is
// never trusted: verify Access's RS256 signature, issuer, audience and expiry.
const keysByIssuer=new Map();
const encoder=new TextEncoder();
function bytes(base64url) {
  if(typeof base64url!=="string"||!/^[A-Za-z0-9_-]+$/.test(base64url))throw Error("Invalid JWT encoding");
  const base64=base64url.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(base64+"=".repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
}
function parse(encoded) {return JSON.parse(new TextDecoder().decode(bytes(encoded)));}
// Colosseum retains the original 24-hour limit. The independent Cloudflare account
// route explicitly opts in to a maximum 30-day JWT lifetime.
export async function verifyColosseumOwnerJwt(raw,env,fetchJwks=fetch,maxSessionSeconds=86400) {
  if(!Number.isInteger(maxSessionSeconds)||maxSessionSeconds<1||maxSessionSeconds>2592000)
    throw Error("Invalid Access session lifetime limit");
  const issuer=String(env.COLOSSEUM_ACCESS_ISSUER||"").replace(/\/$/,"");
  const audience=String(env.COLOSSEUM_ACCESS_AUD||"");
  const ownerEmail=normalizedEmail(env.COLOSSEUM_OWNER_ACCESS_EMAIL);
  if(!issuer||!audience||!ownerEmail)throw Error("Colosseum owner authentication is not configured");
  const trusted=new URL(issuer);
  if(trusted.protocol!=="https:"||!trusted.hostname.endsWith(".cloudflareaccess.com")||trusted.pathname!=="/")
    throw Error("Invalid Cloudflare Access issuer configuration");
  if(typeof raw!=="string"||raw.length>8192||raw.length<100)return null;
  try {
    const parts=raw.split(".");
    if(parts.length!==3)return null;
    const header=parse(parts[0]),payload=parse(parts[1]);
    if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>256)return null;
    if(payload.iss!==issuer||
       !(payload.aud===audience||(Array.isArray(payload.aud)&&payload.aud.includes(audience))))return null;
    const t=Math.floor(Date.now()/1000);
    if(!Number.isInteger(payload.exp)||payload.exp<=t||
       !Number.isInteger(payload.iat)||payload.iat>t+60||payload.exp-payload.iat>maxSessionSeconds ||
       (payload.nbf!==undefined&&(!Number.isInteger(payload.nbf)||payload.nbf>t+60)))return null;
    if(typeof payload.sub!=="string"||payload.sub.length<1||payload.sub.length>256)return null;
    if(!constantTimeEqual(normalizedEmail(payload.email)||"",ownerEmail))return null;
    let cached=keysByIssuer.get(issuer);
    const refresh=async()=>{
      const response=await fetchJwks(issuer+"/cdn-cgi/access/certs",{cache:"no-store"});
      if(!response.ok)throw Error("Cloudflare Access signing keys unavailable");
      const json=await response.json();
      if(!Array.isArray(json.keys)||json.keys.length>20)throw Error("Invalid Access signing keys");
      cached={keys:json.keys,until:Date.now()+300000};
      keysByIssuer.set(issuer,cached);
    };
    if(!cached||cached.until<=Date.now()||!cached.keys.some(k=>k.kid===header.kid))await refresh();
    const jwk=cached.keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&k.n&&k.e);
    if(!jwk)return null;
    const key=await crypto.subtle.importKey("jwk",{kty:"RSA",n:jwk.n,e:jwk.e},
      {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const verified=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,bytes(parts[2]),
      encoder.encode(parts[0]+"."+parts[1]));
    return verified?{subject:payload.sub}:null;
  } catch {return null;}
}
