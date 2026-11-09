# Sidebar performance / fidelity boundary — November 9, 2026

Scope: `test/app-sidebar` only. The canonical `liquid-plexiglass-oracle`
mathematical equations and parameters are **not** candidates for arbitrary
simplification. The existing SVG filter consumes the browser's *actual live
DOM backdrop*; this is not equivalent to a rasterized DOM clone or a shader
over a separately supplied image.

## Evidence from same-browser Chrome comparisons

An instrumented 1.2-second trial with two real sidebar toggles reported:
* Full live SVG Oracle: typically 45–55 frames, with several gaps >34 ms.
* Native CSS blur-only: typically 73 frames and zero >34 ms gaps.

The specific cause is the Chromium multi-stage SVG backdrop filter path.
Moving SDF computation and PNG encoding off the main thread, reusing maps,
deduplicating unchanged blur-word attributes, and applying basic compositor
hints did not eliminate the GPU-rendering bottleneck. Absolute frame timing
from headless Chromium on CI is not a benchmark for the user's Apple Silicon;
however same-run controls isolate the relative effect.

Reproducible samples:
* https://github.com/lukehanna12/dofinances/actions/runs/42602982211
* https://github.com/lukehanna12/dofinances/actions/runs/42603783629
* https://github.com/lukehanna12/dofinances/actions/runs/42611569309

## Candidate optimizations rejected (not installed)

1. `will-change: transform` / compositor promotion of the background and
   main content: resting images remained effectively identical, but motion
   remained 51–54 frames, without meaningful improvement.
2. Detached fixed-position SVG pane / pseudo-layer: resting pixels nearly
   matched but the animation performance did not meaningfully improve.
3. CSS preblur combined with SVG refraction: no meaningful motion benefit.
4. Blob URLs replacing byte-identical field PNG data URLs: the **entire 260×900
   panel** compared at exactly 0 mean / 0 maximum difference, but animated
   backdrop tests produced 23 frames in 1.2 s for **both** Blob and data URL
   variants. The transport itself is not a sufficient fix.
5. Axis-invariant nine-slice tiling: **fails byte-exact mode5 field
   equivalence**. For the actual 260×900 field, inner-map channel G at
   x=250,y=30 differs from x=250,y=450. Do not reuse a 1px-tall repeated
   right-edge tile. No formula or material parameter should be changed to
   force tiling.
6. Single-path inner-only filter: removing outer refraction improves render
   timings but discards a mathematically distinct source-derived branch.
   Prior "0 different pixels" comparisons sampled a cropped portion, not
   the entire rim; they do NOT justify collapsing the paths.
7. WebGPU lab: controlled synthetic backdrops run, but the observed image
   delta is ~20.6/255 mean RGB, and WebGPU does not get arbitrary live
   DOM pixels as a texture. Not a fidelity-preserving replacement.

Library evidence:
* https://github.com/nordify/css-liquid-glass — samples the real DOM via
  backdrop SVG filter, but uses simplified/nine-sliced optical profiles.
* https://github.com/lucaperullo/simple-liquid-glass — high-throughput
  WebGL renderer relies on provided scene textures / captured HTML, with
  imperfect/stale capture for arbitrary live DOM; its SVG path keeps live
  sampling and uses compressed/resampled maps.
* https://github.com/medfa12/liquid-glass-react — explicit backdrop image
  requirement for WebGL.

## Release rule

Do not promote any alternative based on resemblance, source comments, or
partial-crop screenshots. Preserve the whole source-derived inner/outer
geometry, threshold/mixing, blur distribution, actual live backdrop input and
mobile pointer behavior. Only integrate performance changes when same-case
full-pane pixel comparison and multi-resolution/interactive regressions pass,
and frame pacing measurably improves on target hardware. A faster blur-only
fallback is *not* the same glass and must never silently replace it.

The active app/sidebar rendering and Oracle repository were intentionally
left unchanged during these tests. Only CI diagnostics and research notes
were revised.
