import './server/routes-game.mjs';
import './server/routes-admin.mjs';
import { startServer } from './server/http.mjs';
import { seedIfEmpty } from './server/world.mjs';
import { resolveDueMovements } from './server/combat.mjs';
import { checkVictory, autoRebuildIfDue } from './server/season.mjs';
import { closeDb } from './server/db.mjs';

console.log('[boot] checking world…');
const t0 = Date.now();
const seed = seedIfEmpty();
if (seed.seeded) {
  console.log(`[boot] world generated in ${Date.now() - t0}ms`);
  console.log(process.env.FIRESEED_ADMIN_PASSWORD
    ? '[boot] admin account: admin / (password from FIRESEED_ADMIN_PASSWORD)'
    : '[boot] admin account: admin / fireseed  (change this password immediately)');
}
const server = startServer();

let movementBusy = false;
const movementTimer = setInterval(() => {
  if (movementBusy) return;
  movementBusy = true;
  try { resolveDueMovements(50); checkVictory(); } catch (err) { console.error('[tick]', err); }
  finally { movementBusy = false; }
}, 1000);

let rebuildChecked = false;
const seasonTimer = setInterval(() => {
  if (rebuildChecked) return;
  rebuildChecked = true;
  try { autoRebuildIfDue(); } catch (err) { console.error('[season]', err); }
  finally { rebuildChecked = false; }
}, 60000);

function shutdown() {
  clearInterval(movementTimer);
  clearInterval(seasonTimer);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
