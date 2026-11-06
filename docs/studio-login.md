# Dofinances Studio — Auth-3 source-fidelity implementation

## Live routes and scope

- `https://stu.dofinances.com/`
- `https://stu.dofinances.com/login/`

Both routes use the same `src/components/Auth3.jsx` component and Tailwind 4 stylesheet. The abandoned `sites/_apex/login/` implementation remains absent. No change is made to apex, GoDaddy, DNS, D1, or Cloudflare Worker routing.

## Grounded source and current fidelity approach

The Auth-3 component was extracted from `Auth-3.heapsnapshot` as Webpack module 55010, SHA-256 `021eed03ff549fea1b23b7056acda39d681e2eb67c79ec61e9e19cf1157d2f7a`. The reconstruction copies all **28 className strings in their original order**. The exact source class contract resides at `tests/fixtures/auth3-source-class-contract.json`, enforced by `tests/studio-login.test.mjs`.

The original component uses Tailwind utilities (including dark, hover, focus, placeholders, spacing, border, radius, text sizing, line height, weight, tracking, shadows, responsive visibility and alignment). Instead of manually translating those utilities into approximate CSS, this project uses Tailwind CSS 4.2.2 with the corresponding Vite 8-compatible plugin. Motion controls enter transitions exactly as authored: x=-50px, opacity 0→1, duration 0.6 seconds for the card; x=+50px, opacity 0→1, duration 0.6 seconds, delay 0.2 seconds for the caption.

The site theme variables observable in the live documentation tab include:
- `--radius: .8rem`
- `--radius-lg: .8rem` (12.8px)
- `--radius-xl: calc(.8rem + 4px)`
- `--radius-2xl: 1rem` (16px)
- The regular Tailwind 4 neutral color scale in OKLCH (50–950) and `ui-sans-serif, system-ui` default font.

These are now defined or inherited through Tailwind 4 rather than manually inventing hex colors, dimensions, font weights and transitions. **Important:** The Webpack module does not contain the original compiled CSS or source maps, and the authorized live-tab capture tool was unable to read the actual iframe's document. Its accessible outer documentation page is not the same DOM as the Auth-3 demonstration. The preceding reconstruction incorrectly treated some outer-page browser measurements as direct iframe evidence. This revision avoids repeating that error.

The Webpack source contains `dark:hover:bg-neutral-750`, but the accessible site theme does not define `--color-neutral-750`. The class is preserved verbatim, without inventing a replacement color. The precise behavior of that particular hover state remains unverified.

## Original behavior and intentional differences

The source has functional email control state, an email form that prevents default navigation, inert social-provider and View more buttons, and links to `#`. Those visible semantics are retained. The source's diagnostic logging of entered emails is intentionally suppressed to protect user privacy. There is **no authentication backend**, no network request and no email storage.

The user-requested customizations are:
- Dofinances name and caption instead of React Bits Pro marketing copy.
- Default dark mode plus a fixed bottom-right light/dark toggle, toggled in React state without persistence.
- Standalone Studio deployment with a React/Vite entrypoint.

The page is still a **visual sign-in preview**. Theme toggling and user-requested branding are not original Auth-3 features. The original photograph URL and all three recovered social SVG icons are preserved.

## Verification

Automated tests enforce exact matching of source class strings and structural behavior, theme tokens, two entrypoints and absence of the old apex page. CI builds the app and performs live smoke checks on both Studio URLs. Source-class equality is strong evidence of CSS fidelity; without a capture of the iframe's rendered pixels at matching viewport and interactive states, claiming complete pixel identity would be unwarranted.

For very short mobile viewports (up to 640px wide and 700px high), the additional theme toggle is placed after the card rather than overlapping the original help text. This is a user-toggle-only responsive exception; all 28 original source classes remain unchanged.

## 2026-11-06 — 386 × 800 original iframe computed-style reference

The user supplied a matching-state iframe HTML document and a 29-node computed-style/geometry capture measured on a Mac in Chrome (device pixel ratio 2), with the original `html.dark.disable-transitions` frame. Comparison against the locally built Studio version at the same CSS viewport found:

- Identical major geometry: stage 386×800; row x=24, width=338; card x=24, width=338, padding=32, radius=16; input x=56, width=274, height=52, border=2, radius=12.8; primary height=48, border=0, radius=12.8; social height=46, border=1, radius=12.8, 12px gaps.
- Identical sampled active colors: card/input `oklch(0.205 0 0)`, social background `oklch(0.269 0 0)`, neutral-700 borders `oklch(0.371 0 0)`, secondary text `oklch(0.708 0 0)`, primary white.
- Original card height was **589px**, local Chromium card height **590px**. Original card y=105.5 and local Chromium y=105; most child y values differ by 0.5px. The original Chrome-on-Mac anchor fragment measured 120.617×16.5px whereas local Chromium-on-Linux measured 121.375×19px despite identical CSS font-family and 14px/20px/500 computed typography; this is strong evidence of a platform-font glyph-metric difference, not a CSS spacing-token mismatch. Do **not** compensate by shifting the layout 0.5px or hard-coding the card height; this would worsen fidelity on the user's Mac.
- Verified discrepancy corrected: original outer/root foreground inherited white `rgb(255,255,255)`, while Studio root inherited black. The default dark root foreground now explicitly inherits white; light mode uses dark foreground. All previously explicit child colors remain unchanged.
- The capture's `disable-transitions` class forces computed transition = `none` at capture time. The original source still includes 200ms hover/focus transitions; do not remove these based on that transitory root class.
- The source's external Unsplash background has not been successfully fetched in the isolated browser/container network. Neither a local background image nor its successful display in the user's browser can be asserted from this capture. The URL and overlay match the supplied source. Verify a real image response in the user's environment before diagnosing its appearance.

This is a source-based and computed-style comparison, not photographic proof of pixel parity. Pixel comparison at the same browser/operating system and a loaded original background remains the final validation step.

## Typography environment verification (November 6, 2026)

The original user's Chrome-on-Mac iframe capture at 386 × 800 reports `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` as computed font family, and explicit weights of 700 for the primary heading, 500 for interactive links/buttons, and 400 for regular descriptive text. The current Studio build's computed font family, size, line-height, weight and tracking already match these declarations in the isolated Chromium audit; changing these values without a contradictory Studio-on-Mac computed trace would reduce source fidelity.

This change reinforces the original font environment at the app root, keeping the normal-weight 400 baseline, native system font stack, macOS antialiasing, default kerning/optical sizing, and automatic weight synthesis explicit in the base CSS layer. It deliberately does **not** alter any original 28 class strings or artificially increase or decrease font weight. A font-family string cannot prove the resolved native font face on the user's Mac: the last possible visible discrepancy needs actual platform rendered-font information (Chrome's Computed/Rendered Fonts panel) from both pages under the same browser/OS.
