import {portableTitleAlpha,prepareTitleWord} from "/site/dashboard-glass-title-geometry.js";
import {rasterClockText} from "/site/dashboard-glass-text.js";
export async function run(){
 const asset=await(await fetch("/site/continuous-portable-word.json")).json(),out=[];
 for(const size of [51.75,60.625,63,69.75])for(const dpr of [1,2,3]){
  const style={fontStyle:"normal",fontWeight:"550",fontSize:size+"px",fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',letterSpacing:(-.035*size)+"px",lineHeight:(1.12*size)+"px",direction:"ltr",fontKerning:"auto"};
  const ctx=document.createElement("canvas").getContext("2d");ctx.font=style.fontWeight+" "+style.fontSize+" "+style.fontFamily;ctx.letterSpacing=style.letterSpacing;
  const w=Math.ceil(ctx.measureText(asset.text).width*dpr),h=Math.ceil(size*1.12*dpr),r=portableTitleAlpha(asset,asset.text,style,w,h,dpr),f=prepareTitleWord(asset,asset.text,style,w,h,dpr),old=rasterClockText(asset.text,style,w,h,dpr),dv=new DataView(old.pixels.buffer);
  if(!r||!f||!old)throw Error("Missing portable title field");
  let sum=0,area=0,inter=0,union=0;for(let i=0;i<r.alpha.length;i++){const a=dv.getFloat16(i*8+6,true),b=r.alpha[i]/255;sum+=Math.abs(a-b);area+=a;inter+=Math.min(a,b);union+=Math.max(a,b);}
  out.push({size,dpr,curves:f.curves.length/12,relativeAlphaDifference:sum/area,alphaIoU:inter/union});
 }
 return {out,scope:"Portable wordmark design comparison, not optical native evidence or equivalence."};
}
