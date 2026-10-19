import { all, get, run, tx, now, getSetting, numberSetting, setSetting } from './db.mjs';
import { createCity, grantStarterTroops, findSpawn, generateWorld, gatewayPositions } from './world.mjs';
import { addReport, addTransaction, currentSeasonId, refreshHole } from './engine.mjs';

export function latestSeason() {
  return get('SELECT * FROM seasons ORDER BY id DESC LIMIT 1');
}

export function seasonList() {
  return all(`SELECT s.*, u.display_name winner_name FROM seasons s LEFT JOIN users u ON u.id=s.winner_user_id ORDER BY s.id DESC LIMIT 30`);
}

export function endSeason(winnerUserId = null, reason = 'admin') {
  const s = get("SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1");
  if (!s) return null;
  run("UPDATE seasons SET status='ended', ends_at=?, winner_user_id=? WHERE id=?", now(), winnerUserId, s.id);
  const label = reason === 'victory' ? '赛季终结' : '赛季已被管理员关闭';
  for (const u of all('SELECT id FROM users WHERE is_bot=0')) {
    addReport(u.id, 'season', '一个时代结束', 'A Cycle Ends',
      `${label}。世界将在 ${getSetting('season_rebuild_delay_hours', 48)} 小时后重建。`,
      `The cycle has ended. The world will be rebuilt in ${getSetting('season_rebuild_delay_hours', 48)} hours.`, { seasonId: s.id });
  }
  return s;
}

export function checkVictory() {
  const s = get("SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1");
  if (!s || !s.hole_holder_id || !s.hole_since) return false;
  if (now() - s.hole_since >= s.victory_hold_seconds * 1000) {
    endSeason(s.hole_holder_id, 'victory');
    return true;
  }
  return false;
}

export function seasonRemaining(season) {
  if (!season) return null;
  if (season.status !== 'active') return 0;
  if (!season.victory_hold_seconds) return null;
  return null;
}

export function resetUserForSeason(user, seasonId) {
  const startLumen = Number(getSetting('season_start_bright', 600));
  const startUmbra = Number(getSetting('season_start_night', 300));
  run(`UPDATE users SET season_id=?, ember=?, cryo=?, bloom=?, radiance=?, circuit=?, lumen=lumen+?, umbra=umbra+?, pity=0 WHERE id=?`,
    seasonId, Number(getSetting('starting_ember', 2500)), Number(getSetting('starting_cryo', 2500)),
    Number(getSetting('starting_bloom', 2500)), Number(getSetting('starting_radiance', 2500)),
    Number(getSetting('starting_circuit', 5)), startLumen, startUmbra, user.id);
  addTransaction(user.id, 'lumen', startLumen, 'season_start');
  addTransaction(user.id, 'umbra', startUmbra, 'season_start');
}

export function rebuildSeason(adminId, { nameZh, nameEn, holdDays } = {}) {
  const old = latestSeason();
  const nextNumber = (old?.number ?? 0) + 1;
  const zh = String(nameZh || `第 ${nextNumber} 赛季 · 新生协议`).slice(0, 64);
  const en = String(nameEn || `Cycle ${nextNumber} · Rebirth Protocol`).slice(0, 80);
  const hold = Math.max(60, Math.round(Number(holdDays || getSetting('victory_hold_days', 30)) * 86400));
  const ts = now();
  const result = tx(() => {
    if (old && old.status === 'active') run("UPDATE seasons SET status='ended', ends_at=? WHERE id=?", ts, old.id);
    const r = run('INSERT INTO seasons (number,name_zh,name_en,status,started_at,ends_at,victory_hold_seconds,created_at) VALUES (?,?,?,?,?,?,?,?)',
      nextNumber, zh, en, 'active', ts, null, hold, ts);
    const seasonId = r.lastInsertRowid;
    // Seasonal world state
    run('DELETE FROM tile_garrison');
    run('DELETE FROM tile_generals');
    run('DELETE FROM scouting');
    run('DELETE FROM training');
    run('DELETE FROM movements');
    run('DELETE FROM city_generals');
    run('DELETE FROM city_troops');
    run('DELETE FROM facilities');
    run('DELETE FROM cities');
    run('DELETE FROM research_queue');
    run("DELETE FROM player_techs WHERE tech_key IN (SELECT key FROM tech_defs WHERE scope='seasonal')");
    run('DELETE FROM buffs');
    run('DELETE FROM cooldowns');
    run('DELETE FROM vassals');
    run('DELETE FROM counters');
    run('DELETE FROM quest_claims');
    run('DELETE FROM reports');
    run("UPDATE player_generals SET location_type='reserve', location_id=NULL");
    setSetting('world_seed', (Number(getSetting('world_seed', 20260719)) + 7919) % 2000000000);
    generateWorld({ seasonId, seed: Number(getSetting('world_seed', 20260719)) });
    const users = all('SELECT * FROM users');
    const gateways = gatewayPositions();
    let idx = 0;
    for (const user of users) {
      resetUserForSeason(user, seasonId);
      const gw = gateways[idx % gateways.length];
      let pos = findSpawn(gw.x + 20 + (idx % 5) * 3, gw.y + 16 + (idx % 7) * 2, 80);
      if (!pos) pos = findSpawn(256, 256, 150);
      if (!pos) continue;
      const cid = createCity(user.id, pos.x, pos.y, seasonId, {
        isCapital: 1, nameZh: user.is_bot ? `${user.display_name} 城塞` : '新生钻台', nameEn: user.is_bot ? `${user.display_name} Bastion` : 'Rebirth Rig', governorLevel: user.is_bot ? 2 : 1, tier: 1,
      });
      grantStarterTroops(cid);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const t = get('SELECT type,owner_id FROM tiles WHERE x=? AND y=?', pos.x + dx, pos.y + dy);
        if (t && !t.owner_id && !['gateway', 'hole', 'fort', 'city'].includes(t.type)) {
          run('UPDATE tiles SET owner_id=?, occupied_at=?, updated_at=? WHERE x=? AND y=?', user.id, ts, ts, pos.x + dx, pos.y + dy);
        }
      }
      if (!user.is_bot) {
        addReport(user.id, 'season', '新赛季开始', 'New Cycle',
          `${zh} 已开始。赛季资产已重置，你的武将、技能卡与亮晶晶/夜静静被保留。`,
          `${en} has begun. Seasonal assets were reset; your Vanguards, skill cards, Lumen and Umbra were preserved.`, { seasonId });
      }
      idx++;
    }
    refreshHole();
    return { seasonId, number: nextNumber, nameZh: zh, nameEn: en, holdSeconds: hold };
  });
  return result;
}

export function autoRebuildIfDue() {
  const active = get("SELECT * FROM seasons WHERE status='active'");
  if (active) return false;
  const last = get("SELECT * FROM seasons WHERE status='ended' ORDER BY id DESC LIMIT 1");
  if (!last || !last.ends_at) return false;
  const delay = Number(getSetting('season_rebuild_delay_hours', 48)) * 3600000;
  if (now() - last.ends_at < delay) return false;
  rebuildSeason(0, {});
  return true;
}

export function setSeasonHold(holdDays) {
  const s = get("SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1");
  if (!s) return null;
  const seconds = Math.max(60, Math.round(Number(holdDays) * 86400));
  run('UPDATE seasons SET victory_hold_seconds=? WHERE id=?', seconds, s.id);
  return { seconds };
}
