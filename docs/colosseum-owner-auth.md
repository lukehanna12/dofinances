# Colosseum sole-owner authorization

_Architecture reviewed 2026-11-11. This public document omits owner identities, private credential identifiers and live session parameters._

## Two independent authentication requirements

1. A secure Dofinances account session identifies the authenticated user through the server-side account store.
2. The shared owner-restricted Cloudflare Access application validates signed administrative identity assertions for both `/api/colosseum/*` and `/api/cloudflare/*`. Exact identities and credentials remain private.

Both verified identities must match the application's single-owner binding; enrollment is restricted and protected against cross-site requests.

Cloudflare Access protects **both owner API prefixes within a single 30-day Access application**, not all Dofinances pages. The Colosseum and Cloudflare account management APIs retain distinct owner-binding records and permissions. An Access login does not authorize another Dofinances account.

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

The Worker signs and forwards approved internal operations with protected server-side credentials, avoiding an unrestricted public proxy.

## What each control panel actually manages

- **Collections:** live Colosseum collection listing/details and revision-aware collection edits; the interface currently lists ten per page, and the utility-admission button remains disabled.
- **Providers:** federated vault credentials and tool grants, plus independently governed local provider registry profiles and dynamically discovered upstream MCP tools, resources, prompts, skills, and adapters. The Dofinances Worker does not store those provider secrets.
- **Permissions:** effective local filesystem and execution policy obtained from Colosseum's local gateway; changes use an upstream prepare/confirm mechanism and hazard PIN where required. The previous Google Sheets permission manager is retired.
- **Diagnostics:** on-demand status and health queries; no periodic polling is required.

These operational authorities live in Colosseum, not the Dofinances web page. Their upstream service availability must be checked before claiming an action succeeded. Related guides: [architecture](architecture.md), [account security](account-security.md), and [Cloudflare account connection](cloudflare-account-connection.md).

## Verification and safety

For owner access verification, use the protected account management interface. Unauthorized users and invalid identity assertions must be denied.
