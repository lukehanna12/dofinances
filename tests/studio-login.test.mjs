import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Studio root is the only React entrypoint; the apex /login reuses its build", async () => {
  const root = await load("../index.html");
  assert.match(root, /<title>Sign in · Dofinances<\/title>/);
  assert.match(root, /auth3-studio-preview-v1/);
  const vite = await load("../vite.config.mjs");
  assert.match(vite, /home: resolve\(root, "index\.html"\)/);
  assert.doesNotMatch(vite, /login: resolve/);
  const workflow = await load("../.github/workflows/site.yml");
  assert.match(workflow, /cp dist\/index\.html sites\/_apex\/login\/index\.html/);
  assert.match(workflow, /cp -R dist\/assets\/\. sites\/_apex\/assets\//);
});

test("original non-social Auth-3 layout utilities remain unchanged", async () => {
  const source = await load("../src/components/Auth3.jsx");
  const contract = JSON.parse(await load("./fixtures/auth3-source-class-contract.json"));
  assert.equal(contract.classes.length, 28);
  const classes = [...source.matchAll(/className="([^"]+)"/g)]
    .map(match => match[1]).filter(value => value !== "auth3-theme-toggle");
  // Only the 3 static, disabled social buttons were replaced with enabled-aware controls.
  for(const expected of [...contract.classes.slice(0,16),...contract.classes.slice(23)]){
    assert.ok(classes.includes(expected),"Core UI utility lost: "+expected);
  }
  assert.match(source,/const signInProviders=/);
  assert.doesNotMatch(source,/chatgpt/i);
  assert.doesNotMatch(source,/data-oai-siwc-button/);
  assert.doesNotMatch(source,/Apple \(not connected\)/);
});

test("Google and GitHub sign-in providers preserve the Auth-3 backdrop and theme icon",async()=>{
  const source=await load("../src/components/Auth3.jsx");
  assert.equal((source.match(/<svg\b/g)||[]).length,1);
  assert.match(source,/photo-1709562493281-03c47edcb046/);
  assert.match(source,/key:"google"/);
  assert.doesNotMatch(source,/key:"chatgpt"/);
  assert.match(source,/key:"github"/);
  assert.match(source,/federation\[provider\.key\]\?\.enabled/);
  assert.match(source,/Dofinances/);
});

test("Tailwind 4 reuses captured radius and color scale, rather than approximated BEM CSS", async () => {
  const css = await load("../src/styles.css");
  const pkg = JSON.parse(await load("../package.json"));
  const vite = await load("../vite.config.mjs");
  assert.equal(pkg.devDependencies.tailwindcss, "4.2.2");
  assert.equal(pkg.devDependencies["@tailwindcss/vite"], "4.2.2");
  assert.match(vite, /plugins: \[tailwindcss\(\)\]/);
  assert.ok(css.includes('@import "tailwindcss"'));
  assert.ok(css.includes('@custom-variant dark'));
  assert.match(css, /--radius-lg:\s*0\.8rem/);
  assert.match(css, /--radius-2xl:\s*1rem/);
  assert.match(css, /--font-sans:\s*ui-sans-serif/);
  for (const selector of [".auth3__card", ".auth3__social", ".auth3__input", ".auth3__continue"]) {
    assert.equal(css.includes(selector), false, "Unverified custom override: " + selector);
  }
});

test("theme defaults to dark and can switch without persistence", async () => {
  const source = await load("../src/components/Auth3.jsx");
  assert.match(source, /useState\("dark"\)/);
  assert.match(source, /setTheme\(isDark \? "light" : "dark"\)/);
  assert.match(source, /aria-pressed=\{isDark\}/);
  assert.match(source, /className="auth3-theme-toggle"/);
  assert.match(source, /aria-label=\{isDark \? "Switch to light mode" : "Switch to dark mode"\}/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  assert.match(source, /credentials:\s*"same-origin"/);
});

test("Motion's parameters and responsive caption classes match the source", async () => {
  const source = await load("../src/components/Auth3.jsx");
  assert.match(source, /initial=\{\{ opacity: 0, x: -50 \}\}/);
  assert.match(source, /initial=\{\{ opacity: 0, x: 50 \}\}/);
  assert.match(source, /transition=\{\{ duration: 0\.6, delay: 0\.2 \}\}/);
  assert.equal((source.match(/<motion\.div/g) || []).length, 2);
  assert.match(source, /className="hidden lg:block max-w-sm"/);
});

test("links and email form preserve original UI behavior without credential recording", async () => {
  const source = await load("../src/components/Auth3.jsx");
  assert.match(source, /"New user\?"/);
  assert.match(source, /Can't sign in\?\{" "\}/);
  assert.equal((source.match(/href="#"/g)||[]).length, 2);
  assert.match(source, /<form onSubmit=\{handleSubmit\} className="mb-6">/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /await fetch\("\/api\/auth\//);
  assert.match(source, /window\.location\.assign\("\/app"\)/);
  assert.match(source, /type="password"/);
  assert.match(source, /confirmPassword/);
  assert.doesNotMatch(source,/chatgpt/i);
  assert.match(source, /className=\{common\+" opacity-60 cursor-not-allowed"\}/);
  assert.match(source, /\/api\/auth\/oauth\/start\?provider=/);
  assert.doesNotMatch(source, /console\.log|sendBeacon|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
});

test("both retired Studio /login URLs return a scoped Pages Function 404", async () => {
  const { stat } = await import("node:fs/promises");
  await assert.rejects(stat(new URL("../login/index.html", import.meta.url)), { code: "ENOENT" });
  const notFound = await load("../public/404.html");
  assert.match(notFound, /404 Not Found/);
  const routes = JSON.parse(await load("../public/_routes.json"));
  assert.deepEqual(routes.include, ["/login", "/login/"]);
  assert.deepEqual(routes.exclude, []);
  const { onRequest } = await import("../functions/login.js");
  for (const path of routes.include) {
    const response = await onRequest({request: new Request("https://stu.dofinances.com"+path)});
    assert.equal(response.status,404,path);
    assert.equal(response.headers.get("Cache-Control"),"no-store");
  }
});

test("short mobile viewports position the extra theme control outside the original card", async () => {
  const css = await load("../src/styles.css");
  assert.match(css, /@media \(max-width: 640px\) and \(max-height: 700px\)/);
  assert.match(css, /\.auth3-theme-toggle\s*\{\s*position: relative;\s*align-self: flex-end;/);
  // Original utility classes must still be enforced by the source contract.
});

test("original iframe dark-mode base foreground propagates to the Auth-3 root", async () => {
  const css = await load("../src/styles.css");
  assert.match(css, /\.auth3-root\.dark \{ color-scheme: dark; color: #fff; \}/);
  assert.match(css, /\.auth3-root:not\(\.dark\) \{ color-scheme: light; color: #0a0a0a; \}/);
});

test("actual source typography: family, sizes, weights and spacing", async () => {
  const css = await load("../src/styles.css");
  const component = await load("../src/components/Auth3.jsx");
  const contract = JSON.parse(await load("./fixtures/auth3-source-class-contract.json"));
  const pkg = JSON.parse(await load("../package.json"));
  assert.equal(pkg.devDependencies.tailwindcss, "4.2.2");
  assert.match(css, /--font-sans: ui-sans-serif, system-ui, sans-serif/);
  assert.match(css, /\.auth3-root\s*\{[^}]*font-family: var\(--font-sans\);[^}]*font-weight: 400;[^}]*font-kerning: auto;[^}]*font-optical-sizing: auto;/);
  assert.match(css, /font-synthesis-weight: auto/);
  assert.match(css, /-webkit-font-smoothing: antialiased/);
  assert.doesNotMatch(css, /@font-face|fonts\.googleapis\.com/);
  const values = contract.classes;
  const matches = (term) => values.filter((x) => x.split(" ").includes(term));
  assert.equal(matches("font-bold").length, 1, "Exactly one 700-weight heading");
  assert.equal(matches("font-medium").length, 8, "Medium weights: links, Continue, social buttons, View more, caption heading");
  assert.equal(matches("text-3xl").length, 1, "30px sign-in heading");
  assert.equal(matches("text-4xl").length, 1, "36px caption heading");
  assert.equal(matches("text-lg").length, 1, "18px caption body");
  assert.equal(matches("text-sm").length, 7, "Seven explicit 14px utilities; links inherit from regular paragraphs");
  assert.equal(matches("tracking-tight").length, 4, "Three social buttons and caption body");
  assert.equal(matches("tracking-tighter").length, 1);
  assert.ok(component.includes("className={`auth3-root font-sans antialiased "));
});

test("dark variant uses exact original Tailwind selector specificity", async () => {
  const css = await load("../src/styles.css");
  const component = await load("../src/components/Auth3.jsx");
  assert.match(css, /@custom-variant dark \(&\:is\(\.dark \*\)\);/);
  assert.doesNotMatch(css, /@custom-variant dark \(&\:where/);
  assert.match(component, /dark:bg-neutral-800/);
  assert.match(component, /hover:bg-neutral-100 dark:hover:bg-neutral-700/);
  // The original shipped without a compiled neutral-750 declaration. The
  // later dark:bg-neutral-800 selector must win over light:hover:bg-neutral-50.
  assert.doesNotMatch(css, /--color-neutral-750:/);
});

test("resting base border and focus-ring tokens mirror original compiled CSS", async () => {
  const css = await load("../src/styles.css");
  assert.match(css, /--border: #1f1f1f;/);
  assert.match(css, /--ring: #2a2a2a;/);
  assert.match(css, /--border: oklch\(92\.2% 0 0\);/);
  assert.match(css, /--ring: oklch\(70\.8% 0 0\);/);
  assert.match(css, /border-color: var\(--border\)/);
  assert.match(css, /outline-color: color-mix\(in oklab, var\(--ring\) 50%, transparent\)/);
  assert.match(css, /body:has\(\.auth3-root:not\(\.dark\)\) \{ background-color: #fff; \}/);
  assert.match(css, /background-color: transparent;/);
});


test("original Auth-3 text selection has exact inverted light/dark colors", async () => {
  const css = await load("../src/styles.css");
  const jsx = await load("../src/components/Auth3.jsx");
  assert.match(css, /\.auth3-root::selection,\s*\.auth3-root \*::selection\s*\{\s*color: oklch\(100% 0 0\);\s*background-color: oklch\(14\.5% 0 0\);/);
  assert.match(css, /\.auth3-root\.dark::selection,\s*\.auth3-root\.dark \*::selection\s*\{\s*color: #0a0a0a;\s*background-color: oklch\(100% 0 0\);/);
  assert.ok(jsx.includes('useState("dark")'));
  // No global ::selection override. Keep the feature within Studio Auth-3.
  assert.doesNotMatch(css, /\n::selection\s*\{/);
});
