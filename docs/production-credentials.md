# Production credentials (GitHub Actions)

The repository is public. **Never commit or paste API tokens, passwords, private keys, GitHub Actions secret values, or GoDaddy credentials in code or chat.**

## Enable the existing Pages project

1. Open [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) and create a *Custom Token* called `dofinances-github-actions`.
2. Give it **Account → Cloudflare Pages → Edit** (shown as Pages Write in some UI variants). Limit the account resources to the Cloudflare account `7d0d4c74836717a4d23784bbf8d5ccd7`. Do **not** grant DNS/D1/R2/Workers permissions to this routine deployment token.
3. In [GitHub Actions secrets](https://github.com/lukehanna12/dofinances/settings/secrets/actions), create a repository secret named exactly `CLOUDFLARE_API_TOKEN`, with the token value.
4. Under the [GitHub Actions variables](https://github.com/lukehanna12/dofinances/settings/variables/actions), create repository variable `DEPLOY_ENABLED` = `true`. The workflow is fail-closed until this variable is set. The Cloudflare account ID is already stored in the workflow (not a secret).
5. From [GitHub Actions](https://github.com/lukehanna12/dofinances/actions), run **Build and deploy Dofinances → Run workflow → main**, or push a commit. Check the `Test and build` and `Deploy to Cloudflare Pages` jobs. Verify `https://dofinances-studio.pages.dev` and the intended `stu.dofinances.com` before changing DNS.

The GitHub environment `cloudflare-production` exists. Add required reviewers there if desired.

## Future wildcard Worker (optional; separate credential)

To enable later, make a **different** Cloudflare API token scoped to Workers script deployments, stored as GitHub secret `CLOUDFLARE_WORKERS_API_TOKEN`. If creating the Worker is necessary, the token requires Workers product-level Admin; after creation, use the least-privilege per-Worker Editor role where possible. Do not reuse the Pages token for this.

Only after the DNS/SSL migration is verified, set `WILDCARD_DEPLOY_ENABLED` = `true`. The Worker deployment still does **not** activate domain routing: the wildcard DNS record and routes are separate, deliberate Cloudflare zone changes.

If you use a deployment agent for DNS or routing changes, grant that agent narrowly scoped zone permissions separate from the GitHub Actions credentials.

## Troubleshooting

- **Production job skipped**: `DEPLOY_ENABLED` is missing or not `true`.
- **403 from Wrangler**: token lacks Pages Write access to the relevant account, or is expired.
- **Target not found**: verify Pages project `dofinances-studio` in the connected Cloudflare account.
- **Build fails**: inspect GitHub Actions run logs and dependencies; build artifacts are remote.
- **Hostname not working**: custom domain, GoDaddy/Cloudflare authoritative DNS, SSL certificate, and deployed Pages content are separate checks.

Official docs: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
