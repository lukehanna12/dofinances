import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Studio root and /login use the same React entrypoint", async () => {
  const root = await load("../index.html");
  const login = await load("../login/index.html");
  assert.equal(root, login);
  assert.match(root, /<title>Sign in · Dofinances<\/title>/);
  assert.match(root, /auth3-studio-preview-v1/);
  const vite = await load("../vite.config.mjs");
  assert.match(vite, /login: resolve\(root, "login\/index\.html"\)/);
});

test("all 28 CSS utility strings match recovered Webpack module 55010 exactly and in order", async () => {
  const source = await load("../src/components/Auth3.jsx");
  const contract = JSON.parse(await load("./fixtures/auth3-source-class-contract.json"));
  assert.equal(contract.classes.length, 28);
  const classes = [...source.matchAll(/className="([^"]+)"/g)]
    .map(match => match[1]).filter(value => value !== "auth3-theme-toggle");
  assert.deepEqual(classes, contract.classes);
});

test("captured SVG icon structure and background image are preserved", async () => {
  const source = await load("../src/components/Auth3.jsx");
  assert.equal((source.match(/<svg\b/g) || []).length, 4); // Three originals plus theme toggle
  assert.match(source, /M22\.56 12\.25c0-.78/);  // Google path
  assert.match(source, /M788\.1 340\.9/);        // Apple path
  assert.match(source, /M12 0c-6\.626 0/);       // GitHub path
  assert.match(source, /photo-1709562493281-03c47edcb046/);
  assert.match(source, /Beautiful|Dofinances/);
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
  assert.doesNotMatch(source, /localStorage|sessionStorage|cookie|fetch\s*\(/);
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
  assert.match(source, /New user\?\{" "\}/);
  assert.match(source, /Can't sign in\?\{" "\}/);
  assert.equal((source.match(/href="#"/g)||[]).length, 2);
  assert.match(source, /<form onSubmit=\{handleSubmit\} className="mb-6">/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.doesNotMatch(source, /console\.log|sendBeacon|XMLHttpRequest|fetch\s*\(|onClick=\{\(\) => previewAction/);
});

test("the apex /login implementation stays deleted", async () => {
  const { stat } = await import("node:fs/promises");
  await assert.rejects(stat(new URL("../sites/_apex/login/index.html", import.meta.url)), { code: "ENOENT" });
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
  assert.match(component, /className=`auth3-root font-sans antialiased/);
});
