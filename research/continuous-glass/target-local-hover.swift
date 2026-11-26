// Owned offscreen SwiftUI input experiment. No system pointer movement.
import AppKit
import Foundation
import SwiftUI
import QuartzCore
import Metal
import CryptoKit
@MainActor final class Events {
 static var enter=0,exit=0,move=0,click=0
 static var last=CGPoint.zero
}
struct TestView: View {
 let active:Bool
 let clear:Bool
 var body: some View {
  ZStack {
   Color(red:0.15,green:0.28,blue:0.37)
   HStack(spacing:0){Color.red;Color.blue}.frame(width:64,height:160).offset(x:20)
   Button(action:{Events.click+=1}){Color.clear.frame(width:108,height:76).contentShape(Rectangle())}
    .buttonStyle(.plain)
    .glassEffect((clear ? Glass.clear : Glass.regular).interactive(active),in:.rect(cornerRadius:12))
    .onHover{v in if v{Events.enter+=1}else{Events.exit+=1}}
    .onContinuousHover{phase in if case .active(let pt)=phase{Events.move+=1;Events.last=pt}}
  }.frame(width:160,height:120).preferredColorScheme(.dark)
 }
}
class LocalWindow:NSWindow{
 var testPoint=NSPoint(x:1,y:1)
 override var mouseLocationOutsideOfEventStream:NSPoint{testPoint}
 override var canBecomeKey:Bool{true}
 override var canBecomeMain:Bool{true}
 override var isKeyWindow:Bool{true}
 override var isMainWindow:Bool{true}
}
func allLayers(_ l:CALayer)->[CALayer]{[l]+(l.sublayers ?? []).flatMap(allLayers)}
func bits(_ v:Double)->String{String(format:"%016llx",v.bitPattern)}
func info(_ root:CALayer,presentation:Bool)->[String] {
 var entries:[String]=[]
 for (i,l) in allLayers(root).enumerated(){
  let t=presentation ? (l.presentation() ?? l):l
  let cls=NSStringFromClass(type(of:l)),name="\(i).\(cls)"
  entries.append(name+" "+[t.bounds.width,t.bounds.height,t.position.x,t.position.y,t.transform.m11,t.transform.m12,t.transform.m21,t.transform.m22,t.transform.m41,t.transform.m42,CGFloat(t.opacity)].map{bits(Double($0))}.joined(separator:","))
  for ff in (t.filters ?? []) {
   guard let f=ff as? NSObject else{continue}
   let type=(f.value(forKey:"type") as? String) ?? "nil"
   let keys=(f.value(forKey:"inputKeys") as? [String]) ?? []
   for k in keys.sorted(){
    let v=f.value(forKey:k)
    if let n=v as? NSNumber{entries.append("\(name).\(type).\(k)=\(bits(n.doubleValue))")}
    else if let a=v as? [NSNumber]{entries.append("\(name).\(type).\(k)="+a.map{bits($0.doubleValue)}.joined(separator:","))}
   }
  }
 }
 return entries
}
@MainActor func run(){
 let app=NSApplication.shared;app.setActivationPolicy(.prohibited)
 let active=CommandLine.arguments.contains("active"),clear=CommandLine.arguments.contains("clear")
 let bounds=NSRect(x:0,y:0,width:160,height:120)
 let win=LocalWindow(contentRect:bounds,styleMask:[.borderless],backing:.buffered,defer:false)
 win.isReleasedWhenClosed=false;win.appearance=NSAppearance(named:.darkAqua);win.acceptsMouseMovedEvents=true
 let host=NSHostingView(rootView:TestView(active:active,clear:clear));host.frame=bounds;host.wantsLayer=true;win.contentView=host
 win.setFrameOrigin(NSPoint(x:-2000,y:-2000));win.orderFront(nil)
 host.layoutSubtreeIfNeeded();host.displayIfNeeded();host.updateTrackingAreas();CATransaction.flush()
 RunLoop.current.run(until:Date().addingTimeInterval(0.2))
 let device=MTLCreateSystemDefaultDevice()!,d=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:160,height:120,mipmapped:false);d.storageMode = .shared;d.usage=[.renderTarget,.shaderRead]
 let texture=device.makeTexture(descriptor:d)!,renderer=CARenderer(mtlTexture:texture,options:nil)
 renderer.bounds=bounds;renderer.layer=host.layer
 func read()->String{
  var bytes=[UInt8](repeating:0,count:160*120*4)
  bytes.withUnsafeMutableBytes{texture.getBytes($0.baseAddress!,bytesPerRow:160*4,from:MTLRegionMake2D(0,0,160,120),mipmapLevel:0)}
  return SHA256.hash(data:Data(bytes)).map{String(format:"%02x",$0)}.joined()
 }
 func frame(_ tag:String){
  CATransaction.flush();RunLoop.current.run(until:Date().addingTimeInterval(0.3))
  var hashes=[String]()
  for _ in 0..<3{
   renderer.beginFrame(atTime:CACurrentMediaTime(),timeStamp:nil);renderer.addUpdate(bounds);renderer.render();renderer.endFrame()
   RunLoop.current.run(until:Date().addingTimeInterval(0.05));hashes.append(read())
  }
  let state=["model":info(host.layer!,presentation:false),"presentation":info(host.layer!,presentation:true)]
  let data=try! JSONSerialization.data(withJSONObject:state,options:[.sortedKeys])
  print("FRAME",tag,Events.enter,Events.exit,Events.move,Events.click,bits(Events.last.x),bits(Events.last.y),hashes.joined(separator:","))
  print("STATE",tag,String(data:data,encoding:.utf8)!)
 }
 func move(_ x:CGFloat,_ y:CGFloat,enter:Bool=false){
  let pt=NSPoint(x:x,y:y);win.testPoint=pt
  if enter {
   let e=NSEvent.enterExitEvent(with:.mouseEntered,location:pt,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:win.windowNumber,context:nil,eventNumber:1,trackingNumber:0,userData:nil)!
   host.mouseEntered(with:e)
  }
  let ev=NSEvent.mouseEvent(with:.mouseMoved,location:pt,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:win.windowNumber,context:nil,eventNumber:2,clickCount:0,pressure:0)!
  win.sendEvent(ev);host.mouseMoved(with:ev)
 }
 print("CONFIG",active,clear)
 frame("baseline");move(80,60,enter:true);frame("center");move(115,77);frame("edge");move(1,1);frame("outside")
 win.orderOut(nil);win.contentView=nil
}
MainActor.assumeIsolated{run()}
