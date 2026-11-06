import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Studio root and login are independently built HTML entry points", async () => {
  const home = await load("../index.html");
  const login = await load("../login/index.html");
  assert.equal(home, login, "Both entry points must load the same React implementation");
  assert.match(home, /<title>Sign in · Dofinances<\/title>/);
  assert.match(login, /auth3-studio-preview-v1/);
  assert.match(login, /src="\/src\/main\.jsx"/);
  const vite = await load("../vite.config.mjs");
  assert.match(vite, /login: resolve\(root, "login\/index\.html"\)/);
});

test("Studio Auth-3 uses exact icons and preserves visual dimensions", async () => {
  const component = await load("../src/components/Auth3.jsx");
  const app = await load("../src/App.jsx");
  const styles = await load("../src/styles.css");
  assert.match(app, /<Auth3\s*\/>/);
  for (const copy of ["Sign in", "Sign in with Google", "Sign in with Apple", "Sign in with GitHub", "Dofinances"]) {
    assert.ok(component.includes(copy), copy);
  }
  assert.match(component, /auth3__card/);
  assert.match(component, /handleSubmit/);
  assert.match(component, /preventDefault/);
  assert.match(component, /<svg/);
  assert.match(styles, /max-width:448px/);
  assert.match(component, /<motion\.section/);
  assert.match(styles, /photo-1709562493281-03c47edcb046/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("Studio login preview does not submit or log credentials", async () => {
  const component = await load("../src/components/Auth3.jsx");
  assert.doesNotMatch(component, /fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|console\.log/);
  assert.match(component, /<form className="auth3__email-group" onSubmit=\{handleSubmit\}>/);
  assert.doesNotMatch(component, /type="password"/);
});

test("Studio login defaults to dark mode and provides an accessible bottom-right toggle", async () => {
  const component = await load("../src/components/Auth3.jsx");
  const styles = await load("../src/styles.css");
  assert.match(component, /\[theme, setTheme\] = useState\("dark"\)/);
  assert.match(component, /className=\{\`auth3 auth3--\$\{theme\}\`\}/);
  assert.match(component, /aria-label=\{isDark \? "Switch to light mode" : "Switch to dark mode"\}/);
  assert.match(component, /aria-pressed=\{isDark\}/);
  assert.match(component, /onClick=\{\(\) => setTheme\(isDark \? "light" : "dark"\)\}/);
  assert.match(styles, /\.auth3__theme-toggle\{position:fixed;right:/);
  assert.match(styles, /bottom:max\(20px,env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.auth3--dark \.auth3__card\{background:#171717/);
  assert.match(styles, /\.auth3--light \.auth3__theme-toggle/);
});

test("registration and help links preserve the literal space and anchor actions from the source", async () => {
  const component = await load("../src/components/Auth3.jsx");
  const styles = await load("../src/styles.css");
  assert.match(component, /New user\?\{" "\}/);
  assert.match(component, /Can't sign in\?\{" "\}/);
  assert.match(component, /<a className="auth3__text-button" href="#">Create an account<\/a>/);
  assert.match(component, /<a className="auth3__text-button" href="#">Get help<\/a>/);
  assert.doesNotMatch(styles, /column-gap:6px/);
});

test("entrance animations use original Motion parameters", async () => {
  const component = await load("../src/components/Auth3.jsx");
  assert.match(component, /from "motion\/react"/);
  assert.match(component, /initial=\{\{ opacity: 0, x: -50 \}\} animate=\{\{ opacity: 1, x: 0 \}\} transition=\{\{ duration: 0\.6 \}\}/);
  assert.match(component, /initial=\{\{ opacity: 0, x: 50 \}\} animate=\{\{ opacity: 1, x: 0 \}\} transition=\{\{ duration: 0\.6, delay: 0\.2 \}\}/);
  assert.equal((component.match(/<motion\./g)||[]).length, 2);
});

test("inactive controls and email submit match visible original behavior without recording user data", async () => {
  const component = await load("../src/components/Auth3.jsx");
  assert.match(component, /const handleSubmit = \(event\) => event\.preventDefault\(\)/);
  assert.match(component, /type="email" value=\{email\} onChange=/);
  assert.match(component, /type="submit" id="auth-continue"/);
  assert.doesNotMatch(component, /previewAction|setStatus|console\.log|fetch\s*\(|sendBeacon|localStorage|XMLHttpRequest/);
});

test("colors, size, spacing and font weights are explicitly source-mapped", async () => {
  const css = await load("../src/styles.css");
  const pkg = JSON.parse(await load("../package.json"));
  assert.equal(pkg.dependencies.motion, "14.9.1");
  for (const snippet of [
    "font-family:ui-sans-serif,system-ui,sans-serif",
    ".auth3{min-height:100vh",
    "padding:24px;overflow:hidden",
    "gap:48px;max-width:1400px",
    "max-width:448px",
    "padding:32px",
    "font-size:30px;line-height:36px;font-weight:700",
    "font-size:14px;line-height:20px",
    "font-weight:500",
    "gap:16px;margin-bottom:24px",
    "gap:12px;margin-bottom:16px",
    "letter-spacing:-.025em",
    ".auth3__text-button:hover{color:#404040}",
    ".auth3--dark .auth3__email-group input{background:#171717;border-color:#404040;color:#fff}",
    ".auth3--dark .auth3__email-group input:focus{box-shadow:0 0 0 2px #525252}",
    ".auth3--dark .auth3__continue:hover{background:#e5e5e5}",
    ".auth3--dark .auth3__social:hover{background:#333}",
    "photo-1709562493281-03c47edcb046",
  ]) assert.ok(css.includes(snippet), "Missing recovered style: " + snippet);
});

test("computed original outline widths, corner shapes, scales and alignment", async () => {
  const css = await load("../src/styles.css");
  const jsx = await load("../src/components/Auth3.jsx");
  // Measurements directly recovered from the original Chrome protocol capture,
  // sampled with the original Auth-3 card displayed dark at 818×800.
  assert.match(css, /\.auth3__card\{[^}]*max-width:448px;[^}]*border-radius:16px;padding:32px/);
  assert.match(css, /\.auth3__email-group input\{[^}]*height:52px;[^}]*border-radius:12\.8px;border:2px solid/);
  assert.match(css, /\.auth3__continue\{[^}]*min-height:48px;[^}]*border:0;border-radius:12\.8px/);
  assert.match(css, /\.auth3__social\{[^}]*min-height:46px;[^}]*border:1px solid #d4d4d4;border-radius:12\.8px/);
  assert.match(css, /\.auth3__layout\{[^}]*align-items:center;justify-content:center;gap:48px/);
  assert.match(css, /\.auth3__social\{[^}]*align-items:center;justify-content:center;gap:12px/);
  assert.match(css, /\.auth3__more\{display:inline-block/);
  assert.match(css, /\.auth3__theme-toggle\{cursor:pointer;position:fixed/);
  assert.match(jsx, /initial=\{\{ opacity: 0, x: -50 \}\}/);
  assert.match(jsx, /initial=\{\{ opacity: 0, x: 50 \}\}/);
});

test("source-accurate transition easing and computed system font", async () => {
  const css = await load("../src/styles.css");
  assert.match(css, /font-family:ui-sans-serif,system-ui,sans-serif/);
  assert.doesNotMatch(css, /IBM\+Plex\+Sans|fonts\.googleapis\.com/);
  assert.match(css, /\.auth3__email-group input\{[^}]*transition:all \.2s cubic-bezier\(0\.4,0,0\.2,1\)/);
  assert.equal((css.match(/transition-timing-function:cubic-bezier\(0\.4,0,0\.2,1\)/g) || []).length, 2);
  assert.match(css, /button\{cursor:default\}/);
  assert.doesNotMatch(css, /\.auth3__card,\.auth3__card h1,\.auth3__subtitle.*transition:/);
});
