import { all, get, run, tx, now, getSetting, numberSetting, setSetting, prepare } from './db.mjs';
import { GATEWAYS } from './config.mjs';
import { ROSTER } from './roster.mjs';
import { SKILLS, TECHS, QUESTS } from './content.mjs';
import { hashPassword } from './auth.mjs';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAP_W = () => numberSetting('map_width', 512);
export const MAP_H = () => numberSetting('map_height', 512);

export function gatewayPositions(w = MAP_W(), h = MAP_H()) {
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const r = Math.floor(Math.min(w, h) / 3);
  return GATEWAYS.map((g) => {
    const angle = (g.dir * 30 - 90) * (Math.PI / 180);
    return { ...g, x: Math.round(cx + Math.cos(angle) * r), y: Math.round(cy + Math.sin(angle) * r) };
  });
}

export function fortDurability(level, strength) {
  return Math.round(3000 * Math.pow(1.5, level - 1) * strength);
}

export function fortGarrison(level, strength) {
  const base = 1000 * Math.pow(2.5, level - 1) * strength;
  const coeff = `1 + 0.1 * (level - 1)`;
  if (level <= 3) return { pawn: Math.round(base) };
  if (level <= 6) return { pawn: Math.round(base * 0.45), knight: Math.round(base * 0.30), rook: Math.round(base * 0.15), bishop: Math.round(base * 0.10) };
  return { pawn: Math.round(base * 0.30), knight: Math.round(base * 0.28), rook: Math.round(base * 0.22), bishop: Math.round(base * 0.20) };
}

export function resourceGarrison(res) {
  const out = {};
  if (!res) return out;
  if (res.ember) out.knight = (out.knight ?? 0) + 100 * res.ember;
  if (res.cryo) out.rook = (out.rook ?? 0) + 100 * res.cryo;
  if (res.bloom) out.bishop = (out.bishop ?? 0) + 100 * res.bloom;
  if (res.radiance) out.pawn = (out.pawn ?? 0) + 100 * res.radiance;
  if (res.lumen) out.knight = (out.knight ?? 0) + 50 * res.lumen;
  if (res.umbra) out.rook = (out.rook ?? 0) + 50 * res.umbra;
  return out;
}

export function generateWorld({ seasonId, seed = 20260719 } = {}) {
  const w = MAP_W(), h = MAP_H();
  const rng = mulberry32(seed);
  const strength = Number(getSetting('npc_strength', 0.08));
  const ts = now();
  const gateways = gatewayPositions(w, h);
  const gwMap = new Map(gateways.map((g) => [`${g.x},${g.y}`, g]));
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);

  tx(() => {
    run('DELETE FROM tiles');
    const insert = `INSERT INTO tiles (x,y,type,level,name_zh,name_en,owner_id,city_id,res,garrison,durability,max_durability,gateway_dir,occupied_at,updated_at)
      VALUES (?,?,?,?,?,?,NULL,NULL,?,NULL,?,?,?,NULL,?)`;
    const stmt = prepare(insert);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x === cx && y === cy) {
          const du = fortDurability(23, strength);
          stmt.run(x, y, 'hole', 23, '银白之孔', 'The Silver Bore', null, du, du, null, ts);
          continue;
        }
        const gw = gwMap.get(`${x},${y}`);
        if (gw) {
          const du = fortDurability(10, strength);
          stmt.run(x, y, 'gateway', 10, gw.zh, gw.en, null, du, du, gw.dir, ts);
          continue;
        }
        const roll = rng();
        if (roll < 0.50) {
          const kinds = [];
          const candidates = ['ember', 'cryo', 'bloom', 'radiance'];
          for (const k of candidates) if (rng() < 0.42) kinds.push(k);
          if (rng() < 0.018) kinds.push('lumen');
          if (rng() < 0.018) kinds.push('umbra');
          if (kinds.length === 0) kinds.push(candidates[Math.floor(rng() * 4)]);
          const res = {};
          for (const k of kinds.slice(0, 4)) res[k] = 1 + Math.floor(rng() * 3);
          stmt.run(x, y, 'resource', 0, null, null, JSON.stringify(res), 0, 0, null, ts);
        } else if (roll < 0.75) {
          const lvl = 1 + Math.floor(Math.pow(rng(), 3.2) * 9);
          const du = fortDurability(lvl, strength);
          stmt.run(x, y, 'fort', lvl, `前哨 ${lvl}`, `Outpost ${lvl}`, null, du, du, null, ts);
        } else {
          stmt.run(x, y, 'empty', 0, null, null, null, 0, 0, null, ts);
        }
      }
    }
    setSetting('world_season_id', seasonId);
    setSetting('world_seed', seed);
  });
  return { width: w, height: h, gateways };
}

// Returns a prepared statement lazily. Kept separate so the hot loop can reuse it.
export function findSpawn(x0, y0, radius = 40) {
  const w = MAP_W(), h = MAP_H();
  const ok = (x, y) => {
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false;
    const t = get('SELECT type,owner_id FROM tiles WHERE x=? AND y=?', x, y);
    return !!t && t.type === 'empty' && !t.owner_id;
  };
  for (let r = 0; r <= radius; r++) {
    const candidates = [];
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-r, r]) {
        const x = x0 + dx, y = y0 + dy;
        if (ok(x, y)) candidates.push({ x, y });
      }
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      for (const dx of [-r, r]) {
        const x = x0 + dx, y = y0 + dy;
        if (ok(x, y)) candidates.push({ x, y });
      }
    }
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return null;
}

export function createCity(userId, x, y, seasonId, { isCapital = 0, nameZh, nameEn, governorLevel = 1, tier = 1, tileType = 'city' } = {}) {
  return tx(() => {
    const du = Math.round(3000 * Math.pow(1.5, governorLevel - 1));
    const city = run(
      `INSERT INTO cities (user_id,x,y,name_zh,name_en,is_capital,durability,max_durability,governor_level,season_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      userId, x, y, nameZh || '未命名城塞', nameEn || 'Unnamed Bastion', isCapital, du, du, governorLevel, seasonId, now(),
    );
    const cityId = city.lastInsertRowid;
    run(`UPDATE tiles SET type=?, owner_id=?, city_id=?, name_zh=?, name_en=?, durability=?, max_durability=?, occupied_at=?, updated_at=? WHERE x=? AND y=?`,
      tileType, userId, cityId, nameZh || '未命名城塞', nameEn || 'Unnamed Bastion', du, du, now(), now(), x, y);
    const add = (gx, gy, type, level) => run(
      'INSERT INTO facilities (city_id,gx,gy,type,level,status,created_at) VALUES (?,?,?,?,?,?,?)',
      cityId, gx, gy, type, level, 'active', now(),
    );
    add(12, 12, 'governor', governorLevel);
    for (const [gx, gy, type] of [
      [0, 0, 'extractor_lumen'], [23, 0, 'extractor_ember'], [0, 23, 'extractor_cryo'],
      [23, 23, 'extractor_bloom'], [0, 12, 'extractor_radiance'], [23, 12, 'extractor_umbra'],
    ]) add(gx, gy, type, tier);
    run('UPDATE cities SET durability=?, max_durability=? WHERE id=?', du, du, cityId);
    return cityId;
  });
}

export function grantStarterTroops(cityId) {
  const troops = { pawn: 60, knight: 20, rook: 10, bishop: 10 };
  for (const [unit, count] of Object.entries(troops)) {
    run('INSERT INTO city_troops (city_id,unit,count,level) VALUES (?,?,?,1) ON CONFLICT(city_id,unit) DO UPDATE SET count=count+excluded.count', cityId, unit, count);
  }
}

export function claimRing(userId, x, y, radius = 1) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = get('SELECT type,owner_id FROM tiles WHERE x=? AND y=?', x + dx, y + dy);
      if (!t || t.owner_id || t.type === 'gateway' || t.type === 'hole' || t.type === 'fort' || t.type === 'city') continue;
      run('UPDATE tiles SET owner_id=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', userId, now(), now(), x + dx, y + dy);
    }
  }
}

export function seedContent() {
  const ts = now();
  // Seed-only upserts: never overwrite rows an administrator may have edited.
  // New content is inserted when missing; existing content is left untouched.
  for (const s of SKILLS) {
    if (get('SELECT id FROM skill_defs WHERE key=?', s.key)) continue;
    run(`INSERT INTO skill_defs (key,name_zh,name_en,desc_zh,desc_en,kind,element,max_level,base_cooldown,duration,effects,rare,pool_weight,enabled)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      s.key, s.name_zh, s.name_en, s.desc_zh, s.desc_en, s.kind, s.element, s.max_level ?? 10, s.base_cooldown ?? 0, s.duration ?? 0, JSON.stringify(s.effects ?? []), s.rare ?? 'A', 100);
  }
  for (const t of TECHS) {
    run(`INSERT INTO tech_defs (key,name_zh,name_en,desc_zh,desc_en,scope,category,max_level,base_cost,cost_growth,effect_key,effect_value,effect_growth,base_seconds,requires_lab,sort)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING`,
      t.key, t.name_zh, t.name_en, t.desc_zh, t.desc_en, t.scope, t.category, t.max_level, JSON.stringify(t.base_cost), t.cost_growth,
      t.effect_key, t.effect_value, t.effect_growth, t.base_seconds ?? 1800, t.requires_lab ?? 1, t.sort ?? 100);
  }
  for (const q of QUESTS) {
    run(`INSERT INTO quests (key,name_zh,name_en,desc_zh,desc_en,metric,target,reward_bright,reward_night,sort)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING`,
      q.key, q.name_zh, q.name_en, q.desc_zh, q.desc_en, q.metric, q.target, q.reward_bright, q.reward_night, q.sort);
  }
  for (const g of ROSTER) {
    if (get('SELECT id FROM generals WHERE key=?', g.key)) continue;
    const skill = get('SELECT id FROM skill_defs WHERE key=?', g.skill);
    run(`INSERT INTO generals (name_zh,name_en,title_zh,title_en,source,source_ref,rarity,cost,element,base_hp,base_atk,base_def,base_spd,base_int,art_url,innate_skill_id,pool_weight,enabled,lore_zh,lore_en,key,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      g.name_zh, g.name_en, g.title_zh, g.title_en, g.source, g.source_ref, g.rarity, g.cost, g.element,
      g.base_hp, g.base_atk, g.base_def, g.base_spd, g.base_int, g.art_url, skill?.id ?? null, g.pool_weight, 1, g.lore_zh, g.lore_en, g.key, ts);
  }
}

export function awardStarters(userId, seasonId, { isAdmin = false } = {}) {
  const grants = isAdmin ? ['js_394', 'js_140', 'kf_9'] : ['js_132', 'kf_16'];
  for (const key of grants) {
    const g = get('SELECT id FROM generals WHERE key=?', key);
    if (g) addGeneralToCollection(userId, g.id);
  }
}

export function addGeneralToCollection(userId, generalId, ts = now()) {
  const existing = get('SELECT id,dupes FROM player_generals WHERE user_id=? AND general_id=?', userId, generalId);
  if (existing) {
    run('UPDATE player_generals SET dupes=dupes+1 WHERE id=?', existing.id);
    return { id: existing.id, duplicate: true };
  }
  const r = run('INSERT INTO player_generals (user_id,general_id,level,exp,hp,hp_at,dupes,locked,location_type,location_id,acquired_at) VALUES (?,?,1,0,100,?,0,0,\'reserve\',NULL,?)',
    userId, generalId, ts, ts);
  return { id: r.lastInsertRowid, duplicate: false };
}

export function createSeason(number, nameZh, nameEn, holdSeconds) {
  const ts = now();
  const r = run('INSERT INTO seasons (number,name_zh,name_en,status,started_at,ends_at,victory_hold_seconds,created_at) VALUES (?,?,?,?,?,?,?,?)',
    number, nameZh, nameEn, 'active', ts, null, holdSeconds, ts);
  return r.lastInsertRowid;
}

export function seedWorld({ seasonId, adminId, bots = [] }) {
  const w = MAP_W(), h = MAP_H();
  const rng = mulberry32(Number(getSetting('world_seed', 20260719)) + seasonId);
  generateWorld({ seasonId, seed: Number(getSetting('world_seed', 20260719)) + seasonId * 17 });
  const gateways = gatewayPositions(w, h);
  // ensure spawn areas are clear
  const clearArea = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const t = get('SELECT type,owner_id FROM tiles WHERE x=? AND y=?', x + dx, y + dy);
      if (t && !['gateway', 'hole'].includes(t.type)) {
        run("UPDATE tiles SET type='empty', owner_id=NULL, city_id=NULL, res=NULL, garrison=NULL, durability=0, max_durability=0 WHERE x=? AND y=?", x + dx, y + dy);
      }
    }
  };
  const adminStart = gateways[0];
  let adminPos = findSpawn(adminStart.x + 14, adminStart.y + 10, 50);
  if (!adminPos) adminPos = findSpawn(w / 2, h / 2, 100);
  if (!adminPos) throw new Error('Unable to find spawn for admin');
  clearArea(adminPos.x, adminPos.y, 1);
  const adminCityId = createCity(adminId, adminPos.x, adminPos.y, seasonId, { isCapital: 1, nameZh: '零点钻台', nameEn: 'Zero Rig', governorLevel: 3, tier: 2 });
  grantStarterTroops(adminCityId);
  claimRing(adminId, adminPos.x, adminPos.y, 2);
  awardStarters(adminId, seasonId, { isAdmin: true });

  const botNames = [
    ['nullsermon', 'Null Sermon', 5, 'umbra'],
    ['hollowtide', 'Hollow Tide', 3, 'cryo'],
    ['staticsaint', 'Static Saint', 8, 'radiance'],
    ['rustchoir', 'Rust Choir', 6, 'ember'],
    ['glasswarden', 'Glass Warden', 10, 'lumen'],
    ['packetghost', 'Packet Ghost', 11, 'bloom'],
  ];
  for (let i = 0; i < botNames.length; i++) {
    const [uname, display, dir, charter] = botNames[i];
    const gw = gateways.find((g) => g.dir === dir) || gateways[i];
    const pos = findSpawn(gw.x - 18, gw.y + 12, 45) || findSpawn(gw.x + 12, gw.y - 18, 45);
    if (!pos) continue;
    clearArea(pos.x, pos.y, 1);
    const br = run(`INSERT INTO users (username,display_name,password_hash,role,charter,locale,status,is_bot,lumen,umbra,circuit,ember,cryo,bloom,radiance,season_id,tutorial_step,pity,tapes,created_at,last_login_at,last_seen_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      uname, display, '!', 'player', charter, 'en', 'active', 1, 0, 0, 0, 0, 0, 0, 0, seasonId, 99, 0, 0, now(), now(), now());
    const uid = br.lastInsertRowid;
    const cid = createCity(uid, pos.x, pos.y, seasonId, { isCapital: 1, nameZh: `${display} 城塞`, nameEn: `${display} Bastion`, governorLevel: 4 + (i % 3), tier: 3 });
    grantStarterTroops(cid);
    for (const [unit, count] of Object.entries({ pawn: 150 + i * 40, knight: 60 + i * 20, rook: 40 + i * 10, bishop: 30 + i * 10 })) {
      run('INSERT INTO city_troops (city_id,unit,count,level) VALUES (?,?,?,2) ON CONFLICT(city_id,unit) DO UPDATE SET count=excluded.count, level=2', cid, unit, count);
    }
    claimRing(uid, pos.x, pos.y, 3 + (i % 3));
    // give bots a couple of territories with garrisons
    for (let k = 0; k < 12; k++) {
      const dx = Math.floor((rng() - 0.5) * 9), dy = Math.floor((rng() - 0.5) * 9);
      const t = get('SELECT type,owner_id FROM tiles WHERE x=? AND y=?', pos.x + dx, pos.y + dy);
      if (t && !t.owner_id && t.type !== 'gateway' && t.type !== 'hole' && t.type !== 'city') {
        run('UPDATE tiles SET owner_id=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', uid, now(), now(), pos.x + dx, pos.y + dy);
      }
    }
    awardStarters(uid, seasonId);
  }
  return { adminPos, adminCityId };
}

export function seedIfEmpty() {
  seedContent();
  const count = get('SELECT COUNT(*) c FROM users');
  if (count.c > 0) return { seeded: false };
  const adminPassword = process.env.FIRESEED_ADMIN_PASSWORD || 'fireseed';
  const ts = now();
  const seasonId = createSeason(1, '第零赛季 · 沉没的首页', 'Cycle Zero · The Drowned Front Page', Number(getSetting('victory_hold_days', 30)) * 86400);
  const r = run(`INSERT INTO users (username,display_name,password_hash,role,charter,locale,status,is_bot,lumen,umbra,circuit,ember,cryo,bloom,radiance,season_id,tutorial_step,pity,tapes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    'admin', 'Archivist', hashPassword(adminPassword), 'admin', 'lumen', 'zh', 'active', 0,
    Number(getSetting('starting_bright', 1200)), Number(getSetting('starting_night', 600)), Number(getSetting('starting_circuit', 5)),
    Number(getSetting('starting_ember', 2500)), Number(getSetting('starting_cryo', 2500)), Number(getSetting('starting_bloom', 2500)), Number(getSetting('starting_radiance', 2500)),
    seasonId, 0, 0, 2, ts);
  const adminId = r.lastInsertRowid;
  run('INSERT OR IGNORE INTO economy (user_id,last_tick,frac,circuit_frac) VALUES (?,?,?,0)', adminId, ts, '{}');
  const spawn = seedWorld({ seasonId, adminId });
  run('INSERT INTO announcements (title_zh,title_en,body_zh,body_en,active,created_at) VALUES (?,?,?,?,1,?)',
    '欢迎来到银白之孔', 'Welcome to the Silver Bore',
    '钻探者，你的钻台已经下沉完毕。十二门仍在沉眠，中心的数据孔正在呼吸。先建立你的第一座兵营，然后向外推进。',
    'Driller, your rig has touched the seabed. The Twelve Gateways sleep, and the Bore at the centre is breathing. Raise a foundry, then push outward.',
    ts);
  return { seeded: true, adminId, seasonId, ...spawn, adminPassword };
}

// Password hashing is provided by auth.mjs to avoid duplicating crypto policy.
