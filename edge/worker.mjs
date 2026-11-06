import { pages } from "./pages.mjs";

const ROOT = "dofinances.com";
const SUFFIX = "." + ROOT;
const RESERVED = new Set(["stu","pay","em5386","zb30895346","s1","s2","zmail","gd-origin"]);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function allowedHost(host) {
  if (host === ROOT || host === "www." + ROOT) return true;
  if (!host.endsWith(SUFFIX)) return false;
  const label=host.slice(0,-SUFFIX.length);
  return LABEL.test(label) && !RESERVED.has(label);
}

export async function handleRequest(request, originFetch = fetch) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (!allowedHost(host)) return new Response("Unknown hostname", {status:404});
  const page = Object.hasOwn(pages, host + url.pathname) ? pages[host + url.pathname] : null;
  if (page && (request.method === "GET" || request.method === "HEAD")) {
    return new Response(request.method === "HEAD" ? null : page.body, {
      status:200, headers:{"Content-Type":page.type,"X-Content-Type-Options":"nosniff"},
    });
  }
  if (host === "www." + ROOT) {
    const target=new URL(url);
    target.hostname=ROOT;
    return Response.redirect(target.href,301);
  }
  if (host === ROOT) {
    return originFetch(request,{cf:{resolveOverride:"gd-origin.dofinances.com"}});
  }
  return new Response("Page not configured",{status:404,headers:{"Cache-Control":"no-store"}});
}

export default { fetch(request) {return handleRequest(request);} };
