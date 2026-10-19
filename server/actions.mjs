import { all, get, run, tx, now, getSetting, numberSetting, parseJson } from './db.mjs';
import {
  ELEMENTS, ELEMENT_LABEL, SEASONAL_RESOURCES, CHARTERS, RARITIES, RARITY_ORDER,
  UNITS, FACILITIES, FACILITY_COSTS, DEFAULT_SETTINGS, GATEWAYS, MAX_LEVEL,
} from './config.mjs';
import { SKILLS, TECHS, QUESTS, SHOP_ITEMS, FACILITY_LABEL } from './content.mjs';
import {
  getUser, accrue, settleUser, aggregateRates, techMods, techLevel, generalStats, generalPower,
  generalMaxLevel, generalLevelCost, equippedSkills, innateSkill, skillScale, cityFacilities,
  cityGenerals, cityTroops, troopCap, storageCap, circuitCap, cityMaxDurability, playerPower,
  addReport, addCounter, addTransaction, addCurrency, seasonState, currentSeasonId, passiveSums,
  userBuffs, towerDefenseBonus, generalRow,
} from './engine.mjs';
import { createCity, grantStarterTroops, findSpawn, gatewayPositions } from './world.mjs';
import { startAttack, startScout, startReinforce, previewAttack, intelFor, totalTroops, resolveDueMovements, areAllied } from './combat.mjs';
import { HttpError } from './http.mjs';
import { hashPassword, verifyPassword, createSession, destroySession, loginAllowed, noteLoginFailure, clearLoginFailures } from './auth.mjs';

const fail = (code, extra = {}) => { throw new HttpError(400, code, code, extra); };
function ensureSeason() { if (!seasonState()) fail('season_ended'); }

export function loc(row, base = 'name') {
  return { zh: row[`${base}_zh`] ?? '', en: row[`${base}_en`] ?? '' };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, username: user.username, displayName: user.display_name, role: user.role,
    charter: user.charter, locale: user.locale, status: user.status, isBot: !!user.is_bot,
    lumen: user.lumen, umbra: user.umbra, circuit: user.circuit,
    ember: user.ember, cryo: user.cryo, bloom: user.bloom, radiance: user.radiance,
    seasonId: user.season_id, tutorialStep: user.tutorial_step, tapes: user.tapes, pity: user.pity,
    createdAt: user.created_at, lastSeenAt: user.last_seen_at,
  };
}

export function seasonPublic() {
  const s = seasonState();
  if (!s) return null;
  const holder = s.hole_holder_id ? getUser(s.hole_holder_id) : null;
  return {
    id: s.id, number: s.number, name: loc(s), status: s.status,
    startedAt: s.started_at, endsAt: s.ends_at, victoryHoldSeconds: s.victory_hold_seconds,
    holeHolderId: s.hole_holder_id, holeHolderName: holder?.display_name ?? null,
    holeSince: s.hole_since, winnerUserId: s.winner_user_id,
  };
}

export function questView(userId) {
  const defs = all('SELECT * FROM quests ORDER BY sort');
  const counters = {};
  for (const c of all('SELECT * FROM counters WHERE user_id=?', userId)) counters[c.key] = c.value;
  const claims = new Set(all('SELECT quest_key FROM quest_claims WHERE user_id=?', userId).map((c) => c.quest_key));
  return defs.map((q) => ({
    key: q.key, name: loc(q), desc: loc(q, 'desc'), target: q.target,
    progress: Math.min(q.target, counters[q.metric] ?? 0),
    claimed: claims.has(q.key), reward: { lumen: q.reward_bright, umbra: q.reward_night },
    claimable: !claims.has(q.key) && (counters[q.metric] ?? 0) >= q.target,
  }));
}

export function cityView(userId, cityId) {
  accrue(userId);
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  const facs = cityFacilities(city.id);
  const facMap = new Map(facs.map((f) => [`${f.gx},${f.gy}`, f]));
  const grid = [];
  for (let gy = 0; gy < 24; gy++) {
    for (let gx = 0; gx < 24; gx++) {
      const f = facMap.get(`${gx},${gy}`);
      grid.push(f ? { gx, gy, type: f.type, level: f.level, status: f.status } : { gx, gy });
    }
  }
  const troops = {};
  for (const t of cityTroops(city.id)) troops[t.unit] = { count: t.count, level: t.level };
  const gens = cityGenerals(city.id);
  const training = all('SELECT * FROM training WHERE city_id=? ORDER BY id', city.id);
  const mods = techMods(userId);
  const pass = passiveSums(gens, userId);
  const buildMul = 1 + (mods.build_speed_pct ?? 0) + pass.build_speed_pct;
  const trainMul = 1 + (mods.train_speed_pct ?? 0) + pass.train_speed_pct;
  const catalog = Object.entries(FACILITY_COSTS).map(([type, def]) => {
    const existing = facs.filter((f) => f.type === type).length;
    const unique = ['lab', 'watchtower', 'workshop'].includes(type);
    const level = facs.find((f) => f.type === type)?.level ?? 0;
    const cost = buildCost(type);
    return {
      type, name: FACILITY_LABEL[type], cost, seconds: Math.max(1, Math.round(def.seconds / Number(getSetting('build_speed', 60)) / buildMul)),
      existing, unique, allowed: (!unique || existing === 0), level,
    };
  });
  const construction = facs.find((f) => f.status !== 'active') ?? null;
  return {
    id: city.id, x: city.x, y: city.y, name: loc(city), isCapital: !!city.is_capital,
    durability: city.durability, maxDurability: city.max_durability, governorLevel: city.governor_level,
    grid, facilities: facs.map((f) => {
      const baseSeconds = f.type.startsWith('extractor_') ? 1800 : 3600;
      const upgradeSeconds = Math.max(1, Math.round(baseSeconds * (1 + f.level * 0.7) / Number(getSetting('build_speed', 60)) / buildMul));
      return { ...serializeFacility(f), upgradeCost: upgradeCost(f), upgradeSeconds, maxLevel: FACILITIES[f.type]?.max ?? 10 };
    }),
    troops, training: training.map(serializeTraining),
    generals: gens.map(serializeGeneral), troopCap: troopCap(userId), troopCount: totalTroops(troops),
    catalog, construction: construction ? serializeFacility(construction) : null,
    buildSpeed: buildMul, trainSpeed: trainMul, rates: rateView(userId), caps: capsView(userId),
    generalCostCap: generalCostCap(userId), maxGeneralLevel: generalMaxLevel(userId),
    storageCap: storageCap(userId), circuitCap: circuitCap(userId),
  };
}

function serializeFacility(f) {
  const base = FACILITIES[f.type] ?? { zh: f.type, en: f.type };
  return {
    id: f.id, type: f.type, gx: f.gx, gy: f.gy, level: f.level, status: f.status,
    buildEndsAt: f.build_ends_at, upgradeTo: f.upgrade_to,
    name: { zh: base.zh ?? FACILITY_LABEL[f.type]?.zh ?? f.type, en: base.en ?? FACILITY_LABEL[f.type]?.en ?? f.type },
  };
}

function serializeTraining(t) {
  return { id: t.id, unit: t.unit, unitName: UNITS[t.unit] ?? { zh: t.unit, en: t.unit }, total: t.total, done: t.done, finishAt: t.finish_at, perSeconds: t.per_seconds };
}

export function generalCostCap(userId) {
  return Math.round((10 + (techMods(userId).general_cost_cap ?? 0)) * 10) / 10;
}

export function subbaseCap(userId) {
  return Math.max(0, Math.round(numberSetting('subbase_base_cap', 2) + (techMods(userId).subbase_cap ?? 0)));
}

export function subbaseCount(userId) {
  return get('SELECT COUNT(*) c FROM cities WHERE user_id=? AND is_capital=0', userId)?.c ?? 0;
}

export function rateView(userId) {
  const rates = aggregateRates(userId);
  const perHour = {};
  for (const [key, value] of Object.entries(rates.perSecond)) perHour[key] = value * 3600;
  return { perHour, circuitPerHour: rates.circuitPerSecond * 3600 };
}

export function capsView(userId) {
  return { ...aggregateRates(userId).caps };
}

export function serializeGeneral(pg) {
  const stats = generalStats(pg);
  const innate = innateSkill(pg);
  const equipped = equippedSkills(pg.id);
  return {
    id: pg.id, generalId: pg.general_id, key: pg.key, name: loc(pg), title: { zh: pg.title_zh, en: pg.title_en },
    rarity: pg.rarity, cost: pg.cost, element: pg.element, source: pg.source, artUrl: pg.art_url,
    level: pg.level, exp: pg.exp, hp: pg.hp, dupes: pg.dupes, locked: !!pg.locked,
    stats, power: generalPower(pg), maxLevel: generalMaxLevel(pg.user_id), levelCost: generalLevelCost(pg, pg.user_id),
    location: { type: pg.location_type, id: pg.location_id },
    lore: { zh: pg.lore_zh, en: pg.lore_en },
    innate: innate ? { ...skillCardView(innate), level: Math.max(1, Math.round((pg.level ?? 1) / 3) + 1), innate: true } : null,
    skills: equipped.map((s) => ({ ...skillCardView(s), slot: s.slot, level: s.level, count: s.count, playerSkillId: s.player_skill_id, playerSkillLevel: s.level })),
    slots: [1, 2].map((slot) => {
      const s = equipped.find((e) => e.slot === slot);
      return s ? { ...skillCardView(s), slot, level: s.level, playerSkillId: s.player_skill_id } : null;
    }),
  };
}

export function skillCardView(s) {
  return {
    id: s.id ?? s.skill_id, key: s.key, name: { zh: s.name_zh, en: s.name_en }, desc: { zh: s.desc_zh, en: s.desc_en },
    kind: s.kind, element: s.element, rare: s.rare, maxLevel: s.max_level,
    cooldown: s.base_cooldown, duration: s.duration, effects: parseJson(s.effects, []),
  };
}

export function collectionView(userId) {
  const rows = all(`SELECT pg.*, g.*, pg.id AS id, g.id AS general_id FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=? ORDER BY g.rarity DESC, g.cost DESC, pg.id`, userId);
  const allDefs = all('SELECT * FROM generals WHERE enabled=1 ORDER BY rarity DESC, cost DESC, id');
  const owned = new Set(rows.map((r) => r.general_id));
  return {
    owned: rows.map(serializeGeneral),
    catalog: allDefs.map((g) => ({
      id: g.id, key: g.key, name: loc(g), title: { zh: g.title_zh, en: g.title_en }, rarity: g.rarity, cost: g.cost,
      element: g.element, source: g.source, artUrl: g.art_url, owned: owned.has(g.id), lore: { zh: g.lore_zh, en: g.lore_en },
      baseStats: { atk: g.base_atk, def: g.base_def, spd: g.base_spd, int: g.base_int },
    })),
    costCap: generalCostCap(userId), maxLevel: generalMaxLevel(userId),
  };
}

export function skillCollectionView(userId) {
  const rows = all(`SELECT ps.*, sd.*, ps.id AS player_skill_id, sd.id AS skill_id FROM player_skills ps JOIN skill_defs sd ON sd.id=ps.skill_id WHERE ps.user_id=? ORDER BY sd.rare DESC, sd.id`, userId);
  const equipped = all(`SELECT gs.player_skill_id, gs.player_general_id, pg.user_id FROM general_skills gs JOIN player_generals pg ON pg.id=gs.player_general_id WHERE pg.user_id=?`, userId);
  const eqMap = new Map(equipped.map((e) => [e.player_skill_id, e.player_general_id]));
  const allDefs = all('SELECT * FROM skill_defs WHERE enabled=1 ORDER BY rare DESC, id');
  return {
    owned: rows.map((s) => ({
      ...skillCardView(s), playerSkillId: s.player_skill_id, level: s.level, count: s.count,
      equippedOn: eqMap.get(s.player_skill_id) ?? null,
      desc: { zh: s.desc_zh, en: s.desc_en },
    })),
    catalog: allDefs.map((s) => ({ ...skillCardView(s), desc: { zh: s.desc_zh, en: s.desc_en } })),
  };
}

export function researchView(userId) {
  settleUser(userId);
  const lab = get(`SELECT MAX(f.level) l FROM facilities f JOIN cities c ON c.id=f.city_id WHERE c.user_id=? AND f.type='lab'`, userId)?.l ?? 0;
  const levels = {};
  for (const t of all('SELECT * FROM player_techs WHERE user_id=?', userId)) levels[t.tech_key] = t.level;
  const queue = get('SELECT * FROM research_queue WHERE user_id=?', userId);
  const mods = techMods(userId);
  const gens = all(`SELECT pg.*, g.*, pg.id AS id FROM city_generals cg JOIN player_generals pg ON pg.id=cg.player_general_id JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?`, userId);
  const pass = passiveSums(gens, userId);
  return {
    labLevel: lab,
    techs: all('SELECT * FROM tech_defs ORDER BY scope DESC, sort').map((t) => {
      const level = levels[t.key] ?? 0;
      const maxAllowed = t.scope === 'seasonal' ? Math.min(t.max_level, lab) : t.max_level;
      const cost = techCost(t, level);
      const canLevel = level < maxAllowed && lab >= t.requires_lab && !queue;
      return {
        key: t.key, name: loc(t), desc: loc(t), scope: t.scope, category: t.category,
        level, maxLevel: t.max_level, maxAllowed, requiresLab: t.requires_lab,
        effect: { key: t.effect_key, value: t.effect_value * (1 + Math.max(0, level - 1) * t.effect_growth), growth: t.effect_growth },
        cost, seconds: Math.max(1, Math.round(t.base_seconds * (1 + level * 0.6) / Number(getSetting('research_speed', 60)) / (1 + (mods.research_speed_pct ?? 0) + pass.research_speed_pct))),
        canLevel,
      };
    }),
    queue: queue ? { key: queue.tech_key, targetLevel: queue.target_level, finishAt: queue.finish_at, startedAt: queue.started_at } : null,
    effects: mods,
  };
}

export function techCost(t, level) {
  const base = parseJson(t.base_cost, {});
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.round(v * (1 + level * t.cost_growth));
  return out;
}

export function movementView(userId) {  resolveDueMovements(20);
  const own = all(`SELECT m.*, u.display_name target_name FROM movements m LEFT JOIN users u ON u.id=m.target_user_id WHERE m.user_id=? AND m.status='marching' ORDER BY m.arrive_at`, userId);
  const incoming = all(`SELECT m.*, u.display_name attacker_name FROM movements m JOIN users u ON u.id=m.user_id WHERE m.status='marching' AND m.target_user_id=? AND m.user_id<>? ORDER BY m.arrive_at`, userId, userId);
  return {
    outgoing: own.map((m) => ({ ...m, troops: parseJson(m.troops, {}), meta: parseJson(m.meta, {}) })),
    incoming: incoming.map((m) => ({ ...m, troops: parseJson(m.troops, {}), meta: parseJson(m.meta, {}) })),
  };
}

export function stateView(userId, ctx) {
  accrue(userId);
  const user = getUser(userId);
  const cities = all('SELECT * FROM cities WHERE user_id=? ORDER BY is_capital DESC, id', userId);
  const troopRows = all(`SELECT ct.unit,SUM(ct.count) c,MAX(ct.level) l FROM city_troops ct JOIN cities ci ON ci.id=ct.city_id WHERE ci.user_id=? GROUP BY ct.unit`, userId);
  const troops = {};
  for (const t of troopRows) troops[t.unit] = { count: t.c, level: t.l };
  const gens = get('SELECT COUNT(*) c FROM player_generals WHERE user_id=?', userId)?.c ?? 0;
  const reportsUnread = get('SELECT COUNT(*) c FROM reports WHERE user_id=? AND read=0', userId)?.c ?? 0;
  const movements = movementView(userId);
  const season = seasonPublic();
  const alliance = get(`SELECT a.*, am.role FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.user_id=?`, userId);
  const vassal = get('SELECT v.*, u.display_name liege_name FROM vassals v JOIN users u ON u.id=v.liege_id WHERE v.user_id=?', userId);
  const online = get('SELECT COUNT(*) c FROM users WHERE last_seen_at>? AND is_bot=0', now() - 5 * 60000)?.c ?? 0;
  const rawRates = getSetting('gacha_rates', DEFAULT_SETTINGS.gacha_rates);
  return {
    user: publicUser(user), season, cities: cities.map((c) => ({ id: c.id, x: c.x, y: c.y, name: loc(c), isCapital: !!c.is_capital, durability: c.durability, maxDurability: c.max_durability })),
    resources: { lumen: user.lumen, umbra: user.umbra, circuit: user.circuit, ember: user.ember, cryo: user.cryo, bloom: user.bloom, radiance: user.radiance },
    rates: rateView(userId), caps: capsView(userId), troops, troopCap: troopCap(userId), troopCount: totalTroops(troops),
    generals: gens, power: playerPower(userId), movementCount: movements.outgoing.length,
    movements,
    reportsUnread, quests: questView(userId), alliance: alliance ? { id: alliance.id, tag: alliance.tag, name: alliance.name, role: alliance.role } : null,
    vassal: vassal ? { liegeId: vassal.liege_id, liegeName: vassal.liege_name, since: vassal.since } : null,
    charter: { key: user.charter, ...CHARTERS[user.charter] },
    online, serverTime: now(), generalCostCap: generalCostCap(userId), subbaseCap: subbaseCap(userId), subbaseCount: subbaseCount(userId), seasonReward: { lumen: Number(getSetting('season_start_bright', 600)), umbra: Number(getSetting('season_start_night', 300)) },
    settings: {
      registrationOpen: Number(getSetting('registration_open', 1)), maintenance: Number(getSetting('maintenance', 0)),
      mapWidth: numberSetting('map_width', 512), mapHeight: numberSetting('map_height', 512),
      gachaGeneral: Number(getSetting('gacha_general_cost', 300)), gachaGeneralTen: Number(getSetting('gacha_general_ten_cost', 2700)),
      gachaSkill: Number(getSetting('gacha_skill_cost', 200)), gachaSkillTen: Number(getSetting('gacha_skill_ten_cost', 1800)),
      gachaRates: typeof rawRates === 'string' ? parseJson(rawRates, DEFAULT_SETTINGS.gacha_rates) : rawRates,
      gachaPity: Number(getSetting('gacha_pity', 80)),
      resourceTickSeconds: numberSetting('resource_tick_seconds', 3),
      resourceClaimCircuit: numberSetting('resource_claim_circuit', 3),
    },
  };
}

export function bootstrapView(ctx) {
  const user = ctx.user;
  const announcements = all('SELECT * FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 5');
  return {
    user: user ? publicUser(user) : null, csrf: ctx.session?.csrf ?? null,
    season: seasonPublic(),
    announcements: announcements.map((a) => ({ id: a.id, title: loc(a, 'title'), body: loc(a, 'body'), createdAt: a.created_at })),
    settings: { registrationOpen: Number(getSetting('registration_open', 1)), maintenance: Number(getSetting('maintenance', 0)), serverName: { zh: getSetting('server_name_zh', '种火集结号'), en: getSetting('server_name_en', 'Fireseed Engage') } },
    online: get('SELECT COUNT(*) c FROM users WHERE last_seen_at>? AND is_bot=0', now() - 5 * 60000)?.c ?? 0,
    map: { width: numberSetting('map_width', 512), height: numberSetting('map_height', 512) },
    meta: metaView(),
  };
}

export function metaView() {
  return {
    elements: ELEMENT_LABEL,
    charters: Object.fromEntries(Object.entries(CHARTERS).map(([key, c]) => [key, c])),
    rarities: RARITIES,
    units: Object.fromEntries(Object.entries(UNITS).map(([key, u]) => [key, {
      key, name: { zh: u.zh, en: u.en }, cost: u.cost, trainSeconds: u.trainSeconds, speed: u.speed,
      atk: u.atk, def: u.def, siege: u.siege, unlock: u.unlock, desc: { zh: u.desc_zh, en: u.desc_en },
    }])),
    facilities: FACILITY_LABEL,
  };
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

const CHARTER_KEYS = new Set(Object.keys(CHARTERS));
export function registerUser({ username, displayName, password, charter, locale }) {
  if (!Number(getSetting('registration_open', 1))) fail('registration_closed');
  const maxPlayers = Number(getSetting('max_players', 50));
  const total = get('SELECT COUNT(*) c FROM users WHERE is_bot=0')?.c ?? 0;
  if (total >= maxPlayers) fail('server_full');
  username = String(username || '').trim();
  displayName = String(displayName || '').trim() || username;
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) fail('invalid_username');
  if (displayName.length < 2 || displayName.length > 24) fail('invalid_display_name');
  if (!password || String(password).length < 6) fail('weak_password');
  if (get('SELECT id FROM users WHERE username=?', username)) fail('username_taken');
  if (!CHARTER_KEYS.has(charter)) charter = 'lumen';
  if (!['zh', 'en'].includes(locale)) locale = 'zh';
  const ts = now();
  const seasonId = currentSeasonId();
  const userId = tx(() => {
    const r = run(`INSERT INTO users (username,display_name,password_hash,role,charter,locale,status,is_bot,lumen,umbra,circuit,ember,cryo,bloom,radiance,season_id,tutorial_step,pity,tapes,created_at,last_login_at,last_seen_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      username, displayName, hashPassword(password), 'player', charter, locale, 'active', 0,
      Number(getSetting('starting_bright', 1200)), Number(getSetting('starting_night', 600)), Number(getSetting('starting_circuit', 5)),
      Number(getSetting('starting_ember', 2500)), Number(getSetting('starting_cryo', 2500)), Number(getSetting('starting_bloom', 2500)), Number(getSetting('starting_radiance', 2500)),
      seasonId, 0, 0, 2, ts, ts, ts);
    run('INSERT INTO economy (user_id,last_tick,frac,circuit_frac) VALUES (?,?,?,0)', r.lastInsertRowid, ts, '{}');
    return r.lastInsertRowid;
  });
  try {
    spawnPlayerCity(userId);
  } catch (err) {
    run('DELETE FROM economy WHERE user_id=?', userId);
    run('DELETE FROM users WHERE id=?', userId);
    throw err;
  }
  const starters = all("SELECT id FROM generals WHERE enabled=1 AND rarity IN ('A','B') ORDER BY RANDOM() LIMIT 2");
  for (const g of starters) addGeneralToCollection(userId, g.id);
  addReport(userId, 'system', '钻台已下沉', 'Rig Anchored',
    '欢迎来到数据之海。你的第一座城塞已经建立。完成左侧的任务清单，然后向十二门推进。',
    'Welcome to the Data Sea. Your first bastion is online. Clear the task list, then push toward the Twelve Gateways.',
    {});
  return { userId };
}

export function spawnPlayerCity(userId) {
  const gateways = gatewayPositions();
  const g = gateways[Math.floor(Math.random() * gateways.length)];
  let pos = findSpawn(g.x + 24 + Math.floor(Math.random() * 24), g.y + 18 + Math.floor(Math.random() * 24), 70);
  if (!pos) pos = findSpawn(256, 256, 140);
  if (!pos) throw new Error('no_spawn');
  const cid = createCity(userId, pos.x, pos.y, currentSeasonId(), { isCapital: 1, nameZh: '下沉钻台', nameEn: 'Sunken Rig', governorLevel: 1, tier: 1 });
  grantStarterTroops(cid);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const t = get('SELECT type,owner_id FROM tiles WHERE x=? AND y=?', pos.x + dx, pos.y + dy);
    if (t && !t.owner_id && !['gateway', 'hole', 'fort', 'city'].includes(t.type)) {
      run('UPDATE tiles SET owner_id=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', userId, now(), now(), pos.x + dx, pos.y + dy);
    }
  }
  return cid;
}

export function addGeneralToCollection(userId, generalId) {
  const ts = now();
  const existing = get('SELECT * FROM player_generals WHERE user_id=? AND general_id=?', userId, generalId);
  if (existing) {
    run('UPDATE player_generals SET dupes=dupes+1 WHERE id=?', existing.id);
    return { duplicate: true, playerGeneralId: existing.id };
  }
  const r = run("INSERT INTO player_generals (user_id,general_id,level,exp,hp,hp_at,dupes,locked,location_type,location_id,acquired_at) VALUES (?,?,1,0,100,?,0,0,'reserve',NULL,?)", userId, generalId, ts, ts);
  return { duplicate: false, playerGeneralId: r.lastInsertRowid };
}

export function loginUser({ username, password }, ctx) {
  username = String(username || '').trim();
  const key = `${ctx.ip}:${username.toLowerCase()}`;
  if (!loginAllowed(key)) fail('too_many_attempts');
  const user = get('SELECT * FROM users WHERE username=?', username);
  if (!user || user.is_bot || !verifyPassword(password, user.password_hash)) {
    noteLoginFailure(key);
    fail('bad_credentials');
  }
  if (user.status === 'banned') fail('banned', { reason: user.banned_reason });
  clearLoginFailures(key);
  const session = createSession(user.id, ctx.ip, ctx.req.headers['user-agent'] || '');
  run('UPDATE users SET last_login_at=?, last_seen_at=? WHERE id=?', now(), now(), user.id);
  return { session, user: publicUser(getUser(user.id)) };
}

/* ------------------------------------------------------------------ */
/* City actions                                                        */
/* ------------------------------------------------------------------ */

export function buildCost(type) {
  return { ...(FACILITY_COSTS[type]?.build ?? {}) };
}

export function upgradeCost(fac) {
  const base = FACILITY_COSTS[fac.type]?.build ?? { ember: 500, cryo: 500, bloom: 500, radiance: 500 };
  const multiplier = fac.type.startsWith('extractor_') ? 0.7 : fac.type === 'governor' ? 1.2 : 1;
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.round(v * multiplier * (1 + fac.level * 0.9));
  return out;
}

function ensureResource(userId, cost) {
  const user = getUser(userId);
  for (const [k, v] of Object.entries(cost)) if ((user[k] ?? 0) < v) fail('insufficient_resources', { resource: k });
}

function payResource(userId, cost) {
  ensureResource(userId, cost);
  for (const [k, v] of Object.entries(cost)) run(`UPDATE users SET ${k}=${k}-? WHERE id=?`, v, userId);
  for (const [k, v] of Object.entries(cost)) addTransaction(userId, k, -v, 'facility');
}

export function buildFacility(userId, cityId, { type, gx, gy }) {
  ensureSeason();
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  if (!FACILITY_COSTS[type]) fail('invalid_facility');
  if (gx < 0 || gy < 0 || gx >= 24 || gy >= 24) fail('invalid_cell');
  if (get('SELECT id FROM facilities WHERE city_id=? AND gx=? AND gy=?', cityId, gx, gy)) fail('cell_occupied');
  if (get("SELECT id FROM facilities WHERE city_id=? AND status<>'active'", cityId)) fail('construction_busy');
  if (['lab', 'watchtower', 'workshop'].includes(type) && get('SELECT id FROM facilities WHERE city_id=? AND type=?', cityId, type)) fail('unique_facility');
  const user = getUser(userId);
  const cost = buildCost(type);
  payResource(userId, cost);
  const gens = cityGenerals(cityId);
  const pass = passiveSums(gens, userId);
  const mods = techMods(userId);
  const seconds = Math.max(1, Math.round(FACILITY_COSTS[type].seconds / Number(getSetting('build_speed', 60)) / (1 + (mods.build_speed_pct ?? 0) + pass.build_speed_pct)));
  const r = run(`INSERT INTO facilities (city_id,gx,gy,type,level,status,build_ends_at,upgrade_to,created_at) VALUES (?,?,?,?,0,'building',?,1,?)`,
    cityId, gx, gy, type, now() + seconds * 1000, now());
  addCounter(userId, 'build', 1);
  addReport(userId, 'build', '设施建造中', 'Facility Under Construction',
    `${FACILITY_LABEL[type].zh} 开始建造，预计 ${seconds} 秒完成。`, `${FACILITY_LABEL[type].en} construction started; ETA ${seconds}s.`, { cityId, type, seconds });
  return { facilityId: r.lastInsertRowid, seconds };
}

export function upgradeFacility(userId, cityId, facilityId) {
  ensureSeason();
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  const fac = get('SELECT * FROM facilities WHERE id=? AND city_id=?', facilityId, cityId);
  if (!fac) throw new HttpError(404, 'facility_not_found');
  if (fac.status !== 'active') fail('construction_busy');
  const max = FACILITIES[fac.type]?.max ?? 10;
  if (fac.level >= max) fail('max_level');
  if (get("SELECT id FROM facilities WHERE city_id=? AND status<>'active'", cityId)) fail('construction_busy');
  const cost = upgradeCost(fac);
  payResource(userId, cost);
  const gens = cityGenerals(cityId);
  const pass = passiveSums(gens, userId);
  const mods = techMods(userId);
  const baseSeconds = fac.type.startsWith('extractor_') ? 1800 : 3600;
  const seconds = Math.max(1, Math.round(baseSeconds * (1 + fac.level * 0.7) / Number(getSetting('build_speed', 60)) / (1 + (mods.build_speed_pct ?? 0) + pass.build_speed_pct)));
  run("UPDATE facilities SET status='upgrading', build_ends_at=?, upgrade_to=? WHERE id=?", now() + seconds * 1000, fac.level + 1, fac.id);
  addReport(userId, 'build', '设施升级中', 'Facility Upgrading',
    `${FACILITIES[fac.type]?.zh ?? fac.type} 正在升级至 Lv.${fac.level + 1}，预计 ${seconds} 秒。`,
    `${FACILITIES[fac.type]?.en ?? fac.type} is upgrading to Lv.${fac.level + 1}; ETA ${seconds}s.`, { cityId, facilityId: fac.id, seconds });
  return { seconds, level: fac.level + 1 };
}

export function demolishFacility(userId, cityId, facilityId) {
  const fac = get('SELECT f.* FROM facilities f JOIN cities c ON c.id=f.city_id WHERE f.id=? AND f.city_id=? AND c.user_id=?', facilityId, cityId, userId);
  if (!fac) throw new HttpError(404, 'facility_not_found');
  if (fac.type === 'governor') fail('cannot_demolish');
  if (fac.level <= 1 && !FACILITY_COSTS[fac.type]) fail('cannot_demolish');
  const refund = {};
  for (const [k, v] of Object.entries(upgradeCost(fac))) refund[k] = Math.round(v * 0.25);
  for (const [k, v] of Object.entries(refund)) run(`UPDATE users SET ${k}=${k}+? WHERE id=?`, v, userId);
  run('DELETE FROM facilities WHERE id=?', fac.id);
  return { refund };
}

export function renameCity(userId, cityId, { nameZh, nameEn }) {
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  const zh = String(nameZh || city.name_zh).trim().slice(0, 24);
  const en = String(nameEn || city.name_en).trim().slice(0, 36);
  if (zh.length < 1 || en.length < 1) fail('invalid_name');
  run('UPDATE cities SET name_zh=?, name_en=? WHERE id=?', zh, en, cityId);
  run('UPDATE tiles SET name_zh=?, name_en=? WHERE x=? AND y=?', zh, en, city.x, city.y);
  return { name: { zh, en } };
}

export function trainUnits(userId, cityId, { unit, count }) {
  ensureSeason();
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  const def = UNITS[unit];
  if (!def) fail('invalid_unit');
  count = Math.max(1, Math.floor(Number(count) || 0));
  const fac = get('SELECT * FROM facilities WHERE city_id=? AND type=?', cityId, def.unlock);
  if (!fac) fail('requires_facility', { facility: def.unlock });
  if (fac.status !== 'active') fail('facility_busy');
  if (get('SELECT id FROM training WHERE city_id=?', cityId)) fail('training_busy');
  const cap = troopCap(userId);
  const current = get(`SELECT SUM(ct.count) s FROM city_troops ct JOIN cities c ON c.id=ct.city_id WHERE c.user_id=?`, userId)?.s ?? 0;
  if (current + count > cap) fail('troop_cap');
  const cost = {};
  for (const [k, v] of Object.entries(def.cost)) cost[k] = v * count;
  payResource(userId, cost);
  const gens = cityGenerals(cityId);
  const pass = passiveSums(gens, userId);
  const mods = techMods(userId);
  const per = Math.max(0.02, def.trainSeconds / Number(getSetting('training_speed', 20)) / (1 + (mods.train_speed_pct ?? 0) + pass.train_speed_pct));
  const finish = now() + Math.round(per * count * 1000);
  run('INSERT INTO training (city_id,unit,total,done,per_seconds,finish_at,started_at) VALUES (?,?,?,0,?,?,?)', cityId, unit, count, per, finish, now());
  return { finishAt: finish, perSeconds: per, totalSeconds: finish - now() };
}

export function instantFinish(userId, cityId) {
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  const user = getUser(userId);
  if ((user.tapes ?? 0) < 1) fail('no_tapes');
  const fac = get("SELECT * FROM facilities WHERE city_id=? AND status<>'active'", cityId);
  const queue = get('SELECT * FROM research_queue WHERE user_id=?', userId);
  if (!fac && !queue) fail('nothing_to_finish');
  run('UPDATE users SET tapes=tapes-1 WHERE id=?', userId);
  if (fac) {
    const target = fac.upgrade_to ?? fac.level;
    run("UPDATE facilities SET level=?, status='active', build_ends_at=NULL, upgrade_to=NULL WHERE id=?", target, fac.id);
  }
  if (queue) {
    run('INSERT INTO player_techs (user_id,tech_key,level) VALUES (?,?,?) ON CONFLICT(user_id,tech_key) DO UPDATE SET level=excluded.level', userId, queue.tech_key, queue.target_level);
    run('DELETE FROM research_queue WHERE id=?', queue.id);
    addCounter(userId, 'research', 1);
  }
  return { ok: true };
}

export function assignGeneral(userId, cityId, playerGeneralId) {
  const city = get('SELECT * FROM cities WHERE id=? AND user_id=?', cityId, userId);
  if (!city) throw new HttpError(404, 'city_not_found');
  const pg = get('SELECT * FROM player_generals WHERE id=? AND user_id=?', playerGeneralId, userId);
  if (!pg) throw new HttpError(404, 'general_not_found');
  if (pg.location_type === 'army') fail('general_busy');
  run('DELETE FROM city_generals WHERE player_general_id=?', playerGeneralId);
  run('INSERT INTO city_generals (city_id,player_general_id) VALUES (?,?)', cityId, playerGeneralId);
  run("UPDATE player_generals SET location_type='city', location_id=? WHERE id=?", cityId, playerGeneralId);
  return { ok: true };
}

export function unassignGeneral(userId, playerGeneralId) {
  const pg = get('SELECT * FROM player_generals WHERE id=? AND user_id=?', playerGeneralId, userId);
  if (!pg) throw new HttpError(404, 'general_not_found');
  if (pg.location_type === 'army') fail('general_busy');
  run('DELETE FROM city_generals WHERE player_general_id=?', playerGeneralId);
  run("UPDATE player_generals SET location_type='reserve', location_id=NULL WHERE id=?", playerGeneralId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Generals, skills, gacha                                             */
/* ------------------------------------------------------------------ */

function gachaDiscount(userId) {
  return Math.min(0.6, techMods(userId).gacha_discount_pct ?? 0);
}

export function gachaCost(userId, pool, ten = false) {
  const base = pool === 'general'
    ? (ten ? Number(getSetting('gacha_general_ten_cost', 2700)) : Number(getSetting('gacha_general_cost', 300)))
    : (ten ? Number(getSetting('gacha_skill_ten_cost', 1800)) : Number(getSetting('gacha_skill_cost', 200)));
  return Math.max(1, Math.round(base * (1 - gachaDiscount(userId))));
}

function pickWeighted(items, weightFn) {
  const total = items.reduce((s, i) => s + Math.max(0, weightFn(i)), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, weightFn(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickRarity(rates) {
  const total = Object.values(rates).reduce((s, v) => s + Number(v), 0);
  let roll = Math.random() * total;
  for (const r of RARITIES) {
    roll -= Number(rates[r] ?? 0);
    if (roll <= 0) return r;
  }
  return 'B';
}

export function drawGeneral(userId, { times = 1 }) {
  const user = getUser(userId);
  times = times === 10 ? 10 : 1;
  const cost = gachaCost(userId, 'general', times === 10);
  if (user.lumen < cost) fail('insufficient_lumen');
  const rawRates = getSetting('gacha_rates', DEFAULT_SETTINGS.gacha_rates);
  const rates = typeof rawRates === 'string' ? parseJson(rawRates, { B: 48, A: 30, S: 15, SS: 6, P: 1 }) : rawRates;
  const results = [];
  let pity = user.pity ?? 0;
  const pityLimit = Number(getSetting('gacha_pity', 80));
  let guaranteeA = times === 10;
  tx(() => {
    run('UPDATE users SET lumen=lumen-? WHERE id=?', cost, userId);
    addTransaction(userId, 'lumen', -cost, 'gacha_general');
    for (let i = 0; i < times; i++) {
      let rarity = pickRarity(rates);
      pity++;
      if (pity >= pityLimit) { rarity = 'P'; pity = 0; }
      if (rarity === 'P') pity = 0;
      if (guaranteeA && i === times - 1 && (RARITY_ORDER[rarity] ?? 0) < RARITY_ORDER.A) rarity = 'A';
      const pool = all('SELECT * FROM generals WHERE enabled=1 AND rarity=?', rarity);
      const fallback = all("SELECT * FROM generals WHERE enabled=1 ORDER BY RANDOM() LIMIT 1");
      const card = pool.length ? pickWeighted(pool, (g) => g.pool_weight ?? 100) : fallback[0];
      if (!card) continue;
      const added = addGeneralToCollection(userId, card.id);
      results.push({
        generalId: card.id, key: card.key, name: loc(card), title: { zh: card.title_zh, en: card.title_en },
        rarity: card.rarity, cost: card.cost, element: card.element, artUrl: card.art_url, duplicate: added.duplicate,
        playerGeneralId: added.playerGeneralId,
      });
    }
    run('UPDATE users SET pity=? WHERE id=?', pity, userId);
    addCounter(userId, 'draw', times);
    run('INSERT INTO gacha_log (user_id,pool,results,cost,created_at) VALUES (?,?,?,?,?)', userId, 'general', JSON.stringify(results), cost, now());
  });
  return { results, cost, pity, pityLimit };
}

export function drawSkill(userId, { times = 1 }) {
  const user = getUser(userId);
  times = times === 10 ? 10 : 1;
  const cost = gachaCost(userId, 'skill', times === 10);
  if (user.umbra < cost) fail('insufficient_umbra');
  const rawRates = getSetting('gacha_rates', DEFAULT_SETTINGS.gacha_rates);
  const rates = typeof rawRates === 'string' ? parseJson(rawRates, { B: 48, A: 30, S: 15, SS: 6, P: 1 }) : rawRates;
  const results = [];
  tx(() => {
    run('UPDATE users SET umbra=umbra-? WHERE id=?', cost, userId);
    addTransaction(userId, 'umbra', -cost, 'gacha_skill');
    for (let i = 0; i < times; i++) {
      let rarity = pickRarity(rates);
      if (times === 10 && i === 9 && (RARITY_ORDER[rarity] ?? 0) < RARITY_ORDER.A) rarity = 'A';
      let pool = all('SELECT * FROM skill_defs WHERE enabled=1 AND rare=?', rarity);
      if (!pool.length) pool = all('SELECT * FROM skill_defs WHERE enabled=1 ORDER BY RANDOM() LIMIT 3');
      const def = pickWeighted(pool, (s) => s.pool_weight ?? 100);
      if (!def) continue;
      const existing = get('SELECT * FROM player_skills WHERE user_id=? AND skill_id=?', userId, def.id);
      if (existing) {
        run('UPDATE player_skills SET count=count+1 WHERE id=?', existing.id);
        results.push({ ...skillCardView(def), playerSkillId: existing.id, duplicate: true, count: existing.count + 1 });
      } else {
        const r = run('INSERT INTO player_skills (user_id,skill_id,level,count,acquired_at) VALUES (?,?,1,1,?)', userId, def.id, now());
        results.push({ ...skillCardView(def), playerSkillId: r.lastInsertRowid, duplicate: false, count: 1 });
      }
    }
    run('INSERT INTO gacha_log (user_id,pool,results,cost,created_at) VALUES (?,?,?,?,?)', userId, 'skill', JSON.stringify(results), cost, now());
  });
  return { results, cost };
}

export function levelUpGeneral(userId, playerGeneralId) {
  const pg = generalRow(playerGeneralId);
  if (!pg || pg.user_id !== userId) throw new HttpError(404, 'general_not_found');
  const max = generalMaxLevel(userId);
  if (pg.level >= max) fail('max_level', { max });
  const cost = generalLevelCost(pg, userId);
  const user = getUser(userId);
  if (user.lumen < cost) fail('insufficient_lumen');
  run('UPDATE users SET lumen=lumen-? WHERE id=?', cost, userId);
  addTransaction(userId, 'lumen', -cost, 'general_level');
  run('UPDATE player_generals SET level=level+1 WHERE id=?', playerGeneralId);
  const newLevel = pg.level + 1;
  if (newLevel === 5) addCounter(userId, 'general_level5', 1);
  return { level: newLevel, cost };
}

export function equipSkill(userId, playerGeneralId, playerSkillId, slot) {
  const pg = get('SELECT * FROM player_generals WHERE id=? AND user_id=?', playerGeneralId, userId);
  if (!pg) throw new HttpError(404, 'general_not_found');
  if (![1, 2].includes(slot)) fail('invalid_slot');
  const ps = get('SELECT * FROM player_skills WHERE id=? AND user_id=?', playerSkillId, userId);
  if (!ps) throw new HttpError(404, 'skill_not_found');
  const equippedElsewhere = get(`SELECT gs.* FROM general_skills gs JOIN player_generals pg ON pg.id=gs.player_general_id WHERE gs.player_skill_id=? AND (pg.user_id<>? OR gs.player_general_id<>?)`, playerSkillId, userId, playerGeneralId);
  if (equippedElsewhere) fail('skill_equipped_elsewhere');
  const sameGeneral = get('SELECT * FROM general_skills WHERE player_general_id=? AND player_skill_id=?', playerGeneralId, playerSkillId);
  run('DELETE FROM general_skills WHERE player_general_id=? AND (slot=? OR player_skill_id=?)', playerGeneralId, slot, playerSkillId);
  run('INSERT INTO general_skills (player_general_id,slot,player_skill_id) VALUES (?,?,?)', playerGeneralId, slot, playerSkillId);
  return { ok: true, sameGeneral: !!sameGeneral };
}

export function unequipSkill(userId, playerGeneralId, slot) {
  const pg = get('SELECT * FROM player_generals WHERE id=? AND user_id=?', playerGeneralId, userId);
  if (!pg) throw new HttpError(404, 'general_not_found');
  run('DELETE FROM general_skills WHERE player_general_id=? AND slot=?', playerGeneralId, slot);
  return { ok: true };
}

export function levelUpSkill(userId, playerSkillId) {
  const ps = get('SELECT ps.*, sd.max_level FROM player_skills ps JOIN skill_defs sd ON sd.id=ps.skill_id WHERE ps.id=? AND ps.user_id=?', playerSkillId, userId);
  if (!ps) throw new HttpError(404, 'skill_not_found');
  if (ps.level >= ps.max_level) fail('max_level');
  const needed = ps.level;
  if (ps.count <= needed) fail('not_enough_duplicates', { needed: needed + 1, have: ps.count });
  const cost = 20 * ps.level;
  const user = getUser(userId);
  if (user.umbra < cost) fail('insufficient_umbra');
  run('UPDATE users SET umbra=umbra-? WHERE id=?', cost, userId);
  run('UPDATE player_skills SET level=level+1, count=count-? WHERE id=?', needed, playerSkillId);
  return { level: ps.level + 1, cost };
}

export function activateSkill(userId, playerGeneralId, skillKey) {
  const pg = generalRow(playerGeneralId);
  if (!pg || pg.user_id !== userId) throw new HttpError(404, 'general_not_found');
  const innate = innateSkill(pg);
  const equipped = equippedSkills(pg.id);
  const owned = [innate, ...equipped.map((e) => ({ ...e, level: e.level }))].filter(Boolean);
  const skill = owned.find((s) => s.key === skillKey);
  if (!skill) throw new HttpError(404, 'skill_not_found');
  if (skill.kind !== 'active') fail('passive_skill');
  const cd = get('SELECT * FROM cooldowns WHERE player_general_id=? AND skill_id=?', pg.id, skill.id);
  if (cd && cd.ready_at > now()) fail('cooldown', { readyAt: cd.ready_at });
  const level = skill.innate ? Math.max(1, Math.round((pg.level ?? 1) / 3) + 1) : (skill.level ?? 1);
  const scale = skillScale(pg, level);
  const effects = parseJson(skill.effects, []);
  const ts = now();
  const result = { effects: [], until: null };
  for (const e of effects) {
    const value = (e.value ?? 0) * scale;
    if (e.type === 'instant_resources') {
      for (const key of SEASONAL_RESOURCES) {
        const cap = storageCap(userId);
        run(`UPDATE users SET ${key}=MIN(?,${key}+?) WHERE id=?`, cap, Math.round(value), userId);
      }
      result.effects.push({ type: e.type, amount: Math.round(value) });
    } else if (e.type === 'instant_circuit') {
      const cap = circuitCap(userId);
      run('UPDATE users SET circuit=MIN(?,circuit+?) WHERE id=?', cap, Math.round(value), userId);
      result.effects.push({ type: e.type, amount: Math.round(value) });
    } else if (e.type === 'heal_hp') {
      run('UPDATE player_generals SET hp=MIN(100,hp+?) WHERE id=?', Math.round(value), pg.id);
      result.effects.push({ type: e.type, amount: Math.round(value) });
    } else if (e.type.startsWith('buff_')) {
      const kind = e.type;
      const duration = (e.duration ?? skill.duration ?? 300) * 1000;
      run('INSERT INTO buffs (user_id,general_id,kind,value,context_city_id,expires_at) VALUES (?,?,?,?,?,?)',
        userId, pg.id, kind, value, pg.location_type === 'city' ? pg.location_id : null, ts + duration);
      result.effects.push({ type: kind, value, until: ts + duration });
      result.until = ts + duration;
    }
  }
  const cooldownMs = Math.max(1000, (skill.base_cooldown ?? 60) * 1000 * Math.max(0.5, 1 - 0.02 * (level - 1)));
  run('INSERT INTO cooldowns (player_general_id,skill_id,ready_at) VALUES (?,?,?) ON CONFLICT(player_general_id,skill_id) DO UPDATE SET ready_at=excluded.ready_at', pg.id, skill.id, ts + cooldownMs);
  const title = skill.name_zh;
  addReport(userId, 'skill', '技能发动', 'Skill Activated', `${title} 已发动。`, `${skill.name_en} activated.`, { skill: skill.key, effects: result.effects });
  return { ...result, readyAt: ts + cooldownMs, skill: skillCardView(skill), level };
}

export function healGeneral(userId, playerGeneralId) {
  const pg = generalRow(playerGeneralId);
  if (!pg || pg.user_id !== userId) throw new HttpError(404, 'general_not_found');
  const need = 100 - pg.hp;
  if (need <= 0) fail('full_hp');
  const cost = Math.ceil(need * 2);
  const user = getUser(userId);
  if (user.umbra < cost) fail('insufficient_umbra');
  run('UPDATE users SET umbra=umbra-? WHERE id=?', cost, userId);
  run('UPDATE player_generals SET hp=100, hp_at=? WHERE id=?', now(), playerGeneralId);
  return { cost };
}

/* ------------------------------------------------------------------ */
/* Research, shop, quests                                               */
/* ------------------------------------------------------------------ */

export function startResearch(userId, techKey) {
  ensureSeason();
  const def = get('SELECT * FROM tech_defs WHERE key=?', techKey);
  if (!def) throw new HttpError(404, 'tech_not_found');
  const level = techLevel(userId, techKey);
  const lab = get(`SELECT MAX(f.level) l FROM facilities f JOIN cities c ON c.id=f.city_id WHERE c.user_id=? AND f.type='lab'`, userId)?.l ?? 0;
  if (lab < def.requires_lab) fail('requires_lab', { lab: def.requires_lab });
  const maxAllowed = def.scope === 'seasonal' ? Math.min(def.max_level, lab) : def.max_level;
  if (level >= maxAllowed) fail('max_level');
  if (get('SELECT id FROM research_queue WHERE user_id=?', userId)) fail('research_busy');
  const cost = techCost(def, level);
  payResource(userId, cost);
  const gens = all(`SELECT pg.*, g.*, pg.id AS id FROM city_generals cg JOIN player_generals pg ON pg.id=cg.player_general_id JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?`, userId);
  const pass = passiveSums(gens, userId);
  const mods = techMods(userId);
  const seconds = Math.max(1, Math.round(def.base_seconds * (1 + level * 0.6) / Number(getSetting('research_speed', 60)) / (1 + (mods.research_speed_pct ?? 0) + pass.research_speed_pct)));
  run('INSERT INTO research_queue (user_id,tech_key,target_level,finish_at,started_at) VALUES (?,?,?,?,?)', userId, techKey, level + 1, now() + seconds * 1000, now());
  return { seconds, targetLevel: level + 1 };
}

export function shopView(userId) {
  const user = getUser(userId);
  return {
    items: SHOP_ITEMS.map((i) => ({ id: i.id, name: { zh: i.name_zh, en: i.name_en }, desc: { zh: i.desc_zh, en: i.desc_en }, price: i.price, grant: i.grant })),
    user: { lumen: user.lumen, umbra: user.umbra, circuit: user.circuit, tapes: user.tapes },
  };
}

export function buyShopItem(userId, itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) throw new HttpError(404, 'item_not_found');
  const user = getUser(userId);
  for (const [currency, amount] of Object.entries(item.price)) {
    if ((user[currency] ?? 0) < amount) fail(currency === 'lumen' ? 'insufficient_lumen' : 'insufficient_umbra');
  }
  tx(() => {
    for (const [currency, amount] of Object.entries(item.price)) {
      run(`UPDATE users SET ${currency}=${currency}-? WHERE id=?`, amount, userId);
      addTransaction(userId, currency, -amount, `shop_${item.id}`);
    }
    for (const [key, amount] of Object.entries(item.grant)) {
      if (key === 'tapes') run('UPDATE users SET tapes=tapes+? WHERE id=?', amount, userId);
      else if (key === 'circuit') run('UPDATE users SET circuit=MIN(?,circuit+?) WHERE id=?', circuitCap(userId), amount, userId);
      else if (key === 'lumen' || key === 'umbra') run(`UPDATE users SET ${key}=${key}+? WHERE id=?`, amount, userId);
      else run(`UPDATE users SET ${key}=MIN(?,${key}+?) WHERE id=?`, storageCap(userId), amount, userId);
    }
  });
  return { item: { id: item.id, name: { zh: item.name_zh, en: item.name_en } } };
}

export function claimQuest(userId, questKey) {
  const quest = get('SELECT * FROM quests WHERE key=?', questKey);
  if (!quest) throw new HttpError(404, 'quest_not_found');
  if (get('SELECT * FROM quest_claims WHERE user_id=? AND quest_key=?', userId, questKey)) fail('already_claimed');
  const progress = get('SELECT value FROM counters WHERE user_id=? AND key=?', userId, quest.metric)?.value ?? 0;
  if (progress < quest.target) fail('not_complete');
  tx(() => {
    run('UPDATE users SET lumen=lumen+?, umbra=umbra+? WHERE id=?', quest.reward_bright, quest.reward_night, userId);
    run('INSERT INTO quest_claims (user_id,quest_key,claimed_at) VALUES (?,?,?)', userId, questKey, now());
    addTransaction(userId, 'lumen', quest.reward_bright, `quest_${questKey}`);
    addTransaction(userId, 'umbra', quest.reward_night, `quest_${questKey}`);
  });
  return { reward: { lumen: quest.reward_bright, umbra: quest.reward_night } };
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

export function mapView(userId, { cx, cy, zoom }) {
  const w = numberSetting('map_width', 512), h = numberSetting('map_height', 512);
  const z = Math.max(0.3, Math.min(12, Number(zoom) || 6));
  const block = z >= 6 ? 1 : z >= 3 ? 2 : z >= 1.5 ? 4 : z >= 0.7 ? 8 : 16;
  const tilesAcross = Math.ceil(1000 / z);
  const tilesDown = Math.ceil(640 / z);
  const halfW = Math.ceil(tilesAcross / 2), halfH = Math.ceil(tilesDown / 2);
  const x0 = Math.max(0, Math.floor(cx) - halfW), x1 = Math.min(w - 1, Math.floor(cx) + halfW);
  const y0 = Math.max(0, Math.floor(cy) - halfH), y1 = Math.min(h - 1, Math.floor(cy) + halfH);
  let rows;
  if (block === 1) {
    rows = all(`SELECT x,y,type,level,owner_id,city_id,gateway_dir,res FROM tiles WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?`, x0, x1, y0, y1);
  } else {
    const raw = all(`SELECT (x/?)*? bx,(y/?)*? by,owner_id,type,COUNT(*) c FROM tiles
      WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ? GROUP BY bx,by,owner_id,type`, block, block, block, block, x0, x1, y0, y1);
    const map = new Map();
    for (const r of raw) {
      const key = `${r.bx},${r.by}`;
      const cur = map.get(key);
      const prio = { hole: 6, gateway: 5, city: 4, fort: 3, resource: 2, empty: 1 };
      if (!cur || prio[r.type] > prio[cur.type] || (r.owner_id && !cur.owner_id)) map.set(key, r);
    }
    rows = [...map.values()].map((r) => ({ x: r.bx, y: r.by, type: r.type, level: 0, owner_id: r.owner_id, city_id: null, gateway_dir: null, res: null, block }));
  }
  const cities = all(`SELECT c.*, u.display_name, u.charter FROM cities c JOIN users u ON u.id=c.user_id
    WHERE c.x BETWEEN ? AND ? AND c.y BETWEEN ? AND ?`, x0, x1, y0, y1);
  const gateways = all("SELECT x,y,level,name_zh,name_en,owner_id,gateway_dir FROM tiles WHERE type='gateway'");
  const hole = get("SELECT x,y,level,name_zh,name_en,owner_id,durability,max_durability FROM tiles WHERE type='hole'");
  return {
    bounds: { x0, x1, y0, y1, width: w, height: h }, block, zoom: z,
    tiles: rows.map((r) => [r.x, r.y, r.type, r.owner_id, r.level, r.gateway_dir, r.block ?? 1, r.res ? parseJson(r.res, {}) : null]),
    cities: cities.map((c) => ({ id: c.id, x: c.x, y: c.y, name: loc(c), owner: c.display_name, charter: c.charter, isCapital: !!c.is_capital })),
    gateways, hole,
  };
}

export function claimTile(userId, { x, y }) {
  ensureSeason();
  accrue(userId);
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile) throw new HttpError(404, 'no_tile');
  if (tile.owner_id) fail('occupied');
  if (tile.type !== 'empty') fail('need_army');
  const adj = get(`SELECT 1 ok FROM tiles WHERE owner_id=? AND ABS(x-?)<=1 AND ABS(y-?)<=1 LIMIT 1`, userId, x, y);
  if (!adj) fail('not_adjacent');
  run('UPDATE tiles SET owner_id=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', userId, now(), now(), x, y);
  addCounter(userId, 'claim', 1);
  return { x, y };
}

export function convertSubbase(userId, { x, y }) {
  ensureSeason();
  accrue(userId);
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile || tile.owner_id !== userId) fail('own_tile');
  if (tile.type !== 'resource') fail('invalid_tile');
  if (tile.city_id) fail('already_city');
  if (subbaseCount(userId) >= subbaseCap(userId)) fail('subbase_cap');
  const refund = Number(getSetting('resource_claim_circuit', 3));
  const nameZh = `分基地 ${subbaseCount(userId) + 1}`;
  const nameEn = `Sub-Base ${subbaseCount(userId) + 1}`;
  const cityId = createCity(userId, x, y, currentSeasonId(), { isCapital: 0, nameZh, nameEn, governorLevel: 1, tier: 1 });
  run('UPDATE users SET circuit=circuit+? WHERE id=?', refund, userId);
  addTransaction(userId, 'circuit', refund, 'subbase_refund');
  addCounter(userId, 'subbase', 1);
  addReport(userId, 'build', '分基地上线', 'Sub-Base Online',
    `坐标 ${x},${y} 的资源点已改建为分基地，返还 ${refund} 点思考回路。`,
    `Resource node ${x},${y} was converted into a sub-base; ${refund} Circuit Points refunded.`, { cityId, x, y });
  return { cityId, refund, cap: subbaseCap(userId) };
}

export function abandonTile(userId, { x, y }) {
  ensureSeason();
  accrue(userId);
  const tile = get('SELECT * FROM tiles WHERE x=? AND y=?', x, y);
  if (!tile || tile.owner_id !== userId) fail('own_tile');
  if (tile.type !== 'resource' || tile.city_id) fail('invalid_tile');
  const refund = Number(getSetting('resource_claim_circuit', 3));
  run('UPDATE tiles SET owner_id=NULL, city_id=NULL, garrison=NULL, occupied_at=NULL, updated_at=? WHERE x=? AND y=?', now(), x, y);
  run('DELETE FROM tile_garrison WHERE x=? AND y=?', x, y);
  run('UPDATE users SET circuit=circuit+? WHERE id=?', refund, userId);
  addTransaction(userId, 'circuit', refund, 'abandon_refund');
  return { refund };
}

export function attackTile(userId, body) {
  ensureSeason();
  accrue(userId);
  const cap = generalCostCap(userId);
  if (body.generalId) {
    const pg = generalRow(body.generalId);
    if (pg && pg.cost > cap) fail('general_cost_cap', { cost: pg.cost, cap });
  }
  const result = startAttack(userId, { x: body.x, y: body.y, generalId: body.generalId || null, troops: body.troops || {}, cityId: body.cityId });
  addCounter(userId, 'attack', 1);
  return result;
}

export function scoutTile(userId, body) {
  ensureSeason();
  accrue(userId);
  return startScout(userId, { x: body.x, y: body.y, count: body.count, cityId: body.cityId });
}

export function reinforceTile(userId, body) {
  ensureSeason();
  accrue(userId);
  return startReinforce(userId, { x: body.x, y: body.y, cityId: body.cityId, troops: body.troops || {} });
}

export function attackPreview(userId, body) {
  return previewAttack(userId, { x: body.x, y: body.y, generalId: body.generalId || null, troops: body.troops || {}, cityId: body.cityId });
}

export function tileView(userId, x, y) {
  accrue(userId);
  const intel = intelFor(userId, x, y);
  if (!intel) throw new HttpError(404, 'no_tile');
  const city = get('SELECT * FROM cities WHERE user_id=? ORDER BY is_capital DESC LIMIT 1', userId);
  if (city) intel.distance = Math.max(1, Math.max(Math.abs(city.x - x), Math.abs(city.y - y)));
  intel.troopsAvailable = city ? cityTroops(city.id) : [];
  return intel;
}

/* ------------------------------------------------------------------ */
/* Social, rankings, reports                                           */
/* ------------------------------------------------------------------ */

export function rankingView(userId, type = 'power') {
  const users = all('SELECT * FROM users WHERE status<>\'deleted\'');
  const rows = users.map((u) => {
    const power = playerPower(u.id);
    const tiles = get('SELECT COUNT(*) c FROM tiles WHERE owner_id=?', u.id)?.c ?? 0;
    const gateways = get("SELECT COUNT(*) c FROM tiles WHERE owner_id=? AND type='gateway'", u.id)?.c ?? 0;
    const generals = get('SELECT COUNT(*) c FROM player_generals WHERE user_id=?', u.id)?.c ?? 0;
    const alliance = get('SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.user_id=?', u.id)?.tag ?? null;
    return { userId: u.id, name: u.display_name, charter: u.charter, isBot: !!u.is_bot, power, tiles, gateways, generals, alliance };
  });
  const key = type === 'territory' ? 'tiles' : type === 'gateway' ? 'gateways' : type === 'generals' ? 'generals' : 'power';
  rows.sort((a, b) => b[key] - a[key] || b.power - a.power);
  return { type, rows: rows.slice(0, 100).map((r, i) => ({ ...r, rank: i + 1, self: r.userId === userId })) };
}

export function reportsView(userId) {
  return all('SELECT * FROM reports WHERE user_id=? ORDER BY id DESC LIMIT 80', userId).map((r) => ({
    id: r.id, kind: r.kind, title: loc(r, 'title'), body: loc(r, 'body'), payload: parseJson(r.payload, {}), read: !!r.read, createdAt: r.created_at,
  }));
}

export function markReports(userId, ids) {
  if (Array.isArray(ids) && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    run(`UPDATE reports SET read=1 WHERE user_id=? AND id IN (${placeholders})`, userId, ...ids.map(Number));
  } else {
    run('UPDATE reports SET read=1 WHERE user_id=?', userId);
  }
  return { ok: true };
}

export function chatView(userId) {
  const rows = all(`SELECT c.*, u.display_name, u.charter, u.role FROM chat_messages c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC LIMIT 60`);
  return rows.reverse().map((m) => ({ id: m.id, userId: m.user_id, name: m.display_name, charter: m.charter, role: m.role, body: m.body, createdAt: m.created_at, self: m.user_id === userId }));
}

export function postChat(userId, body) {
  body = String(body || '').trim().slice(0, 240);
  if (!body) fail('empty_message');
  const last = get('SELECT created_at FROM chat_messages WHERE user_id=? ORDER BY id DESC LIMIT 1', userId);
  if (last && now() - last.created_at < 3000) fail('chat_rate');
  run('INSERT INTO chat_messages (user_id,channel,body,created_at) VALUES (?,?,?,?)', userId, 'world', body, now());
  return { ok: true };
}

export function allianceView(userId) {
  const mine = get('SELECT a.*, am.role FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.user_id=?', userId);
  const mineMembers = mine ? all(`SELECT am.*, u.display_name, u.charter FROM alliance_members am JOIN users u ON u.id=am.user_id WHERE am.alliance_id=? ORDER BY am.role DESC, am.joined_at`, mine.id) : [];
  const list = all(`SELECT a.*, u.display_name leader_name, COUNT(am.user_id) members,
    (SELECT COUNT(*) FROM alliance_members x WHERE x.alliance_id=a.id) member_count
    FROM alliances a JOIN users u ON u.id=a.leader_id LEFT JOIN alliance_members am ON am.alliance_id=a.id
    GROUP BY a.id ORDER BY member_count DESC LIMIT 40`);
  return {
    mine: mine ? { id: mine.id, tag: mine.tag, name: mine.name, role: mine.role, leaderId: mine.leader_id, desc: { zh: mine.description_zh, en: mine.description_en }, members: mineMembers.map((m) => ({ userId: m.user_id, name: m.display_name, charter: m.charter, role: m.role, joinedAt: m.joined_at })) } : null,
    list: list.map((a) => ({ id: a.id, tag: a.tag, name: a.name, leaderId: a.leader_id, leaderName: a.leader_name, open: !!a.open, memberCount: a.member_count, desc: { zh: a.description_zh, en: a.description_en } })),
  };
}

export function createAlliance(userId, { tag, name, desc }) {
  tag = String(tag || '').trim().toUpperCase();
  name = String(name || '').trim().slice(0, 32);
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) fail('invalid_tag');
  if (name.length < 2) fail('invalid_name');
  if (get('SELECT * FROM alliance_members WHERE user_id=?', userId)) fail('already_in_alliance');
  if (get('SELECT id FROM alliances WHERE tag=?', tag)) fail('tag_taken');
  const id = tx(() => {
    const r = run('INSERT INTO alliances (tag,name,leader_id,description_zh,description_en,open,created_at) VALUES (?,?,?,?,?,1,?)', tag, name, userId, String(desc || '').slice(0, 120), String(desc || '').slice(0, 120), now());
    run('INSERT INTO alliance_members (alliance_id,user_id,role,joined_at) VALUES (?,?,?,?)', r.lastInsertRowid, userId, 'leader', now());
    return r.lastInsertRowid;
  });
  addCounter(userId, 'alliance_join', 1);
  return { id };
}

export function joinAlliance(userId, allianceId) {
  if (get('SELECT * FROM alliance_members WHERE user_id=?', userId)) fail('already_in_alliance');
  const a = get('SELECT * FROM alliances WHERE id=?', allianceId);
  if (!a || !a.open) fail('not_open');
  run('INSERT INTO alliance_members (alliance_id,user_id,role,joined_at) VALUES (?,?,?,?)', allianceId, userId, 'member', now());
  addCounter(userId, 'alliance_join', 1);
  return { ok: true };
}

export function leaveAlliance(userId) {
  const m = get('SELECT * FROM alliance_members WHERE user_id=?', userId);
  if (!m) fail('not_in_alliance');
  const a = get('SELECT * FROM alliances WHERE id=?', m.alliance_id);
  if (a && a.leader_id === userId) {
    const others = all('SELECT * FROM alliance_members WHERE alliance_id=? AND user_id<>? ORDER BY joined_at', m.alliance_id, userId);
    if (others.length) run('UPDATE alliance_members SET role=\'leader\' WHERE user_id=?', others[0].user_id);
    else run('DELETE FROM alliances WHERE id=?', m.alliance_id);
    if (others.length) run('UPDATE alliances SET leader_id=? WHERE id=?', others[0].user_id, m.alliance_id);
  }
  run('DELETE FROM alliance_members WHERE user_id=?', userId);
  return { ok: true };
}

export function profileView(userId) {
  const user = getUser(userId);
  const gens = all(`SELECT pg.*, g.*, pg.id AS id FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?`, userId);
  const best = gens.map((g) => ({ name: loc(g), rarity: g.rarity, power: generalPower(g), artUrl: g.art_url })).sort((a, b) => b.power - a.power).slice(0, 3);
  const stats = {
    power: playerPower(userId), generals: gens.length, tiles: get('SELECT COUNT(*) c FROM tiles WHERE owner_id=?', userId)?.c ?? 0,
    cities: get('SELECT COUNT(*) c FROM cities WHERE user_id=?', userId)?.c ?? 0,
    wins: get("SELECT value FROM counters WHERE user_id=? AND key='battle_win'", userId)?.value ?? 0,
    losses: get("SELECT value FROM counters WHERE user_id=? AND key='battle_loss'", userId)?.value ?? 0,
    research: get('SELECT SUM(level) s FROM player_techs WHERE user_id=?', userId)?.s ?? 0,
  };
  return { user: publicUser(user), stats, best, joinedAt: user.created_at, charter: { key: user.charter, ...CHARTERS[user.charter] } };
}
