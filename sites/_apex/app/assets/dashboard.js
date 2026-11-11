// The owner enrollment endpoint returns here after both Cloudflare Access
// and the DoFinances session have been verified server-side.
if(new URLSearchParams(location.search).get("colosseum")==="connected"){
  const msg=document.getElementById("colosseum-owner-feedback");
  if(msg)msg.hidden=false;
  history.replaceState(history.state,"",location.pathname+location.hash);
}

import {initWorkspaceNavigation} from "./workspace-nav.js";
import {initCloudflareConnection} from "./cloudflare-settings.js";
import {initColosseumDiagnostics} from "./diagnostics.js";
import {initColosseumProviders} from "./providers.js";
import {initColosseumPermissions} from "./permissions.js";
initWorkspaceNavigation();
initCloudflareConnection();
initColosseumDiagnostics();
initColosseumProviders();
initColosseumPermissions();

const account = document.getElementById("account-email");
const detail = document.getElementById("account-email-detail");
const logout = document.getElementById("signout");
const deletion = document.getElementById("delete-form");
const feedback = document.getElementById("delete-feedback");
async function getAccount() {
  try {
    const res = await fetch("/api/auth/me", {credentials:"same-origin",cache:"no-store"});
    if (res.status===401){location.replace("/login");return;}
    if (!res.ok)throw new Error("Unable to load your account.");
    const body=await res.json();
    account.textContent=body.user.email;
    detail.textContent=body.user.email;
    document.getElementById("verification-state").textContent=body.user.verified
      ? "Email address verified" : "Email not yet verified (existing accounts may continue using the dashboard)";
    document.getElementById("resend-verification").hidden=!!body.user.verified;
    document.getElementById("mfa-state").textContent=body.user.mfaEnabled
      ? "Authenticator MFA is enabled." : "Authenticator MFA is not enabled.";
    document.getElementById("start-mfa").hidden=!!body.user.mfaEnabled;
    document.getElementById("mfa-disable-form").hidden=!body.user.mfaEnabled;
  } catch {
    account.textContent="Account unavailable";
    detail.textContent="Account unavailable";
  }
}
logout.addEventListener("click",async()=>{
  logout.disabled=true;
  try {
    const res=await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:"{}"});
    if(!res.ok)throw new Error("Sign out failed.");
    location.replace("/login");
  } catch {
    alert("Unable to sign out. Please try again.");
    logout.disabled=false;
  }
});
deletion.addEventListener("submit",async(event)=>{
  event.preventDefault();
  if (!confirm("Permanently delete this account and all its sessions?"))return;
  feedback.textContent="Deleting…";
  const password=document.getElementById("delete-password").value;
  try{
    const res=await fetch("/api/auth/account",{method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({password,code:document.getElementById("delete-code").value.trim()})});
    if(!res.ok){
      const body=await res.json();
      throw new Error(body.error||"Account deletion failed.");
    }
    location.replace("/login");
  }catch(problem){feedback.textContent=problem.message||"Account deletion failed.";}
  finally{document.getElementById("delete-password").value="";}
});
getAccount();

async function authPost(path,body) {
  const res=await fetch("/api/auth/"+path,{method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"Request failed");
  return data;
}
document.getElementById("resend-verification").addEventListener("click",async()=>{
  const status=document.getElementById("verification-feedback");
  status.textContent="Requesting a verification message…";
  try{
    await authPost("verification/request",{email:account.textContent});
    status.textContent="If this address is eligible, a verification email has been sent.";
  }catch(e){status.textContent=e.message;}
});
document.getElementById("start-mfa").addEventListener("click",async()=>{
  const status=document.getElementById("mfa-setup-feedback");
  status.textContent="";
  try{
    const password=document.getElementById("enable-password").value;
    if(!password)throw Error("Enter your current password to enable MFA.");
    const data=await authPost("mfa/setup",{password});
    document.getElementById("enable-password").value="";
    document.getElementById("mfa-secret").textContent=data.secret;
    document.getElementById("mfa-setup").hidden=false;
  }catch(e){status.textContent=e.message;}
});
document.getElementById("mfa-confirm-form").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const feedback=document.getElementById("mfa-setup-feedback");
  feedback.textContent="Checking code…";
  try{
    const code=document.getElementById("setup-code").value.trim();
    const data=await authPost("mfa/confirm",{code});
    document.getElementById("mfa-secret").textContent="";
    document.getElementById("mfa-setup").hidden=true;
    document.getElementById("mfa-recovery").hidden=false;
    document.getElementById("recovery-codes").textContent=data.recoveryCodes.join("\n");
    document.getElementById("start-mfa").hidden=true;
    document.getElementById("mfa-state").textContent="MFA enabled. Save your recovery codes, then sign in again.";
  }catch(err){feedback.textContent=err.message;}
});
document.getElementById("mfa-disable-form").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const status=document.getElementById("mfa-disable-feedback");
  status.textContent="Checking credentials…";
  try{
    await authPost("mfa/disable",{
      password:document.getElementById("disable-password").value,
      code:document.getElementById("disable-code").value.trim()
    });
    location.replace("/login");
  }catch(err){status.textContent=err.message;}
  finally{document.getElementById("disable-password").value="";
    document.getElementById("disable-code").value="";}
});


const PROVIDER_NAMES={google:"Google",github:"GitHub"};
const FLOWED_ERRORS={
  link_required:"Sign in using your existing method, then link this account here.",
  identity_used:"That external account belongs to another Dofinances user.",
  limit:"You have reached the maximum number of accounts for that provider.",
  email_required:"This provider did not return an email address.",
  invalid:"The external sign-in request expired. Please try again.",
  cancelled:"Account linking was cancelled.",
  oauth_client_rejected:"Google or GitHub rejected the OAuth client credentials. Check the client secret configured in Cloudflare.",
  oauth_code_rejected:"The authorization code was rejected or expired. Please start linking again.",
  oauth_token_rejected:"The provider rejected the authorization code exchange.",
  oauth_callback_mismatch:"GitHub rejected the callback address. Confirm the OAuth application's callback URL exactly matches https://dofinances.com/api/auth/oauth/callback/github.",
  oauth_github_email_unverified:"GitHub requires a verified primary email on your GitHub account.",
  oauth_grant_rejected:"GitHub rejected the OAuth grant parameters. The Dofinances integration needs adjustment.",
  oauth_request_rejected:"GitHub rejected the OAuth request parameters. Review the registered OAuth application.",
  oauth_provider_forbidden:"GitHub blocked the token exchange (HTTP 403). The account was not linked.",
  oauth_provider_redirected:"GitHub unexpectedly redirected the token exchange.",
  oauth_provider_rate_limited:"GitHub is limiting authorization requests. Please try again later.",
  oauth_provider_unavailable:"GitHub's authorization service is temporarily unavailable.",

  oauth_identity_invalid:"The provider identity could not be verified. The account was not linked.",
  oauth_response_invalid:"The provider returned an invalid authentication response.",
  oauth_jwks_unavailable:"The provider signing keys were unavailable.",
  oauth_profile_unavailable:"The provider could not return the profile.",
  oauth_provider_network_error:"Dofinances could not complete its secure connection to the provider.",
  oauth_account_store_failed:"The Google/GitHub identity was verified, but Dofinances could not save the account link.",
  oauth_mail_unavailable:"The account verification email could not be sent.",
  unavailable:"External sign-in could not be completed. Please try again."
};
async function loadFederatedAccounts(){
  const area=document.getElementById("linked-identity-list");
  const buttons=document.getElementById("add-identity-buttons");
  const feedback=document.getElementById("federation-feedback");
  const params=new URLSearchParams(location.search);
  if(params.has("federation_linked"))feedback.textContent="Account linked successfully.";
  if(params.has("federation_error"))feedback.textContent=FLOWED_ERRORS[params.get("federation_error")]||"Account linking could not be completed.";
  try{
    const [accountsResponse,configResponse]=await Promise.all([
      fetch("/api/auth/federation/accounts",{credentials:"same-origin",cache:"no-store"}),
      fetch("/api/auth/config",{cache:"no-store"})
    ]);
    if(!accountsResponse.ok||!configResponse.ok)throw Error("Unable to load connected accounts.");
    const accounts=await accountsResponse.json(),config=await configResponse.json();
    area.replaceChildren();buttons.replaceChildren();
    const total=accounts.identities.length;
    if(!total){
      const p=document.createElement("p");
      p.textContent=accounts.hasPassword?"Your email and password are your current sign-in method.":"No external accounts are connected.";
      area.append(p);
    }
    if(!accounts.hasPassword){
      const p=document.createElement("p");
      p.textContent="This account has no password. At least one linked provider must remain connected.";
      area.append(p);
      document.getElementById("enable-password").disabled=true;
      document.getElementById("start-mfa").disabled=true;
      const danger=document.querySelector(".danger");
      if(danger)danger.hidden=true;
    }
    for(const item of accounts.identities){
      const line=document.createElement("div");
      line.style.cssText="display:flex;gap:12px;align-items:center;justify-content:space-between;margin:10px 0;flex-wrap:wrap";
      const label=document.createElement("span");
      label.textContent=(PROVIDER_NAMES[item.provider]||item.provider)+" · "+(item.email||item.displayName||"Connected account");
      const remove=document.createElement("button");
      remove.type="button";remove.className="secondary";remove.textContent="Remove";
      remove.disabled=!accounts.hasPassword&&total<=1;
      if(remove.disabled)remove.setAttribute("aria-description","You must keep at least one sign-in method.");
      remove.addEventListener("click",async()=>{
        if(!confirm("Unlink this "+(PROVIDER_NAMES[item.provider]||item.provider)+" account? Other sessions will be signed out."))return;
        remove.disabled=true;
        feedback.textContent="Removing linked account…";
        try{
          const response=await fetch("/api/auth/federation/unlink",{
            method:"POST",credentials:"same-origin",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({id:item.id})
          });
          const result=await response.json();
          if(!response.ok)throw Error(result.error||"Unable to unlink account.");
          location.replace("/login");
        }catch(e){feedback.textContent=e.message;remove.disabled=false;}
      });
      line.append(label,remove);area.append(line);
    }
    for(const provider of ["google","github"]){
      const count=accounts.identities.filter(x=>x.provider===provider).length;
      const max=accounts.limits?.[provider]||0;
      const enabled=!!config.federation?.[provider]?.enabled;
      const add=document.createElement("a");
      add.className="secondary";
      add.style.cssText="display:inline-block;margin:7px 7px 7px 0;text-decoration:none";
      add.textContent="Add "+(PROVIDER_NAMES[provider]||provider)+" ("+count+"/"+max+")";
      if(enabled&&count<max){
        add.href="/api/auth/oauth/start?provider="+provider+"&intent=link";
      }else{
        add.removeAttribute("href");
        add.setAttribute("aria-disabled","true");
        add.style.opacity=".55";
        add.setAttribute("aria-description",count>=max?"Maximum linked accounts reached.":
          "OAuth application credentials are not configured.");
      }
      buttons.append(add);
    }
  }catch(e){
    area.textContent=e.message||"Unable to load connected accounts.";
  }
}
loadFederatedAccounts();

// Optical decoration is optional: never block authentication, navigation,
// sign-out, MFA or account management if a browser cannot initialize glass.
void import("./sidebar-glass.js")
  .then(({initLiquidGlassSidebar})=>initLiquidGlassSidebar())
  .catch(error=>console.warn("Liquid Glass unavailable; retaining workspace controls",error));
