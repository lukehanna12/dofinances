# Private SVGOMG editor - DoFinances Studio

The MIT-licensed SVGOMG frontend by Jake Archibald (pinned commit `f925656d40a507c512bf95ee14ad16445a4ad3ed`) is built by CI and bundled at `https://stu.dofinances.com/svg-editor/`. Its bundled SVGO worker optimizes SVGs in the browser. No external image generation, analytics or service-worker cache is enabled.

**Authorization:** The editor, its workers and assets use a Pages Function. Unauthenticated document navigation redirects through the apex `/api/studio/start` endpoint. Only the Dofinances account bound as Colosseum sole owner can create a one-time, 60-second grant. The Pages Function exchanges that grant for a 20-minute `__Host-studio_svg` HttpOnly session cookie and validates every request against the SQLite Durable Object, including the still-active originating apex session. Logging out revokes access. Every response is no-store and noindex. No apex cookies are transmitted to the Studio Pages host.

**Security:** The Pages Function must be deployed with the Studio; avoid deploying only the static `svg-editor` directory, as that would bypass authorization. The Pages `_routes.json` must include `/svg-editor/*`. The SVGOMG service worker is disabled to avoid caching private editor assets after logout. SVG content stays in the browser, and the frontend's original Google Analytics script is removed.

**Upstream:** https://github.com/jakearchibald/svgomg - MIT (license included in deployed package). The pinned commit should be upgraded deliberately, reviewing upstream changes to its analytics and service-worker bootstrap before changing the revision. Note that the external RealFaviconGenerator service is separately registered in Colosseum's `favicons` collection and its API key is not stored or provided by the editor.
