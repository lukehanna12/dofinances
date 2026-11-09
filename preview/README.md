# Real /app sidebar experiment branch

Edits on `test/app-sidebar` are made directly to the same `sites/_apex/app` HTML, CSS, and navigation module as the live workspace. This branch is never used for production deployment.

Every test-branch push deploys **only a static preview** to the existing Cloudflare Pages project on its non-production `app-sidebar-preview` branch. The actual /app document and styles are copied verbatim. Only the authenticated entrypoint is replaced with `preview-bootstrap.js`, which performs no account actions or network requests. All other controls except sidebar navigation are disabled.

Preview address: https://app-sidebar-preview.dofinances-studio.pages.dev/app/

The live site uses production branch `main`. The untouched baseline is saved as commit `7cced4fa98bac32261390cc256158eb2624a2ee3` and branch `backup/app-sidebar-before-experiments-20261108`. To discard an experiment, leave `main` untouched and abandon this branch.


## Evidence-driven Oracle port: current stage

The preview uses the **actual** `/app` document and `workspace-nav.js`.
The original app owns all navigation, persisted collapse, accessibility,
260px expanded rail, 74px compact rail, and 274px mobile drawer. The preview
keeps account/network calls disabled; the live site is never deployed from
this test branch.

### Source-specific optical pipeline

**The sidebar never contains, snapshots or embeds any page background.** The
single, continuous wallpaper is ordinary `/app` page CSS. The browser's
backdrop compositor supplies actual pixels to an SVG `SourceGraphic` filter
anchored to the sidebar's CSS `backdrop-filter:url(...)`. Canvas2D produces
ONLY geometry masks (two refraction vector fields and one blur-level mask).

- Selected shader: `glass_background_sdf_no_bleed_lph`, the target M2 G14G
  LPH family.
- Real SDF: `supercircle_sdf` from AIR source lines 1062–1154,
  used through the **mode5 four-corner selection** (AIR lines 940–1041).
  Signed corner radii are processed through `fast_fabs` as the native
  shader requires, even for negative private corner lanes. The browser
  maps the actual square-left/rounded-right CSS geometry into this mode5
  representation. This CSS-to-private-state mapping is an adapter, NOT
  a universally proved native public-state producer. The right corner
  radius comes from the real computed sidebar CSS.
- AIR refraction: source lines 256–271 / 352–366, signed-distance-dependent
  inner and outer envelopes, and lines 405–417 for threshold mixing. Scalar
  projection uses the exact retained coherent diagnostic m1 case (index1,
  pass148, seq4208), not unrelated independently modal values.
- AIR blur distributions: source lines 290–337 for `blur_alpha0..3`,
  `blur_dist0..3`, `blur_radius`, and mip LOD. The observed uploaded
  distribution is [1, 0.5, 0, -0.5] at [-28, -1, 0, 0]. The browser
  evaluates the alpha/distance ramps at two **different refraction-adjusted**
  signed distances, as in AIR source lines 271 and 366, then interpolates two
  **live backdrop Gaussian** levels independently for each path.
  Gaussian sigma approximates the native mip footprint; the relative
  distribution is from the actual source.
- Face color: `face_cm0..2` directly from the SAME 264-byte uploaded
  diagnostic state, applied as a 4×5 SVG color matrix after refraction.
  The observed `face_opacity` is 1 for this state. The browser has sRGB
  rather than the native extended-sRGB/EDR working/output chain.
- Native public style radius: exact Double-order interpolation with all 52
  independent retained regular/clear cases passing. The native Float32
  blur-word producer is separately retained, but composing it with the
  diagnostic material coefficients is an explicit adapter assumption.

### Evidence inventory and correctness boundaries

Sources copied byte-identically as Git blobs from the canonical
`lukehanna12/liquid-plexiglass-oracle` main branch into
`preview/oracle-evidence/` include the six LPH graphs, uniform-field ABI,
48 live CPU fragment-binding prefixes, 52 public geometry heldouts,
public finite-domain contract (331 static cases), direct GPU execution
metadata and selected output/parameter witnesses. The live fragment buffer
is SDF48 + Glass (216 retained bytes). **Glass field offsets start at byte 48
in combined uploads**; previous zero-offset inspections were incorrect.

The 48 bindings contain two coherent material parameter states (24 each).
The active state is the m1 diagnostic with inner amount -44.8, outer +11.2,
inner/outer inverse heights 1/14 and 1/7, refraction blend opacity 0.30005,
face opacity 1, and a nontrivial 3×4 half-precision face matrix. It is a
finite **private diagnostic**, not evidence of universal public regular
material values. The other observed material m0 differs; a universal
selection rule is not established.

The retained exact GPU outputs prove that a selected color-matrix variation
changes 6,460 of 32,768 bytes for one source/configuration. The renderer must
not discard that effect on the grounds that its qualitative appearance is
small. Other output changes are observed for holding tone and clamp limits,
but their entire Q/compositor relations remain unsettled.

The adapter is NOT a pixel-identical LPH shader translation. It now
implements the mode5 four-corner SDF and correct inner/outer refraction-
adjusted blur sampling distances, but does not reproduce the full
935-instruction function graph, the native Metal mipmap sampler (SVG uses
Gaussian approximations), all bleed/shadow/holding-tone branches, or
G14G native and output Q/EDR semantics. A matching source
coefficient is not proof that a browser's color-space/primitive conversion
is identical. No visually tuned, unsupported constants should be presented
as Apple's own constants.

The CI workflow tests source fields against **the retained compressed 264-byte
upload** using canonical 48-byte SDF prefix and ABI offsets; validates the
public 52-case radius and AIR field operations; and runs actual Chrome at
1440×900, 980×760, and 390×844 with a temporary smoke script removed before
publishing. `main` and the rollback branch remain untouched.

**Known, deliberately deferred:** the per-resize geometry fields and SVG
filter chain are expensive, especially during collapse animation. Visual
fidelity and evidence exhaustion are prioritized before optimization.

Run: `node --test tests/dashboard-navigation.test.mjs tests/sidebar-glass.test.mjs`

Preview: https://app-sidebar-preview.dofinances-studio.pages.dev/app/

### Exhaustion checkpoint and deferred performance

A source-level audit of both foreground LPH programs
(`glass_foreground_lph` and `glass_foreground_sdf_lph`) recovered their
directional refraction, chromatic-aberration and four-tap sampling
operations, including the 16-field foreground ABI. **They remain disabled**
because the retained m0/m1 background fragment uploads do not constitute
matching foreground uniforms. Inventing the angles or aberration amount
would violate the evidence-first requirement.

The canonical Oracle's current target-locked frontier is 9 of 10 validated
scalar/geometry families, 108 mode4/5 SDF joins, and three still-open proof
obligations: `LG-P-SCALARS` (final blur scale), `LG-SR-NATIVE` (formal
AIR/native equivalence), and `LG-Q-NUMERICAL` (runtime final color chain).
The bounded resolver/precision selector and C-stage second successor are
closed on their documented scopes. Exact browser pixel-equivalence is
**not proven**. See `preview/ORACLE_FIDELITY_AUDIT.md` for the implemented
and intentionally excluded source features.

The expensive SVG and full-resolution geometry rendering are left
unchanged with respect to optimization. Optimize only after source-backed
fidelity review, as requested.

### Sidebar-specific blur-scale projection (November 9, 2026)

The active code now calls `sidebarFiniteBlurProjection()`, selecting the
observed finite native factor **0.4f32** directly and preserving the exact
Float32 public-radius multiplication order. The accompanying
`preview/oracle-evidence/sidebar_blur_scale_finite.json` is copied from
canonical Oracle `model/derived_evidence/sidebar_blur_scale_finite.json`.
It reports 52 validated native radius cases, 25 finite factor/zero-override
cases, and eight exact existing CPU→Metal encoder joins. The expected sidebar
regular-style words are **1.600000023841858** for 260px/274px panes and
**0.9857142567634583** for the 74px icon rail.

**Scope:** These sidebar-width values are *derived predictions*, not fresh
native captures of their exact public-state/renderer cross-product. Attempts
to compile a native 8-case LLDB verifier on the target Mac were terminated
before execution by the connected gateway's enforced sustained 200% CPU
ceiling, including when compiling with `swiftc -j 1`. All temporary source,
compiler workspaces and launcher files were removed and cleanup confirmed.
Neither `LG-P-SCALARS` nor exact browser Gaussian-to-Metal mip equivalence
is closed by this projection. Optimization remains deferred.
