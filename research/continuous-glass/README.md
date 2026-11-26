# Continuous Liquid Glass research (isolated, not production)

This reference is a mathematical control, not an Apple-equivalent renderer. No public route, Worker, CSS, build or shader imports this directory.

## Coordinate contract

Geometry and optical parameters use resolved logical points; the camera/display sampling map is separate. A genuine resize changes shape dimensions and may change native material state. Camera magnification and display density change the pixel footprint, not the underlying material inputs. Affine/nonuniform transforms require a distinct distance metric and normal transformation; they are not implemented here.

## Implemented controls

- Exact Euclidean signed distance for uniform circular-corner rounded rectangles, including circles, capsules and rectangles, with analytic gradients and level-set curvature where defined. This is intentionally not substituted for the native mode-4/5 supercircle field or its recovered normal operator.
- Continuous real-arithmetic extension of the current AIR-derived square-root refraction envelope. Preserve the singular boundary derivative; do not arbitrarily smooth it. Native half casts remain a separate execution contract.
- Logical point evaluation independent of framebuffer density and camera zoom.
- Exact binary16 rounding for normalized nonnegative UVs, illustrating the error introduced by quantizing viewport coordinates. This is not a proof of native sampler semantics.
- Fixed-source bilinear reconstruction with constant edge extension, and analytic integration over an axis-aligned rectangular box. The box is a test kernel, not an inferred Apple kernel. No source image can reveal information absent from its samples.

## Tests

Run `node --test research/continuous-glass/reference.test.mjs`. Tests compare the signed distance with independent boundary segment/arc geometry (3,402 samples), check scaling identities, gradients, medial-axis degeneracies, 180 density/magnification/point combinations, the refraction expression, half rounding and analytic reconstruction/integration controls.

## Native proof boundary

Oracle: `lukehanna12/liquid-plexiglass-oracle` at `6a10a83ad58de67a513c6f8b27cc2fd092913cf5`. Production baseline: `3908e7f50618bc38ba734178d2ff37fe2bbab50a`. Oracle P/S/R/C/Q evidence is authoritative within its admitted domain. This experiment adds no new native claims.

Next research gates: exact real-arithmetic counterpart of native SDF and normal operator, general Bézier contour nearest-point solver and winding/holes, explicit Jacobian and footprint integration, native blur producer/kernel/half sampling witnesses, dynamic interaction traces, color/EDR lineage, held-out internal GPU resource validation. Compare with unchanged production at ordinary sizes before wider deployment. Production replacement is prohibited until equivalence or superiority is demonstrated.

## Current research validation

See INGESTION.md, GPU.md, VALIDATION.json and RELEASE_CRITERIA.json for the current implemented and tested boundaries. The latest verified numerical code commit is ab0abdec40a6d6d42d9b7d812a47ba1b741f183d. The release gate remains blocked; no production path imports the research implementation.
