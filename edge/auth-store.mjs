import { DurableObject } from "cloudflare:workers";
import {
  normalizedEmail, validPassword, randomToken, randomSalt, passwordHash, sha256,
  constantTimeEqual, PASSWORD_ITERATIONS, SESSION_SECONDS
} from "./auth-core.mjs";

// Single authoritative, transactionally consistent account+session store.
// Does NOT create or query a D1 database.
export class AuthStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS attempts (
      bucket TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      since INTEGER NOT NULL
    )`);
  }
  limited(bucket, max, windowSec) {
    const now = Math.floor(Date.now()/1000);
    const row = this.sql.exec("SELECT count,since FROM attempts WHERE bucket=?", bucket).toArray()[0];
    return !!row && now-row.since < windowSec && row.count >= max;
  }
  hit(bucket, windowSec) {
    const now = Math.floor(Date.now()/1000);
    this.sql.exec(
      `INSERT INTO attempts(bucket,count,since) VALUES(?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET
      count=CASE WHEN ?-since>=? THEN 1 ELSE count+1 END,
      since=CASE WHEN ?-since>=? THEN ? ELSE since END`,
      bucket, now, now, windowSec, now, windowSec, now
    );
  }
  async makeSession(userId) {
    const token=randomToken();
    const tokenHash=await sha256(token);
    const expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;
    this.sql.exec("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",tokenHash,userId,expires);
    return token;
  }
  async signup({email,password,ipKey}) {
    const validEmail=normalizedEmail(email);
    if (!validEmail || !validPassword(password))
      return {status:400,error:"Enter a valid email and a password of 12–128 characters."};
    const bucket="signup:"+(ipKey||"unknown");
    if (this.limited(bucket,5,3600)) return {status:429,error:"Too many sign-up attempts. Try again later."};
    this.hit(bucket,3600);
    if (this.sql.exec("SELECT id FROM users WHERE email=?",validEmail).toArray().length)
      return {status:409,error:"An account with that email already exists."};
    const salt=randomSalt();
    const hash=await passwordHash(password,salt);
    const id=crypto.randomUUID();
    try {
      this.sql.exec("INSERT INTO users(id,email,salt,password_hash,iterations,created_at) VALUES(?,?,?,?,?,?)",
        id,validEmail,salt,hash,PASSWORD_ITERATIONS,Math.floor(Date.now()/1000));
    } catch (error) {
      if (String(error).includes("UNIQUE")) return {status:409,error:"An account with that email already exists."};
      throw error;
    }
    const token=await this.makeSession(id);
    return {status:201,token,user:{id,email:validEmail}};
  }
  async login({email,password,ipKey}) {
    const validEmail=normalizedEmail(email);
    if (!validEmail || typeof password!=="string" || password.length>128)
      return {status:401,error:"Invalid email or password."};
    const ipBucket="login-ip:"+(ipKey||"unknown");
    const emailBucket="login-email:"+(await sha256(validEmail));
    if (this.limited(ipBucket,30,900) || this.limited(emailBucket,10,900))
      return {status:429,error:"Too many attempts. Try again later."};
    const user=this.sql.exec(
      "SELECT id,email,salt,password_hash,iterations FROM users WHERE email=?",validEmail
    ).toArray()[0];
    const salt=user?.salt || "f5130ce7b19ac6d82fba81c601e5bd53";
    const actual=await passwordHash(password,salt,user?.iterations||PASSWORD_ITERATIONS);
    if (!user || !constantTimeEqual(actual,user.password_hash)) {
      this.hit(ipBucket,900);
      this.hit(emailBucket,900);
      return {status:401,error:"Invalid email or password."};
    }
    const token=await this.makeSession(user.id);
    return {status:200,token,user:{id:user.id,email:user.email}};
  }
  async session(token) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const tokenHash=await sha256(token);
    const record=this.sql.exec(
      `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`,
      tokenHash,Math.floor(Date.now()/1000)
    ).toArray()[0];
    return record?{id:record.id,email:record.email}:null;
  }
  async logout(token) {
    if (token) this.sql.exec("DELETE FROM sessions WHERE token_hash=?",await sha256(token));
    return true;
  }
  async deleteAccount({token,password}) {
    if (!token || typeof password!=="string") return {status:401,error:"Not authenticated."};
    const tokenHash=await sha256(token);
    const user=this.sql.exec(
      `SELECT u.id,u.salt,u.password_hash,u.iterations FROM users u
       JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`,
      tokenHash,Math.floor(Date.now()/1000)
    ).toArray()[0];
    if (!user) return {status:401,error:"Not authenticated."};
    const actual=await passwordHash(password,user.salt,user.iterations);
    if (!constantTimeEqual(actual,user.password_hash)) return {status:403,error:"Incorrect password."};
    this.ctx.storage.transactionSync(()=>{
      this.sql.exec("DELETE FROM sessions WHERE user_id=?",user.id);
      this.sql.exec("DELETE FROM users WHERE id=?",user.id);
    });
    return {status:204};
  }
}
