// Studio SVG editor: short-lived, owner-bound, revocable grants stored in AuthStore SQLite.
// Never share the apex __Host- session cookie with the Studio Pages origin.
import {randomToken,sha256} from "./auth-core.mjs";
const now=()=>Math.floor(Date.now()/1000);
const VALID=/^[A-Za-z0-9_-]{43}$/;
export function initStudioGrants(sql){
  sql.exec(`CREATE TABLE IF NOT EXISTS studio_svg_grants (
    hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, source_hash TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('ticket','session')),
    expires_at INTEGER NOT NULL
  )`);
}
function isOwnerAndSignedIn(sql,userId,sourceHash){
  return !!sql.exec(`SELECT 1 FROM sessions s JOIN colosseum_owner o ON o.user_id=s.user_id
    WHERE o.singleton='colosseum' AND s.user_id=? AND s.token_hash=? AND s.expires_at>? LIMIT 1`,
    userId,sourceHash,now()).toArray()[0];
}
export async function studioBegin(store,apexToken){
  if(!VALID.test(apexToken||""))return {status:401};
  const user=await store.session(apexToken);
  if(!user)return {status:401};
  const sourceHash=await sha256(apexToken);
  if(!isOwnerAndSignedIn(store.sql,user.id,sourceHash))return {status:403};
  const ticket=randomToken();
  store.sql.exec("DELETE FROM studio_svg_grants WHERE expires_at<?",now());
  store.sql.exec("INSERT INTO studio_svg_grants(hash,user_id,source_hash,kind,expires_at) VALUES(?,?,?,'ticket',?)",
    await sha256(ticket),user.id,sourceHash,now()+60);
  return {status:200,ticket};
}
export async function studioExchange(store,ticket){
  if(!VALID.test(ticket||""))return {status:401};
  // An atomic consume prevents replay, even across concurrent Pages requests.
  const row=store.sql.exec(`DELETE FROM studio_svg_grants
    WHERE hash=? AND kind='ticket' AND expires_at>?
    RETURNING user_id,source_hash`,await sha256(ticket),now()).toArray()[0];
  if(!row||!isOwnerAndSignedIn(store.sql,row.user_id,row.source_hash))return {status:401};
  const session=randomToken(),expiresIn=1200;
  store.sql.exec("INSERT INTO studio_svg_grants(hash,user_id,source_hash,kind,expires_at) VALUES(?,?,?,'session',?)",
    await sha256(session),row.user_id,row.source_hash,now()+expiresIn);
  return {status:200,session,expiresIn};
}
export async function studioVerify(store,token){
  if(!VALID.test(token||""))return {status:401};
  const row=store.sql.exec(`SELECT user_id,source_hash FROM studio_svg_grants
    WHERE hash=? AND kind='session' AND expires_at>? LIMIT 1`,
    await sha256(token),now()).toArray()[0];
  return {status:row&&isOwnerAndSignedIn(store.sql,row.user_id,row.source_hash)?200:401};
}
