import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PROJECT_SHOWCASE} from "../sites/_apex/assets/public-projects-catalog.js";
import {projectTitleLength,validateProjectTitle,projectTitleLines,projectTitleWidthShare,projectTitleRatio} from "../sites/_apex/assets/public-projects-title.js";
test("title limits: 30 graphemes and 15 per word, inclusive",()=>{
 const valid="123456789012345 12345678901234";
 assert.equal(projectTitleLength(valid),30);
 assert.equal(validateProjectTitle(valid),valid);
 assert.throws(()=>validateProjectTitle("123456789012345 123456789012345"),/30 characters/);
 assert.throws(()=>validateProjectTitle("1234567890123456"),/15 characters/);
 assert.throws(()=>validateProjectTitle(""),TypeError);
 assert.equal(projectTitleLength("e\u0301"),1);
 for(const p of PROJECT_SHOWCASE)assert.equal(validateProjectTitle(p.name),p.name);
});
test("titles are greedily wrapped only at word boundaries",()=>{
 assert.deepEqual(projectTitleLines("3D Liquid Glass"),["3D Liquid Glass"]);
 assert.deepEqual(projectTitleLines("Liquid Plexiglass 26"),["Liquid","Plexiglass 26"]);
 assert.deepEqual(projectTitleLines("Protocol Monitor Pruner"),["Protocol","Monitor Pruner"]);
 assert.deepEqual(projectTitleLines("Terminal Scalars"),["Terminal","Scalars"]);
 assert.deepEqual(projectTitleLines("abcdefghij abcdefghij abcdefgh"),["abcdefghij","abcdefghij","abcdefgh"]);
 for(const p of PROJECT_SHOWCASE){
  const lines=projectTitleLines(p.name);
  assert.equal(lines.join(" "),p.name);
  assert.ok(lines.every(x=>projectTitleLength(x)<=15));
  if(projectTitleLength(p.name)>15)assert.ok(lines.length>1);
 }
});
test("width targets are anchored to 9 and 15 characters and use measured glyphs",()=>{
 assert.ok(Math.abs(projectTitleWidthShare(9)-.55)<1e-12);
 assert.ok(Math.abs(projectTitleWidthShare(15)-.8)<1e-12);
 assert.ok(projectTitleWidthShare(12)>.55&&projectTitleWidthShare(12)<.8);
 assert.ok(Math.abs(projectTitleRatio(["Colosseum"],[550])-.1)<1e-12);
 assert.ok(Math.abs(projectTitleRatio(["3D Liquid Glass"],[800])-.1)<1e-12);
 assert.ok(Math.abs(projectTitleRatio(["Protocol","Monitor Pruner"],[420,700])-100*projectTitleWidthShare(14)/700)<1e-12);
});
test("public cards retain artwork and status, omit footer rows and pin the bold title to equal insets",()=>{
 const entry=readFileSync(new URL("../sites/_apex/assets/public-projects-entry.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../sites/_apex/assets/public-projects.css",import.meta.url),"utf8");
 assert.match(entry,/upper\.append\(top,title\)/);
 assert.match(entry,/if\(!detail\)details\.append\(action\)/);
 assert.doesNotMatch(entry,/project-showcase-(details|row)/);
 assert.doesNotMatch(css,/project-showcase-(details|row)/);
 assert.match(css,/font-weight:700;\s*\/\* 100cqw/);
 assert.match(css,/padding:var\(--project-card-inset\)/);
 assert.match(css,/100cqw - var\(--project-card-inset\)/);
 assert.match(css,/margin:auto 0 0;color:#fff/);
});
