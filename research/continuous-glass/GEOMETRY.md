# Native-shaped and vector optical fields

Research only. No production imports, no deployment.

The native-field module is the real-arithmetic counterpart of the existing AIR-derived browser adapter, constrained by Oracle's retained static graph at 6a10a83. Record: model/foundation/canonical_evidence/records/glass_background_sdf_no_bleed_lph.ssa.json.gz, SHA-256 1c038958ce291c58caef6e7d43d7518d92bccf840cd61639e8ebff1e989aba4d, supercircle_sdf lines 1062–1154. The graph contains intermediate float-to-half conversions at lines 1125, 1133, 1136, 1142–1144 and half min/max/add at 1145–1150; the browser supercircle code rounds only the returned triple. The diagnostic separates cast placement from full native float32, fast-math, DAZ/FTZ and G14G semantics. No native output equivalence is asserted.

Mode 4 and mode 5 use explicit logical coordinates, preserve the source-derived optical normal separately from analytic field derivatives, and conservatively return null for uncertified gradients. Only positive nonzero radius magnitudes and explicit private corner lanes are supported. The zero-radius browser branch is not extrapolated into a native claim. Mode dispatch and lane ordering were checked against static AIR 864–1041. The reference additionally exposes the graph's radial normal mix, renormalization and 2x2 normal transform as explicit state; nonzero state is not a proved reachable public native configuration. Numerical dispatch compares half distances in AIR, whereas the continuous reference compares unquantized distances.

Vector curves use adaptive de Casteljau subdivision with convex-hull AABB lower bounds and actual points on curves as upper bounds; the solver exposes an explicit distance interval and a node-budget failure state. Lines, quadratic and cubic segments and closed nonintersecting contours are supported. The sign uses monotone y subdivisions and half-open winding. Exact-arithmetic bounds have floating-point padding, not a formal interval arithmetic proof. No unique gradient is asserted for arbitrary contours. Overlapping/self-intersecting paths, native font shaping, elliptical arcs, stroke expansion, SVG parsing and GPU acceleration remain outside this implementation. The stored geometry does not depend on pixel resolution; evaluation tolerance is a requested numerical error budget.

Run: node --test research/continuous-glass/*.test.mjs

No new target measurement is admitted to Oracle in this change: static graph was already retained, and the new controls are browser/reference mathematical deductions rather than independently observed native execution.

Nested simple disjoint contours under nonzero fill are classified for active boundaries using other-contour winding and polynomial signed area. Same-direction nested outlines do not introduce false refractive edges. No automatic topology validation is claimed.
