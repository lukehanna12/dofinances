import React, { useEffect, useRef, useState } from "react";
import "./StudioSidebarSandbox.css";

// Deliberately local UI state: none of the demo screens or cards navigate,
// authenticate, query an API, or alter the public/protected site.
export const STUDIO_DEMO_PAGES = Object.freeze([
  {
    id: "utilities", title: "Utilities",
    lead: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis, velit nec dictum tempor, nibh augue consequat magna, non pretium lorem justo sed erat.",
    cards: [
      { icon: "utilities", tag: "WORKSPACE", title: "Dolor sit amet", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum fermentum sapien in turpis faucibus." },
      { icon: "collections", tag: "REFERENCE", title: "Consectetur elit", body: "Praesent commodo, sapien quis interdum facilisis, justo velit sagittis erat, vitae dictum purus ante eget sem." },
      { icon: "providers", tag: "PREVIEW", title: "Integer facilisis", body: "Suspendisse potenti. Donec feugiat lorem at libero porttitor, sed facilisis mauris hendrerit." }
    ],
    rows: [
      { label: "Cras ultricies", detail: "Morbi vulputate leo ac arcu placerat aliquam.", status: "Sample" },
      { label: "Vestibulum ante", detail: "Sed vehicula ligula sit amet urna imperdiet.", status: "Draft" }
    ]
  },
  {
    id: "collections", title: "Collections",
    lead: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Duis pulvinar nibh at est eleifend, non tempus velit lobortis.",
    cards: [
      { icon: "collections", tag: "GROUP A", title: "Curabitur tempus", body: "Quisque sagittis ipsum a mauris accumsan, et sollicitudin eros posuere. Fusce vitae lorem mauris." },
      { icon: "utilities", tag: "GROUP B", title: "Praesent viverra", body: "Vestibulum iaculis augue et lectus congue fermentum. Maecenas eget feugiat sapien." },
      { icon: "providers", tag: "GROUP C", title: "Nullam volutpat", body: "Vivamus pellentesque est nec magna tempus, a tristique nisi ullamcorper. Donec non sapien." }
    ],
    rows: [
      { label: "Etiam maximus", detail: "Donec placerat dui in urna pellentesque aliquet.", status: "Sample" },
      { label: "Maecenas neque", detail: "Curabitur posuere erat vitae lorem interdum.", status: "Draft" }
    ]
  },
  {
    id: "providers", title: "Providers",
    lead: "At vero eos et accusamus et iusto odio dignissimos ducimus. Aenean at lectus eu ipsum convallis sodales vitae quis massa. Morbi tristique quam nec enim suscipit.",
    cards: [
      { icon: "providers", tag: "EXAMPLE 01", title: "Aliquam viverra", body: "Fusce at nisl et nulla egestas efficitur. Vestibulum malesuada pharetra tortor, eget mattis est." },
      { icon: "utilities", tag: "EXAMPLE 02", title: "Mauris accumsan", body: "Nunc pellentesque ultricies metus, non euismod ipsum sodales ac. Integer vulputate risus." },
      { icon: "collections", tag: "EXAMPLE 03", title: "Quisque feugiat", body: "Sed posuere lorem non lectus faucibus, vel convallis nisi tempor. Proin a libero tellus." }
    ],
    rows: [
      { label: "Orci varius", detail: "Aliquam a nibh nec libero vestibulum feugiat.", status: "Sample" },
      { label: "Ut facilisis", detail: "Nullam sed tortor non diam tristique pharetra.", status: "Draft" }
    ]
  }
]);

const ICON_PATHS = {
  utilities: <path d="m13 2-3.4 7H17l-6 13 1-9H5l8-11z" />,
  collections: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3h8M9 9h6m-6 4h6" /></>,
  providers: <><path d="M9 7V4m6 3V4M7 10h10M7 14h10M9 17v3m6-3v3" /><rect x="5" y="7" width="14" height="10" rx="2" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m5-11 3 3-3 3" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: <path d="M6 18 18 6M8 6h10v10" />,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>
};

function Icon({ name, size = 18 }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

function currentMode() {
  if (typeof window === "undefined") return "wide";
  if (window.innerWidth <= 760) return "mobile";
  return window.innerWidth < 1280 ? "rail" : "wide";
}

export function StudioSidebarSandbox() {
  const [screen, setScreen] = useState("utilities");
  const [mode, setMode] = useState(currentMode);
  const [wideCollapsed, setWideCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railEntering, setRailEntering] = useState(false);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const previousMode = useRef(mode);
  const entryTimer = useRef(null);
  const widthTimer = useRef(null);

  useEffect(() => {
    document.title = "Sidebar Lab · DoFinances";
    const resize = () => setMode(currentMode());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const previous = previousMode.current;
    if (previous === mode) return;
    previousMode.current = mode;
    clearTimeout(entryTimer.current);
    clearTimeout(widthTimer.current);
    setRailEntering(false);
    setSidebarAnimating(false);
    if (mode !== "mobile") setMobileOpen(false);
    if (mode === "wide" && previous !== "wide") setWideCollapsed(false);
    if (previous === "mobile" && mode !== "mobile") {
      setRailEntering(true);
      entryTimer.current = setTimeout(() => setRailEntering(false), 280);
    } else if (previous !== "mobile" && mode !== "mobile") {
      setSidebarAnimating(true);
      widthTimer.current = setTimeout(() => setSidebarAnimating(false), 245);
    }
    return () => {
      clearTimeout(entryTimer.current);
      clearTimeout(widthTimer.current);
    };
  }, [mode]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = event => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileOpen]);

  function toggleWideSidebar() {
    if (mode !== "wide") return;
    clearTimeout(widthTimer.current);
    setSidebarAnimating(true);
    setWideCollapsed(value => !value);
    widthTimer.current = setTimeout(() => setSidebarAnimating(false), 245);
  }

  function navigate(id) {
    setScreen(id);
    if (mode === "mobile") setMobileOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  const page = STUDIO_DEMO_PAGES.find(item => item.id === screen) || STUDIO_DEMO_PAGES[0];
  const collapsed = mode === "rail" || (mode === "wide" && wideCollapsed);
  const shellClasses = [
    "studio-sandbox",
    collapsed ? "studio-sandbox--collapsed" : "",
    mode === "rail" ? "studio-sandbox--rail" : "",
    mode === "mobile" ? "studio-sandbox--mobile" : "",
    mobileOpen ? "studio-sandbox--mobile-open" : "",
    railEntering ? "studio-sandbox--rail-entering" : "",
    sidebarAnimating ? "studio-sandbox--animating" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClasses} data-studio-sidebar-sandbox>
      <aside id="studio-sidebar" className="studio-sandbox__sidebar" aria-label="Sidebar demo navigation">
        <div className="studio-sandbox__sidebar-head">
          <div className="studio-sandbox__brand">
            <span className="studio-sandbox__mark" aria-hidden="true">D</span>
            <span className="studio-sandbox__brand-copy">DoFinances<span>Studio</span></span>
          </div>
          <button className="studio-sandbox__toggle" type="button"
            aria-label={mode === "mobile" ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed} aria-controls="studio-sidebar-nav"
            onClick={mode === "mobile" ? () => setMobileOpen(false) : toggleWideSidebar}
            title={mode === "mobile" ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Icon name="panel" />
          </button>
        </div>

        <nav id="studio-sidebar-nav" className="studio-sandbox__navigation" aria-label="Demo screens">
          <div className="studio-sandbox__nav-heading">COLOSSEUM</div>
          {STUDIO_DEMO_PAGES.map(item => (
            <button key={item.id} type="button"
              className={"studio-sandbox__nav-link" + (screen === item.id ? " is-active" : "")}
              onClick={() => navigate(item.id)} aria-current={screen === item.id ? "page" : undefined}
              aria-label={item.title} title={item.title}>
              <span className="studio-sandbox__nav-icon"><Icon name={item.id} /></span>
              <span className="studio-sandbox__nav-label">{item.title}</span>
            </button>
          ))}
        </nav>

        <div className="studio-sandbox__sidebar-foot">
          <span className="studio-sandbox__status-dot" aria-hidden="true" />
          <span className="studio-sandbox__foot-label">Demo workspace</span>
        </div>
      </aside>

      {mode === "mobile" && mobileOpen && (
        <button className="studio-sandbox__scrim" type="button" aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)} />
      )}

      <div className="studio-sandbox__main">
        <header className="studio-sandbox__topbar">
          <div className="studio-sandbox__topbar-left">
            {mode === "mobile" && (
              <button className="studio-sandbox__mobile-menu" type="button"
                aria-label="Open sidebar" aria-expanded={mobileOpen}
                aria-controls="studio-sidebar" onClick={() => setMobileOpen(true)}>
                <Icon name="menu" size={19} />
              </button>
            )}
            <div className="studio-sandbox__location">
              <span className="studio-sandbox__breadcrumb">Projects / Colosseum / {page.title}</span>
              <span className="studio-sandbox__location-subtitle">Sidebar interaction playground</span>
            </div>
          </div>
          <span className="studio-sandbox__preview-label">PREVIEW ONLY</span>
        </header>

        <main className="studio-sandbox__content" id="studio-main">
          <div className="studio-sandbox__eyebrow">PROJECT / COLOSSEUM</div>
          <div className="studio-sandbox__heading-row">
            <div className="studio-sandbox__heading-text">
              <h1>{page.title}</h1>
              <p className="studio-sandbox__lead">{page.lead}</p>
            </div>
            <button className="studio-sandbox__action" type="button"
              title="Placeholder button — no action" aria-label={"Add " + page.title.toLowerCase() + " (demo only)"}>
              <Icon name="plus" size={17} /> New item
            </button>
          </div>

          <div className="studio-sandbox__section-heading">
            <h2>Overview</h2>
            <span>Sample content</span>
          </div>
          <div className="studio-sandbox__cards">
            {page.cards.map(card => (
              <article className="studio-sandbox__card" key={card.title}>
                <div className="studio-sandbox__card-top">
                  <span className="studio-sandbox__card-icon"><Icon name={card.icon} size={20} /></span>
                  <button className="studio-sandbox__card-menu" type="button"
                    aria-label={"More options for " + card.title + " (demo only)"}
                    title="Placeholder button — no action"><Icon name="dots" size={18} /></button>
                </div>
                <span className="studio-sandbox__card-tag">{card.tag}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="studio-sandbox__card-bottom">
                  <span>Example item</span>
                  <button type="button" className="studio-sandbox__text-button"
                    aria-label={"View " + card.title + " (demo only)"}
                    title="Placeholder button — no action">View details <Icon name="chevron" size={15} /></button>
                </div>
              </article>
            ))}
          </div>

          <div className="studio-sandbox__section-heading studio-sandbox__section-heading--lower">
            <h2>Recent activity</h2>
            <button type="button" className="studio-sandbox__text-button"
              title="Placeholder button — no action">View all <Icon name="arrow" size={15} /></button>
          </div>
          <div className="studio-sandbox__rows">
            {page.rows.map(row => (
              <div className="studio-sandbox__row" key={row.label}>
                <div className="studio-sandbox__row-dot" aria-hidden="true" />
                <div className="studio-sandbox__row-copy">
                  <strong>{row.label}</strong><span>{row.detail}</span>
                </div>
                <span className="studio-sandbox__row-status">{row.status}</span>
                <button className="studio-sandbox__card-menu" type="button"
                  aria-label={"Options for " + row.label + " (demo only)"}
                  title="Placeholder button — no action"><Icon name="dots" size={19} /></button>
              </div>
            ))}
          </div>
          <p className="studio-sandbox__footer">
            Demo content only. Sidebar selection changes this preview without navigating to another URL.
          </p>
        </main>
      </div>
    </div>
  );
}
