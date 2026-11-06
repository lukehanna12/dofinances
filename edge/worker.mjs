// Deliberately small, stateless first-level wildcard-host router.
// No automatic DNS routes. Keep existing GoDaddy apex/www and Pages stu untouched.
const ROOT = "dofinances.com";
const SUFFIX = "." + ROOT;
const UPSTREAM = "dofinances-studio.pages.dev";
const RESERVED = new Set([
  "stu", "www", "pay", "em5386", "zb30895346",
  "_domainconnect", "_dmarc", "s1", "s2", "zmail",
]);
const VALID_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function eligibleHost(hostname) {
  if (!hostname.endsWith(SUFFIX)) return false;
  const label = hostname.slice(0, -SUFFIX.length);
  return VALID_LABEL.test(label) && !RESERVED.has(label);
}

export async function handleRequest(request, upstreamFetch = fetch) {
  const incoming = new URL(request.url);
  const hostname = incoming.hostname.toLowerCase();
  if (!eligibleHost(hostname)) return new Response("Unconfigured hostname", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  // Fixed origin prevents an open proxy. Never pass cookies or authorization to
  // the shared static-site origin, even on an attacker-chosen subdomain.
  const destination = new URL(incoming);
  destination.protocol = "https:";
  destination.hostname = UPSTREAM;
  destination.port = "";
  const headers = new Headers(request.headers);
  headers.delete("Cookie");
  headers.delete("Authorization");
  headers.delete("Host");
  const forwarded = new Request(destination, { method: request.method, headers, redirect: "manual" });
  const response = await upstreamFetch(forwarded);
  const outgoing = new Headers(response.headers);
  const location = outgoing.get("Location");
  if (location) {
    const redirect = new URL(location, destination);
    if (redirect.protocol === "https:" && redirect.hostname === UPSTREAM) {
      redirect.hostname = hostname;
      outgoing.set("Location", redirect.href);
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outgoing });
}

export default { fetch: (request) => handleRequest(request) };
