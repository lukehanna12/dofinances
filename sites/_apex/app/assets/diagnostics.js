// Read-only Colosseum observability. No sample telemetry and no background polling.
const byId=(id)=>document.getElementById(id);
const integer=(n)=>typeof n==="number"&&Number.isFinite(n)?Math.round(n).toLocaleString():"—";
const quantity=(n,d=1)=>typeof n==="number"&&Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d}):"—";
const compact=(n)=>typeof n==="number"&&Number.isFinite(n)?Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(n):"—";
const bytes=(n)=>typeof n==="number"&&Number.isFinite(n)?(n>=1073741824?quantity(n/1073741824,2)+" GiB":n>=1048576?quantity(n/1048576,1)+" MiB":n>=1024?quantity(n/1024,1)+" KiB":integer(n)+" B"):"—";
const statusText=(s)=>s==="healthy"?"Healthy":s==="degraded"?"Degraded":s==="unhealthy"?"Unhealthy":s==="unavailable"?"Unavailable":"Not checked";
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;}
function clear(id){const el=typeof id==="string"?byId(id):id;el?.replaceChildren();return el;}
function placeholder(host,text){clear(host).append(make("div","dg-empty",text));}
function pair(label,value,detail){const el=make("div");el.append(make("span","dg-pair-label",label),make("strong","dg-pair-value",value));if(detail)el.append(make("span","dg-pair-detail",detail));return el;}
function pairs(rows){const el=make("div","dg-pairs");rows.forEach(([k,v,sub])=>el.append(pair(k,v,sub)));return el;}
function panel(title,right){const outer=make("div","dg-panel"),head=make("div","dg-panel-head"),label=make("span","",title);head.append(label);if(right)head.append(make("span","dg-small",right));outer.append(head);return outer;}
function progress(q){
 const used=q?.used,limit=q?.limit,ok=typeof used==="number"&&typeof limit==="number"&&limit>0;
 const p=make("progress","dg-progress");p.max=100;p.value=ok?Math.max(0,Math.min(100,used/limit*100)):0;
 p.setAttribute("aria-label",ok?quantity(used/limit*100,1)+"% used":"Usage unavailable");
 return p;
}
function quota(label,q,formatter=integer){
 const el=make("div","dg-quota");
 const p=q?.percent??(typeof q?.used==="number"&&q?.limit>0?100*q.used/q.limit:null);
 el.dataset.level=p===null?"unknown":p>=90?"critical":p>=75?"warning":"normal";
 el.append(make("span","dg-quota-name",label));
 const nums=make("span","dg-quota-numbers"),used=make("b","",formatter(q?.used));
 nums.append(used,document.createTextNode(" / "+formatter(q?.limit)));
 el.append(nums,progress(q));
 if(q?.status==="unavailable"||q?.status==="not_queried")el.append(make("span","dg-quota-sub","Not available from this report"));
 return el;
}
function metricCard(label,q,number,sub){
 const c=make("div","dg-card"),p=q?.percent;
 c.dataset.level=p>=90?"critical":p>=75?"warning":"normal";
 c.append(make("div","dg-card-label",label),make("div","dg-card-num",number),make("div","dg-card-note",sub),progress(q));
 return c;
}
function sectionOf(report,name){return report?.sections?.[name]||null;}
function missing(name){return name==="local"?"Not included or local diagnostics unavailable.":"Not included in this query or unavailable from the source.";}
function unavailablePanel(name){const p=panel(name);p.append(make("p","dg-small",missing(name)));return p;}
function ring(percent,value,unit){const outer=make("div","dg-ring"),inner=make("div","dg-ring-content");
 outer.style.setProperty("--dg-percent",String(Math.max(0,Math.min(100,percent||0))));
 inner.append(make("strong","",value),make("span","",unit));outer.append(inner);return outer;
}
function renderOverview(report){
 const top=clear("dg-top"),w=sectionOf(report,"workers")?.account?.requests,
   d=sectionOf(report,"d1")?.account,
   o=sectionOf(report,"durable_objects")?.account;
 top.append(
   metricCard("Worker requests",w,compact(w?.used),integer(w?.remaining)+" remaining"),
   metricCard("D1 rows read",d?.rows_read,compact(d?.rows_read?.used),integer(d?.rows_read?.remaining)+" remaining"),
   metricCard("D1 rows written",d?.rows_written,compact(d?.rows_written?.used),integer(d?.rows_written?.remaining)+" remaining"),
   metricCard("DO SQLite writes",o?.sqlite_rows_written,compact(o?.sqlite_rows_written?.used),integer(o?.sqlite_rows_written?.remaining)+" remaining")
 );
}
function renderQuotas(report){
 const host=clear("dg-quotas"),w=sectionOf(report,"workers"),kv=sectionOf(report,"kv"),
 d1=sectionOf(report,"d1"),durable=sectionOf(report,"durable_objects");
 const groups=[
  ["Workers","Cloudflare daily request quota",w?.account,[["Invocations",w?.account?.requests]]],
  ["Workers KV","Cloudflare daily operation quotas",kv?.account,[["Reads",kv?.account?.reads],["Writes",kv?.account?.writes],["Deletes",kv?.account?.deletes],["Lists",kv?.account?.lists],["Storage",kv?.account?.storage_bytes]]],
  ["D1","Cloudflare daily database quotas",d1?.account,[["Rows read",d1?.account?.rows_read],["Rows written",d1?.account?.rows_written],["Storage",d1?.account?.storage_bytes]]],
  ["Durable Objects","Cloudflare daily object and SQLite quotas",durable?.account,[["Requests",durable?.account?.requests],["GB-seconds",durable?.account?.gb_seconds],["SQLite rows read",durable?.account?.sqlite_rows_read],["SQLite rows written",durable?.account?.sqlite_rows_written],["SQLite storage",durable?.account?.sqlite_storage_bytes]]]
 ];
 for(const [title,caption,data,items] of groups){
  const p=panel(title,caption);if(!data){p.append(make("p","dg-small",missing(title)));host.append(p);continue;}
  items.forEach(([label,q])=>p.append(quota(label,q,label.includes("Storage")?bytes:label==="GB-seconds"?n=>quantity(n,2):integer)));
  host.append(p);
 }
}
function renderWorkers(report){
 const host=clear("dg-workers"),workers=sectionOf(report,"workers");
 if(!workers||workers.status==="unavailable"){host.append(make("div","dg-empty",missing("workers")));return;}
 const entries=Object.entries(workers.by_worker||{}).sort((a,b)=>(b[1]?.requests||0)-(a[1]?.requests||0));
 if(!entries.length){host.append(make("div","dg-empty","No Worker activity reported in this window."));return;}
 const wrap=make("div","dg-table-scroll"),table=make("table","dg-table"),thead=make("thead"),tr=make("tr");
 ["Service","Requests","Errors","Subrequests","CPU p90","CPU p99"].forEach(s=>tr.append(make("th","",s)));thead.append(tr);
 const body=make("tbody");
 entries.forEach(([name,v])=>{
  const row=make("tr");row.append(make("td","",name),
    make("td","",integer(v.requests)),make("td","",integer(v.errors)),make("td","",integer(v.subrequests)),
    make("td","",typeof v.cpu_time_p90_us==="number"?quantity(v.cpu_time_p90_us/1000,2)+" ms":"—"),
    make("td","",typeof v.cpu_time_p99_us==="number"?quantity(v.cpu_time_p99_us/1000,2)+" ms":"—"));
  body.append(row);
 });
 table.append(thead,body);wrap.append(table);host.append(wrap);
 const caption=make("p","dg-footnote",integer(workers.colosseum?.requests)+" Colosseum Worker requests · "+integer(workers.worker_count)+" configured Workers reported");
 host.append(caption);
}
function findGatewayMetrics(local){
 const layers=Array.isArray(local?.layers)?local.layers:[];
 return layers.find(l=>l.layer==="gateway"&&l.metrics)?.metrics||layers.find(l=>l.metrics?.battery_percent!==undefined||l.metrics?.storage_free_bytes!==undefined)?.metrics||null;
}
function renderLocal(report){
 const host=clear("dg-local"),local=sectionOf(report,"local"),m=findGatewayMetrics(local);
 const machine=panel("Mac · storage & power",local?.status?statusText(local.status):"Unavailable");
 if(m){
  const free=m.storage_free_bytes,total=m.storage_total_bytes,used=typeof total==="number"&&total>0?total-free:null;
  const usable=typeof total==="number"&&total>0&&typeof free==="number";
  const body=make("div","dg-ring-row");
  body.append(ring(usable?used/total*100:0,usable?quantity(free/1073741824,1):"—","GiB free"));
  const detail=make("div","dg-ring-copy");detail.append(pair("Drive capacity",bytes(total)),pair("Storage used",usable?quantity(used/total*100,1)+"%":"—"),pair("Available",bytes(free)));
  body.append(detail);machine.append(body);
  const battery=make("div","dg-ring-row");battery.style.marginTop="24px";
  const pct=typeof m.battery_percent==="number"?m.battery_percent:null;
  battery.append(ring(pct,pct===null?"—":quantity(pct,0)+"%","battery"));
  const bd=make("div","dg-ring-copy");bd.append(pair("Power source",m.battery_power_source||"—"),pair("Battery",m.battery_state||"—"),pair("Charging",m.battery_charging===true?"Yes":m.battery_charging===false?"No":"—"));
  battery.append(bd);machine.append(battery);
 }else machine.append(make("p","dg-small","Mac storage and battery readings are not present in the selected local health check. Choose Gateway / Quick to retrieve them."));
 host.append(machine);
 const gateway=panel("Local gateway",local?.check?local.check+" · "+(local.depth||"quick"):"No reading");
 if(!local||local.status==="unavailable"){gateway.append(make("p","dg-small",missing("local")));host.append(gateway);return;}
 gateway.append(pairs([["Health",statusText(local.status)],["Diagnostic latency",typeof local.duration_ms==="number"?quantity(local.duration_ms,1)+" ms":"—"],["Uptime",m?.uptime_seconds!==undefined?quantity(m.uptime_seconds/3600,1)+" h":"—"],["Memory (RSS)",bytes(m?.rss_bytes)],["Event-loop lag",typeof m?.event_loop_lag_ms==="number"?quantity(m.event_loop_lag_ms,2)+" ms":"—"],["Request p95",typeof m?.request_p95_ms==="number"?quantity(m.request_p95_ms,1)+" ms":"—"],["Active / queued",integer(m?.active_requests)+" / "+integer(m?.queued_requests)],["Error rate",typeof m?.error_rate==="number"?quantity(m.error_rate*100,2)+"%":"—"]]));
 if(Array.isArray(local.layers)&&local.layers.length>1){const layers=local.layers.map(x=>x.layer+": "+statusText(x.status)).join(" · ");gateway.append(make("p","dg-footnote",layers));}
 host.append(gateway);
}
function renderReport(report){
 byId("dg-health").dataset.health=report.status||"unknown";
 byId("diagnostics-root").dataset.health=report.status||"unknown";
 byId("dg-health-text").textContent=statusText(report.status);
 const stamp=Date.parse(report.collected_at);
 byId("dg-updated").textContent=Number.isFinite(stamp)?"Collected "+new Date(stamp).toLocaleString():"Collection time unavailable";
 const reset=Date.parse(report.usage_window?.reset_utc);
 byId("dg-window").textContent="UTC daily window · "+(Number.isFinite(reset)?"Resets "+new Date(reset).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",timeZone:"UTC"})+" UTC":"Reset time unavailable");
 const notice=byId("dg-notice");
 if(report.status==="healthy"&&!report.issues?.length){notice.hidden=true;}
 else {notice.hidden=false;notice.dataset.tone=report.status==="unhealthy"?"error":"info";notice.textContent=report.issues?.length?"Some measurements were unavailable or partially reported.":"Report status: "+statusText(report.status);}
 renderOverview(report);renderQuotas(report);renderWorkers(report);renderLocal(report);
}
function optionsFromForm(){
 const sections=[...document.querySelectorAll("[data-dg-section]:checked")].map(x=>x.value);
 return{sections,check:byId("dg-check").value,depth:byId("dg-depth").value};
}
function optionsLabel(o){
 const checks=byId("dg-query-summary");
 checks.textContent=(o.sections.length===5?"All 5 sections":o.sections.length+" selected")+" · "+o.check.replace(/_/g," ")+" · "+o.depth;
}
export function initColosseumDiagnostics(){
 if(!byId("diagnostics-root"))return;
 let busy=false,requested=false,previous=null,selected=optionsFromForm();
 const refresh=byId("dg-refresh"),run=byId("dg-run");
 const query=byId("dg-query"),notice=byId("dg-notice");
 function showFailure(message){
  byId("dg-health").dataset.health="degraded";
  byId("diagnostics-root").dataset.health="degraded";
  byId("dg-health-text").textContent=previous?"Last snapshot retained":"Unavailable";
  notice.hidden=false;notice.dataset.tone="error";notice.replaceChildren();
  notice.append(document.createTextNode(message+" "));
  const link=make("a","","Verify Colosseum owner access");
  link.href="/api/colosseum/status";link.target="_blank";link.rel="noopener noreferrer";notice.append(link);
  if(previous)byId("dg-updated").textContent="Last successful snapshot · "+new Date(previous.collected_at).toLocaleString()+" · stale";
 }
 async function collect(args){
  if(busy)return;
  if(!args.sections.length){notice.hidden=false;notice.dataset.tone="error";notice.textContent="Select at least one diagnostics section.";return;}
  busy=true;requested=true;selected={sections:[...args.sections],check:args.check,depth:args.depth};optionsLabel(selected);
  refresh.disabled=true;run.disabled=true;refresh.classList.add("is-busy");refresh.querySelector("span").textContent="Refreshing";
  try{
   const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),30000);
   let response;
   try{response=await fetch("/api/colosseum/diagnostics",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(selected),signal:controller.signal});}
   finally{window.clearTimeout(timeout);}
   const type=response.headers.get("content-type")||"";
   if(!type.includes("application/json"))throw Error("Owner verification requires attention or the diagnostics service returned an unexpected response.");
   const body=await response.json();
   if(!response.ok)throw Error(body?.error||"Diagnostics unavailable (HTTP "+response.status+").");
   const report=body?.name==="system.status"?body:body?.report;
   if(report?.name!=="system.status"||!report.sections)throw Error("The diagnostics service returned an unexpected schema.");
   previous=report;renderReport(report);query.open=false;
  }catch(error){
   showFailure(error.name==="AbortError"?"The diagnostics request exceeded 30 seconds.":String(error.message||"Diagnostics unavailable."));
  }finally{
   busy=false;refresh.disabled=false;run.disabled=false;refresh.classList.remove("is-busy");refresh.querySelector("span").textContent="Refresh";
  }
 }
 refresh.addEventListener("click",()=>collect(selected));
 run.addEventListener("click",()=>collect(optionsFromForm()));
 document.querySelectorAll("[data-dg-section], #dg-check, #dg-depth").forEach(el=>el.addEventListener("change",()=>optionsLabel(optionsFromForm())));
 function onRoute(){
  const active=!document.querySelector('[data-view="colosseum/diagnostics"]')?.hidden;
  if(active&&!requested)void collect(optionsFromForm());
 }
 window.addEventListener("hashchange",()=>window.queueMicrotask(onRoute));
 window.queueMicrotask(onRoute);
}
