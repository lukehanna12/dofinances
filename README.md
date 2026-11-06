# Dofinances

GitHub-based development and automatic deployment for `dofinances.com`, `www.dofinances.com`, `stu.dofinances.com`, and eligible first-level subdomains.

## Hosting

- **Apex and first-level wildcard subdomains:** Cloudflare Worker `dofinances-host-router` with Workers Static Assets in `sites/`.
- **www:** same Worker; independent files in `sites/_www/` override paths, and otherwise the URL redirects to the apex.
- **stu:** React and Vite project on Cloudflare Pages `dofinances-studio`, sourced from `src/`; its root remains the Auth-3 preview, but `/login` is removed.
- **Apex `/login`:** email/password sign-in and registration using the Auth-3 React interface, packaged from the Studio build artifact into the Worker assets during CI/CD.
- **Apex `/app`:** a protected dashboard served only after the Worker checks the HTTP-only session cookie.
- **Account state:** a new SQLite-backed Cloudflare Durable Object owned by this Worker. This auth path does not use D1, KV, or R2.
- **Existing email and commerce records:** remain separate, DNS-only, and are not served by the Worker.

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

Removing a file and committing it makes that page return 404 (or, for `www`, fall back to its apex redirect). No DNS additions are required for new first-level subdomain names. Unknown paths/hosts return HTTP 404.

For Studio, edit `src/` and `public/` and push `main`; Vite builds the React application. CI also copies the compiled `dist/index.html` and hashed assets into the Worker deployment for `https://dofinances.com/login` and `/login/`. This avoids maintaining two independent login implementations. A narrowly scoped Pages Function at `functions/login.js` enforces HTTP 404 on both removed Studio `/login` URL variants; `public/_routes.json` limits Function invocation to those paths. The top-level `public/404.html` provides a static 404 for other unknown routes.

## Email/password authentication

The Worker handles `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, and authenticated `DELETE /api/auth/account`. Accounts are stored in the Worker-bound `AuthStore` Durable Object with individually salted PBKDF2-SHA256 password hashes, hashed revocable session tokens, server-side rate limits, and seven-day `__Host-` HttpOnly Secure SameSite=Lax cookies. All state-changing requests require the exact apex Origin.

The public home page links to `/login`, `/login?mode=signup`, and `/app`. An unauthenticated `/app` visit redirects to `/login`. The Studio root still uses the same form design and directs visitors to the canonical apex authentication origin.

**Password hashing compatibility:** Cloudflare currently caps native PBKDF2 iterations at 100,000. This initial system uses 100,000 individually salted PBKDF2-SHA256 iterations, below the stronger modern guidance; move to a reviewed, memory-hard password KDF before accepting sensitive financial data.

**Current limitations:** email ownership verification, password resets, MFA, OAuth, and real financial data integrations are not implemented. Users should not treat the initial dashboard as a financial-data vault. Account deletion is available from the protected dashboard.

## CI/CD and verification

[`site.yml`](.github/workflows/site.yml) builds and tests on pushes to `main`; with `DEPLOY_ENABLED=true`, it deploys **both** studio Pages and the Worker. Cloudflare Workers uploads site files directly from `sites/`, without D1, R2, or local Mac build artifacts.

[`verify-git-sites.yml`](.github/workflows/verify-git-sites.yml) is a separate manual end-to-end verification workflow.

The current apex homepage is deliberately minimal; it is a deployable placeholder, not an attempt to reproduce the former GoDaddy Website Builder content. GoDaddy remains the domain registrar. The Worker only handles first-level subdomains; deeper subdomains require separate TLS coverage.
