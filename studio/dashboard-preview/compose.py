#!/usr/bin/env python3
"""Build only the static, isolated Dashboard home from the Studio-safe shell."""
from pathlib import Path

html = Path("studio/sidebar/index.html").read_text(encoding="utf-8")
home = Path("studio/dashboard-preview/home.html").read_text(encoding="utf-8").strip()
start_tag = '        <section class="view" data-view="home"'
end_tag = '        <section class="view" data-view="projects"'
assert html.count(start_tag) == 1 and html.count(end_tag) == 1
start = html.index(start_tag)
end = html.index(end_tag, start)
html = html[:start] + "        " + home + "\n" + html[end:]
old_title = "<title>Studio · DoFinances</title>"
old_bootstrap = "/app/assets/preview-bootstrap.js"
assert html.count(old_title) == 1 and html.count(old_bootstrap) == 1
html = html.replace(old_title, "<title>Dashboard Preview · DoFinances</title>")
html = html.replace(old_bootstrap, "/app/assets/dashboard-preview.js")
html = html.replace("</head>", """  <link rel="stylesheet" href="/app/assets/dashboard-home.css">
  <script type="module" src="/app/assets/dashboard-mosaic.js"></script>
</head>""", 1)
assert "Your workspace, all in one place." not in html
assert "A home for your projects and account." not in html
assert html.count('id="home-title"') == 1
assert html.count('id="cta6-mosaic"') == 1
assert html.count('id="workspace-sidebar"') == 1
assert 'id="sidebar-resize-handle"' in html
out = Path("dist/index.html")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
