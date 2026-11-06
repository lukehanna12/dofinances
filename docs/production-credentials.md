# Production deployment credentials

The repository is public. Never commit or paste API tokens or credentials into source, issue text or chat.

The existing `dofinances-github-actions` Cloudflare API token is stored as GitHub Actions secret `CLOUDFLARE_API_TOKEN`. It currently has the Pages and Workers permissions required for the initial rollout, scoped to account `7d0d4c74836717a4d23784bbf8d5ccd7`.

Repository variable `DEPLOY_ENABLED=true` enables automatic deployment from `main`. GitHub Actions [`site.yml`](../.github/workflows/site.yml) runs checks and builds on pull requests, then for successful pushes to `main` deploys:

1. React studio to the existing Pages project `dofinances-studio`.
2. `dofinances-host-router` and all tracked static files under `sites/` to Cloudflare Workers.

The Worker stage uses `CLOUDFLARE_WORKERS_API_TOKEN` only if separately configured; otherwise it uses the existing `CLOUDFLARE_API_TOKEN`. No additional secret is required for the current setup. The previous Cloudflare Pages-only permission failure was resolved by upgrading the existing token.

The token can now be narrowed from Workers product Admin to Workers Editor, because `dofinances-host-router` has been created. An individual-Worker Editor token together with a separate Pages Edit token is an optional tighter least-privilege configuration, not a prerequisite for CI/CD.

DNS records and Worker route bindings are already deployed and persist independently of the GitHub build. The repository deployment does not require DNS write privileges, D1, R2, local Mac files, or Cloudflare browser-run.

[GitHub Actions runs](https://github.com/lukehanna12/dofinances/actions) | [Cloudflare Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/)
