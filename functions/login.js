// Retire both /login and /login/ on the Studio Pages host.
// The authenticated design preview remains at Studio / and apex /login.
export function onRequest({request}) {
  return new Response(request.method === "HEAD" ? null : "Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
