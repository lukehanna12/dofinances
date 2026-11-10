# Colosseum sole-owner authorization

The live DoFinances control-plane foundation uses two independently validated identities:

1. The existing Secure, HttpOnly DoFinances session cookie resolves to an immutable user ID in the existing `AUTH_STORE` SQLite Durable Object.
2. Cloudflare Access protects only `https://dofinances.com/api/colosseum/*`, with an Allow policy for the Cloudflare account owner's exact verified address. The app has an 8-hour Access session. The Worker verifies the Access RS256 JWT via the pinned `COLOSSEUM_ACCESS_ISSUER`, app `COLOSSEUM_ACCESS_AUD`, Cloudflare signing JWKS, expiration, and secret `COLOSSEUM_OWNER_ACCESS_EMAIL`.

After both identities pass, Settings → **Connect Cloudflare** launches a Cloudflare Access login (if needed), and displays an explicit confirmation form. POST must originate on `https://dofinances.com`. The single `colosseum_owner` row is inserted with `INSERT OR IGNORE`: one immutable DoFinances user ID plus one Access user subject. No other registered user can claim ownership.

Read-only status: `GET /api/colosseum/status` (also dual-authenticated); connection: `GET/POST /api/colosseum/connect`. Administrative catalog and asset mutation routes are intentionally absent until implemented with their own owner checks and approval/audit controls. The public site login/signup, routes, navigation, and Colosseum catalog infrastructure are not changed.

Cloudflare Access is scoped to the management API path, **not** the entire `dofinances.com` domain or all DoFinances sessions. The owner email must be saved as a Cloudflare Worker secret, never as GitHub source. The issuer and audience are public identifiers.

To test or troubleshoot, sign in to DoFinances, open Settings → Connect Cloudflare, complete the owner Access sign-in and confirmation, then visit `/api/colosseum/status`. It should return `{"authenticated":true,"owner":true,"linked":true}`. An ordinary DoFinances user must be denied by Access regardless of site registration. Backend mutation endpoints must *not* rely on hiding UI screens.
