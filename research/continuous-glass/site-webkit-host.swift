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
  window.isReleasedWhenClosed=false;window.contentView=view;window.orderBack(nil)
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
   log("login",try await eval("({status:window.__dashboardWebGPU.status,errors:window.__dashboardWebGPU.errors,mode:document.body.dataset.authGlassMode,scene:document.body.dataset.authGpuScene})"))
   _=try await eval("document.querySelector('.auth3-back-link').click()")
   try await wait("window.__dofPublicRouter?.state==='home'&&!document.querySelector('.auth3-root')","login-return")
  }
  log("complete",try await eval(state))
 }
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
  if started{return};started=true
  Task {do{try await run();window.close();exit(0)}catch{log("error",String(describing:error));window.close();exit(1)}}
 }
}
let app=NSApplication.shared;app.setActivationPolicy(.accessory)
let d=Driver();d.start(URL(string:CommandLine.arguments[1])!)
DispatchQueue.main.asyncAfter(deadline:.now()+45){print("WebKit host timeout");exit(1)}
app.run()
