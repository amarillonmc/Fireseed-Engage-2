const BASE = 'http://127.0.0.1:8080';
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
const log = (l, r) => console.log(l, r.status, r.json?.error || '', r.json?.message || '');
let l = await req('POST', '/api/login', { username: 'admin', password: 'fireseed' }); csrf = l.json.csrf;
let b;
let st = (await req('GET', '/api/state')).json;
let city = st.cities[0];
console.log('start', city.id, st.resources, 'tapes', st.user.tapes);
// buy tapes
for (let i = 0; i < 2; i++) { const b = await req('POST', '/api/shop/buy', { itemId: 'chrono_tape' }); log('buy tape', b); }
// build lab at an empty cell
let cv = (await req('GET', `/api/city/${city.id}`)).json.city;
const hasLab = cv.facilities.some(f => f.type === 'lab');
if (!hasLab) {
  const occ = new Set(cv.grid.filter(c => c.type).map(c => `${c.gx},${c.gy}`));
  let cell = null;
  for (let y = 3; y < 20 && !cell; y++) for (let x = 3; x < 20 && !cell; x++) if (!occ.has(`${x},${y}`)) cell = { x, y };
  console.log('cell', cell);
  let b = await req('POST', `/api/city/${city.id}/build`, { type: 'lab', gx: cell.x, gy: cell.y });  log('build lab', b);
  b = await req('POST', `/api/city/${city.id}/instant`, {});
  log('instant lab', b);
} else console.log('lab already exists');
// research a seasonal tech that has room
let rv0 = (await req('GET', '/api/research')).json;
const tech = rv0.techs.find(t => t.scope === 'seasonal' && t.level === 0) || rv0.techs.find(t => t.canLevel);
if (tech) {
  let b = await req('POST', '/api/research', { techKey: tech.key });
  log('research ' + tech.key, b);
  b = await req('POST', `/api/city/${city.id}/instant`, {});
  log('instant research', b);
}
let rv = (await req('GET', '/api/research')).json;
console.log('lab level', rv.labLevel, 'research levels', rv.techs.filter(t => t.level > 0).map(t => `${t.key}:${t.level}`));
// assign general and activate innate
const gens = (await req('GET', '/api/generals')).json.owned;
const g = gens[0];
b = await req('POST', `/api/city/${city.id}/assign`, { playerGeneralId: g.id });
log('assign', b);
const skill = g.innate;
if (skill?.kind === 'active') { b = await req('POST', `/api/general/${g.id}/activate`, { skillKey: skill.key }); log('activate', b); }
else console.log('innate passive, skip activate');
// find adjacent resource/fort with acceptable defense
const map = (await req('GET', `/api/map?cx=${city.x}&cy=${city.y}&zoom=8`)).json;
const owned = new Set(map.tiles.filter(t => t[3] === st.user.id).map(t => `${t[0]},${t[1]}`));
const adjacent = map.tiles.filter(t => {
  if (!['resource', 'fort'].includes(t[2]) || t[3]) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (owned.has(`${t[0] + dx},${t[1] + dy}`)) return true;
  return false;
}).sort((a, b) => Math.max(Math.abs(a[0] - city.x), Math.abs(a[1] - city.y)) - Math.max(Math.abs(b[0] - city.x), Math.abs(b[1] - city.y)));
let target = null;
for (const t of adjacent.slice(0, 20)) {
  const detail = (await req('GET', `/api/tile/${t[0]}/${t[1]}`)).json.tile;
  if (!detail?.adjacent) continue;
  if (detail.garrisonCount > 300) continue;
  target = t; break;
}
console.log('adjacent candidates', adjacent.slice(0, 8).map(t => `${t[2]}@${t[0]},${t[1]}`), 'target', target?.slice(0, 5));
if (target) {
  const troops = { pawn: { count: 30, level: 1 }, knight: { count: 10, level: 1 }, bishop: { count: 5, level: 1 } };
  const pre = await req('POST', '/api/map/preview', { x: target[0], y: target[1], generalId: g.id, cityId: city.id, troops });
  console.log('preview', pre.json);
  const atk = await req('POST', '/api/map/attack', { x: target[0], y: target[1], generalId: g.id, cityId: city.id, troops });
  log('attack', atk);
  if (atk.json.arriveAt) {
    await new Promise(r => setTimeout(r, Math.max(2500, atk.json.arriveAt - Date.now() + 1500)));
    const rep = (await req('GET', '/api/reports')).json.reports;
    console.log('report', rep[0]?.title?.zh, rep[0]?.body?.zh);
  }
}
st = (await req('GET', '/api/state')).json;
console.log('end', { power: st.power, resources: st.resources, quests: st.quests.filter(q => q.claimable).map(q => q.key), tapes: st.user.tapes });
