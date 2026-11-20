import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatWorkspaceTime} from "../sites/_apex/app/assets/workspace-nav.js";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const app=read("../sites/_apex/app/index.html");
const studio=read("../studio/sidebar/index.html");
const nav=read("../sites/_apex/app/assets/workspace-nav.js");
const css=read("../sites/_apex/app/assets/workspace-enhancements.css");

test("Both top bars offer identical compact clock and time zone controls",()=>{
  for(const html of [app,studio]){
    for(const id of ["global-clock","clock-display-trigger","clock-zone-trigger",
      "clock-display-menu","clock-zone-menu","clock-format-24","clock-format-standard",
      "clock-show-seconds","clock-show-doof","global-clock-doof","global-clock-period",
      "clock-popover-zone-select","clock-popover-custom-zone","clock-popover-custom-apply"]){
      assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
    }
    assert.ok(html.indexOf('id="global-clock"')<html.indexOf('id="mobile-nav-toggle"'));
    assert.match(html,/id="clock-display-menu"[^>]*role="dialog"[^>]*hidden/);
    assert.match(html,/id="clock-zone-menu"[^>]*role="dialog"[^>]*hidden/);
    assert.match(html,/id="clock-format-24"[^>]*aria-pressed="true"/);
    assert.match(html,/id="clock-show-seconds" type="checkbox" checked/);
    const options=html.match(/<select id="clock-popover-zone-select">([\s\S]*?)<\/select>/)?.[1]||"";
    const settings=html.match(/<select id="clock-zone-select">([\s\S]*?)<\/select>/)?.[1]||"";
    assert.equal(options.trim(),settings.trim(),"Timezone options and order match Settings");
  }
});
test("Clock display is stored separately from the existing time zone preference",()=>{
  assert.match(nav,/dofinances\.clock\.display\.v1/);
  assert.match(nav,/dofinances\.clock\.timezone\.v1/);
  assert.match(nav,/formatToParts\(now\)/);
  assert.match(nav,/showSeconds\.disabled=display\.doof/);
  assert.match(nav,/button24\.disabled=display\.doof/);
  assert.match(nav,/buttonStandard\.disabled=display\.doof/);
  assert.match(nav,/seconds\.hidden=display\.doof\|\|!display\.showSeconds/);
  assert.match(nav,/time\.hidden=display\.doof/);
  assert.match(nav,/zoneTrigger\.hidden=display\.doof/,
    "doof hides the entire timezone button and brings it back when disabled");
  assert.match(css,/\.global-clock \[hidden\]/,
    "hidden timezone control must override the topbar's inline-flex button styling");
  assert.match(nav,/win\.addEventListener\?\.\("storage"/);
  assert.equal((nav.match(/win\.setInterval\(paint,1000\)/g)||[]).length,1);
});
test("Popovers escape the clipped topbar and inherit current workspace styling",()=>{
  assert.match(nav,/doc\.body\.appendChild\(menu\)/);
  assert.match(nav,/getBoundingClientRect\(\)/);
  assert.match(nav,/event\.key==="Escape"/);
  assert.match(css,/\.clock-popover\{/);
  assert.match(css,/\.clock-segmented button\[aria-pressed="true"\]/);
  assert.match(css,/\.global-clock-doof\{color:#fff/);
  assert.match(css,/\.clock-toggle-control input:focus-visible/);
  assert.match(css,/\.clock-popover\[hidden\]/);
});
test("24-hour and Standard clock formatting retain correct hour and meridiem",()=>{
  const date=new Date("2026-11-20T22:05:09Z");
  assert.equal(formatWorkspaceTime(date,{timeZone:"America/Chicago",seconds:true}),"16:05:09");
  assert.equal(formatWorkspaceTime(date,{timeZone:"America/Chicago",seconds:true,hour12:true}),"4:05:09 PM");
});

test("Public Studio keeps display-only clock controls interactive without enabling account operations",()=>{
  const preview=read("../studio/sidebar/preview-bootstrap.js");
  for(const id of ["clock-display-trigger","clock-zone-trigger","clock-format-24",
    "clock-format-standard","clock-popover-custom-apply","clock-custom-apply"]){
    assert.ok(preview.includes('"'+id+'"'),id+" must stay interactive in Studio");
  }
  assert.match(preview,/button\.disabled=true/);
  assert.match(preview,/for\(const form of document\.querySelectorAll\("form"\)\)/);
});

test("Display doof centers over the 74px compact sidebar without moving the normal clock",()=>{
  const selector="#workspace-shell .global-clock button.clock-display-trigger:has(.global-clock-doof:not([hidden])){";
  const start=css.indexOf(selector);
  assert.ok(start>=0,"Centering rule applies only when the doof wordmark is visible");
  const end=css.indexOf("}",start);
  const style=css.slice(start,end);
  assert.ok(style.includes("margin-inline-start:37px;"));
  assert.ok(style.includes("transform:translateX(-50%);"));
  assert.equal(16+37,16+74/2,"Doof center matches the compact rail's center");
  assert.ok(css.includes("@media(min-width:761px){"));
  assert.ok(nav.includes("zoneTrigger.hidden=display.doof"));
});
