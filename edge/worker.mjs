// Git-controlled static site router for the apex, www, and eligible
// first-level subdomains. Studio and service subdomains are excluded.
const ROOT = "dofinances.com";
const RESERVED = new Set([
  "stu", "pay", "em5386", "zb30895346", "_domainconnect",
  "_dmarc", "s1", "s2", "zmail", "gd-origin",
]);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function siteFolder(hostname) {
  const host = hostname.toLowerCase();
  if (host === ROOT) return "_apex";
  if (host === "www." + ROOT) return "_www";
  if (!host.endsWith("." + ROOT)) return null;
  const label = host.slice(0, -(ROOT.length + 1));
  return LABEL.test(label) && !RESERVED.has(label) ? label : null;
}

export function assetCandidates(folder, pathname) {
  if (!pathname.startsWith("/")) return [];
  const base = "/" + folder + pathname;
  if (pathname === "/") return ["/" + folder + "/index.html"];
  if (pathname.endsWith("/")) return [base + "index.html"];
  const leaf = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (leaf.includes(".")) return [base];
  return [base, base + ".html", base + "/index.html"];
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const folder = siteFolder(url.hostname);
  if (folder === null) return new Response("Unknown host", {status:404});
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {status:405, headers:{Allow:"GET, HEAD"}});
  }
  if (!env.ASSETS?.fetch) return new Response("Static assets not configured", {status:503});
  for (const file of assetCandidates(folder, url.pathname)) {
    const asset = await env.ASSETS.fetch(new Request("https://assets.invalid" + file, {method:"GET"}));
    if (asset.status === 404) continue;
    if (asset.status < 200 || asset.status >= 300) return asset;
    const headers = new Headers(asset.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    if (file.endsWith(".html")) headers.set("Cache-Control", "no-store");
    return new Response(request.method === "HEAD" ? null : asset.body, {
      status: asset.status, statusText: asset.statusText, headers,
    });
  }
  // A Git-controlled www file can override any path. Otherwise www is
  // canonicalized to the corresponding apex path, including query strings.
  if (folder === "_www") {
    url.hostname = ROOT;
    return Response.redirect(url.href, 301);
  }
  return new Response("Not found", {
    status:404,
    headers:{"Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"},
  });
}

export default {fetch(request, env) {return handleRequest(request, env);}};
