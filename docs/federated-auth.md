# Federated sign-in and linked identities (Dofinances)

_Current first-party identity implementation verified from `edge/auth-federation*.mjs` and the Worker bindings on 2026-11-11._

Dofinances supports first-party email/password accounts and identity-only OAuth/OpenID Connect for Google and GitHub. This feature does **not** grant access to Gmail or private GitHub repositories. OAuth access tokens are used only to obtain verified identity; they are not stored. All accounts and identity relationships live in the existing AuthStore SQLite Durable Object (not D1).

## Status and provider registrations

A button appears enabled only when its complete OAuth client configuration is present in the deployed **dofinances-host-router Worker**. OAuth provider configuration is managed privately; the presence of configured credentials alone does not establish successful interactive sign-in. The code cannot create third-party OAuth application registrations on a provider's behalf.

| Provider | Client registration | Required Worker secrets | Exact callback |
| --- | --- | --- | --- |
| Google | Google Cloud Console → OAuth client (web application), configure OAuth consent screen | protected provider configuration and protected provider configuration | https://dofinances.com/api/auth/oauth/callback/google |
| GitHub | GitHub Developer Settings → OAuth Apps → New OAuth App, with Homepage https://dofinances.com | protected provider configuration and protected provider configuration | https://dofinances.com/api/auth/oauth/callback/github |

Use Cloudflare **Settings → Variables and Secrets** to save client credentials. Do not commit secrets to GitHub. For Google/GitHub, request only identity scopes: Google openid/profile/email, GitHub read:user/user:email. If GitHub supplies no verified email, linking to an authenticated Dofinances account is possible but creating a new account is rejected until a verified email is available.


## Account policy

- Linked account limits: **five Google**, **three GitHub** identities per Dofinances user.
- An external (provider, issuer, subject) identity is **unique across all Dofinances users**. Linking to another owner is denied.
- Matching email addresses do **not** automatically merge users. A person with an existing email/password account must sign in with it before explicitly linking any provider.
- The last linked provider cannot be removed from an account without an email/password method. An email/password account may unlink all providers.
- The provider's immutable account ID, not display name or email, identifies the link. Each external OAuth authorization must complete a new state-bound transaction; linking is bound to an already authenticated Dofinances session.
- Provider-only accounts receive a random unusable password hash for compatibility with the existing SQLite schema, plus an authoritative has_password=0 record. A verified provider email allows an immediate session. If an identity provider reports an unverified email, account creation requires a one-time Dofinances email verification before sign-in.
- To add a password to a provider-only account, use the normal password-recovery email flow, which sets has_password=1 after successful verification and reset.
- MFA remains enforced on federated sign-in for accounts where MFA has been enabled. For provider-only accounts, set a password using password recovery before enabling password-protected MFA setup.
- Unlinking a provider revokes all active Dofinances sessions for the user. Reauthenticate using a remaining method.
- Provider-only accounts must first establish a password through email recovery before using the existing account-deletion UI, which is password-confirmed.

## Security boundaries and deployment

The Worker creates a short-lived, state-bound OAuth transaction with PKCE and nonce validation where applicable, using server-side storage and secure cookies. Callback consumes the state atomically; linking also checks the original logged-in session. Verified identity claims are checked before local account lookup. First-party sessions are still issued by the existing session system.

OAuth code exchanges and JWKS fetches use fixed upstream HTTPS URLs, with no arbitrary callback or URL forwarding. This identity-only feature does not add Workers, open ports, or D1/R2 resources; it adds Google/GitHub login methods to the existing account authority. Existing email/password, MFA, verified email, session-cookie, and account-deletion behavior remain in place.

After installing OAuth credentials, reload https://dofinances.com/api/auth/config. Check the boolean enabled flags under federation. Perform actual interactive sign-in, link and unlink tests with disposable provider accounts before offering the feature broadly.

## Distinction from Colosseum federated providers

**These OAuth integrations are for signing in to Dofinances**, not authorizing the separate Colosseum MCP providers. Dofinances keeps the linked Google/GitHub identity and ephemeral OAuth transaction in its SQLite `AuthStore`, but does not retain their OAuth access/refresh tokens. The Colosseum Providers screen instead manages a separate upstream credential vault, local-provider contracts and MCP invocation grants through `/api/colosseum/providers`; none of those provider secrets belong in this first-party identity table. See [Colosseum owner access](colosseum-owner-auth.md) and [current architecture](architecture.md).
