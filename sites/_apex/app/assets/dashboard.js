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
