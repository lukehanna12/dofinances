# Dofinances DNS, hosting and CI/CD

Verified November 11, 2026 against Cloudflare DNS, Worker routes, Pages and repository configuration. **The website's code and pages are managed in GitHub.** GoDaddy remains the **domain registrar only**; the domain's January 2028 registration and renewal are unaffected.

## Authoritative DNS

Cloudflare is authoritative for the domain. Zone identifiers and private account configuration are intentionally omitted; consult the Cloudflare dashboard for the live zone and DNS security settings.

| DNS hostname | Record | Proxy | Routing |
| --- | --- | --- | --- |
| `dofinances.com` | `A 192.0.2.1` | Cloudflare proxied | Worker `dofinances-host-router` |
| `www.dofinances.com` | `CNAME dofinances.com` | Cloudflare proxied | Same Worker, `www.dofinances.com/*` |
| `stu.dofinances.com` | `CNAME dofinances-studio.pages.dev` | DNS-only | Existing Pages project `dofinances-studio`; no-script Worker exception |
| `*.dofinances.com` | `A 192.0.2.1` | Cloudflare proxied | Same Worker, `*.dofinances.com/*` |

The placeholder IP `192.0.2.1` is deliberately originless; incoming proxied requests are handled by the Worker route rather than a GoDaddy backend. Cloudflare Universal SSL (apex and first-level wildcard) is active. Deeper `a.b.dofinances.com` hostnames are not covered by the default certificate.

Existing Zoho Mail delivery (three MX records and the `zmail._domainkey` DKIM TXT), Zoho domain verification, Domain Connect and GoDaddy payment-link DNS entries are preserved. Mailtrap sending, tracking and DKIM DNS records are also present and remain DNS-only. **The three obsolete SendGrid CNAMEs and its SPF include were removed in November 2026**; do not restore them. Do not proxy or overwrite Zoho mail records.

## Git content locations

See [README](../README.md) and [Worker routing documentation](../edge/README.md) for examples.

- `sites/_apex/` → `https://dofinances.com/` and its paths.
- `sites/_www/` → independent pages on `www`, where present; otherwise redirect same path to apex.
- `sites/<label>/` → corresponding eligible first-level subdomain, e.g. `sites/portfolio/index.html` → `https://portfolio.dofinances.com/`.
- `src/`, root `index.html`, `vite.config.mjs`, and top-level `public/` → **Auth-3 Vite build for apex `/login`**, not the current Pages workspace homepage. CI copies this output into the Worker assets.
- `studio/sidebar/` and selected shared files from `sites/_apex/app/assets/` → **`stu.dofinances.com` static workspace preview**. Both `/` and `/app/` are public and non-authenticated; `/login` and `/login/` return 404 through a narrowly scoped Pages Function. There is no `src/public/` output directory.

GitHub Actions [`site.yml`](../.github/workflows/site.yml) runs `npm run check`, `npm run build`, verifies the build artifact, and—on `main` with `DEPLOY_ENABLED=true`—publishes both the Pages project and Worker with static assets via Wrangler. A follow-on smoke job tests public routes, account boundaries, wallpapers and the sidebar. Adding, editing or deleting a site file and committing to `main` updates the hosted page. Undefined URLs return 404, apart from `www` redirecting to the apex where it has no independent page.

Temporary verification pages were created and then deleted by Git commits; their public URLs were confirmed to return 404. The original GoDaddy Website Builder pages are intentionally not replicated; their content was temporary and is now replaced by a minimal, version-controlled homepage. The previous GoDaddy origin-proxy test returned 522, so **no Worker fallback to GoDaddy is used**.

## Verification

- [Automatic CI/CD](../.github/workflows/site.yml)
- [Manual host/content HTTPS checks](../.github/workflows/verify-git-sites.yml)
- [Basic HTTPS checks](../.github/workflows/verify-sites.yml)
- [Wildcard removal/404 checks](../.github/workflows/verify-wildcard.yml)

Cloudflare reference: https://developers.cloudflare.com/workers/static-assets/binding/

## Authentication architecture

The apex Worker now also serves a protected `/app` dashboard and email/password authentication under `/api/auth/*`. The `AuthStore` Durable Object is declared in `edge/wrangler.jsonc` using a SQLite-backed class export, and is provisioned during the same GitHub Actions Wrangler deployment. This creates **no D1 bindings, D1 row reads or D1 row writes**. The Studio Pages project is not an account authority. `www` authentication URLs redirect to canonical apex. No Tailscale Funnel, Cloudflare Workers Builds, new DNS records for eligible wildcard labels, or local Mac build runner is needed. Google/GitHub OAuth identity sign-in is optional and is configured separately through existing Worker credentials.

## Email delivery for account security

The apex Worker uses a transactional email API with private server-side credentials and provider-issued DNS records. The integration's configuration has been observed, but provider-side sender approval and mailbox delivery were not validated. Inbound email is separately handled by the existing mail provider. See [Mailtrap verification](mailtrap-activation.md).

## Control-plane service boundaries

The Worker has independent bindings for static assets, the account store, Colosseum administration and an allowlisted wallpaper service. One shared owner-restricted Cloudflare Access application protects the `/api/cloudflare/*` and `/api/colosseum/*` administration prefixes. Independent Worker-side owner records and operation policies still govern their separate capabilities; private identifiers are not included in public documentation.

## Mailtrap migration DNS baseline (2026-11-06)

The legacy provider's CNAMEs `em5386.dofinances.com`, `s1._domainkey.dofinances.com`, and `s2._domainkey.dofinances.com` were retired. The apex SPF record reflects the authorized mail provider and excludes the retired outbound service. Keep the current Zoho root MX priorities of 10, 20, 50 and `zmail._domainkey` intact. The present Mailtrap records were installed from the provider; do not replace them with example values or add competing SPF TXT records. Reverify provider-side domain approval before changing any authentication DNS. See [Mailtrap activation](mailtrap-activation.md).
