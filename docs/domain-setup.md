# Dofinances DNS, hosting and CI/CD

Updated November 6, 2026. **The website's code and pages are managed in GitHub.** GoDaddy remains the **domain registrar only**; the domain's January 2028 registration and renewal are unaffected.

## Authoritative DNS

Cloudflare zone `82449992fdde32c2fedbc9fda8eb2d3c` is active. Nameservers: `austin.ns.cloudflare.com`, `kira.ns.cloudflare.com`. DNSSEC is disabled by choice.

| DNS hostname | Record | Proxy | Routing |
| --- | --- | --- | --- |
| `dofinances.com` | `A 192.0.2.1` | Cloudflare proxied | Worker `dofinances-host-router` |
| `www.dofinances.com` | `CNAME dofinances.com` | Cloudflare proxied | Same Worker, `www.dofinances.com/*` |
| `stu.dofinances.com` | `CNAME dofinances-studio.pages.dev` | DNS-only | Existing Pages project `dofinances-studio`; no-script Worker exception |
| `*.dofinances.com` | `A 192.0.2.1` | Cloudflare proxied | Same Worker, `*.dofinances.com/*` |

The placeholder IP `192.0.2.1` is deliberately originless; incoming proxied requests are handled by the Worker route rather than a GoDaddy backend. Cloudflare Universal SSL (apex and first-level wildcard) is active. Deeper `a.b.dofinances.com` hostnames are not covered by the default certificate.

All existing Zoho Mail, SendGrid, domain verification, Domain Connect and GoDaddy payment-link DNS entries were preserved. Do not proxy or overwrite those records when adding hostnames.

## Git content locations

See [README](../README.md) and [Worker routing documentation](../edge/README.md) for examples.

- `sites/_apex/` → `https://dofinances.com/` and its paths.
- `sites/_www/` → independent pages on `www`, where present; otherwise redirect same path to apex.
- `sites/<label>/` → corresponding eligible first-level subdomain, e.g. `sites/portfolio/index.html` → `https://portfolio.dofinances.com/`.
- `src/` and `public/` → React studio at `stu.dofinances.com`. CI also publishes its built HTML and assets at `dofinances.com/login` through the apex Worker; `stu.dofinances.com/login` and `/login/` return a true 404 via a narrowly scoped Pages Function.

GitHub Actions [`site.yml`](../.github/workflows/site.yml) tests/builds and, with `DEPLOY_ENABLED=true`, publishes both the Pages project and the Worker with static assets. Adding, editing or deleting a site file and committing to `main` updates the hosted page. Undefined URLs return 404, apart from `www` redirecting to the apex where it has no independent page.

Temporary verification pages were created and then deleted by Git commits; their public URLs were confirmed to return 404. The original GoDaddy Website Builder pages are intentionally not replicated; their content was temporary and is now replaced by a minimal, version-controlled homepage. The previous GoDaddy origin-proxy test returned 522, so **no Worker fallback to GoDaddy is used**.

## Verification

- [Automatic CI/CD](../.github/workflows/site.yml)
- [Manual host/content HTTPS checks](../.github/workflows/verify-git-sites.yml)
- [Basic HTTPS checks](../.github/workflows/verify-sites.yml)
- [Wildcard removal/404 checks](../.github/workflows/verify-wildcard.yml)

Cloudflare reference: https://developers.cloudflare.com/workers/static-assets/binding/

## Authentication architecture

The apex Worker now also serves a protected `/app` dashboard and email/password authentication under `/api/auth/*`. The `AuthStore` Durable Object is declared in `edge/wrangler.jsonc` using a SQLite-backed class export, and is provisioned during the same GitHub Actions Wrangler deployment. This creates **no D1 bindings, D1 row reads or D1 row writes**. The Studio Pages project is not an account authority. `www` authentication URLs redirect to canonical apex. No Tailscale Funnel, Workers Builds, external OAuth providers or new DNS records are needed.
