# Dofinances

Public React + Vite source repository for the **studio application** on `stu.dofinances.com`.

**Important host separation (November 6, 2026):**
- `dofinances.com` and `www.dofinances.com`: **existing GoDaddy Websites + Marketing website**. NOT deployed by this repository.
- `stu.dofinances.com`: React website deployed to Cloudflare Pages project `dofinances-studio` via GitHub Actions.
- Other eligible first-level subdomains: optional Worker router in [`edge/`](edge/); currently **not publicly activated**.

## CI/CD

GitHub Actions builds and tests React on every push to `main` and automatically deploys to the `dofinances-studio` Pages project when `DEPLOY_ENABLED=true`. This does not change DNS or the GoDaddy-built apex site.

The optional wildcard Worker has a **manual** `deploy_wildcard` workflow input. To deploy that Worker through GitHub Actions, configure `CLOUDFLARE_WORKERS_API_TOKEN` as a separate GitHub Actions repository secret. The existing Pages token lacks Worker deployment authorization. The Worker has no routes and `workers_dev` is disabled, so publishing its code alone does not attach any public hostname.

[Live TLS and DNS verification](.github/workflows/verify-sites.yml) is a separate, manually triggered workflow with an optional wildcard-host test.

## Source and build

Requires Node.js 22+:

```bash
npm install
npm run check
npm run dev
npm run build
```

`dist/` and `node_modules/` are ignored. GitHub-hosted Actions runners perform deployment builds; no local Mac artifacts are needed.

[DNS and wildcard routing status](docs/domain-setup.md) · [Cloudflare credentials](docs/production-credentials.md)

This is an initial UI placeholder. Never commit secrets, passwords, or sensitive financial data to this public repository.
