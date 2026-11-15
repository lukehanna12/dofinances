import {BATTERY_SF_VIEWBOX,BATTERY_SF_OUTLINE,BATTERY_SF_INTERIOR,BATTERY_SF_BOLT,BATTERY_SF_BOLT_VIEWBOX,BATTERY_INTERIOR_START_X,BATTERY_INTERIOR_WIDTH} from "./diagnostics-battery-geometry.js";
// Shared, non-networked Mac Diagnostics battery and storage UI.
// Safe for the static Studio preview: no telemetry requests or account access.
const integer=(n)=>typeof n==="number"&&Number.isFinite(n)?Math.round(n).toLocaleString():"—";
const quantity=(n,d=1)=>typeof n==="number"&&Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d}):"—";
const bytes=(n)=>typeof n==="number"&&Number.isFinite(n)?(n>=1073741824?quantity(n/1073741824,2)+" GiB":n>=1048576?quantity(n/1048576,1)+" MiB":n>=1024?quantity(n/1024,1)+" KiB":integer(n)+" B"):"—";
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;}
/* The local gateway reports battery CHARGE, not battery lifetime health.
 * Do not infer full-charge capacity, wear, or cycle count from this value. */
export function batteryPresentation(metrics){
 const raw=metrics?.battery_percent;
 const percent=typeof raw==="number"&&Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):null;
 const charging=metrics?.battery_charging===true;
 const level=percent===null?"unknown":percent<=20?"critical":percent<=40?"warning":charging?"charging":"normal";
 return {percent,charging,level,display:percent===null?"—":String(Math.round(percent))};
}
const SVG_NAMESPACE="http://www.w3.org/2000/svg";
let batteryClipSequence=0;
function svgPart(name,attrs){
 const n=document.createElementNS(SVG_NAMESPACE,name);
 for(const [key,value] of Object.entries(attrs||{}))n.setAttribute(key,String(value));
 return n;
}
function batteryBolt(){
 const svg=svgPart("svg",{class:"dg-battery-bolt",viewBox:BATTERY_SF_BOLT_VIEWBOX,"aria-hidden":"true",focusable:"false"});
 svg.append(svgPart("path",{d:BATTERY_SF_BOLT,fill:"currentColor"}));
 return svg;
}
function batteryFact(label,value,withBolt=false){
 const item=make("div","dg-battery-fact"),key=make("span","dg-battery-fact-label",label);
 const reading=make("strong","dg-battery-fact-value");
 if(withBolt)reading.append(batteryBolt());
 reading.append(document.createTextNode(value));
 item.append(key,reading);return item;
}
function batteryFigure(metrics){
 const state=batteryPresentation(metrics);
 const figure=make("figure","dg-battery-figure");
 figure.dataset.level=state.level;
 figure.dataset.charging=String(state.charging);
 figure.setAttribute("role","img");
 figure.setAttribute("aria-label",state.percent===null?"Mac battery charge unavailable":
  "Mac battery charge "+state.display+" percent"+(state.charging?", charging":""));
 const svg=svgPart("svg",{class:"dg-battery-shell",viewBox:BATTERY_SF_VIEWBOX,"aria-hidden":"true",focusable:"false",preserveAspectRatio:"xMidYMid meet"});
 const clipId="dg-battery-cavity-"+(++batteryClipSequence);
 const defs=svgPart("defs"),clip=svgPart("clipPath",{id:clipId});
 clip.append(svgPart("path",{d:BATTERY_SF_INTERIOR}));defs.append(clip);
 svg.append(defs,svgPart("path",{d:BATTERY_SF_INTERIOR,class:"dg-battery-cavity"}),
  svgPart("rect",{x:BATTERY_INTERIOR_START_X,y:0,width:BATTERY_INTERIOR_WIDTH*(state.percent??0)/100,
   height:16.024,"clip-path":"url(#"+clipId+")",class:"dg-battery-fill"}),
  svgPart("path",{d:BATTERY_SF_OUTLINE,class:"dg-battery-outline"}));
 const amount=make("span","dg-battery-percentage");
 amount.setAttribute("aria-hidden","true");
 amount.append(document.createTextNode(state.display));
 if(state.percent!==null)amount.append(make("span","dg-battery-percent-sign","%"));
 figure.append(svg,amount);
 return figure;
}
function macStorageSummary(metrics){
 const free=metrics?.storage_free_bytes,total=metrics?.storage_total_bytes;
 const available=typeof free==="number"&&Number.isFinite(free)&&free>=0&&
   typeof total==="number"&&Number.isFinite(total)&&total>0&&free<=total;
 const used=available?total-free:null;
 const wrap=make("div","dg-mac-storage"),line=make("div","dg-mac-storage-line");
 line.append(make("span","dg-mac-storage-label","Storage"));
 line.append(make("strong","dg-mac-storage-free",available?bytes(free)+" free":"Unavailable"));
 wrap.append(line);
 const details=make("span","dg-mac-storage-details",
  available?bytes(total)+" capacity · "+quantity(used/total*100,1)+"% used":
  "Storage capacity was not included in this reading");
 wrap.append(details);
 if(available){
  const bar=make("progress","dg-progress dg-mac-storage-bar");
  bar.max=100;bar.value=used/total*100;
  bar.setAttribute("aria-label",quantity(used/total*100,1)+"% of Mac storage used");
  wrap.append(bar);
 }
 return wrap;
}
export function macBatteryBody(metrics){
 const hero=make("div","dg-mac-battery-layout");
 hero.append(batteryFigure(metrics));
 const facts=make("div","dg-battery-facts");
 facts.append(batteryFact("Power source",metrics?.battery_power_source||"—"),
  batteryFact("Battery state",metrics?.battery_state||"—"),
  batteryFact("Charging",metrics?.battery_charging===true?"Yes":
   metrics?.battery_charging===false?"No":"—",metrics?.battery_charging===true));
 hero.append(facts);
 const body=make("div","dg-mac-body");
 body.append(hero,macStorageSummary(metrics));
 return body;
}

