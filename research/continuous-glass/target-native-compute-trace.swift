// Owned, offscreen AppKit Glass output control; not a screenshot.
// Run one stimulus per independent process. BGRA8 output is not an internal blur resource.
import AppKit
import QuartzCore
import Metal
import CryptoKit
@_silgen_name("install_compute_trace") func install_compute_trace()
let args=CommandLine.arguments
guard args.count==4,let x=Int(args[1]),let width=Int(args[2]),["base","regular","clear"].contains(args[3]),x>=0,width>=0,x+width<=128 else{fatalError("usage: probe x width base|regular|clear")}
let style=args[3],w=128,h=96
let app=NSApplication.shared
app.setActivationPolicy(.prohibited)
let device=MTLCreateSystemDefaultDevice()!
install_compute_trace()
let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:w,height:h,mipmapped:false)
descriptor.usage=[.renderTarget,.shaderRead];descriptor.storageMode = .shared
let target=device.makeTexture(descriptor:descriptor)!
let bounds=CGRect(x:0,y:0,width:w,height:h)
let renderer=CARenderer(mtlTexture:target,options:nil)
renderer.bounds=bounds
let base=NSView(frame:bounds);base.wantsLayer=true
let root=base.layer!;root.bounds=bounds;root.position=CGPoint(x:w/2,y:h/2)
root.backgroundColor=CGColor(red:0.125,green:0.125,blue:0.125,alpha:1)
if width>0{
 let stripe=CALayer();stripe.frame=CGRect(x:x,y:0,width:width,height:h)
 stripe.backgroundColor=CGColor(red:0.875,green:0.875,blue:0.875,alpha:1)
 root.addSublayer(stripe)
}
let win=NSWindow(contentRect:bounds,styleMask:[.borderless],backing:.buffered,defer:false)
win.isReleasedWhenClosed=false;win.appearance=NSAppearance(named:.darkAqua);win.contentView=base
if style != "base"{
 let glass=NSGlassEffectView(frame:CGRect(x:10,y:10,width:108,height:76))
 glass.style=style=="regular" ? .regular:.clear
 glass.cornerRadius=12;glass.wantsLayer=true;base.addSubview(glass)
}
CATransaction.flush()
RunLoop.current.run(until:Date().addingTimeInterval(0.06))
renderer.layer=root
for i in 0..<5{
 renderer.beginFrame(atTime:CACurrentMediaTime()+Double(i)*0.03,timeStamp:nil)
 renderer.addUpdate(bounds);renderer.render();renderer.endFrame()
 RunLoop.current.run(until:Date().addingTimeInterval(0.04))
}
Thread.sleep(forTimeInterval:0.15)
var pixels=[UInt8](repeating:0,count:w*h*4)
pixels.withUnsafeMutableBytes{target.getBytes($0.baseAddress!,bytesPerRow:w*4,from:MTLRegionMake2D(0,0,w,h),mipmapLevel:0)}
func hex(_ a:[UInt8])->String{a.map{String(format:"%02x",$0)}.joined()}
let digest=hex(Array(SHA256.hash(data:Data(pixels))))
let row=Array(pixels[(48*w*4)..<(49*w*4)])
let alpha=(0..<(w*h)).filter{pixels[$0*4+3]==255}.count
var gray=0
for i in 0..<(w*h){let j=i*4;let b=pixels[j],g=pixels[j+1],r=pixels[j+2];if b==g && g==r{gray+=1}}
print("ROW",x,width,style,digest,alpha,gray,hex(row))
win.contentView=nil
