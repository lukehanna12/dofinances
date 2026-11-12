# Dashboard Liquid Glass — Oracle provenance and remaining gaps

**Implementation:** `studio/dashboard-preview/optics.js` and appended material section of `home.css`.  
**Source of authority:** private `lukehanna12/liquid-plexiglass-oracle`, `main` commit `3fd32ed3be300560552dd4577907affef7a09737`.  
**Measured target:** macOS 26.5.1 / build 25F80 / Apple M2 / G14G.  
**Scope:** browser exploration on an isolated `dashboard-preview` branch, **not** a native-equivalent universal renderer and **not** a change to Oracle `main` or DoFinances production.

## Exact retained evidence used

| Stage | Retained source | Browser implementation and accepted scope |
|---|---|---|
| P, public geometry | `model/primary_evidence/scalars/live_public_geometry_radius_heldout.json` and `live_swiftui_public_radius_source.json` | Use public clear-style Double interpolation: `min(10,max(5,5+((min(w,h)-48)/72)*5))`. Exact on 52 retained public regular/clear held-out cases, not exhaustively proven for all layouts/environments. SwiftUI's source Double → half-value CAFilter writer is proved on eight cases; that writer is **not** a generic CSS mapping. |
| P, selected blur inputs | `model/primary_evidence/scalars/live_public_container_factors.json`, `live_public_blur_encoder_joins.json`, `live_blur_dataflow.json.xz`, and `model/primary_evidence/v5_reconciliation.json` | Retained same-case Float32 CPU product and encoder binding; in the selected observations, `observedBlurWord(radius,1,.25)` implements the ordered Float32 product and the 0.4f multiplier. `final_blur_radius_scale` remains OPEN for arbitrary public state. |
| P, geometry coefficients | `model/foundation/model/geometry_331_compact.json`, `model/foundation/canonical_evidence/records/P_to_S_PUBLIC_FINITE_DOMAIN_CONTRACT.json` | Finite `d=min(resolvedBackdropWidth,resolvedBackdropHeight)` input inner `max(-60,-.8*d)`, height `min(20,.25*d)`, outer `.2*d`, height `.125*d`, blur-dist0 `-.5*d`. All ten relations are established on ten recorded geometry cases; only two shadow relations checked on all 331. **Assumption:** the browser tile's border-box `min(w,h)` represents the resolved internal backdrop bounds. |
| S, exact mode5 four-corner shape | `model/foundation/canonical_evidence/records/glass_background_sdf_no_bleed_lph.ssa.json.gz`, `model/primary_evidence/sdf_bridge/` | Reuse `airMode5SDF` and `airSupercircleSDF` from the already implemented `sites/_apex/app/assets/sidebar-glass-oracle.js`. Retains polynomial, signed radii, mirrored four-corner selection, ordered max and normals. Reachable SDF mode4/5 CPU→binding bridge is closed on target. **Assumption:** browser equal CSS corner radii map to four negative signed corner lanes; this producer is not publicly established. |
| S, refraction and threshold | Same SDF AIR SSA; `P_to_S_BLUR_ALPHA_CONTRACT.json` | Reuse the native-derived `airRefractionEnvelope`, `airThresholdMix`, `airBlurDistribution` and integer-neutral SVG map encoding. One real private jointly captured `diagnostic_m1_b4.75_z1.0` supplies threshold/blur-alpha/refraction-opacity parameters. **Assumption:** combine them with separately observed public clear geometry; no matching public clear combined-material witness has been retained. |
| R, output sampling | `model/primary_evidence/v5_reconciliation.json` displacement matrix, `model/primary_evidence/target_gpu/` finite native evidence | Validated finite displacement matrix `(+1/(4*textureWidth), 0, 0, -1/(4*textureHeight))` motivates 1/4-pixel conversion, but browser pixel vs native downsampled texture coordinates is an **unproven transport**. SVG `feDisplacementMap` is not Metal native G14G. Two Gaussian scales represent near/far mip LOD; the native LOD calculation is retained but the replacement texture sampling is *not* exact. |
| C, compositor | `model/primary_evidence/compositor/c_stage_operator.json.xz` and `model/compositor_c_stage.py` | The target-locked second-successor relation is closed for the recorded program and config: `mask=supercircle_image(...); source=half4(mask)*color_per; color0=source+(1h-source.a)*dest0; color0.a=saturate(color0.a); color1=dest1`. We do **not** pretend browser CSS compositing equals that half-float path, nor attempt to reuse the target's source/destination Metal attachments. |
| Q, output color | `model/primary_evidence/output_chain/`, `model/NON_IDENTIFIABILITY.json`, `model/OPEN_PROOFS.json` | Runtime two-seed ColorSync → output-management resource → nontrivial EDR → final-target chain still OPEN. No private diagnostic face matrix is falsely generalized to the public clear style. Browser backdrop colors pass through unchanged. |

## Exact open boundaries

`model/OPEN_PROOFS.json` explicitly retains **three** OPEN obligations: `LG-SR-NATIVE` (full native equivalence), `LG-Q-NUMERICAL` (runtime final output path), `LG-P-SCALARS` (unrestricted blur factor source). Existing native 24/24 finite matching outputs and closed target-domain C-stage cannot be promoted to a universal browser-compatible Pixel Glass formula.

The output also has independent browser-only gaps, each marked `GAP(...)` next to the relevant code in `optics.js` and `home.css`:

1. Public clear-style material choice and composite **joint** parameters beyond finite state witnesses.
2. Per-tile CSS border geometry to private signed mode5 SDF writer.
3. Native texture coordinate / downsample-space dimensions to browser pixel displacement and encoded 8-bit PNG field.
4. Native filtered mipmap and float16 math to browser Gaussian / SVG compositing.
   - **2026-11-12 adapter correction:** the previous `blurWord / .25` and `farSigma=browserRadius` treated an inferred native radius as an 11px Gaussian at a 75px tile. It was an unsupported dimensional conversion. The new clear-style approximation retains native `airTextureMipLOD` and maps `2^LOD` box-filter footprint into a Gaussian of equal variance (`sigma=2^LOD/sqrt(12)`). The box-filter model and one native texel = one CSS pixel are **not native proofs**; the native blur word itself is unchanged.
   - **2026-11-12 refraction correction:** the original field applied a second `*.25` attenuation to native signed refraction amount. The retained normalized texture-coordinate matrix contains `1/(4*N)`, while a nominal `surfaceScale=.25` implies `N=.25*CSSWidth`; converting normalized offsets back to CSS pixels therefore gives `1/(4*.25)=1`, not `.25`. This assumes matched texture/display extents, **not verified for every native public state or SVG browser renderer**. The recovered four-corner/SDF/refraction expressions themselves are unchanged.
5. Verified public face/bleed/tint matrix, background/foreground factor selection and end-to-end color/EDR.
6. Browser-only specular border/glint and cursor interaction; no evidence of an exact Apple pointer-response law.

Do not delete these annotations until actual target-native evidence replaces the corresponding approximation.

## Why it remains valid for moving squares

The **input to the optical filter is always the live DOM backdrop** through CSS `backdrop-filter` / SVG `SourceGraphic`. The generated `feImage` resources contain only three geometry maps: inner/outer displacement vectors and blur mixing weights. No page image is ever read or copied: no `getImageData`, `drawImage`, media fetch, DOM screenshot or static wallpaper reference. The filter remains attached to each square; translation/animation changes *where* the backdrop is sampled without regenerating any scene image. `ResizeObserver` recomputes only when the square's actual layout geometry changes.

All occupied tiles share identical 11-column CSS box geometry, so one source-derived field is valid for all; each applied `backdrop-filter` still samples **its own** live backdrop. Empty cells remain transparent. A decoded-field coherency check commits all three PNG maps and blur parameters in one task. Unsupported browsers use real live Gaussian `backdrop-filter` as a scientifically *unverified* fallback (not a static image).

## Verification

`studio/dashboard-preview/test-optics.mjs` runs deterministic tests of finite public-radius cases, selected Float32 blur words, geometry-coefficient values, exact zero displacement encoding, AIR SDF/field determinism and no scene readback calls. The preview workflow assembles `dist/`, checks the linked assets and executes this test before Cloudflare Pages deployment. Tests validate bounded source correspondence and implementation invariants, **not** Apple-native pixel identity.

Scientific evidence does **not** include screenshots or appearance matching. Browser inspection may still be used to catch an implementation defect (e.g. a failed SVG filter or missing image) but cannot close an oracle proof.
