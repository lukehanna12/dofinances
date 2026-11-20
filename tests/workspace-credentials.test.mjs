import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORKSPACE_GOOGLE_SERVICES,workspaceGoogleProvider,workspaceServiceStatus}
 from "../sites/_apex/app/assets/workspace-credential-hub.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Drive, Docs, Sheets, Slides are four distinct MCP service names",()=>{
 assert.deepEqual(WORKSPACE_GOOGLE_SERVICES.map(x=>x.id),["drive","docs","sheets","slides"]);
 const providers=[
  {uid:"000001",name:"Google Drive MCP",status:"connected"},
  {uid:"000002",name:"Google Docs",status:"disconnected"},
  {uid:"000003",name:"Google Sheets MCP",status:"pending"},
  {uid:"000004",name:"Google Slides",status:"connected"},
  {uid:"000005",name:"Some other service",status:"connected"}
 ];
 assert.deepEqual(WORKSPACE_GOOGLE_SERVICES.map(x=>workspaceGoogleProvider(providers,x.id)?.uid),
  ["000001","000002","000003","000004"]);
 assert.equal(workspaceGoogleProvider(providers,"script"),null);
 assert.equal(workspaceGoogleProvider(providers,"drive")?.status,"connected");
});

test("Identity links never become implied MCP authorization",()=>{
 assert.equal(workspaceServiceStatus(null,false),"Checking MCP");
 assert.equal(workspaceServiceStatus(null,true),"MCP not registered");
 assert.equal(workspaceServiceStatus({status:"pending"},true),"Authorization pending");
 assert.equal(workspaceServiceStatus({status:"disconnected"},true),"MCP not connected");
 assert.equal(workspaceServiceStatus({status:"connected"},true),"MCP connected");
 const src=read("sites/_apex/app/assets/workspace-credential-hub.js");
 assert.match(src,/Linking Google for sign-in does not grant file access/);
 assert.match(src,/Sign-in identity is not a GitHub repository token/);
 assert.match(src,/Cloudflare Access identity alone does not confer API permissions/);
 assert.doesNotMatch(src,/lukebidness@gmail\.com/i);
 assert.doesNotMatch(src,/localStorage\.setItem\([^)]*(?:token|secret)/i);
});

test("Credential hub uses live account APIs and established OAuth routes, not invented tokens",()=>{
 const src=read("sites/_apex/app/assets/workspace-credential-hub.js");
 const providers=read("sites/_apex/app/assets/providers.js");
 const css=read("sites/_apex/app/assets/providers.css");
 const router=read("edge/router.mjs");
 const auth=read("edge/auth-federation.mjs");
 for(const url of ["/api/auth/federation/accounts","/api/auth/config",
  "/api/github/connection","/api/cloudflare/connection"])
  assert.ok(src.includes(url),"Missing status API "+url);
 assert.ok(src.includes("/api/auth/oauth/start?provider=google&intent=link"));
 assert.ok(src.includes("/api/auth/oauth/start?provider=github&intent=link"));
 assert.ok(src.includes("onSelectProvider(provider.uid)"));
 assert.ok(providers.includes('initWorkspaceCredentialHub(root,'));
 assert.ok(providers.includes('if(mode==="credentials")credentialHub.activate()'));
 assert.ok(providers.includes("dofinances.credentials.return.v1"));
 assert.ok(css.includes('#pv-root:not([data-mode="credentials"]) .pv-account-hub{display:none!important}'));
 assert.match(router,/\/api\/auth\/federation\/accounts/);
 assert.match(router,/\/api\/cloudflare\/connection/);
 assert.match(auth,/scope:"openid profile email"/);
});
