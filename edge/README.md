# Dofinances Git-managed host routing

_Current Worker source and Cloudflare routing checked 2026-11-11._

`edge/worker.mjs` maps each incoming hostname and URL pathname to a static file in `sites/`, using Cloudflare's `ASSETS` binding. `assets.run_worker_first=true` ensures host-based isolation and prevents unrelated static assets from being served across hostnames.

- Apex `dofinances.com` uses `sites/_apex/`. Its `/login` page and compiled `/assets/` are packaged from the Studio Vite build by CI before Worker deployment (not committed as built files).
- `www.dofinances.com` uses `sites/_www/` first; missing paths redirect to the corresponding apex path.
- First-level wildcard hostnames use `sites/<hostname-label>/`.
- `stu`, `pay`, `zb30895346`, `_domainconnect`, `_dmarc`, `zmail`, and `gd-origin` are reserved in `siteFolder`; `stu` is specifically bypassed by a Cloudflare Worker route exception and points to Pages. The wildcard accepts only one valid DNS label, never nested subdomains.
- `/docs`, `/docs/`, and `/docs/index.html` can resolve to `sites/<host>/docs/index.html`.
- HTML and static asset files are deployed together; deleting a file from Git removes it on the next deploy. The `sites/_www/` and `sites/<label>/` content directories are supported but currently absent from `main`.
- Unknown hosts or files return 404; no open proxy or GoDaddy fallback is used.

Cloudflare Wrangler configuration: `edge/wrangler.jsonc`, with `assets.directory="../sites"`, `binding="ASSETS"`, `run_worker_first=true` and `html_handling="none"`/`not_found_handling="none"`. The Worker entrypoint is `edge/worker.mjs`; route logic is `edge/router.mjs`.

`assetCandidates` resolves an extensionless path against an exact file, `.html` file, then `/index.html`; trailing slashes resolve `index.html`. `www` first tries its own assets and redirects any missing path to the apex (and always redirects account and administrative URLs to the canonical apex). Unknown hosts or source files return 404; no GoDaddy fallback is used. Note that Worker invocation on every request counts toward Worker usage limits.

After editing files, push to `main`: GitHub Actions tests and deploys the Worker automatically. The existing React studio is a separate Pages deployment from the same workflow.

This is Git-managed static-page CI/CD **plus existing dynamic Worker APIs**. Adding HTML files alone does not create new server-side API operations; those require implementing and testing new Worker routes with their own authentication/authorization.

## Authenticated dashboard

The apex's `/app` and `/dashboard` paths require a valid server-side session; unauthenticated requests redirect to `/login`. The Worker owns an independent SQLite-backed Durable Object for accounts and sessions, configured as `AUTH_STORE`; it never reads or writes D1. The Auth-3 React sign-in interface is built once in GitHub Actions for apex `/login`; Studio Pages receives a separate static workspace preview. CI tests authentication and Mailtrap behavior with controlled mocks and checks live route boundaries; it does not prove real email delivery.


## Colosseum administration and protected routes

Protected Colosseum operations require independently verified identity and authorization before forwarding restricted calls to the separate control plane. This includes collection, provider, permission, catalog and diagnostic APIs. The provider/permission authorities and credential vault remain upstream, not in this Worker. `/api/cloudflare/*` and `/api/colosseum/*` now share the same owner-only 30-day Cloudflare Access application, while their server-side owner records, operation restrictions, and encrypted credentials remain independently enforced. A Cloudflare account token is not interchangeable with Colosseum provider authorization. See [owner authorization](../docs/colosseum-owner-auth.md) and [Cloudflare connection](../docs/cloudflare-account-connection.md).

A `LIBRARY_III` service binding streams only the eight SHA-addressed wallpapers explicitly allowlisted by `workspace-wallpapers.js`; the full private Colosseum library is not exposed.

## Transactional email readiness

Account verification and password recovery use `edge/auth-mail.mjs` and the Mailtrap Email API. The outbound email integration is configured using private runtime credentials and provider-issued DNS records. The runtime configuration and sender approval must be valid before email-dependent operations work. Missing credentials fail closed (503) and do not issue a usable sign-in cookie. Mailtrap-side sending approval and actual delivery are still separate, unverified checks. The Worker itself has no SMTP listener, inbound mail routing or D1 bindings. See [Mailtrap activation](../docs/mailtrap-activation.md).
