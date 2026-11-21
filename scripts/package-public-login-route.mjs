/* Generate the route-manifest contract used by the persistent public shell.
 * Keep the built JS/CSS URL paths explicit; do not load the Vite document.
 */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve,join} from "node:path";
const dist=resolve("dist");
const manifestPath=join(dist,".vite","manifest.json");
assert.ok(existsSync(manifestPath),"Vite build.manifest must be enabled");
const data=JSON.parse(readFileSync(manifestPath,"utf8"));
const entry=data["src/routes/login-entry.jsx"];
assert.ok(entry?.isEntry && typeof entry.file==="string","Login route entry is missing");
const filePath=p=>{
  assert.ok(/^assets\/[\w./-]+$/.test(p)&&!p.includes(".."),"Invalid build asset path");
  assert.ok(existsSync(join(dist,p)),"Missing built asset "+p);
  return "/"+p;
};
const css=new Set((entry.css||[]).map(filePath));
// Vite can emit shared entry CSS on imported chunks. Resolve their imports.
const visited=new Set();
function walk(imports=[]){
  for(const key of imports){
    if(visited.has(key))continue;
    visited.add(key);
    const imported=data[key];
    assert.ok(imported,"Unresolved manifest import "+key);
    for(const p of imported.css||[])css.add(filePath(p));
    walk(imported.imports);
  }
}
walk(entry.imports);
assert.ok(css.size,"The login card must include its Tailwind stylesheet");
const output={js:filePath(entry.file),css:[...css]};
writeFileSync(join(dist,"assets","public-login-manifest.json"),
  JSON.stringify(output)+"\n","utf8");
process.stdout.write("Public login route: "+JSON.stringify(output)+"\n");
