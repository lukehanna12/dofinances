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
assert html.count('id="cta6-mosaic"') == 0
assert html.count('id="workspace-sidebar"') == 1
assert 'id="sidebar-resize-handle"' in html
# A viewport-fixed backdrop is a direct body child, BEFORE the authenticated
# workspace shell. It does not inherit main-column width or sidebar transforms.
stage = """<div id="dashboard-atmosphere" class="dashboard-atmosphere" aria-hidden="true">
  <div class="dashboard-atmosphere-grain"></div>
  <div id="dashboard-tiles-small" class="dashboard-tiles dashboard-tiles-small"></div>
  <div id="dashboard-tiles-main" class="dashboard-tiles dashboard-tiles-main"></div>
  <div class="dashboard-structural-side dashboard-structural-side-left"></div>
  <div class="dashboard-structural-side dashboard-structural-side-right"></div>
  <div class="dashboard-structural-top">
    <span class="dashboard-slit dashboard-slit-a"></span>
    <span class="dashboard-slit dashboard-slit-b"></span>
    <span class="dashboard-slit dashboard-slit-c"></span>
  </div>
  <div class="dashboard-structural-bottom">
    <span class="dashboard-base-rule"></span>
    <span class="dashboard-base-rule dashboard-base-rule-inner"></span>
  </div>
  <div class="dashboard-atmosphere-vignette"></div>
</div>
"""
shell_start = '<div class="shell" id="workspace-shell">'
assert html.count(shell_start) == 1
html = html.replace(shell_start, stage + shell_start, 1)
assert 'id="dashboard-tiles-small"' in html
assert 'id="dashboard-tiles-main"' in html
assert 'Workspace</h1>' not in html
out = Path("dist/index.html")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
