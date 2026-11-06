# Optional wildcard routing Worker

This Worker proxies **eligible first-level** subdomains (e.g. `alpha.dofinances.com/a/b?x=1`) to the React Pages app hosted on `dofinances-studio.pages.dev`. It does **not** proxy `dofinances.com` or its existing `www`, `stu`, payment, email and verification hostnames. Deeper names need separate TLS coverage and are intentionally rejected.

The apex and `www` remain on **GoDaddy Websites + Marketing**; `stu` remains on **Cloudflare Pages**.

## Deploy through GitHub Actions

In GitHub Actions run **Build and deploy Dofinances**, selecting the optional `deploy_wildcard` input. The Worker uses a separately scoped secret `CLOUDFLARE_WORKERS_API_TOKEN` when present, otherwise tries the existing `CLOUDFLARE_API_TOKEN`. A Pages-only token will not have Worker deployment access.

Wrangler config sets `workers_dev: false` and **no live routes**. A successful deployment alone will not change any public hostnames.

The DNS and route cutover is a separate Cloudflare change: create a **proxied wildcard A** record (for a Worker-only origin, `192.0.2.1` can be used), and attach `*.dofinances.com/*` to `dofinances-host-router`. **Before** attaching the wildcard route, create no-script exceptions for `stu.dofinances.com/*`, `www.dofinances.com/*` and any other existing proxied application hosts. These more-specific rules take precedence.

For safety, the router itself accepts only exact single-label valid hostnames not in its reserved list, only GET/HEAD, and strips Cookie/Authorization before requesting the fixed static-site upstream.

Use a throwaway test name matching the wildcard DNS record and verify HTTP/HTTPS behavior and arbitrary nested paths, then inspect the exact real DNS and active routes. No local Mac files are needed.

Cloudflare official references:
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/
