# Isolated WebGPU optical experiment

Based on the **architecture**, not graphical design, of Colosseum source `000183`
(`shadcn-labs/shadercn`): persistent shader pipelines, reused GPU textures,
small uniforms, full-screen triangle and GPU-only texture sampling. The lab
uses direct WebGPU/WGSL, without adding a React/TypeGPU bundler dependency to
the static DoFinances app.

`/gpu-lab/` exists only in the `test/app-sidebar` Pages preview. This is a
**controlled identical-texture experiment** and cannot substitute for the
actual full-page DOM backdrop. One `Canvas2D` image is provided to CSS as a
wallpaper and to WebGPU as a sampled texture; this makes input equal by design.
The existing production-authored `/app/` sidebar and its SVG backend remain
untouched. No DOM capture API or screenshot substitution is claimed.

The WGSL optical path uses the unchanged Oracle-produced mode5/f32 field
bytes and sidebar-specific blur-word projection. It reproduces the high-level
near/far sampling topology and SVG displacement scale. Two separable GPU
Gaussian passes approximate the CSS SVG blur and are NOT bit-identical to the
browser's or native Metal's blur. Alpha / color blending are explicit browser
adaptations; the public Q and final color path remain unproved.

**Promotion gate:** never replace the live DOM SVG filter until (1) a lawful,
continuous, exact-equivalence DOM backdrop input is available without
screen-capture permissions or flattening interactive content, (2) pixel
comparison over multiple representative backdrops meets an explicit target,
(3) GPU/CPU/frame pacing are measured on representative user hardware, and
(4) mobile pointer/accessibility regression tests pass. The lab itself does
not meet gate (1).
