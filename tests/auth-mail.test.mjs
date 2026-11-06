import test from "node:test";
import assert from "node:assert/strict";
import {MAILTRAP_SEND_ENDPOINT,mailReady,accountEmailPayload,sendAccountEmail} from "../edge/auth-mail.mjs";

const TOKEN="X".repeat(43);
const env={
  MAILTRAP_API_TOKEN:"a-test-token-not-a-secret",
  AUTH_EMAIL_FROM:"noreply@dofinances.com"
};
const mail={to:"member@example.net",kind:"verify",token:TOKEN};

test("only configured Mailtrap production token and dofinances.com sender enable email",()=>{
  assert.equal(mailReady({}),false);
  assert.equal(mailReady({SENDGRID_API_KEY:"old-key",AUTH_EMAIL_FROM:env.AUTH_EMAIL_FROM}),false);
  assert.equal(mailReady({...env,MAILTRAP_API_TOKEN:" "}),false);
  assert.equal(mailReady({...env,AUTH_EMAIL_FROM:"spoof@other-domain.com"}),false);
  assert.equal(mailReady(env),true);
});
test("verification and reset emails are unbranded, single-recipient and use URL fragments",()=>{
  const verify=accountEmailPayload(env,mail);
  assert.deepEqual(verify.from,{email:"noreply@dofinances.com",name:"Dofinances"});
  assert.deepEqual(verify.to,[{email:"member@example.net"}]);
  assert.match(verify.subject,/Verify your Dofinances/);
  assert.ok(verify.text.includes("https://dofinances.com/verify#token="+TOKEN));
  assert.match(verify.html,/<a href="https:\/\/dofinances\.com\/verify#token=/);
  assert.equal(verify.category,"account-verification");
  assert.equal(verify.reply_to,undefined);
  const reset=accountEmailPayload({...env,AUTH_EMAIL_REPLY_TO:"support@dofinances.com"},{...mail,kind:"reset"});
  assert.match(reset.text,/https:\/\/dofinances\.com\/reset#token=/);
  assert.equal(reset.category,"password-recovery");
  assert.deepEqual(reset.reply_to,{email:"support@dofinances.com",name:"Dofinances Support"});
  assert.throws(()=>accountEmailPayload(env,{...mail,token:"invalid"}),/Invalid delivery token/);
  assert.throws(()=>accountEmailPayload(env,{...mail,kind:"marketing"}),/Invalid email type/);
});
test("Mailtrap transactional API uses Api-Token header and accepts a documented response",async()=>{
  let calls=0;
  const send=async(url,options)=>{
    calls++;
    assert.equal(url,MAILTRAP_SEND_ENDPOINT);
    assert.equal(url,"https://send.api.mailtrap.io/api/send");
    assert.equal(options.method,"POST");
    assert.equal(options.headers["Api-Token"],env.MAILTRAP_API_TOKEN);
    assert.equal(options.headers["Content-Type"],"application/json");
    assert.ok(!("Authorization" in options.headers));
    const body=JSON.parse(options.body);
    assert.equal(body.category,"account-verification");
    assert.equal(body.to.length,1);
    return Response.json({success:true,message_ids:["message-id"]},{status:200});
  };
  assert.equal(await sendAccountEmail(env,mail,send),true);
  assert.equal(calls,1);
});
test("failed, throttled and malformed Mailtrap responses fail closed without retries",async()=>{
  for(const response of [
    new Response("invalid token",{status:401}),
    new Response("rate limit",{status:429}),
    new Response("{}",{status:200}),
    Response.json({success:false,errors:["rejected"]},{status:200}),
    new Response("not json",{status:200}),
    Response.json({success:true,message_ids:[]},{status:200})
  ]){
    let calls=0;
    await assert.rejects(sendAccountEmail(env,mail,async()=>{calls++;return response;}));
    assert.equal(calls,1);
  }
});
