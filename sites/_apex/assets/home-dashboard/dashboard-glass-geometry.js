/* Public compatibility import for the one shared glass geometry model.
 * The authenticated /app renderer is deliberately out of scope. */
export {normalizeGlassCornerRadii,glassPaneNeedsLiveTransform,
 selectGlassSdfMode,resolveGlassSurface,resolveGlassOpticalGeometry,
 glassContainsPoint,classifyGlassContent,planGlassLayers}
 from "./dashboard-glass-model.js";
