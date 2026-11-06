/**
 * Auth-3 design reconstruction for Dofinances Studio.
 * Source: the user-approved Auth-3 reconstruction (original V8 Webpack module 55010).
 * This is presentation only: no authentication endpoint, user data transfer, or logging.
 * An independently reviewed authentication implementation is required before real login.
 */
import React, { useRef, useState } from "react";

export function Auth3() {
  const emailRef = useRef(null);
  const [status, setStatus] = useState("");
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  function continueWithEmail() {
    const input = emailRef.current;
    if (!input || !input.reportValidity()) return;
    input.value = "";
    setStatus("Sign-in is not available yet. Your email was not sent or stored.");
  }

  function previewAction(action) {
    if (["create", "help", "more"].includes(action)) {
      setStatus("This is a design preview. Account features are not connected yet.");
    } else {
      setStatus(action + " sign-in is not connected yet. No authentication request was sent.");
    }
  }

  return (
    <main className={`auth3 auth3--${theme}`} aria-labelledby="auth-title">
        <div className="auth3__background" aria-hidden="true"></div>
        <div className="auth3__overlay" aria-hidden="true"></div>
        <div className="auth3__preview-label" role="note">Design preview · Sign-in unavailable</div>
        <div className="auth3__layout">
          <section className="auth3__card" aria-label="Sign-in preview">
            <h1 id="auth-title">Sign in</h1>
            <p className="auth3__subtitle"><span>New user?</span>
              <button className="auth3__text-button" type="button" onClick={() => previewAction("create")}>Create an account</button>
            </p>
            <div className="auth3__email-group" role="group" aria-label="Email sign-in preview">
              <label className="auth3__sr-only" htmlFor="auth-email">Email address</label>
              <input id="auth-email" ref={emailRef} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); continueWithEmail(); } }} type="email" name="email-preview" placeholder="Email address" autoComplete="email" inputMode="email" required />
              <button className="auth3__continue" type="button" id="auth-continue" onClick={continueWithEmail}>Continue</button>
            </div>
            <div className="auth3__divider" aria-hidden="true"><span></span><small>Or</small><span></span></div>
            <div className="auth3__socials" role="group" aria-label="Social sign-in preview">
              <button className="auth3__social" type="button" onClick={() => previewAction("Google")}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span>Sign in with Google</span></button>
              <button className="auth3__social" type="button" onClick={() => previewAction("Apple")}><svg width="20" height="20" viewBox="0 0 814 1000" aria-hidden="true" focusable="false" fill="currentColor"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg><span>Sign in with Apple</span></button>
              <button className="auth3__social" type="button" onClick={() => previewAction("GitHub")}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg><span>Sign in with GitHub</span></button>
            </div>
            <button className="auth3__more" type="button" onClick={() => previewAction("more")}>View more</button>
            <p className="auth3__help"><span>Can't sign in?</span>
              <button className="auth3__text-button" type="button" onClick={() => previewAction("help")}>Get help</button>
            </p>
            <p className="auth3__status" role="status" aria-live="polite" hidden={!status}>{status}</p>
          </section>
          <aside className="auth3__copy" aria-label="Dofinances introduction">
            <h2>Dofinances</h2>
            <p>A clearer view of what comes next.</p>
          </aside>
        </div>
        <button
          className="auth3__theme-toggle"
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {isDark
              ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>
              : <path d="M20.4 15.2A8.6 8.6 0 0 1 8.8 3.6 8.7 8.7 0 1 0 20.4 15.2Z" />}
          </svg>
          <span>{isDark ? "Dark mode" : "Light mode"}</span>
        </button>
      </main>
  );
}

export default Auth3;
