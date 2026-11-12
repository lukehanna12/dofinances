# Transactional email: public readiness guide

_Configuration inspected 2026-11-11. No private credential names, token identifiers, account information, or owner-specific authentication settings are published here._

## Current readiness

The production Worker integrates with a transactional email service through protected server-side credentials. Provider-issued sending/tracking/DKIM DNS records exist, while inbound mail routing is maintained separately.

**Configuration is not proof of delivery.** This review did not establish the sending provider's account approval, transactional API acceptance or actual delivery to a mailbox. Email-dependent registration and recovery fail closed when sending is unavailable.

## Controlled verification checklist

1. In the provider's authenticated dashboard, verify the sending domain, transactional stream, sending permissions, account quotas and approval status.
2. Verify server-side credentials without publishing their values or identifiers. Use the protected Cloudflare runtime settings for configuration and rotation.
3. Inspect the application's readiness signal, remembering it confirms local configuration rather than upstream acceptance or inbox placement.
4. Use only owned test accounts and inboxes to validate one-time verification, password recovery, session invalidation, expiration, and expected failure behavior.
5. If DNS correction is necessary, use only provider-issued values. Preserve existing inbound MX, DKIM, SPF and DMARC settings. Avoid publishing duplicate SPF records.

## Safety and operational boundaries

- Sending failure must not be reported as successful message delivery. An unverified pending registration may require a new verification request.
- Do not retry an uncertain send in an uncontrolled loop.
- Provider quotas and plan allowances must be verified against the current account.
- Never expose credentials, recovery links, personal email addresses, encryption keys, or account identifiers through public GitHub files, CI logs or static assets.

See [account security](account-security.md), [DNS configuration](domain-setup.md), and [current architecture](architecture.md).
