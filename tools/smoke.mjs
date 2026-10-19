const BASE = process.env.BASE || 'http://127.0.0.1:8080';
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, e.message); }
}
await check('health', async () => {
  const r = await fetch(BASE + '/api/health');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (j.status !== 'ok') throw new Error('bad status');
});
await check('bootstrap', async () => {
  const r = await fetch(BASE + '/api/bootstrap');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j.map || !j.meta) throw new Error('missing bootstrap payload');
});
await check('landing page', async () => {
  const r = await fetch(BASE + '/');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text();
  if (!t.includes('Fireseed Engage') && !t.includes('种火集结号')) throw new Error('unexpected HTML');
});
await check('map api requires login', async () => {
  const r = await fetch(BASE + '/api/map?cx=256&cy=256&zoom=6');
  if (r.status !== 401) throw new Error('expected 401, got ' + r.status);
});
if (failed) { console.error(failed + ' checks failed'); process.exit(1); }
console.log('smoke ok');
