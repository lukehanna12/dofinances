# Git-controlled wildcard page registry

The deployed Worker at `edge/worker.mjs` serves HTML defined in [`pages.mjs`](pages.mjs). It is automatically redeployed on every successful push to `main`, through GitHub Actions.

Example of a new entry (inside `Object.freeze({...})`):

```js
"portfolio.dofinances.com/about": {
  type: "text/html; charset=utf-8",
  body: "<!doctype html><html><body><h1>About</h1></body></html>",
},
```

The public address is `https://portfolio.dofinances.com/about`. Remove the entry and commit to delete the page; all unconfigured wildcard paths return 404. Query strings are ignored when matching pathnames. First-level subdomain names are the supported target; deeper subdomains need separate TLS coverage. This inline HTML approach is appropriate for simple pages, not a large React or asset library.

**Do not route apex or www through this Worker.** Their live GoDaddy Website Builder origin returned 522 during a pass-through test. The Worker deliberately fails closed for both hosts, and Cloudflare DNS keeps them DNS-only. `stu.dofinances.com` is served separately by Cloudflare Pages, with its own GitHub Actions deployment. Other reserved DNS service hostnames are excluded.

Wildcard DNS and the Cloudflare Worker route are persistent production infrastructure; temporary CI hostname pages were removed after verification.
