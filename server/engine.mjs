import { all, get, run, tx, now, getSetting, numberSetting, parseJson } from './db.mjs';
import { ELEMENTS, SEASONAL_RESOURCES, RARITIES, RARITY_ORDER, CHARTERS, UNITS } from './config.mjs';

export const DAY = 86400000;
export const HOUR = 3600000;

export function getUser(userId) {
  return get('SELECT * FROM users WHERE id=?', userId);
}

export function ensureEconomy(userId) {
  let eco = get('SELECT * FROM economy WHERE user_id=?', userId);
  if (!eco) {
    run('INSERT INTO economy (user_id,last_tick,frac,circuit_frac) VALUES (?,?,?,0)', userId, now(), '{}');
    eco = get('SELECT * FROM economy WHERE user_id=?', userId);
  }
  return eco;
}

export function techLevel(userId, key) {
  const row = get('SELECT level FROM player_techs WHERE user_id=? AND tech_key=?', userId, key);
  return row?.level ?? 0;
}

export function techMods(userId) {
  const rows = all(`SELECT t.effect_key, t.effect_value, t.effect_growth, p.level
    FROM player_techs p JOIN tech_defs t ON t.key=p.tech_key WHERE p.user_id=?`, userId);
  const out = {};
  for (const r of rows) {
    if (!r.level) continue;
    const value = r.effect_value * (1 + (r.level - 1) * r.effect_growth);
    out[r.effect_key] = (out[r.effect_key] ?? 0) + value;
  }
  return out;
}

export function generalRow(playerGeneralId) {
  return get(`SELECT pg.*, g.*, g.id AS general_id, pg.id AS id, g.name_zh, g.name_en, g.title_zh, g.title_en,
    g.rarity, g.cost, g.element, g.base_hp, g.base_atk, g.base_def, g.base_spd, g.base_int, g.art_url,
    g.innate_skill_id, g.source, g.lore_zh, g.lore_en
    FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.id=?`, playerGeneralId);
}

export function generalStats(pg) {
  if (!pg) return null;
  const lvl = pg.level ?? 1;
  const cost = pg.cost ?? 1;
  const dupes = Math.min(pg.dupes ?? 0, 10);
  const dupMul = 1 + dupes * 0.02;
  const atk = Math.round(pg.base_atk * (1 + lvl * 0.1) * (1 + cost * 0.2) * dupMul);
  const def = Math.round(pg.base_def * (1 + lvl * 0.1) * (1 + cost * 0.2) * dupMul);
  const spd = Math.round(pg.base_spd * (1 + lvl * 0.05) * (1 + cost * 0.1) * dupMul);
  const int = Math.round(pg.base_int * (1 + lvl * 0.1) * (1 + cost * 0.2) * dupMul);
  return { hp: pg.base_hp ?? 100, atk, def, spd, int };
}

export function generalPower(pg) {
  const s = generalStats(pg);
  if (!s) return 0;
  return Math.round((s.atk + s.def + s.int + s.spd) * (1 + (pg.dupes ?? 0) * 0.02) + (pg.level ?? 1) * 8);
}

export function generalMaxLevel(userId) {
  const row = get('SELECT MAX(governor_level) m FROM cities WHERE user_id=?', userId);
  return Math.max(5, Math.min(50, (row?.m ?? 1) * 5));
}

export function generalLevelCost(pg, userId) {
  const mods = techMods(userId);
  const discount = Math.min(0.5, mods.general_cost_discount_pct ?? 0);
  return Math.max(20, Math.round(60 * (pg.level + 1) * (1 + (pg.cost ?? 1) * 0.4) * (1 - discount)));
}

export function equippedSkills(playerGeneralId) {
  return all(`SELECT gs.slot, ps.*, sd.*, ps.id AS player_skill_id, sd.id AS skill_id
    FROM general_skills gs JOIN player_skills ps ON ps.id=gs.player_skill_id JOIN skill_defs sd ON sd.id=ps.skill_id
    WHERE gs.player_general_id=? ORDER BY gs.slot`, playerGeneralId);
}

export function innateSkill(pg) {
  if (!pg?.innate_skill_id) return null;
  return get('SELECT * FROM skill_defs WHERE id=?', pg.innate_skill_id);
}

export function skillScale(pg, skillLevel) {
  const stats = generalStats(pg);
  return (1 + (skillLevel - 1) * 0.18) * (1 + (stats?.int ?? 50) / 200);
}

export function passiveSums(generals, userId) {
  const out = {
    production_all: 0, production_lumen: 0, production_ember: 0, production_cryo: 0,
    production_bloom: 0, production_radiance: 0, production_umbra: 0,
    storage_pct: 0, train_speed_pct: 0, build_speed_pct: 0, research_speed_pct: 0,
    march_speed_pct: 0, attack_pct: 0, defense_pct: 0, siege_pct: 0, scout_pct: 0,
    hp_regen_pct: 0, circuit_rate_pct: 0,
  };
  for (const pg of generals) {
    const innate = innateSkill(pg);
    const equipped = equippedSkills(pg.id);
    const list = [];
    if (innate) list.push({ ...innate, skillLevel: Math.max(1, Math.round((pg.level ?? 1) / 3) + 1) });
    for (const s of equipped) list.push({ ...s, skillLevel: s.level });
    for (const s of list) {
      if (s.kind !== 'passive') continue;
      const scale = skillScale(pg, s.skillLevel ?? 1);
      for (const e of parseJson(s.effects, [])) {
        if (e.type === 'production_pct') {
          if (e.scope === 'all' || !e.scope) out.production_all += e.value * scale;
          else if (out[`production_${e.scope}`] != null) out[`production_${e.scope}`] += e.value * scale;
        } else if (out[e.type] != null) {
          out[e.type] += e.value * scale;
        }
      }
    }
  }
  return out;
}

export function userBuffs(userId) {
  const rows = all('SELECT * FROM buffs WHERE user_id=? AND expires_at>?', userId, now());
  const out = {};
  for (const b of rows) out[b.kind] = (out[b.kind] ?? 0) + b.value;
  return out;
}

export function cityFacilities(cityId) {
  return all('SELECT * FROM facilities WHERE city_id=? ORDER BY id', cityId);
}

export function cityGenerals(cityId) {
  return all(`SELECT pg.*, g.*, pg.id AS id, g.id AS general_id
    FROM city_generals cg JOIN player_generals pg ON pg.id=cg.player_general_id JOIN generals g ON g.id=pg.general_id
    WHERE cg.city_id=?`, cityId);
}

export function cityTroops(cityId) {
  return all('SELECT * FROM city_troops WHERE city_id=? AND count>0', cityId);
}

export function towerDefenseBonus(cityId) {
  const facs = cityFacilities(cityId);
  const watch = facs.find((f) => f.type === 'watchtower');
  const work = facs.find((f) => f.type === 'workshop');
  let bonus = 0;
  if (watch) bonus += 0.08 * watch.level;
  if (work) bonus += 0.08 * work.level;
  return bonus;
}

export function cityMaxDurability(cityId, userId) {
  const city = get('SELECT * FROM cities WHERE id=?', cityId);
  if (!city) return 0;
  const facs = cityFacilities(cityId);
  const gov = facs.find((f) => f.type === 'governor');
  const govLevel = gov?.level ?? 1;
  const mods = techMods(userId);
  const techDef = (mods.defense_pct ?? 0);
  return Math.round(3000 * Math.pow(1.5, govLevel - 1) * (1 + towerDefenseBonus(cityId)) * (1 + techDef));
}

export function storageCap(userId) {
  const base = numberSetting('storage_base', 100000);
  const facs = all(`SELECT f.* FROM facilities f JOIN cities c ON c.id=f.city_id WHERE c.user_id=? AND f.type='storage'`, userId);
  let capacity = base;
  for (const f of facs) capacity += base * (1 + 0.5 * (f.level - 1));
  const mods = techMods(userId);
  const gens = all(`SELECT pg.*, g.*, pg.id AS id FROM city_generals cg JOIN player_generals pg ON pg.id=cg.player_general_id JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?`, userId);
  const pass = passiveSums(gens, userId);
  return Math.round(capacity * (1 + (mods.storage_pct ?? 0) + pass.storage_pct));
}

export function circuitCap(userId) {
  const mods = techMods(userId);
  return Math.round(numberSetting('circuit_base_cap', 20) + (mods.circuit_cap ?? 0));
}

export function troopCap(userId) {
  const facs = all(`SELECT f.* FROM facilities f JOIN cities c ON c.id=f.city_id WHERE c.user_id=? AND f.type='dorm'`, userId);
  let cap = 300;
  for (const f of facs) cap += 1000 * (1 + 0.5 * (f.level - 1));
  return Math.round(cap);
}

export function unitLevelFor(userId, unitKey, cityId = null) {
  const unit = UNITS[unitKey];
  if (!unit) return 1;
  const facType = unit.unlock;
  if (cityId) {
    const f = get('SELECT level FROM facilities WHERE city_id=? AND type=?', cityId, facType);
    return f ? Math.max(1, f.level - 1) : 1;
  }
  const f = get(`SELECT MAX(f.level) l FROM facilities f JOIN cities c ON c.id=f.city_id WHERE c.user_id=? AND f.type=?`, userId, facType);
  return Math.max(1, (f?.l ?? 1) - 1);
}

export function productionPerCity(userId) {
  const cities = all('SELECT * FROM cities WHERE user_id=?', userId);
  const mods = techMods(userId);
  const user = getUser(userId);
  const tick = Math.max(0.2, Number(getSetting('resource_tick_seconds', 3)));
  const mult = Number(getSetting('resource_yield', 1));
  const result = {};
  for (const el of ELEMENTS) result[el] = 0;
  let circuit = 0;
  for (const city of cities) {
    const gens = cityGenerals(city.id);
    const pass = passiveSums(gens, userId);
    const facs = cityFacilities(city.id);
    const cityRates = {};
    for (const el of ELEMENTS) cityRates[el] = 0;
    for (const f of facs) {
      if (!f.type.startsWith('extractor_')) continue;
      const el = f.type.slice('extractor_'.length);
      const base = (1 / tick) * (1 + 0.5 * (f.level - 1)) * (el === 'lumen' || el === 'umbra' ? 0.12 : 1);
      cityRates[el] += base;
    }
    for (const el of ELEMENTS) {
      let pct = (mods[`production_${el}`] ?? 0) + (mods.production_all_pct ?? 0)
        + (pass[`production_${el}`] ?? 0) + pass.production_all;
      if (user?.charter === el) pct += 0.06;
      result[el] += cityRates[el] * (1 + pct);
    }
    const gov = facs.find((f) => f.type === 'governor');
    if (gov) {
      let c = (1 / (Number(getSetting('circuit_hours', 48)) * 3600)) * (1 + 0.1 * (gov.level - 1));
      c *= (1 + (mods.circuit_rate_pct ?? 0) + pass.circuit_rate_pct);
      circuit += c;
    }
  }
  // Territory yields are empire-wide and benefit from global research only.
  const tiles = all("SELECT res FROM tiles WHERE owner_id=? AND type='resource'", userId);
  const tileRates = {};
  for (const t of tiles) {
    const res = parseJson(t.res, {});
    for (const [el, n] of Object.entries(res)) {
      tileRates[el] = (tileRates[el] ?? 0) + n * (mult / tick);
    }
  }
  for (const el of ELEMENTS) {
    const pct = (mods[`production_${el}`] ?? 0) + (mods.production_all_pct ?? 0) + (user?.charter === el ? 0.06 : 0);
    result[el] += (tileRates[el] ?? 0) * (1 + pct);
  }
  return { perSecond: result, circuitPerSecond: circuit };
}

export function aggregateRates(userId) {
  const { perSecond, circuitPerSecond } = productionPerCity(userId);
  const caps = {
    lumen: 1000000000, umbra: 1000000000,
    ember: storageCap(userId), cryo: storageCap(userId), bloom: storageCap(userId), radiance: storageCap(userId),
    circuit: circuitCap(userId),
  };
  return { perSecond, circuitPerSecond, caps };
}

export function applyHpRegen(userId) {
  const rows = all(`SELECT pg.*, g.innate_skill_id FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=? AND pg.hp<100`, userId);
  if (!rows.length) return;
  const ts = now();
  const gens = all(`SELECT pg.*, g.*, pg.id AS id FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?`, userId);
  const pass = passiveSums(gens, userId);
  for (const pg of rows) {
    const elapsed = Math.max(0, ts - (pg.hp_at ?? ts)) / 1000;
    if (elapsed < 1) continue;
    const perSec = (100 / (24 * 3600)) * (1 + (pass.hp_regen_pct ?? 0));
    const healed = Math.floor(elapsed * perSec);
    if (healed > 0) {
      run('UPDATE player_generals SET hp=MIN(100,hp+?), hp_at=? WHERE id=?', healed, ts, pg.id);
    } else {
      run('UPDATE player_generals SET hp_at=? WHERE id=?', ts, pg.id);
    }
  }
}

export function settleCity(city) {
  const ts = now();
  const facs = cityFacilities(city.id);
  for (const f of facs) {
    if (f.build_ends_at && f.build_ends_at <= ts) {
      const target = f.upgrade_to ?? f.level;
      run('UPDATE facilities SET level=?, status=\'active\', build_ends_at=NULL, upgrade_to=NULL WHERE id=?', target, f.id);
    }
  }
  // Keep troop tiers synced with their producing facility.
  const syncFac = (type, units) => {
    const f = get('SELECT level FROM facilities WHERE city_id=? AND type=? AND status=\'active\'', city.id, type);
    if (!f) return;
    const lvl = Math.max(1, f.level - 1);
    for (const unit of units) run('UPDATE city_troops SET level=MAX(level,?) WHERE city_id=? AND unit=?', lvl, city.id, unit);
  };
  syncFac('barracks', ['pawn', 'knight', 'rook', 'bishop']);
  syncFac('workshop', ['golem']);
  syncFac('watchtower', ['scout']);
  // Keep city governor level / durability in sync
  const gov = get('SELECT level FROM facilities WHERE city_id=? AND type=\'governor\'', city.id);
  if (gov) {
    const max = cityMaxDurability(city.id, city.user_id);
    const oldMax = city.max_durability || max;
    const ratio = oldMax > 0 ? Math.min(1, city.durability / oldMax) : 1;
    run('UPDATE cities SET governor_level=?, max_durability=?, durability=? WHERE id=?', gov.level, max, Math.round(max * ratio), city.id);
  }
  // Complete training
  const trains = all('SELECT * FROM training WHERE city_id=? AND finish_at<=?', city.id, ts);
  if (trains.length) {
    const cap = troopCap(city.user_id);
    for (const t of trains) {
      const current = get('SELECT SUM(count) s FROM city_troops WHERE city_id=?', city.id)?.s ?? 0;
      const room = Math.max(0, cap - current);
      const add = Math.min(t.total - t.done, room);
      if (add > 0) {
        run(`INSERT INTO city_troops (city_id,unit,count,level) VALUES (?,?,?,?)
          ON CONFLICT(city_id,unit) DO UPDATE SET count=count+excluded.count`, city.id, t.unit, add, unitLevelFor(city.user_id, t.unit, city.id));
        addCounter(city.user_id, 'train', add);
      }
      run('DELETE FROM training WHERE id=?', t.id);
    }
  }
}

export function settleUser(userId) {
  const cities = all('SELECT * FROM cities WHERE user_id=?', userId);
  for (const c of cities) settleCity(c);
  const queue = get('SELECT * FROM research_queue WHERE user_id=? AND finish_at<=?', userId, now());
  if (queue) {
    run(`INSERT INTO player_techs (user_id,tech_key,level) VALUES (?,?,?)
      ON CONFLICT(user_id,tech_key) DO UPDATE SET level=excluded.level`, userId, queue.tech_key, queue.target_level);
    run('DELETE FROM research_queue WHERE id=?', queue.id);
    addCounter(userId, 'research', 1);
  }
  applyHpRegen(userId);
}

export function accrue(userId) {
  settleUser(userId);
  const user = getUser(userId);
  if (!user) return null;
  const eco = ensureEconomy(userId);
  const ts = now();
  const capHours = numberSetting('offline_cap_hours', 12) + (techMods(userId).offline_cap_hours ?? 0);
  const dt = Math.max(0, Math.min((ts - eco.last_tick) / 1000, capHours * 3600));
  if (dt <= 0) return { user, rates: aggregateRates(userId) };
  const rates = aggregateRates(userId);
  const frac = parseJson(eco.frac, {});
  const update = {};
  for (const key of ['lumen', 'umbra', 'ember', 'cryo', 'bloom', 'radiance']) {
    const cap = rates.caps[key];
    const current = user[key] ?? 0;
    if (current >= cap) { frac[key] = 0; update[key] = current; continue; }
    const gain = (frac[key] ?? 0) + rates.perSecond[key] * dt;
    const whole = Math.floor(gain);
    const next = Math.min(cap, current + whole);
    update[key] = next;
    frac[key] = next >= cap ? 0 : gain - whole;
  }
  let circuit = user.circuit ?? 0;
  let cfrac = (eco.circuit_frac ?? 0) + rates.circuitPerSecond * dt;
  const ccap = rates.caps.circuit;
  if (circuit < ccap) {
    const gain = Math.floor(cfrac);
    circuit = Math.min(ccap, circuit + gain);
    cfrac = circuit >= ccap ? 0 : cfrac - gain;
  } else {
    cfrac = 0;
  }
  run(`UPDATE users SET lumen=?,umbra=?,ember=?,cryo=?,bloom=?,radiance=?,circuit=?,last_seen_at=? WHERE id=?`,
    update.lumen, update.umbra, update.ember, update.cryo, update.bloom, update.radiance, circuit, ts, userId);
  run('UPDATE economy SET last_tick=?, frac=?, circuit_frac=?, offline_seconds=? WHERE user_id=?', ts, JSON.stringify(frac), cfrac, Math.round(dt), userId);
  return { user: getUser(userId), rates };
}

export function addCounter(userId, key, amount = 1) {
  run(`INSERT INTO counters (user_id,key,value) VALUES (?,?,?)
    ON CONFLICT(user_id,key) DO UPDATE SET value=value+excluded.value`, userId, key, amount);
}

export function addReport(userId, kind, titleZh, titleEn, bodyZh, bodyEn, payload = {}) {
  run(`INSERT INTO reports (user_id,kind,title_zh,title_en,body_zh,body_en,payload,read,created_at)
    VALUES (?,?,?,?,?,?,?,0,?)`, userId, kind, titleZh, titleEn, bodyZh, bodyEn, JSON.stringify(payload), now());
}

export function addTransaction(userId, currency, amount, reason) {
  run('INSERT INTO transactions (user_id,currency,amount,reason,created_at) VALUES (?,?,?,?,?)', userId, currency, amount, reason, now());
}

export function addCurrency(userId, key, amount) {
  if (!['lumen', 'umbra', 'circuit'].includes(key)) return;
  run(`UPDATE users SET ${key}=MAX(0,${key}+?) WHERE id=?`, amount, userId);
  addTransaction(userId, key, amount, 'grant');
}

export function playerPower(userId) {
  const gens = all(`SELECT pg.*, g.cost, g.base_atk, g.base_def, g.base_spd, g.base_int, g.base_hp FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?`, userId);
  const gp = gens.reduce((s, g) => s + generalPower(g), 0);
  const troops = get(`SELECT SUM(ct.count) s FROM city_troops ct JOIN cities c ON c.id=ct.city_id WHERE c.user_id=?`, userId)?.s ?? 0;
  const tiles = get('SELECT COUNT(*) c FROM tiles WHERE owner_id=?', userId)?.c ?? 0;
  const tech = get('SELECT SUM(level) s FROM player_techs WHERE user_id=?', userId)?.s ?? 0;
  const gateways = get("SELECT COUNT(*) c FROM tiles WHERE owner_id=? AND type='gateway'", userId)?.c ?? 0;
  return Math.round(gp * 2 + troops * 1.2 + tiles * 6 + tech * 25 + gateways * 800);
}

export function refreshHole() {
  const npcGateways = get("SELECT COUNT(*) c FROM tiles WHERE type='gateway' AND owner_id IS NULL")?.c ?? 12;
  const strength = Number(getSetting('npc_strength', 0.08));
  const lvl = 11 + npcGateways;
  const max = Math.round(3000 * Math.pow(1.5, lvl - 1) * strength);
  run("UPDATE tiles SET level=?, max_durability=?, durability=CASE WHEN owner_id IS NULL THEN ? ELSE durability END WHERE type='hole'", lvl, max, max);
}

export function seasonState() {
  const s = get("SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1");
  if (!s) return null;
  return s;
}

export function currentSeasonId() {
  return seasonState()?.id ?? Number(getSetting('world_season_id', 0));
}
