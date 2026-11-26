# Projects card icons

The public and authenticated project catalogs assign the same sixteen current SVGs. Both directories contain only assigned icons, with identical bytes for each pair. The public Home and Projects share the same public source and content revision. The authenticated cards use their matching private asset. The Studio public directory contains only the current Apple HIGs Reader icon required by that build.

The CI revision check verifies exact catalog membership, SVG byte parity and the packed continuous vector geometry. When replacing an icon, update the catalog and vector pack, regenerate the content revisions, and remove the replaced SVG from both directories. Earlier artwork is available in Git history, not in production assets.
