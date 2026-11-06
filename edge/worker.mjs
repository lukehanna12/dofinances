import { pages } from "./pages.mjs";

// Requests for the existing studio and external service hostnames bypass
// this Worker at the DNS/route level. Reject them here too (defense in depth).
const ROOT = "dofinances.com";
const SUFFIX = "." + ROOT;
const RESERVED = new Set([
  "stu","pay","em5386","zb30895346","s1","s2","zmail","gd-origin",
  "_domainconnect","_dmarc",
]);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function allowedHost(host) {
  const h = host.toLowerCase();
  if (h === ROOT || h === "www." + ROOT) return true;
  if (!h.endsWith(SUFFIX)) return false;
  const label = h.slice(0, -SUFFIX.length);
  return LABEL.test(label) && !RESERVED.has(label);
}

export async function handleRequest(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (!allowedHost(host)) return new Response("Unknown hostname", {status: 404});
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {status: 405, headers: {Allow:"GET, HEAD"}});
  }

  const page = Object.hasOwn(pages, host + url.pathname)
    ? pages[host + url.pathname] : null;
  if (page) {
    const headers = new Headers({
      "Content-Type": page.type ?? "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(request.method === "HEAD" ? null : page.body, {
      status: 200, headers,
    });
  }
  // Keep www canonical by default, while allowing independent Git-defined
  // www pages above this branch if desired.
  if (host === "www." + ROOT) {
    const target = new URL(url);
    target.hostname = ROOT;
    return Response.redirect(target.href, 301);
  }
  return new Response("Page not configured", {
    status: 404,
    headers: {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},
  });
}

export default { fetch(request) { return handleRequest(request); } };
