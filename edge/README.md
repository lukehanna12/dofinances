# Dofinances Git-managed host routing

`edge/worker.mjs` maps each incoming hostname and URL pathname to a static file in `sites/`, using Cloudflare's `ASSETS` binding. `assets.run_worker_first=true` ensures host-based isolation and prevents unrelated static assets from being served across hostnames.

- Apex `dofinances.com` uses `sites/_apex/`.
- `www.dofinances.com` uses `sites/_www/` first; missing paths redirect to the corresponding apex path.
- First-level wildcard hostnames use `sites/<hostname-label>/`.
- `stu`, payment, mail, and other explicit service subdomains are excluded by routing and host checks.
- `/docs`, `/docs/`, and `/docs/index.html` can resolve to `sites/<host>/docs/index.html`.
- HTML and static asset files are deployed together; deleting a file from Git removes it on the next deploy.
- Unknown hosts or files return 404; no open proxy or GoDaddy fallback is used.

Cloudflare Wrangler configuration: `edge/wrangler.jsonc`, with `assets.directory="../sites"`, `binding="ASSETS"`, `run_worker_first=true` and `html_handling="none"`. Note that Worker invocation on every request counts toward Worker usage limits.

After editing files, push to `main`: GitHub Actions tests and deploys the Worker automatically. The existing React studio is a separate Pages deployment from the same workflow.

This is static website CI/CD. Dynamic server-side applications would require implementing additional Worker routes and dependencies; they are not implied by adding HTML files.
