import fs from 'node:fs';
import path from 'node:path';

const data = path.join(process.cwd(), 'data');
const files = ['fireseed.db', 'fireseed.db-wal', 'fireseed.db-shm'];
let removed = 0;
for (const f of files) {
  const p = path.join(data, f);
  if (fs.existsSync(p)) {
    try { fs.rmSync(p, { force: true }); removed++; console.log('removed', p); }
    catch (e) { console.error('could not remove', p, '- is the server still running?', e.message); process.exitCode = 1; }
  }
}
if (!removed) console.log('nothing to remove; data/fireseed.db does not exist');
console.log('start the server with: node server.mjs');
console.log('the world will be regenerated on first boot (20–40s).');
