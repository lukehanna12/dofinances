# WebGPU Liquid Glass Dashboard — implementation and proof boundaries

**Branch:** `dashboard-preview`, isolated from production `main`.  
**Native evidence:** `lukehanna12/liquid-plexiglass-oracle` at `3fd32ed3be300560552dd4577907affef7a09737`, macOS 26.5.1 / 25F80 / Apple M2 / G14G.  
**Objective:** a renderer in which future oracle discoveries change shader/math stages without requiring a new ownership architecture. **No current claim of native pixel identity**.

## GPU render graph

```text
                      GPU-OWNED SCENE
 original photograph --> GPUTexture rgba8unorm  (one-time upload)
                              |
               gpu-scene.wgsl: centered cover + authored veil
                              |
                [RGBA16Float scene, mip 0]
                              |
                  gpu-mipmap.wgsl (compute)
                mip 1 --> mip 2 --> ... --> 1 px
                              |
    gpu-glass.wgsl: oracle SDF, refraction, native LOD formula
                 manual textureLoad trilinear from actual mip levels
                              |
                    6 vertices x N instances
                              |
  canvas presentation  <--- copy full backdrop + blend refraction panes
                              |
               black Lucide SVG icons overlaid by DOM
```

The only public displayed page scene currently included in the GPU's backdrop input is the existing **centered original photograph**, the authored `12%` neutral overlay, and future layers explicitly drawn into that same GPU-owned scene. The glass does **not** pretend to read arbitrary external DOM under it. The top bars, footer, Workspace text, Projects button, and original 16 semantic icons remain ordinary HTML; they are not refractable scene inputs. To make unrelated HTML refractable, author it as a GPU scene layer (or build an explicitly versioned DOM-to-GPU representation), not a one-time screenshot.

## Files

- `gpu-renderer.js`: WebGPU initialization, source upload, immutable photograph handle, viewport-sized scene texture, dispatch of explicit mip level compute, per-square instance geometry, scene-versus-tile invalidation, pointer input and device-loss fallback.
- `gpu-scene.wgsl`: full-viewport source image cover transform and authored veil.
- `gpu-mipmap.wgsl`: actual GPU-generated `rgba16float` texture mip pyramid. Each level is computed from the preceding level by a specified 2×2 box kernel and written into a disjoint GPU mip subresource.
- `gpu-glass.wgsl`: recovered four-corner mode-5 shape and normals, signed-distance refraction envelopes and threshold, refraction-adjusted blur distribution, recovered LOD formula, **explicit** bilinear texel loads with trilinear interpolation, instanced rendering and provisional edge/color material.
- `home.js`: untouched original 11×6 layout and canonical Lucide icon data.
- `home.css`: GPU-ready mode clears former DOM tile materials, keeping only icons and center controls.
- `optics.js`: the previous live SVG backdrop implementation, loaded dynamically **only if GPU initialization or device execution fails**. Unsupported browsers never show a blank page.
- `test-gpu.mjs` and `ci-webgpu-smoke.py`: deterministic helpers plus real-wall-clock Chrome CDP GPU test, including one final GPU output pixel byte check and pointer-triggered redraw without regenerating the scene.
- `ORACLE_PROVENANCE.md`: details of the earlier mathematical evidence and browser approximations.

## Architecture invariants

1. A backdrop image is uploaded to a GPU source **once**. It is then rendered into the physical viewport-sized offscreen scene and reduced into a real mip chain.
2. Moving the pointer or tile coordinates redraws the glass and **reuses the existing backdrop and every mip**. The tile instances are sent as a small Float32 buffer; the future continuous motion path may advance geometry directly in the vertex shader.
3. A real scene edit or resize invalidates the scene and therefore rebuilds its mipmaps. The experimental `window.__dashboardGpuControls` interface separates `reflowTiles()` from `invalidateBackdrop()`; neither samples DOM screenshots or performs CPU pixel readback.
4. All occupied cells use one per-pixel shader, one shared scene texture, and one instanced draw, rather than 42 SVG filters. The original layout has 66 lattice slots, 16 icon-bearing tiles, and a deterministic occupied subset. Empty slots never allocate glass material.
5. The original image remains in CSS until a **successful initial GPU frame**. Device loss or unsupported WebGPU restores the SVG-backed preview without changing production.
6. Non-rendering HTML is independent of the GPU shader: accessibility, text, links, and footer remain DOM content.

## Oracle evidence actually used

- Exact retained `glass_background_sdf_no_bleed_lph` AIR-derived SDF and normals, negative four-corner mode-5 computations, refraction amount and threshold envelopes, blur alpha/distribution and LOD selection.
- Native public `clear` radius formula, exact on 52 finite public held-out cases.
- Selected Float32 blur word relation `f32(f32(radius)*f32(f32(transform*surfaceScale)*1.6))` with finite native producer/encoder joins; sampled factor `surfaceScale=.25`/transform=1 is **not** the universally proven public selection.
- Finite geometric coefficient equations in `geometry_331_compact.json` (source resolved bounds) mapped to the square's dimensions with an explicit unproven public-to-browser geometry assumption.
- Recovered native LOD expression is executed directly per pixel; texture sampling uses actual generated GPU mip levels, not any CSS Gaussian.

## Required evidence gaps — do not erase or hide

| Area | What is implemented | What is not yet proven |
|---|---|---|
| Mip reduction | Explicit 2×2 arithmetic box reduction into `rgba16float` levels | Apple's precise G14G mip generation, edge kernel, rounding and downsample ordering |
| Sampling | Manual Float32 bilinear/trilinear `textureLoad` | Native LPF/LPH filtering precision, texture fetch/LOD coordinate conventions and all G14G instruction semantics |
| Refraction | Port of retained AIR SDF/envelope/distribution/LOD equations | Full AIR↔native equivalence; all mode variants, public signed-radius writer and source texture-to-CSS coordinate selection |
| Material | Finite public `clear` blur input and separately recorded private diagnostic alpha/threshold | A captured **joint public clear-style** refraction/color/shadow state; material choice from the unrestricted public domain |
| Compositor | GPU source-over blend and provisional white rim | Target-locked native exact first/second successor equivalence for this browser composition, face matrix, alpha nuances |
| Color/output | Browser `rgba16float` offscreen with browser canvas display format | Runtime Q: extended-sRGB/ColorSync/EDR/output chain, chromatic adaptation, transfer and final display quantization |
| Backdrop content | GPU-owned photograph and scene layers | Automatic refraction of arbitrary external DOM/operating-system pixels not present in the GPU scene |
| Device consistency | WGSL on supported hardware | Byte-for-byte equivalence across Metal/Dawn/Vulkan/SwiftShader/G14G or other browsers |

The oracle's three open proof obligations (`LG-SR-NATIVE`, `LG-Q-NUMERICAL`, `LG-P-SCALARS`) remain open. Native 24/24 finite pair matches and target-locked C-stage closure do not warrant an unrestricted 100%-accuracy claim.

## Validation and CI limits

- Node tests check centered-cover geometry, tile/physical pixel mapping, selected native blur input, shader asset structure and absence of backdrop screenshot/copy paths.
- Headless Chrome uses a **real** WebGPU adapter and a real GPU compute/render command stream. On this GitHub Actions Linux SwiftShader runner, Chrome cannot create its presentation SharedImage/swapchain (`WebGPUSwapBufferProvider`), independently of WGSL compilation. The CI-only `?webgpu-offscreen-ci=1` mode therefore renders into a real GPU **offscreen color attachment**. The smoke test waits for GPU completion, reads one GPU output pixel's raw bytes, and verifies pointer movement causes a second frame without mip regeneration.
- **Passing offscreen CI does not certify macOS Chrome canvas presentation, visual fidelity or pixel-level Apple equivalence.** Actual Apple M2 GPU browser validation remains a separate acceptance criterion.
- The deployed browser uses the ordinary visible GPU canvas path, not the CI offscreen mode. On GPU failures it automatically falls back to the previously deployed live SVG implementation.

No visual comparison or screenshot similarity is used as mathematical proof. Optimization (tile geometry GPU motion, mip dirty-region updates, shader fusion, buffer lifetimes and device-specific specialization) comes after source-equivalence validation.


## 2026-11-12 full-oracle mode/precision reconciliation

The original preview hard-coded mode 5 with four equal signed corners. This
contradicted the retained target AArch64 `emit_sdf_bounds_internal` predicate:
four equal **normalized** private lanes select mode 4; any unequal or unordered
comparison selects mode 5. Exact same-event witnesses in
`model/primary_evidence/sdf_bridge/live_mode_joins.json.xz` show
(130,70,4,0), identity2x2, (0,0,20,0) for two equal-radius parameter
configurations; two unequal configurations have mode 5 with private
signed radii (-20,-3,-20,-36) and (-12,-28,-44,-6).
Each configuration was repeated, and the full 48-byte state was joined
to the actual fragment binding. The browser now implements the two
AIR source branches and mode selection with the same comparison semantics,
using CSS corner radii as an *unproved* public-to-private producer adapter.

The LP**H** shader selection is closed on the target by the native selector
proof. On WebGPU adapters advertising `shader-f16`, the port now
rounds supercircle returns and selected shape outputs at retained AIR
half-conversion boundaries. This is closer to native LPH precision; it is
NOT mechanically proved AIR↔G14G equivalence. Adapters lacking the feature
retain the original Float32 fallback and declare that status in runtime audit.

No other global oracle proof flag was altered; the target-native mip-kernel,
selected scalar producer, and final output Q remain unresolved.


## 2026-11-12 LPH AIR intermediate conversion reconciliation

Source `glass_background_sdf_no_bleed_lph.ssa.json.gz` (exact retained
graph, original Float32/Float16 opcodes):
- Lines 256–271 / 352–366: refraction uniform operands truncate to half,
  followed by half multiply/saturate/subtract/sqrt and half result.
- Lines 290–321 / 369–381: Float32 ramp FMA results are saturated and
  converted to half before weighted half alpha accumulation.
- Lines 321–337 / 379–397: Float32 blur-word product is rounded to half,
  branch-selected, half-log2 and half-clamped before texture sampling.
- Lines 323–328 / 383–387: UV is converted to half2 before addition of
  half-space displacement and subsequent promotion to sampler coordinates.

The WebGPU implementation now explicitly rounds at these selected AIR
boundaries when shader-f16 is supported. This improves semantic fidelity on
the verified M2 adapter, but no general AIR↔native G14G equivalence, precise
half logarithm equivalence or sampler subtexel arithmetic is claimed.


### Native alpha/coverage reconciliation (AIR lines 30–43)

The original preview used Float32 `0.5 - distance/fwidth` and clipped
its result. AIR actually computes fwidth of the **half** SDF distance,
clamps the denominator to half bit-pattern `0xH068E`, performs a **half
division**, promotes that result to Float32, adds `0.5`, saturates,
and truncates to half. The browser shader now explicitly preserves those
conversion boundaries. Exact target GPU derivative semantics remain open.


## 2026-11-14 isolated interaction refinement

The WebGPU preview models each glass square with its own hover and pressed
state. A deterministic, browser-only critically damped response follows the
pointer/touch/pen position within the square; the tile storage buffer adds
two `vec4<f32>` records for hover/press/location and recent pointer motion.
The source-backed AIR SDF, refraction envelope, and LOD remain unchanged.
A small bounded optical displacement and local highlight are explicitly
provisional **browser interaction**, not a proved macOS `interactive()`
shader or a universal Apple motion law. Their contribution is zero when no
square is engaged. Pointer events update the existing tile GPU buffer only,
never the wallpaper or mip pyramid. Reduced-motion settings disable the
spring interpolation. CI includes independent state-machine regressions
and a real GPU press/release check.

Important: exact native event-input-to-uniform timing and response, touch
semantics, highlights and spring constants remain unmeasured on 25F80.


## 2026-11-14 measured native tint input / isolated browser transfer

A finite native SwiftUI witness at oracle main `58a83a8`, named
`E-P-SWIFTUI-TINT-SCHEME-NATIVE-FINITE`, includes 104 regular/clear,
light/dark, interactive on/off and tint cases, reproduced in two native
processes. A tinted Glass adds one 80-byte vibrantColorMatrix and a larger
layer tree without modifying the original Glass filters. Its Float32 lane
18 exactly carries public tint alpha, including zero-opacity colored tint.
The additional matrix's 19 other lanes are scheme-specific and invariant
across recorded public tint hues. No native observation identifies where the
hue RGB values enter, or proves the executed tint color/compositing operation.

The Dashboard preview now has a separate, opt-in, removable tint stage.
The exact captured matrix coefficients and Float32 alpha are retained in
`tint.js`; a conventional 4x5 RGB transform and 25% maximum source-over
film are explicitly **browser assumptions**, not source-proved Apple output.
The default remains unmodified neutral glass. A nonintrusive palette can
switch None/Red/Blue/Green/White/Black, alpha and light/dark schemes.
This modifies only one 80-byte GPU uniform, never the background or mips,
and is supported by independent pure-code and real GPU CI checks. A
fallback CSS overlay covers non-WebGPU browsers. No oracle closure flag is
modified; source RGB producer, native matrix execution and Q remain OPEN.

## 2026-11-14 simultaneous mixed tint showcase

The isolated preview defaults to a mixed comparison on its 42 glass
blocks, cycling through untinted, red, blue, green, white and black.
Each consecutive six-block set uses one of seven previously measured
native alpha input values: 0.5, 0.75, 1, 0.95, 0.37, 0.25, 0.125.
Untinted blocks provide the comparison controls. The original grid,
semantic icons, and pointer interaction remain unchanged.

Tint parameters occupy a separate per-tile vec4<f32> GPU storage buffer;
changing the mode or a preset writes only this buffer, never the
backdrop or its mip pyramid. The UI can switch between Mixed showcase
and a uniform color, intensity and scheme; the fallback provides
matching individual CSS variables. This is a browser-only presentation
of the finite 25F80/M2 source-observed tint matrix and alpha inputs.
The hue source, effective 25% film blend and final Apple output chain
are unproved and explicitly remain provisional.


## 2026-11-14 expanded palette and corrected appearance direction

The 42 squares now compare 14 authored RGB variants, three times each at
source-recorded alpha levels 0.37, 0.75, and 1. They include untinted,
red, orange, yellow, green, teal, cyan, blue, indigo, purple, magenta,
pink, white and black. Native cases only tested the original subset.
**New hues are browser color controls, not target-validated Apple hue
producers.** The original 14x3 showcase retains all 42 tiles and the
per-tile GPU storage buffer; icon/geometry/SDF/refraction/mip logic
is unchanged.

The old preview interpreted the native scheme-specific vibrancy
`inputColorMatrix` as the pigment RGB transform. This is unjustified:
its scheme-dependent offsets (~-0.1 light, ~+0.1 dark) made the Dark
scheme show brighter tinted squares. The actual finite 25F80 Clear
material source also records `inputFaceColorMatrixBlack` 0.2
(light) / 0.05 (dark), `inputFaceColorMatrixWhite` 0.95 (light) /
0.80 (dark), and face white-fill alpha 0.1 (light) / 0.05 (dark).
Those face inputs consistently order Light above Dark.

The revised browser model keeps palette pigments identical across
schemes. The shader instead uses measured black/white endpoint
**inputs** as an explicitly provisional linear face-tone transfer
for every tile, including untinted controls; tint color film is then
applied at the same alpha irrespective of scheme. This prevents the
inversion and keeps the native matrix bytes as evidence only, without
misrepresenting them as a proven hue producer/compositor. Tests verify
endpoint ordering and Light > Dark for varied backdrop, opacity, and
hue. Exact native face transfer, tint compositing, ColorSync/EDR
remain OPEN, as before.


## 2026-11-14 full-resolution Colosseum wallpaper selection

The isolated Dashboard preview now uses the source `cloud-veiled-colorful-fields.avif`
from the 70-image Colosseum Wallpapers utility. The source is retained
**unchanged** at `studio/dashboard-preview/assets/cloud-veiled-colorful-fields.avif`:
2400 × 1600 intrinsic pixels, 106,094 bytes, SHA-256
`80006c73c633b57a9a2e63d17df9bbf35e8c86bc6d23491a12600eb8911842f2`.
GitHub Actions copies the AVIF byte-for-byte to the preview's
`/app/assets/dashboard-cloud-veiled-colorful-fields.avif` URL, verifies
its hash and tests that the WebGPU decoder reports the full intrinsic
dimensions. Both the GPU-owned scene and the CSS fallback use this exact
asset, with no intermediate image compression, resizing, or re-encoding.
As before, cover-fitting crops as needed for viewport aspect ratio;
sampling/viewport conversion and the GPU's original authored veil remain
unchanged. The existing production/Collections wallpaper references are
intentionally unaffected. The previously used rice-terraces image
remains untouched in the production source tree.


### AVIF direct-upload compatibility fallback

The first Dashboard AVIF CI run detected a Chrome/SwiftShader-specific
case where the browser successfully decoded the 2400×1600 AVIF, but both
`copyExternalImageToTexture` paths rejected the native decoded image.
On such browsers only, the renderer stages the **same unscaled 2400×1600
raster** through a temporary 2D canvas and `GPUQueue.writeTexture`,
using 256-byte-aligned RGBA8 rows. It neither saves nor re-encodes a
second image, and it never reads arbitrary DOM or screen pixels. Normal
hardware paths retain direct external-texture import. Both paths use
the same single RGBA8unorm source texture, authored scene, and mip
pyramid; user-requested source pixel dimensions and the original static
AVIF bytes remain unchanged. This browser-decoder adaptation does not
supply native Apple Liquid Glass evidence.


## 2026-11-14 lower-header removal and visible image viewport

Only the isolated Dashboard preview drops the second
`Workspace > Home` breadcrumb header. The independent 44px global
top bar stays intact. Both fallback CSS and the GPU scene begin below
its measured bottom and extend to the viewport bottom. The original
2400×1600 AVIF source is byte-identical; centered cover-fitting uses
the true unobscured viewport so the photo is re-centered within the
visible area rather than being composed behind an opaque header.
This changes which source pixels are visible, not the native pixel
resolution or the amount of image detail the display can resolve.
The GPU squares and pointer coordinates subtract the header height
before entering native-size canvas coordinates, preserving alignment
and existing interaction behavior. CI checks the header's absence,
the true scene boundaries, and original image resolution.


## 2026-11-14 responsive resize frame protection

Root cause: the DOM reflows immediately but WebGPU scene sizing and
GPU tile-data uploads were previously deferred to one requestAnimationFrame
and the completed image to another. Browser compositing could present
an older canvas backing texture against the new viewport size, briefly
stretching the photograph and glass squares.

The isolated preview now fences each genuinely changed layout:
synchronously switch from the old GPU frame to the already-available,
native-resolution CSS wallpaper and responsive CSS glass; coalesce resize
events into one rAF; synchronously rebuild the GPU scene and real mip
chain and submit an updated glass frame together; only expose the canvas
after `device.queue.onSubmittedWorkDone()` for the latest resize generation.
Older fence completions cannot reveal stale geometry. The render source
remains the byte-identical 2400×1600 original Colosseum AVIF. A deterministic
layout signature suppresses redundant ResizeObserver calls, and source
quality and all glass optical equations are preserved. CI uses CDP
viewport-size overrides and asserts eventual 1:1 canvas geometry,
full-source preservation, GPU re-render and completed resize fences.


## 2026-11-14 resize: continuous tint and appearance preservation

Follow-up regression: the prior resizing handoff exposed the **CSS glass**
when GPUScene was set to `resizing`. That fallback uses a different
background/tint/face approximation and cannot preserve the WebGPU material.
Consequently, red/blue/other pigments and the light/dark Clear face
visibly flashed while resizing even though the geometry was already
corrected.

The revised isolated preview **never switches material pipelines** for a
resize. The browser's resize event and pre-paint ResizeObserver delivery
immediately call `engine.rebuild()` and `engine.render()` in the same JS
task, updating the physical GPU canvas, native 2400×1600 AVIF source cover
fit, real GPU mip chain and 42 tile positions before yielding for paint.
The WebGPU canvas remains opaque/visible and the GLSL/WGSL tint/scheme
uniforms retain their selected state. GPU fence completion is telemetry,
NOT a trigger to reveal a differently colored material. Source-backed
shader calculations and browser approximation labels are unchanged.
Node and Chrome GPU CI verify no CSS scene transitions and retain named
tint/appearance settings across four physical viewport changes.


## 2026-11-14 slow upward loop, soft transparent wrap, Dark Clear default

The isolated preview's original 42 occupied blocks now move upward
on a **168-second continuous vertical track**, equivalent to one row
pitch every 24 seconds. The original six-row mosaic circulates over a
seven-pitch closed path: one additional lane beneath the former bottom
row allows squares leaving the top to teleport **only at alpha zero**,
then fade into the old bottom row as they travel upward. Leaving
squares fade over the pitch from the original top row to one row above.
Both transitions use smoothstep opacity, not an abrupt visibility toggle.

The browser-authored motion is computed once per rendered frame in
`track.js` and drives the same per-tile physical y-offset and opacity
for GPU glass and semantic DOM SVG icons. The moving hitboxes are
retargeted without discarding per-tile spring state; wallpaper
composition, 2400×1600 original AVIF, mipmaps, and the static hero
title/CTA are **not** recomputed or moved on motion frames. The motion
targets 30 fps and pauses when the user requests reduced motion.

The preview now defaults to **Dark appearance, no tint**, and the old
bottom-left palette is removed from the normal page. The complete
color model and presets are retained. Arbitrary hexadecimal RGB tints
can be applied later using
`window.__dashboardTintControls.setHex("#aabbcc",0.75)`.
The old palette remains optionally available with `?tintUi=1`
only for manual testing. Neither the motion nor new pigment selection
is represented as native Apple Liquid Glass behavior.

CI validates the six-by-seven cycle, invisible wrapping, slow phase
progression, icon movement, Dark Clear default, absence of the tint
button, optional hex/preset preservation, and zero backdrop mip
regeneration during motion.


## 2026-11-14 doubling speed and filling seven-row loop

The moving circuit is now **84 seconds per cycle** (12 seconds
per pitch), exactly twice the preceding 168-second implementation.
The original six-row, 11-column lattice remains geometrically stable.
Six additional **icon-less** glass squares occupy alternating columns
0, 2, 4, 6, 8 and 10 of an absolutely positioned seventh entry row
beneath the old bottom row. They begin below the previous bottom row,
transparent, and rise/fade in as their row progresses into slot 5.
An absolute row overlay avoids changing the centered hero's dimensions,
font metrics, or the six original row coordinates.

Three additional icon-less panes occupy formerly empty reserved
central cells (row/column positions 2:4, 2:6, 3:5) **behind** the
Workspace heading and button; z-order of those controls stays above
the GPU plane. The original 16 icon positions are unchanged. There
are now **51 GPU glass instances**, 16 of them icon-bearing, across
77 total DOM grid cells (66 original plus 11 seventh-row cells).
The footer's isolated-preview text is rendered at CSS opacity 0.5.

Original Dark/no-tint defaults, optional future hex tint API, per-square
hover interaction, responsive resizing, full-resolution AVIF, and the
no-background-rebuild-on-motion invariant are preserved. Node tests
and real WebGPU smoke verify track entry, geometry, all 51 instances,
original icon count, and footer style. The production branch is unchanged.


## 2026-11-14 subsequent speed and seventh-row pattern refinement

The 84-second cycle above was subsequently accelerated by exactly 15% in
velocity: `TRACK_SECONDS=84/1.15`, giving a full loop of approximately
**73.043478 seconds** and one-row travel every **10.434783 seconds**.
This preserves the existing opacity fades, seven-lane wrap, six original
rows, native-resolution background and Dark/no-tint defaults.

The six original seventh-entry-row glass squares are now distributed
left-to-right in the precise requested 11-cell binary occupancy pattern
`11010100101`: **columns 0, 1, 3, 5, 8, 10** (zero-indexed).
All other positions in that row are empty. The total remains **51 GPU
squares**, including the prior three behind the central heading/button,
and 16 unchanged icon-bearing squares. The footer remains 50% opaque.
The browser smoke test verifies the exact row pattern and numeric cycle
length, not merely the count of glass squares.


## 2026-11-14 prevent separate seventh-row flash on first paint

The seventh row formerly inherited the main lattice's `cta6-appear`
CSS keyframe animation during asynchronous WebGPU initialization, so
its opaque CSS panes could appear briefly before the GPU switched to
the transparent entry lane. The row now receives inline
`opacity:0` **before insertion**, and stylesheet rules reinforce it
and disable its CSS animations and transitions. The row still has
its full measurable DOM geometry for GPU instance placement, while
the independent WebGPU panes retain their normal bottom fade-in.
The other six-row lattice and central content retain their startup.
Browser smoke tests assert exact pattern, computed zero opacity and
no seventh-row CSS keyframe.
