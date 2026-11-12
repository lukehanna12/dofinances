# Liquid Glass Gallery — stu.dofinances.com/

A separate public, non-authenticated gallery of five interactive browser Glass studies. The earlier Studio sidebar/navigation demo remains at /app/; the protected Dofinances dashboard remains on the apex host.

## Five interactive studies

1. **Surface** — expandable rounded glass panel, focus/keyboard activation.
2. **Action** — a spring-responsive button, press/click feedback.
3. **Selection** — three-state segmented control, arrow/Home/End keyboard selection.
4. **Adjustment** — native range slider controlling browser highlight strength.
5. **Switch** — accessible on/off switch for a brighter browser glass presentation.

The background selector has Flat, Design, and Photo modes. The photo is the existing first-party home-rice-terraces-hq.jpg asset copied to /app/assets/ by the Pages job. The designed environment is authored entirely in CSS; no paid providers, externally hosted imagery, runtime backend, or additional access grants are required.

## Native evidence versus browser adaptation

The gallery-field-worker.js worker imports the existing audited browser Oracle module (/app/assets/sidebar-glass-oracle.js). Each surface gets an independent FOUR-corner mode-5 field using retained AIR-derived airMode5SDF, airRefractionEnvelope, airThresholdMix, airBlurDistribution, and displacement quantization. Fields are computed at each component's dimensions off the main thread with bounded caches and stale-response rejection. The measured public radius interpolation and QuartzCore Float32 blur-word arithmetic inform the SVG filter's two Gaussian scales.

**These are browser interpretations, not bit-perfect Apple shader outputs.** Gaussian blur does not reproduce Metal mip LOD sampling, SVG displacement is quantized, the retained private diagnostic's optical coefficients are not a proven joint public material state, the unproved public color matrix is deliberately bypassed, and the interaction springs are authored rather than captured from a native interactive-control trace. The Oracle P/S-R/Q obligations remain OPEN.

Browsers without SVG backdrop-filter, OffscreenCanvas, or an adequate Worker retain CSS blur, usable controls and background choices. Reduced transparency and forced colors also avoid the experimental optics. No backdrop pixels are copied or stored.

## Source and routes

- studio/gallery/index.html — static root gallery.
- studio/gallery/gallery.css — layout, materials, background scenes and accessibility.
- studio/gallery/gallery.js — interaction controls and SVG-filter assembly.
- studio/gallery/gallery-field-worker.js — bounded native-derived field generation.
- studio/sidebar/ — preserved older Studio at /app/.
- sites/_apex/app/assets/sidebar-glass-oracle.js — unchanged Oracle math.
- .github/workflows/site.yml — packages the gallery only into the Pages job; the apex Auth-3 login retains the original Vite build.
- tests/studio-gallery.test.mjs and scripts/verify-live-gallery.mjs — static and live browser checks.

Deployment continues solely through gated GitHub Actions. No Colosseum catalog, account store, permissions, DNS or private Dofinances app source is changed.
