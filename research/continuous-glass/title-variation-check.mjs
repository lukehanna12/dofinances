import {readFileSync,writeFileSync} from "node:fs";
const [file,out]=process.argv.slice(2),v=JSON.parse(readFileSync(file,"utf8")), [a,b]=v.samples;
const lerp=(x,y,t)=>Array.isArray(x)?(x.length===y.length?x.map((q,i)=>lerp(q,y[i],t)):(()=>{throw Error("Topology changed")})()):x+(y-x)*t;
let maxControl=0,maxPosition=0,maxMetric=0,n=0;
for(const r of v.heldout){
 if(JSON.stringify(r.ids)!==JSON.stringify(a.ids)||JSON.stringify(a.ids)!==JSON.stringify(b.ids))throw Error("Shaping changed");
 const t=(r.size-a.size)/(b.size-a.size),p=lerp(a.paths,b.paths,t),pos=lerp(a.positions,b.positions,t),m=lerp(a.metrics,b.metrics,t);
 const x=p.flat(Infinity),y=r.paths.flat(Infinity);if(x.length!==y.length)throw Error("Point count changed");
 for(let i=0;i<x.length;i++){maxControl=Math.max(maxControl,Math.abs(x[i]-y[i])*r.size);n++;}
 for(let i=0;i<pos.length;i++)maxPosition=Math.max(maxPosition,Math.abs(pos[i]-r.positions[i])*r.size);
 for(let i=0;i<m.length;i++)maxMetric=Math.max(maxMetric,Math.abs(m[i]-r.metrics[i])*r.size);
}
console.log(JSON.stringify({glyphs:a.ids.length,knots:v.opticalKnots,tuples:v.gvarTuples,regions:v.hvarRegions,heldout:v.heldout.length,coordinates:n,maxControlCSSPx:maxControl,maxPositionCSSPx:maxPosition,maxMetricCSSPx:maxMetric}));
if(maxControl>.08||maxPosition>.15||maxMetric>.15)throw Error("Variation model exceeds finite error budget");
if(out)writeFileSync(out,JSON.stringify({schema:"dofinances-projects-word-outline-v1",text:v.text,scope:"Reference macOS SF system font, word-specific authored title geometry only; no font file",opticalKnots:v.opticalKnots,samples:v.samples})+"\n");
