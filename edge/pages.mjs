// Each key is a public hostname plus an absolute URL pathname. GitHub commits
// adding, changing or deleting entries are deployed by GitHub Actions.
// This short-lived entry will be deleted after live routing tests.
export const pages = Object.freeze({
  "ci-probe.dofinances.com/": {
    type: "text/html; charset=utf-8",
    body: "<!doctype html><html><head><title>CI probe</title></head><body><h1>Wildcard CI probe</h1></body></html>",
  },
  "ci-probe.dofinances.com/nested/hello": {
    type: "text/html; charset=utf-8",
    body: "<!doctype html><html><head><title>CI nested probe</title></head><body><h1>Nested route works</h1></body></html>",
  },
});
