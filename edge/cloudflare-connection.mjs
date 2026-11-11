import {constantTimeEqual, normalizedEmail} from "./auth-core.mjs";

const API="https://api.cloudflare.com/client/v4";
const HEX=/^[a-f0-9]{32}$/i;
const utf8=new TextEncoder();
const MAX_RESULT=120000;
const now=()=>Math.floor(Date.now()/1000);
const toHex=b=>Array.from(b,n=>n.toString(16).padStart(2,"0")).join("");
function fromHex(s){
  if(typeof s!=="string"||s.length%2||!/^[a-f0-9]+$/i.test(s))throw Error("Invalid encrypted data");
  return Uint8Array.from(s.match(/../g),pair=>parseInt(pair,16));
}
function keyFromSecret(secret){
  if(typeof secret!=="string"||!/^[a-f0-9]{64}$/i.test(secret))
    throw Error("Cloudflare connection encryption is not configured");
  return crypto.subtle.importKey("raw",fromHex(secret),"AES-GCM",false,["encrypt","decrypt"]);
}
export async function sealCloudflareToken(token,secret,userId){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFromSecret(secret);
  const ciphertext=await crypto.subtle.encrypt(
    {name:"AES-GCM",iv,additionalData:utf8.encode("cloudflare-token-v1:"+userId)},
    key,utf8.encode(token));
  return "v1:"+toHex(iv)+":"+toHex(new Uint8Array(ciphertext));
}
export async function openCloudflareToken(ciphertext,secret,userId){
  const parts=typeof ciphertext==="string"?ciphertext.split(":"):[];
  if(parts.length!==3||parts[0]!=="v1"||parts[1].length!==24)throw Error("Invalid token envelope");
  const key=await keyFromSecret(secret);
  const plaintext=await crypto.subtle.decrypt(
    {name:"AES-GCM",iv:fromHex(parts[1]),additionalData:utf8.encode("cloudflare-token-v1:"+userId)},
    key,fromHex(parts[2]));
  return new TextDecoder().decode(plaintext);
}
export function validCloudflareToken(value){
  return typeof value==="string"&&value.length>=20&&value.length<=512&&/^[A-Za-z0-9._~-]+$/.test(value);
}
export function normalizedCloudflarePolicy(input){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Policy must be an object.");
  if(Object.keys(input).some(key=>!["mode","accounts","zones","user"].includes(key)))
    throw Error("Unrecognized policy field.");
  if(!["read","full"].includes(input.mode)||typeof input.user!=="boolean")
    throw Error("Choose read or full permission and set user access.");
  function resources(value,kind){
    if(value==="*")return "*";
    if(!Array.isArray(value)||value.length>50||value.some(id=>typeof id!=="string"||!HEX.test(id)))
      throw Error("Invalid "+kind+" IDs.");
    if(new Set(value.map(s=>s.toLowerCase())).size!==value.length)
      throw Error("Duplicate "+kind+" IDs.");
    return value.map(x=>x.toLowerCase()).sort();
  }
  return {mode:input.mode,accounts:resources(input.accounts,"account"),
    zones:resources(input.zones,"zone"),user:input.user};
}
export const DEFAULT_CLOUDFLARE_POLICY=Object.freeze({
  mode:"read",accounts:"*",zones:"*",user:false
});
export function cloudflareApiPath(raw,method,policy){
  if(typeof raw!=="string"||raw.length<2||raw.length>1200||
    !raw.startsWith("/")||raw.startsWith("//")||raw.includes("\\")||
    /%(?:2f|5c|2e|00)/i.test(raw)||raw.includes("#")||raw.includes("//")||
    raw.split("?")[0].split("/").some(part=>part==="."||part===".."))
    throw Error("Invalid Cloudflare API path.");
  if(!["GET","POST","PUT","PATCH","DELETE"].includes(method))
    throw Error("Unsupported Cloudflare API method.");
  if(method!=="GET"&&policy.mode!=="full")throw Error("The current policy allows reading only.");
  const url=new URL(API+raw);
  if(url.origin!=="https://api.cloudflare.com"||!url.pathname.startsWith("/client/v4/"))
    throw Error("Invalid Cloudflare API destination.");
  const segments=url.pathname.slice("/client/v4/".length).split("/");
  const type=segments[0],id=segments[1]||"";
  if(type==="accounts"||type==="zones"){
    const allow=policy[type],validId=HEX.test(id);
    if(id&&!validId)throw Error("Cloudflare resource ID must be 32 hexadecimal characters.");
    if(allow!=="*" && (!validId||!allow.includes(id.toLowerCase())))
      throw Error("Resource is not allowed by your Cloudflare scope.");
  }else if(type==="user"){
    if(!policy.user)throw Error("User API access is disabled by your Cloudflare scope.");
  }else if(!(policy.user&&policy.accounts==="*"&&policy.zones==="*"&&policy.mode==="full")){
    throw Error("Global Cloudflare endpoints require unrestricted full-access scope.");
  }
  return url.toString();
}
async function getJson(response){
  const body=await response.text();
  if(body.length>MAX_RESULT)throw Error("Cloudflare response exceeds the configured size limit.");
  try{return JSON.parse(body)}catch{throw Error("Cloudflare returned a non-JSON response.");}
}
export async function cloudflareRequest(token,{method,path,body},policy,fetcher=fetch){
  const url=cloudflareApiPath(path,method,policy);
  const payload=body===undefined?undefined:JSON.stringify(body);
  if(payload!==undefined&&(payload.length>100000||method==="GET"))
    throw Error("Invalid API request body.");
  let response;
  try{
    response=await fetcher(url,{method,headers:{"Authorization":"Bearer "+token,
      "Accept":"application/json",...(payload!==undefined?{"Content-Type":"application/json"}:{})},
      body:payload,redirect:"manual",cache:"no-store"});
  }catch{throw Error("Cloudflare API could not be reached.");}
  const data=await getJson(response);
  return {status:response.status,ok:response.ok,body:data};
}
export async function verifyCloudflareIdentity(token,expectedOwnerEmail,fetcher=fetch){
  if(!validCloudflareToken(token))throw Error("Enter a valid Cloudflare user API token.");
  const expected=normalizedEmail(expectedOwnerEmail);
  if(!expected)throw Error("Cloudflare owner identity is not configured.");
  const policy={mode:"read",accounts:"*",zones:"*",user:true};
  const verify=await cloudflareRequest(token,{method:"GET",path:"/user/tokens/verify"},policy,fetcher);
  if(!verify.ok||!verify.body?.success||verify.body.result?.status!=="active")
    throw Error("Cloudflare rejected this API token or it is inactive.");
  const profile=await cloudflareRequest(token,{method:"GET",path:"/user"},policy,fetcher);
  if(!profile.ok||!profile.body?.success||!profile.body.result?.id||
    !constantTimeEqual(normalizedEmail(profile.body.result.email)||"",expected))
    throw Error("Token must include User Details Read for the verified Cloudflare owner.");
  return {tokenId:String(verify.body.result.id||"").slice(0,64),
    cloudflareUserId:String(profile.body.result.id).slice(0,128),
    email:expected,expiresOn:verify.body.result.expires_on||null,verifiedAt:now()};
}
