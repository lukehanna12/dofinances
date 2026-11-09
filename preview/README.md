# Real /app sidebar experiment branch

Edits on `test/app-sidebar` are made directly to the same `sites/_apex/app` HTML, CSS, and navigation module as the live workspace. This branch is never used for production deployment.

Every test-branch push deploys **only a static preview** to the existing Cloudflare Pages project on its non-production `app-sidebar-preview` branch. The actual /app document and styles are copied verbatim. Only the authenticated entrypoint is replaced with `preview-bootstrap.js`, which performs no account actions or network requests. All other controls except sidebar navigation are disabled.

Preview address: https://app-sidebar-preview.dofinances-studio.pages.dev/app/

The live site uses production branch `main`. The untouched baseline is saved as commit `7cced4fa98bac32261390cc256158eb2624a2ee3` and branch `backup/app-sidebar-before-experiments-20261108`. To discard an experiment, leave `main` untouched and abandon this branch.


## Liquid Plexiglass regular-sidebar experiment

The test branch's actual /app page adds two entirely optional appearance
assets: `/app/assets/sidebar-glass.css` and `/app/assets/sidebar-glass.js`.
The original workspace navigation module remains responsible for all real
routes, persistence, 260px wide / 74px icon rail / 274px mobile drawer, and
the existing responsive breakpoints. No production /app source changes occur
until a future explicitly reviewed merge.

The presentation now uses a **neutral charcoal glass pane** over a
**single full-viewport geometric wallpaper**: a fixed grid, large outlined
rings, warm highlights, and teal accents. Those lines and gradients remain
visible outside the glass behind the whole workspace, and become softened
under the sidebar. The main workspace and topbar are intentionally
translucent rather than blacking out the background. CSS backdrop blur,
a rounded lens edge and fluid active-link capsule establish the navigation layer.
For capable browsers, a **single Canvas2D-generated background** is now shared
between the visible full-viewport wallpaper and a WebGL2 pane renderer. The
glass renderer samples those **same wallpaper pixels**, blurs the samples via
texture mip levels, bends them near a rounded-rectangle signed-distance
silhouette, mixes in a neutral dark regular material, and adds restrained
geometry-dependent and pointer-dependent specular light. The Lens on/off A/B
button isolates geometric refraction from the blur/tint. No screen captures,
DOM screenshots, third-party images, or network requests are used. The
CSS backdrop-filter fallback remains usable without WebGL2.

The preview-only Backdrop selector cycles **Gallery / Monochrome / Spectrum**
to compare the same untinted glass material over different full-screen
wallpapers. No actual navigation or account state is changed. CSS-only
and accessibility fallbacks remain available.

This upgrade is a genuine **browser-native pixel displacement of the owned
preview wallpaper**, but it is not the unknown actual Apple refraction kernel.
The target-specific Oracle has proven LPH selection, reachable SDF mode4/5
joins, and a finite compositor successor. It has NOT proven universal
AIR→G14G semantics, all CPU scalar/downsample selection, or the runtime
Q/EDR output chain. The browser uses an SDF *analogue*, a deterministic
texture LOD blur and tuned lensing constants, not fabricated Apple uniform
values or an unjustified port of the C-stage operator. Color management,
unowned DOM/behind-window pixels, and arbitrary content cannot be guaranteed
to match Apple's native material.

Test with: `node --test tests/dashboard-navigation.test.mjs tests/sidebar-glass.test.mjs`

Preview: https://app-sidebar-preview.dofinances-studio.pages.dev/app/
