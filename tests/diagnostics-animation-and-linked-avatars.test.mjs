import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const asset=n=>read("sites/_apex/app/assets/"+n);
const diagnostics=asset("diagnostics.js"),css=asset("diagnostics.css");
const makeElement=tag=>({
 tag,children:[],dataset:{},attributes:{},textContent:"",classList:{values:new Set(),add(k){this.values.add(k)}},
 style:{values:{},setProperty(k,v){this.values[k]=v}},
 append(...items){this.children.push(...items)},
 setAttribute(k,v){this.attributes[k]=v}
});
const freshContext=()=>({document:{createElement:makeElement},Intl});
const diagnosticSource=diagnostics.replace("export function initColosseumDiagnostics","function initColosseumDiagnostics");

test("Native empty battery uses two dashes, no bolt and the precise 100%-fill cavity geometry",()=>{
 const fn=runInNewContext(diagnosticSource+"\nbatteryGraphic",freshContext());
 const empty=fn(null).glyph;
 assert.equal(empty.children.filter(x=>x.className==="dg-battery-bolt-symbol").length,0);
 assert.equal(empty.children.at(-1).textContent,"--");
 assert.equal(empty.children.filter(x=>x.className==="dg-battery-fill").length,0);
 const pct=42,charged=fn({battery_percent:pct,battery_charging:true}).glyph;
 assert.equal(charged.children.at(-1).textContent,"42");
 const fill=charged.children.find(x=>x.className==="dg-battery-fill");
 const right=100*(1-(2.53194+(29.6276-2.53194)*pct/100)/35.9904);
 assert.equal(fill.style.values["--dg-battery-final-right"],right.toFixed(4)+"%");
 assert.equal(charged.children.filter(x=>x.className==="dg-battery-bolt-symbol").length,1);
 assert.ok(css.includes('mask-image:url("/app/assets/battery/battery.fill.100percent.svg")'));
 assert.ok(css.includes('clip-path:inset(0 var(--dg-battery-final-right,100%) 0 0)'));
 assert.ok(css.includes('@keyframes dg-battery-reveal'));
 assert.ok(css.includes('from{clip-path:inset(0 100% 0 0);background-color:#fff}'));
 assert.ok(css.includes('to{clip-path:inset(0 var(--dg-battery-final-right,100%) 0 0);background-color:var(--dg-battery-tint)}'));
 assert.match(css,/\.dg-battery-number\{[^}]*-webkit-text-stroke:2px var\(--dg-panel-bg\)/);
 assert.match(css,/\.dg-battery-bolt-symbol\{[^}]*left:-6px;[^}]*transform:translate\(-100%,-50%\);[^}]*background:#fff/);
 assert.match(css,/\.dg-battery-graphic\{[^}]*margin-left:24px;[^}]*overflow:visible/);
 assert.match(css,/\.dg-battery-number\{[^}]*left:44\.3%/);
 assert.ok(css.includes('animation:dg-battery-bolt-arrive var(--dg-reveal-duration) ease-out both'));
 assert.ok(css.includes('@keyframes dg-battery-bolt-arrive{0%,55%{opacity:0}100%{opacity:1}}'));
});
test("All Diagnostics circular gauges and usage tracks animate from unfilled to their true values",()=>{
 const progress=runInNewContext(diagnosticSource+"\nprogress",freshContext());
 const p=progress({used:37,limit:100});
 assert.equal(p.tag,"div");assert.equal(p.attributes.role,"progressbar");
 assert.equal(p.attributes["aria-valuenow"],"37");
 assert.equal(p.children[0].style.values["--dg-bar-target"],"37%");
 assert.ok(css.includes('@property --dg-ring-percent{syntax:"<number>";inherits:false;initial-value:0}'));
 assert.ok(css.includes('@keyframes dg-ring-arrive{from{--dg-ring-percent:0}to{--dg-ring-percent:var(--dg-ring-target,0)}}'));
 assert.ok(css.includes('.dg-card-ring.dg-ring-loading{animation:none;--dg-ring-percent:0}'));
 assert.ok(css.includes('@keyframes dg-bar-arrive{from{width:0}to{width:var(--dg-bar-target,0%)}}'));
 assert.ok(diagnostics.includes('ring.style.setProperty("--dg-ring-target",String(Math.min(100,pct)))'));
 assert.ok(diagnostics.includes('bar.style.setProperty("--dg-bar-target"'));
 assert.ok(diagnostics.includes('entry.append(head,make("div","dg-progress dg-progress-placeholder"))'));
 assert.ok(diagnostics.includes('initialSkeletonReport();\n  reportLoading(true)'));
 assert.ok(diagnostics.includes('if(previous)renderReport(previous)'));
 assert.ok(css.includes('--dg-reveal-duration:950ms'));
});
test("Settings puts deletion action below its textboxes and presents branded, separate capacity buttons",()=>{
 const source=asset("dashboard.js"),styles=asset("settings.css");
 assert.ok(styles.includes('#st-root #delete-form > button.destructive{margin-top:12px}'));
 assert.ok(source.includes('text.textContent="Connect new "+(PROVIDER_NAMES[provider]||provider)+" Account"'));
 assert.ok(source.includes('capacity.textContent=count+"/"+max+" connected"'));
 assert.ok(source.includes('add.append(identityBrandIcon(provider))'));
 assert.ok(source.includes('group.append(add,capacity);buttons.append(group)'));
 assert.ok(source.includes('person.append(identityPicture(item))'));
 assert.ok(source.includes('image.referrerPolicy="no-referrer"'));
 assert.ok(source.includes('image.addEventListener("error",()=>image.replaceWith(fallback)'));
 assert.ok(styles.includes('.st-identity-avatar{display:block;flex:none;width:36px;height:36px;'));
 assert.ok(styles.includes('.st-identity-add-group{display:flex;flex-direction:row;align-items:center;justify-content:space-between'));
 assert.ok(styles.includes('#add-identity-buttons{display:flex;flex-direction:column;align-items:stretch'));
 assert.ok(styles.includes('.st-identity-capacity{flex:none;margin-left:auto;padding:0;text-align:right'));
 assert.ok(styles.includes('.st-identity-capacity{padding-left:2px;color:#777;font-size:10px;'));
 assert.doesNotMatch(source,/add.textContent="Add "/);
});
test("OIDC profile photo persistence is verified, migrated and only sent to the signed-in owner",()=>{
 const auth=read("edge/auth-federation.mjs"),store=read("edge/auth-store-federated.mjs");
 assert.ok(auth.includes('avatarUrl:safeFederatedAvatar("google",payload.picture)'));
 assert.ok(auth.includes('avatarUrl:"https://avatars.githubusercontent.com/u/"+profile.id+"?v=4"'));
 assert.ok(store.includes("PRAGMA table_info(federated_identities)"));
 assert.ok(store.includes("ALTER TABLE federated_identities ADD COLUMN avatar_url TEXT"));
 assert.ok(store.includes("SELECT id,provider,subject,email,display_name,avatar_url,linked_at FROM federated_identities WHERE user_id=?"));
 assert.ok(store.includes("const user=await this.session(token)"));
 assert.ok(store.includes('if(!user)return {status:401,error:"Not authenticated."}'));
 assert.ok(store.includes('avatarUrl:safeFederatedAvatar(r.provider,r.avatar_url)'));
 assert.ok(store.includes("UPDATE federated_identities SET avatar_url=?"));
 assert.ok(!auth.includes("console.log(result.access_token)"));
});
