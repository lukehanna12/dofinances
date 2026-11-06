# Dofinances account security (November 2026)

## Routes and user experience

- `/login`: sign in, register, resend verification, initiate password recovery, enter MFA code or one-use recovery code.
- `/verify`: confirmation page linked from an email. Bearer token is carried in the URL fragment and submitted by the visitor via POST; the link is valid for 24 hours and can be used once.
- `/reset`: password-reset page linked from an email. One-time token expires after 30 minutes. Successful reset revokes all sessions. MFA-enabled accounts must also supply an authenticator or recovery code.
- `/app`: Worker-guarded dashboard with email verification status, TOTP setup/disable, recovery-code display (only once on setup), and account deletion.
- `/api/auth/config`: reports whether transactional email and MFA secrets are available, without revealing credentials.

## Server implementation

`edge/auth-store-secure.mjs` extends the existing `AuthStore` Durable Object while preserving its users, sessions and attempts tables. Additional tables: `account_security`, `mail_tokens`, `mfa_challenges`, `mfa_recovery`. These are **SQLite-backed Durable Object tables, not D1**. No D1 or R2 is needed.

Verification/reset tokens are 256-bit cryptographically random, stored only as SHA-256 hashes, scoped to user and purpose, expiration-limited and consumed on use. New accounts receive no authenticated session until verification. Existing users are temporarily grandfathered and may verify their email when delivery is enabled.

TOTP implements RFC 6238 with 30-second SHA-1 six-digit codes, a ±1 step tolerance, replay protection, AES-GCM encryption at rest using a server-only `MFA_ENCRYPTION_KEY` and 10 one-use, account-scoped hashed recovery codes. Enrollment requires the user's current password. Enabling/disabling MFA revokes all active sessions. Login requests with MFA enabled receive a five-minute single-use challenge, never a logged-in cookie, until the correct second factor is supplied. Authentication failures are rate-limited.

## Selected outbound provider: Mailtrap Email Sending

**Mailtrap is the chosen transactional provider; SendGrid is not used.** The integration calls
`POST https://send.api.mailtrap.io/api/send` with the `Api-Token` header, a single recipient,
plain-text plus HTML content, and the `account-verification`/`password-recovery` category.
It does **not** call Mailtrap's Sandbox or bulk-marketing API. On the free plan, the currently
advertised allowance is **4,000 messages/month, capped at 150/day**, for **one verified sending
domain**. This is a provider quota, not a D1 cost.

### Activating outbound email (requires account owner)

1. Register or sign into [Mailtrap](https://mailtrap.io/) and select **Email API/SMTP Sending**, not
   Email Sandbox. Use the free plan; do not subscribe to a paid plan.
2. Under **Sending Domains**, add **`dofinances.com`** and obtain Mailtrap's exact verification
   records. The domain's **authoritative DNS is Cloudflare**, even though GoDaddy is the registrar.
   The site already has Zoho MX records, existing DKIM selectors and DMARC; preserve them.
   Only add nonconflicting records that Mailtrap actually issues. If Mailtrap requests a conflicting
   DMARC value, review it instead of blindly replacing the existing security policy.
3. Complete Mailtrap's compliance/domain verification and confirm its status is **Verified**.
4. In Mailtrap **Sending Domains → Integration → Transactional Stream → API** (or Settings →
   API Tokens), obtain a **send-only, domain-scoped API token**.
5. Configure these as **Cloudflare Worker secrets** for `dofinances-host-router`:
   - `MAILTRAP_API_TOKEN`: the transactional sending token (**never commit or paste into chat**).
   - `AUTH_EMAIL_FROM`: the verified sender, e.g. `noreply@dofinances.com`.
   - Optional `AUTH_EMAIL_REPLY_TO`: `support@dofinances.com` **only when inbound
     reception/forwarding has been confirmed**.
6. Send test verification and password-reset messages to controlled Gmail and Outlook mailboxes.
   Confirm send acceptance, inbox placement, links, and delivery before advertising open registration.

`noreply@` and `support@` are two local-part addresses of the **same verified domain**, not
two separately purchased mailboxes or two sending domains. Mailtrap authenticates the domain;
it does not receive/forward personal support mail as part of this Worker integration.

**Incoming email remains separate:** existing `mx.zoho.com`, `mx2.zoho.com` and
`mx3.zoho.com` MX records are left unchanged. No GoDaddy, Zoho, DNS, R2 or D1 mutations
are needed just to commit this application-side Mailtrap API adapter.

If mail credentials are missing, signup and email-dependent flows fail closed with HTTP 503;
existing login and MFA continue. If email dispatch fails during signup, the pending account
may remain and can request a new link later. There is **no retry loop** for an uncertain send.

The `MFA_ENCRYPTION_KEY` (64 hexadecimal characters representing a 256-bit random key)
is installed as a Cloudflare Worker secret. Keep it safe and do not rotate without a key
rotation plan: rotating it invalidates decryption of previously enrolled authenticators.
Never log or commit secrets, verification links, codes or plaintext passwords.

## Security boundaries and follow-up

All state-changing endpoints require the exact canonical apex Origin and JSON. Sessions use hashed server-side tokens in Secure, HttpOnly, SameSite=Lax `__Host-` cookies; protected dashboard HTML and assets are marked no-store. Cross-origin attempts are rejected. Only the apex Worker has account authority; the `stu` Pages host has no access to the session cookie.

A verified sender, deliverability tests, security review, password hashing migration to a reviewed memory-hard KDF, and ideally passkeys or phishing-resistant MFA are recommended before storing sensitive financial information. Rate limiting helps reduce automated abuse but is not a replacement for edge-level bot controls or account security monitoring.
