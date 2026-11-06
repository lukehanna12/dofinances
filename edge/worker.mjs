import { pages } from "./pages.mjs";

const ROOT = "dofinances.com";
const SUFFIX = "." + ROOT;
const RESERVED = new Set(["stu","pay","em5386","zb30895346","s1","s2","zmail","gd-origin"]);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function allowedHost(host) {
  if (host === ROOT || host === "www." + ROOT) return true;
  if (!host.endsWith(SUFFIX)) return false;
  const label = host.slice(0,-SUFFIX.length);
  return LABEL.test(label) && !RESERVED.has(label);
}

export async function handleRequest(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (!allowedHost(host)) return new Response("Unknown hostname",{status:404});
  const page = Object.hasOwn(pages,host + url.pathname) ? pages[host + url.pathname] : null;
  if (page && (request.method === "GET" || request.method === "HEAD")) {
    return new Response(request.method === "HEAD" ? null : page.body,{
      status:200,
      headers:{"Content-Type":page.type,"X-Content-Type-Options":"nosniff"},
    });
  }
  // GoDaddy's origin is not reliably accessible via a Workers proxy.
  // The apex and www must remain DNS-only until safely migrated.
  if (host === ROOT || host === "www." + ROOT) {
    return new Response("This hostname is not configured for Workers routing",{status:503});
  }
  return new Response("Page not configured",{status:404,headers:{"Cache-Control":"no-store"}});
}

export default {fetch(request){return handleRequest(request);}};
