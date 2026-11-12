import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {MAIN_ROUTES,COLOSSEUM_ROUTES,APPLE_HIG_ROUTES,resolveWorkspaceRoute,workspaceRouteDetails,initWorkspaceNavigation}
  from "../sites/_apex/app/assets/workspace-nav.js";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Settings sidebar links use the native SVG while the Home Settings feature keeps its gear",async()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=await read(path);
    const start=html.indexOf('<symbol id="icon-settings"');
    const end=html.indexOf('</symbol>',start);
    assert.ok(start>=0 && end>start,"Settings feature-card symbol must remain available");
    const symbol=html.slice(start,end);
    assert.ok(symbol.includes('M10 2h4l.7 2.6'),"Home Settings feature retains its toothed gear");
    assert.ok(symbol.includes('<circle cx="12" cy="12" r="3"/>'),"Gear symbol retains its circular center");
    for(const href of ["#settings","#colosseum/settings"]){
      const link='<a class="nav-link" data-route="settings" href="'+href+'"';
      const i=html.indexOf(link);
      assert.ok(i>=0,"Missing Settings sidebar navigation for "+href);
      const row=html.slice(i,html.indexOf('</a>',i));
      assert.ok(row.includes('<span class="nav-icon nav-icon-asset nav-icon-asset--settings" aria-hidden="true"></span>'),
        "Settings sidebar uses the new asset at "+href);
      assert.ok(!row.includes('<use href="#icon-settings">'),"Old settings symbol still in the sidebar");
    }
    assert.equal((html.match(/<use href="#icon-settings"><\/use>/g)||[]).length,1,
      "Only the unchanged Home Settings card retains the legacy gear symbol");
  }
});


test("workspace route contract keeps main and Colosseum Settings distinct",()=>{
  assert.deepEqual(MAIN_ROUTES,["home","projects","settings"]);
  assert.deepEqual(COLOSSEUM_ROUTES,["utilities","collections","providers","permissions","diagnostics","settings"]);
  assert.equal(resolveWorkspaceRoute(""),"home");
  assert.equal(resolveWorkspaceRoute("#home"),"home");
  assert.equal(resolveWorkspaceRoute("#projects"),"projects");
  assert.equal(resolveWorkspaceRoute("#settings"),"settings");
  assert.equal(resolveWorkspaceRoute("#account"),"settings");
  assert.equal(resolveWorkspaceRoute("","?federation_linked=1"),"settings");
  assert.equal(resolveWorkspaceRoute("","?federation_error=identity_used"),"settings");
  assert.equal(resolveWorkspaceRoute("#colosseum"),"colosseum/utilities");
  assert.equal(resolveWorkspaceRoute("#colosseum/capabilities"),"colosseum/utilities",
    "previous Capabilities bookmarks remain valid");
  assert.equal(workspaceRouteDetails("colosseum/utilities").label,"Utilities");
  for(const section of COLOSSEUM_ROUTES){
    assert.equal(resolveWorkspaceRoute("#colosseum/"+section),"colosseum/"+section);
    assert.equal(workspaceRouteDetails("colosseum/"+section).project,true);
  }
  assert.equal(workspaceRouteDetails("settings").project,false);
  assert.equal(workspaceRouteDetails("colosseum/settings").label,"Settings");
  assert.deepEqual(APPLE_HIG_ROUTES,["overview"]);
  assert.equal(resolveWorkspaceRoute("#apple-hig-reader"),"apple-hig-reader/overview");
  assert.equal(resolveWorkspaceRoute("#apple-hig-reader/overview"),"apple-hig-reader/overview");
  assert.equal(workspaceRouteDetails("apple-hig-reader/overview").projectKey,"apple-hig-reader");
  assert.equal(resolveWorkspaceRoute("#apple-hig-reader/missing"),"home");
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
  assert.equal(resolveWorkspaceRoute("","","/app/colosseum"),"colosseum/utilities");
  assert.equal(resolveWorkspaceRoute("","","/app/colosseum/capabilities"),"colosseum/utilities",
    "previous direct page URLs remain valid");
  assert.equal(resolveWorkspaceRoute("#settings","","/app/projects"),"settings");
  assert.equal(resolveWorkspaceRoute("","?federation_linked=1","/app/home"),"settings");
  assert.equal(resolveWorkspaceRoute("#unknown","","/app/projects"),"home");
  assert.equal(resolveWorkspaceRoute("","","/app/colosseum/unknown"),"home");
  assert.equal(resolveWorkspaceRoute("","","/app/apple-hig-reader"),"apple-hig-reader/overview");
  assert.equal(resolveWorkspaceRoute("","","/app/apple-hig-reader/overview"),"apple-hig-reader/overview");
  assert.equal(resolveWorkspaceRoute("","","/dashboard/apple-hig-reader/overview"),"apple-hig-reader/overview");
});
test("reconstruction-inspired adaptive presentation covers all shared workspace views",async()=>{
  const html=await read("../sites/_apex/app/index.html");
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  const foundation=await read("../sites/_apex/assets/site-foundation.css");
  assert.match(html,/href="\/app\/assets\/dashboard\.css"[\s\S]*href="\/assets\/site-foundation\.css"[\s\S]*href="\/app\/assets\/workspace-theme\.css"/);
  assert.match(html,/<meta name="theme-color" content="#171717">/);
  assert.equal((html.match(/name="theme-color"/g)||[]).length,1);
  for(const name of [".sidebar",".nav-link.active",".topbar",".content",
    ".feature-card",".project-card",".project-view .empty-state",
    ".settings-panel",".security-form input",".danger"]){
    assert.ok(css.includes(name),"missing style: "+name);
  }
  assert.match(foundation,/color-scheme:\s*dark;/);
  assert.match(foundation,/--ui-canvas:\s*#171717;/);
  assert.match(foundation,/--ui-sidebar:\s*#171717;/);
  assert.match(foundation,/--ui-divider:\s*#303030;/);
  assert.match(css,/border-right:\s*1px solid var\(--ui-divider\)/);
  assert.match(foundation,/--ui-surface:\s*#292929;/);
  assert.match(foundation,/--ui-elevated:\s*#202020;/);
  assert.match(foundation,/--ui-selected:\s*#303030;/);
  assert.doesNotMatch(css,/@media\s*\(prefers-color-scheme:/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/@media \(prefers-contrast: more\)/);
  assert.match(css,/\.shell\.is-collapsed \.sidebar/);
  assert.match(css,/\.shell\.is-mobile-open \.sidebar/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/@import|https:\/\/chatgpt\.com\/cdn/i);
});
test("sidebar collapse/expand keeps layout mounted and interpolates positions",async()=>{
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  const head=css.match(/\.sidebar-head \{([^}]*)\}/)?.[1]||"";
  const collapsedHead=css.match(/\.shell\.is-collapsed \.sidebar-head \{([^}]*)\}/)?.[1]||"";
  assert.match(head,/display:\s*block/,"avoid flex-direction layout switching");
  assert.match(head,/height:\s*71px/);
  assert.match(head,/min-height:\s*0/);
  assert.match(head,/transition:\s*height var\(--sidebar-layout-duration\)/);
  assert.match(collapsedHead,/display:\s*block/);
  assert.match(collapsedHead,/height:\s*113px/);
  assert.match(collapsedHead,/min-height:\s*0/,"min-height must not clamp the height transition");
  assert.match(css,/\.shell\.is-collapsed \.sidebar-toggle \{top:\s*44px;\s*right:\s*7px;\}/);
  assert.match(css,/transition:\s*top var\(--sidebar-layout-duration\)[^;]+right var\(--sidebar-layout-duration\)/);
  for(const [selector,display] of [
    ["brand-wordmark","flex"],["nav-label","block"],
    ["nav-section-label","block"],["sidebar-foot-label","inline-block"]
  ]){
    const collapsed=new RegExp("\\.shell\\.is-collapsed \\."+selector+" \\{display: "+display+";\\}");
    assert.match(css,collapsed,selector+" must stay mounted while fading");
  }
  const collapsedLink=css.match(/\.shell\.is-collapsed \.nav-link \{([^}]*)\}/)?.[1]||"";
  assert.match(collapsedLink,/justify-content:\s*flex-start/);
  assert.match(collapsedLink,/padding:\s*9px 0 9px 15px/);
  assert.match(collapsedLink,/gap:\s*0/);
  assert.match(css,/\.shell\.is-collapsed \.nav-link \.nav-icon \{width:\s*18px;\s*height:\s*18px;\}/);
  assert.match(css,/@media \(max-width: 760px\) \{/);
  assert.match(css,/\.shell\.is-collapsed \.sidebar-toggle \{top:\s*1px;\s*right:\s*0;\}/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.sidebar-head, \.brand, \.sidebar-toggle/);
});
test("collapsed rail links actually shrink inside the sidebar and keep rounded selections",async()=>{
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  // Original bug: auto-sized grid columns retained the min-content width of
  // opacity-hidden labels, clipping the selected-link pill.
  const rule=selector=>{
    const start=css.indexOf(selector+" {");
    if(start===-1)return "";
    const after=css.indexOf("{",start)+1;
    return css.slice(after,css.indexOf("}",after));
  };
  const nav=rule(".sidebar-navigation");
  const stack=rule(".nav-stack");
  const link=rule(".nav-link");
  const label=rule(".nav-label");
  const rail=rule(".shell.is-collapsed .nav-link");
  const narrowLabel=rule(".shell.is-collapsed .nav-link .nav-label");
  assert.match(nav,/width:\s*100%/);
  assert.match(nav,/min-width:\s*0/);
  assert.match(stack,/width:\s*100%/);
  assert.match(stack,/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(link,/width:\s*100%/);
  assert.match(link,/min-width:\s*0/);
  assert.match(link,/max-width:\s*100%/);
  assert.match(link,/overflow:\s*hidden/);
  assert.match(link,/border-radius:\s*9px/);
  assert.match(label,/min-width:\s*0/);
  assert.match(label,/overflow:\s*hidden/);
  assert.match(rail,/padding:\s*9px 0 9px 15px/);
  assert.match(rail,/gap:\s*0/);
  assert.match(narrowLabel,/max-width:\s*0/);
  assert.match(narrowLabel,/max-width var\(--sidebar-layout-duration\)/);
  assert.match(css,/\.shell\.is-collapsed \.nav-link \.nav-icon \{width:\s*18px;\s*height:\s*18px;\}/);
  const railSize=rule(".shell.is-collapsed .sidebar");
  assert.match(railSize,/width:\s*74px/);
  // 74px rail minus gutters and 1px divider = 49px pill.
  assert.equal(74-12-12-1,49);
  // Mobile drawer must restore labels and spacing even with collapsed preference.
  const mobile=css.slice(css.indexOf("@media (max-width: 760px)"),
    css.indexOf("@media (max-width: 480px)"));
  assert.match(mobile,/\.shell\.is-collapsed \.nav-link \{[\s\S]*?padding:\s*9px 11px;[\s\S]*?gap:\s*11px/);
  assert.match(mobile,/\.shell\.is-collapsed \.nav-link \.nav-label \{max-width:\s*24ch;\}/);
});
test("mobile to compact sidebar slides from left; desktop expands only above xl",async()=>{
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  assert.match(css,/\.shell\.is-rail-entering \.sidebar \{[\s\S]*?sidebar-enter-from-left/);
  assert.match(css,/@keyframes sidebar-enter-from-left/);
  assert.match(css,/@keyframes main-follow-sidebar/);
  assert.match(css,/@media \(min-width: 761px\) and \(max-width: 1279px\)/);
  assert.match(css,/\.shell\.is-compact-rail \.sidebar-toggle \{display: none;\}/);
  const m=mockNavigation(),shell=m.elements["workspace-shell"];
  initWorkspaceNavigation(m.doc,m.win);
  assert.equal(shell.classList.contains("is-collapsed"),false);
  m.mobile(true);m.fire("resize");
  m.compact(true);m.mobile(false);m.fire("resize");
  assert.equal(shell.classList.contains("is-compact-rail"),true);
  assert.equal(shell.classList.contains("is-collapsed"),true);
  assert.equal(shell.classList.contains("is-rail-entering"),true);
  assert.equal(shell.classList.contains("is-sidebar-toggling"),false);
  assert.equal(m.elements["sidebar-toggle"].disabled,true);
  m.elements["sidebar-toggle"].dispatch("click"); // Collapsed rail toggle remains disabled.
  assert.equal(shell.classList.contains("is-collapsed"),true);
  m.elements["workspace-sidebar"].dispatch("click"); // Blank glass expands at tablet widths.
  assert.equal(shell.classList.contains("is-rail-expanded"),true);
  assert.equal(shell.classList.contains("is-collapsed"),false);
  assert.equal(m.elements["sidebar-toggle"].disabled,false);
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(shell.classList.contains("is-collapsed"),true);
  m.compact(false);m.fire("resize"); // >=1280
  assert.equal(shell.classList.contains("is-compact-rail"),false);
  assert.equal(shell.classList.contains("is-collapsed"),false);
  assert.equal(m.elements["sidebar-toggle"].disabled,false);
  assert.equal(shell.classList.contains("is-sidebar-toggling"),false,
    "Viewport-driven breakpoint changes never trigger sidebar motion");
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(shell.classList.contains("is-collapsed"),true);
  assert.equal(m.stored.get("dofinances.workspace.sidebar.collapsed"),"true");
  m.compact(true);m.fire("resize");
  m.compact(false);m.fire("resize");
  assert.equal(shell.classList.contains("is-collapsed"),false,
    "returning from compact rail to xl should expand automatically");
  assert.equal(m.stored.get("dofinances.workspace.sidebar.collapsed"),"false");
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(shell.classList.contains("is-collapsed"),true,
    "wide sidebar may still be manually collapsed");
});
test("header stays at 50px on mobile and desktop with account email constrained",async()=>{
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  const updated=await read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(css,/\.topbar-start \{[^}]*min-width:\s*0/);
  assert.match(css,/\.email \{[^}]*white-space:\s*nowrap/);
  assert.match(updated,/--workspace-header-height:50px/);
  assert.match(updated,/--global-menu-height:44px/);
  assert.match(updated,/\.topbar\{height:50px;min-height:50px/);
  assert.match(updated,/flex-wrap:nowrap;align-items:center/);
});
test("navigation is stationary except for the 170ms content-only arrival, without scroll jitter",async()=>{
  const css=await read("../sites/_apex/app/assets/workspace-theme.css");
  const head=css.match(/html\s*\{([^}]*)\}/)?.[1]||"";
  const view=css.match(/\.view\s*\{([^}]*)\}/)?.[1]||"";
  assert.match(head,/scroll-behavior:\s*auto/,"avoid smooth scroll on hash transitions");
  assert.match(head,/scrollbar-gutter:\s*stable/,"keep content width fixed across tall/short views");
  assert.match(view,/animation:\s*none/,"disable page-entry animation");
  assert.match(view,/transform:\s*none/,"remove translateY movement");
  assert.doesNotMatch(css,/@keyframes\s+ui-page-appear/);
  const arrivals=await read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(arrivals,/\.content > \.view:not\(\[hidden\]\)\{animation:workspace-content-arrive 170ms/);
  assert.match(css,/\.sidebar\s*\{[\s\S]*?transition:\s*width var\(--sidebar-layout-duration\)/,
    "sidebar width transition should remain available for user clicks");
  const m=mockNavigation();
  initWorkspaceNavigation(m.doc,m.win);
  assert.deepEqual(m.scrollCalls,[],"first render should not disturb restored scroll");
  m.win.location.hash="#projects";
  m.fire("hashchange");
  // The inner content scroller resets; forcing a window-level scroll
  // during navigation used to create extra synchronous main-thread work.
  assert.deepEqual(m.scrollCalls,[]);
  m.fire("hashchange");
  m.fire("popstate");
  assert.deepEqual(m.scrollCalls,[],"same route must do no redundant work");
  m.win.location.hash="#colosseum/settings";
  m.fire("hashchange");
  assert.deepEqual(m.scrollCalls,[]);
  m.win.location.hash="#settings";
  m.fire("hashchange");
  assert.deepEqual(m.scrollCalls,[]);
  assert.equal(m.elements["main-navigation"].hidden,false);
});
test("dashboard HTML provides every requested view and preserves existing authentication handlers",async()=>{
  const html=await read("../sites/_apex/app/index.html");
  for(const name of MAIN_ROUTES)assert.match(html,new RegExp('data-view="'+name+'"'));
  for(const name of COLOSSEUM_ROUTES.filter(name=>name!=="settings"))
    assert.match(html,new RegExp('data-view="colosseum/'+name+'"'));
  assert.equal((html.match(/class="view project-view"/g)||[]).length,COLOSSEUM_ROUTES.length-1+APPLE_HIG_ROUTES.length);
  assert.equal((html.match(/data-view="settings"/g)||[]).length,1,"Settings is shared across both scopes");
  assert.equal(html.includes('data-view="colosseum/settings"'),false);
  assert.match(html,/id="main-navigation"/);
  assert.match(html,/id="project-navigation"/);
  assert.match(html,/id="apple-hig-navigation"/);
  assert.match(html,/data-view="apple-hig-reader\/overview"/);
  assert.match(html,/<span class="count-label">2 projects<\/span>/);
  assert.match(html,/href="#apple-hig-reader\/overview"/);
  assert.match(html,/id="sidebar-toggle"/);
  assert.match(html,/id="mobile-nav-toggle"/);
  assert.match(html,/id="back-to-workspace"/);
  assert.match(html,/<a class="shadcn-breadcrumb-link" id="back-to-workspace" href="#projects"/);
  assert.match(html,/<nav class="shadcn-breadcrumbs" id="breadcrumb"/);
  assert.match(html,/href="#colosseum\/utilities"/);
  assert.match(html,/aria-label="Utilities"/);
  assert.match(html,/id="project-utilities-title">Utilities<\/h1>/);
  assert.match(html,/id="connect-cloudflare-owner" href="\/api\/colosseum\/connect"/);
  assert.match(html,/id="colosseum-owner-feedback"/);
  assert.doesNotMatch(html,/aria-label="Capabilities"/);
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
  assert.doesNotMatch(js,/remove\.title|add\.title|setAttribute\(["']title["']/,
    "Disabled account actions should convey their reason to assistive technology without hover tooltips");
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
    dispatch:(key,extra={})=>{for(const fn of listeners[key]||[])fn({key,type:key,preventDefault(){},...extra});},
    focus:()=>{}
  };
}
function mockNavigation(){
  const ids=["workspace-shell","workspace-sidebar","sidebar-toggle","mobile-nav-toggle",
    "sidebar-scrim","main-navigation","project-navigation","apple-hig-navigation",
    "breadcrumb","location-subtitle","back-to-workspace","sidebar-resize-handle"];
  const elements=Object.fromEntries(ids.map(id=>[id,element()]));
  const views=[...MAIN_ROUTES,...COLOSSEUM_ROUTES.filter(x=>x!=="settings").map(x=>"colosseum/"+x),...APPLE_HIG_ROUTES.map(x=>"apple-hig-reader/"+x)].map(name=>
    element({dataset:{view:name}}));
  const links=[...MAIN_ROUTES,...COLOSSEUM_ROUTES.map(x=>"colosseum/"+x),...APPLE_HIG_ROUTES.map(x=>"apple-hig-reader/"+x)].map(name=>
    element({href:"https://dofinances.com/app#"+name}));
  let mobile=false;
  let compactRail=false;
  const listeners={};
  const stored=new Map();
  const scrollCalls=[];
  const doc={title:"",getElementById:id=>elements[id],querySelectorAll:selector=>
    selector===".view[data-view]"?views:selector===".nav-link[data-route]"?links:[],
    addEventListener:(key,fn)=>{(listeners["doc:"+key]??=[]).push(fn);}};
  const win={location:{hash:"",search:""},localStorage:{
    getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
    matchMedia:query=>({matches:query.includes("(max-width: 760px)")?mobile:
      query.includes("(max-width: 1279px)")?compactRail:false}),
    scrollTo:(...args)=>{scrollCalls.push(args);},
    addEventListener:(key,fn)=>{(listeners[key]??=[]).push(fn);}};
  const fire=key=>(listeners[key]||[]).forEach(fn=>fn());
  return {doc,win,elements,views,links,fire,stored,scrollCalls,
    mobile:value=>{mobile=value;},compact:value=>{compactRail=value;}};
}
test("click selects route immediately, without awaiting the browser hashchange event",()=>{
  const m=mockNavigation();
  initWorkspaceNavigation(m.doc,m.win);
  const target=m.links.find(item=>item.href.endsWith("#colosseum/providers"));
  assert.equal(m.win.location.hash,"");
  target.dispatch("click");
  assert.equal(m.win.location.hash,"","Default anchor navigation has not occurred yet");
  assert.equal(target.getAttribute("aria-current"),"page");
  assert.equal(m.elements["project-navigation"].hidden,false);
  assert.equal(m.views.find(item=>item.dataset.view==="colosseum/providers").hidden,false);
  m.win.location.hash="#colosseum/providers";
  m.fire("hashchange");
  assert.equal(target.getAttribute("aria-current"),"page");
});

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
  assert.equal(m.views.find(x=>x.dataset.view==="settings").hidden,false);
  assert.equal(m.views.filter(x=>x.dataset.view==="settings").length,1);
  assert.equal(m.links.find(x=>x.href.endsWith("#colosseum/settings")).getAttribute("aria-current"),"page");
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(m.elements["workspace-shell"].classList.contains("is-collapsed"),true);
  assert.equal(m.stored.get("dofinances.workspace.sidebar.collapsed"),"true");
  assert.equal(m.elements["sidebar-toggle"].getAttribute("aria-expanded"),"false");
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(m.elements["workspace-shell"].classList.contains("is-collapsed"),false);
  assert.equal(m.stored.get("dofinances.workspace.sidebar.collapsed"),"false");
  assert.equal(m.elements["sidebar-toggle"].getAttribute("aria-expanded"),"true");
  m.elements["sidebar-toggle"].dispatch("click");
  assert.equal(m.elements["workspace-shell"].classList.contains("is-collapsed"),true);
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

test("grip drag collapses instantly past half the minimum, without pointer release",()=>{
  const m=mockNavigation();
  initWorkspaceNavigation(m.doc,m.win);
  const grip=m.elements["sidebar-resize-handle"];
  const shell=m.elements["workspace-shell"];
  const sidebar=m.elements["workspace-sidebar"];
  assert.equal(grip.getAttribute("aria-valuenow"),"260");
  grip.dispatch("pointerdown",{clientX:260,pointerId:1});
  grip.dispatch("pointermove",{clientX:400,pointerId:1});
  grip.dispatch("pointerup",{clientX:400,pointerId:1});
  assert.equal(grip.getAttribute("aria-valuenow"),"400");
  assert.equal(m.stored.get("dofinances.workspace.sidebar.width"),"400");
  grip.dispatch("pointerdown",{clientX:400,pointerId:2});
  grip.dispatch("pointermove",{clientX:125,pointerId:2});
  assert.equal(shell.classList.contains("is-collapsed"),false,
    "At more than half the minimum, the panel must remain expanded");
  grip.dispatch("pointermove",{clientX:123,pointerId:2});
  assert.equal(shell.classList.contains("is-collapsed"),true,
    "Collapse must occur on pointermove without waiting for pointerup");
  assert.equal(shell.classList.contains("is-sidebar-resizing"),false);
  assert.equal(m.stored.get("dofinances.workspace.sidebar.collapsed"),"true");
  assert.equal(m.stored.get("dofinances.workspace.sidebar.width"),"400");
  grip.dispatch("pointerup",{clientX:123,pointerId:2});
  assert.equal(shell.classList.contains("is-collapsed"),true,
    "Release after auto-collapse must be harmless");
  sidebar.dispatch("click");
  assert.equal(shell.classList.contains("is-collapsed"),false);
  assert.equal(grip.getAttribute("aria-valuenow"),"400");
});
test("hover wiring is registered before a drag and uses captured resize semantics",()=>{
  const m=mockNavigation();
  initWorkspaceNavigation(m.doc,m.win);
  const grip=m.elements["sidebar-resize-handle"];
  const shell=m.elements["workspace-shell"];
  const sidebar=m.elements["workspace-sidebar"];
  grip.dispatch("pointerenter",{clientX:250,clientY:230});
  assert.equal(shell.classList.contains("is-sidebar-resizing"),false);
  grip.dispatch("pointerdown",{clientX:250,clientY:230,pointerId:1});
  assert.equal(shell.classList.contains("is-sidebar-resizing"),true);
  grip.dispatch("pointerup",{clientX:250,clientY:230,pointerId:1});
  assert.equal(shell.classList.contains("is-sidebar-resizing"),false);
  m.elements["sidebar-toggle"].dispatch("click");
  sidebar.dispatch("pointerover");
  assert.equal(shell.classList.contains("is-collapsed"),true);
  sidebar.dispatch("click");
  assert.equal(shell.classList.contains("is-collapsed"),false);
});

test("Apple HIG Reader opens as an independent project without activating Colosseum navigation",()=>{
  const m=mockNavigation();
  initWorkspaceNavigation(m.doc,m.win);
  const target=m.links.find(x=>x.href.endsWith("#apple-hig-reader/overview"));
  target.dispatch("click");
  assert.equal(m.elements["main-navigation"].hidden,true);
  assert.equal(m.elements["project-navigation"].hidden,true);
  assert.equal(m.elements["apple-hig-navigation"].hidden,false);
  assert.equal(m.views.find(x=>x.dataset.view==="apple-hig-reader/overview").hidden,false);
  assert.equal(target.getAttribute("aria-current"),"page");
  assert.match(m.doc.title,/Apple HIG Reader · DoFinances/);
  m.win.location.hash="#colosseum/utilities";m.fire("hashchange");
  assert.equal(m.elements["project-navigation"].hidden,false);
  assert.equal(m.elements["apple-hig-navigation"].hidden,true);
});

test("Apple HIG Reader showcases its Google Apps Script API rather than presenting Apple documentation as the project",async()=>{
  for(const path of ["../sites/_apex/app/index.html","../studio/sidebar/index.html"]){
    const html=await read(path);
    const start=html.indexOf('<section class="view project-view" data-view="apple-hig-reader/overview"');
    const end=html.indexOf('<section class="view project-view" data-view="colosseum/utilities"',start);
    assert.ok(start>0 && end>start,"dedicated Apple HIG project view exists");
    const page=html.slice(start,end);
    assert.match(page,/<div class="page-heading"><h1 id="apple-hig-reader-title">Apple HIG Reader<\/h1><\/div>/,
      "existing native page-heading position must be unchanged");
    assert.match(page,/INDEPENDENT SOFTWARE PROJECT/);
    assert.match(page,/GOOGLE APPS SCRIPT/);
    assert.match(page,/A read-only API I built with Google Apps Script/);
    assert.match(page,/v1\.1\.0/);
    assert.match(page,/POST/);
    assert.match(page,/\/exec/);
    for(const capability of ["hig.list","hig.search","hig.read"])assert.ok(page.includes(capability),capability);
    for(const key of ["chunkSize","offset","Markdown","source links","image and video references"])
      assert.ok(page.includes(key),"API feature missing: "+key);
    assert.match(page,/Apple HIG \/ DocC[\s\S]*Google Apps Script[\s\S]*Colosseum MCP/);
    assert.match(page,/Illustrative contract, not a live API response/);
    assert.match(page,/live token-authenticated availability is not asserted here/);
    assert.doesNotMatch(page,/OFFICIAL DOCUMENTATION|Colosseum cloud reader<\/h2>/,
      "the project page must not revert to the earlier generic references layout");
    assert.match(html,/Apple HIG Reader<\/strong><span>Google Apps Script · Live documentation reader/);
  }
  const css=await read("../sites/_apex/app/assets/workspace-enhancements.css");
  assert.match(css,/\.hig-showcase-intro\{display:grid/);
  assert.match(css,/\.hig-operation\[open\]/);
  assert.match(css,/@media\(max-width:760px\)\{/);
  assert.doesNotMatch(css,/\.hig-project-panel/);
});
