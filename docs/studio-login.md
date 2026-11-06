# Auth-3 for Studio

The user-approved Auth-3 reconstruction is deployed on the independently hosted Cloudflare Pages Studio project at both:
- `https://stu.dofinances.com/`
- `https://stu.dofinances.com/login/`

`src/components/Auth3.jsx` is the single React implementation. `src/styles.css` contains the scoped original CSS; root `index.html` and `login/index.html` are separate Vite HTML entrypoints built into `dist/index.html` and `dist/login/index.html`. This avoids routing fallbacks, custom Worker routes, and GoDaddy's apex hosting.

The icons, responsive layout, background photograph URL, card dimensions, and CSS entrance animations are preserved from the recovered Auth-3 UI. The right caption identifies Dofinances rather than React Bits Pro.

**Important:** This is a visual login preview only. No backend authentication is connected, and the email and identity-provider buttons do not submit data. The email field is cleared on preview continuation. Security and real authentication must be designed separately.

The existing studio landing page is replaced by this reconstruction, as requested. The apex domain, its existing Worker static assets and routes, GoDaddy settings and DNS records remain unchanged.

The GitHub Actions build verifies both HTML outputs. The deployment smoke job fetches both Studio URLs and validates that they contain the new page marker.
