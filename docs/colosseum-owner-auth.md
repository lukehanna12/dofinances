# Colosseum sole-owner authorization

_Current implementation as inspected on 2026-11-11. Source: `edge/router.mjs`, `edge/colosseum-owner.mjs`, `edge/auth-store-secure.mjs`, `edge/wrangler.jsonc`._

## Two independent authentication requirements

1. The Dofinances `__Host-dofinances_session` Secure, HttpOnly cookie resolves to an immutable user ID through the SQLite-backed `AUTH_STORE` Durable Object.
2. A separate Cloudflare Access self-hosted application protects `https://dofinances.com/api/colosseum/*`. Its owner-only policy has an **8-hour Access session**. The Worker validates the `Cf-Access-Jwt-Assertion` RS256 signature, trusted issuer, `COLOSSEUM_ACCESS_AUD`, validity window (JWT lifetime capped at 24 hours in this verifier), and the server-side `COLOSSEUM_OWNER_ACCESS_EMAIL` secret.

Both identities must agree with the singleton `colosseum_owner` row (`user_id` and Access `access_subject`). `INSERT OR IGNORE` prevents a second Dofinances user from claiming the same project administrator. Owner enrollment uses `GET/POST /api/colosseum/connect`; status is `GET /api/colosseum/status`. The browser initiates enrollment through the authenticated Settings experience, and any binding POST requires the exact `https://dofinances.com` Origin.

Cloudflare Access protects **only the Colosseum management API prefix**, not all Dofinances pages and not the separate Cloudflare account connection under `/api/cloudflare/*`. An Access login does not authorize a second Dofinances account.

## Implemented management endpoints

| Endpoint | Methods | Signed Colosseum operation |
| --- | --- | --- |
| `/api/colosseum/status` | GET | Local owner-binding status (no router operation) |
| `/api/colosseum/connect` | GET, POST | Owner enrollment/status (no router operation) |
| `/api/colosseum/collections` | GET, POST | `collection.manage`; GET becomes an upstream `list` action |
| `/api/colosseum/permissions` | GET, POST | `permissions.manage`; GET becomes upstream `status` |
| `/api/colosseum/providers` | GET, POST | `provider.admin`; GET becomes upstream `list` |
| `/api/colosseum/providers/callback` | GET | Validated upstream provider OAuth completion through `provider.admin` |
| `/api/colosseum/catalog/add`, `update`, `remove` | POST | `catalog.add`, `catalog.update`, `catalog.remove` |
| `/api/colosseum/diagnostics` | POST | `system.status` (read-only, allowlisted checks and sections) |

All operations first pass Dofinances session, Cloudflare Access, and owner-record checks. POST requests require the canonical Origin; provider, collection and permission writes additionally reject cross-site fetch metadata. The backend validates method, JSON content type, payload size, and permitted operation names. Only the allowlisted forwarding operations are exposed; arbitrary Colosseum router calls cannot be submitted.

The Worker serializes the permitted operation and arguments, then signs timestamp, nonce and payload digest with `COLOSSEUM_ADMIN_CALL_SECRET` (HMAC-SHA256). It forwards via the **`COLOSSEUM_ROUTER` service binding** to the Colosseum internal catalog endpoint, not a public untrusted network proxy. The recipient is responsible for enforcing its own authorization, revisions, and approval receipts. Do not confuse UI availability with backend permission grants.

## What each control panel actually manages

- **Collections:** live Colosseum collection listing/details and revision-aware collection edits; the interface currently lists ten per page, and the utility-admission button remains disabled.
- **Providers:** federated vault credentials and tool grants, plus independently governed local provider registry profiles and dynamically discovered upstream MCP tools, resources, prompts, skills, and adapters. The Dofinances Worker does not store those provider secrets.
- **Permissions:** effective local filesystem and execution policy obtained from Colosseum's local gateway; changes use an upstream prepare/confirm mechanism and hazard PIN where required. The previous Google Sheets permission manager is retired.
- **Diagnostics:** on-demand status and health queries; no periodic polling is required.

These operational authorities live in Colosseum, not the Dofinances web page. Their upstream service availability must be checked before claiming an action succeeded. Related guides: [architecture](architecture.md), [account security](account-security.md), and [Cloudflare account connection](cloudflare-account-connection.md).

## Verification and safety

For owner setup, sign in to Dofinances, complete the owner-only Cloudflare Access step, enroll through `/api/colosseum/connect`, and check `/api/colosseum/status`. An authorized bound owner receives `{"authenticated":true,"owner":true,"linked":true}`. Ordinary users and missing/invalid Access assertions must be denied. The CI suite checks route boundaries, forwarding restrictions, and interface wiring with mocks, but live management writes still require controlled end-to-end checks. Keep `COLOSSEUM_ADMIN_CALL_SECRET` and owner email secrets out of Git.
