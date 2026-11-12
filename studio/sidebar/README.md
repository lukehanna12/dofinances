# Standalone Studio workspace

_Current Pages packaging verified 2026-11-11 against `.github/workflows/site.yml` and `studio/sidebar/preview-bootstrap.js`._

This source is the preserved static Liquid Glass sidebar demo formerly served
at the temporary `app-sidebar-preview` Pages branch alias. It is deployed to
`https://stu.dofinances.com/` **and** `/app/` by the production GitHub Actions
workflow. The workspace navigation and route-specific wallpapers are shared with production; its optional glass scene-switching controls and exact live-backdrop Oracle mathematics remain available.

This site has **no authenticated session or account operations**. Its bootstrap keeps production authentication, provider, permission, collection and diagnostics modules out of the public Pages bundle and disables account actions. Do not assume the appearance of a private workspace screen on Studio means its management APIs are enabled. The real private
workspace stays under `https://dofinances.com/app`.

The preview-specific page, stylesheet, scene-switching script, and bootstrap are stored here. CI copies selected shared `dashboard.css`, `workspace-theme.css`, `workspace-nav.js`, `workspace-scroll.js`, wallpaper files, finite Oracle field mathematics/Worker, and site foundation files from `sites/_apex` into this Pages deployment. It deliberately does **not** copy protected `dashboard.js` or its account-management controllers. There is no runtime/test-branch dependency.

The Vite `dist` artifact is reserved for the separate, **functional** apex `/login` React Auth-3 Worker packaging; Pages copies the standalone Studio files over its *own* deployment copy of `dist` and publishes `/` and `/app/`. A narrowly scoped `functions/login.js` enforces HTTP 404 on Studio `/login` and `/login/` via top-level `public/_routes.json`. Do not copy the React Auth-3 bundle or the
protected `dashboard.js` into the public Studio workspace.

The temporary preview's experimental GPU lab, evidence corpus and CI browser
harness are not part of the requested `/app` content.

## Change management

Edit `studio/sidebar/` for preview-only HTML/glass behavior, and the relevant shared `sites/_apex/app/assets/` modules for intentionally shared presentation. All changes are built and checked through [the same CI/CD workflow](../../.github/workflows/site.yml); the resulting Pages deployment is independent of Tailscale Funnel, Workers Builds and the Mac's local gateway. Use the [architecture guide](../../docs/architecture.md) to distinguish this non-authenticated preview from the production apex workspace.
