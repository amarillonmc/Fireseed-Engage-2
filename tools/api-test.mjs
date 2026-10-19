const BASE = 'http://127.0.0.1:8080';
let cookie = '';
let csrf = '';

async function req(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (json && json.csrf) csrf = json.csrf;
  return { status: r.status, json };
}

const login = await req('POST', '/api/login', { username: 'admin', password: 'fireseed' });
console.log('login', login.status, login.json.user?.displayName, login.json.error || '');
csrf = login.json.csrf;
const boot = await req('GET', '/api/bootstrap');
console.log('bootstrap', boot.status, 'season', boot.json.season?.name?.zh, 'meta units', Object.keys(boot.json.meta?.units ?? {}).length);
const state = await req('GET', '/api/state');
console.log('state', state.status, state.json.user?.displayName, 'resources', state.json.resources, 'power', state.json.power, 'err', state.json.error);
const cityId = state.json.cities?.[0]?.id;
const city = await req('GET', `/api/city/${cityId}`);
console.log('city', city.status, city.json.city?.name, 'facilities', city.json.city?.facilities?.length, 'troops', city.json.city?.troops, 'err', city.json.error);
const map = await req('GET', `/api/map?cx=${state.json.cities?.[0]?.x}&cy=${state.json.cities?.[0]?.y}&zoom=6`);
console.log('map', map.status, 'tiles', map.json.tiles?.length, 'cities', map.json.cities?.length, 'err', map.json.error);
const gens = await req('GET', '/api/generals');
console.log('generals', gens.status, 'owned', gens.json.owned?.length, 'catalog', gens.json.catalog?.length, 'err', gens.json.error);
const research = await req('GET', '/api/research');
console.log('research', research.status, 'techs', research.json.techs?.length, 'err', research.json.error);
const shop = await req('GET', '/api/shop');
console.log('shop', shop.status, 'items', shop.json.items?.length, 'err', shop.json.error);
const reports = await req('GET', '/api/reports');
console.log('reports', reports.status, 'count', reports.json.reports?.length, 'err', reports.json.error);
