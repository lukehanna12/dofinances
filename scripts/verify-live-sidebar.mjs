/*
 * Browser-level smoke for the PUBLIC, static Studio preview.
 * Unlike source-regex tests, this checks the real computed cursor and
 * header geometry after the Cloudflare Pages deployment.
 * No account operations; Chrome's temporary profile is deleted.
 */
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {existsSync,readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const binaries=["google-chrome-stable","google-chrome","chromium","chromium-browser"];
let executable=null;
for(const name of binaries){
  try{executable=execFileSync("which",[name],{encoding:"utf8"}).trim();break;}catch{}
}
assert.ok(executable,"Chromium or Chrome is required to validate computed hover cursors");
const profile=mkdtempSync(join(tmpdir(),"dofinances-sidebar-check-"));
const chrome=spawn(executable,[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
  "--window-size=1000,860","--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let socket=null;
try{
  let port=null;
  for(let attempt=0;attempt<120;attempt++){
    if(existsSync(join(profile,"DevToolsActivePort"))){
      port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);
      break;
    }
    if(chrome.exitCode!==null)throw Error("Chrome exited before starting");
    await pause(100);
  }
  assert.ok(port,"Chrome DevTools did not become ready");
  const tab=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;
  const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(!message.id)return;
    const handlers=pending.get(message.id);
    if(!handlers)return;
    pending.delete(message.id);
    message.error?handlers.reject(new Error(JSON.stringify(message.error))):handlers.resolve(message.result);
  };
  const command=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;
    pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await command("Runtime.evaluate",{
      expression,returnByValue:true,awaitPromise:true
    });
    if(result.exceptionDetails)throw new Error("Page script failed: "+JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until=async(expression,label,limit=18000)=>{
    const start=Date.now();
    while(Date.now()-start<limit){
      try{const value=await evaluate(expression);if(value)return value;}catch{}
      await pause(130);
    }
    throw new Error("Timed out waiting for "+label);
  };
  const metrics=async(width,height)=>command("Emulation.setDeviceMetricsOverride",{
    width,height,deviceScaleFactor:1,mobile:false
  });
  // CDP does not infer the held-buttons bitmask from prior synthetic events.
  // Preserve left-button state across the move sequence, as a real drag does.
  let heldButtons=0;
  const move=async(x,y)=>command("Input.dispatchMouseEvent",{
    type:"mouseMoved",x,y,buttons:heldButtons
  });
  const down=async(x,y)=>{
    await command("Input.dispatchMouseEvent",{
      type:"mousePressed",x,y,button:"left",buttons:1,clickCount:1
    });
    heldButtons=1;
  };
  const up=async(x,y)=>{
    await command("Input.dispatchMouseEvent",{
      type:"mouseReleased",x,y,button:"left",buttons:0,clickCount:1
    });
    heldButtons=0;
  };

  await command("Runtime.enable");
  await command("Page.enable");
  await metrics(900,820);
  await command("Page.navigate",{url:"https://stu.dofinances.com/app/"});
  await until('document.readyState==="complete" && !!document.querySelector("#workspace-shell.liquid-glass-preview")',"Studio glass initialization",25000);
  await until('document.querySelector("#workspace-shell").classList.contains("is-compact-rail")',"responsive compact rail");

  // Thin mode must show one clock centered, not a row of top-level links.
  const compactTopbar=await evaluate(String.raw`(()=>{
    const clock=document.getElementById("global-clock");
    const rect=clock.getBoundingClientRect();
    const links=document.getElementById("global-menu-links");
    const account=document.querySelector(".global-menu-actions .global-menu-account");
    const actions=document.querySelector(".global-menu-actions");
    const actionRect=actions.getBoundingClientRect();
    return {clockX:rect.left+rect.width/2,viewport:document.documentElement.clientWidth,
      links:getComputedStyle(links).display,account:getComputedStyle(account).display,
      actionsRight:actionRect.right};
  })()`);
  assert.ok(Math.abs(compactTopbar.clockX-compactTopbar.viewport/2)<2,
    "Thin-mode clock must be centered independently of navigation: "+JSON.stringify(compactTopbar));
  assert.equal(compactTopbar.links,"none","Top-level links must hide in thin mode");
  assert.equal(compactTopbar.account,"none","Account button must hide in thin mode");
  assert.ok(compactTopbar.viewport-compactTopbar.actionsRight<50,
    "Search and Menu must anchor the right: "+JSON.stringify(compactTopbar));

  // Public Studio preview uses the same navigation and showcase markup as /app.
  // Check the actual route and responsive geometry, without invoking the private API.
  await evaluate('window.location.hash="#apple-hig-reader/overview";true');
  await until('document.querySelector(\'[data-view="apple-hig-reader/overview"]\')?.hidden===false',
    "Apple HIG Reader project route");
  const higPage=await evaluate(String.raw`(()=>{
    const view=document.querySelector('[data-view="apple-hig-reader/overview"]');
    const story=view.querySelector(".hig-showcase-story");
    const consoleCard=view.querySelector(".hig-showcase-console");
    const rect=consoleCard.getBoundingClientRect();
    return {heading:view.querySelector(".page-heading > h1")?.textContent,
      story:story?.textContent,consoleVisible:rect.width>200&&rect.height>200,
      viewWidth:document.documentElement.clientWidth,consoleLeft:rect.left,consoleRight:rect.right,
      colosseumNavHidden:document.getElementById("project-navigation").hidden,
      higNavVisible:!document.getElementById("apple-hig-navigation").hidden};
  })()`);
  assert.equal(higPage.heading,"Apple HIG Reader","native project title unchanged");
  assert.ok(higPage.story.includes("GOOGLE APPS SCRIPT"),"showcase must foreground the authored technology");
  assert.ok(higPage.consoleVisible,"API showcase console must render");
  assert.ok(higPage.consoleLeft>=0&&higPage.consoleRight<higPage.viewWidth+3,
    "showcase must fit the compact content area: "+JSON.stringify(higPage));
  assert.equal(higPage.colosseumNavHidden,true,"the separate project must not activate Colosseum sidebar");
  assert.equal(higPage.higNavVisible,true,"Apple HIG Reader sidebar context must activate");
  await evaluate('window.location.hash="#home";true');
  await until('document.querySelector(\'[data-view="home"]\')?.hidden===false',"Home route restored");

  // Live Studio visual geometry for 0001c8-inspired Providers, no credential calls.
  await evaluate('window.location.hash="#colosseum/providers";true');
  await until('document.querySelector(\'[data-view="colosseum/providers"]\')?.hidden===false',
    "Providers workspace route");
  const pvGeometry=await evaluate(String.raw`(()=>{
    const view=document.querySelector('[data-view="colosseum/providers"]');
    const index=view.querySelector(".pv-index").getBoundingClientRect();
    const detail=view.querySelector(".pv-inspector").getBoundingClientRect();
    const title=view.querySelector(".page-heading > h1");
    return {title:title?.textContent,outerWidth:document.documentElement.clientWidth,
      indexWidth:index.width,detailWidth:detail.width,indexRight:index.right,detailLeft:detail.left,
      detailRight:detail.right,projectNavigation:document.getElementById("project-navigation").hidden,
      providerCards:document.querySelectorAll("#pv-list .pv-provider-item").length,
      background:getComputedStyle(view.querySelector(".pv-browser")).display};
  })()`);
  assert.equal(pvGeometry.title,"Providers","Canonical Providers title remains intact");
  assert.equal(pvGeometry.projectNavigation,false,"Colosseum sidebar remains selected");
  assert.ok(pvGeometry.indexWidth>190&&pvGeometry.detailWidth>200,
    "Both selector and detail panes must be visible: "+JSON.stringify(pvGeometry));
  assert.ok(pvGeometry.indexRight<pvGeometry.detailLeft,
    "Provider list must precede detail pane on tablet: "+JSON.stringify(pvGeometry));
  assert.ok(pvGeometry.detailRight<=pvGeometry.outerWidth+3,
    "Provider content must not clip horizontally: "+JSON.stringify(pvGeometry));
  await evaluate('window.location.hash="#home";true');
  await until('document.querySelector(\'[data-view="home"]\')?.hidden===false',"Home restored after Providers");



  const blank=await evaluate(String.raw`(()=>{
    const sidebar=document.getElementById("workspace-sidebar");
    const r=sidebar.getBoundingClientRect();
    for(const dy of [210,260,320,400,500]){
      for(const dx of [20,37,55]){
        const x=r.left+dx,y=r.top+dy;
        if(y>=r.bottom-10)continue;
        const el=document.elementFromPoint(x,y);
        if(el && sidebar.contains(el) && !el.closest("a,button,input,[role=separator]"))
          return {x,y,cursor:getComputedStyle(el).cursor,tag:el.tagName};
      }
    }
    return null;
  })()`);
  assert.ok(blank,"No hit-testable unoccupied rail space found");
  assert.equal(blank.cursor,"e-resize","Empty collapsed rail must show the expand cursor");
  assert.equal(await evaluate('document.querySelectorAll("[title],.sidebar-interaction-tooltip").length'),0,
    "no native or custom tooltip should exist in the workspace");
  // The rail's icon and row should both center on the actual pane, not an
  // asymmetrically padded grid track.
  const railAlignment=await evaluate(String.raw`(()=>{
    const side=document.querySelector(".sidebar").getBoundingClientRect();
    const row=document.querySelector(".nav-link:not([hidden])");
    const r=row.getBoundingClientRect(),i=row.querySelector(".nav-icon").getBoundingClientRect();
    return {rowX:r.left+r.width/2,iconX:i.left+i.width/2,
      sidebarX:side.left+side.width/2,rowY:r.top+r.height/2,
      iconY:i.top+i.height/2};
  })()`);
  assert.ok(Math.abs(railAlignment.rowX-railAlignment.sidebarX)<2,
    "Collapsed nav button is not horizontally centered: "+JSON.stringify(railAlignment));
  assert.ok(Math.abs(railAlignment.iconX-railAlignment.rowX)<2,
    "Collapsed icon is not centered in its button: "+JSON.stringify(railAlignment));
  assert.ok(Math.abs(railAlignment.iconY-railAlignment.rowY)<2,
    "Collapsed icon is not vertically centered: "+JSON.stringify(railAlignment));
  // This specifically tests the user's observed regression: a hand cursor
  // should apply to a real link, then revert to the rail's right-arrow cursor
  // when the pointer returns to blank space after the click.
  const linkCenter=await evaluate(String.raw`(()=>{
    const link=document.querySelector('#main-navigation .nav-link[data-route="projects"]');
    const r=link.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  await move(linkCenter.x,linkCenter.y);
  const linkCursor=await evaluate(String.raw`(()=>{
    const p=document.elementFromPoint(0,0);
    return getComputedStyle(document.querySelector('#main-navigation .nav-link[data-route="projects"]')).cursor;
  })()`);
  assert.equal(linkCursor,"pointer","Real nav links should retain the hand cursor");
  await down(linkCenter.x,linkCenter.y);await up(linkCenter.x,linkCenter.y);
  await move(blank.x,blank.y);
  const afterLinkCursor=await evaluate(`getComputedStyle(document.elementFromPoint(${blank.x},${blank.y})).cursor`);
  assert.equal(afterLinkCursor,"e-resize",
    "After clicking a link, blank rail space must return to the expand cursor");
  assert.equal(await evaluate('document.querySelector(".sidebar-interaction-tooltip")'),null,
    "no custom expansion tooltip should be mounted");
  await down(blank.x,blank.y);await up(blank.x,blank.y);
  await until('document.querySelector("#workspace-shell").classList.contains("is-rail-expanded")',"click expansion");
  await until('!document.querySelector("#workspace-shell").classList.contains("is-sidebar-toggling")',"expanded header settle");
  await until('document.querySelector(".sidebar").getBoundingClientRect().width>=248 && !document.querySelector("#workspace-shell").classList.contains("is-collapsed")',
    "expanded pane becomes visible");
  // State and width thresholds can clear before the CSS transition reaches
  // its final pixel. Wait for the actual pane edge and fixed 28px sibling
  // target to coincide; do not loosen the strict geometry assertion.
  await until(String.raw`(()=>{
    const shell=document.getElementById("workspace-shell");
    const sidebar=document.querySelector(".sidebar");
    const grip=document.getElementById("sidebar-resize-handle");
    if(!shell||!sidebar||!grip||shell.classList.contains("is-sidebar-toggling"))return false;
    const targetWidth=Number.parseFloat(getComputedStyle(shell).getPropertyValue("--sidebar-expanded-width"));
    const s=sidebar.getBoundingClientRect(),g=grip.getBoundingClientRect();
    return Number.isFinite(targetWidth)&&
      Math.abs(s.width-targetWidth)<0.5&&
      Math.abs(g.width-28)<0.5&&
      Math.abs(g.left+g.width/2-s.right)<0.5;
  })()`, "settled sidebar width and aligned 28px resize target",4000);
  const header=await evaluate(String.raw`(()=>{
    const head=document.querySelector(".sidebar-head");
    const logo=document.querySelector(".sidebar-head .mark").getBoundingClientRect();
    const toggle=document.querySelector(".sidebar-head .sidebar-toggle").getBoundingClientRect();
    const grip=document.getElementById("sidebar-resize-handle");
    const g=grip.getBoundingClientRect(),s=document.querySelector(".sidebar").getBoundingClientRect();
    return {
      layout:getComputedStyle(head).display,
      logoRight:logo.right,toggleLeft:toggle.left,
      gripCursor:getComputedStyle(grip).cursor,
      gripDisplay:getComputedStyle(grip).display,
      gripCenter:g.left+g.width/2,gripY:g.top+Math.min(110,g.height/2),
      sidebarRight:s.right,sidebarHeight:s.height
    };
  })()`);
  assert.equal(header.layout,"grid","Expanded logo/toggle must use separate grid cells");
  assert.ok(header.toggleLeft-header.logoRight>=6,
    "D logo and expanded toggle overlap: "+JSON.stringify(header));
  assert.equal(header.gripCursor,"ew-resize","Visible grip must have two-way resize cursor");
  assert.notEqual(header.gripDisplay,"none","Resize grip should be visible in expanded compact rail");
  assert.ok(Math.abs(header.gripCenter-header.sidebarRight)<2,
    "The 28px hover target must straddle the actual sidebar edge: "+JSON.stringify(header));
  await move(header.gripCenter,header.gripY);
  assert.equal(await evaluate('document.querySelector(".sidebar-interaction-tooltip")'),null,
    "no custom resize tooltip should be mounted");
  const gripHit=await evaluate(String.raw`(()=>{
    const grip=document.getElementById("sidebar-resize-handle");
    const rect=grip.getBoundingClientRect(),x=rect.left+rect.width/2,
      y=rect.top+Math.min(110,rect.height/2);
    const hit=document.elementFromPoint(x,y);
    return {onTarget:hit===grip,hitTag:hit?.tagName,hitId:hit?.id,
      hitClass:hit?.className,gripPointerEvents:getComputedStyle(grip).pointerEvents,
      gripZIndex:getComputedStyle(grip).zIndex,
      topLayers:document.elementsFromPoint(x,y).slice(0,6).map(el=>el.id||el.className)};
  })()`);
  assert.ok(gripHit.onTarget,
    "The resize grip must receive pointer events at its visible center: "+JSON.stringify(gripHit));
  const startWidth=await evaluate('Math.round(document.querySelector(".sidebar").getBoundingClientRect().width)');
  await down(header.gripCenter,header.gripY);
  for(let step=1;step<=5;step++){
    await move(header.gripCenter+step*10,header.gripY);
    await pause(35);
  }
  await up(header.gripCenter+50,header.gripY);
  await until('Math.round(document.querySelector(".sidebar").getBoundingClientRect().width)>='+String(startWidth+40),"dragged width response");
  const linkGeometry=await evaluate(String.raw`(()=>{
    const shell=document.querySelector(".sidebar").getBoundingClientRect();
    return [...document.querySelectorAll(".sidebar-navigation .nav-link")]
      .filter(link=>link.getClientRects().length).map(link=>{
        const row=link.getBoundingClientRect();
        const icon=link.querySelector(".nav-icon").getBoundingClientRect();
        return {route:link.getAttribute("data-route"),
          rowX:row.left+row.width/2,sidebarX:shell.left+shell.width/2,
          iconY:icon.top+icon.height/2,rowY:row.top+row.height/2};
      });
  })()`);
  assert.ok(linkGeometry.length>=3,"No visible sidebar links");
  for(const item of linkGeometry){
    assert.ok(Math.abs(item.rowX-item.sidebarX)<2,
      "Row not centered in sidebar: "+JSON.stringify(item));
    assert.ok(Math.abs(item.iconY-item.rowY)<2,
      "Icon not vertically centered in its button: "+JSON.stringify(item));
  }
  const before=await evaluate('Math.round(document.querySelector(".sidebar").getBoundingClientRect().height)');
  await metrics(900,680);
  await until('Math.round(document.querySelector(".sidebar").getBoundingClientRect().height)<'+String(before-100),"vertical sidebar resizing");
  // The actual browser must scroll ONE root document: art and content move,
  // while the two headers and the sidebar remain anchored to the viewport.
  await evaluate('location.hash="#home";window.scrollTo(0,0);true');
  await until('!document.querySelector(\'[data-view="home"]\').hidden && document.scrollingElement.scrollHeight-document.scrollingElement.clientHeight>160',
    "Home document scroll range");
  const beforeScroll=await evaluate(String.raw`(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    return {page:document.scrollingElement.scrollTop,
      global:rect(".global-menu").top,topbar:rect(".topbar").top,
      sidebar:rect(".sidebar").top,main:rect("#main-content").top,
      background:getComputedStyle(document.body,"::before").position,
      footer:getComputedStyle(document.querySelector(".workspace-footer")).position,
      innerOverflow:getComputedStyle(document.getElementById("workspace-scroll")).overflowY};
  })()`);
  assert.equal(beforeScroll.background,"absolute","Wallpapers must follow document scroll");
  assert.equal(beforeScroll.footer,"relative","Footer must be normal flow, never a fixed fade");
  assert.equal(beforeScroll.innerOverflow,"visible","Do not create another independent content scroller");
  await evaluate('window.scrollTo(0,180);true');
  await until('document.scrollingElement.scrollTop>=150',"root document scroll");
  const afterScroll=await evaluate(String.raw`(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    return {page:document.scrollingElement.scrollTop,
      global:rect(".global-menu").top,topbar:rect(".topbar").top,
      sidebar:rect(".sidebar").top,main:rect("#main-content").top};
  })()`);
  const distance=afterScroll.page-beforeScroll.page;
  assert.ok(Math.abs((beforeScroll.main-afterScroll.main)-distance)<2,
    "Main content did not scroll with the document: "+JSON.stringify({beforeScroll,afterScroll}));
  for(const bar of ["global","topbar","sidebar"])
    assert.ok(Math.abs(afterScroll[bar]-beforeScroll[bar])<2,
      bar+" moved during page scroll: "+JSON.stringify({beforeScroll,afterScroll}));
  // Confirm the sticky lower bar itself paints the full-width frost ABOVE
  // page components, and the restored bottom photograph travels with the page.
  await evaluate('location.hash="#settings";window.scrollTo(0,0);true');
  await until('!document.querySelector(\'[data-view="settings"]\').hidden',"Settings route for header overlap");
  await evaluate('window.scrollTo(0,400);true');
  await until('document.scrollingElement.scrollTop>=150',"Settings header overlap scroll");
  // CSS viewport units exclude the reserved scrollbar gutter on this page.
  // Compare widths to the document's usable viewport, not window.innerWidth.
  const overlap=await evaluate(String.raw`(()=>{
    const bar=document.querySelector(".topbar");
    const rect=bar.getBoundingClientRect();
    const x=rect.right-35,y=rect.top+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    const frost=getComputedStyle(bar,"::before");
    return {headerZ:getComputedStyle(bar).zIndex,
      hitHeader:!!hit?.closest?.(".topbar"),
      frostPosition:frost.position,frostWidth:parseFloat(frost.width),
      frostFilter:frost.backdropFilter||frost.webkitBackdropFilter,
      viewportWidth:document.documentElement.clientWidth};
  })()`);
  assert.equal(overlap.hitHeader,true,
    "Scrolled page is layered above the sticky header: "+JSON.stringify(overlap));
  assert.ok(Number(overlap.headerZ)>=20,"Header must have higher z-order than content");
  assert.equal(overlap.frostPosition,"absolute","Frost must belong to sticky header");
  assert.ok(Math.abs(overlap.frostWidth-overlap.viewportWidth)<3,
    "Lower bar frost should span viewport width: "+JSON.stringify(overlap));
  assert.ok(overlap.frostFilter.includes("blur(18px)"),
    "Lower bar must actually blur scrolling text and cards: "+JSON.stringify(overlap));
  await evaluate('window.scrollTo(0,document.scrollingElement.scrollHeight);true');
  await until('Math.abs(document.querySelector(".workspace-footer").getBoundingClientRect().bottom-innerHeight)<4',
    "photo footer at the document bottom");
  const strip=await evaluate(String.raw`(()=>{
    const el=document.querySelector(".workspace-footer");
    const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
    return {top:rect.top,bottom:rect.bottom,width:rect.width,
      viewportWidth:document.documentElement.clientWidth,position:style.position,
      background:style.backgroundImage,opacity:style.opacity,
      transition:style.transitionProperty};
  })()`);
  assert.equal(strip.position,"relative","Bottom photo must move with document");
  assert.ok(Math.abs(strip.width-strip.viewportWidth)<3,
    "Bottom photo must span the viewport: "+JSON.stringify(strip));
  assert.ok(strip.background.includes("url("),"Bottom photo must use route wallpaper");
  assert.equal(strip.opacity,"1","Bottom photo must not fade in after reaching end");
  // Fixed desktop glass may overlap the photo footer; neither the top edge
  // nor the pane height may move as the grey document reaches its end.
  await evaluate('location.hash="#home";window.scrollTo(0,0);true');
  await until('!document.querySelector(\'[data-view="home"]\').hidden',"Home before footer overlap");
  const beforeFooter=await evaluate(String.raw`(()=>{
    const pane=document.querySelector(".sidebar").getBoundingClientRect();
    const main=document.querySelector(".main").getBoundingClientRect();
    const space=getComputedStyle(document.getElementById("workspace-shell"),"::before");
    return {top:pane.top,bottom:pane.bottom,height:pane.height,right:pane.right,
      mainLeft:main.left,spaceWidth:space.width,
      positioning:getComputedStyle(document.querySelector(".sidebar")).position};
  })()`);
  assert.equal(beforeFooter.positioning,"fixed","Desktop sidebar must be independent of shell end");
  assert.ok(Math.abs(beforeFooter.right-beforeFooter.mainLeft)<2,
    "Invisible spacer must exactly preserve main column geometry: "+JSON.stringify(beforeFooter));
  await evaluate('window.scrollTo(0,document.scrollingElement.scrollHeight);true');
  await until('Math.abs(document.querySelector(".workspace-footer").getBoundingClientRect().bottom-innerHeight)<4',
    "footer comes into view");
  const overFooter=await evaluate(String.raw`(()=>{
    const pane=document.querySelector(".sidebar");
    const p=pane.getBoundingClientRect();
    const f=document.querySelector(".workspace-footer").getBoundingClientRect();
    const y=Math.max(p.top+2,Math.min(p.bottom-3,f.top+10));
    const x=p.left+p.width/2;
    return {top:p.top,bottom:p.bottom,height:p.height,footerTop:f.top,
      overlap:p.bottom-f.top,topHit:document.elementFromPoint(x,y)?.closest(".sidebar")===pane};
  })()`);
  assert.ok(Math.abs(overFooter.top-beforeFooter.top)<1.5,
    "Sidebar must stay pinned over the footer: "+JSON.stringify({beforeFooter,overFooter}));
  assert.ok(Math.abs(overFooter.height-beforeFooter.height)<1.5,
    "Sidebar must keep its original height at the footer: "+JSON.stringify({beforeFooter,overFooter}));
  assert.ok(overFooter.overlap>5,
    "Sidebar should project beyond grey background over the scrolling footer: "+JSON.stringify(overFooter));
  assert.equal(overFooter.topHit,true,
    "Sidebar should visibly cover the footer, not be painted behind it");
  await evaluate('window.scrollTo(0,0);true');
  await until('Math.abs(document.querySelector(".sidebar").getBoundingClientRect().top-'+String(beforeFooter.top)+')<2',
    "sidebar remains pinned on reverse scroll");
  // Compare each page H1's line-box center with the actual D badge after
  // navigation settles. Reuse the desktop reference to verify mobile Y.
  let desktopTitleCenter=null;
  for(const width of [900,1280]){
    await metrics(width,680);
    await until('Math.abs(document.documentElement.clientWidth-'+String(width)+')<20',
      "responsive viewport settles for heading geometry");
    for(const route of ["projects","settings","colosseum/utilities","colosseum/collections",
      "colosseum/providers","colosseum/permissions","colosseum/diagnostics","colosseum/settings"]){
      await evaluate('location.hash="#'+route+'";window.scrollTo(0,0);true');
      const viewName=route==="colosseum/settings"?"settings":route;
      await until('!document.querySelector(\'[data-view="'+viewName+'"]\').hidden',
        "non-Home title route "+route);
      // A route can activate between animation frames. Wait for its actual
      // animation completion instead of measuring the initial translateY(4px).
      await until('document.querySelector(".content > .view:not([hidden])")?.getAnimations().every(a=>a.playState==="finished")',
        "non-Home title animation settles for "+route);
      const heading=await evaluate(String.raw`(()=>{
        const mark=document.querySelector(".sidebar .mark").getBoundingClientRect();
        const view=document.querySelector(".content > .view:not([hidden])");
        const h1=view.querySelector(".page-heading > h1").getBoundingClientRect();
        const subtitle=view.querySelector(".page-heading .lead");
        const content=document.getElementById("main-content").getBoundingClientRect();
        return {bubbleCenter:(mark.top+mark.bottom)/2,titleCenter:(h1.top+h1.bottom)/2,
          subtitleTop:subtitle?.getBoundingClientRect().top??null,contentTop:content.top,titleHeight:h1.height,
          scrollY:document.scrollingElement.scrollTop};
      })()`);
      assert.ok(Math.abs(heading.titleCenter-heading.bubbleCenter)<0.75,
        "Title isn't centered on the D bubble for "+route+" at "+width+": "+JSON.stringify(heading));
      if(desktopTitleCenter===null)desktopTitleCenter=heading.bubbleCenter;
      if(route.startsWith("colosseum/")&&route!=="colosseum/settings"){
        assert.equal(heading.subtitleTop,null,
          "Requested Colosseum page should not show a subtitle: "+route);
      }else{
        assert.ok(heading.subtitleTop>heading.titleCenter+45,
          "Unchanged subtitle moved upward for "+route+": "+JSON.stringify(heading));
      }
      assert.ok(heading.scrollY<1,"Title navigation should start at document top");
    }
  }
  // Home's H1 remains at its original position, below its taller banner.
  await evaluate('location.hash="#home";window.scrollTo(0,0);true');
  await until('!document.querySelector(\'[data-view="home"]\').hidden',"Home remains separate");
  const homeHeading=await evaluate(String.raw`(()=>{
    const title=document.getElementById("home-title").getBoundingClientRect();
    const bubble=document.querySelector(".sidebar .mark").getBoundingClientRect();
    return {titleTop:title.top,bubbleCenter:(bubble.top+bubble.bottom)/2};
  })()`);
  assert.ok(homeHeading.titleTop>homeHeading.bubbleCenter+100,
    "Home heading was incorrectly elevated: "+JSON.stringify(homeHeading));
  // Verify mobile drawer and desktop-tooltip suppression at small and breakpoint widths.
  for(const [mobileWidth,mobileHeight] of [[375,667],[390,740],[760,740]]){
    await metrics(mobileWidth,mobileHeight);
    await until('window.matchMedia("(max-width: 760px)").matches && document.getElementById("mobile-nav-toggle")?.getBoundingClientRect().width>0',
      "mobile breakpoint at "+mobileWidth);
    await evaluate('location.hash="#settings";window.scrollTo(0,0);true');
    await until('document.querySelector(".view[data-view=settings]")?.hidden===false',
      "mobile Settings view at "+mobileWidth);
    await until('document.querySelector(".content > .view:not([hidden])")?.getAnimations().every(a=>a.playState==="finished")',
      "mobile title arrival settles at "+mobileWidth);
    const mobileTitle=await evaluate(String.raw`(()=>{
      const view=document.querySelector(".content > .view:not([hidden])");
      const h1=view.querySelector(".page-heading > h1").getBoundingClientRect();
      const lead=view.querySelector(".page-heading > .lead").getBoundingClientRect();
      return {center:(h1.top+h1.bottom)/2,subtitleTop:lead.top,
        scrollY:document.scrollingElement.scrollTop,
        titleFont:getComputedStyle(view.querySelector(".page-heading > h1")).fontSize};
    })()`);
    assert.ok(Math.abs(mobileTitle.center-desktopTitleCenter)<1,
      "Mobile Settings title reverted from the desktop D-bubble Y: "+JSON.stringify({mobileWidth,desktopTitleCenter,mobileTitle}));
    assert.ok(mobileTitle.subtitleTop>mobileTitle.center+45,
      "Mobile subtitle should remain in its original flow position: "+JSON.stringify(mobileTitle));
    assert.ok(mobileTitle.scrollY<1,"Mobile route starts at the top");
    const beforeDrawer=await evaluate(String.raw`(()=>{
      const bar=document.querySelector(".topbar").getBoundingClientRect();
      return {barBottom:bar.bottom,pageHeight:document.scrollingElement.scrollHeight,
        tooltipCount:document.querySelectorAll(".sidebar-interaction-tooltip").length,
        nativeTitleCount:document.querySelectorAll("[title]").length};
    })()`);
    assert.equal(beforeDrawer.tooltipCount,0,"no custom tooltip in mobile document");
    assert.equal(beforeDrawer.nativeTitleCount,0,"no native title attributes in mobile document");
    const mobileButton=await evaluate(String.raw`(()=>{
      const r=document.getElementById("mobile-nav-toggle").getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2};
    })()`);
    await down(mobileButton.x,mobileButton.y);await up(mobileButton.x,mobileButton.y);
    await until('document.querySelector("#workspace-shell").classList.contains("is-mobile-open")',
      "drawer opened at "+mobileWidth);
    await until('!document.querySelector("#workspace-shell").classList.contains("is-drawer-toggling")',
      "drawer transition finished at "+mobileWidth);
    const openDrawer=await evaluate(String.raw`(()=>{
      const pane=document.querySelector(".sidebar"),r=pane.getBoundingClientRect();
      const bar=document.querySelector(".topbar").getBoundingClientRect();
      const probe=document.elementFromPoint(24,(bar.top+bar.bottom)/2);
      return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,width:r.width,
        viewportHeight:innerHeight,barBottom:bar.bottom,
        headerHit:!!probe?.closest?.(".topbar"),
        panePosition:getComputedStyle(pane).position,
        tooltipCount:document.querySelectorAll(".sidebar-interaction-tooltip").length,
        pageHeight:document.scrollingElement.scrollHeight};
    })()`);
    assert.equal(openDrawer.panePosition,"fixed");
    assert.ok(openDrawer.top>=openDrawer.barBottom+7,
      "mobile pane extends behind lower bar: "+JSON.stringify(openDrawer));
    assert.ok(openDrawer.bottom<=openDrawer.viewportHeight-6,
      "mobile pane extends below viewport: "+JSON.stringify(openDrawer));
    assert.ok(Math.abs(openDrawer.height-(openDrawer.bottom-openDrawer.top))<1);
    assert.equal(openDrawer.headerHit,true,"lower bar no longer hit-testable");
    assert.equal(openDrawer.tooltipCount,0,"opening mobile drawer must not create a tooltip");
    assert.equal(openDrawer.pageHeight,beforeDrawer.pageHeight,
      "drawer opening introduced unwanted page height");
    await evaluate('window.scrollTo(0,180);true');
    const afterScroll=await evaluate(String.raw`(()=>{
      const r=document.querySelector(".sidebar").getBoundingClientRect();
      return {top:r.top,bottom:r.bottom};
    })()`);
    assert.ok(Math.abs(afterScroll.top-openDrawer.top)<1.5,
      "drawer moved with page scroll: "+JSON.stringify({openDrawer,afterScroll}));
    await down(mobileButton.x,mobileButton.y);await up(mobileButton.x,mobileButton.y);
    await until('!document.querySelector("#workspace-shell").classList.contains("is-mobile-open")',
      "drawer closes at "+mobileWidth);
    await evaluate('window.scrollTo(0,0);true');
  }
  await metrics(900,820);
  await until('document.querySelector("#workspace-shell").classList.contains("is-compact-rail")',
    "desktop rail restored");
  console.log("PASS: mobile drawer clears both bars, retains viewport height and has no tooltips");

  console.log("PASS: non-Home titles aligned to D-bubble Y; five Colosseum subtitles absent, other subtitles and Home unchanged");

  console.log("PASS: fixed-height sidebar overlaps bottom photo strip without moving or shrinking");

  console.log("PASS: in-flow lower photo strip and lower bar frost above scrolling content");

  console.log("PASS: single document scroll, moving wallpaper and content, fixed bars/sidebar, in-flow footer");

  console.log("PASS: rail expansion and resize cursors, no tooltips, no D/toggle overlap, and drag resizing");
} finally {
  try{socket?.close();}catch{}
  chrome.kill("SIGKILL");
  await pause(300);
  try{rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:200});}
  catch(error){console.warn("Temporary Chrome profile cleanup:",String(error));}
}
