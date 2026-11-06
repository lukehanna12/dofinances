# Auth-3 for Studio

The user-approved Auth-3 reconstruction is deployed on the independently hosted Cloudflare Pages Studio project at both:
- `https://stu.dofinances.com/`
- `https://stu.dofinances.com/login/`

`src/components/Auth3.jsx` is the single React implementation. `src/styles.css` contains the scoped original CSS; root `index.html` and `login/index.html` are separate Vite HTML entrypoints built into `dist/index.html` and `dist/login/index.html`. This avoids routing fallbacks, custom Worker routes, and GoDaddy's apex hosting.

The icons, responsive layout, background photograph URL, card dimensions, and Motion entrance animations are preserved from the recovered Auth-3 UI. The right caption identifies Dofinances rather than React Bits Pro.

**Important:** This is a visual login preview only. No backend authentication is connected, and the email and identity-provider buttons do not submit data. Submitting the email form leaves the page in place; no visitor data is sent or recorded. Security and real authentication must be designed separately.

The existing studio landing page is replaced by this reconstruction, as requested. The separate Studio deployment does not require changes to DNS, GoDaddy, or the apex-domain Worker routes.

The GitHub Actions build verifies both HTML outputs. The deployment smoke job fetches both Studio URLs and validates that they contain the new page marker.

The Studio preview now defaults to dark mode. A fixed, accessible toggle in the bottom-right switches between dark and light mode using React state (without storing user preferences or contacting a server). Registration and help links use the exact literal inline-space text node from the recovered original; they are anchors to `#`, not simulated action buttons.

## Fidelity reconciliation (original Webpack module 55010)

The recovered module in the supplied Auth-3 V8 snapshot is the principal source. The Studio implementation now matches its measured type scale (30/36 heading, 14/20 body and social buttons, 16/24 email/primary button, 36/40 caption heading, 18/28 supporting caption), font weights (400/500/700), letter-spacing, 24px outside padding, 48px column gap, 448px card width, 32px card padding, 12.8px input/button and 16px card corner radii, neutral colors, 12px social vertical gaps, 16px/24px/32px margins, and 200ms color transitions with the original `cubic-bezier(0.4,0,0.2,1)` easing. Motion is used again, with the original 600ms/50px entrance values and 200ms stagger. The original SVG paths and photo URL remain unchanged.

Although the site theme editor names IBM Plex Sans, a saved Chrome protocol capture of the actual rendered Auth-3 preview resolves its font to `ui-sans-serif, system-ui, sans-serif` with emoji fallbacks. The reconstruction now uses the **measured rendered font** and makes no external Google Fonts request.

The source uses a nonstandard `dark:hover:bg-neutral-750` class, but the final compiled CSS value is not present in the snapshot. Studio uses `#333333`, approximately midway between the standard neutral-700 and neutral-800 values; this remains unverified.

The original form submitted no network request but logged the email in the developer console. Studio intentionally omits this privacy-sensitive log while preserving the user-visible submission behavior. Original social buttons and View more are inert; Create account and Get help link to `#` as in the source.

User-approved exceptions to source identity: Dofinances brand copy, unobtrusive design-preview badge, dark-first theme toggle, and minimal mobile clearance for that toggle. The original image can differ when Unsplash is unavailable. Motion's exact package version in the captured site cannot be recovered from this module, although the original animation parameters are retained.

## Original computed-style audit — border, outline, geometry, alignment and Motion

Source: saved `ProtocolMonitor-Auth-3.json` (original React Bits Pro page, 818×800 dark-mode preview), checked against the exact recovered Webpack module 55010. These are **browser-computed measurements**, not inferred from generic Tailwind defaults:

| Item | Captured value |
| --- | --- |
| Outer surface | 818×800 px, centered flex, 24 px padding |
| Content row | Width 770 px at capture size, maximum 1400 px; 48 px gap; centered both axes |
| Card | Width 448 px; 16 px corners; 32 px internal padding; 25/50/-12 px black shadow at 25% |
| Heading | 30 px / 36 px line / weight 700, 8 px bottom margin |
| Input | Width 384 px, height 52 px; **12.8 px** corners; **2 px solid** border; padding 12×16 px |
| Continue | Width 384 px, height 48 px; **12.8 px** corners; **0 px** border; padding 12×24 px |
| Social buttons | Width 384 px, height 46 px; **12.8 px** corners; **1 px solid** border; 12 px gap between buttons |
| Divider | Center-aligned, 20 px high, gap 16 px, margin-bottom 24 px |
| View more | Width 384 px, height 20 px; **inline-block**, centered; margin-bottom 24 px |
| Help | Centered, 14 px / 20 px line / weight 400 |
| Button transition | 200 ms and `cubic-bezier(0.4,0,0.2,1)` |
| Input transition | All properties, 200 ms and `cubic-bezier(0.4,0,0.2,1)` |
| Unfocused outline | Computed width 3 px, but style **none**: no visible outline in resting state |
| Typeface rendered | `ui-sans-serif, system-ui, sans-serif` plus emoji fallbacks |

Corrections: earlier 8 px control corners were demonstrably wrong; the original renders 12.8 px. Social/input/primary border thickness and corner shapes now match the browser capture. Original button transitions use Tailwind's cubic-bezier rather than the generic CSS `ease`, and only controls with source transitions animate color. The previous global card/text transitions were removed. The source social, Continue and View more buttons have a default cursor; the user-added theme switch remains interactive with a pointer cursor.

**Limits of evidence:** The captured computed style is for the resting, dark-mode original. The 3 px computed outline has style `none`; exact keyboard-focus and pressed-state visual styles were not captured, so the Studio version retains its accessible focus-visible outline instead of claiming unfounded focus-frame parity. The original's nonstandard `neutral-750` hover color is still approximate. Dofinances branding, preview badge and the requested dark-first toggle remain intentional differences.
