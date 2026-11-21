import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the public shell persists across / and /login; no login document recreates chrome",async()=>{
  const [home,route,styles,source,vite,workflow,packageScript]=await Promise.all([
    load("../sites/_apex/index.html"),
    load("../sites/_apex/assets/public-home-transition.js"),
    load("../sites/_apex/assets/public-home.css"),
    load("../src/components/Auth3.jsx"),load("../vite.config.mjs"),
    load("../.github/workflows/site.yml"),
    load("../scripts/package-public-login-route.mjs")
  ]);
  assert.match(home, /name="dofinances-app-shell"/);
  assert.match(home, /id="public-route-content"[^>]*hidden/);
  assert.match(home, /id="dashboard-title">doof<\/h1>/);
  assert.match(home, /id="global-menu"/);
  assert.match(route, /history\.pushState/);
  assert.match(route, /history\.back\(\)/);
  assert.match(route, /addEventListener\("popstate"/);
  assert.match(route, /registry=new Map/);
  assert.match(route, /loadModule\("\/login"\)/);
  assert.match(route, /dofinances:home-dismiss/);
  assert.match(route, /dofinances:home-restore/);
  assert.match(route, /state="exiting"/);
  assert.doesNotMatch(route, /window\.location\.assign|location\.assign\(target\)/);
  assert.match(styles, /body\.public-home > #public-route-content\{/);
  assert.match(vite,/loginRoute: resolve\(root, "src\/routes\/login-entry\.jsx"\)/);
  assert.match(packageScript,/public-login-manifest\.json/);
  assert.match(workflow,/sed 's\/<body class="public-home">/);
  assert.match(workflow,/cp -R dist\/assets\/\. sites\/_apex\/assets\//);
  assert.doesNotMatch(source,/data-auth-scene|data-auth-scene="photo"|auth3-doof-mark/);
  assert.doesNotMatch(source,/className="doof-theme-toggle"/);
});
test("the sign-in route owns the card entrance and reversed exit, not homepage animations",async()=>{
  const [source,entry,shell,gpu]=await Promise.all([
    load("../src/components/Auth3.jsx"),
    load("../src/routes/login-entry.jsx"),
    load("../sites/_apex/assets/public-home-transition.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js")
  ]);
  assert.match(source,/initial=\{\{ opacity: 0, x: -50 \}\}/);
  assert.match(source,/animate=\{exiting \? \{ opacity: 0, x: -50 \} : \{ opacity: 1, x: 0 \}\}/);
  assert.match(source,/onAnimationComplete=\{\(\) => \{ if\(exiting\) onExitComplete\(\); \}\}/);
  assert.match(source,/className="auth3-back-link" aria-label="Back to homepage"/);
  assert.match(source,/onBack\(\);/);
  assert.match(entry,/export function mountLogin/);
  assert.match(entry,/exit\(\)\{if\(leaving\|\|closed\)return;leaving=true;render\(\);\}/);
  assert.match(shell,/current\.exit\(\)/);
  assert.match(shell,/function finishClose\(\)/);
  assert.match(gpu,/dofinances:home-restore/);
  assert.match(gpu,/DISMISS_MS-\(performance\.now\(\)-restoreStart\)/);
  assert.match(shell,/positionCompactLogo/);
});
test("the live shell owns the top bar, theme toggle and compact doof mark",async()=>{
  const [home,auth,theme,renderer]=await Promise.all([
    load("../sites/_apex/index.html"),
    load("../src/components/Auth3.jsx"),
    load("../sites/_apex/assets/public-theme.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js")
  ]);
  assert.match(home,/<nav class="global-menu" id="global-menu"/);
  assert.match(home,/id="public-theme-toggle"/);
  assert.match(home,/id="dashboard-title">doof<\/h1>/);
  assert.doesNotMatch(auth,/id="global-menu"|doof-theme-toggle|data-auth-scene/);
  assert.match(theme,/dofinances-theme/);
  assert.match(auth,/new MutationObserver\(update\)/);
  assert.match(renderer,/let restoreStart=null;/);
});
test("Studio's independent Vite root is retained for development, but not deployed as apex /login",async()=>{
  const [root,workflow,vite]=await Promise.all([
    load("../index.html"),load("../.github/workflows/site.yml"),load("../vite.config.mjs")
  ]);
  assert.match(root,/<title>Sign in · Dofinances<\/title>/);
  assert.match(vite,/home: resolve\(root, "index\.html"\)/);
  assert.match(vite,/loginRoute: resolve/);
  assert.match(workflow,/sites\/_apex\/index\.html > sites\/_apex\/login\/index\.html/);
  assert.doesNotMatch(workflow,/cp dist\/index\.html sites\/_apex\/login\/index\.html/);
});

test("Studio preserves isolated Liquid Glass workspace at /app/ while apex /login keeps Auth-3", async () => {
  const [page,bootstrap,glassCSS,glassJS,oracle,workflow] = await Promise.all([
    load("../studio/sidebar/index.html"),
    load("../studio/sidebar/preview-bootstrap.js"),
    load("../studio/sidebar/sidebar-glass.css"),
    load("../studio/sidebar/sidebar-glass.js"),
    load("../sites/_apex/app/assets/sidebar-glass-oracle.js"),
    load("../.github/workflows/site.yml")
  ]);
  assert.match(page, /<title>Studio · DoFinances<\/title>/);
  assert.match(page, /id="workspace-sidebar"/);
  assert.match(page, /sidebar-glass\.css/);
  assert.match(page, /src="\/app\/assets\/preview-bootstrap\.js"/);
  assert.doesNotMatch(page, /src="\/app\/assets\/dashboard\.js"/);
  assert.match(bootstrap, /initWorkspaceNavigation\(\)/);
  assert.match(bootstrap, /initLiquidGlassSidebar\(\)/);
  assert.match(bootstrap, /field\.disabled=true|field\.disabled = true/);
  assert.doesNotMatch(bootstrap,/\.title\s*=|setAttribute\(["']title["']/,
    "Preview controls must not create native hover tooltips");
  assert.doesNotMatch(glassJS,/\.title\s*=|setAttribute\(["']title["']/,
    "Backdrop toggle must rely on accessible labeling, not native tooltips");
  assert.match(bootstrap,/aria-description/);
  assert.doesNotMatch(bootstrap, /fetch\(|api\/auth|location\.replace/);
  assert.match(glassCSS, /glass-scene-neutral|glass-scene-prism/);
  assert.match(glassJS, /glass-scene-toggle/);
  assert.match(oracle, /function onPaneResize\(\)/);
  const pages = workflow.split("  deploy:\n")[1].split("\n  deploy-host-router:")[0];
  const hostRouter = workflow.split("  deploy-host-router:\n")[1].split("\n  smoke:")[0];
  assert.match(pages, /cp studio\/gallery\/index\.html dist\/index\.html/);
  assert.match(pages, /cp studio\/sidebar\/index\.html dist\/app\/index\.html/);
  assert.match(pages, /cp studio\/sidebar\/sidebar-glass\.css dist\/app\/assets\/sidebar-glass\.css/);
  assert.match(pages, /cp studio\/sidebar\/preview-bootstrap\.js dist\/app\/assets\/preview-bootstrap\.js/);
  assert.match(pages, /test ! -e dist\/app\/assets\/dashboard\.js/);
  assert.match(hostRouter, /sites\/_apex\/index\.html > sites\/_apex\/login\/index\.html/);
  assert.doesNotMatch(hostRouter, /studio\/sidebar|studio\/blank/);
  assert.match(workflow, /grep -Fq 'id="background-switcher"' "\$studio_body"/);
  assert.match(workflow, /grep -Fq 'dofinances-app-shell' "\$body"/);
});

test("original non-social Auth-3 layout utilities remain unchanged", async () => {
  const source = await load("../src/components/Auth3.jsx");
  const contract = JSON.parse(await load("./fixtures/auth3-source-class-contract.json"));
  assert.equal(contract.classes.length, 28);
  const classes = [...source.matchAll(/className="([^"]+)"/g)]
    .map(match => match[1]).filter(value => value !== "auth3-theme-toggle");
  // The three static social buttons are provider-aware; the right-hand
  // promotional caption (original source classes 25-27) is intentionally
  // removed so the form is the sole horizontally centered card.
  for(const expected of [...contract.classes.slice(0,16),...contract.classes.slice(23,25)]){
    // The route continuity requirement intentionally changes only the
    // original overlay's 20% black scrim to the Home photograph's 12% veil.
    if(expected==="absolute inset-0 bg-cover bg-center"||
       expected==="absolute inset-0 bg-black/20")continue;
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
  assert.doesNotMatch(source,/dashboard-cloud-veiled-colorful-fields\.avif/);
  assert.doesNotMatch(source,/images\.unsplash\.com/);
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

test("theme defaults to dark and is controlled exclusively by the persistent shell",async()=>{
  const source=await load("../src/components/Auth3.jsx");
  const shellTheme=await load("../sites/_apex/assets/public-theme.js");
  assert.match(source,/window\.localStorage\.getItem\("dofinances-theme"\)/);
  assert.match(source,/new MutationObserver\(update\)/);
  assert.match(shellTheme,/window\.localStorage\.setItem\(KEY,next\)/);
  assert.match(shellTheme,/button\?\.addEventListener\("click"/);
  assert.doesNotMatch(source,/setTheme\(isDark \? "light"/);
  assert.doesNotMatch(source,/sessionStorage|document\.cookie/);
  assert.match(source,/credentials:\s*"same-origin"/);
});

test("Sign-in glass uses the EXACT same WebGPU pipeline and hover springs as squares",async()=>{
  const [jsx,css,renderer,shader,homepageCss]=await Promise.all([
    load("../src/components/Auth3.jsx"),load("../src/styles.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/assets/public-home.css")
  ]);
  assert.match(jsx,/data-auth-glass-card/);
  assert.doesNotMatch(jsx,/onPointerMove=\{moveGlassLight\}/);
  assert.doesNotMatch(css,/--auth-glass-pointer-|circle 225px/);
  assert.match(renderer,/const AUTH_PANE_CAPACITY=10;/);
  assert.match(renderer,/function authPaneElements\(\)/);
  assert.match(renderer,/const source=makeTileFloatData\(all,dpr,sceneTop\)/);
  assert.match(renderer,/data\.set\(source\)/);
  assert.match(renderer,/interaction\.configure\(\[/);
  assert.match(renderer,/const authAnimating=paintAuthPanes\(\)/);
  assert.match(renderer,/interaction\.retargetRects\(tileData,cornerInert\)/);
  assert.match(renderer,/interaction\.advance\(dt,reducedMotion\.matches\)/);
  assert.match(renderer,/import \{createAuthGlassHoverController\} from "\.\/dashboard-auth-hover\.js";/,
    "Sign-in hover gets its own controller without modifying the squares");
  assert.match(renderer,/const authHover=createAuthGlassHoverController\(AUTH_PANE_CAPACITY\);/);
  assert.match(renderer,/interaction\.writeTo\(tileData\);\s*\/\/ Override only route-owned pane lanes AFTER the original squares\.\s*authHover\.writeTo\(tileData,tileCount\);/,
    "Squares are written by their unchanged controller before auth-only overrides");
  const authHoverSource=await load("../sites/_apex/assets/home-dashboard/dashboard-auth-hover.js");
  assert.match(authHoverSource,/\/\/ Inactive slots deliberately do NOT relax x\/y toward their center\./);
  assert.match(authHoverSource,/slots\[0\]\.active=card|slot\.active=active/,
    "Nested controls must not steal the surrounding card's hover");
  const interaction=await load("../sites/_apex/assets/home-dashboard/dashboard-interaction.js");
  assert.doesNotMatch(interaction,/data\[p\+6\]=0|data\[p\+7\]=0/,
    "Hover spring must never erase the GPU sign-in material opacity or dismissal");
  assert.match(renderer,/pass\.setPipeline\(glassPipeline\);pass\.setBindGroup\(0,glassGroup\);\s*pass\.draw\(6,tileCount\);/);
  assert.match(renderer,/authContext\.configure\(\{device,format,alphaMode:"premultiplied"\}\)/);
  assert.match(renderer,/authPass\.setPipeline\(glassPipeline\);authPass\.setBindGroup\(0,glassGroup\);\s*authPass\.draw\(6,AUTH_PANE_CAPACITY,0,tileCount\);/);
  assert.match(renderer,/document\.body\.dataset\.authGpuScene="ready"/);
  assert.match(homepageCss,/#dashboard-auth-glass-scene\{/);
  assert.match(homepageCss,/z-index:5;[\s\S]*?pointer-events:none;/);
  assert.match(shader,/let authPane=tile\.properties\.y<0\.0;/);
  assert.match(shader,/let scale=select\(0\.85\+0\.15\*a,1\.0,authPane\);/);
  assert.match(shader,/if\(authPane\)\{\s*return vec4<f32>\(color,coverage\*clamp\(tile\.motion\.z,0\.0,1\.0\)\);/);
  assert.match(shader,/let hover=clamp\(tile\.interaction\.x,0\.0,1\.0\)/);
  assert.match(shader,/let pressed=clamp\(tile\.interaction\.y,0\.0,1\.0\)/);
  assert.match(css,/body\[data-auth-gpu-scene="ready"\] \.auth3-root \[data-auth-glass-card\]/);
});
test("Card is untinted; existing neutral presets tint controls in dark and light modes",async()=>{
  const [jsx,css,renderer,shader]=await Promise.all([
    load("../src/components/Auth3.jsx"),load("../src/styles.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl")
  ]);
  assert.equal((jsx.match(/data-auth-glass-input/g)||[]).length,4);
  assert.equal((jsx.match(/data-auth-glass-submit/g)||[]).length,1);
  assert.equal((jsx.match(/data-auth-glass-provider/g)||[]).length,3);
  assert.match(renderer,/tintParameters\("none",undefined,scheme\)/);
  assert.match(renderer,/return tintParameters\(name,\.99,scheme\)/);
  assert.match(renderer,/scheme==="dark"\?"white":"black"/);
  assert.match(renderer,/scheme==="dark"\?"black":"white"/);
  assert.match(shader,/let darkFace=state\.tintMeta\.y>0\.5;/,
    "Card and squares use one material face, not independent UI-mode tones");
  assert.doesNotMatch(shader,/let darkFace=select\(/);
  assert.match(renderer,/tileData\[p\+5\]=-2;/);
  assert.match(renderer,/if\(tileCount\)tileData\[p\+6\]=tileData\[6\];/,
    "Every sign-in pane reuses the original square material's blur/LOD word");
  assert.match(shader,/let d=select\(min\(dimensions\.x,dimensions\.y\),\s*min\(tiles\[0\]\.rect\.z,tiles\[0\]\.rect\.w\),authPane\);/,
    "The same square-size optical envelope drives all panes and hover radii");
  assert.doesNotMatch(renderer,/tileData\[p\+5\]=scheme==="dark"/);
  assert.match(shader,/let localTint=tintTiles\[in\.tileIndex\]/);
  assert.match(shader,/let filmStrength=select\(0\.25,0\.60,authPane\);/,
    "The square tint remains unmodified; the controls get a stronger neutral film");
  assert.match(shader,/color=mix\(color,localTint\.rgb,clamp\(localTint\.w,0\.0,1\.0\)\*filmStrength\)/);
  assert.match(renderer,/faceScheme:tint\.state\.scheme/);
  assert.match(css,/--auth-control-tint:rgba\(0,0,0,\.60\)/);
  assert.match(css,/--auth-control-tint:rgba\(255,255,255,\.60\)/);
  assert.doesNotMatch(css,/background:rgba\(248,249,251,\.68\)/);
  assert.match(css,/\.auth3-root\.dark \[data-auth-glass-submit\]\{/);
  assert.match(css,/\.auth3-root:not\(\.dark\) \[data-auth-glass-submit\]\{/);
  assert.match(css,/@media\(prefers-reduced-transparency:reduce\),\(forced-colors:active\)/);
  assert.match(jsx,/bg-neutral-900 dark:bg-white text-white dark:text-neutral-900/);
  assert.match(jsx,/bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white/);
});
test("the sign-in card remains the sole centered Motion panel", async () => {
  const source = await load("../src/components/Auth3.jsx");
  assert.match(source, /className="relative z-10 w-full max-w-\[1400px\] mx-auto flex items-center justify-center gap-12"/);
  assert.match(source, /className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-8 shadow-2xl"/);
  assert.match(source, /initial=\{\{ opacity: 0, x: -50 \}\}/);
  assert.match(source, /transition=\{\{ duration: 0\.6 \}\}/);
  assert.equal((source.match(/<motion\.div/g) || []).length, 1);
  assert.doesNotMatch(source, /A clearer view of what comes next\.|className="hidden lg:block max-w-sm"/);
  assert.doesNotMatch(source, /initial=\{\{ opacity: 0, x: 50 \}\}/);
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
  assert.doesNotMatch(source, /console\.log|sendBeacon|XMLHttpRequest|sessionStorage|document\.cookie/);
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

test("both routes use one fixed bottom-left rounded square icon toggle", async () => {
  const css = await load("../sites/_apex/assets/public-theme.css");
  const authCSS = await load("../src/styles.css");
  const home = await load("../sites/_apex/index.html");
  assert.match(css, /\.doof-theme-toggle\{/);
  assert.match(css, /border-radius:12px/);
  assert.match(css, /left:max\(20px,env\(safe-area-inset-left\)\)/);
  assert.match(css, /bottom:max\(20px,env\(safe-area-inset-bottom\)\)/);
  assert.doesNotMatch(authCSS,/doof-theme-toggle/);
  assert.match(home, /id="public-theme-toggle"/);
  assert.match(home, /src="\/assets\/public-theme\.js"/);
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
  assert.doesNotMatch(css,/body:has\(\.auth3-root:not\(\.dark\)\)/);
  assert.match(css, /background-color: transparent;/);
});


test("original Auth-3 text selection has exact inverted light/dark colors", async () => {
  const css = await load("../src/styles.css");
  const jsx = await load("../src/components/Auth3.jsx");
  assert.match(css, /\.auth3-root::selection,\s*\.auth3-root \*::selection\s*\{\s*color: oklch\(100% 0 0\);\s*background-color: oklch\(14\.5% 0 0\);/);
  assert.match(css, /\.auth3-root\.dark::selection,\s*\.auth3-root\.dark \*::selection\s*\{\s*color: #0a0a0a;\s*background-color: oklch\(100% 0 0\);/);
  assert.ok(jsx.includes('window.localStorage.getItem("dofinances-theme")'));
  // No global ::selection override. Keep the feature within Studio Auth-3.
  assert.doesNotMatch(css, /\n::selection\s*\{/);
});
