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

The presentation uses a semitranslucent dark regular-glass pane, CSS backdrop
blur/saturation, a rounded lens edge, a fluid moving active-link capsule, and
a progressive WebGL2 specular/grazing-light overlay. A CSS-only fallback
remains usable without GPU support. The three-scene Backdrop selector
(Aurora / Neutral / Prism) is intentionally preview-only and changes no
actual routes or account state.

Exact Apple CA/Metal native semantics, true runtime refraction, and the
output-color/EDR Q-stage remain unresolved in the Oracle model. These
browser effects are constrained, design-informed approximations, not
claims of numerical equivalence.

Test with: `node --test tests/dashboard-navigation.test.mjs tests/sidebar-glass.test.mjs`

Preview: https://app-sidebar-preview.dofinances-studio.pages.dev/app/
