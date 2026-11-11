# Cloudflare account connection — DoFinances Settings

The main Settings page at https://dofinances.com/app/settings manages a durable, user-owned Cloudflare API connection, independently of Colosseum administrator enrollment.

## Security

- Cloudflare Access protects only /api/cloudflare/* with a separate self-hosted application, an allow policy for the verified Cloudflare owner, and expiring signed Access JWTs.
- The DoFinances Worker additionally requires its Secure, HttpOnly account session and permanently binds the single Cloudflare owner identity to one immutable DoFinances user ID. Cloudflare account ownership is independent of all project-specific owner records.
- An entered Cloudflare *user API token* is verified using /user/tokens/verify and /user. The token requires User Details Read so its owner can be verified against the server's configured Cloudflare owner email.
- The token is encrypted with AES-256-GCM in the existing SQLite Durable Object. The existing MFA_ENCRYPTION_KEY is reused with a distinct authenticated-data context bound to the DoFinances user ID. The plaintext token is never returned to Settings.
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

Cloudflare Access application: DoFinances Cloudflare account access, path dofinances.com/api/cloudflare/*, 8-hour session, exact owner email allow policy. The audience is set in edge/wrangler.jsonc as CLOUDFLARE_CONNECTION_ACCESS_AUD. The independent owner email may be stored as CLOUDFLARE_OWNER_ACCESS_EMAIL; until configured, the existing verified-owner email secret COLOSSEUM_OWNER_ACCESS_EMAIL is used. Preserve the Access issuer and MFA_ENCRYPTION_KEY. Do not place API tokens in GitHub.

Automated tests cover encryption, path and scope denial, verification, owner route checks, and static UI wiring. End-to-end authentication and token provisioning require the owner's browser login and user-issued token.

## Two distinct connections (important)

Cloudflare Access authentication confirms the owner's identity for a short session. It does **not** mint, expose, or grant a Cloudflare management API token. Settings shows "Identity verified · token required" until the owner creates a user API token and connects it in the second step. The effective Cloudflare management connection is marked "API connected" only after the token passes Cloudflare verification and its encrypted record is saved. The account owner can then update its effective scope or disconnect it from Settings. Cloudflare API token issuance is an explicit owner action in the Cloudflare dashboard; self-hosted Access sign-in cannot silently authorize it.

## Cloudflare Access session duration

This dedicated Cloudflare account Access application is configured for `30d` (30 days), the longest supported month-scale session setting, rather than `8h`. Its owner JWT verification explicitly accepts a token lifetime up to 30 days; the project-specific Colosseum JWT verification retains its original 24-hour maximum. Cloudflare may require reauthentication after 30 days, on revocation, or sooner if a stricter policy/client session or identity-provider setting applies. The Cloudflare API token stored in the DoFinances Durable Object continues to persist independently of Access browser session expiry. DoFinances account login sessions are separately managed.
