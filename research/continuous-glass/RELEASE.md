# Production replacement boundary

Run `node research/continuous-glass/release-gate.mjs`. It exits 1 while any required release gate remains open, and 2 for a malformed gate manifest. This is an auditable fail-closed research gate, not a production CI hook or proof checker. A future integration must wire the verified evidence gates into its deployment checks before replacing production. Production main has not imported any research modules.

The experimental renderer uses a continuous real-arithmetic model; its current source and box kernel are independent of the output raster, but it is not an exact native Glass implementation. Native precision can itself be quantized; native sampling and private kernel selection cannot be silently redefined for continuity. A candidate is not ready merely because its CPU and WGSL output agree. The remaining criteria explicitly preserve that distinction.
