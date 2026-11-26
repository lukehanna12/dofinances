import Foundation
import Metal
let dev=MTLCreateSystemDefaultDevice()!,queue=dev.makeCommandQueue()!
func bytes(_ vals:[UInt16])->String{ vals.map{String(format:"%02x%02x",$0&255,$0>>8)}.joined() }
for (w,h,variant) in [(4,4,0),(5,3,0),(7,5,0),(1,7,0),(8,6,0),(9,7,1),(3,5,1),(5,1,1),(11,3,1)] {
 let d=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.rgba16Float,width:w,height:h,mipmapped:true)
 d.storageMode = .shared;d.usage=[.shaderRead,.shaderWrite]
 let tex=dev.makeTexture(descriptor:d)!
 var input=[UInt16]()
 for y in 0..<h {for x in 0..<w {
  let a=Float16(x+2*y)/32
  let b:Float16=(x==w-1 && y==h-1) ? 1:0
  let c=Float16((x*x+3*y*y+2*x*y)%31)/32
  let vals:[Float16]=variant==0 ? [a,b,c,0.375] : [Float16(x-2*y)/32,-b,Float16((7*x*x+5*y*y+3*x*y)%63-31)/32,-0.375]
  input += vals.map{$0.bitPattern}
 }}
 input.withUnsafeBytes{tex.replace(region:MTLRegionMake2D(0,0,w,h),mipmapLevel:0,withBytes:$0.baseAddress!,bytesPerRow:w*8)}
 let command=queue.makeCommandBuffer()!,blit=command.makeBlitCommandEncoder()!
 blit.generateMipmaps(for:tex);blit.endEncoding();command.commit();command.waitUntilCompleted()
 guard command.status == .completed else {fatalError("GPU failure")}
 print("INPUT "+String(w)+" "+String(h)+" "+String(variant)+" "+bytes(input))
 for i in 1..<tex.mipmapLevelCount {
  let a=max(1,w>>i),b=max(1,h>>i);var out=[UInt16](repeating:0,count:a*b*4)
  out.withUnsafeMutableBytes{tex.getBytes($0.baseAddress!,bytesPerRow:a*8,from:MTLRegionMake2D(0,0,a,b),mipmapLevel:i)}
  print("MIP "+[w,h,variant,i,a,b].map{String($0)}.joined(separator:" ")+" "+bytes(out))
 }
}
