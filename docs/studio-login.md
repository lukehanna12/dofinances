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
