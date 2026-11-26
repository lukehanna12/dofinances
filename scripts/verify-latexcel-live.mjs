import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const release = JSON.parse(readFileSync(new URL('../docs/latexcel-deployment.json', import.meta.url), 'utf8'));
const origin = 'https://latexcel.dofinances.com';
const logo = readFileSync(new URL('../sites/latexcel/logo.svg', import.meta.url),'utf8').trim();
async function get(url, verify) {
  let failure;
  for(let attempt=0; attempt<4; attempt++) {
    try { const r=await fetch(url, {signal:AbortSignal.timeout(20000)}); assert.equal(r.status,200,url); const bytes=Buffer.from(await r.arrayBuffer()); verify(bytes,r); return; }
    catch(e) { failure=e; if(attempt<3) await new Promise(r=>setTimeout(r,1500)); }
  }
  throw failure;
}
for(const [file,digest] of Object.entries(release.files)) {
  await get(origin+'/'+file+'?release='+release.sourceCommit,(bytes,r)=>{
    if(file.endsWith('.html')) {
      const html=bytes.toString('utf8').replace('<link rel="icon" type="image/svg+xml" href="/favicon.svg">','');
      assert.ok(html.includes('LaTeXceL'),file);
      assert.ok(html.includes(logo),file+' canonical logo');
      if(file!=='help.html') assert.ok(html.includes(release.mathjax.integrity),file);
      assert.match(r.headers.get('content-type')||'',/text\/html/);
    } else { assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,file); if(file.endsWith('.png')) assert.match(r.headers.get('content-type')||'',/^image\/png/); }
  });
  console.log('Verified '+file);
}
await get(origin+'/?release='+release.sourceCommit, bytes=>assert.ok(bytes.toString('utf8').includes(release.mathjax.integrity)));
await get('https://cdn.jsdelivr.net/npm/mathjax-full@'+release.mathjax.version+'/es5/tex-svg.js', bytes=>assert.equal('sha384-'+createHash('sha384').update(bytes).digest('base64'),release.mathjax.integrity));
console.log('LaTeXceL HTTPS distribution and pinned renderer integrity verified.');
