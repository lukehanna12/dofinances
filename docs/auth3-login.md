# Dofinances login design reconstruction

The static `https://dofinances.com/login` page lives at `sites/_apex/login/index.html`, with isolated CSS and JavaScript in `sites/_apex/login/assets/`. It is delivered by the existing host router's Workers Static Assets binding. `www.dofinances.com/login` follows the router's existing apex redirect. Studio and all other hosts are unchanged.

## Provenance and fidelity

The visual is adapted from the user's Auth-3 reconstruction, recovered from a Chrome/V8 heap snapshot of a React Bits Pro Webpack module (chunk `32629, 55010, 70034`, module `55010`). Card proportions, form fields, SVG icons, spacing, background-image URL, responsive layout, and entrance-animation values are preserved. The right-hand text is deliberately rebranded to Dofinances. This is a standalone HTML/CSS/JavaScript implementation requiring no React, Motion, Tailwind, or runtime CDN.

The external Unsplash background image URL was recovered exactly, but the photograph was not included in the heap snapshot. The CSS falls back to a neutral background if the external image is unavailable.

## Security and behavior

**This page is a design preview, not an authentication system.** No identity provider or email authentication endpoint has been configured. There is no form submission, no password field, and no credential collection, storage, logging or transmission. Buttons display an accessible explanatory notice. Sign-in must remain explicitly labeled as unavailable until an independently reviewed authentication backend is integrated. CSP restricts scripts and styles to this site's own assets and disallows network connections and form actions. The image is loaded from Unsplash.

## Deployment

Commit to `main` to trigger `.github/workflows/site.yml`. When `DEPLOY_ENABLED=true`, GitHub Actions builds, tests, and deploys the existing host router. No Cloudflare D1, Tailscale Funnel, R2, or new Worker is used for this page.
