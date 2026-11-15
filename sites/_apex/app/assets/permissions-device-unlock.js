/* Optional, per-device WebAuthn PRF vault for the local gateway hazard PIN.
 * The local authority STILL validates the 4-digit PIN on every hazardous
 * mutation. This browser feature never bypasses that authority.
 * Encrypted PIN data is stored only in this origin's IndexedDB; neither PIN
 * nor PRF output is persisted or sent to an enrollment server.
 */
const DB_NAME="dofinances-permissions-device-unlock-v1";
const STORE="vault";
const ENTRY="hazard-pin";
const encoder=new TextEncoder(),decoder=new TextDecoder();
const prfInput=encoder.encode("dofinances.com/colosseum/permissions/hazard-pin/v1");
const validPIN=pin=>typeof pin==="string"&&/^[0-9]{4}$/.test(pin);
const random=length=>crypto.getRandomValues(new Uint8Array(length));
const toB64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64=value=>{
 if(typeof value!=="string"||!/^[A-Za-z0-9_-]+$/.test(value))throw Error("Invalid device credential.");
 const raw=atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4));
 return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
};
function browserReady(){
 return typeof window!=="undefined"&&window.isSecureContext&&
  !!window.PublicKeyCredential&&!!navigator.credentials?.create&&!!navigator.credentials?.get&&
  !!window.indexedDB&&!!crypto?.subtle;
}
function database(){
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open(DB_NAME,1);
  open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains(STORE))open.result.createObjectStore(STORE);};
  open.onerror=()=>reject(open.error||Error("Device storage unavailable."));
  open.onblocked=()=>reject(Error("Device storage is in use by another tab."));
  open.onsuccess=()=>resolve(open.result);
 });
}
async function storage(mode,kind,value){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  const req=kind==="get"?store.get(ENTRY):kind==="put"?store.put(value,ENTRY):store.delete(ENTRY);
  let result;
  req.onsuccess=()=>{result=req.result;};
  req.onerror=()=>reject(req.error||Error("Device storage failed."));
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(tx.error||Error("Device storage failed."));
  tx.onerror=()=>reject(tx.error||Error("Device storage failed."));
 });}finally{db.close();}
}
function validate(record){
 return !!record&&record.version===1&&record.host===location.hostname&&
  typeof record.credential==="string"&&typeof record.iv==="string"&&
  typeof record.ciphertext==="string"&&typeof record.prfInput==="string";
}
export function supportsDeviceUnlock(){return browserReady();}
export async function hasDeviceUnlock(){
 if(!browserReady())return false;
 try{return validate(await storage("readonly","get"));}catch{return false;}
}
export async function clearDeviceUnlock(){
 if(!browserReady())return;
 await storage("readwrite","delete");
}
async function deriveKey(credential,record){
 const assertion=await navigator.credentials.get({
  publicKey:{
   challenge:random(32),rpId:location.hostname,timeout:60000,userVerification:"required",
   allowCredentials:[{id:fromB64(record.credential),type:"public-key"}],
   extensions:{prf:{eval:{first:fromB64(record.prfInput)}}}
  }
 });
 if(!assertion||toB64(assertion.rawId)!==record.credential)throw Error("This device did not provide the enrolled credential.");
 const auth=new Uint8Array(assertion.response?.authenticatorData||[]);
 // UV flag must be present even if the platform reports a PRF output.
 if(auth.length<37||(auth[32]&0x04)===0)throw Error("Device verification was not completed.");
 const first=assertion.getClientExtensionResults?.().prf?.results?.first;
 if(!(first instanceof ArrayBuffer)&&!ArrayBuffer.isView(first))throw Error("This browser does not expose device-bound key derivation. Enter the PIN instead.");
 const bytes=new Uint8Array(first);
 if(bytes.length!==32)throw Error("Device-bound key derivation was invalid.");
 return bytes;
}
async function cipherKey(keyBytes){
 return crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function enrollDeviceUnlock(pin){
 if(!validPIN(pin))throw Error("Enter your current four-digit hazard PIN.");
 if(!browserReady())throw Error("Device unlock requires a supported secure browser.");
 const record={
  version:1,host:location.hostname,prfInput:toB64(prfInput),credential:"",
  iv:"",ciphertext:""
 };
 const credential=await navigator.credentials.create({publicKey:{
  challenge:random(32),
  rp:{id:location.hostname,name:"DoFinances"},
  user:{id:random(32),name:"DoFinances hazard protection",displayName:"Hazard protection"},
  pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
  timeout:60000,attestation:"none",
  authenticatorSelection:{authenticatorAttachment:"platform",residentKey:"preferred",userVerification:"required"},
  extensions:{prf:{eval:{first:prfInput}}}
 }});
 if(!credential)throw Error("Device enrollment was cancelled.");
 record.credential=toB64(credential.rawId);
 let result=credential.getClientExtensionResults?.().prf?.results?.first;
 let secret;
 if(result instanceof ArrayBuffer||ArrayBuffer.isView(result)){
  secret=new Uint8Array(result);
 }else{
  // Some authenticators only support PRF evaluation on authentication.
  secret=await deriveKey(credential,record);
 }
 if(secret.length!==32)throw Error("This authenticator cannot protect the PIN using WebAuthn PRF.");
 const iv=random(12);
 try{
  const key=await cipherKey(secret);
  const sealed=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode("hazard-pin:v1:"+pin));
  record.iv=toB64(iv);record.ciphertext=toB64(sealed);
  await storage("readwrite","put",record);
 }finally{secret.fill(0);}
 return true;
}
export async function unlockDevicePIN(){
 if(!browserReady())throw Error("Device unlock is not supported in this browser.");
 const record=await storage("readonly","get");
 if(!validate(record))throw Error("Device unlock is not configured on this device.");
 const secret=await deriveKey(null,record);
 try{
  const key=await cipherKey(secret);
  const raw=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(record.iv)},key,fromB64(record.ciphertext));
  const plain=decoder.decode(raw);
  const pin=plain.startsWith("hazard-pin:v1:")?plain.slice("hazard-pin:v1:".length):"";
  if(!validPIN(pin))throw Error("Stored device PIN is invalid. Enter your PIN and enroll again.");
  return pin;
 }catch(error){
  if(error?.name==="OperationError")throw Error("Device unlock failed. Enter the PIN instead.");
  throw error;
 }finally{secret.fill(0);}
}
