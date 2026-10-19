import { all, get, run, tx, now, getSetting, numberSetting, parseJson } from './db.mjs';
import { UNITS, ELEMENTS, SEASONAL_RESOURCES } from './config.mjs';
import {
  getUser, generalRow, generalStats, equippedSkills, innateSkill, skillScale,
  techMods, passiveSums, userBuffs, cityGenerals, cityTroops, cityFacilities,
  towerDefenseBonus, addReport, addCounter, addTransaction, currentSeasonId,
  refreshHole, addCurrency, generalMaxLevel,
} from './engine.mjs';
import { createCity, grantStarterTroops, findSpawn, gatewayPositions, fortGarrison, resourceGarrison } from './world.mjs';

const ADJ = [];
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) ADJ.push([dx, dy]);

export function areAllied(a, b) {
  if (!a || !b || a === b) return a === b;
  const va = get('SELECT * FROM vassals WHERE user_id=? OR liege_id=?', a, a);
  if (va && (va.user_id === b || va.liege_id === b)) return true;
  const vb = get('SELECT * FROM vassals WHERE user_id=? OR liege_id=?', b, b);
  if (vb && (vb.user_id === a || vb.liege_id === a)) return true;
  const ma = get('SELECT alliance_id FROM alliance_members WHERE user_id=?', a);
  const mb = get('SELECT alliance_id FROM alliance_members WHERE user_id=?', b);
  return !!(ma && mb && ma.alliance_id === mb.alliance_id);
}

export function hasAdjacentOwned(userId, x, y) {
  for (const [dx, dy] of ADJ) {
    const t = get('SELECT owner_id FROM tiles WHERE x=? AND y=?', x + dx, y + dy);
    if (t && t.owner_id === userId) return true;
  }
  return false;
}

export function distanceFromCity(city, x, y) {
  return Math.max(1, Math.max(Math.abs(city.x - x), Math.abs(city.y - y)));
}

export function getDefenders(x, y) {
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile) return null;
  if (tile.city_id) {
    const city = get('SELECT * FROM cities WHERE id=?', tile.city_id);
    if (!city) return { troops: {}, generals: [], durability: tile.durability, maxDurability: tile.max_durability, ownerId: tile.owner_id, city: null, tile };
    const troops = {};
    for (const t of all('SELECT * FROM city_troops WHERE city_id=? AND count>0', city.id)) troops[t.unit] = { count: t.count, level: t.level };
    const generals = cityGenerals(city.id);
    return { troops, generals, durability: city.durability, maxDurability: city.max_durability, ownerId: city.user_id, city, tile };
  }
  if (tile.owner_id) {
    const troops = {};
    for (const t of all('SELECT * FROM tile_garrison WHERE x=? AND y=? AND count>0', x, y)) troops[t.unit] = { count: t.count, level: t.level };
    const generals = all(`SELECT pg.*, g.*, pg.id AS id FROM tile_generals tg JOIN player_generals pg ON pg.id=tg.player_general_id JOIN generals g ON g.id=pg.general_id WHERE tg.x=? AND tg.y=?`, x, y);
    return { troops, generals, durability: tile.durability, maxDurability: tile.max_durability, ownerId: tile.owner_id, city: null, tile };
  }
  const strength = Number(getSetting('npc_strength', 0.08));
  let base;
  if (tile.type === 'resource') {
    const raw = resourceGarrison(parseJson(tile.res, {}));
    base = {};
    for (const [unit, count] of Object.entries(raw)) base[unit] = Math.max(1, Math.round(count * strength));
  } else if (tile.type === 'fort' || tile.type === 'gateway' || tile.type === 'hole') base = parseStoredOrFort(tile, strength);
  else base = {};
  const troops = {};
  const lvl = Math.max(1, Math.floor((tile.level ?? 1) / 3));
  for (const [unit, count] of Object.entries(base)) if (count > 0) troops[unit] = { count: Math.round(count), level: Math.max(1, lvl) };
  return { troops, generals: [], durability: tile.durability, maxDurability: tile.max_durability, ownerId: null, city: null, tile };
}

function parseStoredOrFort(tile, strength) {
  if (tile.garrison != null) return parseJson(tile.garrison, {});
  return fortGarrison(tile.level ?? 1, strength);
}

export function troopPower(troops, generalRows = [], { attack = false } = {}) {
  let total = 0;
  for (const pg of generalRows) {
    const s = generalStats(pg);
    total += attack ? s.atk : s.def;
  }
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    const def = UNITS[unit];
    if (!def || !entry) continue;
    const count = typeof entry === 'number' ? entry : entry.count;
    const level = typeof entry === 'number' ? 1 : (entry.level ?? 1);
    const lvlCoef = 1 + 0.1 * (level - 1);
    total += (attack ? def.atk : def.def) * lvlCoef * count;
  }
  return Math.round(total);
}

export function siegePower(troops, generalRows = [], mods = {}) {
  let total = 0;
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    if (unit !== 'golem' || !entry) continue;
    const count = typeof entry === 'number' ? entry : entry.count;
    const level = typeof entry === 'number' ? 1 : (entry.level ?? 1);
    total += UNITS.golem.siege * (1 + 0.1 * (level - 1)) * count;
  }
  return Math.round(total * (1 + (mods.siege_pct ?? 0)));
}

export function totalTroops(troops) {
  let n = 0;
  for (const entry of Object.values(troops ?? {})) n += typeof entry === 'number' ? entry : (entry?.count ?? 0);
  return n;
}

export function slowestUnit(troops) {
  let slow = 0;
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    const count = typeof entry === 'number' ? entry : (entry?.count ?? 0);
    if (count > 0) slow = Math.max(slow, UNITS[unit]?.speed ?? 2);
  }
  return slow || 2;
}

export function combatModifiers(userId, generals) {
  const mods = techMods(userId);
  const pass = passiveSums(generals, userId);
  const buffs = userBuffs(userId);
  return {
    attack_pct: (mods.attack_pct ?? 0) + pass.attack_pct + (buffs.buff_attack ?? 0),
    defense_pct: (mods.defense_pct ?? 0) + pass.defense_pct + (buffs.buff_defense ?? 0),
    siege_pct: (mods.siege_pct ?? 0) + pass.siege_pct,
    march_speed_pct: (mods.march_speed_pct ?? 0) + pass.march_speed_pct + (buffs.buff_march ?? 0),
    scout_pct: (mods.scout_pct ?? 0) + pass.scout_pct + (buffs.buff_scout ?? 0),
    attack: (mods.attack_pct ?? 0) + pass.attack_pct + (buffs.buff_attack ?? 0),
    defense: (mods.defense_pct ?? 0) + pass.defense_pct + (buffs.buff_defense ?? 0),
    siege: (mods.siege_pct ?? 0) + pass.siege_pct,
    march: (mods.march_speed_pct ?? 0) + pass.march_speed_pct + (buffs.buff_march ?? 0),
  };
}

export function startAttack(userId, { x, y, generalId, troops, cityId }) {
  const user = getUser(userId);
  if (!user) throw new Error('no_user');
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile) throw new Error('no_tile');
  if (tile.owner_id === userId) throw new Error('own_tile');
  if (tile.owner_id && areAllied(userId, tile.owner_id)) throw new Error('allied_tile');
  if (tile.type === 'hole') {
    const gw = get("SELECT COUNT(*) c FROM tiles WHERE owner_id=? AND type='gateway'", userId);
    if (!gw || gw.c < 1) throw new Error('need_gateway');
  } else if (!hasAdjacentOwned(userId, x, y)) {
    throw new Error('not_adjacent');
  }
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new Error('no_city');
  const pg = generalId ? generalRow(generalId) : null;
  if (generalId) {
    if (!pg || pg.user_id !== userId) throw new Error('no_general');
    if (pg.hp <= 0) throw new Error('general_downed');
    if (pg.location_type === 'army') throw new Error('general_busy');
  }
  const clean = {};
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    if (!UNITS[unit]) continue;
    const count = Math.max(0, Math.floor(Number(entry?.count ?? entry ?? 0)));
    if (!count) continue;
    const owned = get('SELECT count FROM city_troops WHERE city_id=? AND unit=?', cityId, unit)?.count ?? 0;
    if (count > owned) throw new Error('not_enough_troops');
    clean[unit] = { count, level: get('SELECT level FROM city_troops WHERE city_id=? AND unit=?', cityId, unit)?.level ?? 1 };
  }
  if (!Object.keys(clean).length && !pg) throw new Error('empty_army');
  const dist = distanceFromCity(city, x, y);
  const gens = pg ? [pg] : [];
  const mods = combatModifiers(userId, gens);
  const speed = slowestUnit(clean);
  const marchSetting = Number(getSetting('march_speed', 1));
  const seconds = Math.max(0.6, (speed * dist) / Math.max(0.2, (1 + mods.march) * marchSetting));
  const ts = now();
  const movementId = tx(() => {
    for (const [unit, entry] of Object.entries(clean)) {
      run('UPDATE city_troops SET count=count-? WHERE city_id=? AND unit=?', entry.count, cityId, unit);
    }
    run('DELETE FROM city_troops WHERE city_id=? AND count<=0', cityId);
    if (pg) {
      run('DELETE FROM city_generals WHERE player_general_id=?', pg.id);
      run("UPDATE player_generals SET location_type='army', location_id=NULL WHERE id=?", pg.id);
    }
    const r = run(`INSERT INTO movements (user_id,kind,from_x,from_y,to_x,to_y,general_id,troops,depart_at,arrive_at,status,target_user_id,meta,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId, 'attack', city.x, city.y, x, y, pg?.id ?? null, JSON.stringify(clean), ts, ts + Math.round(seconds * 1000), 'marching', tile.owner_id ?? null,
      JSON.stringify({ fromCityId: cityId, targetType: tile.type, targetName: tile.name_zh, targetLevel: tile.level }), ts);
    if (pg) run("UPDATE player_generals SET location_id=? WHERE id=?", r.lastInsertRowid, pg.id);
    return r.lastInsertRowid;
  });
  return { movementId, arriveAt: ts + Math.round(seconds * 1000), seconds };
}

export function startScout(userId, { x, y, count, cityId }) {
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new Error('no_city');
  const owned = get('SELECT count FROM city_troops WHERE city_id=? AND unit=\'scout\'', cityId)?.count ?? 0;
  count = Math.max(1, Math.floor(Number(count) || 0));
  if (count > owned) throw new Error('not_enough_scouts');
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile) throw new Error('no_tile');
  if (tile.owner_id === userId) throw new Error('own_tile');
  const dist = distanceFromCity(city, x, y);
  const mods = combatModifiers(userId, []);
  const seconds = Math.max(0.5, (2 * dist) / Math.max(0.2, (1 + mods.march) * Number(getSetting('march_speed', 1))));
  const ts = now();
  const mid = tx(() => {
    run('UPDATE city_troops SET count=count-? WHERE city_id=? AND unit=\'scout\'', count, cityId);
    run("DELETE FROM city_troops WHERE city_id=? AND count<=0", cityId);
    const r = run(`INSERT INTO movements (user_id,kind,from_x,from_y,to_x,to_y,general_id,troops,depart_at,arrive_at,status,target_user_id,meta,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId, 'scout', city.x, city.y, x, y, null, JSON.stringify({ scout: { count, level: 1 } }), ts, ts + Math.round(seconds * 1000), 'marching', tile.owner_id ?? null,
      JSON.stringify({ fromCityId: cityId, targetType: tile.type }), ts);
    return r.lastInsertRowid;
  });
  return { movementId: mid, arriveAt: ts + Math.round(seconds * 1000), seconds };
}

export function startReinforce(userId, { x, y, cityId, troops }) {
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new Error('no_city');
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile || tile.owner_id !== userId) throw new Error('own_tile');
  if (tile.city_id) throw new Error('already_city');
  const clean = {};
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    const count = Math.max(0, Math.floor(Number(entry?.count ?? entry ?? 0)));
    if (!count) continue;
    const owned = get('SELECT count, level FROM city_troops WHERE city_id=? AND unit=?', cityId, unit);
    if (!owned || count > owned.count) throw new Error('not_enough_troops');
    clean[unit] = { count, level: owned.level };
  }
  if (!Object.keys(clean).length) throw new Error('empty_army');
  const dist = distanceFromCity(city, x, y);
  const mods = combatModifiers(userId, []);
  const seconds = Math.max(0.6, (slowestUnit(clean) * dist) / Math.max(0.2, (1 + mods.march) * Number(getSetting('march_speed', 1))));
  const ts = now();
  const mid = tx(() => {
    for (const [unit, entry] of Object.entries(clean)) run('UPDATE city_troops SET count=count-? WHERE city_id=? AND unit=?', entry.count, cityId, unit);
    run('DELETE FROM city_troops WHERE city_id=? AND count<=0', cityId);
    const r = run(`INSERT INTO movements (user_id,kind,from_x,from_y,to_x,to_y,general_id,troops,depart_at,arrive_at,status,target_user_id,meta,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId, 'reinforce', city.x, city.y, x, y, null, JSON.stringify(clean), ts, ts + Math.round(seconds * 1000), 'marching', null,
      JSON.stringify({ fromCityId: cityId, targetType: tile.type }), ts);
    return r.lastInsertRowid;
  });
  return { movementId: mid, arriveAt: ts + Math.round(seconds * 1000), seconds };
}

export function applyCasualtiesToDefenders(def, keepRatio) {
  const t = def.tile;
  if (def.city) {
    for (const [unit, entry] of Object.entries(def.troops)) {
      const next = Math.floor(entry.count * keepRatio);
      if (next > 0) run('UPDATE city_troops SET count=? WHERE city_id=? AND unit=?', next, def.city.id, unit);
      else run('DELETE FROM city_troops WHERE city_id=? AND unit=?', def.city.id, unit);
    }
    return;
  }
  if (t.owner_id) {
    for (const [unit, entry] of Object.entries(def.troops)) {
      const next = Math.floor(entry.count * keepRatio);
      if (next > 0) run('UPDATE tile_garrison SET count=? WHERE x=? AND y=? AND unit=?', next, t.x, t.y, unit);
      else run('DELETE FROM tile_garrison WHERE x=? AND y=? AND unit=?', t.x, t.y, unit);
    }
    return;
  }
  const residual = {};
  for (const [unit, entry] of Object.entries(def.troops)) {
    const next = Math.floor(entry.count * keepRatio);
    if (next > 0) residual[unit] = next;
  }
  run('UPDATE tiles SET garrison=?, updated_at=? WHERE x=? AND y=?', JSON.stringify(residual), now(), t.x, t.y);
}

export function captureTile(attackerId, tile, cityId) {
  const ts = now();
  const user = getUser(attackerId);
  if (tile.type === 'resource') {
    const cost = Number(getSetting('resource_claim_circuit', 3));
    if ((user.circuit ?? 0) < cost) {
      addReport(attackerId, 'battle', '阵地已清空，回路不足', 'Garrison Cleared, Circuits Insufficient',
        `你击败了资源点的守军，但需要 ${cost} 点思考回路才能将其纳入版图。`, `You destroyed the resource garrison, but need ${cost} Circuit Points to annex the tile.`,
        { x: tile.x, y: tile.y, reason: 'circuit' });
      return { captured: false, reason: 'circuit' };
    }
    run('UPDATE users SET circuit=circuit-? WHERE id=?', cost, attackerId);
    addTransaction(attackerId, 'circuit', -cost, 'claim_resource');
    run('UPDATE tiles SET owner_id=?, city_id=NULL, garrison=\'{}\', occupied_at=?, updated_at=? WHERE x=? AND y=?', attackerId, ts, ts, tile.x, tile.y);
    addCounter(attackerId, 'claim', 1);
    return { captured: true, circuitCost: cost };
  }
  if (tile.type === 'empty') {
    run('UPDATE tiles SET owner_id=?, city_id=NULL, occupied_at=?, updated_at=? WHERE x=? AND y=?', attackerId, ts, ts, tile.x, tile.y);
    addCounter(attackerId, 'claim', 1);
    return { captured: true };
  }
  if (tile.type === 'fort' || tile.type === 'gateway' || tile.type === 'hole') {
    const level = tile.level ?? 1;
    const governor = tile.type === 'gateway' ? 6 : tile.type === 'hole' ? 10 : Math.max(2, Math.floor(level / 2));
    const nameZh = tile.type === 'gateway' ? `门城·${tile.name_zh}` : tile.type === 'hole' ? '银白之孔' : `前哨城 ${level}`;
    const nameEn = tile.type === 'gateway' ? `Gatehold ${tile.name_en}` : tile.type === 'hole' ? 'The Silver Bore' : `Outpost City ${level}`;
    const cid = createCity(attackerId, tile.x, tile.y, currentSeasonId(), {
      isCapital: 0, nameZh, nameEn, governorLevel: governor, tier: tile.type === 'hole' ? 4 : 2,
      tileType: tile.type === 'hole' ? 'hole' : tile.type === 'gateway' ? 'gateway' : 'city',
    });
    run('UPDATE tiles SET garrison=NULL, durability=(SELECT max_durability FROM cities WHERE id=?), max_durability=(SELECT max_durability FROM cities WHERE id=?) WHERE x=? AND y=?', cid, cid, tile.x, tile.y);
    if (tile.type === 'gateway') {
      addCounter(attackerId, 'gateway_capture', 1);
      refreshHole();
    }
    if (tile.type === 'hole') {
      const season = get("SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1");
      if (season) run('UPDATE seasons SET hole_holder_id=?, hole_since=? WHERE id=?', attackerId, ts, season.id);
      addCounter(attackerId, 'hole_capture', 1);
    }
    if (tile.type === 'fort') addCounter(attackerId, 'fort_capture', 1);
    addCounter(attackerId, 'claim', 1);
    return { captured: true, cityId: cid, newCity: true };
  }
  if (tile.owner_id) {
    const oldOwner = tile.owner_id;
    const city = tile.city_id ? get('SELECT * FROM cities WHERE id=?', tile.city_id) : null;
    if (city) {
      const gens = cityGenerals(city.id);
      for (const pg of gens) {
        run("UPDATE player_generals SET location_type='reserve', location_id=NULL, hp=MAX(1,hp-20) WHERE id=?", pg.id);
      }
      run('DELETE FROM city_generals WHERE city_id=?', city.id);
      run('DELETE FROM city_troops WHERE city_id=?', city.id);
      run('UPDATE cities SET user_id=?, is_capital=0, durability=?, max_durability=? WHERE id=?', attackerId, Math.round(city.max_durability * 0.35), city.max_durability, city.id);
      run('UPDATE tiles SET owner_id=?, garrison=\'{}\', durability=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', attackerId, Math.round(city.max_durability * 0.35), ts, ts, tile.x, tile.y);
      // loot
      const victim = getUser(oldOwner);
      if (victim) {
        for (const key of ['ember', 'cryo', 'bloom', 'radiance']) {
          const loot = Math.min(Math.floor((victim[key] ?? 0) * 0.15), 5000);
          if (loot > 0) {
            run(`UPDATE users SET ${key}=MAX(0,${key}-?) WHERE id=?`, loot, oldOwner);
            run(`UPDATE users SET ${key}=${key}+? WHERE id=?`, loot, attackerId);
          }
        }
      }
      const remaining = get('SELECT COUNT(*) c FROM cities WHERE user_id=?', oldOwner)?.c ?? 0;
      if (remaining === 0) respawnPlayer(oldOwner, attackerId);
      addCounter(attackerId, 'city_capture', 1);
      return { captured: true, cityId: city.id, cityCapture: true, oldOwner };
    }
    run('UPDATE tiles SET owner_id=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', attackerId, ts, ts, tile.x, tile.y);
    run('DELETE FROM tile_garrison WHERE x=? AND y=?', tile.x, tile.y);
    addCounter(attackerId, 'claim', 1);
    return { captured: true };
  }
  return { captured: false, reason: 'unknown' };
}

export function respawnPlayer(userId, attackerId) {
  run('DELETE FROM tile_garrison WHERE (x,y) IN (SELECT x,y FROM tiles WHERE owner_id=?)', userId);
  run('UPDATE tiles SET owner_id=NULL, city_id=NULL WHERE owner_id=? AND city_id IS NULL', userId);
  const gw = gatewayPositions();
  const g = gw[Math.floor(Math.random() * gw.length)];
  const pos = findSpawn(g.x + 20, g.y + 20, 60) || findSpawn(256, 256, 120);
  if (!pos) return false;
  const cid = createCity(userId, pos.x, pos.y, currentSeasonId(), { isCapital: 1, nameZh: '流亡钻台', nameEn: 'Exile Rig', governorLevel: 1, tier: 1 });
  grantStarterTroops(cid);
  run('UPDATE users SET ember=0,cryo=0,bloom=0,radiance=0,circuit=0 WHERE id=?', userId);
  run('INSERT INTO vassals (user_id,liege_id,since) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET liege_id=excluded.liege_id, since=excluded.since', userId, attackerId, now());
  addReport(userId, 'system', '你的钻台沉没了', 'Your Rig Has Sunk',
    '你失去了最后一座城塞。你被迫向征服者宣誓效忠，并在数据海的另一处重新下沉。', 'You lost your last bastion. You swore fealty to the conqueror and sank a new rig elsewhere in the Data Sea.',
    { liege: attackerId });
  return true;
}

export function applyCasualtiesToAttacker(troops, keepRatio) {
  const out = {};
  for (const [unit, entry] of Object.entries(troops)) {
    const next = Math.floor(entry.count * keepRatio);
    if (next > 0) out[unit] = { ...entry, count: next };
  }
  return out;
}

export function returnTroops(cityId, troops) {
  if (!cityId) return;
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    if (!entry.count) continue;
    run(`INSERT INTO city_troops (city_id,unit,count,level) VALUES (?,?,?,?)
      ON CONFLICT(city_id,unit) DO UPDATE SET count=count+excluded.count`, cityId, unit, entry.count, entry.level ?? 1);
  }
}

export function resolveBattle(movement) {
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', movement.to_x, movement.to_y);
  if (!tile) throw new Error('no_tile');
  const meta = parseJson(movement.meta, {});
  const fromCityId = meta.fromCityId;
  const attacker = getUser(movement.user_id);
  const attackerTroops = parseJson(movement.troops, {});
  const pg = movement.general_id ? generalRow(movement.general_id) : null;
  const generals = pg ? [pg] : [];
  const attMods = combatModifiers(movement.user_id, generals);
  const def = getDefenders(tile.x, tile.y);
  const defMods = def.ownerId ? combatModifiers(def.ownerId, def.generals) : { attack: 0, defense: 0 };
  const attackerAtk = Math.round((troopPower(attackerTroops, generals, { attack: true })) * (1 + attMods.attack));
  let defenderDef = Math.round(troopPower(def.troops, def.generals, { attack: false }) * (1 + defMods.defense));
  if (def.city) defenderDef = Math.round(defenderDef * (1 + towerDefenseBonus(def.city.id)));
  const defTroopCount = totalTroops(def.troops);
  const defenderLabel = def.ownerId ? (getUser(def.ownerId)?.display_name ?? 'Unknown') : (tile.name_en || tile.type);
  const typeZh = { resource: '资源点', fort: 'NPC 前哨', gateway: '十二门', hole: '银白之孔', empty: '空白地块' }[tile.type] || tile.type;
  const typeEn = { resource: 'Resource node', fort: 'NPC outpost', gateway: 'Gateway', hole: 'The Silver Bore', empty: 'Empty ground' }[tile.type] || tile.type;
  const defenderLabelZh = def.ownerId ? (getUser(def.ownerId)?.display_name ?? '未知') : `${typeZh}${tile.level ? ` Lv.${tile.level}` : ''}`;
  const defenderLabelEn = def.ownerId ? (getUser(def.ownerId)?.display_name ?? 'Unknown') : `${typeEn}${tile.level ? ` Lv.${tile.level}` : ''}`;
  const win = attackerAtk > Math.max(1, defenderDef) || (defTroopCount === 0 && defenderDef <= 0);

  const report = {
    x: tile.x, y: tile.y, attackerAtk, defenderDef, win,
    attackerTroops, defenderTroops: def.troops, targetType: tile.type,
    defender: defenderLabel,
  };
  const lostAll = !win;
  let survivors = attackerTroops;
  if (win) {
    const lossRatio = Math.min(0.55, Math.max(0.03, 0.5 * (defenderDef / Math.max(1, attackerAtk))));
    survivors = applyCasualtiesToAttacker(attackerTroops, 1 - lossRatio);
    report.attackerLossRatio = lossRatio;
    applyCasualtiesToDefenders(def, 0);
    if (pg) run('UPDATE player_generals SET exp=exp+60, hp=MAX(1,hp-8) WHERE id=?', pg.id);
    addCounter(movement.user_id, 'battle_win', 1);
  } else {
    report.defenderLossRatio = Math.min(0.4, Math.max(0.02, 0.5 * (attackerAtk / Math.max(1, defenderDef))));
    applyCasualtiesToDefenders(def, 1 - report.defenderLossRatio);
    if (pg) run('UPDATE player_generals SET exp=exp+20, hp=MAX(0,hp-28) WHERE id=?', pg.id);
    addCounter(movement.user_id, 'battle_loss', 1);
  }

  let capture = null;
  let durabilityLine = '';
  if (win) {
    const golems = attackerTroops.golem?.count ?? 0;
    const hasDurability = ['fort', 'gateway', 'hole'].includes(tile.type) || !!tile.city_id;
    if (hasDurability) {
      const dmg = siegePower(attackerTroops, generals, attMods);
      let newDur = Math.max(0, (tile.durability ?? 0) - dmg);
      if (tile.city_id) {
        const city = get('SELECT * FROM cities WHERE id=?', tile.city_id);
        if (city) {
          newDur = Math.max(0, city.durability - dmg);
          run('UPDATE cities SET durability=? WHERE id=?', newDur, city.id);
        }
      }
      run('UPDATE tiles SET durability=?, updated_at=? WHERE x=? AND y=?', newDur, now(), tile.x, tile.y);
      report.siegeDamage = dmg;
      report.durability = newDur;
      if (golems === 0) durabilityLine = ' No Breaker Rigs were present, so the plating was untouched.';
      else if (newDur > 0) durabilityLine = ` Breaker Rigs dealt ${dmg} siege damage; ${newDur} plating remains.`;
      else durabilityLine = ` Breaker Rigs tore through the last ${dmg} plating.`;
      if (newDur <= 0) {
        const fresh = get('SELECT * FROM tiles WHERE x=? AND y=?', tile.x, tile.y);
        capture = captureTile(movement.user_id, fresh, fromCityId);
      }
    } else {
      capture = captureTile(movement.user_id, tile, fromCityId);
    }
    if (!hasDurability) report.capture = capture;
  }

  // Return surviving troops and the general.
  const finalCity = capture?.cityId ?? fromCityId;
  returnTroops(finalCity, survivors);
  if (pg) {
    run("UPDATE player_generals SET location_type='city', location_id=? WHERE id=?", finalCity, pg.id);
    run('INSERT OR IGNORE INTO city_generals (city_id,player_general_id) VALUES (?,?)', finalCity, pg.id);
  }
  // If the origin city was captured in the same battle (attacking your own? impossible) fallback.
  const titleZh = win ? '战斗胜利' : '战斗失败';
  const titleEn = win ? 'Battle Won' : 'Battle Lost';
  const capZh = capture?.captured ? ' 你占领了该地块。' : (capture?.reason === 'circuit' ? ' 由于思考回路不足，未能占领。' : '');
  const capEn = capture?.captured ? ' The tile is now yours.' : (capture?.reason === 'circuit' ? ' The tile was not annexed because Circuits were insufficient.' : '');
  const bodyZh = `目标：${tile.name_zh || `${tile.x},${tile.y}`}（${defenderLabelZh}）。攻击力 ${attackerAtk} 对守备力 ${defenderDef}。${durabilityLine}${capZh}`;
  const bodyEn = `Target: ${tile.name_en || `${tile.x},${tile.y}`} (${defenderLabelEn}). Attack ${attackerAtk} vs defense ${defenderDef}.${durabilityLine}${capEn}`;
  addReport(movement.user_id, 'battle', titleZh, titleEn, bodyZh, bodyEn, report);

  if (def.ownerId && def.ownerId !== movement.user_id) {
    const incomingTitleZh = win ? '领地告急' : '守住了阵地';
    const incomingTitleEn = win ? 'Territory Lost' : 'Position Held';
    const inBodyZh = `坐标 ${tile.x},${tile.y} 遭到 ${attacker?.display_name ?? '未知钻探者'} 攻击。${win ? '守军全灭。' : '守军击退了进攻。'}`;
    const inBodyEn = `Tile ${tile.x},${tile.y} was attacked by ${attacker?.display_name ?? 'an unknown Driller'}. ${win ? 'The garrison was wiped out.' : 'The garrison repelled the assault.'}`;
    addReport(def.ownerId, 'battle', incomingTitleZh, incomingTitleEn, inBodyZh, inBodyEn, report);
  }
  return report;
}

export function resolveScout(movement) {
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', movement.to_x, movement.to_y);
  if (!tile) throw new Error('no_tile');
  const meta = parseJson(movement.meta, {});
  const troops = parseJson(movement.troops, {});
  const sent = troops.scout?.count ?? 0;
  const def = getDefenders(tile.x, tile.y);
  let detection = 0;
  if (def.city) {
    detection = get('SELECT count FROM city_troops WHERE city_id=? AND unit=\'scout\'', def.city.id)?.count ?? 0;
    const watch = get('SELECT level FROM facilities WHERE city_id=? AND type=\'watchtower\'', def.city.id);
    if (watch) detection += watch.level * 15;
  } else if (def.ownerId) {
    detection = get('SELECT count FROM tile_garrison WHERE x=? AND y=? AND unit=\'scout\'', tile.x, tile.y)?.count ?? 0;
  }
  const mods = combatModifiers(movement.user_id, []);
  const effective = Math.round(sent * (1 + mods.scout));
  const success = effective > detection;
  if (success) {
    const payload = {
      x: tile.x, y: tile.y, type: tile.type, level: tile.level, durability: tile.durability,
      maxDurability: tile.max_durability, res: parseJson(tile.res, {}), ownerId: tile.owner_id,
      troops: def.troops, generals: def.generals.map((g) => ({ name_zh: g.name_zh, name_en: g.name_en, rarity: g.rarity, element: g.element, level: g.level })),
      scoutedAt: now(),
    };
    run(`INSERT INTO scouting (user_id,x,y,payload,expires_at,created_at) VALUES (?,?,?,?,?,?)`,
      movement.user_id, tile.x, tile.y, JSON.stringify(payload), now() + 3600000, now());
    addReport(movement.user_id, 'scout', '侦察成功', 'Reconnaissance Complete',
      `坐标 ${tile.x},${tile.y} 的详细军情已上传。`, `Detailed intel for tile ${tile.x},${tile.y} has been uploaded.`, payload);
  } else {
    addReport(movement.user_id, 'scout', '侦察失败', 'Reconnaissance Failed',
      `坐标 ${tile.x},${tile.y} 的守军察觉了你的侦察兵（派出 ${sent}，侦测阈值 ${detection}）。`, `The garrison at ${tile.x},${tile.y} detected your scouts (sent ${sent}, detection ${detection}).`,
      { x: tile.x, y: tile.y, sent, detection });
  }
  const back = Math.floor(sent * 0.5);
  if (back > 0) returnTroops(meta.fromCityId, { scout: { count: back, level: 1 } });
  return { success, detection, sent };
}

export function resolveMovement(movement) {
  if (movement.kind === 'attack') return resolveBattle(movement);
  if (movement.kind === 'scout') return resolveScout(movement);
  if (movement.kind === 'reinforce') {
    const meta = parseJson(movement.meta, {});
    const troops = parseJson(movement.troops, {});
    for (const [unit, entry] of Object.entries(troops)) {
      run(`INSERT INTO tile_garrison (x,y,unit,count,level) VALUES (?,?,?,?,?)
        ON CONFLICT(x,y,unit) DO UPDATE SET count=count+excluded.count`, movement.to_x, movement.to_y, unit, entry.count, entry.level ?? 1);
    }
    return { reinforced: true };
  }
  return {};
}

export function resolveDueMovements(limit = 50) {
  const due = all("SELECT * FROM movements WHERE status='marching' AND arrive_at<=? ORDER BY arrive_at LIMIT ?", now(), limit);
  for (const m of due) {
    try {
      tx(() => {
        resolveMovement(m);
        run("UPDATE movements SET status='done' WHERE id=?", m.id);
      });
    } catch (err) {
      try {
        tx(() => {
          run("UPDATE movements SET status='failed' WHERE id=?", m.id);
          const meta = parseJson(m.meta, {});
          const troops = parseJson(m.troops, {});
          if (m.kind === 'attack') {
            returnTroops(meta.fromCityId, troops);
            if (m.general_id) {
              run("UPDATE player_generals SET location_type='city', location_id=? WHERE id=?", meta.fromCityId, m.general_id);
              run('INSERT OR IGNORE INTO city_generals (city_id,player_general_id) VALUES (?,?)', meta.fromCityId, m.general_id);
            }
          }
          addReport(m.user_id, 'system', '行军中止', 'March Aborted', `一支军队未能抵达目标。原因：${err.message}`, `An army failed to reach its target. Reason: ${err.message}`, {});
        });
      } catch { /* ignore */ }
    }
  }
  return due.length;
}

export function intelFor(userId, x, y) {
  const tile = get(`SELECT t.*, u.display_name owner_name FROM tiles t LEFT JOIN users u ON u.id=t.owner_id WHERE t.x=? AND t.y=?`, x, y);
  if (!tile) return null;
  const def = getDefenders(x, y);
  const own = tile.owner_id === userId;
  let scouted = null;
  if (!own && tile.owner_id) {
    scouted = get('SELECT * FROM scouting WHERE user_id=? AND x=? AND y=? AND expires_at>? ORDER BY id DESC LIMIT 1', userId, x, y, now());
  }
  const detailed = own || !tile.owner_id || !!scouted;
  const payload = {
    x: tile.x, y: tile.y, type: tile.type, level: tile.level, name_zh: tile.name_zh, name_en: tile.name_en,
    owner_id: tile.owner_id, owner_name: tile.owner_name, city_id: tile.city_id,
    res: parseJson(tile.res, {}), durability: tile.durability, max_durability: tile.max_durability,
    gateway_dir: tile.gateway_dir, occupied_at: tile.occupied_at,
    detailed,
    scouted: !!scouted,
    canAttack: tile.owner_id !== userId,
    adjacent: hasAdjacentOwned(userId, x, y),
    distance: null,
  };
  if (tile.city_id) {
    const c = get('SELECT * FROM cities WHERE id=?', tile.city_id);
    if (c) {
      payload.city = { id: c.id, name_zh: c.name_zh, name_en: c.name_en, is_capital: c.is_capital, governor_level: c.governor_level };
      payload.durability = c.durability;
      payload.max_durability = c.max_durability;
    }
  }
  if (detailed) {
    payload.garrison = def?.troops ?? {};
    payload.generals = (def?.generals ?? []).map((g) => ({ name_zh: g.name_zh, name_en: g.name_en, rarity: g.rarity, element: g.element, level: g.level }));
    payload.garrisonCount = totalTroops(def?.troops ?? {});
    payload.defense = Math.round(troopPower(def?.troops ?? {}, def?.generals ?? [], { attack: false }));
  } else {
    payload.garrisonUnknown = true;
  }
  return payload;
}

export function previewAttack(userId, { x, y, generalId, troops, cityId }) {
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new Error('no_city');
  const pg = generalId ? generalRow(generalId) : null;
  const generals = pg ? [pg] : [];
  const mods = combatModifiers(userId, generals);
  const clean = {};
  for (const [unit, entry] of Object.entries(troops ?? {})) {
    const count = Math.floor(Number(entry?.count ?? entry ?? 0));
    if (count > 0) clean[unit] = { count, level: entry?.level ?? 1 };
  }
  const atk = Math.round(troopPower(clean, generals, { attack: true }) * (1 + mods.attack));
  const intel = intelFor(userId, x, y);
  const def = intel?.detailed ? intel.defense : null;
  const siege = siegePower(clean, generals, mods);
  return {
    attack: atk, defense: def, siege,
    odds: def == null ? null : Math.max(0, Math.min(1, atk / Math.max(1, atk + def))),
    travelSeconds: Math.max(0.6, (slowestUnit(clean) * distanceFromCity(city, x, y)) / Math.max(0.2, (1 + mods.march) * Number(getSetting('march_speed', 1)))),
  };
}
