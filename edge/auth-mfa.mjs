// RFC 6238 TOTP and envelope encryption for MFA data. No external dependencies.
import {sha256, constantTimeEqual} from "./auth-core.mjs";
const alpha="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret(){
  const bytes=crypto.getRandomValues(new Uint8Array(20));
  let bits=0, buffer=0, text="";
  for(const b of bytes){buffer=(buffer<<8)|b;bits+=8;while(bits>=5){bits-=5;text+=alpha[(buffer>>>bits)&31];}}
  if(bits)text+=alpha[(buffer<<(5-bits))&31];
  return text;
}
function decodeBase32(text){
  if(typeof text!=="string" || !/^[A-Z2-7]{32}$/.test(text))throw Error("Invalid MFA secret");
  let buffer=0,bits=0,out=[];
  for(const ch of text){buffer=(buffer<<5)|alpha.indexOf(ch);bits+=5;if(bits>=8){bits-=8;out.push((buffer>>>bits)&255);}}
  return new Uint8Array(out);
}
function toHex(bytes){return Array.from(bytes,v=>v.toString(16).padStart(2,"0")).join("");}
function fromHex(hex){if(typeof hex!=="string" || !/^(?:[0-9a-f]{2})+$/i.test(hex))throw Error("Invalid key");return Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));}
export async function totpAt(secret,step){
  const n=BigInt(step);
  const counter=new Uint8Array(8);let temp=n;
  for(let i=7;i>=0;i--){counter[i]=Number(temp&255n);temp>>=8n;}
  const key=await crypto.subtle.importKey("raw",decodeBase32(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,counter));
  const offset=digest[digest.length-1]&15;
  const value=(((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3])>>>0;
  return String(value%1000000).padStart(6,"0");
}
export async function matchTotp(secret,code,lastStep=-1,now=Date.now()){
  if(typeof code!=="string"||!/^[0-9]{6}$/.test(code))return null;
  const step=Math.floor(now/30000);
  for(let delta=-1;delta<=1;delta++){
    const candidate=step+delta;
    if(candidate<=lastStep)continue;
    if(constantTimeEqual(await totpAt(secret,candidate),code))return candidate;
  }
  return null;
}
function encryptionKey(hex){
  if(typeof hex!=="string"||!/^[0-9a-f]{64}$/i.test(hex))throw Error("MFA encryption not configured");
  return crypto.subtle.importKey("raw",fromHex(hex),{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function sealTotp(secret,secretKey,userId){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await encryptionKey(secretKey);
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(userId)},key,new TextEncoder().encode(secret));
  return "v1:"+toHex(iv)+":"+toHex(new Uint8Array(ciphertext));
}
export async function openTotp(encrypted,secretKey,userId){
  const parts=typeof encrypted==="string"?encrypted.split(":"):[];
  if(parts.length!==3||parts[0]!=="v1")throw Error("Invalid MFA envelope");
  const key=await encryptionKey(secretKey);
  const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromHex(parts[1]),additionalData:new TextEncoder().encode(userId)},key,fromHex(parts[2]));
  const value=new TextDecoder().decode(plaintext);
  decodeBase32(value);
  return value;
}
export function makeRecoveryCodes(){
  return Array.from({length:10},()=>{
    const bytes=crypto.getRandomValues(new Uint8Array(12));
    const hex=toHex(bytes).toUpperCase();
    return hex.match(/.{4}/g).join("-");
  });
}
export function canonicalRecovery(value){
  if(typeof value!=="string")return null;
  const v=value.replace(/-/g,"").toUpperCase();
  return /^[A-F0-9]{24}$/.test(v)?v:null;
}
export async function recoveryHash(value,userId){
  const canonical=canonicalRecovery(value);
  return canonical?sha256("mfa-recovery:"+userId+":"+canonical):null;
}
export function authenticatorUri(secret,email){
  return "otpauth://totp/"+encodeURIComponent("Dofinances:"+email)+
    "?secret="+secret+"&issuer="+encodeURIComponent("Dofinances")+"&algorithm=SHA1&digits=6&period=30";
}
