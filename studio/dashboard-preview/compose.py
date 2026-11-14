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
  <script type="module" src="/app/assets/dashboard-gpu-renderer.js"></script>
</head>""", 1)
assert "Your workspace, all in one place." not in html
assert "A home for your projects and account." not in html
assert html.count('id="home-title"') == 1
assert html.count('id="cta6-mosaic"') == 1
assert html.count('id="workspace-sidebar"') == 1
assert 'id="sidebar-resize-handle"' in html
# This isolated preview no longer has sidebar navigation. Strip the actual
# sidebar, drag handle and drawer scrim from the composed output (not production
# sources), rather than hiding a live, expensive oracle sidebar off-screen.
sidebar_start = '    <aside class="sidebar" id="workspace-sidebar"'
main_start = '    <div class="main">'
assert html.count(sidebar_start) == 1 and html.count(main_start) == 1
start = html.index(sidebar_start)
end = html.index(main_start,start)
removed_sidebar = html[start:end]
assert '</aside>' in removed_sidebar
assert 'id="sidebar-resize-handle"' in removed_sidebar
assert 'id="sidebar-scrim"' in removed_sidebar
html = html[:start] + html[end:]
# Only this isolated static preview drops the lower breadcrumb header.
# The upper global navigation stays intact and owns its 44px strip.
h_start = '      <header class="topbar">'
h_end = '      </header>'
assert html.count(h_start)==1 and html.count(h_end)==1
a = html.index(h_start)
b = html.index(h_end,a)+len(h_end)
removed_header = html[a:b]
assert 'id="breadcrumb"' in removed_header
assert 'id="mobile-nav-toggle"' in removed_header
html = html[:a]+html[b:]
assert 'id="global-menu"' in html
assert '<header class="topbar">' not in html
assert 'id="breadcrumb"' not in html
assert 'id="mobile-nav-toggle"' not in html
assert 'id="workspace-sidebar"' not in html
assert 'id="sidebar-resize-handle"' not in html
out = Path("dist/index.html")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
