PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at INTEGER,
  ends_at INTEGER,
  victory_hold_seconds INTEGER NOT NULL DEFAULT 2592000,
  hole_holder_id INTEGER,
  hole_since INTEGER,
  winner_user_id INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  charter TEXT NOT NULL DEFAULT 'lumen',
  locale TEXT NOT NULL DEFAULT 'zh',
  status TEXT NOT NULL DEFAULT 'active',
  banned_reason TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  lumen INTEGER NOT NULL DEFAULT 0,
  umbra INTEGER NOT NULL DEFAULT 0,
  circuit INTEGER NOT NULL DEFAULT 0,
  ember INTEGER NOT NULL DEFAULT 0,
  cryo INTEGER NOT NULL DEFAULT 0,
  bloom INTEGER NOT NULL DEFAULT 0,
  radiance INTEGER NOT NULL DEFAULT 0,
  season_id INTEGER,
  tutorial_step INTEGER NOT NULL DEFAULT 0,
  pity INTEGER NOT NULL DEFAULT 0,
  tapes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS economy (
  user_id INTEGER PRIMARY KEY,
  last_tick INTEGER NOT NULL,
  frac TEXT NOT NULL DEFAULT '{}',
  circuit_frac REAL NOT NULL DEFAULT 0,
  offline_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_capital INTEGER NOT NULL DEFAULT 0,
  durability INTEGER NOT NULL DEFAULT 3000,
  max_durability INTEGER NOT NULL DEFAULT 3000,
  governor_level INTEGER NOT NULL DEFAULT 1,
  season_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cities_user ON cities(user_id);
CREATE INDEX IF NOT EXISTS idx_cities_tile ON cities(x, y);

CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  gx INTEGER NOT NULL,
  gy INTEGER NOT NULL,
  type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  build_ends_at INTEGER,
  upgrade_to INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facilities_city ON facilities(city_id);

CREATE TABLE IF NOT EXISTS city_troops (
  city_id INTEGER NOT NULL,
  unit TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (city_id, unit)
);

CREATE TABLE IF NOT EXISTS city_generals (
  city_id INTEGER NOT NULL,
  player_general_id INTEGER NOT NULL,
  PRIMARY KEY (city_id, player_general_id)
);

CREATE TABLE IF NOT EXISTS tile_garrison (
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  unit TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (x, y, unit)
);

CREATE TABLE IF NOT EXISTS tile_generals (
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  player_general_id INTEGER NOT NULL,
  PRIMARY KEY (x, y, player_general_id)
);

CREATE TABLE IF NOT EXISTS training (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  unit TEXT NOT NULL,
  total INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  per_seconds REAL NOT NULL,
  finish_at INTEGER NOT NULL,
  started_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_training_city ON training(city_id);

CREATE TABLE IF NOT EXISTS tiles (
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  name_zh TEXT,
  name_en TEXT,
  owner_id INTEGER,
  city_id INTEGER,
  res TEXT,
  garrison TEXT,
  durability INTEGER NOT NULL DEFAULT 0,
  max_durability INTEGER NOT NULL DEFAULT 0,
  gateway_dir INTEGER,
  occupied_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (x, y)
);
CREATE INDEX IF NOT EXISTS idx_tiles_owner ON tiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_tiles_city ON tiles(city_id);
CREATE INDEX IF NOT EXISTS idx_tiles_type ON tiles(type);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  from_x INTEGER NOT NULL,
  from_y INTEGER NOT NULL,
  to_x INTEGER NOT NULL,
  to_y INTEGER NOT NULL,
  general_id INTEGER,
  troops TEXT NOT NULL DEFAULT '{}',
  depart_at INTEGER NOT NULL,
  arrive_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'marching',
  target_user_id INTEGER,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_arrive ON movements(status, arrive_at);
CREATE INDEX IF NOT EXISTS idx_movements_user ON movements(user_id);

CREATE TABLE IF NOT EXISTS generals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  source_ref TEXT,
  rarity TEXT NOT NULL,
  cost REAL NOT NULL,
  element TEXT NOT NULL,
  base_hp INTEGER NOT NULL DEFAULT 100,
  base_atk INTEGER NOT NULL,
  base_def INTEGER NOT NULL,
  base_spd INTEGER NOT NULL,
  base_int INTEGER NOT NULL,
  art_url TEXT,
  innate_skill_id INTEGER,
  pool_weight INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  lore_zh TEXT DEFAULT '',
  lore_en TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_generals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  general_id INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 100,
  hp_at INTEGER NOT NULL,
  dupes INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  location_type TEXT NOT NULL DEFAULT 'reserve',
  location_id INTEGER,
  acquired_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pg_user ON player_generals(user_id);

CREATE TABLE IF NOT EXISTS skill_defs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  desc_zh TEXT NOT NULL,
  desc_en TEXT NOT NULL,
  kind TEXT NOT NULL,
  element TEXT NOT NULL,
  max_level INTEGER NOT NULL DEFAULT 10,
  base_cooldown INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  effects TEXT NOT NULL DEFAULT '[]',
  rare TEXT NOT NULL DEFAULT 'A',
  pool_weight INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS player_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  count INTEGER NOT NULL DEFAULT 1,
  acquired_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ps_user ON player_skills(user_id);

CREATE TABLE IF NOT EXISTS general_skills (
  player_general_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  player_skill_id INTEGER NOT NULL,
  PRIMARY KEY (player_general_id, slot)
);

CREATE TABLE IF NOT EXISTS cooldowns (
  player_general_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  ready_at INTEGER NOT NULL,
  PRIMARY KEY (player_general_id, skill_id)
);

CREATE TABLE IF NOT EXISTS buffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  general_id INTEGER,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  context_city_id INTEGER,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tech_defs (
  key TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  desc_zh TEXT NOT NULL,
  desc_en TEXT NOT NULL,
  scope TEXT NOT NULL,
  category TEXT NOT NULL,
  max_level INTEGER NOT NULL DEFAULT 10,
  base_cost TEXT NOT NULL DEFAULT '{}',
  cost_growth REAL NOT NULL DEFAULT 0.6,
  effect_key TEXT NOT NULL,
  effect_value REAL NOT NULL,
  effect_growth REAL NOT NULL DEFAULT 0.5,
  base_seconds INTEGER NOT NULL DEFAULT 1200,
  requires_lab INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS player_techs (
  user_id INTEGER NOT NULL,
  tech_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tech_key)
);

CREATE TABLE IF NOT EXISTS research_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tech_key TEXT NOT NULL,
  target_level INTEGER NOT NULL,
  finish_at INTEGER NOT NULL,
  started_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_zh TEXT NOT NULL,
  body_en TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

CREATE TABLE IF NOT EXISTS scouting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alliances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  leader_id INTEGER NOT NULL,
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alliance_members (
  alliance_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  contribution INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (alliance_id, user_id)
);

CREATE TABLE IF NOT EXISTS vassals (
  user_id INTEGER PRIMARY KEY,
  liege_id INTEGER NOT NULL,
  since INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'world',
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gacha_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pool TEXT NOT NULL,
  results TEXT NOT NULL,
  cost INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_zh TEXT NOT NULL,
  body_en TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quests (
  key TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  desc_zh TEXT NOT NULL,
  desc_en TEXT NOT NULL,
  metric TEXT NOT NULL,
  target INTEGER NOT NULL,
  reward_bright INTEGER NOT NULL DEFAULT 0,
  reward_night INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS counters (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS quest_claims (
  user_id INTEGER NOT NULL,
  quest_key TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, quest_key)
);
