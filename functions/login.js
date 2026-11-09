// Retire both /login and /login/ on the Studio Pages host.
// Studio now shows a standalone, non-authenticated glass preview; account sign-in remains at apex /login.
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
