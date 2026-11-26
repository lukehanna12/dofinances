# Experimental GPU evaluator

This is not the production renderer or a claim of native equivalence. The WGSL compute pipeline evaluates mode 4, mode 5 and exact circular-corner Euclidean shapes in logical coordinates; uses the stable continuous refraction envelope, fixed-source bilinear box integration, explicit Clear/Regular face inputs, and existing authored interaction/tint terms. It returns field, backdrop and color values to an owned storage buffer. The tile evaluator integrates pixel coverage and color by explicit configurable subpixel quadrature, returning premultiplied linear RGBA. The source raster is independent of output density and magnification. It is not yet a GPU path solver or arbitrary affine footprint integrator. Its small-source direct integration loop is not a production-scale implementation; the separate CPU prefix integration provides the efficient reference for later GPU acceleration. Native blur/interaction selection, half arithmetic, native antialiasing, final color/output and full held-out native fidelity remain unresolved.

Run on macOS with Chrome and Node 24:
```sh
node research/continuous-glass/run-gpu-check.mjs
```
Uses an isolated temporary browser profile and owned internal storage readback, no screenshots. Compares GPU values against the independent JavaScript reference at thousands of query coordinates and repeated equivalent logical footprint tiles. This is CPU/GPU candidate consistency, not Apple Glass validation.

Coordinate transport now computes edge-relative coordinates, pointer deltas and source-origin-relative coordinates in binary64 before conversion to WGSL float32. This reduces cancellation under deep zoom. The test includes offsets as small as ±0.000001 point at a 4096-point rectangle and a partial-coverage tile at its edge; these are finite controls, not arbitrary-precision GPU guarantees.
