import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("all Git-managed DoFinances page families share system typography and dark tokens",async()=>{
  const foundation=await read("../sites/_apex/assets/site-foundation.css");
  const expected={
    "--ui-canvas":"#171717",
    "--ui-sidebar":"#171717",
    "--ui-divider":"#303030",
    "--ui-surface":"#292929",
    "--ui-elevated":"#202020",
    "--ui-selected":"#303030",
    "--ui-text":"#f4f4f4",
    "--ui-secondary":"#b4b4b4",
  };
  for(const [name,color] of Object.entries(expected)){
    assert.ok(foundation.includes(name+": "+color+";"),"missing shared design token "+name);
  }
  assert.match(foundation,/color-scheme:\s*dark/);
  assert.match(foundation,/--ui-font-sans:\s*ui-sans-serif, system-ui/);
  assert.match(foundation,/font-family:\s*var\(--ui-font-sans\)/);
  assert.doesNotMatch(foundation,/@font-face|https?:\/\/|fonts\.googleapis\.com/i);

  for(const file of ["../sites/_apex/index.html","../sites/_apex/app/index.html",
    "../sites/_apex/verify/index.html","../sites/_apex/reset/index.html"]){
    const html=await read(file);
    assert.match(html,/href="\/assets\/site-foundation\.css"/,file);
    assert.match(html,/name="theme-color" content="#171717"/,file);
  }

  const app=await read("../sites/_apex/app/assets/workspace-theme.css");
  const homepage=await read("../sites/_apex/assets/site.css");
  assert.doesNotMatch(app,/:root\s*\{\s*color-scheme/,
    "workspace palette should have one shared source");
  assert.match(homepage,/background:\s*var\(--ui-canvas\)/);
  assert.match(homepage,/background:\s*var\(--ui-surface\)/);
  assert.match(homepage,/color:\s*var\(--ui-secondary\)/);
});

test("login and Studio compile the same foundation while retaining authentication design",async()=>{
  const css=await read("../src/styles.css");
  const studio=await read("../index.html");
  const jsx=await read("../src/components/Auth3.jsx");
  assert.match(css,/@import "tailwindcss";\s*@import "\.\.\/sites\/_apex\/assets\/site-foundation\.css";/);
  assert.match(css,/body\s*\{\s*background-color:\s*var\(--ui-canvas\)/);
  assert.match(css,/--font-sans:\s*ui-sans-serif, system-ui, sans-serif/);
  assert.match(studio,/name="theme-color" content="#171717"/);
  assert.match(jsx,/useState\("dark"\)/);
  assert.match(jsx,/setTheme\(isDark \? "light" : "dark"\)/);
  assert.match(jsx,/\/api\/auth\//);
});

test("homepage and recovery pages preserve their links and live form controls",async()=>{
  const home=await read("../sites/_apex/index.html");
  const verify=await read("../sites/_apex/verify/index.html");
  const reset=await read("../sites/_apex/reset/index.html");
  assert.match(home,/class="home-actions"/);
  for(const url of ["/login","/login?mode=signup","/app"]){
    assert.ok(home.includes('href="'+url+'"'),url);
  }
  assert.match(verify,/id="verify"/);
  assert.match(verify,/\/verify\/assets\/verification\.js/);
  assert.match(verify,/\/assets\/account-security\.css/);
  assert.doesNotMatch(verify,/\/app\/assets\//);
  assert.match(reset,/id="reset-form"/);
  assert.match(reset,/\/reset\/assets\/reset\.js/);
  assert.match(reset,/\/assets\/account-security\.css/);
  assert.doesNotMatch(reset,/\/app\/assets\//);
  const security=await read("../sites/_apex/assets/account-security.css");
  assert.match(security,/background:\s*var\(--ui-elevated\)/);
  assert.match(security,/background:\s*var\(--ui-field\)/);
});
