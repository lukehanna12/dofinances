# Dofinances

Public website source for **Dofinances**. This repository contains a small, responsive React + Vite starter. It is not yet a financial application, and no customer data or credentials belong in this repository.

- **Source:** https://github.com/lukehanna12/dofinances
- **Intended deployment:** Cloudflare Pages project `dofinances` (`https://dofinances.pages.dev` after its first deployment)
- **CI/CD:** **GitHub Actions** builds, tests and deploys; Cloudflare does **not** build this application.
- **Domain:** `dofinances.com`, registered with GoDaddy. Apex DNS is **not yet connected**; see [domain setup](docs/domain-setup.md).
- Existing `stu.dofinances.com` Cloudflare Pages project is **independent**, and must not be replaced without explicit approval.

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run check
npm run dev
npm run build
```

The build produces `dist/`. It is disposable and ignored by Git.

## GitHub Actions: one-time activation

The workflow in [`.github/workflows/site.yml`](.github/workflows/site.yml) runs checks and a build on every push to `main` and on pull requests. It **does not deploy by default**, so creating this repository cannot overwrite an existing website.

To activate deployments:

1. In Cloudflare, generate a scoped API token with **Account → Cloudflare Pages → Edit** for the account holding the `dofinances` Pages project.
2. In GitHub, **Settings → Secrets and variables → Actions**, create a repository secret named `CLOUDFLARE_API_TOKEN`. Do not commit the token.
3. Ensure the repository variable `CLOUDFLARE_ACCOUNT_ID` is set to the Cloudflare account ID, and `DEPLOY_ENABLED` is set to `true`.
4. In **Actions**, manually run **Build and deploy Dofinances**, or push to `main`. The build runs in a GitHub-hosted runner and the prebuilt `dist/` is uploaded with `cloudflare/wrangler-action@v4`.

This performs **GitHub Actions CI/CD with Cloudflare Pages Direct Upload**. No build caches or generated files are created on the owner's Mac.

`cloudflare-production` is a GitHub environment for deployment; configure environment approval rules if desired.

## Production-domain safety

Do **not** change GoDaddy nameservers or existing live records without first inventorying all active DNS, especially MX, TXT, SPF, DKIM, DMARC, `www`, and `stu`. See [domain setup](docs/domain-setup.md) before connecting `dofinances.com`.

For the intended future React Native Web components, evaluate package compatibility and licensing before integrating them. This starter intentionally has no native-device dependencies.
