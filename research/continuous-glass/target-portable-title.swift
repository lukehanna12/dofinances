import Foundation
import CoreText
import CoreGraphics
// Input is the freely licensed, hash-pinned Inter font obtained by the caller.
// Output is a single fixed word graphic, not a font file or reusable glyph set.
let url=URL(fileURLWithPath:CommandLine.arguments[1])
guard CTFontManagerRegisterFontsForURL(url as CFURL,.process,nil) else{fatalError("register")}
let descriptors=CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as! [CTFontDescriptor]
let size=63.0
var d=descriptors[0]
d=CTFontDescriptorCreateCopyWithVariation(d,NSNumber(value:0x77676874),550)
d=CTFontDescriptorCreateCopyWithVariation(d,NSNumber(value:0x6f70737a),32)
let font=CTFontCreateWithFontDescriptor(d,CGFloat(size),nil)
let text="Projects",attrs:[NSAttributedString.Key:Any]=[.init(kCTFontAttributeName as String):font,.init(kCTKernAttributeName as String):-0.035*size]
let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:attrs))
var result:CGPath?=nil
for run in CTLineGetGlyphRuns(line) as! [CTRun] {
 let n=CTRunGetGlyphCount(run);var gs=[CGGlyph](repeating:0,count:n),ps=[CGPoint](repeating:.zero,count:n)
 CTRunGetGlyphs(run,CFRange(location:0,length:0),&gs);CTRunGetPositions(run,CFRange(location:0,length:0),&ps)
 for i in 0..<n {
  var transform=CGAffineTransform(a:1,b:0,c:0,d:-1,tx:ps[i].x,ty:-ps[i].y)
  guard let path=CTFontCreatePathForGlyph(font,gs[i],&transform) else{fatalError("path")}
  let p=path.normalized(using:.winding);result=result.map{$0.union(p,using:.winding)} ?? p
 }
}
var contours=[[[Int]]](),cur=[[Int]]()
func close(){if !cur.isEmpty{cur.append([4]);contours.append(cur);cur=[]}}
func p(_ v:CGPoint)->[Int]{[Int((v.x/size*65536).rounded()),Int((v.y/size*65536).rounded())]}
result!.applyWithBlock{ptr in let e=ptr.pointee
 switch e.type{
 case .moveToPoint:close();cur=[[0]+p(e.points[0])]
 case .addLineToPoint:cur.append([1]+p(e.points[0]))
 case .addQuadCurveToPoint:cur.append([2]+p(e.points[0])+p(e.points[1]))
 case .addCurveToPoint:cur.append([3]+p(e.points[0])+p(e.points[1])+p(e.points[2]))
 case .closeSubpath:close()
 @unknown default:fatalError("unknown path")
 }
}
close()
var a:CGFloat=0,b:CGFloat=0,c:CGFloat=0
let w=CTLineGetTypographicBounds(line,&a,&b,&c)
let out:[String:Any]=["schema":"dofinances-portable-projects-word-v1","text":text,"source":"Inter (OFL), Google Fonts font blob 047c92f6e2212473dc436020afed689527076d44","size":size,"font":CTFontCopyPostScriptName(font) as String,"metrics":[w/size,Double(a)/size,Double(b)/size],"units":65536,"commands":contours]
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:out,options:[.sortedKeys]))
