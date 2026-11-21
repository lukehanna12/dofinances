# Projects card icons and artwork

- Nine Lucide icons are vendored as exact upstream SVGs from the `lucide-icons/lucide` project (ISC license), plus four custom SVGs: the user-supplied treehouse for Ozoning Board, the approved Lucide-style Funnel + Code composite for Protocol Monitor Pruner, a Lucide apple with a short worm for Apple HIGs Reader, and an original Lucide-style Colosseum icon approved by the user. Assigned icons render in white at 28 × 28 px without the original number-circle background.
- Icon choices and image choices are keyed by permanent project slug in `../project-showcase.js`.
- Images remain external HTTPS references; no copyrighted artwork files are copied into this repository. Images for unassigned projects and images that fail to load retain the existing workspace-wallpaper behavior.
- External image servers may restrict hotlinking or change URLs. For guaranteed availability, obtain permission for copyrighted images and host licensed copies in Git-managed assets.

- Colosseum uses `colosseum-lucide.svg`, the approved white 24 × 24, 2-unit-stroke design with a sweeping taller left façade, slanted central seam, arched courses, and a lower right wing. Its assigned *Pastoral State* hover artwork is unchanged.
- Ozoning Board uses the latest `treehouse-ozoning.v3.svg`, preserving the user-supplied 24 × 24 viewBox and 2-unit strokes. The shared icon styling displays it as a white 28 × 28 px icon without a surrounding circle.

- Earlier Ozoning drawings remain at `treehouse-ozoning.svg` and `treehouse-ozoning.v2.svg` for compatibility. `treehouse-ozoning.v3.svg` contains the new single ladder rail and two rungs specified by the user. The versioned icon path and module-import chain avoid stale cached responses.
- Apple HIGs Reader uses `apple-worm.v3.svg`: the original Lucide apple outline is scaled and shifted slightly to make space for a short, single white curve that protrudes *outside the right edge*. There is no separate head or squiggle inside the apple. The earlier worm versions remain available for backward compatibility; the Projects card selects v3 at 28 × 28 px.
- Protocol Monitor Pruner uses `funnel-code.svg`: the approved white funnel with a genuinely interrupted top rim and centered Lucide-style code chevrons. It uses the same 24 × 24 grid and 2-unit strokes as the other icons.

## Artwork references

- BootScript: Frederic Remington, *Buying Polo Ponies in the West* (1905), WikiArt.
- ReadMe GLP: Claude Monet, *Gorge of the Petite Creuse* (1889), also catalogued as *Valley of the Petite Creuse* (Wildenstein 1230; Museum of Fine Arts, Boston, accession 23.541), direct Wikimedia Commons artwork image.
- ChatStore: Takashi Murakami, *Dragon in Clouds – Indigo Blue* (2010), Gagosian image of the artwork itself (detail, without gallery surroundings; artwork copyright Takashi Murakami/Kaikai Kiki Co., Ltd.; photography rights may apply).
- Colosseum: Thomas Cole, *The Course of Empire: The Arcadian or Pastoral State* (c. 1834), Wikimedia Commons (verified 960px rendering of the public-domain painting).
- Apple HIGs Reader: René Magritte, *The Son of Man* (1964); copyright-protected reproduction referenced externally.
- Unicode Plus: Samuel van Hoogstraten, *A Perspective View of the Courtyard of a House*, National Trust / Art UK image.
- Protocol Monitor Pruner: Paul Gauguin, *Meadow in Martinique* (1887), public-domain artwork. Note: the user's WikiArt link credits Gauguin, not Vincent van Gogh.
- Liquid Plexiglass 26: Andy Warhol, *After the Party* (1979), direct image from the Samek Art Museum, Bucknell University, shown at 112% final hover scale with a 3% downward shift; its entrance scale remains 1.1 × the final scale. Copyright belongs to the Andy Warhol Foundation / ARS; externally referenced, not redistributed in the repository.
- Ozoning Board: Frederic Edwin Church, *El Khasné, Petra* (1874), original image on Wikimedia Commons; public domain.
