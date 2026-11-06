// Git-managed public pages; keys are hostname followed by absolute URL path.
// Adding/changing/removing entries is deployed by GitHub Actions.
export const pages = Object.freeze({
  "ci-probe.dofinances.com/": {
    type:"text/html; charset=utf-8",
    body:"<!doctype html><html><body><h1>Wildcard CI probe</h1></body></html>",
  },
  "ci-probe.dofinances.com/nested/hello": {
    type:"text/html; charset=utf-8",
    body:"<!doctype html><html><body><h1>Nested route works</h1></body></html>",
  },
  "dofinances.com/__ci_probe/test": {
    type:"text/html; charset=utf-8",
    body:"<!doctype html><html><body><h1>Apex CI overlay probe</h1></body></html>",
  },
  "www.dofinances.com/__ci_probe/test": {
    type:"text/html; charset=utf-8",
    body:"<!doctype html><html><body><h1>WWW CI overlay probe</h1></body></html>",
  },
});
