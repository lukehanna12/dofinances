# Production GitHub Actions credentials

The existing `dofinances-github-actions` token was upgraded by the owner. Its secret is stored in GitHub as `CLOUDFLARE_API_TOKEN` with Cloudflare Pages Edit and Workers Admin permission, limited to the account holding `dofinances-studio`. The repository variable `DEPLOY_ENABLED=true` gates both production deployments.

The GitHub Actions workflow at [`site.yml`](../.github/workflows/site.yml) runs tests/builds then deploys studio Pages and the wildcard Worker automatically on pushes to `main`. It may be run manually with **Run workflow**. DNS and Worker routes are configured separately; CI/CD does not modify DNS.

The token can be narrowed to Workers Editor for an existing Worker after initial creation. A per-Worker-scoped token is preferable, with a separate Pages token if separating permissions later. Do not paste or commit token values in this public repository.

The existing apex/www site is managed in GoDaddy Website Builder; that application's content is not part of the current GitHub deployment pipeline.

See https://developers.cloudflare.com/workers/authorization/workers/ for current roles.
