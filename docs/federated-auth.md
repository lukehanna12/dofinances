# Federated sign-in and linked identities (Dofinances)

Dofinances supports first-party email/password accounts and identity-only OAuth/OpenID Connect for Google and GitHub. This feature does **not** grant access to Gmail or private GitHub repositories. OAuth access tokens are used only to obtain verified identity; they are not stored. All accounts and identity relationships live in the existing AuthStore SQLite Durable Object (not D1).

## Status and provider registrations

A button appears enabled only when its complete OAuth client configuration is present in the deployed **dofinances-host-router Worker**. Until then, sign-in with that provider remains disabled. The code and deployment cannot create third-party provider registrations without their owners.

| Provider | Client registration | Required Worker secrets | Exact callback |
| --- | --- | --- | --- |
| Google | Google Cloud Console → OAuth client (web application), configure OAuth consent screen | GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET | https://dofinances.com/api/auth/oauth/callback/google |
| GitHub | GitHub Developer Settings → OAuth Apps → New OAuth App, with Homepage https://dofinances.com | GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET | https://dofinances.com/api/auth/oauth/callback/github |

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

The Worker creates a 10-minute OAuth transaction with random state, PKCE S256 verifier and nonce (OIDC), stores it in the existing SQLite Durable Object, and sets a short-lived __Host- HttpOnly Secure SameSite=Lax cookie. Callback consumes the state atomically; linking also checks the original logged-in session. Verified identity claims are checked before local account lookup. First-party sessions are still issued by the existing session system.

OAuth code exchanges and JWKS fetches use fixed upstream HTTPS URLs, with no arbitrary callback or URL forwarding. The new feature does not add Workers, open ports, D1/R2 resources, or a new authentication provider. Existing email/password, MFA, verified email, session-cookie, and account-deletion behavior remain in place.

After installing OAuth credentials, reload https://dofinances.com/api/auth/config. Check the boolean enabled flags under federation. Perform actual interactive sign-in, link and unlink tests with disposable provider accounts before offering the feature broadly.
