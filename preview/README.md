# Real /app sidebar experiment branch

Edits on `test/app-sidebar` are made directly to the same `sites/_apex/app` HTML, CSS, and navigation module as the live workspace. This branch is never used for production deployment.

Every test-branch push deploys **only a static preview** to the existing Cloudflare Pages project on its non-production `app-sidebar-preview` branch. The actual /app document and styles are copied verbatim. Only the authenticated entrypoint is replaced with `preview-bootstrap.js`, which performs no account actions or network requests. All other controls except sidebar navigation are disabled.

Preview address: https://app-sidebar-preview.dofinances-studio.pages.dev/app/

The live site uses production branch `main`. The untouched baseline is saved as commit `7cced4fa98bac32261390cc256158eb2624a2ee3` and branch `backup/app-sidebar-before-experiments-20261108`. To discard an experiment, leave `main` untouched and abandon this branch.


## Oracle-driven browser port — current experiment

The live /app page HTML and the original `workspace-nav.js` remain untouched.
They continue to own navigation, focus, persisted collapse state, 260px wide
sidebar, 74px rail, and 274px mobile drawer.

The rendering layer uses:
- `sidebar-glass-oracle.js`: recovered LPH signed-distance and refraction
  expressions, finite public uniform-domain values, and exact evaluated
  regular-style blur-radius equations (52 independent held-out cases).
- `sidebar-glass.css`: neutral navigation material and ordinary CSS gradient,
  grid, and circle artwork spanning the WHOLE page as a test backdrop.
- `sidebar-glass.js`: original nav-row active-selection positioning and
  a preview-only PAGE-background selection control.

**There is no copy of the background embedded in the sidebar.** The native
browser compositor supplies the actual, live DOM backdrop as SVG
`SourceGraphic` to a scoped CSS `backdrop-filter:url(...)`. An SVG filter
uses `feGaussianBlur`, two separate `feDisplacementMap` passes and their
geometry-derived displacement fields. Canvas2D creates ONLY small signed-
distance displacement fields (two PNGs encoding XY vectors/alpha mix), **not**
page screenshots, captured DOM contents, generated wallpaper textures, or
anything containing source background colors. SVG-filter unsupported browsers
fall back to CSS `backdrop-filter:blur(...)`.

Oracle provenance (all files are byte-identical copied Git objects from the
canonical `lukehanna12/liquid-plexiglass-oracle` main branch):
- `preview/oracle-evidence/glass_background_sdf_no_bleed_lph.ssa.json.gz`
  retains the actual LPH AIR SSA. Signed-distance AA is in entry source
  lines 30–43. Refraction envelopes are in base lines 256–271 and 352–366,
  texture-coordinate displacement around 323–328 and 383–387, threshold
  mixing around 405–417. The `supercircle_sdf` helper is in lines 1062–1154.
- `preview/oracle-evidence/uniform_field_layouts.jsonl` maps the 52 field
  names, layout and types, including inner/outer amount, inverse heights,
  thresholds, blend opacity, color matrices, blur and shadow.
- `preview/oracle-evidence/P_to_S_PUBLIC_FINITE_DOMAIN_CONTRACT.json`
  records exact value domains from 331 retained public cases. The chosen
  modal scalar values are **individual finite observations**, not evidence
  that they all co-occur in one real material state.
- `preview/oracle-evidence/live_public_geometry_radius_heldout.json`
  contains 52 independent regular/clear public-state radius cases.
- `preview/oracle-evidence/mode4_exact_joins.json.xz` and
  `live_mode_joins.json.xz` include exact 48-byte CPU-to-shader SDF joins
  for mode 4 and 5. The currently implemented native-path SDF is mode4.

**Precision boundaries:** The native 25F80/M2/G14G AIR-to-G14G universal
semantics, all scalar/downsampling producer branches and final Q/EDR
output-color chain remain open. Web SVG Gaussian blur is not an identical
implementation of Apple's retained Metal mipmaps, and the browser filter
does not implement the complete 935-instruction LPH program or all
face/bleed/shadow branches. Converting native UV displacement through
a browser pixel-space identity matrix is an explicitly documented adapter
assumption. The port is more source-grounded but **not pixel-equivalent**
to Apple. Avoid treating source lineage, shader compilation or a pretty
screenshot as mathematical closure.

The CI test uses a temporary headless Chrome smoke script for actual filter
activation and real /app responsive interactions. It removes that script
from the deployment artifact before publishing.

Run: `node --test tests/dashboard-navigation.test.mjs tests/sidebar-glass.test.mjs`
Preview: https://app-sidebar-preview.dofinances-studio.pages.dev/app/
