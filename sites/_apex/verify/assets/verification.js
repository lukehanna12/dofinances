const params=new URLSearchParams(location.hash.slice(1));
const token=params.get("token");
history.replaceState(null,"",location.pathname);
const action=document.getElementById("verify");
const status=document.getElementById("status");
if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){
  action.hidden=true;status.textContent="This verification link is missing or invalid.";
}
action.addEventListener("click",async()=>{
  action.disabled=true;status.textContent="Verifying…";
  try{
    const res=await fetch("/api/auth/verification/confirm",{
      method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({token})
    });
    const body=await res.json();
    if(!res.ok)throw Error(body.error||"Unable to verify email");
    status.textContent="Email verified. You can now sign in.";
    action.hidden=true;
    setTimeout(()=>location.replace("/login?verified=1"),1000);
  }catch(e){status.textContent=e.message;action.disabled=false;}
});
