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
  assert.match(component, /continueWithEmail/);
  assert.match(component, /No authentication request was sent/);
  assert.match(component, /<svg/);
  assert.match(styles, /max-width:448px/);
  assert.match(styles, /auth3-enter-left/);
  assert.match(styles, /photo-1709562493281-03c47edcb046/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("Studio login preview does not submit or log credentials", async () => {
  const component = await load("../src/components/Auth3.jsx");
  assert.doesNotMatch(component, /fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|console\.log/);
  assert.doesNotMatch(component, /<form\b/);
  assert.doesNotMatch(component, /type="password"/);
});
