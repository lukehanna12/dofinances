# Full retained-oracle evidence exhaustion audit — Dashboard Clear squares

**Audit performed:** November 12, 2026.  
**Authority (read-only):** `lukehanna12/liquid-plexiglass-oracle`, locked `main` at
`3fd32ed3be300560552dd4577907affef7a09737`.  
**Target:** macOS 26.5.1 / 25F80 / Apple M2 / G14G.  
**Consumer:** `lukehanna12/dofinances`, isolated branch `dashboard-preview`,
`studio/dashboard-preview/` only.

## Certification statement — precise scope

**PASS: full retained-file intake exhaustion.** A clean private clone was
checked at the pinned commit. Every one of the **331 tracked files** was read
in its entirety, hashed and classified; all **136 JSON records** (including
Gzip/XZ) parsed; 31 other compressed payloads decompressed; 14 raw retained
binary files checked for nonempty content. The deterministic path+SHA256
manifest digest was
`29aeeb1fa3dd4285550009a5b8ec838a464e1e73977eccf9ea22ac7ce0937`.

The content-hash metadata for **28 canonical original assets** was independently
rechecked; **12 AIR SSA graphs / 7,432 instructions** were traversed; the
11 retained native object/text identity bridges were recomputed from the
actual compressed object bytes. The fresh-clone evidence runtime passed,
canonical core passed (**6 tests**), and the full modern oracle regression
suite passed **308/308**. The source-boundary audit ran against the actual
preview shader files and passed all 10 contract checks.

**NOT CERTIFIED: mathematical exhaustiveness of Apple Liquid Glass.**
Reading and validating all retained repository data cannot prove that
missing target instructions, states, dynamic branches or unobserved
runtime resources do not exist. It also cannot prove browser-to-native
bit equality. Three global proof obligations remain legitimately OPEN.
No closure flag was changed, no oracle files were modified, and no
visual/screenshot comparison was accepted as scientific evidence.

To rerun:
```bash
python3 studio/dashboard-preview/audit-oracle-evidence.py \
  /path/to/liquid-plexiglass-oracle \
  /path/to/dofinances --run-tests
```

## Complete 331-file role inventory

| Reproducibly classified role | Files | Relevance |
|---|---:|---|
| Canonical machine contracts, AIR graphs and manifest | 29 | Exact shader flow, CPU→S relations, numerical primitive/domain contracts |
| Finite mathematical models | 8 | 252-state model, environment/geometry factorization |
| Governance / source models / documentation | 37 | Claim scopes, open obligations, provenance, verifier algorithms |
| Proof regressions | 76 | Exact-byte, finite-equation, and counterexample checks |
| Derived bounded evidence | 13 | Public radius/transform/mipmap and CAFilter source models |
| Primary retained evidence | 139 | CPU/native state, machine binaries, GPU samples, exact successor/output resources |
| Native probe/reproducer programs | 29 | Objective-C/Swift/LLDB/Metal independent testability |
| **Total** | **331** | **Entire committed retained evidence set** |

Every role is enforced by `classify()`. Unexpected new paths,
file-count changes, changed bytes, and parse failures cause the audit to
stop instead of silently treating an updated repository as already read.
This is tied to the pinned SHA; rerun when the oracle changes.

## Exhaustion mapping: existing oracle knowledge → corrected WebGPU code

| Stage | Strongest relevant retained evidence | Current implementation/result |
|---|---|---|
| Public material geometry | `primary_evidence/scalars/live_public_geometry_radius_heldout.json`: 52 independent held-outs; DesignLibrary static normal-return body | Original `nativePublicBlurRadius("clear",w,h)` relation preserved. Public width/height → native internal selected geometry is only finitely established. |
| CPU SDF mode selection | `sdf_bridge/mode5_private_predicate.json`, `mode5_producer_control_flow.json`, `live_mode_joins.json.xz`: exact AArch64 code and 8 same-event draws | **FIXED:** eliminated unconditional mode 5. Native ordered-equality predicate picks mode 4 for four equal normalized lanes and mode 5 for unequal/unordered lanes. Public CSS→private normalized-lane writer still unproven. |
| AIR SDF shape | 12 exact `glass_*.ssa.json.gz` SSA graphs; 7,432 instructions; 108 exact bridge joins | **FIXED:** separate mode-4 supercircle and four-corner mode-5 branches. Mode-5 uses exact four signed lane shuffle, pair means, ordered signed-distance max. |
| Native LPH arithmetic | Selector exact function bodies and target-specific LPH-only proof; AIR `fptrunc` and `air.sqrt.f16`/`log2.f16` stages | **IMPROVED:** adapter shader-f16 half casts at selected SDF/refraction/blur/LOD/UV boundaries. Unsupported adapters fall back to Float32. Full G14G equivalence remains open. |
| Native CPU blur-word producer | `live_blur_dataflow.json.xz`, 64 scale joins, 80 public mip transition cases and 240 exact binding pairs | Finite Float32 word relation preserved. Browser selected scale 0.25 is proven for relevant observed cases, *not* every transform/renderer path. |
| Texture mip producer | `C_tau_CONTROLLED_GATE_EXECUTION_TOPOLOGY.json`, `public_native_mipmap_transition_matrix.json` | Real GPU mip levels, but 2×2 reduction kernel is an explicit unverified approximation. Clear/Regular native compute topology differs; a universal Apple mip kernel is not retained. |
| GPU sampler | `R_tau_NUMERICAL_PRIMITIVE_CONTRACT_v2.json`: 729 coordinates × eight settings, exact nearest in 4 and software Float32 mismatch in four linear settings | Manual bilinear/trilinear remains a **known finite non-equivalence risk**, not a source-verified G14G sampler. Neither undocumented native filter nor browser sampler identity is claimed. |
| Color/material | 331 public CAFilter cases / 6,816 occurrences; `P_to_S_PUBLIC_FINITE_DOMAIN_CONTRACT` 33 exact projected fields and 10 historical unresolved families | Avoided promoting private diagnostic matrices to public Clear. Provisional edge/face tint and cursor glow remain explicitly uncalibrated; exact joint public Clear material is not retained. |
| Compositor | `compositor/c_stage_operator.json.xz` exact target/program/config, 589,824 held-out pixels | Closed *native C successor* applies only to its specified actor/resources. It is **not yet proven to represent our browser glass-over-photo composition**, so automatic formula substitution would overclaim. |
| Output/display | `output_chain/` and `Q_tau_EXTENDED_SRGB_WORKING_SPACE_CONTRACT.json`, 150 exact standalone chain rows / 300-row fixed oracle | Browser presentation pipeline is not bit-identical to runtime ColorSync/EDR. Correctly remains OPEN. |

## Remaining, irreducible proof obligations

1. **LG-P-SCALARS:** one of ten source scalar families still needs an
   unrestricted `final_blur_radius_scale` producer/consumer proof.
   The current square receives the finite selected Clear source rule.
2. **LG-SR-NATIVE:** 11 byte-bridged current G14G Glass text classes, all
   paired with AIR, but full authoritative native instruction semantics
   and mechanical equivalence are missing. The hardware counterexamples
   rule out assuming Float32 or arbitrary G13 candidate opcode semantics.
3. **LG-Q-NUMERICAL:** the actual active same-case ColorSync→EDR→final
   display target chain has not been retained and independently replayed
   over two nontrivial seeds. Existing standalone conversions are not enough.

**Additional browser-only gaps** are not silently attached to these three
native obligations: mip reduction, sampler mechanics, CSS/private SDF
writer, public Clear edge/face/interaction policy, WebGPU/Dawn/Metal
precision and device color management, and the fact that arbitrary DOM
content outside the GPU-owned backdrop cannot be captured as a texture.

## Validation performed

- Re-ran all **308** `model/test_*.py` oracle regression tests on a clean
  clone plus the 6 canonical core tests, and verified evidence runtime.
- Executed the new pinned 331-file repository inventory/checksum audit.
- Built the isolated Dashboard preview through GitHub Actions, including
  source math, shader compilation, WebGPU offscreen texture/mip,
  tile-instance draw, internal output bytes and pointer-motion/no-mip-rebuild
  tests.
- Executed a live visible-canvas smoke check on the Mac browser with actual
  WebGPU and native half feature. The runtime reports 42 occupied panes,
  16 icons, all 42 selecting SDF mode4, 11 real mip levels and one scene build.
- No modifications to either oracle `main` or DoFinances production `main`.

The result is **exhausted available retained files and implemented several
previously ignored source-proven paths**—not a declaration that Apple's
complete Clear Glass mathematical model or displayed pixels are solved.


### Native alpha/coverage reconciliation (AIR lines 30–43)

The original preview used Float32 `0.5 - distance/fwidth` and clipped
its result. AIR actually computes fwidth of the **half** SDF distance,
clamps the denominator to half bit-pattern `0xH068E`, performs a **half
division**, promotes that result to Float32, adds `0.5`, saturates,
and truncates to half. The browser shader now explicitly preserves those
conversion boundaries. Exact target GPU derivative semantics remain open.
