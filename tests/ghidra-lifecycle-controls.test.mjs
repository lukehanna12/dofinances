import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const root=new URL("../",import.meta.url);
const read=path=>fs.readFile(new URL(path,root),"utf8");

test("Providers controls upstream Ghidra instance lifecycle through reviewed owner actions",async()=>{
 const [ui,mount]=await Promise.all([
  read("sites/_apex/app/assets/provider-ghidra-lifecycle.js"),
  read("sites/_apex/app/assets/provider-provisions.js")]);
 for(const mode of ["local.lifecycle.start.prepare","local.lifecycle.stop.prepare",
                     "local.lifecycle.configure.prepare","local.commit"])
  assert.ok(ui.includes(mode),mode);
 assert.ok(ui.includes("hard_max_idle_seconds"));
 assert.ok(ui.includes("active_leases"));
 assert.ok(ui.includes("onChanged()"));
 assert.match(mount,/mountGhidraLifecycle/);
 assert.match(mount,/mountProviderAdapterControl/);
 assert.match(mount,/\["Resources","resources"\]/);
 assert.match(mount,/\["Installed skills","skills"\]/);
});
test("Permissions controls the hard idle maximum with existing protected confirmations",async()=>{
 const [ui,markup]=await Promise.all([
  read("sites/_apex/app/assets/permissions.js"),
  read("sites/_apex/app/index.html")]);
 assert.ok(markup.includes('id="pm-lifecycle-fields"'));
 assert.ok(ui.includes('kind:"lifecycle"'));
 assert.ok(ui.includes('key:line.dataset.lifecycleKey'));
 assert.ok(ui.includes('request("confirm"'));
});
