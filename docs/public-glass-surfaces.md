# Public Liquid Glass surfaces: geometry, layers, interaction

**Scope:** public `/`, `/projects` and `/login` on dofinances.com. **Out of scope:** `/app`, its authenticated dashboard, and studio. Those assets and renderers are not changed.

## Evidence and limits

Reference: [liquid-plexiglass-oracle](https://github.com/lukehanna12/liquid-plexiglass-oracle), commit `6f59bb46423e2e11e50ef7da4aabae4d3ea35d40`, target macOS 26.5.1 build 25F80, Apple M2/G14G. `model/foundation/model/geometry_331_compact.json` supports the **finite** ten-case relationship `d=min(resolvedBackdropWidth,resolvedBackdropHeight)`, not the first mosaic square's width. `model/primary_evidence/scalars/live_public_geometry_radius_heldout.json` supports 52 held-out public blur-radius observations. `model/primary_evidence/sdf_bridge/status.json` retains finite mode4/mode5 live GPU bindings and the four-lane native comparison.

These do not prove a universal browser/native implementation. `model/OPEN_PROOFS.json` still lists native semantic equivalence, runtime output color/EDR, and one scalar family. CSS-to-private-SDF projection, unrestricted affine/elliptical corners, native texture-mip selection, and native hover/click dynamics remain unproved. Visual appearance does not constitute Oracle evidence.

## Public shared surface model

`assets/home-dashboard/dashboard-glass-model.js` defines geometry, CSS corner-overlap normalization, surface shape classification, content roles, layered backdrop declarations and interaction springs. It accommodates squares, circles, horizontal/vertical capsules, rectangles and four-corner rounded rectangles.

The Oracle's `nativeMode` is still the finite 4/5 corner comparison. For true CSS round-ended silhouettes, `renderMode=6` deliberately uses an *authored analytic capsule/circle field*, not a fictional Apple mode-6 fragment. All shape branches feed the same WebGPU refraction, blur distribution, LOD, tint-film and hover/press lighting stages. The original mosaic mode4/5 code is preserved.

Each public surface now owns its own resolved minimum dimension and projected blur word. The first-square optical-size override is removed. The public SVG fallback also calls the common geometry projector; its SVG blur remains a browser approximation rather than a native Metal equivalence.

Home glass has two actual GPU layers: the moving squares at layer 0, and the bottom CTA capsules at layer 1, which refract the completed layer-0 scene with refreshed mip levels. The layer planner rejects missing or recursive backdrop dependencies. The public Sign in and Projects routes preserve their present scroll, DOM and GPU presentation semantics; other arbitrary HTML backgrounds are not captured.

Content roles distinguish text, icons, flat shapes, mixed overlays and glass silhouettes. Existing Projects title glyphs retain their GPU alpha mask; ordinary foreground labels/icons remain accessible DOM content on the glass.

The public square and pane controllers use the same reversible spring equation and shape-aware hit regions. An oblong capsule has a longer browser hover footprint; the original square's material response and press strength are preserved. No Apple-exact event law is claimed. Reduced motion and reduced transparency behavior are retained.
