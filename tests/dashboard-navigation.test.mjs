import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {MAIN_ROUTES,COLOSSEUM_ROUTES,resolveWorkspaceRoute,workspaceRouteDetails,initWorkspaceNavigation}
  from "../sites/_apex/app/assets/workspace-nav.js";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("workspace route contract keeps main and Colosseum Settings distinct",()=>{
  assert.deepEqual(MAIN_ROUTES,["home","projects","settings"]);
  assert.deepEqual(COLOSSEUM_ROUTES,["capabilities","collections","providers","permissions","diagnostics","settings"]);
  assert.equal(resolveWorkspaceRoute(""),"home");
  assert.equal(resolveWorkspaceRoute("#home"),"home");
  assert.equal(resolveWorkspaceRoute("#projects"),"projects");
  assert.equal(resolveWorkspaceRoute("#settings"),"settings");
  assert.equal(resolveWorkspaceRoute("#account"),"settings");
  assert.equal(resolveWorkspaceRoute("","?federation_linked=1"),"settings");
  assert.equal(resolveWorkspaceRoute("","?federation_error=identity_used"),"settings");
  assert.equal(resolveWorkspaceRoute("#colosseum"),"colosseum/capabilities");
  for(const section of COLOSSEUM_ROUTES){
    assert.equal(resolveWorkspaceRoute("#colosseum/"+section),"colosseum/"+section);
    assert.equal(workspaceRouteDetails("colosseum/"+section).project,true);
  }
  assert.equal(workspaceRouteDetails("settings").project,false);
  assert.equal(workspaceRouteDetails("colosseum/settings").label,"Settings");
  assert.equal(resolveWorkspaceRoute("#colosseum/unknown"),"home");
  assert.equal(resolveWorkspaceRoute("#javascript:evil"),"home");
});
test("direct nested app paths resolve the same screens as hash navigation",()=>{
  for(const route of MAIN_ROUTES){
    assert.equal(resolveWorkspaceRoute("","",`/app/${route}`),route);
    assert.equal(resolveWorkspaceRoute("","",`/app/${route}/`),route);
  }
  for(const section of COLOSSEUM_ROUTES){
    const route="colosseum/"+section;
    assert.equal(resolveWorkspaceRoute("","","/app/"+route),route);
    assert.equal(resolveWorkspaceRoute("","","/dashboard/"+route),route);
  }
  assert.equal(resolveWorkspaceRoute("","","/app/account"),"settings");
  assert.equal(resolveWorkspaceRoute("","","/app/colosseum"),"colosseum/capabilities");
  assert.equal(resolveWorkspaceRoute("#settings","","/app/projects"),"settings");
  assert.equal(resolveWorkspaceRoute("","?federation_linked=1","/app/home"),"settings");
  assert.equal(resolveWorkspaceRoute("#unknown","","/app/projects"),"home");
  assert.equal(resolveWorkspaceRoute("","","/app/colosseum/unknown"),"home");
});
test("reconstruction-inspired adaptive presentation covers all shared workspace views",async()=>{
  const html=await read("../sites/_apex/app/index.html");
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  assert.match(html,/href="\/app\/assets\/dashboard\.css"[\s\S]*href="\/app\/assets\/workspace-theme\.css"/);
  assert.match(html,/<meta name="theme-color" content="#000000">/);
  assert.equal((html.match(/name="theme-color"/g)||[]).length,1);
  for(const name of [".sidebar",".nav-link.active",".topbar",".content",
    ".feature-card",".project-card",".project-view .empty-state",
    ".settings-panel",".security-form input",".danger"]){
    assert.ok(css.includes(name),"missing style: "+name);
  }
  assert.match(css,/color-scheme:\s*dark;/);
  assert.match(css,/--ui-canvas:\s*#000000;/);
  assert.match(css,/--ui-sidebar:\s*#000000;/);
  assert.match(css,/--ui-divider:\s*#303030;/);
  assert.match(css,/border-right:\s*1px solid var\(--ui-divider\)/);
  assert.match(css,/--ui-surface:\s*#212121;/);
  assert.match(css,/--ui-elevated:\s*#171717;/);
  assert.match(css,/--ui-selected:\s*#303030;/);
  assert.doesNotMatch(css,/@media\s*\(prefers-color-scheme:/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/@media \(prefers-contrast: more\)/);
  assert.match(css,/\.shell\.is-collapsed \.sidebar/);
  assert.match(css,/\.shell\.is-mobile-open \.sidebar/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/@import|https:\/\/chatgpt\.com\/cdn/i);
});
test("dashboard HTML provides every requested view and preserves existing authentication handlers",async()=>{
  const html=await read("../sites/_apex/app/index.html");
  for(const name of MAIN_ROUTES)assert.match(html,new RegExp('data-view="'+name+'"'));
  for(const name of COLOSSEUM_ROUTES)
    assert.match(html,new RegExp('data-view="colosseum/'+name+'"'));
  assert.equal((html.match(/class="view project-view"/g)||[]).length,COLOSSEUM_ROUTES.length);
  assert.match(html,/id="main-navigation"/);
  assert.match(html,/id="project-navigation"/);
  assert.match(html,/id="sidebar-toggle"/);
  assert.match(html,/id="mobile-nav-toggle"/);
  assert.match(html,/id="back-to-workspace"/);
  assert.match(html,/href="#projects"[^>]+aria-label="Back to Projects"/);
  assert.match(html,/href="#colosseum\/capabilities"/);
  for(const id of ["account-email","account-email-detail","signout","linked-accounts",
    "linked-identity-list","add-identity-buttons","federation-feedback",
    "resend-verification","start-mfa","mfa-confirm-form","mfa-disable-form",
    "delete-form","delete-feedback"]){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.match(html,/Link up to five Google accounts and three GitHub accounts/);
  assert.doesNotMatch(html,/(chatgpt|sign in with apple)/i);
});
test("sidebar CSS supports mobile drawer, rail collapse, and visible focus",async()=>{
  const css=await read("../sites/_apex/app/assets/dashboard.css");
  const js=await read("../sites/_apex/app/assets/dashboard.js");
  assert.match(css,/\.shell\.is-collapsed \.sidebar/);
  assert.match(css,/\.shell\.is-mobile-open \.sidebar/);
  assert.match(css,/\.sidebar-scrim:not\(\[hidden\]\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\[hidden\]\{display:none!important\}/);
  assert.match(js,/initWorkspaceNavigation\(\)/);
  assert.match(js,/\/api\/auth\/federation\/accounts/);
  assert.match(js,/\/api\/auth\/federation\/unlink/);
  assert.match(js,/\/api\/auth\/account/);
  assert.match(js,/authPost\("mfa\/setup"/);
});
function element(props={}){
  const classes=new Set();
  const listeners={};
  const attrs={};
  return {hidden:false,dataset:{},textContent:"",title:"",href:"",...props,
    classList:{contains:x=>classes.has(x),toggle:(x,force)=>{
      if(force===undefined)force=!classes.has(x);
      if(force)classes.add(x);else classes.delete(x);
      return force;
    },add:x=>classes.add(x),remove:x=>classes.delete(x)},
    setAttribute:(key,value)=>{attrs[key]=String(value);},
    getAttribute:key=>attrs[key],
    removeAttribute:key=>{delete attrs[key];},
    addEventListener:(key,fn)=>{(listeners[key]??=[]).push(fn);},
    dispatch:key=>{for(const fn of listeners[key]||[])fn({key});},
    focus:()=>{}
  };
}
function mockNavigation(){
  const ids=["workspace-shell","workspace-sidebar","sidebar-toggle","mobile-nav-toggle",
    "sidebar-scrim","main-navigation","project-navigation",
    "breadcrumb","location-subtitle","back-to-workspace"];
  const elements=Object.fromEntries(ids.map(id=>[id,element()]));
  const views=[...MAIN_ROUTES,...COLOSSEUM_ROUTES.map(x=>"colosseum/"+x)].map(name=>
    element({dataset:{view:name}}));
  const links=[...MAIN_ROUTES,...COLOSSEUM_ROUTES.map(x=>"colosseum/"+x)].map(name=>
    element({href:"https://dofinances.com/app#"+name}));
  let mobile=false;
  const listeners={};
  const stored=new Map();
  const doc={title:"",getElementById:id=>elements[id],querySelectorAll:selector=>
    selector===".view[data-view]"?views:selector===".nav-link[data-route]"?links:[],
    addEventListener:(key,fn)=>{(listeners["doc:"+key]??=[]).push(fn);}};
  const win={location:{hash:"",search:""},localStorage:{
    getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
    matchMedia:()=>({matches:mobile}),scrollTo:()=>{},
    addEventListener:(key,fn)=>{(listeners[key]??=[]).push(fn);}};
  const fire=key=>(listeners[key]||[]).forEach(fn=>fn());
  return {doc,win,elements,views,links,fire,stored,mobile:value=>{mobile=value;}};
}
test("sidebar changes nav scope, highlights selected view, and supports collapse and mobile drawer",()=>{
  const m=mockNavigation();
  initWorkspaceNavigation(m.doc,m.win);
  assert.equal(m.views.find(x=>x.dataset.view==="home").hidden,false);
  assert.equal(m.views.find(x=>x.dataset.view==="settings").hidden,true);
  assert.equal(m.elements["project-navigation"].hidden,true);
  m.win.location.hash="#projects";m.fire("hashchange");
  assert.equal(m.views.find(x=>x.dataset.view==="projects").hidden,false);
  m.win.location.hash="#colosseum/settings";m.fire("hashchange");
  assert.equal(m.elements["main-navigation"].hidden,true);
  assert.equal(m.elements["project-navigation"].hidden,false);
  assert.equal(m.elements["back-to-workspace"].hidden,false);
  assert.equal(m.views.find(x=>x.dataset.view==="settings").hidden,true);
  assert.equal(m.views.find(x=>x.dataset.view==="colosseum/settings").hidden,false);
  assert.equal(m.links.find(x=>x.href.endsWith("#colosseum/settings")).getAttribute("aria-current"),"page");
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(m.elements["workspace-shell"].classList.contains("is-collapsed"),true);
  assert.equal(m.stored.get("dofinances.workspace.sidebar.collapsed"),"true");
  m.mobile(true);m.fire("resize");
  m.elements["mobile-nav-toggle"].dispatch("click");
  assert.equal(m.elements["workspace-shell"].classList.contains("is-mobile-open"),true);
  assert.equal(m.elements["sidebar-scrim"].hidden,false);
  m.elements["sidebar-scrim"].dispatch("click");
  assert.equal(m.elements["sidebar-scrim"].hidden,true);
  m.win.location.hash="#projects";m.fire("hashchange");
  assert.equal(m.elements["back-to-workspace"].hidden,true);
  assert.equal(m.elements["main-navigation"].hidden,false);
});
