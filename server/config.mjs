import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(__filename), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DATA_DIR = path.join(ROOT, 'data');
export const DB_PATH = process.env.FIRESEED_DB || path.join(DATA_DIR, 'fireseed.db');
export const PORT = Number(process.env.PORT || 8080);
export const HOST = process.env.HOST || '127.0.0.1';
export const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 14) || 14);
export const IS_PROD = process.env.NODE_ENV === 'production';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets', 'generals'), { recursive: true });

export const ELEMENTS = ['lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'];
export const ELEMENT_LABEL = {
  lumen: { zh: '亮晶晶', en: 'Lumen' },
  ember: { zh: '暖洋洋', en: 'Ember' },
  cryo: { zh: '冷冰冰', en: 'Cryo' },
  bloom: { zh: '郁萌萌', en: 'Verdant' },
  radiance: { zh: '昼闪闪', en: 'Radiance' },
  umbra: { zh: '夜静静', en: 'Umbra' },
};
export const RESOURCE_KEYS = ['lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'];
export const SEASONAL_RESOURCES = ['ember', 'cryo', 'bloom', 'radiance'];
export const CURRENCIES = ['lumen', 'umbra'];

export const RARITIES = ['B', 'A', 'S', 'SS', 'P'];
export const RARITY_ORDER = { B: 0, A: 1, S: 2, SS: 3, P: 4 };

export const UNITS = {
  pawn: {
    zh: '兵卒', en: 'Pawn', key: 'pawn', cost: { radiance: 20 }, trainSeconds: 1,
    speed: 2, atk: 1, siege: 1, def: 1, unlock: 'barracks', tier: 1,
    desc_zh: '廉价的通用步兵框架。对锤子兵有额外伤害。',
    desc_en: 'Cheap general-purpose frame. Deals bonus damage to Breaker Rigs.',
  },
  knight: {
    zh: '骑士', en: 'Knight', key: 'knight', cost: { ember: 30 }, trainSeconds: 5,
    speed: 1, atk: 2, siege: 2, def: 2, unlock: 'barracks', tier: 2,
    desc_zh: '高速突击框架，克制兵卒与城墙。',
    desc_en: 'Fast assault frame. Strong against Pawns and Bulwarks.',
  },
  rook: {
    zh: '城壁', en: 'Rook', key: 'rook', cost: { cryo: 30 }, trainSeconds: 5,
    speed: 5, atk: 2, siege: 2, def: 4, unlock: 'barracks', tier: 3,
    desc_zh: '重装守备框架，克制兵卒与主教。',
    desc_en: 'Heavy guard frame. Strong against Pawns and Cantors.',
  },
  bishop: {
    zh: '主教', en: 'Bishop', key: 'bishop', cost: { bloom: 30 }, trainSeconds: 5,
    speed: 3, atk: 4, siege: 2, def: 2, unlock: 'barracks', tier: 4,
    desc_zh: '高输出轰击框架，克制兵卒与骑士。',
    desc_en: 'High-yield bombardment frame. Strong against Pawns and Knights.',
  },
  golem: {
    zh: '锤子兵', en: 'Breaker Rig', key: 'golem', cost: { ember: 40, cryo: 40, bloom: 40, radiance: 40 },
    trainSeconds: 30, speed: 30, atk: 1, siege: 10, def: 1, unlock: 'workshop', tier: 5,
    desc_zh: '专用于破坏城防的攻城框架。只有在守军全灭后才会对耐久造成伤害。',
    desc_en: 'Siege frame built to crack bastion plating. Only damages durability after the garrison falls.',
  },
  scout: {
    zh: '侦察兵', en: 'Wisp Scout', key: 'scout', cost: { ember: 10, cryo: 10, bloom: 10, radiance: 10 },
    trainSeconds: 2, speed: 2, atk: 0, siege: 0, def: 0, unlock: 'watchtower', tier: 6,
    desc_zh: '无战斗力的侦察无人机。数量多于目标守军时可取得详细军情。',
    desc_en: 'Unarmed recon drone. Returns detailed intel when it outnumbers the target garrison.',
  },
};

export const FACILITIES = {
  extractor_lumen: { zh: '亮晶晶采集井', en: 'Lumen Tap', short_zh: '亮晶晶', short_en: 'Lumen', element: 'lumen', max: 10, kind: 'extractor' },
  extractor_ember: { zh: '暖洋洋采集井', en: 'Ember Tap', short_zh: '暖洋洋', short_en: 'Ember', element: 'ember', max: 10, kind: 'extractor' },
  extractor_cryo: { zh: '冷冰冰采集井', en: 'Cryo Tap', short_zh: '冷冰冰', short_en: 'Cryo', element: 'cryo', max: 10, kind: 'extractor' },
  extractor_bloom: { zh: '郁萌萌采集井', en: 'Verdant Tap', short_zh: '郁萌萌', short_en: 'Verdant', element: 'bloom', max: 10, kind: 'extractor' },
  extractor_radiance: { zh: '昼闪闪采集井', en: 'Radiance Tap', short_zh: '昼闪闪', short_en: 'Radiance', element: 'radiance', max: 10, kind: 'extractor' },
  extractor_umbra: { zh: '夜静静采集井', en: 'Umbra Tap', short_zh: '夜静静', short_en: 'Umbra', element: 'umbra', max: 10, kind: 'extractor' },
  governor: { zh: '总督府', en: 'Governor Spire', max: 10, kind: 'governor' },
  barracks: { zh: '兵营', en: 'Frame Foundry', max: 10, kind: 'barracks' },
  lab: { zh: '研究所', en: 'Archive Lab', max: 10, kind: 'lab' },
  dorm: { zh: '宿舍', en: 'Coil Dorm', max: 10, kind: 'dorm' },
  storage: { zh: '贮存所', en: 'Vault', max: 10, kind: 'storage' },
  watchtower: { zh: '瞭望台', en: 'Signal Watch', max: 10, kind: 'watchtower' },
  workshop: { zh: '工程所', en: 'Breaker Works', max: 10, kind: 'workshop' },
};

export const GATEWAYS = [
  { dir: 1, zh: '明京', en: 'Minjing' },
  { dir: 2, zh: '宁海', en: 'Ninghai' },
  { dir: 3, zh: '五岳', en: 'Wuyue' },
  { dir: 4, zh: '陆合', en: 'Luhe' },
  { dir: 5, zh: '米萨瓦', en: 'Misawa' },
  { dir: 6, zh: '卡拉塔', en: 'Kanata' },
  { dir: 7, zh: '约左拉', en: 'Yozora' },
  { dir: 8, zh: '娜奥美', en: 'Naomi' },
  { dir: 9, zh: '明斯特尔', en: 'Minster' },
  { dir: 10, zh: '艾尔利斯', en: 'Elise' },
  { dir: 11, zh: '雷德奈芙', en: 'Redknife' },
  { dir: 12, zh: '开里培拉', en: 'Caeperra' },
];

export const CHARTERS = {
  lumen: { zh: '白噪商会', en: 'White Noise Syndicate', perk: 'Lumen production +6%' },
  ember: { zh: '燧火自治领', en: 'Flint Autonomy', perk: 'Ember production +6%' },
  cryo: { zh: '霜线集团', en: 'Frostline Combine', perk: 'Cryo production +6%' },
  bloom: { zh: '青苔公社', en: 'Moss Commune', perk: 'Verdant production +6%' },
  radiance: { zh: '昼轨卫队', en: 'Dayrail Custodians', perk: 'Radiance production +6%' },
  umbra: { zh: '夜渡局', en: 'Night Ferry Bureau', perk: 'Umbra production +6%' },
};

export const DEFAULT_SETTINGS = {
  map_width: 512,
  map_height: 512,
  server_name_zh: '种火集结号',
  server_name_en: 'Fireseed Engage',
  resource_tick_seconds: 3,
  circuit_hours: 48,
  storage_base: 100000,
  circuit_base_cap: 20,
  subbase_base_cap: 2,
  npc_strength: 0.08,
  registration_open: 1,
  max_players: 50,
  maintenance: 0,
  maintenance_note_zh: '',
  maintenance_note_en: '',
  starting_ember: 2500,
  starting_cryo: 2500,
  starting_bloom: 2500,
  starting_radiance: 2500,
  starting_circuit: 5,
  resource_claim_circuit: 3,
  starting_bright: 1200,
  starting_night: 600,
  season_start_bright: 600,
  season_start_night: 300,
  gacha_general_cost: 300,
  gacha_general_ten_cost: 2700,
  gacha_skill_cost: 200,
  gacha_skill_ten_cost: 1800,
  gacha_pity: 80,
  gacha_rates: '{"B":48,"A":30,"S":15,"SS":6,"P":1}',
  build_speed: 60,
  research_speed: 60,
  training_speed: 20,
  march_speed: 1,
  resource_yield: 1,
  victory_hold_days: 30,
  offline_cap_hours: 12,
  season_rebuild_delay_hours: 48,
  raid_enabled: 0,
};

export const FACILITY_COSTS = {
  barracks: { build: { ember: 500, cryo: 500, bloom: 500, radiance: 500 }, seconds: 3600 },
  lab: { build: { ember: 900, cryo: 900, bloom: 900, radiance: 900 }, seconds: 7200 },
  dorm: { build: { ember: 350, cryo: 350, bloom: 350, radiance: 350 }, seconds: 1800 },
  storage: { build: { ember: 350, cryo: 350, bloom: 350, radiance: 350 }, seconds: 1800 },
  watchtower: { build: { ember: 700, cryo: 700, bloom: 700, radiance: 700 }, seconds: 3600 },
  workshop: { build: { ember: 700, cryo: 700, bloom: 700, radiance: 700 }, seconds: 3600 },
};

export const MAX_LEVEL = 10;
