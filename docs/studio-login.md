# Dofinances Auth-3 sign-in — current architecture and historical fidelity notes

_Updated 2026-11-11. The Auth-3 React/Vite build is **only** the apex `/login` experience. The current `stu.dofinances.com` Pages deployment is an independent static workspace preview assembled from `studio/sidebar/`._

## Current authentication (November 2026)

Email verification and one-use password recovery links are implemented under `/verify` and `/reset`, with TOTP authenticator MFA and single-use recovery codes configured from `/app`. Sender activation uses Mailtrap transactional Email API with a domain-scoped API token and verified sender; without these, new registration and email delivery are disabled. See [Account security](account-security.md). Google and GitHub identity-only OAuth are also implemented, subject to configured client credentials. See [federated authentication](federated-auth.md). Earlier notes below describe the original visual design and the chronological rollout; they are not current feature-status statements.

# Dofinances Studio — Auth-3 source-fidelity implementation

## Historical rollout: November 6, 2026 — First live account authentication

The apex `/login` form now submits real email/password sign-in and sign-up requests to same-origin Worker endpoints. Successful authentication issues a secure HTTP-only cookie and sends the browser to the server-protected `/app` dashboard. Account and session records are held in an independent SQLite-backed Durable Object, **not D1**. Authenticated account deletion is available.

Cloudflare's native PBKDF2 implementation is capped at 100,000 iterations; this first-stage system uses that limit and should migrate to a reviewed memory-hard KDF before holding sensitive financial information. This is an initial authentication implementation, not a finished consumer identity platform. At that original rollout, email verification, password resets, MFA and external sign-in were not enabled. **These statements are historical**: verification, reset, TOTP and optional Google/GitHub sign-in are now implemented; a social sign-in button is enabled only when the corresponding OAuth credentials are configured. Previously captured style utilities and source provenance are retained.

## Live routes and scope

- `https://stu.dofinances.com/` and `/app/` — the standalone, non-authenticated Liquid Glass workspace preview. Its login/account operations are disabled.
- `https://dofinances.com/login` and `https://dofinances.com/login/` — the functional Auth-3 sign-in/registration UI, published through the apex Worker.
- `https://stu.dofinances.com/login` and `https://stu.dofinances.com/login/` — removed (HTTP 404).

The React source remains `src/components/Auth3.jsx` with the same Tailwind 4 stylesheet. GitHub Actions builds the Auth-3 Vite entrypoint once, packages `dist/index.html` and `dist/assets/` into apex Worker assets for `/login`, and **separately overwrites its Pages job's copy** of `dist` with the static Studio workspace. No compiled assets are committed to the repository. A top-level `public/404.html` provides generic missing-page behavior; Pages still served the retired `/login/` URL with HTTP 200 after the first rollout, so `functions/login.js` explicitly returns HTTP 404 for both `/login` forms. The Pages deployment checks out `functions/`, and `public/_routes.json` includes only the two retired paths to avoid Functions execution on the Studio homepage or other static resources. No DNS, GoDaddy, D1, or host-routing changes are required.

## Grounded source and current fidelity approach

The Auth-3 component was extracted from `Auth-3.heapsnapshot` as Webpack module 55010, SHA-256 `021eed03ff549fea1b23b7056acda39d681e2eb67c79ec61e9e19cf1157d2f7a`. The reconstruction copies all **28 className strings in their original order**. The exact source class contract resides at `tests/fixtures/auth3-source-class-contract.json`, enforced by `tests/studio-login.test.mjs`.

The original component uses Tailwind utilities (including dark, hover, focus, placeholders, spacing, border, radius, text sizing, line height, weight, tracking, shadows, responsive visibility and alignment). Instead of manually translating those utilities into approximate CSS, this project uses Tailwind CSS 4.2.2 with the corresponding Vite 8-compatible plugin. Motion controls enter transitions exactly as authored: x=-50px, opacity 0→1, duration 0.6 seconds for the card; x=+50px, opacity 0→1, duration 0.6 seconds, delay 0.2 seconds for the caption.

The source-fidelity investigation below documents the pre-authentication design. The current authentication form adds a password input, registration/recovery/MFA modes, inline errors, and credential-dependent social buttons while retaining the original utility-class contract.

The site theme variables observable in the live documentation tab include:
- `--radius: .8rem`
- `--radius-lg: .8rem` (12.8px)
- `--radius-xl: calc(.8rem + 4px)`
- `--radius-2xl: 1rem` (16px)
- The regular Tailwind 4 neutral color scale in OKLCH (50–950) and `ui-sans-serif, system-ui` default font.

These are now defined or inherited through Tailwind 4 rather than manually inventing hex colors, dimensions, font weights and transitions. **Important:** The Webpack module does not contain the original compiled CSS or source maps, and the authorized live-tab capture tool was unable to read the actual iframe's document. Its accessible outer documentation page is not the same DOM as the Auth-3 demonstration. The preceding reconstruction incorrectly treated some outer-page browser measurements as direct iframe evidence. This revision avoids repeating that error.

The Webpack source contains `dark:hover:bg-neutral-750`, but the accessible site theme does not define `--color-neutral-750`. The class is preserved verbatim, without inventing a replacement color. The precise behavior of that particular hover state remains unverified.

## Original behavior and intentional differences

The source has functional email control state, an email form that prevents default navigation, inert social-provider and View more buttons, and links to `#`. Those visible semantics are retained. The source's diagnostic logging of entered emails is intentionally suppressed to protect user privacy. That paragraph described the **previous visual preview**. The current apex form sends credentials only to the same-origin Worker authentication service; the new durable object stores the email address with a salted derived password hash (never plaintext), and revocable hashed session tokens.

The user-requested customizations are:
- Dofinances name and caption instead of React Bits Pro marketing copy.
- Default dark mode plus a fixed bottom-right light/dark toggle, toggled in React state without persistence.
- Standalone Studio deployment with a React/Vite entrypoint.

The **apex login is functional**, not a non-authenticated visual preview; only the separate Studio workspace is a non-authenticated demonstration. Theme toggling and user-requested branding are not original Auth-3 features. The original photograph URL and all three recovered social SVG icons are preserved.

## Verification

Automated tests enforce exact matching of source class strings and structural behavior, theme tokens, the Vite Auth-3 entrypoint, and Worker packaging for apex /login. CI builds the app and smoke-tests the Studio root and both apex login paths, plus HTTP 404 for both removed Studio login paths. Source-class equality is strong evidence of CSS fidelity; without a capture of the iframe's rendered pixels at matching viewport and interactive states, claiming complete pixel identity would be unwarranted.

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

## Source CSS audit and dark-state specificity repair (November 6, 2026)

The user supplied all three original linked stylesheets (a 21,340-character font-face stylesheet, a 761,461-character Tailwind 4.1.17 stylesheet, and a 14,949-character component stylesheet). The CSS is the actual authored source, not inferred from the obfuscated `rb*` classes.

- The preview's computed font stack is `ui-sans-serif, system-ui, sans-serif` with emoji fallbacks, and the original Tailwind tokens explicitly define **400 regular, 500 medium, 700 bold**, `text-sm=.875rem`, `text-3xl=1.875rem`, `tracking-tight=-.025em`, and `tracking-tighter=-.05em`. The font stylesheet includes display, serif, and mono faces, but the original preview does not select them for the sign-in UI. No third-party font is bundled unnecessarily.
- In a controlled Chromium experiment with the **same DOM and both compiled stylesheets**, all measured core text geometry, text color, background colors, card geometry, border radii, input/button sizes, and font properties were identical at 386×800, 818×800, and 1440×900.
- **A real hover bug was found.** Tailwind 4.1.17 emitted `.dark\\:bg-neutral-800:is(.dark *)` with specificity that defeats `.hover\\:bg-neutral-50:hover` in the original CSS. Studio had introduced `@custom-variant dark (&:where(.dark, .dark *))`, whose zero-specificity `:where` changed the cascade. The result was a nearly white social-button background with still-white text on hover. Studio now uses `@custom-variant dark (&:is(.dark *))`, mirroring the original selector and restoring dark hover behavior without guessing a missing `neutral-750` value.
- The source's `:root`/dark tokens use `--border:#1f1f1f`, `--ring:#2a2a2a` in dark mode and exact OKLCH counterparts in light mode. Original base rules apply `border-color:var(--border)` and `outline-color:color-mix(in oklab,var(--ring)50%,transparent)`. Studio now applies those rules **only within Auth-3** in the Tailwind base layer, preserving original utilities and the independent custom theme toggle.
- The original outer Auth-3 stage is transparent over the page background; the new root follows that arrangement without changing the visible dark/light page colors.
- The source stylesheet has no `--color-neutral-750` definition or compiled `dark:hover:bg-neutral-750` selector. It is not assigned a speculative value; the original dark `neutral-800` background remains the fallback.

The original site-wide CSS is not copied wholesale to public Studio assets; only the small supported subset of theme rules needed by Auth-3 is retained. The rest of the source CSS styles unrelated React Bits documentation and marketing components.

## Selected-text highlighting fidelity

The supplied original Tailwind 4.1.17 stylesheet explicitly declares `::selection{color:oklch(100% 0 0);background-color:oklch(14.5% 0 0)}` and `.dark ::selection{color:#0a0a0a;background-color:oklch(100% 0 0)}`. Previously Studio had no corresponding selectors and showed the browser-default selection highlight (typically blue). The reconstructed implementation now scopes equivalent `::selection` styling to `.auth3-root` and its descendants for both light and dark themes, preserving identical contrast reversal. It does not change fonts, spacing, card/background colors, hovering, or the original 28 source utility class names.
