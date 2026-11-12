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
