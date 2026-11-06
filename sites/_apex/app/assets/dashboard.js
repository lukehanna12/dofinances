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
    const res=await fetch("/api/auth/account",{method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({password})});
    if(!res.ok){
      const body=await res.json();
      throw new Error(body.error||"Account deletion failed.");
    }
    location.replace("/login");
  }catch(problem){feedback.textContent=problem.message||"Account deletion failed.";}
  finally{document.getElementById("delete-password").value="";}
});
getAccount();
