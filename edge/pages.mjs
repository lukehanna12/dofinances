// Git-managed pages. Each key is a hostname followed by its URL path.
// Commit additions, changes, or deletions to main; GitHub Actions deploys them.
// Use real content here when ready; the current homepage is only a placeholder.
const home = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Dofinances</title><meta name=\"description\" content=\"Dofinances website\"></head><body style=\"margin:0;background:#f7f9fb;color:#203044;font:16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif\"><main style=\"max-width:760px;margin:14vh auto;padding:0 24px\"><p style=\"letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:#568b84\">Dofinances</p><h1 style=\"font-weight:600;font-size:clamp(2.8rem,7vw,5rem);line-height:1.1;letter-spacing:-.05em\">The site is ready.</h1><p style=\"color:#536777;line-height:1.7;max-width:490px\">This page is managed through GitHub and deployed automatically to Cloudflare. Content can be updated, replaced, or removed through the repository.</p></main></body></html>";
export const pages = Object.freeze({
  "dofinances.com/": {
    type: "text/html; charset=utf-8",
    body: home,
  },
  "preview-dofinances.dofinances.com/": {
    type: "text/html; charset=utf-8",
    body: home,
  },
  "dofinances.com/__site_probe": {
    type: "text/plain; charset=utf-8",
    body: "dofinances-apex-ci-probe",
  },
});
