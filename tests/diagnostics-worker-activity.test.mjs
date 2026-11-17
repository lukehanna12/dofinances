import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read=name=>readFileSync(new URL("../sites/_apex/app/assets/"+name,import.meta.url),"utf8");
const js=read("diagnostics.js"),css=read("diagnostics.css");
const source=js.replace("export function initColosseumDiagnostics","function initColosseumDiagnostics");
const element=tag=>({
 tag,className:"",textContent:"",children:[],attributes:{},dataset:{},title:"",
 style:{values:{},setProperty(k,v){this.values[k]=v}},
 append(...els){this.children.push(...els)},replaceChildren(...els){this.children=els},
 setAttribute(k,v){this.attributes[k]=v}
});
function render(by_worker,status="healthy"){
 const host=element("div");
 const document={createElement:element,getElementById:id=>id==="dg-workers"?host:null};
 const fn=runInNewContext(source+"\nrenderWorkers",{document,Intl});
 fn({sections:{workers:{status,by_worker}}});
 return host;
}
const sections=host=>({
 usage:host.children[0],legend:host.children[1],comparison:host.children[2]
});
const row=(host,n)=>sections(host).usage.children[n];
const header=usageRow=>usageRow.children[0];
const track=usageRow=>usageRow.children[1];
const legendItems=host=>sections(host).legend.children;
const charts=host=>sections(host).comparison.children;
const columns=chart=>chart.children[1].children[0].children;
const height=column=>Number.parseFloat(column.style.values["--dg-cpu-height"]);
const pct=segment=>Number.parseFloat(segment.style.values["--dg-worker-share"]);
const color=el=>el.style.values["--dg-worker-color"];
const sample={
 alpha:{requests:100,subrequests:40,cpu_time_p90_us:5000,cpu_time_p99_us:9000},
 beta:{requests:30,subrequests:5,cpu_time_p90_us:1000,cpu_time_p99_us:20000},
 gamma:{requests:20,subrequests:55,cpu_time_p90_us:2000,cpu_time_p99_us:5000},
 delta:{requests:50,subrequests:0,cpu_time_p90_us:0,cpu_time_p99_us:10000}
};
test("Two full-width Worker usage bars replace the table, with period totals and correct titles",()=>{
 const host=render(sample),{usage,legend,comparison}=sections(host);
 assert.equal(host.children.length,3,"Usage bars, one legend, two charts—no footnote");
 assert.equal(usage.className,"dg-activity-usage");
 assert.equal(usage.children.length,2);
 assert.equal(header(row(host,0)).children[0].textContent,"Request Usage");
 assert.equal(header(row(host,1)).children[0].textContent,"Subrequest Usage");
 assert.equal(header(row(host,0)).children[1].textContent,"200 requests");
 assert.equal(header(row(host,1)).children[1].textContent,"100 subrequests");
 assert.equal(track(row(host,0)).className,"dg-usage-track");
 assert.equal(track(row(host,1)).className,"dg-usage-track");
 assert.equal(legend.className,"dg-activity-legend");
 assert.equal(comparison.className,"dg-cpu-comparison");
 assert.ok(!js.includes('"Errors"')&&!js.includes("Bars are relative to the busiest Worker."));
 assert.ok(!css.includes(".dg-worker-table"));
 assert.match(css,/#diagnostics-root \.dg-usage-track\{[^}]*display:flex;width:100%;height:34px/);
});
test("Each stacked bar is a true composition of Worker shares for its own metric",()=>{
 const host=render(sample);
 const requests=track(row(host,0)).children,subrequests=track(row(host,1)).children;
 assert.equal(requests.length,4);
 assert.equal(subrequests.length,3,"Workers with zero subrequests have no colored segment");
 assert.deepEqual(Array.from(requests,s=>s.dataset.worker),["alpha","beta","delta","gamma"]);
 assert.deepEqual(Array.from(subrequests,s=>s.dataset.worker),["alpha","beta","gamma"]);
 assert.deepEqual(Array.from(requests,pct),[50,15,25,10]);
 assert.deepEqual(Array.from(subrequests,pct),[40,5,55]);
 assert.equal(requests.reduce((sum,s)=>sum+pct(s),0),100);
 assert.equal(subrequests.reduce((sum,s)=>sum+pct(s),0),100);
 assert.match(track(row(host,0)).attributes["aria-label"],/200 reported across 4 workers/);
 assert.match(track(row(host,1)).attributes["aria-label"],/100 reported across 4 workers/);
 assert.match(requests[0].title,/alpha.*100 requests/);
});
test("The ONE centered legend spans both bars and controls colors in both CPU charts",()=>{
 const host=render(sample),items=legendItems(host),[p90,p99]=charts(host);
 assert.equal(items.length,4);
 assert.deepEqual(Array.from(items,k=>k.children[1].textContent),["alpha","beta","delta","gamma"]);
 const expected=["#eb534e","#f09748","#f8d849","#68ce67"];
 assert.deepEqual(Array.from(items,k=>color(k.children[0])),expected);
 assert.equal(new Set(items.map(k=>color(k.children[0]))).size,4);
 const usageColors=[track(row(host,0)).children,track(row(host,1)).children];
 for(const [i,entry] of items.entries()){
  const name=entry.children[1].textContent,c=expected[i];
  for(const colored of usageColors){
   const piece=colored.find(s=>s.dataset.worker===name);
   if(piece)assert.equal(color(piece),c,name+" usage segment keeps its Worker color");
  }
  assert.equal(color(columns(p90)[i]),c,name+" p90 bar keeps its color");
  assert.equal(color(columns(p99)[i]),c,name+" p99 bar keeps its color");
 }
 assert.equal(p90.children[0].children[0].textContent,"CPU p90");
 assert.equal(p99.children[0].children[0].textContent,"CPU p99");
 assert.ok(css.includes("align-items:center;justify-content:center;flex-wrap:wrap"));
 assert.ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
 assert.ok(css.includes("border-right:1px solid var(--dg-border)"));
});
test("Both upward-facing CPU charts share the same millisecond scale and real p90/p99 values",()=>{
 const host=render(sample),[p90,p99]=charts(host),a=columns(p90),b=columns(p99);
 assert.equal(a.length,4);
 assert.equal(b.length,4);
 assert.equal(p90.children[0].children[1].textContent,"0–20 ms");
 assert.equal(p99.children[0].children[1].textContent,"0–20 ms");
 // Sorted order is alpha, beta, delta, gamma.
 assert.deepEqual(Array.from(a,height),[25,5,0,10]);
 assert.deepEqual(Array.from(b,height),[45,100,50,25]);
 assert.equal(a[0].children[0].children[0].textContent,"5 ms");
 assert.equal(b[1].children[0].children[0].textContent,"20 ms");
 assert.equal(a[2].children[0].children[0].textContent,"0 ms");
 assert.match(a[0].attributes["aria-label"],/alpha: CPU p90 5 ms/);
 assert.match(b[1].attributes["aria-label"],/beta: CPU p99 20 ms/);
 assert.match(css,/\.dg-cpu-fill\{[^}]*bottom:0[^}]*height:var\(--dg-cpu-height,0%\)/);
 assert.ok(css.includes("animation:dg-worker-cpu-arrive"));
});
test("Worker color allocation is stable across changing metrics and unique beyond reference colors",()=>{
 const names=Array.from({length:18},(_,i)=>"worker-"+String(i).padStart(2,"0"));
 const datasets=[
  Object.fromEntries(names.map((n,i)=>[n,{requests:i,subrequests:18-i,cpu_time_p90_us:i*1000}])),
  Object.fromEntries(names.slice().reverse().map((n,i)=>[n,{requests:i*2,subrequests:i,cpu_time_p99_us:i*2000}]))
 ];
 const colors=datasets.map(d=>Object.fromEntries(legendItems(render(d)).map(k=>[
  k.children[1].textContent,color(k.children[0])])));
 assert.deepEqual(colors[0],colors[1],"Metric changes cannot recolor Workers");
 assert.equal(new Set(Object.values(colors[0])).size,names.length);
 assert.equal(colors[0]["worker-00"],"#eb534e");
 assert.equal(colors[0]["worker-04"],"#808080");
});
test("Unavailable measurements remain unknown; zeros and partially reported totals are truthful",()=>{
 const host=render({
  alpha:{requests:null,subrequests:undefined,cpu_time_p99_us:NaN},
  beta:{requests:0,subrequests:0,cpu_time_p90_us:0,cpu_time_p99_us:0},
  gamma:{requests:30,subrequests:5,cpu_time_p90_us:6000}
 });
 assert.equal(header(row(host,0)).children[1].textContent,"30 reported requests");
 assert.equal(header(row(host,1)).children[1].textContent,"5 reported subrequests");
 assert.equal(track(row(host,0)).children.length,1);
 assert.equal(track(row(host,1)).children.length,1);
 assert.equal(pct(track(row(host,0)).children[0]),100);
 assert.match(track(row(host,0)).attributes["aria-label"],/1 unavailable/);
 const [p90,p99]=charts(host);
 assert.equal(columns(p90)[0].children[0].children[0].textContent,"—");
 assert.equal(columns(p90)[1].children[0].children[0].textContent,"0 ms");
 assert.equal(columns(p99)[0].children[0].children[0].textContent,"—");
 assert.equal(columns(p99)[2].children[0].children[0].textContent,"—");
 assert.ok(columns(p90)[0].children[0].children[1].className.includes("dg-cpu-unavailable"));
 assert.equal(height(columns(p90)[0]),0);
 assert.match(columns(p90)[0].attributes["aria-label"],/unavailable/);
 const absent=render({alpha:{requests:null,subrequests:null,cpu_time_p90_us:null}});
 assert.equal(header(row(absent,0)).children[1].textContent,"—");
 assert.equal(track(row(absent,0)).children.length,0);
 assert.equal(charts(absent)[0].children[0].children[1].textContent,"No CPU readings");
 const zero=render({zero:{requests:0,subrequests:0,cpu_time_p90_us:0,cpu_time_p99_us:0}});
 assert.equal(header(row(zero,0)).children[1].textContent,"0 requests");
 assert.equal(track(row(zero,0)).children.length,0);
 assert.equal(columns(charts(zero)[0])[0].children[0].children[0].textContent,"0 ms");
});
test("Empty/unavailable data shows neutral placeholders; loading mimics both bars, legend, CPU charts",()=>{
 assert.equal(render({},"unavailable").children[0].className,"dg-empty");
 assert.match(render({}).children[0].textContent,/No Worker activity/);
 const skeleton=js.slice(js.indexOf("function initialSkeletonReport(){"),js.indexOf("function unavailableReport(){"));
 assert.ok(skeleton.includes('"Request Usage","Subrequest Usage"'));
 assert.ok(skeleton.includes("dg-usage-track dg-usage-track-skeleton"));
 assert.ok(skeleton.includes("dg-activity-legend dg-activity-legend-skeleton"));
 assert.ok(skeleton.includes('["p90","p99"]'));
 assert.ok(skeleton.includes("dg-cpu-plot dg-cpu-plot-skeleton"));
 assert.ok(skeleton.includes("site-skeleton dg-cpu-loading-bar"));
 assert.ok(!skeleton.includes("dg-worker-table"),"No obsolete loading table");
 assert.ok(css.includes(".dg-usage-skeleton-segment"));
 assert.ok(css.includes(".dg-cpu-loading-bar"));
 assert.ok(css.includes("#diagnostics-root.dg-refresh-loading .dg-usage-track"));
 assert.ok(css.includes(".dg-usage-total,.dg-activity-key-name,.dg-cpu-value"));
 assert.ok(css.includes("@media(max-width:720px)"),"Two comparative charts adapt to narrow screens");
 assert.ok(css.includes("#diagnostics-root .dg-panel{border:1px solid var(--dg-border);background:var(--dg-panel-bg);border-radius:12px;padding:17px 18px"));
 assert.ok(!css.includes("border-color:transparent;background:#292929"),"Worker panel shares the other panels' chrome");
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
