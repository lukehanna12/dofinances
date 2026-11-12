# Dofinances: current production architecture

_Architecture checked 2026-11-11 against the public source and live deployment. Personal identifiers, private authentication configuration, and secret values are intentionally omitted._

## Repository is the website deployment authority

This repository is public, with default branch `main`. Website code, documentation, tests and the GitHub Actions workflow are version-controlled. Cloudflare stores runtime records, deployed bindings, certificates and DNS routes. GitHub source edits do **not** directly modify Colosseum's independent provider registry, credential vault, local permission policy, or account data.

| Source | Responsibility |
| --- | --- |
| `sites/_apex/` | Static apex homepage, `/app` shell, `/verify`, `/reset`, shared assets |
| `sites/_www/` | Optional host-specific `www` assets; absent from the inspected tree, so missing paths redirect to apex |
| `sites/<label>/` | Optional eligible first-level wildcard subdomain assets; none presently populated |
| `edge/worker.mjs`, `edge/router.mjs` | Worker entrypoint, host/path isolation, authentication routes, signed Colosseum forwarding, wallpaper proxy |
| `edge/auth-*.mjs` | Account state, credentials, MFA, email, Google/GitHub identity-only OAuth |
| `edge/cloudflare-connection.mjs`, `edge/colosseum-owner.mjs` | Account-scoped Cloudflare API policies and separate Colosseum owner JWT verification |
| `src/`, root `index.html`, `vite.config.mjs` | React/Tailwind/Motion Auth-3 build used for apex `/login` |
| `studio/gallery/`, `studio/sidebar/` | Public **static** five-component Glass gallery at `/` and preserved standalone sidebar demo at `/app/` |
| `public/`, `functions/login.js` | Static Pages 404/headers/function route controls; this is top-level `public/`, not `src/public/` |
| `tests/`, `scripts/verify-live-sidebar.mjs` | Node tests and live headless Chrome smoke validation |
| `.github/workflows/site.yml` | GitHub Actions production CI/CD |

## DNS, host and URL resolution

Cloudflare is authoritative for DNS, while GoDaddy remains registrar. Cloudflare's active Worker route set is:

- `dofinances.com/*` → `dofinances-host-router` with `sites/_apex/` and authenticated apex APIs.
- `www.dofinances.com/*` → the same Worker with optional `sites/_www/` overrides, then a 301 apex fallback. Account and administrative paths redirect to canonical apex.
- `*.dofinances.com/*` → the same Worker with `sites/<label>/`, except reserved/excluded service names. An arbitrary **eligible first-level** label normally requires only adding a source directory and deploying, not another DNS record.
- `stu.dofinances.com/*` → no Worker route, DNS-only CNAME to `dofinances-studio.pages.dev`, with Cloudflare Pages serving the public Studio preview.

The proxied apex/wildcard A records point to `192.0.2.1` as originless placeholders, and `www` CNAMEs to apex. A wildcard here does not automatically support `a.b.dofinances.com`, arbitrary external service records, or new backend APIs. Paths resolve to exact files, extensionless `.html`, and `/index.html` candidates; unknown routes return 404, except eligible `www` fallback. The Worker serves host-specific static assets only through its `ASSETS` binding (`run_worker_first=true`).

Zoho inbound MX and DKIM, domain verification, and mail/payment-related DNS are separate from the website router. Mailtrap outbound CNAMEs are installed; see [DNS details](domain-setup.md).

## CI/CD: no Tailscale Funnel or Workers Builds

`site.yml` triggers on pull requests, `main` pushes and manual dispatch. It uses Node 22, `npm install`, `npm run check` and `npm run build`, verifies Vite and source contracts, and stores the `dist` artifact. On successful non-PR `main` runs with repository `DEPLOY_ENABLED=true`:

1. **Cloudflare Pages job:** replaces its downloaded Vite artifact with the static `studio/sidebar` HTML and allowlisted shared workspace assets; deploys to `dofinances-studio` using `wrangler pages deploy`.
2. **Cloudflare Worker job:** adds the original Vite Auth-3 bundle at `sites/_apex/login/` and compiled `sites/_apex/assets/`; deploys `dofinances-host-router` with `wrangler deploy --config edge/wrangler.jsonc`.
3. **Smoke job:** waits for both deployments and checks public HTTPS, canonical routing, Studio login 404, apex login 200, protected auth boundaries, allowlisted wallpaper objects and live sidebar behavior through headless Chrome.

The inspected production run succeeded in all four jobs. DNS and Worker routes are independently configured and **not provisioned on each deploy**. The pipeline uses GitHub Actions plus Wrangler, not Tailscale Funnel, Cloudflare Workers Builds, a local Mac, D1 or R2. The `main` branch is not currently branch-protected; direct pushes can trigger deployment.

## Two distinct user interfaces

**Private apex workspace (`https://dofinances.com/app`):** the Worker validates the host-only Secure/HttpOnly Dofinances session before serving the HTML shell or protected assets. Navigation primarily uses native JS and hash routes, with specific nested `/app/...` and legacy `/dashboard/...` paths allowlisted by `WORKSPACE_VIEW_PATHS`. Main views: Home, Projects, Settings. Colosseum views: Utilities, Collections, Providers, Permissions, Diagnostics and Settings. Apple HIG Reader is a separate project. Source-of-truth CSS begins at `sites/_apex/assets/site-foundation.css`; workspace layering is in `dashboard.css`, `workspace-theme.css`, `workspace-enhancements.css`, `workspace-wallpapers.css` and screen-specific styles.

**Public Studio:** `https://stu.dofinances.com/` hosts a five-component interactive Glass gallery with flat, designed, and photographic backgrounds; the original standalone Liquid Glass navigation/wallpaper demo remains at `/app/`. Both intentionally exclude private `dashboard.js`, authenticated account operations, and live Colosseum controllers. The apex Auth-3 login is a separate React/Vite bundle; Studio `/login` and `/login/` are forced to 404 by a narrowly scoped Pages Function.

The sidebar's Oracle glass module derives SVG-filter optical/displacement fields from the actual DOM backdrop; computational support is in `sidebar-glass-oracle.js` and `sidebar-glass-field-worker.js`. Wallpaper selection is route-aware. The Worker proxies only eight explicitly allowlisted `LIBRARY_III` SHA-addressed objects under `/wallpapers/`, rather than exposing the full Colosseum library.

## Persistent authorities and security boundaries

| Authority | Owner and persistence | What it authorizes |
| --- | --- | --- |
| Dofinances authentication | `AUTH_STORE` SQLite Durable Object, Worker `dofinances-host-router` | Accounts, hashed sessions, MFA/TOTP, account verification/reset, linked Google/GitHub sign-in identities |
| Cloudflare account connection | Separate authenticated account access and encrypted server-side credential | Scoped management operations |
| Colosseum administration | Independent owner authorization and authenticated internal forwarding | Restricted operations in upstream control plane |
| Colosseum local permissions | Independent local gateway / local policy authority | Filesystem read/write/add/delete, script/execution limits, hazard confirmation/PIN, effective-access evaluation |
| Colosseum provider registry/vault | Upstream Colosseum services | Federated host connections, provider credentials, MCP tools/resources/prompts/skills, independent local profiles and invocation grants |
| Wallpaper library | Separate `library-iii` Worker, content-addressed objects | Only the small public allowlist is proxied by Dofinances |

**Do not conflate these authorities.** Dofinances OAuth with Google/GitHub is identity-only and does not retain provider API tokens. Colosseum's Providers screen is a client for upstream registry/vault/permission interfaces, not the credential or access authority itself. Permissions is the current operator-facing authority for local-work policy, enforced independently by the local gateway; the former Google Sheets manager is retired. Collections and Diagnostics also request live upstream records; no fabricated data or background status polling is required.

Colosseum administrative routes support owner enrollment, collections, permissions, providers, catalog maintenance and diagnostics with server-enforced identity and request authorization. The client uses upstream prepare/commit/verification receipts for regulated operations, rather than treating a button click as proof of a policy change. The current Collections frontend lists **ten** per page; utility-admission `+` is intentionally disabled.

## What is verified, and what is not

**Verified:** repository source and tree; read/push/admin repository access; the exact production workflow; successful build, deployment and smoke jobs; live DNS, Worker routes, Pages project, independent access-control layers and Worker binding types; no D1 or R2 in this site's auth path.

**Not inferred solely from those checks:** production end-to-end authenticated provider and permission writes; upstream MCP provision coverage; Mailtrap sending-domain approval, current quota, API delivery or inbox placement; real external OAuth sign-in; validity/privilege details of secret tokens that are not readable. These require dedicated authenticated/controlled tests. A successful smoke job alone does not prove them.

## Detailed documentation

- [README](../README.md) — contributor entrypoint, hosting and site files.
- [DNS, routes and CI/CD](domain-setup.md), [Worker routing](../edge/README.md), [production credentials](production-credentials.md).
- [Account security](account-security.md), [identity-only federation](federated-auth.md), [Cloudflare API connection](cloudflare-account-connection.md), [Colosseum owner authorization](colosseum-owner-auth.md).
- [Transactional email readiness](mailtrap-activation.md).
- [Apex Auth-3 implementation and historical fidelity](studio-login.md), [Studio static workspace](../studio/sidebar/README.md).
