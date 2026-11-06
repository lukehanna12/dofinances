# Dofinances

Public source for the Dofinances React + Vite website. This is a development placeholder, not a live financial service.

## Deployment topology

| Component | Destination | Status |
| --- | --- | --- |
| GitHub repository | [lukehanna12/dofinances](https://github.com/lukehanna12/dofinances) | Public source |
| Site build and deployment | GitHub Actions | CI passing; production job gated |
| **Sole Pages deployment project** | **`dofinances-studio`** | Direct Upload, existing project |
| Existing studio hostname | `stu.dofinances.com` | Preserve until DNS inventory and verify |
| Future apex | `dofinances.com` | Pages custom domain registered, initializing; DNS zone pending |
| Future www | `www.dofinances.com` | Pages custom domain registered, initializing; DNS zone pending |
| Future arbitrary subdomains | `*.dofinances.com` | Separate optional Worker router; not live |

The Cloudflare Pages project is **`dofinances-studio`**, serving `dofinances-studio.pages.dev` after deployment. We do **not** need an additional `dofinances` Pages project.

## Working locally (optional)

Node.js 22+:

```bash
npm install
npm run check
npm run dev
npm run build
```

Generated `dist/` and dependency folders are ignored. CI builds on GitHub-hosted runners, not on the owner's Mac.

## GitHub Actions deployment

[The GitHub Actions workflow](.github/workflows/site.yml) builds and tests for every push to `main` and every pull request. The Pages production deployment is **disabled by default** until the repository variable `DEPLOY_ENABLED` is explicitly set to `true`.

[Production credential setup](docs/production-credentials.md) has exact instructions. The only credential the site deployment job needs is the GitHub Actions secret `CLOUDFLARE_API_TOKEN`, scoped to Cloudflare Pages Write for account `7d0d4c74836717a4d23784bbf8d5ccd7`. The nonsecret account ID is in the workflow.

The optional wildcard routing Worker is independently disabled by default via `WILDCARD_DEPLOY_ENABLED`; it uses the **separate** `CLOUDFLARE_WORKERS_API_TOKEN` secret. Its Wrangler configuration has `workers_dev: false` and no domain route; enabling its deployment alone will not attach it to production traffic.

**Do not enable the wildcard router or change DNS** until the production domain has been inventoried and the new DNS zone activated safely.

## Routes and domains

Cloudflare Pages automatically falls back to the React single-page app's `index.html` on unknown paths when no root `404.html` exists. This means arbitrary paths like `/app/budgets/2027` load the app, but implementing a distinct screen for a given path still requires frontend routing.

Pages does **not** accept wildcard custom domains. Use the explicitly gated Worker router under [`edge/`](edge/) when arbitrary subdomains are needed. Its matching hostname and paths proxy to the Pages site. Hosting different applications on different hostnames requires future dispatch logic.

[DNS cutover and limitations](docs/domain-setup.md) explain GoDaddy, certificate coverage, reserved subdomains, and how to migrate safely. Never expose financial or customer data as public repository files.

This setup uses **GitHub Actions**, not Cloudflare-native CI/CD, and does not use R2, D1, browser-run or local build artifacts on the Mac.
