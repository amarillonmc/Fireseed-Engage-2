import fs from 'node:fs';
import path from 'node:path';
import { route, requireAdmin, HttpError } from './http.mjs';
import { all, get, run, now, getSetting, allSettings, setSetting, numberSetting, parseJson } from './db.mjs';
import { PUBLIC_DIR, RARITIES, ELEMENTS, CHARTERS, DEFAULT_SETTINGS } from './config.mjs';
import { playerPower } from './engine.mjs';
import { seasonList, rebuildSeason, endSeason, setSeasonHold, latestSeason } from './season.mjs';
import { hashPassword, newToken } from './auth.mjs';

function audit(adminId, action, target, details) {
  run('INSERT INTO audit_log (admin_id,action,target,details,created_at) VALUES (?,?,?,?,?)', adminId, action, target ?? null, JSON.stringify(details ?? {}), now());
}

route('GET', '/api/admin/overview', async (ctx) => {
  requireAdmin(ctx);
  const season = latestSeason();
  const top = all('SELECT id, display_name, role, is_bot, last_login_at FROM users ORDER BY id LIMIT 8')
    .map((u) => ({ ...u, power: playerPower(u.id) })).sort((a, b) => b.power - a.power);
  return {
    counts: {
      users: get('SELECT COUNT(*) c FROM users WHERE is_bot=0')?.c ?? 0,
      bots: get('SELECT COUNT(*) c FROM users WHERE is_bot=1')?.c ?? 0,
      online: get('SELECT COUNT(*) c FROM users WHERE last_seen_at>? AND is_bot=0', now() - 5 * 60000)?.c ?? 0,
      cities: get('SELECT COUNT(*) c FROM cities')?.c ?? 0,
      ownedTiles: get('SELECT COUNT(*) c FROM tiles WHERE owner_id IS NOT NULL')?.c ?? 0,
      movements: get("SELECT COUNT(*) c FROM movements WHERE status='marching'")?.c ?? 0,
      generals: get('SELECT COUNT(*) c FROM player_generals')?.c ?? 0,
      battles: get("SELECT COUNT(*) c FROM reports WHERE kind='battle'")?.c ?? 0,
    },
    economy: {
      lumen: get('SELECT SUM(lumen) s FROM users')?.s ?? 0,
      umbra: get('SELECT SUM(umbra) s FROM users')?.s ?? 0,
      circuit: get('SELECT SUM(circuit) s FROM users')?.s ?? 0,
      ember: get('SELECT SUM(ember) s FROM users')?.s ?? 0,
    },
    charters: all('SELECT charter, COUNT(*) c FROM users WHERE is_bot=0 GROUP BY charter ORDER BY c DESC'),
    season: season ? { id: season.id, number: season.number, name_zh: season.name_zh, name_en: season.name_en, status: season.status, started_at: season.started_at, hole_holder_id: season.hole_holder_id } : null,
    top,
    recentAudit: all('SELECT a.*, u.display_name admin_name FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 12'),
  };
});

route('GET', '/api/admin/users', async (ctx) => {
  requireAdmin(ctx);
  const q = String(ctx.query.get('q') || '').trim();
  const rows = q
    ? all(`SELECT * FROM users WHERE username LIKE ? OR display_name LIKE ? ORDER BY id DESC LIMIT 100`, `%${q}%`, `%${q}%`)
    : all('SELECT * FROM users ORDER BY id DESC LIMIT 100');
  return {
    users: rows.map((u) => ({
      id: u.id, username: u.username, displayName: u.display_name, role: u.role, charter: u.charter, locale: u.locale,
      status: u.status, isBot: !!u.is_bot, lumen: u.lumen, umbra: u.umbra, circuit: u.circuit, createdAt: u.created_at,
      lastLoginAt: u.last_login_at, lastSeenAt: u.last_seen_at, power: playerPower(u.id),
      cities: get('SELECT COUNT(*) c FROM cities WHERE user_id=?', u.id)?.c ?? 0,
      tiles: get('SELECT COUNT(*) c FROM tiles WHERE owner_id=?', u.id)?.c ?? 0,
    })),
  };
});

route('GET', '/api/admin/users/:id', async (ctx) => {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const u = get('SELECT * FROM users WHERE id=?', id);
  if (!u) throw new HttpError(404, 'user_not_found');
  return {
    user: { ...u, password_hash: undefined },
    cities: all('SELECT * FROM cities WHERE user_id=?', id),
    generals: all('SELECT pg.*, g.name_zh, g.name_en, g.rarity FROM player_generals pg JOIN generals g ON g.id=pg.general_id WHERE pg.user_id=?', id),
    techs: all('SELECT pt.*, td.name_zh, td.name_en, td.scope FROM player_techs pt JOIN tech_defs td ON td.key=pt.tech_key WHERE pt.user_id=?', id),
    alliance: get('SELECT a.*, am.role FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.user_id=?', id),
    vassal: get('SELECT * FROM vassals WHERE user_id=? OR liege_id=?', id, id),
    reports: all('SELECT * FROM reports WHERE user_id=? ORDER BY id DESC LIMIT 20', id),
    power: playerPower(id),
  };
});

route('POST', '/api/admin/users/:id', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const u = get('SELECT * FROM users WHERE id=?', id);
  if (!u) throw new HttpError(404, 'user_not_found');
  const b = ctx.body;
  if (b.displayName != null) run('UPDATE users SET display_name=? WHERE id=?', String(b.displayName).slice(0, 24), id);
  if (b.role != null && ['player', 'admin'].includes(b.role)) run('UPDATE users SET role=? WHERE id=?', b.role, id);
  if (b.status != null && ['active', 'banned'].includes(b.status)) {
    run('UPDATE users SET status=?, banned_reason=? WHERE id=?', b.status, String(b.bannedReason || '').slice(0, 200), id);
  }
  if (b.charter != null && CHARTERS[b.charter]) run('UPDATE users SET charter=? WHERE id=?', b.charter, id);
  if (b.locale != null && ['zh', 'en'].includes(b.locale)) run('UPDATE users SET locale=? WHERE id=?', b.locale, id);
  if (b.password) {
    run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(String(b.password)), id);
    run('DELETE FROM sessions WHERE user_id=?', id);
  }
  audit(admin.id, 'user.update', String(id), { fields: Object.keys(b) });
  return { user: { ...get('SELECT * FROM users WHERE id=?', id), password_hash: undefined } };
});

route('POST', '/api/admin/users/:id/grant', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const u = get('SELECT * FROM users WHERE id=?', id);
  if (!u) throw new HttpError(404, 'user_not_found');
  const keys = ['lumen', 'umbra', 'circuit', 'ember', 'cryo', 'bloom', 'radiance', 'tapes'];
  const key = ctx.body.currency;
  const amount = Math.round(Number(ctx.body.amount));
  if (!keys.includes(key) || !Number.isFinite(amount) || Math.abs(amount) > 10000000) throw new HttpError(400, 'invalid_grant');
  run(`UPDATE users SET ${key}=MAX(0,${key}+?) WHERE id=?`, amount, id);
  run('INSERT INTO transactions (user_id,currency,amount,reason,created_at) VALUES (?,?,?,?,?)', id, key, amount, `admin:${admin.username}`, now());
  audit(admin.id, 'user.grant', String(id), { key, amount });
  return { value: get(`SELECT ${key} v FROM users WHERE id=?`, id).v };
});

route('POST', '/api/admin/users/:id/reset-password', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  if (!get('SELECT id FROM users WHERE id=?', id)) throw new HttpError(404, 'user_not_found');
  const password = String(ctx.body.password || newToken(6));
  run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(password), id);
  run('DELETE FROM sessions WHERE user_id=?', id);
  audit(admin.id, 'user.reset_password', String(id), {});
  return { password };
});

route('GET', '/api/admin/generals', async (ctx) => {
  requireAdmin(ctx);
  return {
    generals: all('SELECT g.*, s.name_zh skill_zh, s.name_en skill_en FROM generals g LEFT JOIN skill_defs s ON s.id=g.innate_skill_id ORDER BY g.id'),
    skills: all('SELECT id,key,name_zh,name_en,kind,element,rare FROM skill_defs ORDER BY id'),
  };
});

function validateGeneral(b) {
  if (!b.name_zh || !b.name_en) throw new HttpError(400, 'name_required');
  if (!RARITIES.includes(b.rarity)) throw new HttpError(400, 'invalid_rarity');
  if (!ELEMENTS.includes(b.element)) throw new HttpError(400, 'invalid_element');
  const cost = Number(b.cost);
  if (!(cost >= 1 && cost <= 4 && Math.round(cost * 2) === cost * 2)) throw new HttpError(400, 'invalid_cost');
  for (const k of ['base_atk', 'base_def', 'base_spd', 'base_int']) {
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < 1 || v > 300) throw new HttpError(400, 'invalid_stat');
  }
}

route('POST', '/api/admin/generals', async (ctx) => {
  const admin = requireAdmin(ctx);
  const b = ctx.body;
  validateGeneral(b);
  const key = String(b.key || `custom_${Date.now()}`).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  if (get('SELECT id FROM generals WHERE key=?', key)) throw new HttpError(400, 'key_taken');
  const r = run(`INSERT INTO generals (key,name_zh,name_en,title_zh,title_en,source,source_ref,rarity,cost,element,base_hp,base_atk,base_def,base_spd,base_int,art_url,innate_skill_id,pool_weight,enabled,lore_zh,lore_en,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    key, b.name_zh, b.name_en, b.title_zh || '', b.title_en || '', b.source || 'Custom', b.source_ref || '', b.rarity, Number(b.cost), b.element,
    Number(b.base_hp ?? 100), Number(b.base_atk), Number(b.base_def), Number(b.base_spd), Number(b.base_int), b.art_url || null,
    b.innate_skill_id ? Number(b.innate_skill_id) : null, Number(b.pool_weight ?? 100), b.enabled === false ? 0 : 1,
    b.lore_zh || '', b.lore_en || '', now());
  audit(admin.id, 'general.create', String(r.lastInsertRowid), { key });
  return { id: r.lastInsertRowid, key };
});

route('POST', '/api/admin/generals/:id', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const g = get('SELECT * FROM generals WHERE id=?', id);
  if (!g) throw new HttpError(404, 'general_not_found');
  const b = { ...g, ...ctx.body };
  validateGeneral(b);
  run(`UPDATE generals SET name_zh=?,name_en=?,title_zh=?,title_en=?,source=?,source_ref=?,rarity=?,cost=?,element=?,base_hp=?,base_atk=?,base_def=?,base_spd=?,base_int=?,art_url=?,innate_skill_id=?,pool_weight=?,enabled=?,lore_zh=?,lore_en=? WHERE id=?`,
    b.name_zh, b.name_en, b.title_zh || '', b.title_en || '', b.source || '', b.source_ref || '', b.rarity, Number(b.cost), b.element,
    Number(b.base_hp ?? 100), Number(b.base_atk), Number(b.base_def), Number(b.base_spd), Number(b.base_int), b.art_url || null,
    b.innate_skill_id ? Number(b.innate_skill_id) : null, Number(b.pool_weight ?? 100), b.enabled === false || b.enabled === 0 ? 0 : 1,
    b.lore_zh || '', b.lore_en || '', id);
  audit(admin.id, 'general.update', String(id), {});
  return { general: get('SELECT * FROM generals WHERE id=?', id) };
});

route('POST', '/api/admin/generals/:id/delete', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  run('UPDATE generals SET enabled=0 WHERE id=?', id);
  audit(admin.id, 'general.disable', String(id), {});
  return { ok: true };
});

route('POST', '/api/admin/generals/:id/clone', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const g = get('SELECT * FROM generals WHERE id=?', id);
  if (!g) throw new HttpError(404, 'general_not_found');
  const key = `${g.key}_copy_${Date.now().toString(36)}`;
  const r = run(`INSERT INTO generals (key,name_zh,name_en,title_zh,title_en,source,source_ref,rarity,cost,element,base_hp,base_atk,base_def,base_spd,base_int,art_url,innate_skill_id,pool_weight,enabled,lore_zh,lore_en,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    key, `${g.name_zh}·副本`, `${g.name_en} Copy`, g.title_zh, g.title_en, g.source, g.source_ref, g.rarity, g.cost, g.element,
    g.base_hp, g.base_atk, g.base_def, g.base_spd, g.base_int, g.art_url, g.innate_skill_id, g.pool_weight, 1, g.lore_zh, g.lore_en, now());
  audit(admin.id, 'general.clone', String(id), { newId: r.lastInsertRowid });
  return { id: r.lastInsertRowid, key };
});

route('GET', '/api/admin/skills', async (ctx) => {
  requireAdmin(ctx);
  return { skills: all('SELECT * FROM skill_defs ORDER BY id') };
});

function validateSkill(b) {
  if (!b.name_zh || !b.name_en) throw new HttpError(400, 'name_required');
  if (!['active', 'passive'].includes(b.kind)) throw new HttpError(400, 'invalid_kind');
  if (!ELEMENTS.includes(b.element)) throw new HttpError(400, 'invalid_element');
  if (!RARITIES.includes(b.rare)) throw new HttpError(400, 'invalid_rare');
  const effects = typeof b.effects === 'string' ? parseJson(b.effects, null) : b.effects;
  if (!Array.isArray(effects)) throw new HttpError(400, 'invalid_effects');
  return effects;
}

route('POST', '/api/admin/skills', async (ctx) => {
  const admin = requireAdmin(ctx);
  const b = ctx.body;
  const effects = validateSkill(b);
  const key = String(b.key || `skill_${Date.now()}`).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  if (get('SELECT id FROM skill_defs WHERE key=?', key)) throw new HttpError(400, 'key_taken');
  const r = run(`INSERT INTO skill_defs (key,name_zh,name_en,desc_zh,desc_en,kind,element,max_level,base_cooldown,duration,effects,rare,pool_weight,enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, key, b.name_zh, b.name_en, b.desc_zh || '', b.desc_en || '', b.kind, b.element,
    Number(b.max_level ?? 10), Number(b.base_cooldown ?? 0), Number(b.duration ?? 0), JSON.stringify(effects), b.rare, Number(b.pool_weight ?? 100), b.enabled === false ? 0 : 1);
  audit(admin.id, 'skill.create', String(r.lastInsertRowid), { key });
  return { id: r.lastInsertRowid, key };
});

route('POST', '/api/admin/skills/:id', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const s = get('SELECT * FROM skill_defs WHERE id=?', id);
  if (!s) throw new HttpError(404, 'skill_not_found');
  const b = { ...s, ...ctx.body };
  const effects = validateSkill(b);
  run(`UPDATE skill_defs SET name_zh=?,name_en=?,desc_zh=?,desc_en=?,kind=?,element=?,max_level=?,base_cooldown=?,duration=?,effects=?,rare=?,pool_weight=?,enabled=? WHERE id=?`,
    b.name_zh, b.name_en, b.desc_zh || '', b.desc_en || '', b.kind, b.element, Number(b.max_level ?? 10), Number(b.base_cooldown ?? 0),
    Number(b.duration ?? 0), JSON.stringify(effects), b.rare, Number(b.pool_weight ?? 100), b.enabled === false || b.enabled === 0 ? 0 : 1, id);
  audit(admin.id, 'skill.update', String(id), {});
  return { skill: get('SELECT * FROM skill_defs WHERE id=?', id) };
});

route('POST', '/api/admin/skills/:id/delete', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  run('UPDATE skill_defs SET enabled=0 WHERE id=?', id);
  audit(admin.id, 'skill.disable', String(id), {});
  return { ok: true };
});

route('GET', '/api/admin/season', async (ctx) => {
  requireAdmin(ctx);
  return { seasons: seasonList(), active: latestSeason(), settings: { victoryHoldDays: getSetting('victory_hold_days', 30), rebuildDelayHours: getSetting('season_rebuild_delay_hours', 48) } };
});

route('POST', '/api/admin/season/rebuild', async (ctx) => {
  const admin = requireAdmin(ctx);
  if (ctx.body.confirm !== 'REBUILD') throw new HttpError(400, 'confirm_required');
  const result = rebuildSeason(admin.id, { nameZh: ctx.body.nameZh, nameEn: ctx.body.nameEn, holdDays: ctx.body.holdDays });
  audit(admin.id, 'season.rebuild', String(result.seasonId), result);
  return result;
});

route('POST', '/api/admin/season/end', async (ctx) => {
  const admin = requireAdmin(ctx);
  const s = endSeason(ctx.body.winnerUserId ? Number(ctx.body.winnerUserId) : null, 'admin');
  audit(admin.id, 'season.end', String(s?.id), {});
  return { ok: true };
});

route('POST', '/api/admin/season/hold', async (ctx) => {
  const admin = requireAdmin(ctx);
  const r = setSeasonHold(ctx.body.holdDays);
  audit(admin.id, 'season.hold', '', r);
  return r ?? { ok: false };
});

route('GET', '/api/admin/settings', async (ctx) => {
  requireAdmin(ctx);
  return { settings: allSettings(), keys: Object.keys(DEFAULT_SETTINGS) };
});

route('POST', '/api/admin/settings', async (ctx) => {
  const admin = requireAdmin(ctx);
  const b = ctx.body || {};
  const numeric = ['map_width', 'map_height', 'resource_tick_seconds', 'circuit_hours', 'storage_base', 'circuit_base_cap', 'subbase_base_cap', 'npc_strength',
    'registration_open', 'max_players', 'maintenance', 'starting_ember', 'starting_cryo', 'starting_bloom', 'starting_radiance',
    'starting_circuit', 'starting_bright', 'starting_night', 'season_start_bright', 'season_start_night', 'gacha_general_cost',
    'gacha_general_ten_cost', 'gacha_skill_cost', 'gacha_skill_ten_cost', 'gacha_pity', 'build_speed', 'research_speed',
    'training_speed', 'march_speed', 'resource_yield', 'victory_hold_days', 'offline_cap_hours', 'season_rebuild_delay_hours', 'resource_claim_circuit'];
  const updated = {};
  for (const [key, value] of Object.entries(b)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) continue;
    if (numeric.includes(key)) {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new HttpError(400, 'invalid_setting', { key });
      if (key === 'map_width' || key === 'map_height') {
        if (n < 64 || n > 1024) throw new HttpError(400, 'invalid_map_size');
      }
      setSetting(key, n);
      updated[key] = n;
    } else if (key === 'gacha_rates') {
      const rates = typeof value === 'string' ? parseJson(value, null) : value;
      if (!rates || typeof rates !== 'object') throw new HttpError(400, 'invalid_rates');
      setSetting(key, rates);
      updated[key] = rates;
    } else {
      setSetting(key, String(value));
      updated[key] = value;
    }
  }
  audit(admin.id, 'settings.update', '', updated);
  return { settings: allSettings() };
});

route('GET', '/api/admin/announcements', async (ctx) => {
  requireAdmin(ctx);
  return { announcements: all('SELECT * FROM announcements ORDER BY id DESC') };
});

route('POST', '/api/admin/announcements', async (ctx) => {
  const admin = requireAdmin(ctx);
  const b = ctx.body;
  if (!b.title_zh || !b.title_en) throw new HttpError(400, 'title_required');
  const r = run('INSERT INTO announcements (title_zh,title_en,body_zh,body_en,active,created_at) VALUES (?,?,?,?,?,?)',
    b.title_zh, b.title_en, b.body_zh || '', b.body_en || '', b.active === false ? 0 : 1, now());
  audit(admin.id, 'announcement.create', String(r.lastInsertRowid), {});
  return { id: r.lastInsertRowid };
});

route('POST', '/api/admin/announcements/:id', async (ctx) => {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const a = get('SELECT * FROM announcements WHERE id=?', id);
  if (!a) throw new HttpError(404, 'announcement_not_found');
  const b = { ...a, ...ctx.body };
  run('UPDATE announcements SET title_zh=?,title_en=?,body_zh=?,body_en=?,active=? WHERE id=?',
    b.title_zh, b.title_en, b.body_zh || '', b.body_en || '', b.active === false || b.active === 0 ? 0 : 1, id);
  audit(admin.id, 'announcement.update', String(id), {});
  return { ok: true };
});

route('GET', '/api/admin/audit', async (ctx) => {
  requireAdmin(ctx);
  return { audit: all('SELECT a.*, u.display_name admin_name FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 250') };
});

route('GET', '/api/admin/movements', async (ctx) => {
  requireAdmin(ctx);
  return {
    movements: all(`SELECT m.*, u.display_name attacker_name, t.display_name target_name FROM movements m
      JOIN users u ON u.id=m.user_id LEFT JOIN users t ON t.id=m.target_user_id ORDER BY m.id DESC LIMIT 100`).map((m) => ({ ...m, troops: parseJson(m.troops, {}) })),
    reports: all(`SELECT r.*, u.display_name FROM reports r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 60`),
  };
});

route('POST', '/api/admin/upload', async (ctx) => {
  const admin = requireAdmin(ctx);
  const { dataUrl } = ctx.body;
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'invalid_image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) throw new HttpError(400, 'image_too_large');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `admin_${Date.now()}_${newToken(3)}.${ext}`;
  const dir = path.join(PUBLIC_DIR, 'assets', 'generals');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  audit(admin.id, 'upload.general_art', name, { bytes: buf.length });
  return { url: `/assets/generals/${name}` };
});
