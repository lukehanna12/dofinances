# Connecting dofinances.com, www and subdomains

**Current safe state (November 2026):** `dofinances` is a separate Cloudflare Pages project on the connected Cloudflare account, configured for Direct Upload. No DNS or custom domain changes have been made.

## Inventory first

1. Sign into GoDaddy and review **dofinances.com → DNS**. Confirm its *current authoritative nameservers*, not just its registrar.
2. Export or record every existing record: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `CAA`, `SRV`, `NS`, `DS`. Preserve mail routing, SPF, DKIM, DMARC, verification tokens, and third-party services.
3. Check exactly where the live apex (`dofinances.com`) and `www` currently point. **Do not cut these over until a verified replacement is ready.**
4. Verify the separate existing `stu.dofinances.com` Pages project. Keep it independent unless a migration is separately authorized.

## Production apex: dofinances.com

Cloudflare Pages requires the apex to be in a Cloudflare DNS zone on the same account as the Pages project. GoDaddy can remain the *registrar*: you need not transfer ownership or registration.

Once the production site is approved for cutover:

1. Add `dofinances.com` as a Cloudflare **zone** in the same account as the `dofinances` Pages project.
2. Replicate and verify all existing DNS records in Cloudflare first, including mail and subdomains. Resolve DNSSEC/DS settings safely before a nameserver switch.
3. In Pages project `dofinances`, add `dofinances.com` under **Custom domains**.
4. At GoDaddy, change the domain's nameservers to the two Cloudflare nameservers provided for the new zone. Allow propagation and verify DNS/TLS and critical services.
5. Check that the apex serves the intended deployment and that mail and existing subdomains still work.

## Subdomains, including www

For a subdomain, Cloudflare Pages supports an external DNS provider. First add the subdomain to the Pages project's **Custom domains**; then point its `CNAME` to `dofinances.pages.dev` through the authoritative DNS provider. Merely creating a CNAME without the Pages domain association is insufficient.

Suggested future mapping (not applied):

| Hostname | Project | Action |
| --- | --- | --- |
| `dofinances.com` | `dofinances` | Apex cutover only after full DNS audit |
| `www.dofinances.com` | `dofinances` | Add custom domain, configure DNS and HTTPS; decide canonical redirect |
| `stu.dofinances.com` | `dofinances-studio` | Preserve existing project and hostname |
| Other subdomains | Unknown | Discover owner and active use before modifying |

**Never overwrite existing records blindly.** An active subdomain may be a separate application, service, or mail provider.

Official docs: https://developers.cloudflare.com/pages/configuration/custom-domains/
