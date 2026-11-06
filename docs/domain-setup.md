# Dofinances DNS, TLS, and wildcard routing

## Confirmed design

- Domain registrar: **GoDaddy**; registration remains there.
- Authoritative DNS: Cloudflare account, active zone `82449992fdde32c2fedbc9fda8eb2d3c`.
- `dofinances.com` and `www.dofinances.com`: original GoDaddy Websites + Marketing homepage, **not React Pages**.
- `stu.dofinances.com`: React Pages project `dofinances-studio` deployed by GitHub Actions.
- Wildcard `*.dofinances.com`: separately gated Worker router intended for eligible first-level application hostnames; not active until credential, DNS, route and TLS verification.

## Completed repairs, November 6, 2026

The original GoDaddy export contained a provider-specific apex entry `WebsiteBuilder Site` (not a usable IP), and `www` as a CNAME to the apex. With Cloudflare nameservers now activated, the following web records have been configured in Cloudflare using GoDaddy's published external-DNS instructions:

| Host | Type | Destination | Proxy |
| --- | --- | --- | --- |
| `dofinances.com` | A | `13.248.243.5` | DNS-only |
| `www.dofinances.com` | CNAME | `dofinances.com` | DNS-only |
| `stu.dofinances.com` | CNAME | `dofinances-studio.pages.dev` | DNS-only |

The pending Pages custom-domain associations for the **apex and `www`** have been explicitly deleted. The `stu` association is retained. The GoDaddy homepage is therefore not published from this GitHub repo.

The other **14** provider records were populated using the exported baseline: Zoho MX/SPF/DKIM/DMARC, SendGrid CNAMEs, Google/Zoho verification, GoDaddy payment link, and GoDaddy Domain Connect. DNSSEC is disabled by owner preference. Never delete those records while changing wildcard routes.

GoDaddy reference: https://www.godaddy.com/en/help/connect-an-external-domain-to-my-websites-marketing-or-version-7-site-40564

## Live verification

Use [GitHub Actions: Verify live DNS and HTTPS](../.github/workflows/verify-sites.yml) to check TLS and actual publicly reachable webpages from a hosted runner. Do not infer successful HTTPS solely from DNS record existence. Pages and GoDaddy may require propagation after DNS updates.

## Wildcard deployment and routing

1. Create a separate Cloudflare Workers API token scoped to Workers product Admin if creating a new Worker. Later replace it with a token scoped to Editor for the single existing `dofinances-host-router` Worker.
2. Save token as the GitHub Actions repository secret `CLOUDFLARE_WORKERS_API_TOKEN`.
3. In [Build and deploy Dofinances](../.github/workflows/site.yml), use **Run workflow**, setting `deploy_wildcard` to true. The Worker deploys without routes or public workers.dev.
4. Once successful, create Cloudflare-proxied wildcard DNS record `A *.dofinances.com → 192.0.2.1` for route-only fallback.
5. Before attaching the `*.dofinances.com/*` Worker route, add **no-script** exemptions `stu.dofinances.com/*`, `www.dofinances.com/*` and any other existing application hostnames. Cloudflare chooses more-specific routes.
6. Attach wildcard route to `dofinances-host-router`, verify one or more arbitrary hostnames and nested paths using the optional test in the HTTPS workflow, and clean up only temporary test records/routes.
7. Explicit first-level subdomain records (including `stu` and `pay`) override wildcard DNS. The Worker itself also rejects reserved hostnames and deeper hostnames.
8. Universal SSL on a Cloudflare full zone covers the apex and first-level subdomains; deeper hostnames require additional certificate coverage.

**Important:** The wildcard Worker is a fixed-origin static Pages proxy, not a generalized code execution tool. It strips cookies and authorization and only supports GET/HEAD. Arbitrary URL paths load the SPA fallback; distinct app routes require future UI code.

Cloudflare references:
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/
- https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/
