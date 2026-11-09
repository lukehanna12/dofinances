# Oracle source-to-browser fidelity frontier

**Scope:** macOS 26.5.1 build `25F80`, Apple M2/G14G. This report
describes the test-branch browser adapter, NOT a mathematically closed
or pixel-equivalent native renderer. It is based on the canonical
`lukehanna12/liquid-plexiglass-oracle` repository's currently retained
evidence and deterministic tests.

## Current browser material

| Layer | Source evidence | Browser implementation | Claim boundary |
| --- | --- | --- | --- |
| Target program/precision | Target-locked LPH selector; six internal program IDs | `glass_background_sdf_no_bleed_lph` | LPH target route is closed within recorded target domain |
| Corner SDF | Mode4/mode5 AIR SSA, 108 same-event CPU48→shader joins, mode5 signed corner property | Four-corner `airMode5SDF` and `supercircle_sdf`; negative radii correctly use absolute magnitude | Mapping square-left/rounded-right *browser CSS* to native private signed lanes is an adapter, not a proved public producer |
| Signed-distance coverage | AIR SDF `fwidth`, clamped analytic coverage | Browser's actual rounded DOM clipping and antialiasing | Not identical target derivatives/raster coverage |
| Inner/outer refraction | AIR 256–271 and 352–366; same-case 264-byte live fragment bindings | Two separate signed-distance envelopes and geometry-only SVG vector fields over LIVE DOM backdrop | Native displacement matrix / texture coordinate mapping not universally proved for arbitrary browser dimensions |
| Inner/outer mip blur | AIR 271, 290–337, 366, 370–397; actual `blur_alpha0..3` and `blur_dist0..3` | Independently computed **refraction-adjusted** distances and two live-backdrop Gaussian branches; separate masks blended after sampling | Gaussian is only a browser approximation of Metal mip sampling; sigma mapping unproved |
| Refraction mixing | AIR 405–417, sampled-color mixing later in base function | Half-precision observed `refraction_opacity` and separate source-sampled branches | Color/alpha and extended output behavior approximate |
| Face-color material | Recorded half4 `face_cm0..2`, `face_opacity=1`; selected direct-execution color-matrix perturbation | SVG color matrix stage currently uses **identity passthrough**, retaining the private m1 matrix only for evidence | Public color/material selection and Q numerical output remain unresolved |
| Selection/collapse/navigation | Real `/app` `workspace-nav.js`, 260px desktop/74px compact/274px mobile | **Unmodified existing app ownership**; selected row geometry follows current route | UI behavior validated at three widths; no native glass input event simulator |
| Page source | Real `/app` HTML/CSS | One page-level background; browser `SourceGraphic` backdrop filtering; canvas contains displacement/mask data **only** | No embedded/snapshotted page bitmap inside sidebar |

## Retained evidence that was evaluated

The canonical model contains 12 exact AIR SSA graphs (7,432 static
instructions), six source-locked LPH Glass functions on the target, a
331-case public filter-state projection with 6,816 filter occurrences,
52 held-out public geometry-radius values, 48 exact live Glass
fragment-upload observations, 108 mode4/mode5 SDF joins, direct native
shader samples, and exact bounded C-stage successor evidence.

The test branch retains byte-identical copies of six relevant LPH SSA
graphs, the complete background fragment uniform ABI, direct sample
witnesses, the scalar and geometry records needed for source tests,
and additional read-only source-audit programs. It does **not**
re-upload the full Oracle or claim that all native code is executable
in JavaScript. The active finite background material is the complete
m1 diagnostic source binding `diagnostic_m1_b4.75_z1.0`; its private
diagnostic label must not be confused with SDF mode5.

The exact source trace exposed and corrected two particularly important
browser mistakes:

1. AIR `supercircle_sdf` begins with `fast_fabs(radius)`. Treating
   negative per-corner radii as a zero-normal case incorrectly erased
   valid displacement along straight edges; negative radii now use
   their absolute magnitude as the shader does.
2. AIR computes `inner_refraction_amount_effective + signedDistance`
   and `outer_refraction_amount_effective + signedDistance` **before**
   their independent `blur_alpha`/mip calculations. A single shared
   original-SDF blur mask was incorrect; separate source-driven inner
   and outer masks now precede the two displacement samples.

## Relevant Oracle behavior intentionally excluded

| Component | What the retained Oracle establishes | Why it is not activated |
| --- | --- | --- |
| Foreground glass (217- and 565-instruction LPH programs) | `GlassForegroundUniforms` 16-field ABI; directional refraction, chromatic aberration and multiple texture taps | No matching same-case foreground uniform/binding set corresponding to our active background material; do not fabricate aberration angles/intensities |
| Bleed-enabled background | Distinct `glass_background_sdf_lph` program and exact selector predicate | Current selected target trace uses **no-bleed** program; do not graft unrelated bleed branch into the active material |
| Shadow and holding tone | AIR conditional branches and recorded same-case background shadow/holding-tone fields | Full native filtering/compositor outcome and browser sampling equivalence are not established. Do not equate arbitrary CSS shadows to proven native coefficients |
| Full mip chain | Native blur radius, sampled LOD and source texture paths | Browser cannot substitute CSS Gaussian for exact M2/Metal mip sampling without numerical approximation |
| Native compiled instructions | Eleven native body classes with exact byte identity; finite AIR/native comparison evidence | `LG-SR-NATIVE`: authoritative all-path G14G semantics and formal AIR/native equivalence still open |
| Native final output | ColorSync, EDR, target ICC and bounded exact C-stage evidence | `LG-Q-NUMERICAL`: complete same-case final runtime color/output chain still unresolved |
| Unrestricted blur/public state | Public radius held-outs, CPU product and 9/10 reconciled scalar families | `LG-P-SCALARS`: remaining universal final blur scale selection/producer not proved |

The canonical `model/RETAINED_EVIDENCE_FRONTIER.json`,
`model/STATUS.json`, `model/OPEN_PROOFS.json` and
`model/NON_IDENTIFIABILITY.json` are the authorities for these
proof boundaries. The target-locked selector, SDF bridge and bounded
second-successor operator are closed only within their recorded
conditions; that does not prove browser or unrestricted native
pixel equivalence.

## Verification and safety

The isolated workflow executes source-derived Node/Python checks and
actual Chrome smoke tests at 1440×900, 980×760 and 390×844.
Production branch `main` and
`backup/app-sidebar-before-experiments-20261108` are unaffected.
The nonproduction URL is
https://app-sidebar-preview.dofinances-studio.pages.dev/app/.

**Performance is knowingly deferred.** The per-resize SDF field
generation and SVG backdrop chain are computationally expensive.
Do not silently simplify source-backed fidelity to improve speed
until the user requests the performance phase.

## November 9: sidebar-only blur-scale calculation

The browser now uses `sidebarFiniteBlurProjection(style,width,height)` and
the exact recorded Float32 factor `0x3ecccccd`, instead of relying on
synthetically composing a `surfaceScale=0.25` with `1.6` to infer that
factor for every environment. This is a scoped approximation to the exact
producer, grounded in the retained 25 public native factor observations and
independent 52-radius and eight encoder-join witnesses. It predicts word
`0x3fcccccd` at widths 260/274px and `0x3f7c57c5` at 74px.

The requested fresh same-event LLDB test at precisely those sidebar sizes
was attempted but **not completed**: both standard and single-job Swift
compiler runs exceeded the connected execution gateway's 200% CPU ceiling
before native code started. The temporary Mac files were cleaned and verified
absent. The canonical Oracle stores these calculations as **derived finite
predictions**, not new primary evidence or unrestricted proof closure.

## November 9: source/surface mismatch correction

The preview had three distinct integration regressions unrelated to
global Oracle closure: (1) the backdrop artwork sat on pseudo-elements
within an isolated shell, not in a shared page stacking layer; (2) the
displacement field forcibly zeroed x<width/2 in addition to the recorded
SDF boundary; and (3) the private m1 diagnostic face matrix was applied to
every public regular-style browser pixel, darkening the interface with a
material/color choice not established for this sidebar.

Corrections: use body-level full-screen wallpaper under transparent workspace,
remove local sidebar/root isolation, eliminate the arbitrary x<width/2
displacement clamp, and use a documented color-pass-through stage while
retaining the exact private diagnostic matrix for source tests. SVG sampling
continues to operate on the genuine browser backdrop. Neither change claims
native regular-style/Q pixel equivalence. Browser and static regressions
now check backdrop layering, visible full-panel SDF evaluation, and absence
of the private diagnostic darkening transform.

## November 9: complementary-alpha compositing correction

A browser-specific error was identified independent of the unresolved native
proof obligations. The existing filter used Porter–Duff `over` at three
complementary, premultiplied-alpha joins: near/far for each of the two
refraction paths, and the threshold-selected inner/outer path join.

The retained `glass_background_base` AIR instructions 430/437 explicitly
invoke `air.mix` on four-component sampled colors. For two opaque source
images and a mixing factor m, the intended premultiplied color is
`m * A + (1 - m) * B` with alpha 1; `over` instead yields alpha
`m + (1-m)^2`, introducing source-unjustified second attenuation of B.

The test branch now uses SVG `feComposite operator="arithmetic"` with
`k2=1,k3=1` at these exact joins. The three original sources, the
near/far blurred backdrops, the retained displacement maps, the source
mixing weights, and the face color passthrough remain unchanged.
W3C Filter Effects specifies the arithmetic operator and premultiplied RGBA
filter inputs. Chrome's controlled high-contrast browser experiment
confirmed that the former `over` version differed across 42,848/228,800
sampled pixels; this is evidence of a consequential browser implementation
error, NOT proof of Apple output-pixel equivalence.

This correction does not identify the missing full mip texture sampling,
native G14G instruction numerics, public color/material selection, or
runtime display Q chain. No additional native equivalence claim is made.
