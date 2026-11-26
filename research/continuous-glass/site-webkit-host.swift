// Isolated native WebKit host. No Safari preferences, user data, screenshots,
// account submission, or external monitor configuration are changed.
import AppKit
import WebKit

@MainActor final class Driver:NSObject,WKNavigationDelegate {
 var view:WKWebView!,window:NSWindow!,started=false
 let mode=ProcessInfo.processInfo.environment["LG_SITE_MODE"] ?? "continuous"
 let login=ProcessInfo.processInfo.environment["LG_REAL_LOGIN"] != nil
 func start(_ url:URL){
  let c=WKWebViewConfiguration()
  c.websiteDataStore = .nonPersistent()
  view=WKWebView(frame:NSRect(x:0,y:0,width:1400,height:836),configuration:c)
  window=NSWindow(contentRect:view.frame,styleMask:[.titled,.closable],backing:.buffered,defer:false)
  window.isReleasedWhenClosed=false;window.acceptsMouseMovedEvents=true;window.contentView=view;window.orderBack(nil)
  view.navigationDelegate=self;view.load(URLRequest(url:url))
 }
 func eval(_ js:String) async throws -> Any? {
  try await view.callAsyncJavaScript("return await ("+js+")",arguments:[:],in:nil,contentWorld:.page)
 }
 func log(_ name:String,_ value:Any?) {
  let obj:[String:Any]=["step":name,"value":value ?? NSNull()]
  if let bytes=try? JSONSerialization.data(withJSONObject:obj,options:[.sortedKeys]),let s=String(data:bytes,encoding:.utf8){print(s);fflush(stdout)}
 }
 func wait(_ predicate:String,_ name:String) async throws {
  let js="(async()=>{const end=performance.now()+8500;while(performance.now()<end){if("+predicate+")return true;await new Promise(r=>setTimeout(r,80));}return false;})()"
  if (try await eval(js) as? Bool) != true {
   log("failed-"+name,try? await eval("window.__dashboardWebGPU??null"))
   throw NSError(domain:"WebKit glass: "+name,code:1)
  }
 }
 let state="""
 (()=>{let a=window.__dashboardWebGPU,c=document.querySelector('#dashboard-webgpu-scene');return {status:a?.status,renderer:a?.glassRenderer,errors:a?.errors,route:window.__dofPublicRouter?.state,dpr:devicePixelRatio,viewport:[innerWidth,innerHeight],canvas:[c?.width,c?.height],resize:a?.resizeSubmissions??0,source:a?.sourceLattice,icons:a?.glassSilhouettes?.icons?.length??0,title:a?.projectTitleMask?.vectorOptics??false,composition:a?.sourceComposition?.completedLayers??[],reference:a?.routeCompositeLattice??null,eventCounts:window.__testResolution??null}})()
 """
 func moveNative(_ selector:String) async throws {
  guard let q=try await eval("(()=>{const r=document.querySelector("+String(data:try JSONSerialization.data(withJSONObject:[selector]),encoding:.utf8)!.dropFirst().dropLast()+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()") as? [Double],q.count==2 else {throw NSError(domain:"Missing pointer rect",code:2)}
  let x=q[0]*view.pageZoom,y=q[1]*view.pageZoom
  let p=view.convert(NSPoint(x:x,y:view.isFlipped ? y:view.bounds.height-y),to:nil)
  let event=NSEvent.mouseEvent(with:.mouseMoved,location:p,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:0,pressure:0)!
  view.mouseMoved(with:event)
 }
 func run() async throws {
  log("capability",try await eval("(async()=>{let a=navigator.gpu?await navigator.gpu.requestAdapter():null;return {gpu:!!a,f16:a?.features.has('shader-f16'),ua:navigator.userAgent}})()"))
  try await wait("window.__dashboardWebGPU?.status==='ready' || window.__dashboardWebGPU?.status==='fallback'","home-init")
  let initial=try await eval(state);log("home",initial)
  try await wait("window.__dashboardWebGPU?.status==='ready'","home-gpu")
  _=try await eval("""
  (()=>{window.__testResolution={media:0,resize:0};let q;const arm=()=>{q=matchMedia('(resolution: '+devicePixelRatio+'dppx)');q.addEventListener('change',()=>{window.__testResolution.media++;arm()},{once:true});};arm();addEventListener('resize',()=>window.__testResolution.resize++);return true})()
  """)
  if ProcessInfo.processInfo.environment["LG_WEBKIT_ZOOM"] != nil {
   for zoom in [1.25,0.8,1.0] {
    let before=try await eval("window.__dashboardWebGPU.resizeSubmissions??0") as? Int ?? 0
    view.pageZoom=zoom
    try await wait("window.__dashboardWebGPU?.status==='ready'&&window.__dashboardWebGPU.resizeSubmissions>"+String(before)+"&&document.querySelector('#dashboard-webgpu-scene').width===Math.floor(innerWidth*devicePixelRatio)","zoom-"+String(zoom))
    log("zoom-"+String(zoom),try await eval(state))
   }
  }
  _=try await eval("document.querySelector('[data-public-target=\"/projects\"]').click()")
  try await wait("window.__dofPublicRouter?.state==='projects'&&document.querySelectorAll('.project-showcase-card').length>=16&&window.__dashboardWebGPU?.glassSilhouettes?.icons?.length>0","projects")
  try await wait("document.querySelector('.public-projects-root.is-settled')","settle")
  log("projects",try await eval(state))
  if ProcessInfo.processInfo.environment["LG_WEBKIT_INTERACTION"] != nil {
   // Dispatch browser-native PointerEvent objects from isolated fixture JS.
   // This exercises production handlers, not OS pointer hardware.
   _=try await eval("""
   (()=>{const c=document.querySelector('.project-showcase-card'),r=c.getBoundingClientRect(),e={bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0};window.__lgTestPointer=e;c.dispatchEvent(new PointerEvent('pointermove',e));return true;})()
   """)
   if ProcessInfo.processInfo.environment["LG_WEBKIT_NATIVE_HOVER"] != nil {
    try await moveNative(".project-showcase-card")
    try await wait("document.querySelector('.project-showcase-card').matches(':hover')&&window.__dashboardWebGPU?.glassSilhouettes?.icons?.some(x=>x.hover>.95)","project-hover")
   } else {
    // An occluded accessory window does not activate CSS :hover even on
    // the baseline. Keep that failure separate from DOM route/press tests.
    log("project-pointer",try await eval("({cssHover:document.querySelector('.project-showcase-card').matches(':hover'),gpuReady:window.__dashboardWebGPU.status==='ready'})"))
   }
   _=try await eval("document.querySelector('.project-showcase-card').dispatchEvent(new PointerEvent('pointerdown',window.__lgTestPointer))")
   try await Task.sleep(for:.milliseconds(250))
   log("project-press",try await eval("({errors:window.__dashboardWebGPU.errors,hover:window.__dashboardWebGPU.glassSilhouettes.icons.map(x=>[x.slug,x.hover])})"))
   _=try await eval("document.querySelector('.project-showcase-card').dispatchEvent(new PointerEvent('pointerup',window.__lgTestPointer))")
   _=try await eval("document.querySelector('.project-showcase-card').click()")
   try await wait("document.querySelector('.project-showcase-card.is-expanded')","project-expanded")
   try await Task.sleep(for:.milliseconds(450))
   log("expanded",try await eval(state))
   _=try await eval("Array.from(document.querySelectorAll('.project-showcase-card')).find(c=>!c.hidden&&!c.classList.contains('is-expanded')&&c.getBoundingClientRect().width>10).click()")
   try await wait("!document.querySelector('.public-projects-root.is-project-retargeting')&&document.querySelector('.project-showcase-card.is-expanded')","project-retarget")
   log("retargeted",try await eval(state))
  }
  _=try await eval("document.querySelector('.public-projects-filter-button').click()")
  try await wait("document.querySelector('.public-projects-filter-button').getAttribute('aria-expanded')==='true'&&window.__dashboardWebGPU?.sourceComposition?.completedLayers?.length>0","filter")
  log("filter",try await eval(state))
  _=try await eval("document.querySelector('.public-projects-filter-option').click()")
  try await Task.sleep(for:.milliseconds(500))
  log("filtered",try await eval(state))
  _=try await eval("document.querySelector('.public-projects-filter-option').click(); document.querySelector('.public-projects-filter-button').click()".replacingOccurrences(of:"; ",with:", "))
  _=try await eval("document.querySelector('.public-projects-back').click()")
  try await wait("window.__dofPublicRouter?.state==='home'&&!document.querySelector('.public-projects-root')","returned-home")
  if login {
   _=try await eval("document.querySelector(\".cta6-bottom-action a[href='/login']\").click()")
   try await wait("location.pathname==='/login'&&document.querySelector('.auth3-root form')&&window.__dashboardWebGPU?.authGlass?.opacity>=.99","login")
   _=try await eval("""
   (()=>{const c=document.querySelector('[data-auth-glass-input]'),r=c.getBoundingClientRect(),e={bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0};window.__lgTestPointer=e;c.dispatchEvent(new PointerEvent('pointermove',e));return true;})()
   """)
   try await wait("window.__dashboardWebGPU?.authGlass?.cardHovered&&window.__dashboardWebGPU?.authGlass?.controlHovered","login-hover")
   _=try await eval("document.querySelector('[data-auth-glass-input]').dispatchEvent(new PointerEvent('pointerdown',window.__lgTestPointer))")
   try await wait("window.__dashboardWebGPU?.authGlass?.controlHover?.press>.9","login-press")
   log("login",try await eval("({status:window.__dashboardWebGPU.status,errors:window.__dashboardWebGPU.errors,mode:document.body.dataset.authGlassMode,scene:document.body.dataset.authGpuScene,hover:window.__dashboardWebGPU.authGlass.controlHover})"))
   _=try await eval("document.querySelector('[data-auth-glass-input]').dispatchEvent(new PointerEvent('pointerup',window.__lgTestPointer))")
   _=try await eval("document.querySelector('.auth3-back-link').click()")
   try await wait("window.__dofPublicRouter?.state==='home'&&!document.querySelector('.auth3-root')","login-return")
  }
  try await wait("window.__dashboardWebGPU?.status===\'ready\'&&window.__dashboardWebGPU.errors.length===0","final-gpu")
  log("complete",try await eval(state))
 }
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
  if started{return};started=true
  Task {do{try await run();window.close();exit(0)}catch{log("error",String(describing:error));window.close();exit(1)}}
 }
}
MainActor.assumeIsolated {
 let app=NSApplication.shared;app.setActivationPolicy(.accessory)
 let d=Driver();d.start(URL(string:CommandLine.arguments[1])!)
 DispatchQueue.main.asyncAfter(deadline:.now()+45){print("WebKit host timeout");exit(1)}
 withExtendedLifetime(d){app.run()}
}
