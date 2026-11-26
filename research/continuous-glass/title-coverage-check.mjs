// Verify actual browser glyph metrics and authored outline coverage, not display pixels.
export async function run(){
 const v=await(await fetch("/title-outline")).json(),[a,b]=v.samples,result=[];
 const lerp=(a,b,t)=>Array.isArray(a)?a.map((x,i)=>lerp(x,b[i],t)):a+(b-a)*t;
 for(const size of [51.75,54.375,60.625,63,66.25,69.75]){
  const dpr=2,c=new OffscreenCanvas(1,1),ctx=c.getContext("2d",{willReadFrequently:true}),font="550 "+size+"px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const setup=c=>{c.font=font;c.letterSpacing=(-.035*size)+"px";c.textBaseline="alphabetic";c.textAlign="left";};
  setup(ctx);const m=ctx.measureText(v.text),width=Math.ceil(m.width*dpr),height=Math.ceil(size*1.12*dpr);
  const base=(height/dpr-m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)*.5+m.fontBoundingBoxAscent;
  const t=(size-a.size)/(b.size-a.size),paths=lerp(a.paths,b.paths,t),native=lerp(a.positions,b.positions,t).map(x=>x*size);
  const browser=[...v.text].map((ch,i)=>ctx.measureText(v.text.slice(0,i+1)).width-ctx.measureText(ch).width);
  const compare=(positions)=>{
   const x=new OffscreenCanvas(width,height),y=new OffscreenCanvas(width,height),xc=x.getContext("2d",{willReadFrequently:true}),yc=y.getContext("2d",{willReadFrequently:true});setup(xc);xc.scale(dpr,dpr);xc.fillText(v.text,0,base);
   yc.scale(dpr,dpr);const path=new Path2D();
   paths.forEach((glyph,i)=>{const map=p=>[positions[i]+p[0]*size,base+p[1]*size];for(const contour of glyph){path.moveTo(...map(contour[0][0]));for(const s of contour){const q=s.slice(1).flatMap(map);if(s.length===2)path.lineTo(...q);else if(s.length===3)path.quadraticCurveTo(...q);else path.bezierCurveTo(...q);}path.closePath();}});
   yc.fill(path);const aa=xc.getImageData(0,0,width,height).data,bb=yc.getImageData(0,0,width,height).data;
   let sum=0,area=0,union=0,disagree=0;for(let i=3;i<aa.length;i+=4){sum+=Math.abs(aa[i]-bb[i]);area+=aa[i];union+=Math.max(aa[i],bb[i]);disagree+=+((aa[i]>=128)!==(bb[i]>=128));}
   return {relativeAlphaError:sum/area,unionAlphaError:sum/union,membershipDifferences:disagree,pixels:width*height};
  };
  result.push({size,width,height,metrics:[m.width,m.fontBoundingBoxAscent,m.fontBoundingBoxDescent],maxPositionDifference:Math.max(...native.map((x,i)=>Math.abs(x-browser[i]))),native:compare(native),browser:compare(browser)});
 }
 return {result};
}
