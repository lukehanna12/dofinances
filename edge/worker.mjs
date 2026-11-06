// Wildcard-host dispatcher for the existing Dofinances Pages application.
// NO routes are configured here. Activate only after DNS, TLS and existing host
// inventory are verified. This file is not a general-purpose open proxy.
const HOST_SUFFIX = ".dofinances.com";
const PAGES_HOST = "dofinances-studio.pages.dev";

export async function handleRequest(request, upstreamFetch = fetch) {
  const incoming = new URL(request.url);
  const hostname = incoming.hostname.toLowerCase();
  if (!hostname.endsWith(HOST_SUFFIX) || hostname === HOST_SUFFIX.slice(1)) {
    return new Response("Unknown host", { status: 404 });
  }
  // Fixed origin; no request-controlled destination to avoid SSRF/open proxy.
  const destination = new URL(incoming);
  destination.protocol = "https:";
  destination.hostname = PAGES_HOST;
  destination.port = "";

  const forwarded = new Request(destination, request);
  const response = await upstreamFetch(forwarded);
  const headers = new Headers(response.headers);
  const location = headers.get("location");
  if (location) {
    const parsed = new URL(location, destination);
    if (parsed.hostname === PAGES_HOST && parsed.protocol === "https:") {
      parsed.hostname = hostname;
      headers.set("location", parsed.href);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  fetch(request) {
    return handleRequest(request);
  },
};
