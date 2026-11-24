// Regenerate the native SVG module from the pinned open-source D2 release.
// Usage: node scripts/generate-bootscript-diagram.mjs [path-to-d2-v0.9.0]
import {execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const binary=process.argv[2]||"d2";
if(execFileSync(binary,["--version"],{encoding:"utf8"}).trim()!=="v0.9.0")throw new Error("Use D2 v0.9.0");
const work=mkdtempSync(join(tmpdir(),"bootscript-d2-"));
try{
  const svgPath=join(work,"bootscript.svg");
  execFileSync(binary,["--theme","201","--layout","dagre","--pad","8",join(root,"diagrams/bootscript.d2"),svgPath],{stdio:"inherit"});
  let svg=readFileSync(svgPath,"utf8");
  // Keep the upstream theme, text, strokes and layout intact. Only shape fills
  // are translucent; no opacity is applied to the full node or the connectors.
  svg=svg.replace(/<(?:rect|path|ellipse|polygon)\b[^>]*>/g,tag=>
    /class="[^"]*\bstroke-\w+[^"]*\bfill-\w+/.test(tag)&&!tag.includes("connection")
      ?tag.replace(" />",' fill-opacity="0.54" />'):tag);
  if((svg.match(/fill-opacity="0\.54"/g)||[]).length!==14||/<(?:script|foreignObject)\b/i.test(svg))throw new Error("Unexpected D2 output");
  const output="// Generated with D2 v0.9.0, Dark Flagship (201), Dagre; see diagrams/bootscript.d2.\nexport const BOOTSCRIPT_DIAGRAM_SVG = "+JSON.stringify(svg)+";\n";
  writeFileSync(join(root,"sites/_apex/assets/public-projects-bootscript-diagram.js"),output);
}finally{rmSync(work,{recursive:true,force:true});}
