# Production deployment credentials

_Workflow and Cloudflare bindings checked on 2026-11-11. This guide documents secret **names and boundaries**, not secret values._

The repository is public. Never commit or paste API tokens or credentials into source, issue text or chat.

The workflow consumes the GitHub Actions secret `CLOUDFLARE_API_TOKEN` for Pages and, when `CLOUDFLARE_WORKERS_API_TOKEN` is not set, for Worker deployments. The Cloudflare account is `7d0d4c74836717a4d23784bbf8d5ccd7`. Recent successful deployment jobs demonstrate that valid deployment credentials were available to those jobs; **the secret values and their exact Cloudflare scope are not inspectable from repository source**.

Repository variable `DEPLOY_ENABLED=true` enables automatic deployment from `main`. GitHub Actions [`site.yml`](../.github/workflows/site.yml) runs checks and builds on pull requests, then for successful pushes to `main` deploys:

1. Build `src/` as the React Auth-3 sign-in page, and package that artifact into the apex Worker at `/login`.
2. Package `studio/sidebar/` and selected shared workspace assets into the separate Pages project `dofinances-studio` (`stu.dofinances.com`).
3. Publish `dofinances-host-router` and the `sites/` static assets to Workers using `edge/wrangler.jsonc`.
4. Run production smoke checks, including HTTPS hosts, live account route boundaries, wallpaper assets, and headless Chrome sidebar behavior.

The Worker stage uses `CLOUDFLARE_WORKERS_API_TOKEN` only if separately configured; otherwise it uses `CLOUDFLARE_API_TOKEN`. Both deployment jobs target the `cloudflare-production` GitHub environment. `DEPLOY_ENABLED` is the repository variable that gates publishing; PRs test/build but do not deploy to production.

When rotating or narrowing token scope, validate both Pages deployment and Workers deployment capabilities before replacing the secret. An individual Worker-scoped Editor credential plus a separate Pages Edit credential may offer stronger least privilege, but do not assume that the current token can be modified without testing the full workflow.

DNS records and Worker route bindings are already deployed and persist independently of the GitHub build. `main` is currently **not branch-protected**; write access can move it without a pull-request review, and the workflow deploys automatically if its gate is enabled. The repository deployment does not require DNS write privileges, D1, R2, local Mac files, or Cloudflare browser-run.

[GitHub Actions runs](https://github.com/lukehanna12/dofinances/actions) | [Cloudflare Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/)

## Runtime secrets are a separate boundary

The deployed Worker has secret bindings for `MAILTRAP_API_TOKEN`, `MFA_ENCRYPTION_KEY`, `COLOSSEUM_ADMIN_CALL_SECRET`, `COLOSSEUM_OWNER_ACCESS_EMAIL`, and the Google/GitHub OAuth client secrets. OAuth client IDs and Access audience/issuer settings are non-secret configuration. The Worker also has service bindings to `router` (Colosseum) and `library-iii`, and the `AUTH_STORE` SQLite Durable Object. **Do not put runtime secrets into the GitHub repository, Pages static assets, logs, or documentation.** Neither the deploy workflow nor this repository provisions/controls the separate Colosseum vault itself.

See [architecture](architecture.md), [DNS and routing](domain-setup.md), and [account security](account-security.md).
