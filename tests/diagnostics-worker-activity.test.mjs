import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const read=name=>readFileSync(new URL("../sites/_apex/app/assets/"+name,import.meta.url),"utf8");
const js=read("diagnostics.js"),css=read("diagnostics.css");
const source=js.replace("export function initColosseumDiagnostics","function initColosseumDiagnostics");
const element=tag=>({
 tag,className:"",textContent:"",children:[],attributes:{},dataset:{},
 style:{values:{},setProperty(k,v){this.values[k]=v}},
 append(...els){this.children.push(...els)},replaceChildren(...els){this.children=els},
 setAttribute(k,v){this.attributes[k]=v}
});
function render(by_worker,status="healthy"){
 const host=element("div");
 const document={createElement:element,getElementById:id=>id==="dg-workers"?host:null};
 const fn=runInNewContext(source+"\nrenderWorkers",{document,Intl});
 fn({sections:{workers:{status,worker_count:11,colosseum:{requests:152},by_worker}}});
 return host;
}
const table=host=>host.children[0].children[0];
const body=host=>table(host).children[1].children;
const barPct=bar=>Number.parseFloat(bar.style.values["--dg-bar-target"]);
const sample={
 alpha:{requests:100,subrequests:40,cpu_time_p90_us:5000,cpu_time_p99_us:9000},
 beta:{requests:30,subrequests:5,cpu_time_p90_us:1000,cpu_time_p99_us:20000}
};
test("Four columns retain real readings and exclude Error and the removed footnote",()=>{
 const host=render(sample),t=table(host),heads=t.children[0].children[0].children;
 assert.deepEqual(Array.from(heads,node=>node.textContent),[
  "Service · relative volume","Requests","Subrequests","CPU · p90 / p99"]);
 assert.equal(body(host).length,2);
 assert.equal(body(host)[0].children.length,4);
 assert.equal(host.children.length,1,"No bottom summary paragraph");
 assert.ok(!js.includes('"Errors"'));
 assert.ok(!js.includes("Bars are relative to the busiest Worker."));
 assert.equal(body(host)[0].children[0].children[0].children[0].textContent,"alpha");
});
test("Service bars are truthful segmented proportions; metrics each use their own common scale",()=>{
 const [alpha,beta]=body(render(sample));
 const aService=alpha.children[0],bService=beta.children[0];
 assert.equal(aService.children[0].children[1].textContent,"100% of peak");
 assert.equal(bService.children[0].children[1].textContent,"25% of peak");
 assert.equal(aService.children[1].attributes.role,"img");
 assert.match(aService.children[1].attributes["aria-label"],/not unique events/);
 assert.equal(aService.children[1].children[0].dataset.kind,"requests");
 assert.equal(aService.children[1].children[1].dataset.kind,"subrequests");
 assert.ok(Math.abs(barPct(aService.children[1].children[0])-100*100/140)<1e-10);
 assert.ok(Math.abs(barPct(aService.children[1].children[1])-100*40/140)<1e-10);
 assert.ok(Math.abs(barPct(bService.children[1].children[0])-100*30/140)<1e-10);
 assert.ok(Math.abs(barPct(bService.children[1].children[1])-100*5/140)<1e-10);
 assert.equal(alpha.children[1].children[0].children[1].textContent,"100");
 assert.equal(alpha.children[2].children[0].children[1].textContent,"40");
 assert.equal(barPct(alpha.children[1].children[1].children[0]),100);
 assert.equal(barPct(alpha.children[2].children[1].children[0]),100);
 assert.equal(barPct(beta.children[1].children[1].children[0]),30);
 assert.equal(barPct(beta.children[2].children[1].children[0]),12.5);
});
test("CPU p90/p99 are paired graphics on one millisecond axis and reuse red/orange",()=>{
 const [alpha,beta]=body(render(sample));
 const [p90,p99]=alpha.children[3].children;
 assert.equal(p90.children[0].children[0].textContent,"p90");
 assert.equal(p99.children[0].children[0].textContent,"p99");
 assert.equal(p90.children[0].children[1].textContent,"5 ms");
 assert.equal(p99.children[0].children[1].textContent,"9 ms");
 assert.equal(p90.children[1].children[0].dataset.kind,"requests");
 assert.equal(p99.children[1].children[0].dataset.kind,"subrequests");
 assert.equal(barPct(p90.children[1].children[0]),25);
 assert.equal(barPct(p99.children[1].children[0]),45);
 assert.equal(barPct(beta.children[3].children[0].children[1].children[0]),5);
 assert.equal(barPct(beta.children[3].children[1].children[1].children[0]),100);
 assert.match(p90.children[1].attributes["aria-label"],/same millisecond scale/);
 assert.ok(css.includes("--dg-worker-red:#eb534e;--dg-worker-orange:#f09748;--dg-worker-remainder:#464646"));
 assert.ok(css.includes("border-color:transparent;background:#292929;border-radius:20px"));
 assert.ok(css.includes(".dg-worker-bar[data-kind=subrequests]{background:var(--dg-worker-orange)}"));
 assert.ok(css.includes(".dg-worker-key-subrequests::before{background:var(--dg-worker-orange)}"));
});
test("Absent observations stay unknown rather than fabricated zeroes",()=>{
 const [unknown,zero]=body(render({
  unknown:{requests:null,subrequests:undefined,cpu_time_p99_us:NaN},
  zero:{requests:0,subrequests:0,cpu_time_p90_us:0,cpu_time_p99_us:0}
 }));
 assert.equal(unknown.children[0].children[0].children[1].textContent,"—");
 assert.equal(unknown.children[0].children[1].children.length,0);
 assert.equal(unknown.children[1].children[0].children[1].textContent,"—");
 assert.equal(unknown.children[2].children[0].children[1].textContent,"—");
 assert.equal(unknown.children[1].children[1].children.length,0);
 for(const cpu of unknown.children[3].children){
  assert.equal(cpu.children[0].children[1].textContent,"—");
  assert.equal(cpu.children[1].children.length,0);
 }
 assert.equal(zero.children[0].children[0].children[1].textContent,"0% of peak");
 assert.equal(zero.children[1].children[0].children[1].textContent,"0");
 assert.equal(zero.children[3].children[0].children[0].children[1].textContent,"0 ms");
 assert.equal(barPct(zero.children[1].children[1].children[0]),0);
});
test("Unavailable/empty workers show placeholders; loading has identical column structure",()=>{
 const unavailable=render({},"unavailable");
 assert.equal(unavailable.children[0].className,"dg-empty");
 assert.match(render({}).children[0].textContent,/No Worker activity/);
 const loading=js.slice(js.indexOf("function initialSkeletonReport(){"),js.indexOf("function unavailableReport(){"));
 assert.ok(loading.includes('"Service · relative volume","Requests","Subrequests","CPU · p90 / p99"'));
 assert.ok(loading.includes("workers.append(scroll);"));
 assert.ok(css.includes("min-width:800px")&&css.includes("overflow-x:auto"));
 assert.ok(css.includes("#diagnostics-root.dg-refresh-loading .dg-worker-track"));
});
