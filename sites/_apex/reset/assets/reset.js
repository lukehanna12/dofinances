const token=new URLSearchParams(location.hash.slice(1)).get("token");
history.replaceState(null,"",location.pathname);
const form=document.getElementById("reset-form"),status=document.getElementById("status");
if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){
  status.textContent="This password-reset link is missing or invalid.";
  form.querySelector("button").disabled=true;
}
form.addEventListener("submit",async event=>{
  event.preventDefault();
  const password=form.elements.namedItem('password').value;
  if(password!==form.elements.namedItem('confirm').value){status.textContent="Passwords must match.";return;}
  const button=form.querySelector("button");
  button.disabled=true;status.textContent="Changing password…";
  try{
    const res=await fetch("/api/auth/password/reset",{
      method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
      body:JSON.stringify({token,password,code:form.elements.namedItem('code').value.trim()})
    });
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Password reset failed.");
    form.reset();
    status.textContent="Password changed. Sign in again using your new password.";
    button.hidden=true;
  }catch(e){status.textContent=e.message;button.disabled=false;}
});
