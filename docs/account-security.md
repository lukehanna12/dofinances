# Dofinances account security

_Implementation status checked 2026-11-11 against the Worker source and deployed Cloudflare bindings._

## Routes and user experience

- `/login`: sign in, register, resend verification, initiate password recovery, enter MFA code or one-use recovery code.
- `/verify`: confirmation page linked from an email. Bearer token is carried in the URL fragment and submitted by the visitor via POST; the link is valid for 24 hours and can be used once.
- `/reset`: password-reset page linked from an email. One-time token expires after 30 minutes. Successful reset revokes all sessions. MFA-enabled accounts must also supply an authenticator or recovery code.
- `/app`: Worker-guarded dashboard with email verification status, TOTP setup/disable, recovery-code display (only once on setup), and account deletion.
- `/api/auth/config`: reports whether transactional email and MFA secrets are available, without revealing credentials.

## Server implementation

`edge/auth-store-secure.mjs` extends the existing `AuthStore` Durable Object while preserving its users, sessions and attempts tables. Additional tables: `account_security`, `mail_tokens`, `mfa_challenges`, `mfa_recovery`, `colosseum_owner`, and `cloudflare_account_connection`. The federated subclass (`edge/auth-store-federated.mjs`) also owns `account_methods`, `federated_identities`, and `federation_transactions`. These are **SQLite-backed Durable Object tables, not D1**. No D1 or R2 is needed.

Verification/reset tokens are 256-bit cryptographically random, stored only as SHA-256 hashes, scoped to user and purpose, expiration-limited and consumed on use. New accounts receive no authenticated session until verification. Existing users are temporarily grandfathered and may verify their email when delivery is enabled.

TOTP implements RFC 6238 with replay protection, encrypted key storage, and one-use recovery codes. Enrollment requires the user's current password. Enabling/disabling MFA revokes all active sessions. Login requests with MFA enabled receive a five-minute single-use challenge, never a logged-in cookie, until the correct second factor is supplied. Authentication failures are rate-limited.

## Selected outbound provider: Mailtrap Email Sending

**Mailtrap is the sole transactional-email provider.** The integration calls
`POST https://send.api.mailtrap.io/api/send` with the `Api-Token` header, a single recipient,
plain-text plus HTML content, and the `account-verification`/`password-recovery` category.
It does **not** call Mailtrap's Sandbox or bulk-marketing API. The Mailtrap account's current plan/quota must be checked at the provider rather than inferred from historical free-tier figures; email delivery does not consume D1 capacity.

### Current outbound email configuration and remaining verification

**Configuration review (2026-11-11):** Outbound email credentials and provider-issued DNS records are installed, but that does not prove the sending-domain approval, API acceptance, or mailbox delivery. No credential identifiers or private contact details are published here.

Before considering sign-up and recovery fully operational, verify the actual Mailtrap sending-domain approval, inspect the public `/api/auth/config` readiness flags, and run controlled sign-up/verification/recovery tests to owned inboxes (including spam placement and single-use token behavior). Avoid copying, reissuing, or logging a production token merely to re-check configuration. If changes are required, use the exact records and guidance issued by Mailtrap, preserve the Zoho records, and do not publish duplicate root SPF TXT records.

`noreply@` and `support@` are two local-part addresses of the **same verified domain**, not
two separately purchased mailboxes or two sending domains. Mailtrap authenticates the domain;
it does not receive/forward personal support mail as part of this Worker integration.

**Incoming email remains separate:** existing `mx.zoho.com`, `mx2.zoho.com` and
`mx3.zoho.com` MX records are left unchanged. No GoDaddy, Zoho, R2 or D1 mutations are needed to activate the API adapter. The obsolete outbound-provider DNS records are retired; Mailtrap-issued sending/tracking/DKIM CNAMEs are now installed. Sender approval and end-to-end deliverability remain separate checks.

If mail credentials are missing, signup and email-dependent flows fail closed with HTTP 503;
existing login and MFA continue. If email dispatch fails during signup, the pending account
may remain and can request a new link later. There is **no retry loop** for an uncertain send.

Cryptographic keys remain in protected runtime settings and require a planned rotation procedure. Never log or commit secrets, verification links, codes or plaintext passwords.

See [the Mailtrap verification checklist](mailtrap-activation.md) for the exact remaining readiness checks.\n\n## Security boundaries and follow-up

State-changing requests require server-side origin, session and payload checks. Colosseum owner APIs independently enforce authorization before forwarding regulated requests; see [owner authorization](colosseum-owner-auth.md). Sessions use hashed server-side tokens in Secure, HttpOnly, SameSite=Lax `__Host-` cookies; protected dashboard HTML and assets are marked no-store. Cross-origin attempts are rejected. Only the apex Worker has account authority; the `stu` Pages host does not receive the apex-only host cookie or have account-mutating client code. Identity-only Google/GitHub sign-in is separate from Colosseum federated provider credentials; see [federated sign-in](federated-auth.md).

Provider-side sender approval, deliverability tests, security review, password hashing migration to a reviewed memory-hard KDF, and ideally passkeys or phishing-resistant MFA are recommended before storing sensitive financial information. Rate limiting helps reduce automated abuse but is not a replacement for edge-level bot controls or account security monitoring.
