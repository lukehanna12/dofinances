# Dofinances

_Architecture reconciled against repository `main` and deployed Cloudflare configuration on 2026-11-11._

GitHub-based development and automatic deployment for `dofinances.com`, `www.dofinances.com`, `stu.dofinances.com`, and eligible first-level subdomains.

## Hosting

- **Apex and first-level wildcard subdomains:** Cloudflare Worker `dofinances-host-router` with Workers Static Assets in `sites/`.
- **www:** same Worker; independent files in `sites/_www/` override paths, and otherwise the URL redirects to the apex.
- **stu:** Cloudflare Pages project `dofinances-studio` serves the interactive five-component Liquid Glass gallery at `/`; the earlier standalone workspace remains preserved at `/app/`. CI assembles both from `studio/gallery/`, `studio/sidebar/`, and shared optical assets, **not** the React Auth-3 app. `/login` and `/login/` return 404.
- **Apex `/login`:** email/password sign-in and registration using the Auth-3 React interface, packaged from the Studio build artifact into the Worker assets during CI/CD.
- **Apex `/app`:** a protected dashboard served only after the Worker checks the HTTP-only session cookie.
- **Account state:** the Worker-bound, SQLite-backed `AUTH_STORE` Durable Object holds first-party accounts, sessions, MFA, linked identities, the owner binding, and encrypted Cloudflare account-connection metadata. No D1, KV, or R2 is bound for this account system.
- **Colosseum:** a Worker service binding (`COLOSSEUM_ROUTER` → `router`) forwards owner-authorized, signed administration requests to the separate Colosseum control plane. A second service binding (`LIBRARY_III` → `library-iii`) serves only allowlisted wallpaper objects.
- **Existing email and commerce records:** remain separate from this Worker; the original mail and payment DNS records must be preserved.

## Add, update, or delete public pages

Commit files to `main` in these directories:

| GitHub source | Public URL |
| --- | --- |
| `sites/_apex/index.html` | `https://dofinances.com/` |
| `sites/_apex/about.html` | `https://dofinances.com/about` |
| `sites/_apex/assets/site.css` | `https://dofinances.com/assets/site.css` |
| `sites/_www/example.html` | `https://www.dofinances.com/example` |
| `sites/portfolio/index.html` | `https://portfolio.dofinances.com/` |
| `sites/portfolio/notes/index.html` | `https://portfolio.dofinances.com/notes` |
| `sites/portfolio/assets/photo.png` | `https://portfolio.dofinances.com/assets/photo.png` |

Removing a file and committing it makes that page return 404 (or, for `www`, fall back to its apex redirect). No DNS additions are required for **eligible first-level** subdomain labels; the `stu` Pages host and reserved service labels are excluded, and deeper subdomains are not covered by this wildcard setup. Unknown paths/hosts return HTTP 404. These example `about`, `portfolio`, and `_www` source paths describe supported additions, not files presently checked into `main`.

For the new Studio gallery, edit `studio/gallery/`; for the preserved `/app/` sidebar demo, edit `studio/sidebar/` and the shared `sites/_apex/app` assets. Push `main` to deploy the Pages application. `src/` still produces the Auth-3 React/Vite build for apex `/login` only. CI also copies the compiled `dist/index.html` and hashed assets into the Worker deployment for `https://dofinances.com/login` and `/login/`. This avoids maintaining two independent login implementations. A narrowly scoped Pages Function at `functions/login.js` enforces HTTP 404 on both removed Studio `/login` URL variants; `public/_routes.json` limits Function invocation to those paths. The top-level `public/404.html` provides a static 404 for other unknown routes.

## Email/password authentication

The Worker handles account registration, email verification, password recovery, MFA enrollment/challenges, session logout, and account deletion under `/api/auth/*`. **Mailtrap is the selected transactional email provider** for the verification and recovery messages; no other transactional provider is configured. Accounts are stored in the Worker-bound `AuthStore` Durable Object with individually salted PBKDF2-SHA256 password hashes, hashed revocable session tokens, server-side rate limits, and seven-day `__Host-` HttpOnly Secure SameSite=Lax cookies. All state-changing requests require the exact apex Origin.

The public home page links to `/login`, `/login?mode=signup`, and `/app`. An unauthenticated `/app` visit redirects to `/login`. The Studio root presents five interactive Glass material studies with flat/design/photo backdrops. The former standalone workspace remains at `/app/` with account controls deliberately disabled; real authentication remains at the apex.

**Password hashing compatibility:** Cloudflare currently caps native PBKDF2 iterations at 100,000. This initial system uses 100,000 individually salted PBKDF2-SHA256 iterations, below the stronger modern guidance; move to a reviewed, memory-hard password KDF before accepting sensitive financial data.

**Account security features:** New-account email confirmation, password recovery, authenticator MFA, and recovery codes are implemented. Outbound email credentials are managed privately, and configuration alone does not establish provider approval or successful delivery. Missing or rejected email delivery fails closed. See [Mailtrap readiness](docs/mailtrap-activation.md).

**Legacy accounts:** Existing registrations created before email verification was introduced can still sign in. They show as unverified until a verification email is delivered. New registrations cannot use `/app` until confirmation. MFA is optional, but required on every new sign-in after enrollment. Password resets on MFA-enabled accounts require an authenticator or recovery code.

**Further hardening:** MFA, email verification, and resets do not turn this into a regulated financial-data application. Security review, better password KDFs, abuse controls, and financial-data protections are necessary before storing private financial records. See [Account security](docs/account-security.md).

## Private workspace navigation

The authenticated `/app` dashboard has a collapsible/resizable sidebar with three main views: **Home** (default), **Projects**, and **Settings**. The **Colosseum** project navigation includes **Utilities**, **Collections**, **Providers**, **Permissions**, **Diagnostics**, and project **Settings**; **Apple HIG Reader** is a separate project. Collections, Providers, Permissions, and Diagnostics have functional, on-demand controllers; do not call them placeholders. Utilities and project Settings currently remain lightweight/unfinished surfaces. The arrow in the top bar returns to the containing project scope.

- **Collections:** revision-checked create/edit/delete and membership operations against live Colosseum data; list paginates **10 collections per page** in the current source. Utility admission (`+`) is deliberately disabled.
- **Providers:** federated account vault connections and local registry controls; source-derived tools, resources, prompts, installed skills and adapter discovery are inspected through the upstream Colosseum interface. Mutations use prepare/confirm receipts and server-enforced grants; the browser is not the credential or permission authority.
- **Permissions:** manages local filesystem path rules, execution limits, hazard PIN and effective-access inspection through the independently enforced local gateway. The old Google Sheets permission manager is retired.
- **Diagnostics:** user-invoked Colosseum diagnostic reports with no background polling.

Colosseum administrative operations require independent server-side authorization and use restricted internal forwarding. See [current architecture](docs/architecture.md) and [owner authorization](docs/colosseum-owner-auth.md).

Main Settings retains Google/GitHub identity linking (limits: five Google, three GitHub), email verification, MFA, and account deletion. Navigation uses in-page hash routes such as `/app#projects` and `/app#colosseum/diagnostics`; no additional public Worker routes or permissions are introduced. The sidebar can collapse to an icon rail on desktop, with the preference stored locally in the browser; on phones it becomes an accessible slide-out navigation drawer. OAuth callbacks that return to `/app?federation_linked=1` or `/app?federation_error=...` automatically show the main Settings view.

## Default site-wide visual system

`sites/_apex/assets/site-foundation.css` is the shared source of truth for
the system UI sans-serif font stack, black canvas, charcoal cards and controls,
greys, focus indicator, and contrast tokens. New Git-managed HTML pages should
load `/assets/site-foundation.css` before their page-specific stylesheet.
The protected `/app` uses it beneath `workspace-theme.css`; email verification
and password reset use it beneath a **public** account-security stylesheet so
styles load even when the user has no active session. The public
homepage uses `assets/site.css` for layout on the same tokens.

The Auth-3 React login uses the **same source CSS**, bundled from
`src/styles.css` by Vite and published only at `dofinances.com/login`.
The Studio Pages site uses shared workspace CSS and the standalone sidebar demo instead. Its default is dark, with
the existing explicit light-mode toggle preserved. The standalone Studio 404
uses equivalent fallback styling so the error page is still legible without
loading application JavaScript. The `www` host redirects to the apex for
pages without independent content. Unconfigured wildcard subdomains still
return 404; this theme does not invent or modify independently hosted sites.

The reconstructed ChatGPT archive establishes the system-style aesthetic,
but it does **not** contain an authoritative primary font file or font-face
definition. The current implementation uses native system sans-serif fonts
rather than claiming pixel-identical proprietary typography.

## Workspace visual system

The authenticated app's Home, Projects, Settings, Apple HIG Reader, and Colosseum views share
`sites/_apex/app/assets/workspace-theme.css`, loaded after the existing
`dashboard.css`. The presentation is adapted from a source-first reconstruction
of the ChatGPT web interface: a pure-black main canvas and sidebar, separated by a thin charcoal divider,
with neutral grey foreground surfaces, compact sidebar rows, softly rounded controls, restrained typography, accessible
focus indicators, and reduced-motion/high-contrast support. No reconstructed
private runtime, preserved application bundles, or external CDN assets are loaded.

Every existing hash view (for example, `/app#colosseum/providers`) also works
as an authenticated nested URL (for example, `/app/colosseum/providers`).
All nested pages are served from the same protected `/app/index.html` document
and use the existing Google/GitHub linking, MFA, and sign-out handlers.
Only specifically allowlisted view paths receive this fallback; unknown paths
remain 404. The legacy `/dashboard` prefix remains supported.

## Federated sign-in and account linking

Dofinances supports identity-only Google and GitHub sign-in when the corresponding provider application credentials are configured. Users can create accounts with a verified external identity or link additional identities from /app. Limits per account: **5 Google and 3 GitHub**. A provider identity cannot be linked to multiple users; email similarity alone cannot merge accounts. The last linked provider cannot be removed unless the user also has a password. Unlinking revokes active sessions.

Provider configuration is documented in [Federated authentication](docs/federated-auth.md). Existing email/password accounts, MFA, email verification and Durable Object storage remain supported. Disabled provider buttons signal missing OAuth client credentials, rather than presenting nonfunctional links.

## CI/CD and verification

[`site.yml`](.github/workflows/site.yml) runs Node 22 tests and a Vite build on pull requests and pushes to `main`; on successful `main` pushes with `DEPLOY_ENABLED=true`, it deploys **both** the standalone Studio Pages preview and the authenticated apex Worker via Wrangler. The Vite artifact supplies apex `/login` without exposing authentication controls on Studio. A separate smoke job checks live HTTPS, host routing, account boundaries, wallpaper assets and sidebar behavior in headless Chrome. Routes and DNS are managed separately; deployments do **not** recreate DNS or routes. No Tailscale Funnel, Workers Builds, local Mac, D1 or R2 is part of the build pipeline.

[`verify-git-sites.yml`](.github/workflows/verify-git-sites.yml) is a separate manual end-to-end verification workflow.

The current apex homepage is deliberately minimal; it is a deployable placeholder, not an attempt to reproduce the former GoDaddy Website Builder content. GoDaddy remains the domain registrar. The Worker only handles eligible first-level subdomains; deeper subdomains require separate DNS/TLS/routing configuration. GitHub currently reports that `main` is **not branch-protected**, so CI is a deployment gate rather than an enforced pull-request merge gate.

## Documentation map

- [Current architecture and authority boundaries](docs/architecture.md)
- [DNS, routes, hosting and CI/CD](docs/domain-setup.md) and [Worker routing](edge/README.md)
- [Account security](docs/account-security.md), [federated sign-in](docs/federated-auth.md), [Cloudflare account connection](docs/cloudflare-account-connection.md), [Colosseum owner access](docs/colosseum-owner-auth.md)
- [Mailtrap readiness and delivery verification](docs/mailtrap-activation.md), [production credentials](docs/production-credentials.md)
- [Apex Auth-3 design and historical fidelity notes](docs/studio-login.md), [Studio static workspace](studio/sidebar/README.md)
