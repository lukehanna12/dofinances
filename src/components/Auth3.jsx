/**
 * Auth-3 reconstruction: faithfully transcribed Tailwind utilities and Motion
 * parameters from the recovered React Bits Pro Webpack module 55010.
 *
 * DoFinances branding uses a fixed dark palette. Credentials now use a server-side Cloudflare Durable Object.
 */
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AuthProviderIcon } from "./AuthProviderIcon.jsx";

export function Auth3({exiting=false,onBack=()=>{},onExitComplete=()=>{}}) {
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
    const errors={
      oauth_client_rejected:"The provider rejected the OAuth client credentials. Please contact the website administrator.",
      oauth_code_rejected:"The provider rejected the authorization code. Start the sign-in again.",
      oauth_token_rejected:"The provider rejected the sign-in exchange.",
      oauth_callback_mismatch:"The provider rejected DoFinances' configured callback address.",
      oauth_github_email_unverified:"Verify the primary email address on your GitHub account.",
      oauth_grant_rejected:"The provider rejected the OAuth grant parameters.",
      oauth_request_rejected:"The provider rejected the OAuth request parameters.",
      oauth_provider_forbidden:"The provider blocked the OAuth token exchange (HTTP 403).",
      oauth_provider_redirected:"The provider unexpectedly redirected the authorization exchange.",
      oauth_provider_rate_limited:"The provider is limiting authentication requests.",
      oauth_provider_unavailable:"The provider's authentication service is temporarily unavailable.",

      oauth_identity_invalid:"The provider identity could not be verified.",
      oauth_response_invalid:"The provider returned an invalid sign-in response.",
      oauth_jwks_unavailable:"The provider's signing keys were unavailable.",
      oauth_profile_unavailable:"The provider profile could not be obtained.",
      oauth_provider_network_error:"The provider connection failed.",
      oauth_account_store_failed:"The external identity was verified, but DoFinances could not save it.",
      oauth_mail_unavailable:"The verification email could not be sent.",
      link_required:"An account with this email already exists. Sign in first and link this provider in Account settings.",identity_used:"That provider account is linked to another DoFinances user.",limit:"You have reached the limit for that provider.",email_required:"This provider did not supply an email address.",email_unverified:"Verify your email address before signing in.",invalid:"The sign-in request expired or could not be verified.",cancelled:"Provider sign-in was cancelled.",unavailable:"Provider sign-in could not be completed. Please try again."};
    return errors[new URLSearchParams(window.location.search).get("federation_error")] || "";
  });
  const [federation,setFederation]=useState({});
  useEffect(()=>{
    if(window.location.hostname!=="dofinances.com")return;
    fetch("/api/auth/config",{cache:"no-store"}).then(r=>r.ok?r.json():null)
      .then(data=>{if(data?.federation)setFederation(data.federation);}).catch(()=>{});
  },[]);
  const signInProviders=[
    {key:"google",label:"Google"},
    {key:"github",label:"GitHub"}
  ];
  const inputClasses = "w-full px-4 py-3 mb-4 rounded-lg border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-600 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition-all duration-200";
  // Sign-in always uses the dark palette, regardless of legacy saved preferences.
  const isDark = true;

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
      <div data-auth-stage className="min-h-screen w-full relative flex items-center justify-center p-6">
        <div className="relative z-10 w-full max-w-[1400px] mx-auto flex items-center justify-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={exiting ? { opacity: 0, x: -50 } : { opacity: 1, x: 0 }}
            // Keep the original 600ms entrance; make the reverse transition
            // more responsive without altering the homepage tile motion.
            transition={exiting
              ? { duration: 0.42, ease: [0.2, 0, 0.2, 1] }
              : { duration: 0.6 }}
            style={{ willChange: exiting ? "transform, opacity" : "auto" }}
            onAnimationComplete={() => { if(exiting) onExitComplete(); }}
            data-auth-glass-card
            className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-8 shadow-2xl"
          >
            <a href="/" data-auth-glass-provider className="auth3-back-link" aria-label="Back to homepage" title="Back to homepage"
              onClick={event=>{
                if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
                  event.shiftKey||event.altKey)return;
                event.preventDefault();
                onBack();
              }}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20 12H4m0 0 6-6m-6 6 6 6" />
              </svg>
            </a>
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
                data-auth-glass-input
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
                data-auth-glass-input
                className={inputClasses}
              />}
              {mode === "mfa" && <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={event=>setCode(event.target.value)} placeholder="6-digit code or recovery code"
                aria-label="Authenticator or recovery code" required maxLength={48} data-auth-glass-input className={inputClasses}/>}
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
                data-auth-glass-input
                className={inputClasses}
              />}
              {mode === "signup" && <p className={isDark ? "mb-4 text-sm text-neutral-400" : "mb-4 text-sm text-neutral-600"}>
                We’ll email you a verification link. Your account remains locked until verification.
              </p>}
              {error && <p role="alert" className={isDark ? "mb-4 text-sm text-red-300" : "mb-4 text-sm text-red-700"}>{error}</p>}
              {(mode !== "forgotSent") && <button
                type="submit"
                disabled={loading}
                data-auth-glass-submit
                className="w-full px-6 py-3 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-200"
              >
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : mode === "mfa" ? "Verify code" : mode === "verify" ? "Resend verification" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </button>}
            </form>

            <div data-auth-or-separator className="flex items-center gap-4 mb-6 text-neutral-500 dark:text-neutral-400">
              <div className="auth3-or-rule flex-1 h-px" />
              <span className="text-sm">Or</span>
              <div className="auth3-or-rule flex-1 h-px" />
            </div>

            <div className="space-y-3 mb-4">
              {signInProviders.map(provider=>{
                const available=!!federation[provider.key]?.enabled;
                const common="w-full tracking-tight px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium transition-colors duration-200 flex items-center justify-center gap-3 text-sm";
                const contents=<><AuthProviderIcon provider={provider.key}/>{available?"Continue with "+provider.label:provider.label+" (setup required)"}</>;
                return available
                  ? <a key={provider.key} href={"/api/auth/oauth/start?provider="+provider.key+"&intent=signin"}
                       data-auth-glass-provider
                       className={common+" no-underline hover:bg-neutral-100 dark:hover:bg-neutral-700"}>{contents}</a>
                  : <button key={provider.key} type="button" disabled aria-disabled="true"
                       data-auth-glass-provider
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
        </div>
      </div>


    </main>
  );
}

export default Auth3;
