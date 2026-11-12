# Cloudflare account connection — DoFinances Settings

_Architecture reviewed 2026-11-11. Public documentation omits private owner identifiers, account IDs, token identifiers, signing secrets and live session durations._

The main Settings page at https://dofinances.com/app/settings manages a durable, user-owned Cloudflare API connection, independently of Colosseum administrator enrollment.

## Security

- Cloudflare Access protects a restricted management route family and verifies signed identity assertions.
- The DoFinances Worker additionally requires its Secure, HttpOnly account session and permanently binds the single Cloudflare owner identity to one immutable DoFinances user ID. Cloudflare account ownership is independent of all project-specific owner records.
- An entered Cloudflare *user API token* is verified using /user/tokens/verify and /user. The token requires User Details Read so its owner can be verified against the server's configured Cloudflare owner email.
- The connected API credential is encrypted in server-side storage and never returned in plaintext.
- Every API request requires both signed-in identities; the request is forwarded exclusively to https://api.cloudflare.com/client/v4 after policy checks.
- The permission record and stored API token persist across sessions and deployments until disconnected, revoked, or expired. **Neither the Cloudflare Access session nor the DoFinances login session lasts permanently**, and that is intentional.

## To connect

1. Log in to DoFinances. Open Settings → Cloudflare → Authenticate with Cloudflare and complete owner verification.
2. Create a *user* API token in the Cloudflare dashboard with User Details Read and the relevant account, zone or user permissions; omit an expiration if a long-lived token is appropriate and Cloudflare offers it.
3. Paste it once in Settings. Choose the initial effective policy: Read-only or Full operations; account and zone allowlists (an asterisk means all resources permitted by the token, or specify 32-character IDs); and user-level API permission.
4. Save the scope to narrow or broaden DoFinances' effective access without reissuing the token. The actual permissions are always the intersection of this policy and Cloudflare's own token privileges.
5. Replace the token or Remove connection from Settings. Removal clears the encrypted credential in DoFinances; revoke the issued token separately in Cloudflare if it must be invalidated everywhere.

The integrated JSON API console is for specific Cloudflare API requests. Non-JSON and oversized responses are not supported. User API tokens do not necessarily support every Cloudflare endpoint, even when Full is selected.

## Deployment

The Cloudflare account connection is protected by an independent, owner-restricted Access application. Its policy, identity, credential identifiers and live session limits are maintained in protected Cloudflare settings.

Automated tests cover encryption, path and scope denial, verification, owner route checks, and static UI wiring. End-to-end authentication and token provisioning require the owner's browser login and user-issued token.

## Two distinct connections (important)

Cloudflare Access authentication confirms the owner's identity for a short session. It does **not** mint, expose, or grant a Cloudflare management API token. Settings shows "Identity verified · token required" until the owner creates a user API token and connects it in the second step. The effective Cloudflare management connection is marked "API connected" only after the token passes Cloudflare verification and its encrypted record is saved. The account owner can then update its effective scope or disconnect it from Settings. Cloudflare API token issuance is an explicit owner action in the Cloudflare dashboard; self-hosted Access sign-in cannot silently authorize it.

## Session lifecycle

The Access session and Dofinances login expire according to independent protected policies. A saved API credential may persist until revoked, disconnected or expired. Consult protected account settings for exact lifetimes.

## Runtime authority and operational boundaries

The Worker implements authenticated connection, scope and request management without exposing credential material to the browser.

The stored token/connection is separate from Colosseum provider OAuth credentials or local-provider grants. Website source is deployed through GitHub Actions and Wrangler; neither a GitHub commit nor an Access login issues or rotates a user API token. See [current architecture](architecture.md) and [Colosseum owner authorization](colosseum-owner-auth.md).
