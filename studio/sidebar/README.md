# Standalone Studio workspace

This source is the preserved static Liquid Glass sidebar demo formerly served
at the temporary `app-sidebar-preview` Pages branch alias. It is deployed to
`https://stu.dofinances.com/` **and** `/app/` by the production GitHub Actions
workflow. All hash-route views, gallery/monochrome/spectrum backgrounds, and
exact live-backdrop Oracle math remain available.

This site has **no authenticated session or account operations**. Its bootstrap
disables form submits, account buttons, and external links. The real private
workspace stays under `https://dofinances.com/app`.

The preview-specific page, stylesheet, scene-switching script, and bootstrap
are stored here. Shared `dashboard.css`, `workspace-theme.css`, navigation,
finite Oracle field, Worker, and foundation stylesheet are copied from
`sites/_apex` during deployment. There is no runtime/test-branch dependency.

The Vite `dist` artifact is still reserved for the separate apex `/login`
Worker packaging; Pages copies the standalone Studio files over its *own*
deployment copy of `dist`. Do not copy the React Auth-3 bundle or the
protected `dashboard.js` into the public Studio workspace.

The temporary preview's experimental GPU lab, evidence corpus and CI browser
harness are not part of the requested `/app` content.
