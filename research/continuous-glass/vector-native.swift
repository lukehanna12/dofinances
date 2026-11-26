import Foundation
import CoreGraphics
import CoreText
struct Subpath:Decodable {let start:[Double];let segments:[[[Double]]];let closed:Bool}
struct Op:Decodable {let subpaths:[Subpath];let fill:Bool;let stroke:Bool;let width:Double;let cap:String;let join:String;let miter:Double;let rule:String}
struct Input:Decodable {let viewBox:[Double];let ops:[Op];let arcTolerance:Double}
struct FontInput:Decodable {let text:String;let postscript:String;let size:Double}
func pt(_ a:[Double])->CGPoint {CGPoint(x:a[0],y:a[1])}
func build(_ sub:[Subpath],close:Bool)->CGPath{
 let p=CGMutablePath()
 for s in sub {
  p.move(to:pt(s.start))
  for a in s.segments {
   switch a.count{
    case 2:p.addLine(to:pt(a[1]))
    case 3:p.addQuadCurve(to:pt(a[2]),control:pt(a[1]))
    case 4:p.addCurve(to:pt(a[3]),control1:pt(a[1]),control2:pt(a[2]))
    default:fatalError("invalid curve")
   }
  }
  if close||s.closed{p.closeSubpath()}
 }
 return p
}
func extract(_ path:CGPath)->[[[[Double]]]]{
 var out=[[[[Double]]]](),cur=[[[Double]]](),start=[Double](),p=[Double]()
 func coords(_ a:CGPoint)->[Double]{[Double(a.x),Double(a.y)]}
 func finish(){if !cur.isEmpty{if p != start{cur.append([p,start])};out.append(cur)};cur=[]}
 path.applyWithBlock {ptr in
  let e=ptr.pointee
  switch e.type{
  case .moveToPoint:finish();start=coords(e.points[0]);p=start
  case .addLineToPoint:let q=coords(e.points[0]);if p != q{cur.append([p,q])};p=q
  case .addQuadCurveToPoint:let q=coords(e.points[1]);cur.append([p,coords(e.points[0]),q]);p=q
  case .addCurveToPoint:let q=coords(e.points[2]);cur.append([p,coords(e.points[0]),coords(e.points[1]),q]);p=q
  case .closeSubpath:finish();p=start
  @unknown default:fatalError("unknown path element")
  }
 }
 finish();return out
}
func makeIcon(_ v:Input)->CGPath{
 var result:CGPath?=nil
 func include(_ p:CGPath,_ rule:CGPathFillRule){
  let n=p.normalized(using:rule)
  result=result.map{$0.union(n,using:.winding)} ?? n
 }
 for op in v.ops {
  if op.fill{include(build(op.subpaths,close:true),op.rule=="evenodd" ? .evenOdd:.winding)}
  if op.stroke {
   let cap:CGLineCap=op.cap=="round" ? .round:op.cap=="square" ? .square:.butt
   let join:CGLineJoin=op.join=="round" ? .round:op.join=="bevel" ? .bevel:.miter
   let p=build(op.subpaths,close:false).copy(strokingWithWidth:op.width,lineCap:cap,lineJoin:join,miterLimit:op.miter)
   include(p,.winding)
  }
 }
 return result ?? CGMutablePath()
}
func makeText(_ v:FontInput)->(CGPath,[[String:Any]]){
 let font=CTFontCreateWithName(v.postscript as CFString,v.size,nil)
 let attrs=[NSAttributedString.Key(kCTFontAttributeName as String):font]
 let line=CTLineCreateWithAttributedString(NSAttributedString(string:v.text,attributes:attrs))
 var result:CGPath?=nil,info=[[String:Any]]()
 for run in CTLineGetGlyphRuns(line) as! [CTRun]{
  let a=CTRunGetAttributes(run) as NSDictionary
  let f=a[kCTFontAttributeName] as! CTFont
  let n=CTRunGetGlyphCount(run)
  var glyphs=[CGGlyph](repeating:0,count:n),pos=[CGPoint](repeating:.zero,count:n)
  CTRunGetGlyphs(run,CFRange(location:0,length:0),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:0),&pos)
  for i in 0..<n{
   var t=CGAffineTransform(translationX:pos[i].x,y:pos[i].y)
   if let p=CTFontCreatePathForGlyph(f,glyphs[i],&t){
    let q=p.normalized(using:.winding);result=result.map{$0.union(q,using:.winding)} ?? q
   }
  }
  info.append(["font":CTFontCopyPostScriptName(f) as String,"glyphs":glyphs.map{Int($0)},"positions":pos.map{[Double($0.x),Double($0.y)]}])
 }
 return(result ?? CGMutablePath(),info)
}
let mode=CommandLine.arguments[1],raw=FileHandle.standardInput.readDataToEndOfFile()
var out:[String:Any]
if mode=="svg"{
 let data=try JSONDecoder().decode(Input.self,from:raw)
 let path=makeIcon(data)
 out=["contours":extract(path),"viewBox":data.viewBox,"arcTolerance":data.arcTolerance]
}else if mode=="text"{
 let data=try JSONDecoder().decode(FontInput.self,from:raw)
 let (path,runs)=makeText(data);out=["contours":extract(path),"runs":runs]
}else{fatalError("unknown mode")}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:out,options:[.sortedKeys]))
