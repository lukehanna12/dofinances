// Shared Web Crypto and credential/session rules; deliberately no D1.
export const SESSION_COOKIE = "__Host-dofinances_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const PASSWORD_ITERATIONS = 100000;
const encoder = new TextEncoder();

export function normalizedEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,63}$/.test(email)
    ? email : null;
}
export function validPassword(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128 &&
    !/[\u0000-\u001f\u007f]/.test(value);
}
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64url(bytes);
}
function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256(value) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, "0")).join("");
}
export async function passwordHash(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(v => parseInt(v, 16)));
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt, iterations}, key, 256);
  return Array.from(new Uint8Array(bits), v => v.toString(16).padStart(2, "0")).join("");
}
export function randomSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), v => v.toString(16).padStart(2, "0")).join("");
}
export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  for (let i=0; i<Math.max(a.length,b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export function parseCookie(header) {
  const entry = (header || "").split(";").map(x => x.trim()).find(x => x.startsWith(SESSION_COOKIE + "="));
  const value = entry?.slice(SESSION_COOKIE.length+1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function sessionCookie(token) {
  return SESSION_COOKIE + "=" + token + "; Path=/; Max-Age=" + SESSION_SECONDS +
    "; HttpOnly; Secure; SameSite=Lax";
}
export function expireCookie() {
  return SESSION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}
