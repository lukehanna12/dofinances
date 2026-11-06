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

Existing Zoho Mail delivery (three MX records and the `zmail._domainkey` DKIM TXT), Zoho domain verification, Domain Connect and GoDaddy payment-link DNS entries are preserved. **The three obsolete SendGrid CNAMEs and its SPF include were removed in November 2026**; do not restore them. Do not proxy or overwrite Zoho mail records.

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

## Email delivery for account security

The deployed Worker now uses **Mailtrap transactional email API**, with the `MAILTRAP_API_TOKEN` Worker secret and the preconfigured non-secret sender `AUTH_EMAIL_FROM=noreply@dofinances.com` (optional `AUTH_EMAIL_REPLY_TO`). Its Free tier provides 4,000/month and 150/day using one sending domain. To activate, verify `dofinances.com` in Mailtrap and add only the exact, nonconflicting verification records to authoritative **Cloudflare DNS**. Preserve the existing Zoho MX records and mail reception; old outbound-provider DNS records were removed after the Mailtrap transition; no Mailtrap verification records have been created before the owner establishes a Mailtrap sending domain. With no Mailtrap token/sender configured, signup, verification emails and password-reset messages fail closed; TOTP enrollment and authenticated legacy accounts remain available. The MFA encryption key remains a separate Worker secret. See `docs/account-security.md`.


## Mailtrap migration DNS baseline (2026-11-06)

The legacy provider's CNAMEs `em5386.dofinances.com`, `s1._domainkey.dofinances.com`, and `s2._domainkey.dofinances.com` were retired. The apex SPF TXT is `v=spf1 include:zoho.com ~all`, without the legacy outbound provider include. Keep the current Zoho root MX priorities of 10, 20, 50 and `zmail._domainkey` intact. Do not add Mailtrap DNS record values from examples: create them only when Mailtrap issues the exact records for this sending domain. See [Mailtrap activation](mailtrap-activation.md).
