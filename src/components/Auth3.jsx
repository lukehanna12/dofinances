/**
 * Auth-3 reconstruction: faithfully transcribed Tailwind utilities and Motion
 * parameters from the recovered React Bits Pro Webpack module 55010.
 *
 * Dofinances branding, dark-first mode and theme toggle are intentional
 * additions. Credentials now use a server-side Cloudflare Durable Object.
 */
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";

export function Auth3() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("oauth_mfa") ? "mfa" : new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login"
  );
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("verified")
      ? "Email verified. You can now sign in." :
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("federation_pending")
      ? "Please verify your email to finish creating the account. Then sign in with the same provider." : ""
  );
  const [error, setError] = useState(() => {
    if(typeof window==="undefined")return "";
    const errors={link_required:"An account with this email already exists. Sign in first and link this provider in Account settings.",identity_used:"That provider account is linked to another Dofinances user.",limit:"You have reached the limit for that provider.",email_required:"This provider did not supply an email address.",email_unverified:"Verify your email address before signing in.",invalid:"The sign-in request expired or could not be verified.",cancelled:"Provider sign-in was cancelled.",unavailable:"Provider sign-in could not be completed. Please try again."};
    return errors[new URLSearchParams(window.location.search).get("federation_error")] || "";
  });
  const [federation,setFederation]=useState({});
  useEffect(()=>{
    if(window.location.hostname!=="dofinances.com")return;
    fetch("/api/auth/config",{cache:"no-store"}).then(r=>r.ok?r.json():null)
      .then(data=>{if(data?.federation)setFederation(data.federation);}).catch(()=>{});
  },[]);
  const signInProviders=[
    {key:"google",label:"Google",mark:"G"},
    {key:"github",label:"GitHub",mark:"GH"}
  ];
  const inputClasses = "w-full px-4 py-3 mb-4 rounded-lg border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-600 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition-all duration-200";
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  async function submit(endpoint,payload) {
    const response=await fetch("/api/auth/"+endpoint,{
      method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
      body:JSON.stringify(payload)
    });
    const result=await response.json();
    if(!response.ok){
      if(result.verification_required) setMode("verify");
      throw Error(result.error||"Request failed.");
    }
    return result;
  }
  async function handleSubmit(event) {
    event.preventDefault();setError("");setNotice("");
    if (mode === "signup" && password !== confirmPassword) {
      setError("The passwords do not match.");return;
    }
    if(window.location.hostname!=="dofinances.com"){
      window.location.assign("https://dofinances.com/login"+(mode==="signup"?"?mode=signup":""));return;
    }
    setLoading(true);
    try{
      if(mode==="mfa"){
        const result=await submit("mfa/finish",{challenge,code});
        if(result.user){setCode("");window.location.assign("/app");}
        return;
      }
      if(mode==="forgot"){
        await submit("password/forgot",{email});
        setMode("forgotSent");setNotice("If this account exists, a reset link has been sent.");
        return;
      }
      if(mode==="verify"){
        await submit("verification/request",{email});
        setNotice("If this address needs verification, a new link has been sent.");
        return;
      }
      const result=await submit(mode==="signup"?"signup":"login",{email,password});
      setPassword("");setConfirmPassword("");
      if(result.mfa_required){
        setChallenge(result.challenge);setCode("");setMode("mfa");
      }else if(result.pending){
        setMode("verify");setNotice("Check your email for a verification link before signing in.");
      }else if(result.user){
        window.location.assign("/app");
      }
    }catch(problem){setError(problem.message||"Authentication is currently unavailable.");}
    finally{setLoading(false);}
  }
  function switchMode(event) {
    event.preventDefault();
    setMode(mode==="login"?"signup":"login");
    setError("");setNotice("");setPassword("");setConfirmPassword("");setChallenge("");setCode("");
  }

  return (
    <main className={`auth3-root font-sans antialiased ${isDark ? "dark" : ""}`}>
      <div className="min-h-screen w-full relative flex items-center justify-center p-6">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1709562493281-03c47edcb046?q=80&w=822&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/20" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto flex items-center justify-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-8 shadow-2xl"
          >
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              {mode === "signup" ? "Create an account" : mode === "forgot" ? "Reset your password" : mode === "mfa" ? "Authenticator code" : mode === "verify" ? "Check your email" : mode === "forgotSent" ? "Check your inbox" : "Sign in"}
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
              {mode === "signup" ? "Already registered?" : mode === "login" ? "New user?" : "Return to sign in?"}{" "}
              <a
                href="#"
                onClick={switchMode}
                className="text-neutral-900 dark:text-white hover:text-neutral-700 dark:hover:text-neutral-300 font-medium no-underline"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </a>
            </p>

            {notice && <p role="status" className={isDark ? "mb-4 text-sm text-emerald-300" : "mb-4 text-sm text-emerald-800"}>{notice}</p>}
            <form onSubmit={handleSubmit} className="mb-6">
              {(mode === "login" || mode === "signup" || mode === "verify" || mode === "forgot") && <input
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                required
                className="w-full px-4 py-3 mb-4 rounded-lg border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-600 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition-all duration-200"
              />}
              {(mode === "login" || mode === "signup") && <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password (12 characters minimum)"
                aria-label="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 12 : undefined}
                maxLength={128}
                required
                className={inputClasses}
              />}
              {mode === "mfa" && <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={event=>setCode(event.target.value)} placeholder="6-digit code or recovery code"
                aria-label="Authenticator or recovery code" required maxLength={48} className={inputClasses}/>}
              {mode === "signup" && <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
                aria-label="Confirm password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className={inputClasses}
              />}
              {mode === "signup" && <p className={isDark ? "mb-4 text-sm text-neutral-400" : "mb-4 text-sm text-neutral-600"}>
                We’ll email you a verification link. Your account remains locked until verification.
              </p>}
              {error && <p role="alert" className={isDark ? "mb-4 text-sm text-red-300" : "mb-4 text-sm text-red-700"}>{error}</p>}
              {(mode !== "forgotSent") && <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-200"
              >
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : mode === "mfa" ? "Verify code" : mode === "verify" ? "Resend verification" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </button>}
            </form>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              <span className="text-sm text-neutral-500 dark:text-neutral-500">Or</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            </div>

            <div className="space-y-3 mb-4">
              {signInProviders.map(provider=>{
                const available=!!federation[provider.key]?.enabled;
                const common="w-full tracking-tight px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium transition-colors duration-200 flex items-center justify-center gap-3 text-sm";
                const contents=<><span aria-hidden="true" className="w-5 font-semibold text-center">{provider.mark}</span>{available?"Continue with "+provider.label:provider.label+" (setup required)"}</>;
                return available
                  ? <a key={provider.key} href={"/api/auth/oauth/start?provider="+provider.key+"&intent=signin"}
                       className={common+" no-underline hover:bg-neutral-100 dark:hover:bg-neutral-700"}>{contents}</a>
                  : <button key={provider.key} type="button" disabled aria-disabled="true"
                       title="OAuth application credentials are not configured"
                       className={common+" opacity-60 cursor-not-allowed"}>{contents}</button>;
              })}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
              You can link additional Google or GitHub accounts from Account settings after signing in.
            </p>
            <p className="text-sm text-center text-neutral-600 dark:text-neutral-400">
              Can't sign in?{" "}
              <a
                href="#"
                onClick={(event) => { event.preventDefault(); setMode("forgot"); setError(""); setNotice(""); }}
                className="text-neutral-900 dark:text-white hover:text-neutral-700 dark:hover:text-neutral-300 font-medium no-underline"
              >
                Reset password
              </a>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block max-w-sm"
          >
            <h2 className="text-4xl font-medium tracking-tighter text-white mb-4">Dofinances</h2>
            <p className="text-lg text-white/90 tracking-tight max-w-[25ch]">
              A clearer view of what comes next.
            </p>
          </motion.div>
        </div>
      </div>

      {/* User-requested feature: absent from the original Auth-3 source. */}
      <button
        className="auth3-theme-toggle"
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
