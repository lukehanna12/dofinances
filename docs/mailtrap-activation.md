# Activate Dofinances transactional email (Mailtrap)

Status: **application adapter deployed, default sender configured, integration contract tests passed; live Mailtrap delivery not yet enabled.**

This is the sole remaining onboarding playbook. No Mailtrap credentials are committed to the repository, and no provider-issued DNS verification records should be fabricated before the account is ready. The domain is registered at GoDaddy, but **Cloudflare is authoritative for DNS**.

## Existing infrastructure — already prepared

- Worker: `dofinances-host-router` (source: `edge/auth-mail.mjs` and `edge/router.mjs`).
- Email API: `POST https://send.api.mailtrap.io/api/send` with `Api-Token`, plain-text and HTML bodies, categories and a verified domain sender. Does **not** use sandbox or bulk email.
- `/login?mode=signup`: sign-up requires an email-verification link before first dashboard access.
- `/login` password-recovery flow, `/verify`, `/reset`: one-time hashed tokens and expiry, server-enforced.
- Authenticator TOTP MFA, one-use recovery codes and the `MFA_ENCRYPTION_KEY` Worker secret are independent of the email provider.
- Email-disabled state: `/api/auth/config` returns `emailAvailable:false`, and signup/reset-request/email-verification-send routes reject without an email sender. Normal legacy sign-in still works.
- Incoming email to the root domain still goes to Zoho: `mx.zoho.com` priority 10, `mx2.zoho.com` 20, `mx3.zoho.com` 50; Zoho DKIM `zmail._domainkey` untouched.
- Historical outbound provider's `em5386`, `s1._domainkey` and `s2._domainkey` CNAME records were removed. Apex SPF no longer contains its obsolete include.

## What remains to do when your Mailtrap account is ready

1. Create/login to a **free Mailtrap account**: <https://mailtrap.io/>. Select **Email API/SMTP Sending** rather than Email Sandbox. **Do not add a paid subscription just for this integration.**
2. Add `dofinances.com` in **Sending Domains** and copy *exactly* the DNS records that Mailtrap provides for that domain (SPF, DKIM, verification, CNAME, etc., as applicable). The free tier currently supports one sending domain.
3. Verify those records in Cloudflare DNS. **Preserve Zoho's three existing MX records, `zmail._domainkey`, the existing root SPF and DMARC unless a specific conflict is reviewed.** Do not publish a second SPF TXT at the root; merge authorized include mechanisms if the provider actually requires root SPF, and ensure SPF's ten-DNS-lookup ceiling. Only publish DNS-only (not proxied) mail authentication records.
4. Wait for the Mailtrap sending domain to report verified/approved.
5. Create a least-privilege transactional-sending API token, preferably scoped to the verified domain. In Cloudflare Dashboard → Workers & Pages → `dofinances-host-router` → Settings → Variables and Secrets, set:
   - `MAILTRAP_API_TOKEN` as **Secret** (transactional Email API token; never provide it in a chat or a Git commit).
   - `AUTH_EMAIL_FROM=noreply@dofinances.com` is **already included in the checked-in Worker configuration**. No extra secret or manual sender variable is needed.
   - **Optional:** `AUTH_EMAIL_REPLY_TO=support@dofinances.com`, *after* verifying that this support address receives mail via Zoho or forwards to your personal inbox.
6. Check `https://dofinances.com/api/auth/config`; `emailAvailable` becomes `true` only when the required sender/token environment bindings are present. This checks presence, **not** domain approval or actual mail deliverability.
7. Perform controlled end-to-end testing: sign up with an inbox you own; receive verification email; open link; sign in; trigger password recovery; confirm single-use/reset expiry; check Gmail/Outlook inbox delivery and spam placement; optionally enroll authenticator MFA and confirm recovery-code behavior.
8. Keep DNS authentication and sending-domain status monitored when planning changes. No D1 migration or new Cloudflare Workers are necessary for the Mailtrap account connection.

## Failure modes and costs

- A missing Mailtrap token or sender keeps signup and mail requests closed with HTTP 503.
- Mailtrap API rejection is fail-closed (no fake successful delivery); a signup may leave an unverified account that can request a replacement link after sender issues are resolved.
- Email sends use the **Mailtrap free-tier quota**, not D1; account/session operations use existing Cloudflare Durable Object SQLite storage.
- Mailtrap API acceptance is not equivalent to mailbox delivery. Verify in real inboxes before making production promises.
- Do not replace Zoho MX records to use Mailtrap for outbound email; no inbound mail migration is needed.
