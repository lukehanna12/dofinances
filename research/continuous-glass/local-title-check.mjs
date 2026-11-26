// Compare local continuous contour with a separately generated native word
// outline on the reference Mac. Never export that native outline.
import {localTitleContours,contourDeviation} from "/site/dashboard-glass-local-title.js";
import {prepareTitleWord} from "/site/dashboard-glass-title-geometry.js";
import {rasterClockText} from "/site/dashboard-glass-text.js";
function flatten(s,err=.003){
 if(s.length===2)return [s];
 const [a,b]=[s[0],s.at(-1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
 const error=Math.max(...s.slice(1,-1).map(p=>len?Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/len:Math.hypot(p[0]-a[0],p[1]-a[1])));
 if(error<=err)return [[a,b]];
 let row=s.slice(),l=[a],r=[b];while(row.length>1){row=row.slice(1).map((q,i)=>[(q[0]+row[i][0])/2,(q[1]+row[i][1])/2]);l.push(row[0]);r.push(row.at(-1));}
 return [...flatten(l,err),...flatten(r.reverse(),err)];
}
export async function run(){
 const native=await(await fetch("/title-outline")).json(),result=[];
 for(const size of [51.75,54.375,60.625,63,66.25,69.75]){
  const style={fontStyle:"normal",fontWeight:"550",fontSize:size+"px",fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',letterSpacing:(-.035*size)+"px",lineHeight:(1.02*size)+"px",direction:"ltr",fontKerning:"auto"};
  const ctx=document.createElement("canvas").getContext("2d");ctx.font=style.fontWeight+" "+style.fontSize+" "+style.fontFamily;ctx.letterSpacing=style.letterSpacing;
  const w=Math.ceil(ctx.measureText(native.text).width),h=parseFloat(style.lineHeight),local=localTitleContours(native.text,style,h),ref=prepareTitleWord(native,native.text,style,w,h,1);
  if(!local||!ref)throw Error("Unavailable local or native reference "+size);
  const reference=ref.contours.map(c=>c.flatMap(s=>flatten(s))),deviation=Math.max(contourDeviation(reference,local.contours),contourDeviation(local.contours,reference));
  const coverage=[];
  for(const dpr of [1,2,3]){
   const W=Math.ceil(ctx.measureText(native.text).width*dpr),H=Math.ceil(h*dpr),old=rasterClockText(native.text,style,W,H,dpr),dv=new DataView(old.pixels.buffer);
   const canvas=new OffscreenCanvas(W,H),c=canvas.getContext("2d",{willReadFrequently:true}),path=new Path2D();
   for(const seg of local.contours){path.moveTo(...seg[0][0]);for(const s of seg)path.lineTo(...s[1]);path.closePath();}
   c.scale(dpr,dpr);c.fill(path,"evenodd");const a=c.getImageData(0,0,W,H).data;let total=0,area=0;
   for(let i=0;i<W*H;i++){const x=dv.getFloat16(i*8+6,true);total+=Math.abs(x-a[i*4+3]/255);area+=x;}
   coverage.push({dpr,relativeAlphaDifference:total/area});
  }
  result.push({size,segments:local.segments,convergence:local.deviation,nativeBoundaryDeviation:deviation,buildMs:local.buildMs,coverage});
 }
 return {result,scope:"Sampled bidirectional edge diagnostics against reference-local CoreText word geometry. Final production coverage remains actual browser alpha."};
}
