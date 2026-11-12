# Dofinances Mailtrap transactional email: readiness and verification

_Checked 2026-11-11 against the Worker source, deployed Worker bindings, and Cloudflare DNS. Provider dashboard approval and end-to-end mailbox delivery were not checked._

## Current state

| Component | Verified state |
| --- | --- |
| Worker adapter | Implemented at `edge/auth-mail.mjs`, using `POST https://send.api.mailtrap.io/api/send` with `Api-Token` |
| Sender variable | `AUTH_EMAIL_FROM=noreply@dofinances.com` in `edge/wrangler.jsonc` |
| Worker API-token binding | `MAILTRAP_API_TOKEN` exists as a **secret_text binding**; its value is not available in source and must not be exposed |
| Sending DNS | `mt75.dofinances.com` → `smtp.mailtrap.live`; `mt-link.dofinances.com` → `t.mailtrap.live`; `rwmt1._domainkey` and `rwmt2._domainkey` point to Mailtrap DKIM hosts; all DNS-only |
| Incoming email | Zoho MX priorities 10, 20 and 50, Zoho DKIM and root SPF preserved |
| Mailtrap provider-side approval | **Not verified by this audit** |
| Real email API acceptance / inbox delivery | **Not verified by this audit** |

The code provides one-time email verification and password reset, and optional TOTP MFA with one-time recovery codes. New users receive no valid authenticated session until email verification. Mailtrap is the **only** configured transactional sending adapter. The prior SendGrid CNAMEs/SPF include have been retired. Cloudflare—not GoDaddy—is authoritative for DNS.

## Remaining checks before declaring email fully operational

1. Log into the intended Mailtrap sending account using its own dashboard (without copying a token into source or chat). Confirm `dofinances.com` is approved/verified, the expected sending stream is enabled, and its quota/account status permits sending.
2. Confirm the configured `MAILTRAP_API_TOKEN` is valid for the production sending API and verified domain. The binding exists, but binding existence alone does not prove permissions or token validity.
3. Inspect `https://dofinances.com/api/auth/config`: `emailAvailable` reports that the runtime has a sender and token, **not** provider-side validation or inbox delivery. A false result indicates missing/invalid-looking runtime configuration.
4. Using only controlled test accounts and owned inboxes, run sign-up, receive a verification message, follow the fragment-based 24-hour one-use verification link, sign in, initiate password recovery, and confirm the 30-minute one-use reset and session revocation. Check acceptance, inbox/spam placement, and error responses; also test MFA where appropriate.
5. If a provider-side DNS correction is required, apply **only the exact Mailtrap-issued record values**. Preserve existing Zoho MX, DKIM, and DMARC; never add a second root SPF TXT. Keep Mailtrap CNAMEs DNS-only. Do not rotate secrets or change the account sender as part of a documentation refresh.

## Failure semantics and costs

- Missing `MAILTRAP_API_TOKEN` or `AUTH_EMAIL_FROM` makes the email-dependent account flows fail closed with HTTP 503; existing verified/legacy sign-in and MFA remain separate.
- A Mailtrap send rejection fails closed rather than pretending successful delivery. A pending, unverified signup may remain and need a replacement verification request. The application intentionally does not retry an uncertain delivery in a loop.
- API acceptance does not prove delivery. Check the Mailtrap provider log and controlled inboxes before stating the feature is production-validated.
- Mailtrap quotas and free-plan allowances must be read from the **current provider account**; older 4,000/month and 150/day figures are historical notes, not a guaranteed current entitlement. No D1 or R2 service is involved in this email integration.
- Never reveal the API token, link tokens, recipient PII, or `MFA_ENCRYPTION_KEY` in GitHub, logs, or chat.

See [account security](account-security.md), [domain and DNS setup](domain-setup.md), and [current architecture](architecture.md).
