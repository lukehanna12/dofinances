import React from "react";

const principles = [
  { number: "01", title: "Clarity", text: "Bring the information that matters into focus." },
  { number: "02", title: "Control", text: "Design around informed decisions and deliberate actions." },
  { number: "03", title: "Confidence", text: "Make complexity easier to understand, not easier to overlook." },
];

export function App() {
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Dofinances home">
          <span className="wordmark-icon" aria-hidden="true">D</span>
          <span>dofinances</span>
        </a>
        <a className="header-link" href="https://github.com/lukehanna12/dofinances" target="_blank" rel="noopener noreferrer">
          Project repository <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><span className="pulse" aria-hidden="true" /> Under development</span>
            <h1 id="hero-title">A clearer view of <em>what comes next.</em></h1>
            <p className="intro">
              We’re building the foundation for Dofinances—a focused, modern financial experience.
            </p>
            <a className="primary-link" href="#direction">Explore the direction <span aria-hidden="true">↓</span></a>
            <p className="disclaimer">This is a project preview, not a live financial service.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-grid" />
            <div className="art-card">
              <span className="art-label">LOOKING FORWARD</span>
              <div className="art-line art-line-one" />
              <div className="art-line art-line-two" />
              <div className="art-bars">
                {[31,45,38,58,50,72,63,86].map((height,i) => <span key={i} style={{height: `${height}%`}} />)}
              </div>
              <div className="art-bottom"><span>Structure</span><span>Possibility</span></div>
            </div>
          </div>
        </section>

        <section id="direction" className="direction" aria-labelledby="direction-title">
          <div className="section-title"><span className="kicker">THE FOUNDATION</span><h2 id="direction-title">Built with intention.</h2></div>
          <div className="principles">
            {principles.map(p => (
              <article className="principle" key={p.number}>
                <span className="principle-number">{p.number}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer"><span>© {new Date().getFullYear()} Dofinances</span><span>Thoughtful progress, one step at a time.</span></footer>
    </div>
  );
}
