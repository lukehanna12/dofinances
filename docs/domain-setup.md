# Production domain, wildcard subdomains and arbitrary paths

## Verified configuration (November 6, 2026)

- Domain registrar: **GoDaddy** (per owner).
- Original nameservers reported by Cloudflare: `ns67.domaincontrol.com` and `ns68.domaincontrol.com`.
- Pending Cloudflare Free zone for `dofinances.com`: `82449992fdde32c2fedbc9fda8eb2d3c`.
- Assigned Cloudflare nameservers: `austin.ns.cloudflare.com` and `kira.ns.cloudflare.com`.
- On inspection the new Cloudflare zone had **zero DNS records**. **Do not switch GoDaddy nameservers while empty.**
- **Only Pages application target**: `dofinances-studio`, with `dofinances-studio.pages.dev` and existing custom domain `stu.dofinances.com`. No successful Pages deployments verified during setup.
- Do not assume the pending DNS zone is already authoritative or that the apex is serving this project.

## 1. Inventory GoDaddy DNS before any cutover

GoDaddy > My Products > Domains > `dofinances.com` > DNS.

Record all existing A/AAAA/CNAME/MX/TXT/CAA/SRV/NS/DS and subdomains, including mail routing, verification tokens, SPF/DKIM/DMARC, custom services, any active `www`, and `stu`. Check whether DNSSEC is active at GoDaddy.

Replicate legitimate records into the pending Cloudflare zone before changing authoritative nameservers. If DNSSEC is used, handle DS changes deliberately to avoid DNSSEC validation failures. Do not overwrite other services merely to enable wildcard hosts.

## 2. Make the first Pages deployment

Enable GitHub Actions credentials per [production-credentials.md](production-credentials.md). Verify that `https://dofinances-studio.pages.dev/` serves the new site. Deployments to the existing `stu.dofinances.com` custom domain may also change its site content—this is intentional only after approval.

## 3. Connect apex and www

Cloudflare Pages requires a Cloudflare **DNS zone** for the apex `dofinances.com`. When the authoritative DNS migration is ready, add the apex to the `dofinances-studio` project's **Custom domains**, and arrange its DNS records as Cloudflare directs. Add `www.dofinances.com` as another explicit Pages custom domain and choose a canonical redirect policy.

Cloudflare's assigned nameservers above are the values to enter at GoDaddy **only after** safely migrating records and checking that the Pages deployment is healthy. GoDaddy can remain the registrar; no domain transfer is required. Validate HTTP, HTTPS, mail and important subdomains after propagation.

## 4. Arbitrary subdomains are not native to Pages

Cloudflare Pages currently **does not support** custom domain `*.dofinances.com`.

A future wildcard setup uses:

1. Cloudflare becomes authoritative for `dofinances.com`.
2. Add a Cloudflare-proxied wildcard DNS record `*.dofinances.com` (while preserving all explicit existing records). The origin value used for a route-only Worker can be a suitable dummy IP as documented by Cloudflare; do not expose an unprotected origin.
3. Deploy the separately gated `dofinances-host-router` Worker from [edge/](../edge/). Its configuration does not automatically attach any routes.
4. Register the route `*.dofinances.com/*` to that Worker. It forwards arbitrary hostnames and URL paths to `dofinances-studio.pages.dev` while retaining each public hostname.
5. Preserve `stu.dofinances.com` and other separately configured applications via more-specific bypass routes or explicit handling. **Test before enabling the broad wildcard route.**

This enables a common site for arbitrary first-level subdomains. Per-subdomain content/apps require explicit dispatch logic in the Worker. The wildcard Worker introduces Workers request/CPU quota usage.

**TLS boundary:** Cloudflare Free Universal SSL covers the root and first-level subdomains (e.g. `anything.dofinances.com`) but not deeper hostnames (e.g. `x.y.dofinances.com`). Deeper HTTPS hosts may need paid certificate products such as Advanced Certificate Manager/Total TLS.

## 5. Arbitrary URL paths

On the Pages project, unknown paths are served via the React SPA fallback (no root `404.html`). This means `dofinances.com/any/arbitrary/path` can load the app after the apex is connected. Distinct page content, auth, API endpoints and redirects are application-level tasks to implement, not DNS entries.

## Final readiness checklist

- [ ] Export and review GoDaddy authoritative DNS
- [ ] Re-create all required DNS in pending Cloudflare zone
- [ ] Verify first GitHub Actions deployment to existing Pages project
- [ ] Prepare custom domain `dofinances.com` and `www` in Pages
- [ ] Validate nameserver and DNSSEC plan
- [ ] Switch GoDaddy nameservers when safe, then verify DNS/TLS/mail
- [ ] Separately enable wildcard Worker, wildcard DNS and route if requested
- [ ] Verify representative hostnames and paths, plus existing `stu`

References:
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/platform/known-issues/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/
