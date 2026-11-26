import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PROJECT_SHOWCASE,renderProjectShowcase,projectShowcaseStatus,sortProjectShowcase,PROJECT_CARD_ICONS,PROJECT_CARD_IMAGES} from "../sites/_apex/app/assets/project-showcase.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Projects roster applies requested names and progress states without retired entries",()=>{
 assert.deepEqual(PROJECT_SHOWCASE.map(p=>p.name),[
  "BootScript","Lightwork","ReadMe GLP","ChatStore",
  "Colosseum","Apple HIGs Reader","Terminal Scalars","Unicode Plus",
  "Liquid Plexiglass 26","3D Liquid Glass","Apple Adobe FX",
  "Protocol Monitor Pruner","App Caviar","Ozoning Board",
  "Hidden Functions","LaTeXceL"
 ]);
 assert.equal(new Set(PROJECT_SHOWCASE.map(p=>p.slug)).size,16);
 assert.ok(!PROJECT_SHOWCASE.some(p=>p.slug==="bootscribe"),"Retired BootScribe must not be rendered");
 assert.ok(!PROJECT_SHOWCASE.some(p=>p.slug==="3d-liquid-glass-27-swift-package"));
 assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug==="3d-liquid-glass-26-swift-package"),{
  slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null,status:"in-progress"
 });
 assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug==="ozoning-board"),{
  slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null,status:"review"
 });
 for(const [slug,name] of [["hidden-functions","Hidden Functions"],["latexcel","LaTeXceL"]]){
  assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug===slug),{
   slug,name,kind:"Project",repository:null,status:"in-progress"
  });
  assert.equal(projectShowcaseStatus(PROJECT_SHOWCASE.find(p=>p.slug===slug)),"In Progress");
 }
});
test("Curated projects link their verified GitHub repositories",()=>{
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.repository).map(p=>[p.slug,p.repository]),[
  ["bootscript","lukehanna12/bootscript"],
  ["translucence-lab","lukehanna12/lightwork"],
  ["github-readme-chrome-extension","lukehanna12/reademe-glp"],
  ["chatgpt-chat-save-chrome-extension","lukehanna12/chatstore"],
  ["colosseum","lukehanna12/colosseum"],["apple-hig-reader","lukehanna12/apple-higs-reader"],
  ["unicode-plus","lukehanna12/unicode-plus"],
  ["protocol-monitor-pruner","lukehanna12/protocol-monitor-pruner"]
 ]);
 assert.equal(PROJECT_SHOWCASE.filter(p=>!p.repository).length,8);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.status==="review").map(p=>p.slug),[
  "bootscript","translucence-lab","github-readme-chrome-extension",
  "apple-hig-reader","unicode-plus","protocol-monitor-pruner","ozoning-board"
 ]);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.docs).map(p=>p.slug),[
  "bootscript","translucence-lab","github-readme-chrome-extension",
  "chatgpt-chat-save-chrome-extension"
 ]);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.docs&&!p.repository).map(p=>p.slug),[]);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="colosseum").status,"coming-soon");
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.status==="in-progress").map(p=>p.slug),["chatgpt-chat-save-chrome-extension","liquid-plexiglass-26","3d-liquid-glass-26-swift-package","hidden-functions","latexcel"]);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="unicode-plus").status,"review");
 assert.equal(projectShowcaseStatus(PROJECT_SHOWCASE.find(p=>p.slug==="ozoning-board")),"Review");
});
test("Local Docs are created in account storage without overwriting saved READMEs",()=>{
 const store=read("edge/auth-store-projects.mjs");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 const router=read("edge/router.mjs");
 for(const name of ["BootScript","Lightwork","ReadMe GLP","ChatStore"]){
  assert.ok(store.includes('"'+name+'"'),"Seed is missing "+name);
 }
 assert.match(store,/INSERT OR IGNORE INTO project_records/);
 assert.doesNotMatch(store,/\["bootscribe","BootScribe"\]/);
 assert.match(store,/DELETE FROM project_records WHERE user_id=\? AND slug=\x27bootscribe\x27/);
 assert.match(store,/project_catalog_migrations/);
 assert.ok(store.includes('["github-readme-chrome-extension","ReadMe GLP (GitHub Live Previewer)","ReadMe GLP"]'),"Stored project titles migrate without overwriting READMEs");
 assert.match(store,/UPDATE project_records SET name=\? WHERE user_id=\? AND slug=\? AND name=\?/);
 assert.match(store,/projectSaveLocal\(/);
 assert.match(ui,/routeSlug\(\)/);
 assert.match(router,/\^\\\/app\\\/project\\\//);
});
test("Compact quarter-area Projects cards retain image reveal and status styling",()=>{
 const css=read("sites/_apex/app/assets/project-showcase.css");
 const source=read("sites/_apex/app/assets/project-showcase.js");
 const permissions=read("sites/_apex/app/assets/permissions.css");
 const store=read("edge/auth-store-projects.mjs");
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/min-height:clamp\(215px,18vw,250px\)/);
 assert.match(css,/@media\(max-width:699px\)[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.project-showcase-title\{[\s\S]*font-size:clamp\(12px,1\.05vw,16px\)/);
 assert.match(css,/transform:scale\(1\.1\)/);
 assert.match(css,/transform:scale\(1\)/);
 assert.match(css,/background:rgba\(0,0,0,\.6\)/);
 assert.match(css,/border-radius:10px/);
 assert.match(css,/font-size:9px;font-weight:500;line-height:12px;padding:2px 9px/);
 assert.match(css,/border-radius:999px;white-space:nowrap/);
 assert.match(permissions,/\.pm-rule-row\{min-height:56px;border-bottom:1px solid var\(--pm-line\)/);
 assert.match(css,/background:color\(srgb 0\.172549 0\.403922 0\.772549 \/ 0\.1\)/);
 assert.match(css,/color:rgb\(44, 103, 197\)/);
 assert.match(css,/background:color\(srgb 0\.137 0\.855 0\.349 \/ 0\.09\)/);
 assert.match(css,/background:color\(srgb 0\.98 0\.76 0\.07 \/ 0\.09\)/);
 assert.match(css,/\.project-showcase-badge--progress\{\s*background:color\(srgb 0\.98 0\.45 0\.08 \/ 0\.09\);color:rgb\(245, 130, 45\)/);
 assert.match(permissions,/\.pm-rule-row\[data-enabled="false"\] \.pm-rule-status\{color:#747474\}/);
 assert.match(source,/const status=projectShowcaseStatus\(project\)/);
 assert.match(store,/\["protocol-monitor-pruner","Protocol Monitor Pruner","lukehanna12\/protocol-monitor-pruner"\]/);
 assert.match(source,/addEventListener\("pointerenter",reveal/);
 assert.match(source,/addEventListener\("focusin",reveal/);
 assert.match(source,/if\(active\)card\.href/);
 assert.match(source,/project\.docs===true/);
 assert.match(source,/Local Docs - Editable/);
 assert.match(source,/else card\.tabIndex=0/);
});
test("Projects uses native static catalog without exposing private data in Studio",()=>{
 const html=read("sites/_apex/app/index.html");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 const store=read("edge/auth-store-projects.mjs");
 const workflow=read(".github/workflows/site.yml");
 assert.match(html,/href="\/app\/assets\/project-showcase\.css\?artwork=rembrandt-cotan-v1-badges-v2"/);
 assert.match(html,/id="project-list" class="project-showcase-grid"/);
 assert.match(ui,/renderProjectShowcase\(cards,projects,slugRoute\)/);
 assert.match(ui,/location\.hash="#"\+slugRoute\(data\.project\.slug\)/);
 assert.match(store,/lukehanna12\/apple-higs-reader/);
 assert.match(store,/Apple HIGs Reader/);
 assert.doesNotMatch(workflow,/cp sites\/_apex\/app\/assets\/project-showcase\.js dist/);
 assert.equal(typeof renderProjectShowcase,"function");
});

test("Verified repository associations backfill once and respect account overrides",()=>{
 const store=read("edge/auth-store-projects.mjs");
 const ui=read("sites/_apex/app/assets/project-showcase.js");
 for(const [slug,name,repository] of [
  ["bootscript","BootScript","lukehanna12/bootscript"],
  ["unicode-plus","Unicode Plus","lukehanna12/unicode-plus"],
  ["translucence-lab","Lightwork","lukehanna12/lightwork"],
  ["github-readme-chrome-extension","ReadMe GLP","lukehanna12/reademe-glp"],
  ["chatgpt-chat-save-chrome-extension","ChatStore","lukehanna12/chatstore"]
 ]){
  assert.ok(store.includes(JSON.stringify([slug,name,repository])));
  assert.equal(PROJECT_SHOWCASE.find(p=>p.slug===slug)?.repository,repository);
 }
 assert.ok(store.includes("CREATE TABLE IF NOT EXISTS project_repository_link_migrations"));
 assert.ok(store.includes("WHERE user_id=? AND slug=? AND repository IS NULL"));
 assert.ok(store.includes("SELECT 1 FROM project_repository_link_migrations WHERE user_id=? AND slug=?"));
 assert.ok(store.includes("DELETE FROM project_repository_link_migrations WHERE user_id=?"));
 assert.ok(ui.includes("repository:saved.repository||null"));
 assert.ok(ui.includes('"github-readme-chrome-extension"'),"ReadMe GLP uses authoritative account repository associations");
 assert.ok(store.includes('["github-readme-chrome-extension","ReadMe GLP","lukehanna12/reademe-glp"]'));
 assert.match(store,/SELECT 1 FROM project_repository_link_migrations WHERE user_id=\? AND slug=\?/);
 assert.match(store,/UPDATE project_records SET repository=\?,updated_at=\? WHERE user_id=\? AND slug=\? AND repository IS NULL/);
});

test("Project cards order Ready, Review, In Progress, Coming Soon with stable ties",()=>{
 assert.equal(projectShowcaseStatus({repository:"owner/repo",status:"review"}),"Review");
 assert.equal(projectShowcaseStatus({repository:"owner/repo",status:"coming-soon"}),"Coming Soon");
 assert.equal(projectShowcaseStatus({repository:"owner/repo",status:"in-progress"}),"In Progress");
 assert.equal(projectShowcaseStatus({repository:null,status:"ready"}),"Ready");
 assert.equal(projectShowcaseStatus({repository:"owner/repo"}),"Ready");
 assert.equal(projectShowcaseStatus({docs:true}),"Ready");
 assert.equal(projectShowcaseStatus({repository:null}),"Coming Soon");
 const input=[
  {slug:"soon-a"},{slug:"progress",status:"in-progress",repository:"owner/repo"},
  {slug:"review-a",status:"review"},{slug:"ready-a",repository:"owner/repo"},{slug:"soon-b"},
  {slug:"ready-b",docs:true},{slug:"review-b",status:"review"}
 ];
 assert.deepEqual(sortProjectShowcase(input).map(p=>p.slug),[
  "ready-a","ready-b","review-a","review-b","progress","soon-a","soon-b"
 ]);
 assert.deepEqual(input.map(p=>p.slug),["soon-a","progress","review-a","ready-a","soon-b","ready-b","review-b"],
  "Sorting must not mutate the account-owned project array");
});

test("Projects header replaces count with the collections-style plus control and shortcut",()=>{
 const html=read("sites/_apex/app/index.html");
 const css=read("sites/_apex/app/assets/project-showcase.css");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 assert.doesNotMatch(html,/Your projects, organized in one place\./);
 assert.doesNotMatch(html,/id="project-count"/);
 assert.match(html,/id="project-create"[^>]*aria-keyshortcuts="Meta\+Shift\+N"/);
 assert.match(html,/id="project-create-tooltip"[^>]*role="tooltip"/);
 assert.match(html,/src="\/app\/assets\/add-collection\.v3\.svg"/);
 assert.match(html,/<kbd>⇧<\/kbd><kbd>⌘<\/kbd><kbd>N<\/kbd>/);
 assert.match(css,/project-create-tooltip/);
 assert.match(css,/transition-delay:\.15s,\.15s,\.15s/);
 assert.match(css,/project-create-plus-icon\{[\s\S]*?filter/);
 assert.match(css,/section-subheading\{[\s\S]*?margin:6px 0 13px/);
 assert.match(ui,/event\.code!=="KeyN"/);
 assert.match(ui,/openCreateDialog\(\)/);
 assert.doesNotMatch(ui,/\$\("project-count"\)/);
});


test("Curated icon and art assignments remain bound to permanent project slugs",()=>{
 const iconNames={
 "colosseum": "colosseum-lucide.v2",
 "bootscript": "paint-roller",
 "translucence-lab": "lightwork.v3",
 "github-readme-chrome-extension": "readme-glp.v2",
 "chatgpt-chat-save-chrome-extension": "folder-bookmark",
 "terminal-scalars": "terminal-scalars.v3",
 "unicode-plus": "unicode-plus.v2",
 "liquid-plexiglass-26": "lens",
 "3d-liquid-glass-26-swift-package": "move-3d",
 "apple-hig-reader": "apple-higs-reader.v4",
 "apple-adobe-fx": "apple-adobe-fx.v2",
 "protocol-monitor-pruner": "protocol-monitor-pruner.v2",
 "app-caviar": "opacity",
 "ozoning-board": "treehouse-ozoning.v4",
 "hidden-functions": "hidden-functions",
 "latexcel": "latexcel"
};
 const artworkSlugs=["bootscript","translucence-lab","github-readme-chrome-extension","chatgpt-chat-save-chrome-extension","colosseum","apple-hig-reader","terminal-scalars","app-caviar","hidden-functions","latexcel","unicode-plus","protocol-monitor-pruner","liquid-plexiglass-26","3d-liquid-glass-26-swift-package","ozoning-board"];
 assert.deepEqual(PROJECT_CARD_ICONS,iconNames);
 assert.deepEqual(Object.keys(PROJECT_CARD_IMAGES),artworkSlugs);
 const slugs=new Set(PROJECT_SHOWCASE.map(project=>project.slug));
 for(const [slug,name] of Object.entries(PROJECT_CARD_ICONS)){
  assert.ok(slugs.has(slug),"Icon references unknown project "+slug);
  assert.ok(read("sites/_apex/app/assets/project-icons/"+name+".svg").includes('viewBox="0 0 24 24"'));
 }
 for(const [slug,url] of Object.entries(PROJECT_CARD_IMAGES)){
  assert.ok(slugs.has(slug),"Image references unknown project "+slug);
  if(slug==="terminal-scalars"){
  assert.equal(url,"/assets/project-art/terminal-scalars-liquid-symmetry.v3.webp");
 }else if(slug==="app-caviar"){
  assert.equal(url,"/assets/project-art/app-caviar-source.v2.webp");
 }else if(["bootscript","hidden-functions","ozoning-board","liquid-plexiglass-26","3d-liquid-glass-26-swift-package"].includes(slug)){
  assert.ok(url.startsWith("/assets/project-art/")&&url.endsWith(".webp"));
 }else assert.ok(url.startsWith("https://"),"External image must use HTTPS");
 }
 const script=read("sites/_apex/app/assets/project-showcase.js");
 assert.ok(script.includes("PROJECT_CARD_ICONS[project.slug]"));
 assert.ok(script.includes("PROJECT_CARD_IMAGES[project.slug]"));
 assert.ok(script.includes("fallbackImagePath(index)"));
 assert.ok(script.includes('photo.addEventListener("error"'));
});

test("Assigned Lucide project icons display large, white, and without number circles",()=>{
 const js=read("sites/_apex/app/assets/project-showcase.js");
 const css=read("sites/_apex/app/assets/project-showcase.css");
 assert.match(js,/project-showcase-number--icon/);
 assert.match(js,/icon\.width=28;icon\.height=28/);
 assert.match(css,/\.project-showcase-number--icon\{[^}]*width:28px;height:28px;border-radius:0;background:transparent;color:#fff/);
 assert.match(css,/\.project-showcase-lucide\{[^}]*width:28px;height:28px/);
 assert.match(css,/filter:brightness\(0\) invert\(1\)/);
 assert.match(css,/\.project-showcase-number\{[^}]*border-radius:50%/);
});

test("Terminal Scalars uses the full-resolution Manfred Mohr gallery artwork as local WebP",()=>{
 const path="sites/_apex/assets/project-art/terminal-scalars-liquid-symmetry.v3.webp";
 const bytes=readFileSync(new URL("../"+path,import.meta.url));
 assert.equal(bytes.toString("ascii",0,4),"RIFF");
 assert.equal(bytes.toString("ascii",8,12),"WEBP");
 assert.ok(bytes.byteLength>5000&&bytes.byteLength<500000);
 assert.equal(PROJECT_CARD_IMAGES["terminal-scalars"],"/assets/project-art/terminal-scalars-liquid-symmetry.v3.webp");
});

test("App Caviar uses the attached local WebP and the requested artworks are assigned by slug",()=>{
 const path="sites/_apex/assets/project-art/app-caviar-source.v2.webp";
 const bytes=readFileSync(new URL("../"+path,import.meta.url));
 assert.equal(bytes.toString("ascii",0,4),"RIFF");
 assert.equal(bytes.toString("ascii",8,12),"WEBP");
 assert.ok(bytes.byteLength>100000&&bytes.byteLength<200000,"Retina-quality artwork within a 200 KB budget");
 // WebP VP8X or VP8 frame dimensions; no image decoder dependency.
 let width=0,height=0;
 for(let offset=12;offset+8<=bytes.length;){
  const chunk=bytes.toString("ascii",offset,offset+4),size=bytes.readUInt32LE(offset+4),at=offset+8;
  if(chunk==="VP8X"&&size>=10){width=bytes.readUIntLE(at+4,3)+1;height=bytes.readUIntLE(at+7,3)+1;break;}
  if(chunk==="VP8 "&&size>=10){width=bytes.readUInt16LE(at+6)&0x3fff;height=bytes.readUInt16LE(at+8)&0x3fff;break;}
  offset=at+size+(size&1);
 }
 assert.equal(width,1400);
 assert.ok(height>=1750&&height<=1752,"Preserve the original portrait aspect ratio");
 assert.equal(PROJECT_CARD_IMAGES["app-caviar"],"/assets/project-art/app-caviar-source.v2.webp");
 assert.equal(PROJECT_CARD_IMAGES["latexcel"],"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg");
 assert.equal(PROJECT_CARD_IMAGES["hidden-functions"],"/assets/project-art/hidden-functions-piranesi.v1.webp");
});
test("ChatStore and Colosseum use verified images of their actual artworks",()=>{
 const mural=PROJECT_CARD_IMAGES["chatgpt-chat-save-chrome-extension"];
 const pastoral=PROJECT_CARD_IMAGES.colosseum;
 assert.equal(mural,"https://gagosian.com/media/images/exhibitions/2023/takashi-murakami-understanding-the-new-cognitive-domain/c0V9eYeBTMHL_2400x2400.jpg");
 assert.equal(pastoral,"https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg/960px-Cole_Thomas_The_Course_of_Empire_The_Arcadian_or_Pastoral_State_1836.jpg");
 assert.ok(!mural.includes("ktga-hG5fIhh"),"Do not use the gallery installation image");
 assert.ok(!pastoral.includes("upload.wikimedia.org/wikipedia/commons/thumb"),"Use the verified Commons image thumbnail host");
});

test("Ozoning Board displays the revised user-supplied treehouse SVG at 28px",()=>{
 const svg=read("sites/_apex/app/assets/project-icons/treehouse-ozoning.v3.svg");
 assert.equal(PROJECT_CARD_ICONS["ozoning-board"],"treehouse-ozoning.v4");
 assert.match(svg,/viewBox="0 0 24 24"/);
 assert.match(svg,/stroke-width="2"/);
 assert.match(svg,/M12 19h8\.3a1 1 0 00\.7-1\.7L18 14/);
 assert.ok(svg.includes('M4 9v4.5h9V9L8.5 4.5z'),"Revised cabin and peaked roof");
 assert.ok(svg.includes('M6.5 13.5 L6.5 22'),"Latest centered ladder rail");
 assert.ok(!svg.includes('M5.5 13.5V22'),"Older ladder rail must not return");
 assert.ok(!svg.includes('M9 13.5V22'),"Earlier ladder right rail was removed");
 assert.ok(svg.includes('M9 19.5H5.5'),"Revised ladder rung");
 assert.ok(!svg.includes('M13 8.5H7v14'),"Retired earlier cabin geometry");
 const js=read("sites/_apex/app/assets/project-showcase.js");
 assert.ok(js.includes('icon.width=28;icon.height=28'));
});

test("Unicode Plus and Protocol Monitor Pruner use the exact supplied SVG geometry",()=>{
 for(const [slug,name,geometry] of [["unicode-plus","unicode-plus.v2","<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M10.667 5.5V9\" />\n  <path d=\"M15.5 12.5v6H19\" />\n  <path d=\"M18.5 5.5v10\" />\n  <path d=\"M2 4a2 2 0 012-2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-1.936-1.5z\" />\n  <path d=\"M2.5 13H5\" />\n  <path d=\"M2.5 15.75H5\" />\n  <path d=\"M2.5 18.5H5\" />\n  <path d=\"M3.5 5.5H4a1 1 0 011 1V8a1 1 0 01-1 1h-.5\" />\n  <path d=\"M8 5.5v13\" />\n  <path d=\"m8.25 13 2 3 2-3v5.5\" />\n  <rect x=\"13.333\" y=\"5.5\" width=\"2.5\" height=\"3.5\" ry=\"1\" />\n</svg>\n"],["protocol-monitor-pruner","protocol-monitor-pruner.v2","<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M1 13.5 3.5 17v3.015l1 .485V17L8 13.5z\" />\n  <path d=\"M15.5 12H11\" />\n  <path d=\"M15.5 8h-5\" />\n  <path d=\"M19.5 17V5a2 2 0 00-2-2h-13\" />\n  <path d=\"M6.5 11V5a2 2 0 10-4 0v2a1 1 0 001 1h3\" />\n  <path d=\"M9 21h12a2 2 0 002-2v-1a1 1 0 00-1-1H12a1 1 0 00-1 1v1a2 2 0 11-4 0\" />\n</svg>\n"]]){
  assert.equal(PROJECT_CARD_ICONS[slug],name);
  assert.equal(read("sites/_apex/app/assets/project-icons/"+name+".svg"),geometry);
  assert.equal(read("sites/_apex/assets/project-icons/"+name+".svg"),geometry);
 }
 assert.match(read("sites/_apex/app/assets/project-showcase.css"),/filter:brightness\(0\) invert\(1\)/);
});

test("Ozoning treehouse release uses a new asset path and a refreshed module chain",()=>{
 const dir="sites/_apex/app/assets/";
 const v1=read(dir+"project-icons/treehouse-ozoning.svg");
 const v2=read(dir+"project-icons/treehouse-ozoning.v2.svg");
 const v3=read(dir+"project-icons/treehouse-ozoning.v3.svg");
 assert.equal(v1,v2,"Earlier two SVG filenames contain the preceding approved drawing");
 assert.notEqual(v2,v3,"The third SVG file contains the latest user-supplied ladder");
 assert.ok(v1.includes('M4 9v4.5h9V9L8.5 4.5z'),"Both filenames hold the revised image");
 assert.ok(v2.includes('M4 9v4.5h9V9L8.5 4.5z'));
 assert.ok(!v2.includes('M13 8.5H7v14'));
 assert.ok(v3.includes('M6.5 13.5 L6.5 22'));
 assert.ok(!v3.includes('M5.5 13.5V22'));
 assert.ok(read(dir+"project-showcase.js").includes('"ozoning-board":"treehouse-ozoning.v4"'));
 assert.ok(read(dir+"project-readme-ui.js").includes('from "./project-showcase.js?project-art=v14"'));
 assert.ok(read(dir+"dashboard.js").includes('from "./project-readme-ui.js?project-art=v14"'));
 assert.ok(read("sites/_apex/app/index.html").includes('src="/app/assets/dashboard.js?project-art=v14"'));
});

test("Apple HIGs Reader uses the exact user-supplied v4 icon",()=>{
 assert.equal(PROJECT_CARD_ICONS["apple-hig-reader"],"apple-higs-reader.v4");
 const svg=read("sites/_apex/app/assets/project-icons/apple-higs-reader.v4.svg");
 assert.equal(svg,read("sites/_apex/assets/project-icons/apple-higs-reader.v4.svg"),
  "Authenticated and public cards share identical authored SVG");
 assert.ok(svg.includes('viewBox="0 0 24 24"'));
 assert.ok(svg.includes('stroke="currentColor"')&&svg.includes('stroke-width="2"'));
 for(const fragment of [
  'm11.25 10.5 1.75 7','M12 6.528V3a1 1 0 011-1h0',
  'M14 22a2 2 0 012-2h4a2 2 0 012 2',
  'M21.971 12A15 15 0 0022 11a6 6 0 00-10-4.472',
  'M5.5 9.5V15','M8.5 9.5v9','<circle cx="18" cy="15" r="2" />'
 ])assert.ok(svg.includes(fragment),"Missing user-supplied SVG geometry: "+fragment);
 assert.ok(read("sites/_apex/app/assets/project-showcase.js").includes('icon.width=28;icon.height=28'));
});

test("Apple worm v2 is a short hooked curl with a separate head, not the former S",()=>{
 const original=read("sites/_apex/app/assets/project-icons/apple-worm.svg");
 const updated=read("sites/_apex/app/assets/project-icons/apple-worm.v2.svg");
 assert.notEqual(original,updated,"Versioned worm must change shape");
 assert.ok(original.includes('M16.5 11.3c-1.8-1.1'),"Original worm remains available for old references");
 assert.ok(updated.includes('M12.4 17.8c-1-1.7-.5-3.3 1.1-4.2'),"Updated worm has one continuous curved hook");
 assert.ok(!updated.includes('2.4 1.3 2.3 2.6'),"S-shaped middle reversal is removed");
 assert.ok(updated.includes('<circle cx="17.35" cy="13.65" r="1"'),"Separate, rounded head is retained");
 assert.ok(read("sites/_apex/app/assets/project-showcase.js").includes('"apple-hig-reader":"apple-higs-reader.v4"'));
});

test("Apple worm v3 is outside the right side with no head or internal squiggle",()=>{
 const svg=read("sites/_apex/app/assets/project-icons/apple-worm.v3.svg");
 const old=read("sites/_apex/app/assets/project-icons/apple-worm.v2.svg");
 assert.notEqual(svg,old,"New icon differs from the earlier worm");
 assert.equal(PROJECT_CARD_ICONS["apple-hig-reader"],"apple-higs-reader.v4",
  "v3 stays archived while v4 is active");
 assert.ok(svg.includes('M19.25 13.1q1.15-1.6 3.1-1.1'),"Worm protrudes beyond right edge");
 assert.ok(svg.includes('scale(.9)'),"Apple shifted inward to provide room for outside worm");
 assert.ok(svg.includes('vector-effect="non-scaling-stroke"'),"Apple preserves Lucide stroke weight at its new scale");
 assert.ok(!svg.includes("<circle"),"No separate head");
 assert.ok(!svg.includes("M12.4 17.8"),"No internal worm body");
 assert.ok(!svg.includes("M16.5 11.3"),"No old S-shaped body");
});

test("Colosseum and Terminal Scalars use the exact revised user-supplied SVG geometry",()=>{
 for(const [slug,name,geometry] of [["colosseum","colosseum-lucide.v2","<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M1.5 21h21\" />\n  <path d=\"m11 13-.2-2.4\" />\n  <path d=\"M11.8 20.5v-4\" />\n  <path d=\"M18 13.5v-.4\" />\n  <path d=\"M18 20.8v-3.7\" />\n  <path d=\"M2 10.2c3.5-1.6 6.8-2.8 10.5-2.7\" />\n  <path d=\"M2 15.2a33 33 0 0120-.2\" />\n  <path d=\"M2 21V6.4C4.7 4.5 8.7 3 12 3l3.4 18\" />\n  <path d=\"M21 21v-4.3\" />\n  <path d=\"M22 21v-9c-2.4-.9-5.1-1.5-8-1.5\" />\n  <path d=\"m5 14-.1-2.2\" />\n  <path d=\"M5.1 20.8v-3.4\" />\n  <path d=\"m8 13-.1-2.1\" />\n  <path d=\"M8.6 20.8v-3.9\" />\n</svg>\n"],["terminal-scalars","terminal-scalars.v3","<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M 19 3 A2 2 0 0 1 21 5\" />\n  <path d=\"M 21 5 L 21 19\" />\n  <path d=\"M 3 5 A2 2 0 0 1 5 3\" />\n  <path d=\"M 5 3 L 19 3\" />\n  <path d=\"M10.6 21v-1.15\" />\n  <path d=\"M11 13h4\" />\n  <path d=\"M13.4 21v-2.2\" />\n  <path d=\"M16.2 21v-2\" />\n  <path d=\"M21 19 A2 2 0 0 1 19 21\" />\n  <path d=\"M3 19 L3 5\" />\n  <path d=\"M5 21 A2 2 0 0 1 3 19\" />\n  <path d=\"m7 11 2-2-2-2\" />\n  <path d=\"M7.8 21v-2.75\" />\n</svg>\n"]]){
  assert.equal(PROJECT_CARD_ICONS[slug],name);
  assert.equal(read("sites/_apex/app/assets/project-icons/"+name+".svg"),geometry);
  assert.equal(read("sites/_apex/assets/project-icons/"+name+".svg"),geometry);
 }
 assert.ok(PROJECT_CARD_IMAGES.colosseum.includes('Cole_Thomas_The_Course_of_Empire'),"Colosseum hover artwork preserved");
 assert.ok(read("sites/_apex/app/assets/project-showcase.js").includes('icon.width=28;icon.height=28'));
});

test("Liquid Plexiglass 26 and Ozoning Board map to the correct authenticated artworks",()=>{
 const storm=PROJECT_CARD_IMAGES["liquid-plexiglass-26"];
 const cardo=PROJECT_CARD_IMAGES["3d-liquid-glass-26-swift-package"];
 const church=PROJECT_CARD_IMAGES["ozoning-board"];
 assert.equal(storm,"/assets/project-art/liquid-plexiglass-26-rembrandt-storm.v2.webp");
 assert.equal(cardo,"/assets/project-art/3d-liquid-glass-cotan-cardo.v2.webp");
 assert.equal(church,"/assets/project-art/ozoning-board-el-khasne.v1.webp");
 assert.ok(!storm.includes("/all-works"),"Use a direct artwork image, not the WikiArt gallery page");
 assert.ok(!church.includes("/all-works"),"Use a direct artwork image, not the WikiArt gallery page");
 assert.equal(PROJECT_CARD_ICONS["liquid-plexiglass-26"],"lens","Liquid Plexiglass now uses the requested Lucide lens icon");
 assert.equal(PROJECT_CARD_ICONS["ozoning-board"],"treehouse-ozoning.v4","Use the new user-supplied Ozoning Board icon");
 assert.ok(read("sites/_apex/app/assets/project-showcase.js").includes("PROJECT_CARD_IMAGES[project.slug]"),"Keep per-project hover assignment");
});

test("Rembrandt artwork uses its own cover alignment and no Warhol-specific zoom",()=>{
 const css=read("sites/_apex/app/assets/project-showcase.css");
 const publicCSS=read("sites/_apex/assets/public-projects.css");
 for(const source of [css,publicCSS]){
  assert.ok(source.includes('object-position:50% 66%'));
  assert.ok(!source.includes('translateY(1.5%) scale(1.12)'));
  assert.ok(source.includes('object-fit:cover;object-position:center'));
  assert.ok(source.includes('transition:opacity .5s ease-out,transform .5s ease-out'));
 }
 assert.ok(read("sites/_apex/app/index.html").includes('/app/assets/project-showcase.css?artwork=rembrandt-cotan-v1-badges-v2'));
});

test("ReadMe GLP uses Monet Gorge of the Petite Creuse from MFA Boston",()=>{
 const url=PROJECT_CARD_IMAGES["github-readme-chrome-extension"];
 assert.equal(url,"https://upload.wikimedia.org/wikipedia/commons/f/f0/Monet_-_Valley_of_the_Petite_Creuse%2C_1889.jpg");
 assert.match(url,/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
 assert.equal(PROJECT_CARD_ICONS["github-readme-chrome-extension"],"readme-glp.v2","Use the supplied ReadMe GLP icon");
 const js=read("sites/_apex/app/assets/project-showcase.js");
 assert.match(js,/PROJECT_CARD_IMAGES\[project\.slug\]/,"ReadMe GLP shares the standard image reveal");
});


test("Lightwork painting and requested App Caviar/Liquid Plexiglass 26 icon handoff",()=>{
 assert.equal(PROJECT_CARD_IMAGES["translucence-lab"],
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg/960px-The_Calling_of_Saint_Matthew-Caravaggo_%281599-1600%29.jpg");
 assert.equal(PROJECT_CARD_ICONS["app-caviar"],"opacity");
 assert.equal(PROJECT_CARD_ICONS["liquid-plexiglass-26"],"lens");
 const lens=read("sites/_apex/app/assets/project-icons/lens.svg");
 const opacity=read("sites/_apex/app/assets/project-icons/opacity.svg");
 assert.match(lens,/<circle cx="12" cy="12" r="10" \/>/);
 assert.match(lens,/<path d="M6 12a6 6 0 016-6" \/>/);
 assert.match(opacity,/<path d="M21 6v13a2 2 0 0 1-2 2H6" \/>/);
});

test("Upgraded art uses real higher-resolution WebP within bounded budgets",()=>{
 for(const [slug,minW,minH,maxBytes] of [["terminal-scalars",2136,2133,500000],["bootscript",1000,700,180000],["hidden-functions",1600,1190,300000],["ozoning-board",1016,1280,180000],["liquid-plexiglass-26",1800,2237,300000],["3d-liquid-glass-26-swift-package",2048,1546,300000]]){
  const url=PROJECT_CARD_IMAGES[slug],bytes=readFileSync(new URL("../sites/_apex"+url,import.meta.url));
  assert.equal(bytes.toString("ascii",0,4),"RIFF");assert.equal(bytes.toString("ascii",8,12),"WEBP");
  assert.ok(bytes.length<=maxBytes,slug+" asset budget");
  let w=0,h=0;
  for(let p=12;p+8<=bytes.length;){
   const kind=bytes.toString("ascii",p,p+4),n=bytes.readUInt32LE(p+4),a=p+8;
   if(kind==="VP8X"&&n>=10){w=bytes.readUIntLE(a+4,3)+1;h=bytes.readUIntLE(a+7,3)+1;break;}
   if(kind==="VP8 "&&n>=10){w=bytes.readUInt16LE(a+6)&0x3fff;h=bytes.readUInt16LE(a+8)&0x3fff;break;}
   p=a+n+(n&1);
  }
  assert.ok(w>=minW&&h>=minH,slug+" decoded dimensions "+w+"x"+h);
 }
});
