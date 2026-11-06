// Transactional mail delivery through a configured SendGrid API key.
// Delivery credentials are Worker secrets, never committed to GitHub.
export function mailReady(env){
  return !!(env?.SENDGRID_API_KEY && env?.AUTH_EMAIL_FROM &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.AUTH_EMAIL_FROM));
}
function escapeHtml(input){return input.replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));}
export async function sendAccountEmail(env,{to,kind,token}){
  if(!mailReady(env))throw Error("Email delivery not configured");
  const verify=kind==="verify";
  if(!verify&&kind!=="reset")throw Error("Invalid email type");
  // Fragment keeps bearer tokens out of HTTP access logs and referrers.
  const link="https://dofinances.com/"+(verify?"verify":"reset")+"#token="+encodeURIComponent(token);
  const title=verify?"Verify your Dofinances email":"Reset your Dofinances password";
  const interval=verify?"24 hours":"30 minutes";
  const message=verify?"Confirm your email address":"Choose a new password";
  const plain=title+"\n\n"+message+": "+link+"\n\nThis link expires in "+interval+
    ". If you did not request this email, you can ignore it.\n";
  const html="<p>"+escapeHtml(message)+":</p><p><a href=\""+escapeHtml(link)+"\">"+escapeHtml(message)+
    "</a></p><p>Link expires in "+interval+". If this was not you, ignore this message.</p>";
  const response=await fetch("https://api.sendgrid.com/v3/mail/send",{
    method:"POST",headers:{"Authorization":"Bearer "+env.SENDGRID_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({personalizations:[{to:[{email:to}]}],from:{email:env.AUTH_EMAIL_FROM,name:"Dofinances"},
      subject:title,content:[{type:"text/plain",value:plain},{type:"text/html",value:html}]})
  });
  if(response.status!==202)throw Error("Transactional email provider rejected delivery");
  return true;
}
