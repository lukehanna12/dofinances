# Auth-3 for Studio

The user-approved Auth-3 reconstruction is deployed on the independently hosted Cloudflare Pages Studio project at both:
- `https://stu.dofinances.com/`
- `https://stu.dofinances.com/login/`

`src/components/Auth3.jsx` is the single React implementation. `src/styles.css` contains the scoped original CSS; root `index.html` and `login/index.html` are separate Vite HTML entrypoints built into `dist/index.html` and `dist/login/index.html`. This avoids routing fallbacks, custom Worker routes, and GoDaddy's apex hosting.

The icons, responsive layout, background photograph URL, card dimensions, and CSS entrance animations are preserved from the recovered Auth-3 UI. The right caption identifies Dofinances rather than React Bits Pro.

**Important:** This is a visual login preview only. No backend authentication is connected, and the email and identity-provider buttons do not submit data. Submitting the email form leaves the page in place; no visitor data is sent or recorded. Security and real authentication must be designed separately.

The existing studio landing page is replaced by this reconstruction, as requested. The separate Studio deployment does not require changes to DNS, GoDaddy, or the apex-domain Worker routes.

The GitHub Actions build verifies both HTML outputs. The deployment smoke job fetches both Studio URLs and validates that they contain the new page marker.

The Studio preview now defaults to dark mode. A fixed, accessible toggle in the bottom-right switches between dark and light mode using React state (without storing user preferences or contacting a server). Registration and help links use the exact literal inline-space text node from the recovered original; they are anchors to `#`, not simulated action buttons.

## Fidelity reconciliation (original Webpack module 55010)

The recovered module in the supplied Auth-3 V8 snapshot is the principal source. The Studio implementation now matches its measured type scale (30/36 heading, 14/20 body and social buttons, 16/24 email/primary button, 36/40 caption heading, 18/28 supporting caption), font weights (400/500/700), letter-spacing, 24px outside padding, 48px column gap, 448px card width, 32px card padding, 8px/16px corner radii, neutral colors, 12px social vertical gaps, 16px/24px/32px margins, and 200ms color transitions. Motion is used again, with the original 600ms/50px entrance values and 200ms stagger. The original SVG paths and photo URL remain unchanged.

The captured HTML specifies `--rb-font-sans: "IBM Plex Sans", "IBM Plex Sans Fallback", ui-sans-serif, system-ui, sans-serif`. Studio now loads that font family for normal/medium/bold weights. A heap snapshot does not include the browser's final computed Auth-3 font, so this is the best evidence-supported font choice, not a pixel-proof typeface measurement.

The source uses a nonstandard `dark:hover:bg-neutral-750` class, but the final compiled CSS value is not present in the snapshot. Studio uses `#333333`, approximately midway between the standard neutral-700 and neutral-800 values; this remains unverified.

The original form submitted no network request but logged the email in the developer console. Studio intentionally omits this privacy-sensitive log while preserving the user-visible submission behavior. Original social buttons and View more are inert; Create account and Get help link to `#` as in the source.

User-approved exceptions to source identity: Dofinances brand copy, unobtrusive design-preview badge, dark-first theme toggle, and minimal mobile clearance for that toggle. The original image can differ when Unsplash is unavailable. Motion's exact package version in the captured site cannot be recovered from this module, although the original animation parameters are retained.
