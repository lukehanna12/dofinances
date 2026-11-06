# Dofinances

Public GitHub source and GitHub Actions CI/CD for the Dofinances React studio and first-level wildcard hostname pages.

## Live architecture — November 6, 2026

| Hostname | Hosting and control |
| --- | --- |
| `dofinances.com` | Existing GoDaddy Websites + Marketing homepage, DNS-only via Cloudflare; **not editable by this repository** |
| `www.dofinances.com` | GoDaddy homepage alias/redirect, DNS-only; **not editable by this repository** |
| `stu.dofinances.com` | React + Vite, hosted on Cloudflare Pages `dofinances-studio`; automatic GitHub Actions CI/CD |
| Eligible `*.dofinances.com/*` | Cloudflare Worker `dofinances-host-router`; automatic GitHub Actions CI/CD for HTML pages declared in `edge/pages.mjs` |

The Cloudflare zone `dofinances.com` is active, and its wildcard Universal SSL certificate is active. GoDaddy remains the domain registrar.

### How to add and remove pages

In [`edge/pages.mjs`](edge/pages.mjs), add a key such as `"portfolio.dofinances.com/briefing"` with a `type` and HTML `body`. Commit to `main`; GitHub Actions tests and deploys the Worker. Delete the key and commit to remove the route: it returns HTTP 404 after deployment. Unknown wildcard hostnames/paths return 404 by default.

The current page registry is intentionally empty: temporary staging pages were deleted after successful live tests. This is a small inline-HTML registry subject to the Worker script size limit; larger websites should use Workers Static Assets or a dedicated Pages build.

### CI/CD

[GitHub Actions](.github/workflows/site.yml) runs tests/builds on `main`, deploys React to Pages and deploys the routing Worker, gated by `DEPLOY_ENABLED=true`. Both jobs use the existing `CLOUDFLARE_API_TOKEN` with Pages and Workers permissions. Generated build files remain on GitHub-hosted runners, not on the owner's Mac.

[Verify apex, www and studio HTTPS](.github/workflows/verify-sites.yml) · [Verify wildcard TLS/deleted pages](.github/workflows/verify-wildcard.yml)

### Apex/www limitation

An attempted Worker pass-through to the GoDaddy Website Builder origin returned HTTP 522. The experiment was rolled back and root/www remain DNS-only, with verified HTTPS. Full content CI/CD for apex/www requires a migration or an independently verified origin integration; routing existing GoDaddy pages through the Worker is not safe at present.

See [domain and routing details](docs/domain-setup.md) and [production credentials](docs/production-credentials.md).
