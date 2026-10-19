const BASE = 'http://127.0.0.1:8080';
function client() {
  let cookie = '', csrf = '';
  async function req(m, p, b) {
    const h = { 'content-type': 'application/json' };
    if (cookie) h.cookie = cookie; if (csrf) h['x-csrf-token'] = csrf;
    const r = await fetch(BASE + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
    const s = r.headers.get('set-cookie'); if (s) cookie = s.split(';')[0];
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    if (j.csrf) csrf = j.csrf;
    return { status: r.status, json: j };
  }
  return { req, get csrf() { return csrf; }, set csrf(v) { csrf = v; } };
}
const log = (l, r) => console.log(l, r.status, r.json?.error || '', r.json?.message || '');
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); console.log('  ✓', msg); };

// New player
const U = client();
const username = 'test_' + Date.now().toString(36);
let r = await U.req('POST', '/api/register', { username, displayName: 'Test Driller', password: 'secret123', charter: 'bloom', locale: 'en' });
log('register', r);
assert(r.status === 200 && r.json.user, 'registration returns user');
let st = (await U.req('GET', '/api/state')).json;
console.log('new player', st.user.displayName, st.cities.length, st.generals, st.resources);
assert(st.cities.length === 1, 'starting city created');
assert(st.generals === 2, 'two starter Vanguards');
const city = st.cities[0];
// gacha
r = await U.req('POST', '/api/gacha/general', { times: 1 }); log('gacha', r);
assert(r.status === 200 && r.json.results.length === 1, 'general summon works');
r = await U.req('POST', '/api/gacha/skill', { times: 1 }); log('skill gacha', r);
assert(r.status === 200 && r.json.results.length === 1, 'skill summon works');
// build barracks
let cv = (await U.req('GET', `/api/city/${city.id}`)).json.city;
const occ = new Set(cv.grid.filter(c => c.type).map(c => `${c.gx},${c.gy}`));
let cell = null;
for (let y = 2; y < 20 && !cell; y++) for (let x = 2; x < 20 && !cell; x++) if (!occ.has(`${x},${y}`)) cell = { x, y };
r = await U.req('POST', `/api/city/${city.id}/build`, { type: 'barracks', gx: cell.x, gy: cell.y }); log('build', r);
assert(r.status === 200, 'barracks build starts');
r = await U.req('POST', `/api/city/${city.id}/instant`, {}); log('instant', r);
assert(r.status === 200, 'chrono tape instant');
r = await U.req('POST', `/api/city/${city.id}/train`, { unit: 'pawn', count: 10 }); log('train', r);
assert(r.status === 200, 'training starts');
await new Promise(res => setTimeout(res, 1800));
cv = (await U.req('GET', `/api/city/${city.id}`)).json.city;
assert((cv.troops.pawn?.count || 0) >= 70, 'trained pawns added');
// claim an adjacent empty
const map = (await U.req('GET', `/api/map?cx=${city.x}&cy=${city.y}&zoom=8`)).json;
const owned = new Set(map.tiles.filter(t => t[3] === st.user.id).map(t => `${t[0]},${t[1]}`));
let empty = null;
for (const t of map.tiles) {
  if (t[2] !== 'empty' || t[3]) continue;
  for (let dy = -1; dy <= 1 && !empty; dy++) for (let dx = -1; dx <= 1; dx++) if (owned.has(`${t[0] + dx},${t[1] + dy}`)) { empty = t; break; }
  if (empty) break;
}
if (empty) { r = await U.req('POST', '/api/map/claim', { x: empty[0], y: empty[1] }); log('claim', r); assert(r.status === 200, 'claim adjacent empty'); }
// alliance
r = await U.req('POST', '/api/alliance/create', { tag: 'TST' + Math.floor(Math.random() * 9), name: 'Test Syndicate', desc: 'automated' }); log('alliance', r);
assert(r.status === 200, 'alliance created');
r = await U.req('GET', '/api/alliance');
assert(r.json.mine && r.json.mine.members.length === 1, 'alliance membership visible');
// chat
r = await U.req('POST', '/api/chat', { body: 'hello data sea' }); log('chat', r);
assert(r.status === 200, 'chat post');

// Admin
const A = client();
r = await A.req('POST', '/api/login', { username: 'admin', password: 'fireseed' }); log('admin login', r); A.csrf = r.json.csrf;
assert(r.status === 200, 'admin login');
r = await A.req('POST', '/api/admin/generals', {
  key: 'test_card_' + Date.now().toString(36), name_zh: '测试武将', name_en: 'Test Vanguard', title_zh: '调试', title_en: 'Debug',
  source: 'Test', source_ref: 'T-1', rarity: 'S', cost: 2.5, element: 'bloom', base_atk: 60, base_def: 60, base_spd: 60, base_int: 60,
  art_url: '/assets/generals/placeholder.svg', pool_weight: 10, enabled: true, lore_zh: '测试', lore_en: 'Test',
}); log('admin create general', r);
assert(r.status === 200, 'admin creates general');
const newGeneralId = r.json.id;
r = await A.req('POST', `/api/admin/generals/${newGeneralId}`, { name_en: 'Test Vanguard II' }); log('admin update general', r);
assert(r.status === 200, 'admin updates general');
r = await A.req('POST', '/api/admin/skills', {
  key: 'test_skill_' + Date.now().toString(36), name_zh: '测试技能', name_en: 'Test Protocol', desc_zh: '测试', desc_en: 'Test',
  kind: 'passive', element: 'bloom', rare: 'S', max_level: 10, base_cooldown: 0, duration: 0,
  effects: '[{"type":"production_pct","scope":"all","value":0.05}]', pool_weight: 10, enabled: true,
}); log('admin create skill', r);
assert(r.status === 200, 'admin creates skill');
// settings read
r = await A.req('GET', '/api/admin/settings');
assert(r.json.settings.npc_strength > 0, 'settings readable');

// Season rebuild (last)
r = await A.req('POST', '/api/admin/season/rebuild', { confirm: 'REBUILD', nameZh: '测试赛季', nameEn: 'Test Cycle', holdDays: 1 });
log('season rebuild', r);
assert(r.status === 200 && r.json.seasonId, 'season rebuilt');
st = (await U.req('GET', '/api/state')).json;
console.log('after rebuild', { season: st.season?.number, cities: st.cities.length, generals: st.generals, lumen: st.resources.lumen, umbra: st.resources.umbra });
assert(st.season?.number >= 2, 'new season active');
assert(st.cities.length === 1, 'capital reassigned');
assert(st.generals >= 2, 'Vanguards preserved');
console.log('ALL TESTS PASSED');
