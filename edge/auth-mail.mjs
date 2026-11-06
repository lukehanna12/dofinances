// Dofinances transactional email via Mailtrap Email Sending (not Sandbox/Bulk).
// API credentials remain in Cloudflare Worker secrets; no D1, R2 or new dependencies.
export const MAILTRAP_SEND_ENDPOINT = "https://send.api.mailtrap.io/api/send";

function validAddress(value) {
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function mailReady(env) {
  // Stale SendGrid credentials are deliberately not accepted.
  return !!(
    typeof env?.MAILTRAP_API_TOKEN === "string" &&
    env.MAILTRAP_API_TOKEN.trim().length > 0 &&
    validAddress(env.AUTH_EMAIL_FROM) &&
    env.AUTH_EMAIL_FROM.toLowerCase().endsWith("@dofinances.com")
  );
}
function escapeHtml(input) {
  return input.replace(/[&<>"']/g, ch =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

export function accountEmailPayload(env, {to,kind,token}) {
  if (!mailReady(env)) throw Error("Email delivery not configured");
  if (!validAddress(to)) throw Error("Invalid destination");
  if (kind !== "verify" && kind !== "reset") throw Error("Invalid email type");
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw Error("Invalid delivery token");
  const verify = kind === "verify";
  // Using the fragment prevents tokens in normal HTTP request logs and Referer.
  const link = "https://dofinances.com/" + (verify ? "verify" : "reset") +
    "#token=" + encodeURIComponent(token);
  const title = verify ? "Verify your Dofinances email" : "Reset your Dofinances password";
  const interval = verify ? "24 hours" : "30 minutes";
  const action = verify ? "Confirm your email address" : "Choose a new password";
  const text = title + "\n\n" + action + ": " + link +
    "\n\nThis link expires in " + interval +
    ". If you did not request this email, you can ignore it.\n";
  const html = "<p>" + escapeHtml(action) + ":</p><p><a href=\"" +
    escapeHtml(link) + "\">" + escapeHtml(action) +
    "</a></p><p>Link expires in " + interval +
    ". If this was not you, ignore this message.</p>";
  const payload = {
    from: {email:env.AUTH_EMAIL_FROM, name:"Dofinances"},
    to: [{email:to}],
    subject:title,
    text,
    html,
    category: verify ? "account-verification" : "password-recovery"
  };
  // Optional Reply-To: set only after support@ forwarding has been verified.
  if (validAddress(env.AUTH_EMAIL_REPLY_TO))
    payload.reply_to = {email:env.AUTH_EMAIL_REPLY_TO, name:"Dofinances Support"};
  return payload;
}

export async function sendAccountEmail(env,mail,transport=fetch) {
  const payload=accountEmailPayload(env,mail);
  const response=await transport(MAILTRAP_SEND_ENDPOINT,{
    method:"POST",
    headers:{
      "Api-Token":env.MAILTRAP_API_TOKEN,
      "Content-Type":"application/json",
      "Accept":"application/json",
      "User-Agent":"Dofinances-Transactional/1.0"
    },
    body:JSON.stringify(payload)
  });
  // Mailtrap documents HTTP 200 + {"success":true,"message_ids":[...]}.
  // Never log provider responses, tokens, recipients, or message contents.
  if(response.status!==200)
    throw Error("Transactional email provider rejected delivery");
  let result;
  try { result=await response.json(); }
  catch { throw Error("Transactional email provider returned invalid response"); }
  if(result?.success!==true || !Array.isArray(result?.message_ids) || result.message_ids.length===0)
    throw Error("Transactional email provider did not confirm acceptance");
  return true;
}
