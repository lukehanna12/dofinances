# Vector ingestion prototype

The strict parser supports M/L/H/V/C/S/Q/T/A/Z with relative and implicit repeated commands, compact arc flags, and the authored project icon SVG primitive subset. Ellipses are converted using cubic Hermite segments with a declared absolute source-space error bound max(rx,ry)*step^4/384, excluding floating-point roundoff. The arc tolerance is an input, not a raster resolution.

The macOS helper expands strokes using CoreGraphics and unions filled regions, then emits closed line/quadratic/cubic outline contours. CoreText shapes glyph runs before extracting outlines, preserving per-run actual font and positions. These platform operations are candidate vector preprocessing, not native Glass optics. CoreGraphics stroke/boolean tolerances are not yet established, and text transforms, color fonts, browser font matching and portability remain open. Never commit proprietary font files. Run using a temporary executable and output directory.

The existing GPU solver limits paths to 128 monotone pieces and does not certify arbitrary topology. The ingest stage does not imply every output is accepted by that solver. No production route imports this code.

The test harness can compare generated outline membership against the production SVG Path2D fill/stroke operations directly (not screenshots). It also evaluates actual compiled shapes on WebGPU. The curve capacity is now 1024; the per-point adaptive node cap remains explicit. Run with LG_VECTOR_ASSETS set to the temporary output folder when invoking run-gpu-check.mjs. Membership differences are reported, not silently accepted.
