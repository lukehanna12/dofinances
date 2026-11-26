import {readFileSync,readdirSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {parseIconSVG} from "./svg-ingestion.mjs";
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,"../.."),bin=process.argv[2],out=process.argv[3];
if(!bin||!out)throw Error("Usage: node build-vector-assets.mjs <compiled helper> <output dir>");
mkdirSync(out,{recursive:true});
const catalog=readFileSync(join(root,"sites/_apex/assets/public-projects-catalog.js"),"utf8");
const block=catalog.split("export const PROJECT_CARD_ICONS=Object.freeze({")[1].split("});")[0];
const names=[...block.matchAll(/"[^"]+":\s*"([^"]+)"/g)].map(m=>m[1]);
if(names.length!==16)throw Error("Unexpected project count");
const invoke=(mode,data)=>{
 const r=spawnSync(bin,[mode],{input:JSON.stringify(data),encoding:"utf8",maxBuffer:32*1024*1024});
 if(r.status!==0)throw Error(r.stderr||"vector helper failed");return JSON.parse(r.stdout);
};
const stats=[];
for(const name of names){
 const xml=readFileSync(join(root,"sites/_apex/assets/project-icons",name+".svg"),"utf8");
 const parsed=parseIconSVG(xml,{arcTolerance:.0001}),a=invoke("svg",parsed),b=invoke("svg",parsed);
 if(JSON.stringify(a)!==JSON.stringify(b)||!a.contours.length)throw Error("Unstable or empty "+name);
 for(const c of a.contours){if(!c.length||JSON.stringify(c[0][0])!==JSON.stringify(c.at(-1).at(-1)))throw Error("Open contour "+name);}
 writeFileSync(join(out,name+".json"),JSON.stringify(a));
 stats.push({name,operations:parsed.ops.length,contours:a.contours.length,segments:a.contours.reduce((s,c)=>s+c.length,0)});
}
const text=[];
for(const value of ["Liquid Glass","AV fi","A\u0301","مرحبا"]){
 const a=invoke("text",{text:value,postscript:"HelveticaNeue",size:24}),b=invoke("text",{text:value,postscript:"HelveticaNeue",size:24});
 if(JSON.stringify(a)!==JSON.stringify(b)||!a.contours.length)throw Error("Unstable or empty shaped text");
 text.push({value,runs:a.runs.map(r=>({font:r.font,glyphs:r.glyphs.length})),contours:a.contours.length,segments:a.contours.reduce((s,c)=>s+c.length,0)});
}
console.log(JSON.stringify({icons:stats,text},null,2));
