// The owner enrollment endpoint returns here after both Cloudflare Access
// and the DoFinances session have been verified server-side.
if(new URLSearchParams(location.search).get("colosseum")==="connected"){
  const msg=document.getElementById("colosseum-owner-feedback");
  if(msg)msg.hidden=false;
  history.replaceState(history.state,"",location.pathname+location.hash);
}

import {initWorkspaceNavigation} from "./workspace-nav.js";
import {initProjectReadme} from "./project-readme-ui.js?project-icons=v5";
import {initCloudflareConnection} from "./cloudflare-settings.js";
import {initColosseumDiagnostics} from "./diagnostics.js";
import {initColosseumProviders} from "./providers.js";
import {initColosseumCollections} from "./collections.js";
import {initColosseumUtilities} from "./utilities.js";
import {initColosseumPermissions} from "./permissions.js";
initWorkspaceNavigation();
initProjectReadme();
initCloudflareConnection();
initColosseumDiagnostics();
initColosseumProviders();
initColosseumCollections();
initColosseumUtilities();
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
  photo_account_mismatch:"Please choose the same Google account that is already connected.",
  oauth_provider_network_error:"Dofinances could not complete its secure connection to the provider.",
  oauth_account_store_failed:"The Google/GitHub identity was verified, but Dofinances could not save the account link.",
  oauth_mail_unavailable:"The account verification email could not be sent.",
  unavailable:"External sign-in could not be completed. Please try again."
};
// Logo shapes are local, inert SVG, never remotely sourced UI assets.
const FSVG="http://www.w3.org/2000/svg";
function identityBrandIcon(provider){
 const svg=document.createElementNS(FSVG,"svg");
 svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");
 svg.setAttribute("focusable","false");svg.classList.add("st-provider-logo");
 const glyphs=provider==="google"?[
  ["#4285F4","M21.35 12.24c0-.73-.06-1.43-.2-2.11H12v3.86h5.24a4.48 4.48 0 0 1-1.95 2.93v2.42h3.15c1.85-1.7 2.91-4.2 2.91-7.1z"],
  ["#34A853","M12 21.5c2.57 0 4.73-.85 6.31-2.31l-3.15-2.42c-.87.58-1.98.92-3.16.92-2.43 0-4.49-1.64-5.23-3.85H3.52v2.42A9.5 9.5 0 0 0 12 21.5z"],
  ["#FBBC05","M6.77 13.84A5.7 5.7 0 0 1 6.47 12c0-.64.11-1.26.3-1.84V7.74H3.52a9.5 9.5 0 0 0 0 8.52l3.25-2.42z"],
  ["#EA4335","M12 6.31c1.39 0 2.64.48 3.62 1.43l2.79-2.79A9.12 9.12 0 0 0 12 2.5a9.5 9.5 0 0 0-8.48 5.24l3.25 2.42C7.51 7.95 9.57 6.31 12 6.31z"]
 ]:[["currentColor","M12 .297a12 12 0 0 0-3.793 23.386c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.304-5.466-1.334-5.466-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.323 3.301 1.23a11.535 11.535 0 0 1 6.007 0c2.291-1.553 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.91 1.235 3.221 0 4.61-2.804 5.624-5.475 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.216.694.825.576A12.003 12.003 0 0 0 24 12.297a12 12 0 0 0-12-12"]];
 for(const [color,d] of glyphs){
  const path=document.createElementNS(FSVG,"path");
  path.setAttribute("d",d);path.setAttribute("fill",color);svg.append(path);
 }
 return svg;
}
function trustedIdentityImage(item){
 if(typeof item.avatarUrl!=="string"||item.avatarUrl.length>2048)return null;
 try{
  const u=new URL(item.avatarUrl);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
  if(item.provider==="google"&&!/^lh[1-6]\.googleusercontent\.com$/.test(u.hostname))return null;
  if(item.provider==="github"&&u.hostname!=="avatars.githubusercontent.com")return null;
  return u.href;
 }catch{return null;}
}
function identityPicture(item){
 const fallback=document.createElement("span");fallback.className="st-identity-avatar st-identity-avatar-fallback";
 fallback.append(identityBrandIcon(item.provider));
 const url=trustedIdentityImage(item);
 if(!url)return fallback;
 const image=document.createElement("img");image.className="st-identity-avatar";
 image.src=url;image.alt=(PROVIDER_NAMES[item.provider]||item.provider)+" profile picture";
 image.loading="eager";image.decoding="async";image.referrerPolicy="no-referrer";
 image.addEventListener("error",()=>image.replaceWith(fallback),{once:true});
 return image;
}
async function loadFederatedAccounts(){
  const area=document.getElementById("linked-identity-list");
  const buttons=document.getElementById("add-identity-buttons");
  const feedback=document.getElementById("federation-feedback");
  const params=new URLSearchParams(location.search);
  if(params.has("federation_linked"))feedback.textContent="Account linked successfully.";
  if(params.has("federation_photo"))feedback.textContent=
    params.get("federation_photo")==="updated"?"Google profile photo refreshed.":
      "Google did not provide a usable photo. Your account remains connected.";
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
      const line=document.createElement("div");line.className="st-identity-row";
      const person=document.createElement("span");person.className="st-identity-person";
      const avatar=identityPicture(item);
      person.append(avatar);
      const labels=document.createElement("span");labels.className="st-identity-labels";
      const provider=document.createElement("strong");provider.textContent=PROVIDER_NAMES[item.provider]||item.provider;
      const accountName=document.createElement("span");
      accountName.textContent=item.email||item.displayName||"Connected account";
      labels.append(provider,accountName);
      if(item.provider==="google"&&config.federation?.google?.enabled){
        // Older linked Google identities have no stored photo. The
        // server pins the exact linked subject before Google authorization,
        // so this cannot add or replace the wrong account.
        const refreshPhoto=document.createElement("a");
        refreshPhoto.className="st-profile-photo-refresh";
        refreshPhoto.href="/api/auth/oauth/start?provider=google&intent=refresh&identity="+encodeURIComponent(item.id);
        refreshPhoto.textContent="Load Google profile photo";
        refreshPhoto.setAttribute("aria-label","Reauthorize the connected Google account to load its profile photo");
        refreshPhoto.hidden=!!trustedIdentityImage(item);
        if(avatar.tagName==="IMG")
          avatar.addEventListener("error",()=>{refreshPhoto.hidden=false},{once:true});
        labels.append(refreshPhoto);
      }
      person.append(labels);
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
      line.append(person,remove);area.append(line);
    }
    for(const provider of ["google","github"]){
      const count=accounts.identities.filter(x=>x.provider===provider).length;
      const max=accounts.limits?.[provider]||0;
      const enabled=!!config.federation?.[provider]?.enabled;
      const group=document.createElement("div");group.className="st-identity-add-group";
      const add=document.createElement("a");add.className="secondary st-identity-connect";
      add.append(identityBrandIcon(provider));
      const text=document.createElement("span");
      text.textContent="Connect new "+(PROVIDER_NAMES[provider]||provider)+" Account";
      add.append(text);
      const capacity=document.createElement("span");capacity.className="st-identity-capacity";
      capacity.textContent=count+"/"+max+" connected";
      if(enabled&&count<max){
        add.href="/api/auth/oauth/start?provider="+provider+"&intent=link";
      }else{
        add.removeAttribute("href");
        add.setAttribute("aria-disabled","true");
        add.style.opacity=".55";
        add.setAttribute("aria-description",count>=max?"Maximum linked accounts reached.":
          "OAuth application credentials are not configured.");
      }
      group.append(add,capacity);buttons.append(group);
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
