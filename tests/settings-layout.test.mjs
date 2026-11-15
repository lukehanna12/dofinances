import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {initSettingsNavigation} from "../sites/_apex/app/assets/settings.js";
import {resolveWorkspaceRoute} from "../sites/_apex/app/assets/workspace-nav.js";

const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const settings=html=>{const a=html.indexOf('<section class="view settings-view" data-view="settings"');
 const b=html.indexOf('<section class="view',a+20);assert.ok(a>0&&b>a);return html.slice(a,b);};

test("Settings is a single organized page preserving both Settings routes",async()=>{
 const html=await read("sites/_apex/app/index.html"),view=settings(html);
 let last=0;
 for(const name of ["general","security","connections","advanced"]){
  const p=view.indexOf('id="st-'+name+'" class="st-group"');
  assert.ok(p>last,"Group missing or out of order: "+name);last=p;
  assert.ok(view.includes('data-st-target="st-'+name+'"'));
  assert.ok(!view.includes('href="#st-'+name+'"'),"In-page controls must not replace the SPA hash");
 }
 assert.equal(resolveWorkspaceRoute("#settings"),"settings");
 assert.equal(resolveWorkspaceRoute("#colosseum/settings"),"colosseum/settings");
 assert.equal((html.match(/data-view="settings"/g)||[]).length,1);
 assert.match(html,/\/app\/assets\/settings\.css/);
 assert.match(html,/\/app\/assets\/settings\.js/);
});

test("Settings retains existing security and credential form IDs and safety states",async()=>{
 const view=settings(await read("sites/_apex/app/index.html"));
 const originalIds=[
 "clock-zone-select","clock-custom-zone","clock-custom-apply","clock-settings-feedback",
 "cf-heading","cf-connection-status","cf-owner-email","cf-active-scope","cf-expiry",
 "cf-authenticate","cf-refresh","cf-feedback","cf-connect-form","cf-connect-title",
 "cf-token","cf-connect-button","cf-scope-form","cf-mode","cf-accounts","cf-zones",
 "cf-user","cf-save-scope","cf-full-scope","cf-explorer","cf-api-form","cf-api-method",
 "cf-api-path","cf-api-body","cf-api-send","cf-api-output","cf-disconnect-area","cf-disconnect",
 "github-readme-status","github-readme-form","github-readme-token","github-readme-remove",
 "github-readme-feedback","account-email-detail","linked-identity-list","add-identity-buttons",
 "federation-feedback","verification-state","resend-verification","verification-feedback",
 "enable-password","mfa-state","start-mfa","mfa-setup","mfa-secret","mfa-confirm-form",
 "setup-code","mfa-setup-feedback","mfa-recovery","recovery-codes","mfa-disable-form",
 "disable-password","disable-code","mfa-disable-feedback","connect-cloudflare-owner",
 "colosseum-owner-feedback","signout","delete-form","delete-password","delete-code","delete-feedback"
 ];
 const actual=[...view.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(actual).size,actual.length,"Duplicate Settings element ids");
 for(const id of originalIds)assert.equal(actual.filter(x=>x===id).length,1,id);
 assert.equal((view.match(/<form\b/g)||[]).length,7,"Retain every live form");
 assert.equal((view.match(/<section\b/g)||[]).length,(view.match(/<\/section>/g)||[]).length);
 assert.equal((view.match(/<details\b/g)||[]).length,(view.match(/<\/details>/g)||[]).length);
 for(const [details,field] of [["st-cloudflare-token","cf-connect-form"],
  ["st-cloudflare-scope","cf-scope-form"],["st-github-token","github-readme-form"],
  ["st-mfa-details","mfa-confirm-form"]])
   assert.ok(view.indexOf('id="'+details+'"')<view.indexOf('id="'+field+'"'),details+" editor nesting");
 for(const key of ["mfa-recovery","mfa-disable-form","cf-explorer","cf-disconnect-area"])
   assert.match(view,new RegExp('id="'+key+'"[^>]*hidden'));
 assert.match(view,/<details class="danger">[\s\S]*?<form id="delete-form"/);
 assert.match(view,/id="cf-token" type="password"/);
 assert.match(view,/id="github-readme-token" type="password"/);
});

test("Settings keeps server-side authorization and uses compact scoped styling",async()=>{
 const cf=await read("sites/_apex/app/assets/cloudflare-settings.js"),
  dashboard=await read("sites/_apex/app/assets/dashboard.js"),
  github=await read("sites/_apex/app/assets/project-readme-ui.js"),
  css=await read("sites/_apex/app/assets/settings.css");
 for(const op of ['call("connection","POST"','call("scope","PUT"','call("connection","DELETE"'])
   assert.ok(cf.includes(op));
 for(const op of ["/api/auth/account","mfa/setup","mfa/confirm","mfa/disable","/api/auth/federation/unlink"])
   assert.ok(dashboard.includes(op));
 for(const op of ['api("/api/github/connection","POST"','api("/api/github/connection","DELETE"'])
   assert.ok(github.includes(op));
 assert.match(css,/#st-root \.st-setting-item/);
 assert.match(css,/#st-root \.st-disclosure/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("Settings section buttons scroll without changing the SPA route",()=>{
 const calls=[],section={scrollIntoView:x=>calls.push(x)};
 const buttons=["st-general","st-security","st-connections","st-advanced"].map(id=>{
  const listeners={};return {dataset:{stTarget:id},addEventListener:(k,fn)=>listeners[k]=fn,click:()=>listeners.click()};
 });
 const root={dataset:{},querySelectorAll:()=>buttons,contains:x=>x===section};
 const doc={getElementById:id=>id==="st-root"?root:buttons.some(b=>b.dataset.stTarget===id)?section:null};
 initSettingsNavigation(doc);
 buttons.forEach(x=>x.click());
 assert.equal(calls.length,4);
 assert.ok(calls.every(x=>x.block==="start"&&x.behavior==="smooth"));
 initSettingsNavigation(doc);
 assert.equal(root.dataset.navigationReady,"true");
});
