# Dofinances live domain architecture

Updated November 6, 2026.

- Domain registrar: GoDaddy, with the user's paid registration through January 2028 unaffected.
- Authoritative DNS: Cloudflare active zone `82449992fdde32c2fedbc9fda8eb2d3c`; DNSSEC disabled.
- Apex `dofinances.com`: GoDaddy Website Builder, DNS-only A `13.248.243.5`.
- `www.dofinances.com`: DNS-only CNAME to apex, GoDaddy handles redirect.
- `stu.dofinances.com`: DNS-only CNAME `dofinances-studio.pages.dev`; Pages custom-domain status active.
- `*.dofinances.com`: proxied A `192.0.2.1` for Worker-only routing; Worker route `*.dofinances.com/*` uses `dofinances-host-router`.
- Exact no-script route exceptions for `stu.dofinances.com/*` and `www.dofinances.com/*`.
- Cloudflare Universal SSL wildcard certificate: active, covers apex and first-level subdomains. Deeper subdomains are not covered on Free Universal SSL.
- Existing Zoho Mail MX/SPF/DKIM/DMARC, SendGrid CNAME, verification tokens, GoDaddy payment and Domain Connect preserved from exported GoDaddy zone.
- `gd-origin.dofinances.com` alias and narrow apex Worker probe route were removed after testing.

## CI/CD

[`site.yml`](../.github/workflows/site.yml) automatically builds and deploys studio React Pages and the Git-controlled wildcard Worker after passing tests. Files on GitHub are public; credentials live in GitHub Secrets. No R2, D1, or Mac local build artifacts required.

Wildcard pages are declared in [`edge/pages.mjs`](../edge/pages.mjs); adding/removing an entry and committing changes the reachable page after CI. The staging page registry is empty after cleanup. The Worker always returns 404 for unconfigured wildcard paths.

**Important limitation:** the original GoDaddy homepage cannot be edited through GitHub. We tested Cloudflare proxied apex and a Worker route on a narrow `/__ci_probe/*` path. The Worker page succeeded, but a subsequent origin request returned HTTP 522. We rolled back proxied apex to DNS-only and removed the temporary route. Full CI/CD control of apex/www needs a safe content migration away from GoDaddy Website Builder, or another validated supported integration, before attaching broad Workers routes.

## Verification

- [Public apex, www, stu HTTPS checks](../.github/workflows/verify-sites.yml)
- [Wildcard HTTPS and deletion check](../.github/workflows/verify-wildcard.yml)

Official docs:
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/workers/authorization/
- https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/
