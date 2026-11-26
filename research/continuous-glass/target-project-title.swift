// Reference-platform word-specific title outline experiment.
// Never exports a font file, full font tables or unrelated glyphs.
import Foundation
import CoreText
import CoreGraphics
let text="Projects"
let unionBoundary=CommandLine.arguments.contains("--union")
let f=CTFontCreateUIFontForLanguage(.system,63,nil)!
func table(_ s:String)->Data{CTFontCopyTable(f,s.utf8.reduce(UInt32(0)){$0<<8|UInt32($1)},[])! as Data}
func u16(_ d:Data,_ i:Int)->Int{Int(d[i])*256+Int(d[i+1])}
func u32(_ d:Data,_ i:Int)->Int{u16(d,i)*65536+u16(d,i+2)}
func fixed(_ d:Data,_ i:Int)->Double{Double(Int16(bitPattern:UInt16(u16(d,i))))/16384}
let utf=Array(text.utf16)
var glyphs=[CGGlyph](repeating:0,count:utf.count)
CTFontGetGlyphsForCharacters(f,utf,&glyphs,utf.count)
let g=table("gvar"),axis=u16(g,4),shared=u32(g,8),data=u32(g,16),wide=(u16(g,14)&1) != 0
func offset(_ i:Int)->Int{wide ? u32(g,20+i*4):u16(g,20+i*2)*2}
var knots=Set<Double>([0,1]),tuples=0
for glyph in glyphs{
 let p=data+offset(Int(glyph)),end=data+offset(Int(glyph)+1)
 if p==end{continue}
 var at=p+4
 for _ in 0..<(u16(g,p)&0xfff){
  let flag=u16(g,at+2);at+=4
  let peak:Int
  if flag&0x8000 != 0{peak=at;at+=axis*2}else{peak=shared+(flag&0xfff)*axis*2}
  knots.insert(fixed(g,peak+2))
  if flag&0x4000 != 0{knots.insert(fixed(g,at+2));knots.insert(fixed(g,at+axis*2+2));at+=axis*4}
  tuples+=1
 }
}
let h=table("HVAR"),store=u32(h,4),regions=store+u32(h,store+2),axes=u16(h,regions),num=u16(h,regions+2)
for r in 0..<num{for j in 0..<3{knots.insert(fixed(h,regions+4+(r*axes+1)*6+j*2))}}
let sizes=knots.filter{$0>=0&&$0<=1}.sorted().map{28+68*$0}
guard sizes == [28,96] else{fatalError("Unexpected optical knot partition")}
// avar 1.0: verify the positive optical axis interval is identity.
let avar=table("avar")
var avarOffset=8
for i in 0..<axis{
 let n=u16(avar,avarOffset);avarOffset+=2
 for _ in 0..<n{
  let x=fixed(avar,avarOffset),y=fixed(avar,avarOffset+2);avarOffset+=4
  if i==1 && x>=0 && x != y {fatalError("Nonidentity positive optical avar")}
 }
}
func contours(_ path:CGPath,_ size:Double)->[[[[Double]]]]{
 var out=[[[[Double]]]](),cur=[[[Double]]](),start=[Double](),p=[Double]()
 func coord(_ a:CGPoint)->[Double]{[Double(a.x)/size,-Double(a.y)/size]}
 func finish(){if !cur.isEmpty{if p != start{cur.append([p,start])};out.append(cur)};cur=[]}
 path.applyWithBlock{ptr in
  let e=ptr.pointee
  switch e.type{
  case .moveToPoint:finish();start=coord(e.points[0]);p=start
  case .addLineToPoint:let q=coord(e.points[0]);if p != q{cur.append([p,q])};p=q
  case .addQuadCurveToPoint:let q=coord(e.points[1]);cur.append([p,coord(e.points[0]),q]);p=q
  case .addCurveToPoint:let q=coord(e.points[2]);cur.append([p,coord(e.points[0]),coord(e.points[1]),q]);p=q
  case .closeSubpath:finish();p=start
  @unknown default:fatalError("unknown path")
  }
 }
 finish();return out
}
func shape(_ size:Double)->[String:Any]{
 let sys=CTFontCreateUIFontForLanguage(.system,CGFloat(size),nil)!
 var d=CTFontCopyFontDescriptor(sys)
 d=CTFontDescriptorCreateCopyWithVariation(d,NSNumber(value:0x77676874),550)
 d=CTFontDescriptorCreateCopyWithVariation(d,NSNumber(value:0x6f70737a),CGFloat(size))
 let font=CTFontCreateWithFontDescriptor(d,CGFloat(size),nil)
 let attr:[NSAttributedString.Key:Any]=[.init(kCTFontAttributeName as String):font,.init(kCTKernAttributeName as String):-0.035*size]
 let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:attr))
 var paths=[[[[[Double]]]]](),positions=[Double](),ids=[Int]()
 for run in CTLineGetGlyphRuns(line) as! [CTRun]{
  let n=CTRunGetGlyphCount(run);var gs=[CGGlyph](repeating:0,count:n),ps=[CGPoint](repeating:.zero,count:n)
  CTRunGetGlyphs(run,CFRange(location:0,length:0),&gs);CTRunGetPositions(run,CFRange(location:0,length:0),&ps)
  for i in 0..<n {
   ids.append(Int(gs[i]));positions.append(Double(ps[i].x)/size)
   guard let p=CTFontCreatePathForGlyph(font,gs[i],nil) else{fatalError("Missing title glyph")}
   // CoreText may return overlapping component subpaths. Only the actual
   // boundary of their filled union is a valid signed-distance reference.
   paths.append(contours(unionBoundary ? p.normalized(using:.winding):p,size))
  }
 }
 var asc:CGFloat=0,desc:CGFloat=0,lead:CGFloat=0
 let w=CTLineGetTypographicBounds(line,&asc,&desc,&lead)
 return ["size":size,"font":CTFontCopyPostScriptName(font) as String,"ids":ids,"positions":positions,"paths":paths,"metrics":[w/size,Double(asc)/size,Double(desc)/size]]
}
let selected=[51.75,69.75],hold=[52.125,54.375,57.5,60.625,63,66.25,68.875]
let out:[String:Any]=["text":text,"unionBoundary":unionBoundary,"gvarTuples":tuples,"hvarRegions":num,"opticalKnots":sizes,"samples":selected.map(shape),"heldout":hold.map(shape)]
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:out,options:[.sortedKeys]))
