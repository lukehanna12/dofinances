import AppKit
import Metal
import QuartzCore
import CryptoKit

// Owned offscreen CARenderer target. Not a display or screenshot experiment.
let app=NSApplication.shared
app.setActivationPolicy(.prohibited)
let dev=MTLCreateSystemDefaultDevice()!
let W=128,H=96
let points:[(Int,Int)]=[(4,4),(20,48),(32,48),(48,48),(56,48),(64,48),(72,48),(96,48),(112,48),(124,92)]
func sha(_ b:[UInt8])->String{SHA256.hash(data:Data(b)).map{String(format:"%02x",$0)}.joined()}
func sample(_ b:[UInt8],_ s:Int)->String{
 points.map{ x,y in let i=((y*s+s/2)*W*s+x*s+s/2)*4;return b[i..<i+4].map{String(format:"%02x",$0)}.joined() }.joined(separator:",")
}
func frame(_ base:CALayer,_ density:Int)->[UInt8] {
 let d=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:W*density,height:H*density,mipmapped:false)
 d.usage=[.renderTarget,.shaderRead];d.storageMode = .shared
 let tex=dev.makeTexture(descriptor:d)!
 let renderer=CARenderer(mtlTexture:tex,options:nil)
 renderer.bounds=CGRect(x:0,y:0,width:W,height:H);renderer.layer=base
 for i in 0..<5 {renderer.beginFrame(atTime:CACurrentMediaTime()+Double(i)*0.03,timeStamp:nil);renderer.addUpdate(renderer.bounds);renderer.render();renderer.endFrame();RunLoop.current.run(until:Date().addingTimeInterval(0.035))}
 Thread.sleep(forTimeInterval:0.15)
 var b=[UInt8](repeating:0,count:W*H*density*density*4)
 b.withUnsafeMutableBytes{tex.getBytes($0.baseAddress!,bytesPerRow:W*density*4,from:MTLRegionMake2D(0,0,W*density,H*density),mipmapLevel:0)}
 return b
}
for density in [1,2,3] {
 let bounds=NSRect(x:0,y:0,width:W,height:H),base=NSView(frame:bounds)
 base.wantsLayer=true;base.layer!.bounds=bounds;base.layer!.position=CGPoint(x:W/2,y:H/2);base.layer!.contentsScale=CGFloat(density)
 base.layer!.backgroundColor=CGColor(red:0.5,green:0.5,blue:0.5,alpha:1)
 for i in 0..<16{
  let stripe=CALayer();stripe.frame=CGRect(x:i*8,y:0,width:8,height:H);stripe.contentsScale=CGFloat(density)
  let v:CGFloat=i%2==0 ? 0.125:0.875
  stripe.backgroundColor=CGColor(red:v,green:v,blue:v,alpha:1);base.layer!.addSublayer(stripe)
 }
 let window=NSWindow(contentRect:bounds,styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.contentView=base
 CATransaction.flush();RunLoop.current.run(until:Date().addingTimeInterval(0.12))
 let baseline=frame(base.layer!,density)
 print("BASE",density,sha(baseline),sample(baseline,density),baseline.filter{$0 != 0}.count)
 let glass=NSGlassEffectView(frame:NSRect(x:10,y:10,width:100,height:75));glass.wantsLayer=true;glass.cornerRadius=12;base.addSubview(glass)
 for style in [NSGlassEffectView.Style.regular,.clear]{
  CATransaction.begin();CATransaction.setDisableActions(true);glass.style=style;glass.layer?.contentsScale=CGFloat(density);CATransaction.commit();CATransaction.flush()
  RunLoop.current.run(until:Date().addingTimeInterval(0.16))
  let b=frame(base.layer!,density)
  print("GLASS",density,style == .regular ? "regular":"clear",sha(b),sample(b,density),b.filter{$0 != 0}.count)
 }
 window.contentView=nil
}
