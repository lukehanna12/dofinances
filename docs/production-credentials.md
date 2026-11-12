# Production deployment credentials

_Public-safe deployment guidance, checked 2026-11-11. Never publish personal identifiers, account IDs, token values, token identifiers or private authentication configuration in this repository._

## CI/CD credentials

GitHub Actions uses protected repository/environment credentials to deploy the site through Wrangler to Cloudflare Workers and Pages. The deployment workflow builds and tests changes, publishes when its production gate is enabled, and validates the live sites. Pull requests do not deploy to production.

See [the source workflow](../.github/workflows/site.yml) for the executable configuration. Review protected GitHub and Cloudflare settings—not public documentation—for account details, actual credential names, scopes, values, and rotation procedures. Apply least privilege and test both deployment targets after credential changes.

## Runtime credentials

Application authentication, outbound email, internal-service authorization, and account connections use separate server-side credentials. No secret values, owner identities or confidential account configuration should appear in committed files, workflow logs, artifacts or static assets.

DNS records and Worker routes persist separately from CI/CD deployments. The build does not rely on Tailscale Funnel, Workers Builds, local Mac access, D1 or R2. The repository's `main` branch was not branch-protected at the time of the review.

See [architecture](architecture.md), [DNS and routing](domain-setup.md), and [account security](account-security.md).
