# Dofinances

GitHub-based development and automatic deployment for `dofinances.com`, `www.dofinances.com`, `stu.dofinances.com`, and eligible first-level subdomains.

## Hosting

- **Apex and first-level wildcard subdomains:** Cloudflare Worker `dofinances-host-router` with Workers Static Assets in `sites/`.
- **www:** same Worker; independent files in `sites/_www/` override paths, and otherwise the URL redirects to the apex.
- **stu:** React and Vite project on Cloudflare Pages `dofinances-studio`, sourced from `src/`; its root remains the Auth-3 preview, but `/login` is removed.
- **Apex `/login`:** the same built Auth-3 preview, packaged from the Studio build artifact into the Worker static assets during CI/CD.
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

For Studio, edit `src/` and `public/` and push `main`; Vite builds the React application. CI also copies the compiled `dist/index.html` and hashed assets into the Worker deployment for `https://dofinances.com/login` and `/login/`. This avoids maintaining two independent login implementations. A top-level `public/404.html` ensures the removed `https://stu.dofinances.com/login` and `/login/` URLs return HTTP 404 instead of falling back to the Studio SPA root.

## CI/CD and verification

[`site.yml`](.github/workflows/site.yml) builds and tests on pushes to `main`; with `DEPLOY_ENABLED=true`, it deploys **both** studio Pages and the Worker. Cloudflare Workers uploads site files directly from `sites/`, without D1, R2, or local Mac build artifacts.

[`verify-git-sites.yml`](.github/workflows/verify-git-sites.yml) is a separate manual end-to-end verification workflow.

The current apex homepage is deliberately minimal; it is a deployable placeholder, not an attempt to reproduce the former GoDaddy Website Builder content. GoDaddy remains the domain registrar. The Worker only handles first-level subdomains; deeper subdomains require separate TLS coverage.
