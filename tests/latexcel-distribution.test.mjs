import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../sites/latexcel/', import.meta.url);
const release = JSON.parse(readFileSync(new URL('../docs/latexcel-deployment.json', import.meta.url), 'utf8'));
test('LaTeXceL hosted distribution is identical to the verified source release', () => {
  assert.deepEqual(readdirSync(root).sort(), Object.keys(release.files).sort());
  for (const [file, digest] of Object.entries(release.files)) assert.equal(createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex'), digest, file);
  const manifest = readFileSync(new URL('manifest.xml', root), 'utf8');
  assert.match(manifest, /https:\/\/latexcel\.dofinances\.com\//);
  for (const page of ['index.html', 'taskpane.html']) assert.ok(readFileSync(new URL(page, root), 'utf8').includes(release.mathjax.integrity));
});
