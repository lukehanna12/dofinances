# Optional wildcard hostname router

Pages does **not** support `*.dofinances.com` custom domains. The simple Worker in this directory can proxy arbitrary first-level subdomains (and paths) to the existing Pages application `dofinances-studio.pages.dev`.

The Worker is *not* currently connected to any production hostname. Its `wrangler.jsonc` deliberately has **no routes** and disables `workers.dev`.

To activate after DNS cutover, a separate scoped Worker deploy token and `WILDCARD_DEPLOY_ENABLED=true` repository variable are required, and a **separate explicit Cloudflare change** must register the `*.dofinances.com/*` Worker route and ensure wildcard proxied DNS and certificates are working.

For existing `stu.dofinances.com`, `www` and other independently hosted subdomains, use a more-specific route exception or explicit routing strategy before adding the broad wildcard route. Avoid swallowing existing API, mail or application hosts.

No storage, R2, D1, browser automation or local artifacts are required by this router. Each proxied HTTP request consumes a Cloudflare Worker invocation and a subrequest.

Tests: `npm run check`. Its host restrictions prevent proxying other domains.
