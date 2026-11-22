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
  slug:"3d-liquid-glass-26-swift-package",name:"3D Liquid Glass",kind:"Swift package",repository:null
 });
 assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug==="ozoning-board"),{
  slug:"ozoning-board",name:"Ozoning Board",kind:"Project",repository:null
 });
 for(const [slug,name] of [["hidden-functions","Hidden Functions"],["latexcel","LaTeXceL"]]){
  assert.deepEqual(PROJECT_SHOWCASE.find(p=>p.slug===slug),{
   slug,name,kind:"Project",repository:null,status:"coming-soon"
  });
  assert.equal(projectShowcaseStatus(PROJECT_SHOWCASE.find(p=>p.slug===slug)),"Coming Soon");
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
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.status==="in-progress").map(p=>p.slug),[
  "bootscript","translucence-lab","github-readme-chrome-extension",
  "chatgpt-chat-save-chrome-extension","apple-hig-reader","unicode-plus","protocol-monitor-pruner"
 ]);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.docs).map(p=>p.slug),[
  "bootscript","translucence-lab","github-readme-chrome-extension",
  "chatgpt-chat-save-chrome-extension"
 ]);
 assert.deepEqual(PROJECT_SHOWCASE.filter(p=>p.docs&&!p.repository).map(p=>p.slug),[]);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="colosseum").status,undefined);
 assert.equal(PROJECT_SHOWCASE.find(p=>p.slug==="unicode-plus").status,"in-progress");
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
 assert.match(permissions,/\.pm-rule-row\[data-enabled="false"\] \.pm-rule-status\{color:#747474\}/);
 assert.match(source,/const status=projectShowcaseStatus\(project\)/);
 assert.match(store,/\["protocol-monitor-pruner","Protocol Monitor Pruner","lukehanna12\/protocol-monitor-pruner"\]/);
 assert.match(source,/addEventListener\("pointerenter",reveal/);
 assert.match(source,/addEventListener\("focusin",reveal/);
 assert.match(source,/if\(active\)card\.href/);
 assert.match(source,/project\.docs===true/);
 assert.match(source,/Local Docs · Editable/);
 assert.match(source,/else card\.tabIndex=0/);
});
test("Projects uses native static catalog without exposing private data in Studio",()=>{
 const html=read("sites/_apex/app/index.html");
 const ui=read("sites/_apex/app/assets/project-readme-ui.js");
 const store=read("edge/auth-store-projects.mjs");
 const workflow=read(".github/workflows/site.yml");
 assert.match(html,/href="\/app\/assets\/project-showcase\.css\?liquid-plexiglass-crop=112-shift-down-1_5"/);
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

test("Project cards order Active → In Progress → Coming Soon with stable ties",()=>{
 assert.equal(projectShowcaseStatus({repository:"owner/repo",status:"in-progress"}),"In Progress");
 assert.equal(projectShowcaseStatus({repository:"owner/repo"}),"Active");
 assert.equal(projectShowcaseStatus({docs:true}),"Active");
 assert.equal(projectShowcaseStatus({repository:null}),"Coming Soon");
 const input=[
  {slug:"soon-a"},{slug:"in-progress-a",status:"in-progress",repository:"owner/repo"},
  {slug:"active-a",repository:"owner/repo"},{slug:"soon-b"},
  {slug:"active-b",docs:true},{slug:"in-progress-b",status:"in-progress"}
 ];
 assert.deepEqual(sortProjectShowcase(input).map(p=>p.slug),[
  "active-a","active-b","in-progress-a","in-progress-b","soon-a","soon-b"
 ]);
 assert.deepEqual(input.map(p=>p.slug),["soon-a","in-progress-a","active-a","soon-b","active-b","in-progress-b"],
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
 "colosseum": "colosseum-lucide",
 "bootscript": "paint-roller",
 "translucence-lab": "lightbulb",
 "github-readme-chrome-extension": "file-pen",
 "chatgpt-chat-save-chrome-extension": "folder-bookmark",
 "terminal-scalars": "square-terminal",
 "unicode-plus": "square-radical",
 "liquid-plexiglass-26": "lens",
 "3d-liquid-glass-26-swift-package": "move-3d",
 "apple-hig-reader": "apple-higs-reader.v4",
 "apple-adobe-fx": "blend",
 "protocol-monitor-pruner": "funnel-code",
 "app-caviar": "opacity",
 "ozoning-board": "treehouse-ozoning.v3",
 "hidden-functions": "hidden-functions",
 "latexcel": "latexcel"
};
 const artworkSlugs=["bootscript","translucence-lab","github-readme-chrome-extension","chatgpt-chat-save-chrome-extension","colosseum","apple-hig-reader","terminal-scalars","app-caviar","hidden-functions","latexcel","unicode-plus","protocol-monitor-pruner","liquid-plexiglass-26","ozoning-board"];
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
  assert.equal(url,"/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp");
 }else if(slug==="app-caviar"){
  assert.equal(url,"/assets/project-art/app-caviar-source.v1.webp");
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

test("Terminal Scalars uses the supplied Manfred Mohr artwork as local WebP",()=>{
 const path="sites/_apex/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp";
 const bytes=readFileSync(new URL("../"+path,import.meta.url));
 assert.equal(bytes.toString("ascii",0,4),"RIFF");
 assert.equal(bytes.toString("ascii",8,12),"WEBP");
 assert.ok(bytes.byteLength>5000&&bytes.byteLength<40000);
 assert.equal(PROJECT_CARD_IMAGES["terminal-scalars"],"/assets/project-art/terminal-scalars-liquid-symmetry.v1.webp");
});

test("App Caviar uses the attached local WebP and the requested artworks are assigned by slug",()=>{
 const path="sites/_apex/assets/project-art/app-caviar-source.v1.webp";
 const bytes=readFileSync(new URL("../"+path,import.meta.url));
 assert.equal(bytes.toString("ascii",0,4),"RIFF");
 assert.equal(bytes.toString("ascii",8,12),"WEBP");
 assert.ok(bytes.byteLength>2000&&bytes.byteLength<20000);
 assert.equal(PROJECT_CARD_IMAGES["app-caviar"],"/assets/project-art/app-caviar-source.v1.webp");
 assert.equal(PROJECT_CARD_IMAGES["latexcel"],"https://upload.wikimedia.org/wikipedia/commons/2/21/Night_Windows_Hopper_MOMA_1928.jpg");
 assert.equal(PROJECT_CARD_IMAGES["hidden-functions"],"https://api.nga.gov/iiif/5fcee9f7-9c78-4432-96c2-4228fc697aa7/full/!800,800/0/default.jpg");
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
 assert.equal(PROJECT_CARD_ICONS["ozoning-board"],"treehouse-ozoning.v3");
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

test("Protocol Monitor Pruner uses the approved white funnel-code icon with a genuine rim gap",()=>{
 assert.equal(PROJECT_CARD_ICONS["protocol-monitor-pruner"],"funnel-code");
 const svg=read("sites/_apex/app/assets/project-icons/funnel-code.svg");
 assert.match(svg,/viewBox="0 0 24 24"/);
 assert.match(svg,/stroke="#fff" stroke-width="2"/);
 assert.ok(svg.includes('M2.75 5.25h2.65m13.2 0h2.65'),"Funnel rim consists of two separated segments");
 assert.ok(svg.includes('m10.4 3.33-1.92 1.92 1.92 1.92m3.2-3.84 1.92 1.92-1.92 1.92'),"Code chevrons occupy the cutout");
 const css=read("sites/_apex/app/assets/project-showcase.css");
 assert.match(css,/filter:brightness\(0\) invert\(1\)/);
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
 assert.ok(read(dir+"project-showcase.js").includes('"ozoning-board":"treehouse-ozoning.v3"'));
 assert.ok(read(dir+"project-readme-ui.js").includes('from "./project-showcase.js?project-art=v10"'));
 assert.ok(read(dir+"dashboard.js").includes('from "./project-readme-ui.js?project-art=v10"'));
 assert.ok(read("sites/_apex/app/index.html").includes('src="/app/assets/dashboard.js?project-art=v12"'));
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

test("Colosseum uses the approved white Lucide-style Coliseum SVG",()=>{
 const iconPath="sites/_apex/app/assets/project-icons/colosseum-lucide.svg";
 const svg=read(iconPath);
 assert.equal(PROJECT_CARD_ICONS.colosseum,"colosseum-lucide");
 assert.ok(svg.includes('viewBox="0 0 24 24"'));
 assert.ok(svg.includes('stroke="#ffffff" stroke-width="2"'));
 assert.ok(svg.includes('stroke-linecap="round" stroke-linejoin="round"'));
 assert.ok(svg.includes('M2 21V6.4C4.7 4.5 8.7 3 12 3l3.4 18H22'),"Original approved facade retained");
 assert.ok(svg.includes('M1.5 21h21'),"Original approved foundation retained");
 assert.ok(PROJECT_CARD_IMAGES.colosseum.includes('Cole_Thomas_The_Course_of_Empire'),"Colosseum hover artwork preserved");
 assert.ok(read("sites/_apex/app/assets/project-showcase.js").includes('icon.width=28;icon.height=28'));
});

test("Liquid Plexiglass 26 and Ozoning Board map to the correct authenticated artworks",()=>{
 const warhol=PROJECT_CARD_IMAGES["liquid-plexiglass-26"];
 const church=PROJECT_CARD_IMAGES["ozoning-board"];
 assert.equal(warhol,"https://museum.bucknell.edu/files/2020/07/Warhol_Glasses-scaled.jpg");
 assert.equal(church,"https://upload.wikimedia.org/wikipedia/commons/a/a9/El_Khasne%2C_Petra_Frederic_Edwin_Church.jpg");
 assert.ok(!warhol.includes("/all-works"),"Use a direct artwork image, not the WikiArt gallery page");
 assert.ok(!church.includes("/all-works"),"Use a direct artwork image, not the WikiArt gallery page");
 assert.equal(PROJECT_CARD_ICONS["liquid-plexiglass-26"],"lens","Liquid Plexiglass now uses the requested Lucide lens icon");
 assert.equal(PROJECT_CARD_ICONS["ozoning-board"],"treehouse-ozoning.v3","Keep the existing Ozoning Board icon");
 assert.ok(read("sites/_apex/app/assets/project-showcase.js").includes("PROJECT_CARD_IMAGES[project.slug]"),"Keep per-project hover assignment");
});

test("Liquid Plexiglass 26 hover artwork is cropped by 12% and shifted down 1.5% without changing other project cards",()=>{
 const css=read("sites/_apex/app/assets/project-showcase.css");
 const html=read("sites/_apex/app/index.html");
 const js=read("sites/_apex/app/assets/project-showcase.js");
 const selector='.project-showcase-card[data-project-slug="liquid-plexiglass-26"]';
 assert.ok(css.includes(selector),'The crop must target only Liquid Plexiglass 26');
 assert.match(css,/\.project-showcase-card\[data-project-slug="liquid-plexiglass-26"\] \.project-showcase-photo\{\s*transform:translateY\(1\.5%\) scale\(1\.232\)/,'Retains the 1.232 entrance scale with a 1.5% downward shift');
 assert.match(css,/\.project-showcase-card\[data-project-slug="liquid-plexiglass-26"\]\.is-photo-ready:is\(:hover,:focus-visible,:focus-within\) \.project-showcase-photo\{\s*transform:translateY\(1\.5%\) scale\(1\.12\)/,'Resting photo is 12% closer and 1.5% lower');
 assert.ok(css.includes('object-fit:cover;object-position:center'),'Center crop and cover remain intact');
 assert.ok(css.includes('transition:opacity .5s ease-out,transform .5s ease-out'),'Hover fade and zoom animation remain');
 assert.ok(css.includes('overflow:hidden'),'Card continues clipping zoomed image');
 assert.ok(js.includes('card.dataset.projectSlug=project.slug'),'Per-project attribute exists');
 assert.ok(html.includes('/app/assets/project-showcase.css?liquid-plexiglass-crop=112-shift-down-1_5'),'Updated stylesheet bypasses old cache');
});

test("ReadMe GLP uses Monet Gorge of the Petite Creuse from MFA Boston",()=>{
 const url=PROJECT_CARD_IMAGES["github-readme-chrome-extension"];
 assert.equal(url,"https://upload.wikimedia.org/wikipedia/commons/f/f0/Monet_-_Valley_of_the_Petite_Creuse%2C_1889.jpg");
 assert.match(url,/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
 assert.equal(PROJECT_CARD_ICONS["github-readme-chrome-extension"],"file-pen","Keep ReadMe GLP's icon");
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
