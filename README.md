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

The Worker handles account registration, email verification, password recovery, MFA enrollment/challenges, session logout, and account deletion under `/api/auth/*`. **Mailtrap is the selected transactional email provider** for the verification and recovery messages; no other transactional provider is configured. Accounts are stored in the Worker-bound `AuthStore` Durable Object with individually salted PBKDF2-SHA256 password hashes, hashed revocable session tokens, server-side rate limits, and seven-day `__Host-` HttpOnly Secure SameSite=Lax cookies. All state-changing requests require the exact apex Origin.

The public home page links to `/login`, `/login?mode=signup`, and `/app`. An unauthenticated `/app` visit redirects to `/login`. The Studio root still uses the same form design and directs visitors to the canonical apex authentication origin.

**Password hashing compatibility:** Cloudflare currently caps native PBKDF2 iterations at 100,000. This initial system uses 100,000 individually salted PBKDF2-SHA256 iterations, below the stronger modern guidance; move to a reviewed, memory-hard password KDF before accepting sensitive financial data.

**Account security features:** New-account email confirmation, one-use password recovery, TOTP authenticator MFA, and one-time recovery codes are implemented. The Worker requires a verified Mailtrap transactional sending domain plus the `MAILTRAP_API_TOKEN` Worker secret; `AUTH_EMAIL_FROM=noreply@dofinances.com` is already configured as a non-secret Wrangler variable before enabling new sign-ups or sending recovery messages. Mailtrap account/domain verification and credentials remain the only external activation dependencies. Until they are configured, email-dependent operations deliberately return an unavailable status rather than creating unverified accessible accounts. See [Mailtrap activation](docs/mailtrap-activation.md). The account's `MFA_ENCRYPTION_KEY` is stored as a Worker secret and never appears in Git.

**Legacy accounts:** Existing registrations created before email verification was introduced can still sign in. They show as unverified until a verification email is delivered. New registrations cannot use `/app` until confirmation. MFA is optional, but required on every new sign-in after enrollment. Password resets on MFA-enabled accounts require an authenticator or recovery code.

**Further hardening:** MFA, email verification, and resets do not turn this into a regulated financial-data application. Security review, better password KDFs, abuse controls, and financial-data protections are necessary before storing private financial records. See [Account security](docs/account-security.md).

## Federated sign-in and account linking

Dofinances supports identity-only Google, GitHub and ChatGPT sign-in when the corresponding provider application credentials are configured. Users can create accounts with a verified external identity or link additional identities from /app. Limits per account: **5 Google, 3 GitHub, 1 ChatGPT**. A provider identity cannot be linked to multiple users; email similarity alone cannot merge accounts. The last linked provider cannot be removed unless the user also has a password. Unlinking revokes active sessions.

Provider configuration and OpenAI's separate limited website partnership approval are documented in [Federated authentication](docs/federated-auth.md). Existing email/password accounts, MFA, email verification and Durable Object storage remain supported. Disabled provider buttons signal missing credentials or partner approval, rather than presenting nonfunctional links.

## CI/CD and verification

[`site.yml`](.github/workflows/site.yml) builds and tests on pushes to `main`; with `DEPLOY_ENABLED=true`, it deploys **both** studio Pages and the Worker. Cloudflare Workers uploads site files directly from `sites/`, without D1, R2, or local Mac build artifacts.

[`verify-git-sites.yml`](.github/workflows/verify-git-sites.yml) is a separate manual end-to-end verification workflow.

The current apex homepage is deliberately minimal; it is a deployable placeholder, not an attempt to reproduce the former GoDaddy Website Builder content. GoDaddy remains the domain registrar. The Worker only handles first-level subdomains; deeper subdomains require separate TLS coverage.
