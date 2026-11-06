# Dofinances Git-managed host routing

`edge/worker.mjs` maps each incoming hostname and URL pathname to a static file in `sites/`, using Cloudflare's `ASSETS` binding. `assets.run_worker_first=true` ensures host-based isolation and prevents unrelated static assets from being served across hostnames.

- Apex `dofinances.com` uses `sites/_apex/`. Its `/login` page and compiled `/assets/` are packaged from the Studio Vite build by CI before Worker deployment (not committed as built files).
- `www.dofinances.com` uses `sites/_www/` first; missing paths redirect to the corresponding apex path.
- First-level wildcard hostnames use `sites/<hostname-label>/`.
- `stu`, payment, mail, and other explicit service subdomains are excluded by routing and host checks.
- `/docs`, `/docs/`, and `/docs/index.html` can resolve to `sites/<host>/docs/index.html`.
- HTML and static asset files are deployed together; deleting a file from Git removes it on the next deploy.
- Unknown hosts or files return 404; no open proxy or GoDaddy fallback is used.

Cloudflare Wrangler configuration: `edge/wrangler.jsonc`, with `assets.directory="../sites"`, `binding="ASSETS"`, `run_worker_first=true` and `html_handling="none"`. Note that Worker invocation on every request counts toward Worker usage limits.

After editing files, push to `main`: GitHub Actions tests and deploys the Worker automatically. The existing React studio is a separate Pages deployment from the same workflow.

This is static website CI/CD. Dynamic server-side applications would require implementing additional Worker routes and dependencies; they are not implied by adding HTML files.

## Authenticated dashboard

The apex's `/app` and `/dashboard` paths require a valid server-side session; unauthenticated requests redirect to `/login`. The Worker owns an independent SQLite-backed Durable Object for accounts and sessions, configured as `AUTH_STORE`; it never reads or writes D1. The Studio login interface is built once in GitHub Actions. CI tests authentication and mail provider behavior with controlled mocks and checks live route boundaries; it does not send real email or create live accounts until Mailtrap has been activated.


## Transactional email readiness

Account verification and password recovery use `edge/auth-mail.mjs` and the Mailtrap Email API. The Worker requires a valid `MAILTRAP_API_TOKEN` secret; `AUTH_EMAIL_FROM=noreply@dofinances.com` is already configured as a non-secret Wrangler variable. Both must be present before email-dependent operations open. Missing credentials fail closed (503) and do not issue a usable sign-in cookie. The Worker itself has no SMTP listener, inbound mail routing or D1 bindings. See [Mailtrap activation](../docs/mailtrap-activation.md).
