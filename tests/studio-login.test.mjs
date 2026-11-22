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
  assert.match(route, /openRoute\("\/login"/);
  assert.match(route, /openRoute\("\/projects"/);
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
test("the live shell owns the top bar, fixed dark palette and compact doof mark",async()=>{
  const [home,auth,renderer]=await Promise.all([
    load("../sites/_apex/index.html"),
    load("../src/components/Auth3.jsx"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js")
  ]);
  assert.match(home,/<nav class="global-menu" id="global-menu"/);
  assert.match(home,/<html lang="en" data-dof-theme="dark">/);
  assert.doesNotMatch(home,/public-theme-toggle|public-theme\.(js|css)|doof-theme-toggle/);
  assert.match(home,/id="dashboard-title">doof<\/h1>/);
  assert.doesNotMatch(auth,/id="global-menu"|doof-theme-toggle|data-auth-scene/);
  assert.match(auth,/const isDark = true;/);
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
    // The user explicitly requested darker Or divider lines. The new
    // sign-in-only class retains the original flex/1px geometry.
    if(expected==="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"){
      assert.equal(classes.filter(x=>x==="auth3-or-rule flex-1 h-px").length,2);
      continue;
    }
    if(expected==="flex items-center gap-4 mb-6"){
      assert.ok(classes.includes(expected+" text-neutral-500 dark:text-neutral-400"),
        "The original Or row layout retains exact geometry plus the note's theme colors");
      continue;
    }
    if(expected==="text-sm text-neutral-500 dark:text-neutral-500"){
      assert.ok(classes.includes("text-sm"),"The Or label retains its original text size");
      assert.ok(classes.includes("flex items-center gap-4 mb-6 text-neutral-500 dark:text-neutral-400"),
        "Or label inherits the same theme-aware neutral ink as the linking note");
      continue;
    }
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

test("sign-in is locked to dark and ignores former saved light preferences",async()=>{
  const [source,home]=await Promise.all([
    load("../src/components/Auth3.jsx"),load("../sites/_apex/index.html")
  ]);
  assert.match(home,/data-dof-theme="dark"/);
  assert.match(source,/const isDark = true;/);
  assert.doesNotMatch(source,/dofinances-theme|new MutationObserver\(update\)|setTheme\(/);
  assert.doesNotMatch(source,/sessionStorage|document\.cookie/);
  assert.match(source,/credentials:\s*"same-origin"/);
});

test("Sign-in preserves the opt-in exact WebGPU shader and supports native scrolling composite",async()=>{
  const [jsx,css,renderer,shader,homepageCss]=await Promise.all([
    load("../src/components/Auth3.jsx"),load("../src/styles.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/assets/public-home.css")
  ]);
  assert.match(jsx,/data-auth-glass-card/);
  assert.doesNotMatch(jsx,/onPointerMove=\{moveGlassLight\}/);
  assert.doesNotMatch(css,/--auth-glass-pointer-|circle 225px/);
  assert.match(renderer,/const AUTH_PANE_CAPACITY=24;/);
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
  assert.match(renderer,/authPass\.setPipeline\(glassPipeline\);authPass\.setBindGroup\(0,authGlassGroup\);\s*authPass\.draw\(6,AUTH_PANE_CAPACITY,0,tileCount\);/);
  assert.match(renderer,/document\.body\.dataset\.authGpuScene="ready"/);
  assert.match(homepageCss,/#public-route-content > #dashboard-auth-glass-scene\{/);
  assert.match(homepageCss,/z-index:0;[\s\S]*?pointer-events:none;/);
  assert.match(shader,/let authPane=tile\.properties\.y<0\.0;/);
  assert.match(shader,/let scale=select\(0\.85\+0\.15\*a,1\.0,authPane\);/);
  assert.match(shader,/if\(authPane\)\{\s*return vec4<f32>\(color,coverage\*clamp\(tile\.motion\.z,0\.0,1\.0\)\);/);
  assert.match(shader,/let hover=clamp\(tile\.interaction\.x,0\.0,1\.0\)/);
  assert.match(shader,/let pressed=clamp\(tile\.interaction\.y,0\.0,1\.0\)/);
  assert.match(css,/body\[data-auth-gpu-scene="ready"\]:not\(\[data-auth-glass-mode="compositor"\]\) \.auth3-root \[data-auth-glass-card\]/);
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
  assert.match(renderer,/if\(tileCount\)tileData\[p\+6\]=tileData\[6\];/,
    "Every sign-in pane reuses the original square material's blur/LOD word");
  assert.match(shader,/let d=select\(min\(dimensions\.x,dimensions\.y\),\s*min\(tiles\[0\]\.rect\.z,tiles\[0\]\.rect\.w\),authPane\);/,
    "The same square-size optical envelope drives all panes and hover radii");
  assert.doesNotMatch(renderer,/tileData\[p\+5\]=scheme==="dark"/);
  assert.match(shader,/let localTint=tintTiles\[in\.tileIndex\]/);
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

test("homepage and sign-in contain no theme controls or external theme scripts",async()=>{
  const [home,authCSS,jsx]=await Promise.all([
    load("../sites/_apex/index.html"),
    load("../src/styles.css"),
    load("../src/components/Auth3.jsx")
  ]);
  assert.match(home,/<html lang="en" data-dof-theme="dark">/);
  assert.doesNotMatch(home,/public-theme-toggle|doof-theme-toggle|public-theme\.(js|css)/);
  assert.doesNotMatch(authCSS,/doof-theme-toggle/);
  assert.match(jsx,/const isDark = true;/);
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
  assert.ok(jsx.includes("const isDark = true;"));
  // No global ::selection override. Keep the feature within Studio Auth-3.
  assert.doesNotMatch(css, /\n::selection\s*\{/);
});


test("sign-in divider, primary tint, provider SVGs and short exit remain scoped",async()=>{
  const [jsx,css,marks,renderer,shader,privateRenderer,privateShader]=await Promise.all([
    load("../src/components/Auth3.jsx"),
    load("../src/styles.css"),
    load("../src/components/AuthProviderIcon.jsx"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/app/assets/dashboard-gpu-renderer.js"),
    load("../sites/_apex/app/assets/dashboard-gpu-glass.wgsl")
  ]);
  assert.equal((jsx.match(/className="auth3-or-rule flex-1 h-px"/g)||[]).length,2);
  assert.ok(jsx.includes('data-auth-or-separator className="flex items-center gap-4 mb-6 text-neutral-500 dark:text-neutral-400"'));
  assert.ok(jsx.includes('className="text-xs text-neutral-500 dark:text-neutral-400 mb-6"'),
    "Or group and account-linking note use the same theme-owned utility colors");
  assert.ok(css.includes(".auth3-root [data-auth-or-separator]{opacity:1}"));
  assert.doesNotMatch(css,/\[data-auth-or-separator\]\{color:#/,
    "No hardcoded gray may override the linking note's text color");
  assert.ok(css.includes(".auth3-root .auth3-or-rule{background-color:currentColor}"));
  assert.ok(css.includes(".auth3-root [data-auth-or-separator] span{color:inherit}"));
  assert.ok(jsx.includes('import { AuthProviderIcon } from "./AuthProviderIcon.jsx";'));
  assert.ok(jsx.includes("<AuthProviderIcon provider={provider.key}/>"));
  assert.doesNotMatch(jsx,/mark:"G"|mark:"GH"|provider\.mark/);
  assert.equal((marks.match(/<svg\b/g)||[]).length,2);
  assert.equal((marks.match(/fill="#FFFFFF"/g)||[]).length,4,
    "Google segments remain white-only with individual luminance alphas");
  assert.deepEqual([...marks.matchAll(/<path fill="#FFFFFF" opacity="(\.[0-9]+)"/g)]
    .map(m=>Number(m[1])),[.49952,.55426,.87488,.6481]);
  assert.ok(.49952<.55426&&.55426<.6481&&.6481<.87488,
    "Google monochrome brightness preserves red < blue < green < yellow");
  assert.ok(marks.includes('id="auth3-github-mono-gradient"'));
  assert.ok(marks.includes('fill="url(#auth3-github-mono-gradient)"'));
  assert.ok(marks.includes('stopColor="#FFFFFF" stopOpacity=".73412"'));
  assert.ok(marks.includes('stopColor="#FFFFFF" stopOpacity=".52298"'));
  assert.ok(.73412-.52298>.20&&.87488-.49952>.37,
    "Both brands retain distinct relative luminance");
  for(const [before,after] of [[.456,.49952],[.5155,.55426],[.864,.87488],[.6175,.6481],[.711,.73412],[.4815,.52298]])
    assert.ok(Math.abs(after-(before+.08*(1-before)))<1e-8,
      "Each monochrome stop moves exactly another 8% of remaining distance toward white");
  assert.doesNotMatch(marks,/#(?:EA4335|4285F4|FBBC05|34A853|7A8DDD|A56BCF)|stopColor="(?!#FFFFFF)|stopOpacity="(?:0|1)"/,
    "No colored or fully opaque/invisible gradient stops");
  assert.ok(marks.includes('aria-hidden="true" focusable="false"'));
  assert.ok(css.includes("opacity:.82"));
  assert.ok(css.includes("opacity:.86"));
  assert.ok(css.includes("--auth-control-tint:rgba(255,255,255,.82)"));
  assert.ok(css.includes("--auth-control-tint:rgba(0,0,0,.82)"));
  assert.ok(renderer.includes("tileData[p+5]=authPaneMaterialTag(node);"));
  assert.ok(renderer.includes('node.hasAttribute("data-auth-glass-submit")'));
  assert.ok(renderer.includes('node.hasAttribute("data-auth-glass-input")'));
  assert.ok(renderer.includes('node.hasAttribute("data-auth-glass-provider")'));
  assert.ok(renderer.includes('!node.classList.contains("auth3-back-link")'));
  assert.ok(shader.includes("var filmStrength=select(0.25,0.60,authPane);"));
  assert.ok(shader.includes("tile.properties.y == -4.0){filmStrength=0.82;"));
  assert.ok(shader.includes("tile.properties.y == -5.0){filmStrength=0.62;"),
    "Google/GitHub use 0.62 in the shared GPU film");
  assert.ok(shader.includes("tile.properties.y == -6.0){filmStrength=0.40;"),
    "Email/Password use 0.40 in the shared GPU film");
  assert.doesNotMatch(shader,/filmStrength=0\.(?:64|56);/,
    "Old provider/input tint strengths must not persist");
  for(const amount of [".40",".62"])assert.ok(css.includes("--auth-control-tint:rgba(0,0,0,"+amount+")")&&
    css.includes("--auth-control-tint:rgba(255,255,255,"+amount+")"),
    "Dark and light fallback use matching control tint for "+amount);
  assert.ok(css.includes(".auth3-root.dark [data-auth-glass-input]{\n  --auth-control-tint:rgba(0,0,0,.40);"), "Exact dark text-input tint");
  assert.ok(css.includes(".auth3-root:not(.dark) [data-auth-glass-input]{\n  --auth-control-tint:rgba(255,255,255,.40);"), "Exact light text-input tint");
  assert.ok(css.includes('[data-auth-glass-provider]:not(.auth3-back-link)'));
  assert.ok(shader.includes("select(0.25,"));
  assert.ok(jsx.includes("duration: 0.42"));
  assert.ok(jsx.includes("duration: 0.6"));
  assert.ok(jsx.includes('willChange: exiting ? "transform, opacity" : "auto"'));
  assert.ok(renderer.includes("engine.renderAuthOnly()"));
  assert.ok(renderer.includes("function renderAuthOnly()"));
  assert.ok(renderer.includes('label:"Sign-in-only transition frame"'));
  assert.ok(renderer.includes("audit.authOnlyFrames="));
  assert.doesNotMatch(privateRenderer,/renderAuthOnly|Sign-in-only transition frame/);
  assert.doesNotMatch(privateShader,/tile.properties.y == -4.0/);
});

test("back arrow uses exact square glass without artificial light lift or icon outline",async()=>{
  const [jsx,css,renderer,shader,privateRenderer,privateShader]=await Promise.all([
    load("../src/components/Auth3.jsx"),load("../src/styles.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/app/assets/dashboard-gpu-renderer.js"),
    load("../sites/_apex/app/assets/dashboard-gpu-glass.wgsl")
  ]);
  assert.ok(jsx.includes('href="/" data-auth-glass-provider className="auth3-back-link"'));
  assert.ok(jsx.includes('stroke="currentColor" strokeWidth="1.8"'));
  assert.doesNotMatch(jsx,/auth3-back-arrow-underlay|auth3-back-arrow-ink|strokeWidth="3.6"/);
  assert.equal((jsx.match(/d="M20 12H4m0 0 6-6m-6 6 6 6"/g)||[]).length,1);
  assert.doesNotMatch(css,/auth3-back-arrow-underlay|auth3-back-arrow-ink/);
  assert.ok(css.includes("--dashboard-face-fill:rgba(0,0,0,.05);"));
  assert.ok(css.includes("--auth-control-tint:transparent;"));
  assert.ok(css.includes(".auth3-root.dark [data-auth-glass-provider].auth3-back-link,"));
  assert.ok(css.includes(".auth3-root:not(.dark) [data-auth-glass-provider].auth3-back-link"));
  assert.ok(css.includes("  background:\n    linear-gradient(var(--dashboard-face-fill),var(--dashboard-face-fill)),\n    var(--auth-control-tint);"));
  assert.doesNotMatch(css,/auth3-back-link:hover\{[^}]*transform:/);
  assert.ok(renderer.includes('if(node.classList.contains("auth3-back-link"))return -7;'));
  assert.ok(renderer.includes('node.classList.contains("auth3-back-link"))\n    return tintParameters("none",undefined,scheme);'));
  assert.ok(renderer.includes('roles,scheme,cardTint:"none",backTint:"none"'));

  assert.doesNotMatch(shader,/if\(tile\.properties\.y == -7\.0\)\{|color\+vec3<f32>\(0\.10\)/,
    "Back button follows exact untinted square material, no injected brightness");
  assert.ok(css.includes('.auth3-root.dark [data-auth-glass-provider].auth3-back-link{\n  color:#fff!important;'));
  assert.ok(css.includes('.auth3-root:not(.dark) [data-auth-glass-provider].auth3-back-link{\n  color:#171717!important;'));
  // All homepage square and private app material data stays unchanged.
  assert.doesNotMatch(privateRenderer,/backTint:"none"|return -7;/);
  assert.doesNotMatch(privateShader,/tile.properties.y == -7.0/);
});

test("sign-in content scrolls normally without elastic overscroll; full WebGPU stays viewport-fixed",async()=>{
  const [css,jsx,home,homeCss,renderer,shader,router]=await Promise.all([
    load("../src/styles.css"),load("../src/components/Auth3.jsx"),
    load("../sites/_apex/index.html"),load("../sites/_apex/assets/public-home.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/assets/public-home-transition.js")
  ]);
  assert.match(css,/body\.public-home > #public-route-content:has\(\.auth3-root\)\{\s*overscroll-behavior-y:none;/);
  assert.match(css,/html:has\(body\.public-home #public-route-content \.auth3-root\),\s*body\.public-home:has\(#public-route-content \.auth3-root\)\{\s*overscroll-behavior-y:none;/);
  assert.doesNotMatch(css,/overflow-y:hidden|touch-action:none|position:fixed!important/,
    "Normal scrolling and unmodified WebGPU placement remain allowed");
  assert.match(home,/<div id="public-route-content"[^>]*hidden><div id="public-route-stage"><\/div><\/div>/);
  assert.match(homeCss,/#public-route-content > #dashboard-auth-glass-scene\{\s*position:absolute;/);
  assert.match(homeCss,/body\.public-home\[data-auth-gpu-scene="ready"\] #public-route-content > #dashboard-auth-glass-scene\{\s*opacity:1;/,
    "Optional GPU mode retains the previous exact presentation");
  assert.match(homeCss,/body\.public-home\[data-auth-glass-mode="compositor"\] #public-route-content > #dashboard-auth-glass-scene\{[\s\S]*?opacity:1!important;/,
    "Hybrid WebGPU overlay contains only scroll-independent optical terms");
  assert.match(homeCss,/#public-route-content > #public-route-stage\{\s*position:relative;z-index:1/);
  assert.match(renderer,/routeOutlet\?\.insertBefore\(authCanvas,routeMount\|\|routeOutlet\.firstChild\)/);
  assert.match(renderer,/routeMount\?\.scrollHeight/);
  assert.match(renderer,/makeLayoutData\(node,dpr,authOriginTop\(\)\)/);
  assert.match(renderer,/authGlobalsBuffer/);
  assert.match(shader,/backdropPosition\.y-=state\.pointer\.w/);
  assert.match(router,/current=mountLogin\(routeMount,/);
  assert.match(jsx,/data-auth-stage className="min-h-screen/);
});


test("Glass background sampling uses actual compositor position, including elastic movement",async()=>{
  const {authBackdropOffsetCSS}=await import("../sites/_apex/assets/home-dashboard/dashboard-scroll-optics.js");
  const sceneTop=44,contentY=620;
  for(const [scroll,elastic] of [[0,0],[190,0],[190,23],[0,-34],[-21,0],[600,-12]]){
    const canvasTop=sceneTop-scroll+elastic;
    const offset=authBackdropOffsetCSS(sceneTop,canvasTop);
    const sampledBackgroundY=contentY-offset;
    const actualViewportBackgroundY=canvasTop+contentY-sceneTop;
    assert.equal(sampledBackgroundY,actualViewportBackgroundY);
    assert.equal(offset,scroll-elastic);
  }
  assert.throws(()=>authBackdropOffsetCSS(44,NaN),TypeError);
  const renderer=await load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js");
  assert.match(renderer,/authBackdropOffsetCSS\(sceneTop,actualCanvasTop\)/);
  assert.match(renderer,/authUniform\[11\]=offsetCSS\*dpr/);
  assert.doesNotMatch(renderer,/authUniform\[11\]=\(routeOutlet\?\.scrollTop\|\|0\)\*dpr/);
  assert.match(renderer,/routeOutlet\?\.addEventListener\("scroll",onAuthScroll,\{passive:true\}\)/);
  assert.match(renderer,/engine\.renderAuthOnly\(\);\s*audit\.authSynchronousScrollFrames/);
  assert.match(renderer,/performance\.now\(\)<authScrollRefreshUntil/);
});


test("Original full WebGPU glass is the default; the scroll-composited hybrid remains opt-in",async()=>{
  const [router,css,homeCss,renderer]=await Promise.all([
    load("../sites/_apex/assets/public-home-transition.js"),
    load("../src/styles.css"),load("../sites/_apex/assets/public-home.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js")
  ]);
  assert.match(router,/body\.dataset\.authGlassMode=new URLSearchParams\(location\.search\)\.get\("auth-glass"\)==="compositor"/);
  assert.match(router,/"compositor":"webgpu"/);
  assert.match(css,/body\[data-auth-gpu-scene="ready"\]:not\(\[data-auth-glass-mode="compositor"\]\)/);
  assert.match(css,/body\.public-home\[data-auth-glass-mode="compositor"\] \.auth3-root \[data-auth-glass-card\]/);
  assert.match(css,/-webkit-backdrop-filter:blur\(var\(--glass-fallback-blur,8px\)\)/);
  assert.match(homeCss,/z-index:2;\s*opacity:1!important;\s*visibility:visible!important/);
  assert.match(renderer,/if\(authContext\)\{/);
  assert.match(renderer,/if\(!authContext\|\|!instanceCount\|\|stopped\)return false/);
  assert.match(renderer,/audit\.authPresentation=authUsesCompositor\(\)\?/);
  assert.match(renderer,/pass\.draw\(6,tileCount\)/,"Homepage square WebGPU rendering remains unchanged");
  const shader=await load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl");
  assert.match(shader,/let glass=mix\(mipSample\(interactiveInnerUV,innerLOD\),/,
    "The original sign-in shader must still sample the full refractive GPU backdrop");
  assert.match(renderer,/authUniform\[18\]=authUsesCompositor\(\)\?1:0/,
    "Only explicit compositor mode selects the optical-highlight-only branch");
});


test("hybrid compositor keeps original WebGPU SDF and hover while never sampling stale scene pixels",async()=>{
  const [shader,renderer,css,shell]=await Promise.all([
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../src/styles.css"),
    load("../sites/_apex/assets/public-home.css")
  ]);
  assert.match(shader,/if\(authPane && state\.tintMeta\.z>0\.5\)/);
  assert.match(shader,/var tintStrength=select\(0\.25,0\.60,authPane\)/,
    "WGSL must use mutable var for per-role film strength, not let");
  assert.doesNotMatch(shader,/let tintStrength=select/,
    "Reassigning a WGSL let rejects the whole shader on real browsers");
  assert.match(shader,/let reflection=clamp\(\(edge\+pointerLight\)\*0\.75\*transmission,0\.0,0\.32\)/);
  assert.ok(shader.indexOf("if(authPane && state.tintMeta.z>0.5)")<
    shader.indexOf("let glass=mix(mipSample("));
  assert.match(renderer,/authUniform\[18\]=authUsesCompositor\(\)\?1:0/);
  assert.match(renderer,/authHover\.advance\(dt,reducedMotion\.matches\)/);
  assert.match(renderer,/authPresentation=authUsesCompositor\(\)\?/);
  assert.match(css,/backdrop-filter:blur\(var\(--glass-fallback-blur,8px\)\) brightness\(\.79\)/);
  assert.match(shell,/z-index:2;\s*opacity:1!important;\s*visibility:visible!important/);
});


test("default fixed-viewport WebGPU preserves the original full mipmapped material",async()=>{
  const [router,renderer,homeCss,shader]=await Promise.all([
    load("../sites/_apex/assets/public-home-transition.js"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-renderer.js"),
    load("../sites/_apex/assets/public-home.css"),
    load("../sites/_apex/assets/home-dashboard/dashboard-gpu-glass.wgsl")
  ]);
  assert.match(router,/body\.dataset\.authScrollMode=new URLSearchParams\(location\.search\)\.get\("auth-scroll"\)==="native"/);
  assert.match(router,/"native":"fixed"/);
  assert.match(homeCss,/body\.public-home\[data-auth-scroll-mode="fixed"\][\s\S]*?#public-route-content > #dashboard-auth-glass-scene\{\s*position:fixed;/);
  assert.match(renderer,/const authCanvasFixed=\(\)=>document\.body\.dataset\.authScrollMode==="fixed"/);
  assert.match(renderer,/authCanvasFixed\(\)\s*\?\s*Math\.max\(1,routeOutlet\?\.clientHeight\|\|0\)/);
  assert.match(renderer,/authScrollPresentation:authCanvasFixed\(\)\?"fixed-viewport":"native-content"/);
  assert.match(renderer,/const desiredTop=authCanvasFixed\(\)\?sceneTop\+"px":"0px"/);
  assert.match(renderer,/authUniform\[11\]=offsetCSS\*dpr/);
  assert.match(renderer,/authHover\.move\(event\.clientX\*dpr,\(event\.clientY-authOriginTop\(\)\)\*dpr\)/);
  assert.match(renderer,/tileData\.set\(makeLayoutData\(node,dpr,authOriginTop\(\)\),p\)/);
  assert.match(renderer,/pass\.setPipeline\(glassPipeline\);pass\.setBindGroup\(0,authGlassGroup\)/);
  assert.match(shader,/let innerLOD=glassLOD/);
  assert.match(shader,/let outerLOD=glassLOD/);
  assert.match(shader,/mipSample\(interactiveInnerUV,innerLOD\)/);
  assert.match(shader,/mipSample\(interactiveOuterUV,outerLOD\)/);
  assert.match(shader,/let faceBlack=select\(0\.20,0\.05,darkFace\)/);
});


test("fixed and native full-shader sampling are equivalent after scroll and elastic displacement",async()=>{
  const {authBackdropOffsetCSS}=await import("../sites/_apex/assets/home-dashboard/dashboard-scroll-optics.js");
  const dpr=2,sceneTop=44,cardContentY=708.5;
  for(const [scroll,elastic] of [[0,0],[190,0],[190,23],[190,-17],[-32,0],[1100,0],[1100,37]]){
    // Previous scrolling canvas: fragment is content-relative, and the shader
    // subtracts the measured position of the native compositor's canvas.
    const scrollingCanvasTop=sceneTop-scroll+elastic;
    const scrollingFragment=(cardContentY+33)*dpr;
    const scrollingUniform=authBackdropOffsetCSS(sceneTop,scrollingCanvasTop)*dpr;
    const nativeWallpaperSample=scrollingFragment-scrollingUniform;
    // New fixed viewport canvas: fragment itself is viewport-relative and
    // the shader's sampled backdrop offset is zero. Same original photo mip,
    // SDF, blur distribution, refraction envelope, tint and per-pane hover.
    const viewportFragment=(cardContentY+33-scroll+elastic)*dpr;
    const fixedUniform=authBackdropOffsetCSS(sceneTop,sceneTop)*dpr;
    assert.equal(nativeWallpaperSample,viewportFragment-fixedUniform);
  }
});
