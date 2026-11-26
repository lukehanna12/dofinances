// Build static vector control points, never a raster mask.
// Run on the reference Mac with the existing CoreGraphics outline helper.
import {readFileSync,writeFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {prepareVectorPath} from "./vector-field.mjs";
const [dir,output]=process.argv.slice(2);
if(!dir||!output)throw Error("usage: pack-site-vectors.mjs outlines output.json");
const data=[],assets={};
for(const name of readdirSync(dir).filter(x=>x.endsWith(".json")).sort()){
 const a=JSON.parse(readFileSync(join(dir,name),"utf8"));
 const model=prepareVectorPath(a.contours,{tolerance:.003});
 const [x,y,w,h]=a.viewBox;
 const count=model.curves.length/12,start=data.length/12;
 if(count>1024||w!==h)throw Error("Unsupported current icon "+name);
 const stem=name.slice(0,-5);
 const svg=readFileSync(new URL("../../sites/_apex/assets/project-icons/"+stem+".svg",import.meta.url));
 // Each row: normalized cubic points and degree. Header metadata stays in JSON.
 assets[stem]={start,count,origin:model.origin,scale:model.scale,viewBox:a.viewBox,sourceSha256:createHash("sha256").update(svg).digest("hex")};
 data.push(...model.curves);
}
if(Object.keys(assets).length!==16)throw Error("Expected all sixteen site icons");
const bytes=Buffer.alloc(data.length*4);data.forEach((v,i)=>bytes.writeFloatLE(v,i*4));
writeFileSync(output,JSON.stringify({schema:"dofinances-vector-controls-v1",assets,curveCount:data.length/12,curves:bytes.toString("base64")})+"\n");
console.log(JSON.stringify({assets:Object.keys(assets).length,curveCount:data.length/12,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}));
