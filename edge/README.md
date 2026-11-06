# Git-managed Dofinances website router

All changes to pages declared in `edge/pages.mjs` are published automatically through GitHub Actions after CI passes on `main`. The HTML and content type for each address are versioned in Git.

- Add a key `portfolio.dofinances.com/` to create a hostname homepage.
- Add `portfolio.dofinances.com/briefing/2027` to create a nested page.
- Delete a key, commit and allow CI to finish to remove the page (HTTP 404).
- Query strings are ignored when choosing the page.
- Existing `stu.dofinances.com` stays on Cloudflare Pages; domain payment and email subdomains are excluded.
- Apex/www can be handled by the same router while preserving the original GoDaddy content by default, but only after safe origin proxy verification.

CI/CD publishes `dofinances-host-router` from `edge/wrangler.jsonc` and `dofinances-studio` Pages from the same workflow. The Worker itself does not modify DNS/zone routes.

The `ci-probe` entries are temporary and intended to be removed after live testing. For very large/multi-file websites, migrate page content to Workers Static Assets; the inline registry is intended for small-to-medium standalone HTML pages and is subject to the Workers code bundle size limit.
