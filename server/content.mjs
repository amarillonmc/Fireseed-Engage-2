// Static content definitions. Runtime balance is centralised here and in settings.

export const SKILLS = [
  {
    key: 'lumen_surge', name_zh: '亮晶递归', name_en: 'Lumen Recursion', kind: 'passive', element: 'lumen', rare: 'S',
    desc_zh: '被动：本城全部资源产出提高 8%。', desc_en: 'Passive: all resource output in this bastion +8%.',
    effects: [{ type: 'production_pct', scope: 'all', value: 0.08 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'foundry_rhythm', name_zh: '铸炉节拍', name_en: 'Foundry Rhythm', kind: 'passive', element: 'lumen', rare: 'A',
    desc_zh: '被动：本城士兵训练速度提高 10%。', desc_en: 'Passive: troop training speed in this bastion +10%.',
    effects: [{ type: 'train_speed_pct', value: 0.10 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'data_bloom', name_zh: '数据增殖', name_en: 'Data Bloom', kind: 'active', element: 'lumen', rare: 'A',
    desc_zh: '主动：立即获得 600 点暖洋洋、冷冰冰、郁萌萌与昼闪闪。冷却 1 小时。', desc_en: 'Active: instantly gain 600 Ember, Cryo, Verdant and Radiance. Cooldown 1h.',
    effects: [{ type: 'instant_resources', value: 600 }], max_level: 10, base_cooldown: 3600, duration: 0,
  },
  {
    key: 'march_haste', name_zh: '矢量步进', name_en: 'Vector Step', kind: 'passive', element: 'ember', rare: 'A',
    desc_zh: '被动：军队行军速度提高 10%。', desc_en: 'Passive: army march speed +10%.',
    effects: [{ type: 'march_speed_pct', value: 0.10 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'flash_march', name_zh: '闪击行军', name_en: 'Flash March', kind: 'active', element: 'ember', rare: 'S',
    desc_zh: '主动：10 分钟内军队行军速度提高 35%。冷却 2 小时。', desc_en: 'Active: army march speed +35% for 10 minutes. Cooldown 2h.',
    effects: [{ type: 'buff_march', value: 0.35, duration: 600 }], max_level: 10, base_cooldown: 7200, duration: 600,
  },
  {
    key: 'assault_protocol', name_zh: '强袭协议', name_en: 'Assault Protocol', kind: 'passive', element: 'bloom', rare: 'S',
    desc_zh: '被动：本武将及所率军队攻击力提高 10%。', desc_en: 'Passive: this Vanguard and their army gain +10% attack.',
    effects: [{ type: 'attack_pct', value: 0.10 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'combat_surge', name_zh: '过载爆发', name_en: 'Overdrive Surge', kind: 'active', element: 'bloom', rare: 'SS',
    desc_zh: '主动：10 分钟内自身与军队攻击力提高 35%。冷却 2 小时。', desc_en: 'Active: +35% attack for self and army for 10 minutes. Cooldown 2h.',
    effects: [{ type: 'buff_attack', value: 0.35, duration: 600 }], max_level: 10, base_cooldown: 7200, duration: 600,
  },
  {
    key: 'bulwark_protocol', name_zh: '壁垒协议', name_en: 'Bulwark Protocol', kind: 'passive', element: 'cryo', rare: 'S',
    desc_zh: '被动：本武将及所率军队守备力提高 10%。', desc_en: 'Passive: this Vanguard and their army gain +10% defense.',
    effects: [{ type: 'defense_pct', value: 0.10 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'iron_wall', name_zh: '铁幕展开', name_en: 'Iron Veil', kind: 'active', element: 'cryo', rare: 'SS',
    desc_zh: '主动：10 分钟内自身与军队守备力提高 35%。冷却 2 小时。', desc_en: 'Active: +35% defense for self and army for 10 minutes. Cooldown 2h.',
    effects: [{ type: 'buff_defense', value: 0.35, duration: 600 }], max_level: 10, base_cooldown: 7200, duration: 600,
  },
  {
    key: 'repair_cycle', name_zh: '修复循环', name_en: 'Repair Cycle', kind: 'active', element: 'radiance', rare: 'A',
    desc_zh: '主动：恢复自身 30 点 HP。冷却 1 小时。', desc_en: 'Active: restore 30 HP to this Vanguard. Cooldown 1h.',
    effects: [{ type: 'heal_hp', value: 30 }], max_level: 10, base_cooldown: 3600, duration: 0,
  },
  {
    key: 'recon_boost', name_zh: '侦测增幅', name_en: 'Recon Boost', kind: 'passive', element: 'umbra', rare: 'A',
    desc_zh: '被动：侦察能力提高 15%。', desc_en: 'Passive: scouting power +15%.',
    effects: [{ type: 'scout_pct', value: 0.15 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'storage_lattice', name_zh: '贮存晶格', name_en: 'Storage Lattice', kind: 'passive', element: 'lumen', rare: 'A',
    desc_zh: '被动：本城资源贮存上限提高 15%。', desc_en: 'Passive: storage capacity in this bastion +15%.',
    effects: [{ type: 'storage_pct', value: 0.15 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'siege_calibration', name_zh: '攻城校准', name_en: 'Siege Calibration', kind: 'passive', element: 'bloom', rare: 'A',
    desc_zh: '被动：锤子兵对城防的伤害提高 12%。', desc_en: 'Passive: Breaker Rig siege damage +12%.',
    effects: [{ type: 'siege_pct', value: 0.12 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'circuit_whisper', name_zh: '回路低语', name_en: 'Circuit Whisper', kind: 'passive', element: 'umbra', rare: 'S',
    desc_zh: '被动：思考回路产出速度提高 10%。', desc_en: 'Passive: Circuit Point generation +10%.',
    effects: [{ type: 'circuit_rate_pct', value: 0.10 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'build_autonomy', name_zh: '自动建造', name_en: 'Autonomous Build', kind: 'passive', element: 'radiance', rare: 'A',
    desc_zh: '被动：本城设施建造与升级速度提高 12%。', desc_en: 'Passive: construction and upgrade speed in this bastion +12%.',
    effects: [{ type: 'build_speed_pct', value: 0.12 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'research_echo', name_zh: '研究回响', name_en: 'Research Echo', kind: 'passive', element: 'lumen', rare: 'A',
    desc_zh: '被动：科技研究速度提高 12%。', desc_en: 'Passive: research speed +12%.',
    effects: [{ type: 'research_speed_pct', value: 0.12 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'self_repair', name_zh: '自修复', name_en: 'Self-Repair', kind: 'passive', element: 'radiance', rare: 'B',
    desc_zh: '被动：自身 HP 回复速度提高 25%。', desc_en: 'Passive: self HP regeneration +25%.',
    effects: [{ type: 'hp_regen_pct', value: 0.25 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'lumen_edge', name_zh: '亮刃', name_en: 'Lumen Edge', kind: 'passive', element: 'lumen', rare: 'S',
    desc_zh: '被动：攻击力提高 8%，守备力提高 5%。', desc_en: 'Passive: attack +8%, defense +5%.',
    effects: [{ type: 'attack_pct', value: 0.08 }, { type: 'defense_pct', value: 0.05 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'ember_drive', name_zh: '燧火驱动', name_en: 'Ember Drive', kind: 'passive', element: 'ember', rare: 'S',
    desc_zh: '被动：攻击力提高 8%，行军速度提高 5%。', desc_en: 'Passive: attack +8%, march speed +5%.',
    effects: [{ type: 'attack_pct', value: 0.08 }, { type: 'march_speed_pct', value: 0.05 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'cryo_aegis', name_zh: '霜盾', name_en: 'Cryo Aegis', kind: 'passive', element: 'cryo', rare: 'S',
    desc_zh: '被动：守备力提高 12%。', desc_en: 'Passive: defense +12%.',
    effects: [{ type: 'defense_pct', value: 0.12 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'bloom_overclock', name_zh: '青苔超频', name_en: 'Verdant Overclock', kind: 'passive', element: 'bloom', rare: 'SS',
    desc_zh: '被动：郁萌萌产出提高 12%，训练速度提高 5%。', desc_en: 'Passive: Verdant output +12%, training speed +5%.',
    effects: [{ type: 'production_pct', scope: 'bloom', value: 0.12 }, { type: 'train_speed_pct', value: 0.05 }], max_level: 10, base_cooldown: 0, duration: 0,
  },
  {
    key: 'radiance_burst', name_zh: '昼闪爆发', name_en: 'Radiance Burst', kind: 'active', element: 'radiance', rare: 'SS',
    desc_zh: '主动：立即获得 400 点四色资源，并在 5 分钟内提高 15% 攻击力。冷却 90 分钟。', desc_en: 'Active: gain 400 of each seasonal resource and +15% attack for 5 minutes. Cooldown 90m.',
    effects: [{ type: 'instant_resources', value: 400 }, { type: 'buff_attack', value: 0.15, duration: 300 }], max_level: 10, base_cooldown: 5400, duration: 300,
  },
  {
    key: 'umbra_veil', name_zh: '夜隐', name_en: 'Umbra Veil', kind: 'active', element: 'umbra', rare: 'SS',
    desc_zh: '主动：10 分钟内守备力提高 20%，侦察能力提高 20%。冷却 2 小时。', desc_en: 'Active: defense +20%, scouting +20% for 10 minutes. Cooldown 2h.',
    effects: [{ type: 'buff_defense', value: 0.20, duration: 600 }, { type: 'buff_scout', value: 0.20, duration: 600 }], max_level: 10, base_cooldown: 7200, duration: 600,
  },
  {
    key: 'silver_pulse', name_zh: '银白脉冲', name_en: 'Silver Pulse', kind: 'active', element: 'lumen', rare: 'P',
    desc_zh: '主动：立即获得 1 点思考回路。冷却 24 小时。', desc_en: 'Active: instantly gain 1 Circuit Point. Cooldown 24h.',
    effects: [{ type: 'instant_circuit', value: 1 }], max_level: 10, base_cooldown: 86400, duration: 0,
  },
];

export const TECHS = [
  { key: 'tap_ember', name_zh: '暖流开采', name_en: 'Ember Extraction', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'production_ember', effect_value: 0.06, effect_growth: 0.5, base_cost: { ember: 300, cryo: 300, bloom: 300, radiance: 300 }, cost_growth: 0.8, base_seconds: 1800, requires_lab: 1, sort: 10, desc_zh: '提高暖洋洋的产出效率。', desc_en: 'Improves Ember output.' },
  { key: 'tap_cryo', name_zh: '冷媒抽取', name_en: 'Cryo Extraction', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'production_cryo', effect_value: 0.06, effect_growth: 0.5, base_cost: { ember: 300, cryo: 300, bloom: 300, radiance: 300 }, cost_growth: 0.8, base_seconds: 1800, requires_lab: 1, sort: 11, desc_zh: '提高冷冰冰的产出效率。', desc_en: 'Improves Cryo output.' },
  { key: 'tap_bloom', name_zh: '苔层培育', name_en: 'Verdant Cultivation', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'production_bloom', effect_value: 0.06, effect_growth: 0.5, base_cost: { ember: 300, cryo: 300, bloom: 300, radiance: 300 }, cost_growth: 0.8, base_seconds: 1800, requires_lab: 1, sort: 12, desc_zh: '提高郁萌萌的产出效率。', desc_en: 'Improves Verdant output.' },
  { key: 'tap_radiance', name_zh: '昼轨聚光', name_en: 'Radiance Harvest', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'production_radiance', effect_value: 0.06, effect_growth: 0.5, base_cost: { ember: 300, cryo: 300, bloom: 300, radiance: 300 }, cost_growth: 0.8, base_seconds: 1800, requires_lab: 1, sort: 13, desc_zh: '提高昼闪闪的产出效率。', desc_en: 'Improves Radiance output.' },
  { key: 'tap_lumen', name_zh: '白噪提纯', name_en: 'Lumen Refinement', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'production_lumen', effect_value: 0.05, effect_growth: 0.5, base_cost: { ember: 450, cryo: 450, bloom: 450, radiance: 450 }, cost_growth: 0.8, base_seconds: 2400, requires_lab: 2, sort: 14, desc_zh: '提高亮晶晶的产出效率。', desc_en: 'Improves Lumen output.' },
  { key: 'tap_umbra', name_zh: '夜幕回响', name_en: 'Umbra Resonance', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'production_umbra', effect_value: 0.05, effect_growth: 0.5, base_cost: { ember: 450, cryo: 450, bloom: 450, radiance: 450 }, cost_growth: 0.8, base_seconds: 2400, requires_lab: 2, sort: 15, desc_zh: '提高夜静静的产出效率。', desc_en: 'Improves Umbra output.' },
  { key: 'vault_lattice', name_zh: '贮存晶格化', name_en: 'Vault Lattice', scope: 'seasonal', category: 'resource', max_level: 10, effect_key: 'storage_pct', effect_value: 0.08, effect_growth: 0.5, base_cost: { ember: 500, cryo: 500, bloom: 500, radiance: 500 }, cost_growth: 0.8, base_seconds: 2400, requires_lab: 2, sort: 20, desc_zh: '提高四色资源贮存上限。', desc_en: 'Improves seasonal storage capacity.' },
  { key: 'foundry_clock', name_zh: '铸炉时钟', name_en: 'Foundry Clock', scope: 'seasonal', category: 'military', max_level: 10, effect_key: 'train_speed_pct', effect_value: 0.05, effect_growth: 0.5, base_cost: { ember: 600, cryo: 600, bloom: 600, radiance: 600 }, cost_growth: 0.8, base_seconds: 2400, requires_lab: 2, sort: 30, desc_zh: '提高士兵训练速度。', desc_en: 'Improves troop training speed.' },
  { key: 'combat_uplink', name_zh: '战斗上行链', name_en: 'Combat Uplink', scope: 'seasonal', category: 'military', max_level: 10, effect_key: 'attack_pct', effect_value: 0.04, effect_growth: 0.5, base_cost: { ember: 700, cryo: 700, bloom: 700, radiance: 700 }, cost_growth: 0.8, base_seconds: 3000, requires_lab: 3, sort: 31, desc_zh: '提高全部军队攻击力。', desc_en: 'Improves all army attack.' },
  { key: 'aegis_uplink', name_zh: '壁垒上行链', name_en: 'Aegis Uplink', scope: 'seasonal', category: 'military', max_level: 10, effect_key: 'defense_pct', effect_value: 0.04, effect_growth: 0.5, base_cost: { ember: 700, cryo: 700, bloom: 700, radiance: 700 }, cost_growth: 0.8, base_seconds: 3000, requires_lab: 3, sort: 32, desc_zh: '提高全部军队守备力。', desc_en: 'Improves all army defense.' },
  { key: 'siege_servo', name_zh: '攻城伺服', name_en: 'Siege Servo', scope: 'seasonal', category: 'military', max_level: 10, effect_key: 'siege_pct', effect_value: 0.06, effect_growth: 0.5, base_cost: { ember: 800, cryo: 800, bloom: 800, radiance: 800 }, cost_growth: 0.8, base_seconds: 3600, requires_lab: 3, sort: 33, desc_zh: '提高锤子兵对城防的伤害。', desc_en: 'Improves Breaker Rig siege damage.' },
  { key: 'circuit_router', name_zh: '回路路由', name_en: 'Circuit Routing', scope: 'seasonal', category: 'command', max_level: 5, effect_key: 'circuit_rate_pct', effect_value: 0.05, effect_growth: 0.4, base_cost: { ember: 900, cryo: 900, bloom: 900, radiance: 900 }, cost_growth: 0.9, base_seconds: 3600, requires_lab: 3, sort: 40, desc_zh: '提高思考回路产出速度。', desc_en: 'Improves Circuit Point generation.' },
  { key: 'march_router', name_zh: '行军路由', name_en: 'March Routing', scope: 'seasonal', category: 'command', max_level: 5, effect_key: 'march_speed_pct', effect_value: 0.04, effect_growth: 0.4, base_cost: { ember: 800, cryo: 800, bloom: 800, radiance: 800 }, cost_growth: 0.9, base_seconds: 3000, requires_lab: 2, sort: 41, desc_zh: '提高军队行军速度。', desc_en: 'Improves army march speed.' },
  { key: 'build_clock', name_zh: '建造时钟', name_en: 'Build Clock', scope: 'seasonal', category: 'civic', max_level: 10, effect_key: 'build_speed_pct', effect_value: 0.05, effect_growth: 0.5, base_cost: { ember: 500, cryo: 500, bloom: 500, radiance: 500 }, cost_growth: 0.8, base_seconds: 2400, requires_lab: 2, sort: 50, desc_zh: '提高设施建造与升级速度。', desc_en: 'Improves construction speed.' },
  { key: 'research_clock', name_zh: '研究时钟', name_en: 'Research Clock', scope: 'seasonal', category: 'civic', max_level: 10, effect_key: 'research_speed_pct', effect_value: 0.05, effect_growth: 0.5, base_cost: { ember: 500, cryo: 500, bloom: 500, radiance: 500 }, cost_growth: 0.8, base_seconds: 2400, requires_lab: 2, sort: 51, desc_zh: '提高科技研究速度。', desc_en: 'Improves research speed.' },
  { key: 'cost_cap', name_zh: '编成上限扩展', name_en: 'Formation Cost Cap', scope: 'permanent', category: 'command', max_level: 4, effect_key: 'general_cost_cap', effect_value: 0.5, effect_growth: 0.0, base_cost: { lumen: 400, umbra: 250 }, cost_growth: 1.0, base_seconds: 600, requires_lab: 3, sort: 60, desc_zh: '永久提高可编成武将的 COST 上限 0.5。', desc_en: 'Permanently raises Vanguard COST capacity by 0.5.' },
  { key: 'circuit_cap', name_zh: '回路上限扩展', name_en: 'Circuit Capacity', scope: 'permanent', category: 'command', max_level: 4, effect_key: 'circuit_cap', effect_value: 5, effect_growth: 0.0, base_cost: { lumen: 350, umbra: 350 }, cost_growth: 1.0, base_seconds: 600, requires_lab: 3, sort: 61, desc_zh: '永久提高思考回路上限 5 点。', desc_en: 'Permanently raises Circuit capacity by 5.' },
  { key: 'subbase_cap', name_zh: '分基地配额', name_en: 'Sub-Base Quota', scope: 'permanent', category: 'command', max_level: 3, effect_key: 'subbase_cap', effect_value: 1, effect_growth: 0.0, base_cost: { lumen: 500, umbra: 300 }, cost_growth: 1.1, base_seconds: 600, requires_lab: 4, sort: 62, desc_zh: '永久提高分基地上限 1 座。', desc_en: 'Permanently raises the sub-base cap by 1.' },
  { key: 'permanent_yield', name_zh: '永久采收协议', name_en: 'Perpetual Harvest', scope: 'permanent', category: 'resource', max_level: 5, effect_key: 'production_all_pct', effect_value: 0.03, effect_growth: 0.5, base_cost: { lumen: 300, umbra: 150 }, cost_growth: 0.9, base_seconds: 600, requires_lab: 2, sort: 63, desc_zh: '永久提高全部资源产出。', desc_en: 'Permanently improves all resource output.' },
  { key: 'permanent_storage', name_zh: '永久贮存协议', name_en: 'Perpetual Vault', scope: 'permanent', category: 'resource', max_level: 5, effect_key: 'storage_pct', effect_value: 0.10, effect_growth: 0.5, base_cost: { lumen: 300, umbra: 150 }, cost_growth: 0.9, base_seconds: 600, requires_lab: 2, sort: 64, desc_zh: '永久提高资源贮存上限。', desc_en: 'Permanently improves storage capacity.' },
  { key: 'gacha_echo', name_zh: '召唤回响', name_en: 'Summon Echo', scope: 'permanent', category: 'command', max_level: 5, effect_key: 'gacha_discount_pct', effect_value: 0.03, effect_growth: 0.4, base_cost: { lumen: 450, umbra: 200 }, cost_growth: 1.0, base_seconds: 600, requires_lab: 3, sort: 65, desc_zh: '永久降低武将召唤消耗。', desc_en: 'Permanently reduces Vanguard summon cost.' },
  { key: 'offline_core', name_zh: '离线下沉核心', name_en: 'Offline Sink Core', scope: 'permanent', category: 'resource', max_level: 3, effect_key: 'offline_cap_hours', effect_value: 4, effect_growth: 0.0, base_cost: { lumen: 400, umbra: 250 }, cost_growth: 1.0, base_seconds: 600, requires_lab: 3, sort: 66, desc_zh: '永久提高离线产出结算上限 4 小时。', desc_en: 'Permanently raises offline accrual cap by 4 hours.' },
];

export const QUESTS = [
  { key: 'q_build', name_zh: '第一块地基', name_en: 'First Foundation', desc_zh: '建造 1 座设施。', desc_en: 'Construct 1 facility.', metric: 'build', target: 1, reward_bright: 200, reward_night: 0, sort: 10 },
  { key: 'q_train', name_zh: '铸炉点火', name_en: 'Light the Foundry', desc_zh: '训练 20 名士兵。', desc_en: 'Train 20 troops.', metric: 'train', target: 20, reward_bright: 120, reward_night: 60, sort: 20 },
  { key: 'q_claim', name_zh: '向外延伸', name_en: 'Reach Outward', desc_zh: '占领 3 块领地。', desc_en: 'Claim 3 territories.', metric: 'claim', target: 3, reward_bright: 150, reward_night: 0, sort: 30 },
  { key: 'q_draw', name_zh: '第一次共鸣', name_en: 'First Resonance', desc_zh: '召唤 1 名武将。', desc_en: 'Summon 1 Vanguard.', metric: 'draw', target: 1, reward_bright: 100, reward_night: 30, sort: 40 },
  { key: 'q_research', name_zh: '档案考古', name_en: 'Archive Archaeology', desc_zh: '完成 1 项科技研究。', desc_en: 'Complete 1 research project.', metric: 'research', target: 1, reward_bright: 150, reward_night: 100, sort: 50 },
  { key: 'q_battle', name_zh: '首次交锋', name_en: 'First Contact', desc_zh: '赢得 1 场战斗。', desc_en: 'Win 1 battle.', metric: 'battle_win', target: 1, reward_bright: 180, reward_night: 90, sort: 60 },
  { key: 'q_fort', name_zh: '拆解前哨', name_en: 'Unbolt the Outpost', desc_zh: '占领 1 座 NPC 城池。', desc_en: 'Capture 1 NPC fort.', metric: 'fort_capture', target: 1, reward_bright: 400, reward_night: 200, sort: 70 },
  { key: 'q_level', name_zh: '成长曲线', name_en: 'Growth Curve', desc_zh: '将任意武将提升至 Lv.5。', desc_en: 'Raise any Vanguard to Lv.5.', metric: 'general_level5', target: 1, reward_bright: 200, reward_night: 100, sort: 80 },
  { key: 'q_alliance', name_zh: '找到同类', name_en: 'Find Your Kind', desc_zh: '加入或创建 1 个同盟。', desc_en: 'Join or create 1 syndicate.', metric: 'alliance_join', target: 1, reward_bright: 100, reward_night: 50, sort: 90 },
  { key: 'q_gateway', name_zh: '叩响十二门', name_en: 'Knock the Twelve Gates', desc_zh: '占领 1 座十二门主城。', desc_en: 'Capture 1 of the Twelve Gateways.', metric: 'gateway_capture', target: 1, reward_bright: 800, reward_night: 400, sort: 100 },
];

export const SHOP_ITEMS = [
  { id: 'crate_ember', name_zh: '暖流补给箱', name_en: 'Ember Supply Crate', desc_zh: '获得 1,500 暖洋洋。', desc_en: 'Gain 1,500 Ember.', price: { lumen: 20 }, grant: { ember: 1500 } },
  { id: 'crate_cryo', name_zh: '冷媒补给箱', name_en: 'Cryo Supply Crate', desc_zh: '获得 1,500 冷冰冰。', desc_en: 'Gain 1,500 Cryo.', price: { lumen: 20 }, grant: { cryo: 1500 } },
  { id: 'crate_bloom', name_zh: '苔层补给箱', name_en: 'Verdant Supply Crate', desc_zh: '获得 1,500 郁萌萌。', desc_en: 'Gain 1,500 Verdant.', price: { lumen: 20 }, grant: { bloom: 1500 } },
  { id: 'crate_radiance', name_zh: '昼轨补给箱', name_en: 'Radiance Supply Crate', desc_zh: '获得 1,500 昼闪闪。', desc_en: 'Gain 1,500 Radiance.', price: { lumen: 20 }, grant: { radiance: 1500 } },
  { id: 'crate_mixed', name_zh: '四色联合补给', name_en: 'Quad-Chromatic Cache', desc_zh: '获得四色资源各 800。', desc_en: 'Gain 800 of each seasonal resource.', price: { lumen: 28 }, grant: { ember: 800, cryo: 800, bloom: 800, radiance: 800 } },
  { id: 'circuit_cell', name_zh: '思考回路电池', name_en: 'Circuit Cell', desc_zh: '获得 1 点思考回路（不超过上限）。', desc_en: 'Gain 1 Circuit Point (up to cap).', price: { umbra: 40 }, grant: { circuit: 1 } },
  { id: 'chrono_tape', name_zh: '计时胶带', name_en: 'Chrono Tape', desc_zh: '获得 1 卷计时胶带，可在建造或研究时立即完成。', desc_en: 'Gain 1 Chrono Tape to instantly finish a construction or research.', price: { lumen: 15 }, grant: { tapes: 1 } },
  { id: 'night_cache', name_zh: '夜色黑匣', name_en: 'Night Black Box', desc_zh: '获得 120 夜静静。', desc_en: 'Gain 120 Umbra Shards.', price: { lumen: 60 }, grant: { umbra: 120 } },
  { id: 'lumen_cache', name_zh: '白噪黑匣', name_en: 'White-Noise Black Box', desc_zh: '获得 180 亮晶晶。', desc_en: 'Gain 180 Lumen Shards.', price: { umbra: 80 }, grant: { lumen: 180 } },
];

export const FACILITY_LABEL = {
  governor: { zh: '总督府', en: 'Governor Spire' },
  barracks: { zh: '兵营', en: 'Frame Foundry' },
  lab: { zh: '研究所', en: 'Archive Lab' },
  dorm: { zh: '宿舍', en: 'Coil Dorm' },
  storage: { zh: '贮存所', en: 'Vault' },
  watchtower: { zh: '瞭望台', en: 'Signal Watch' },
  workshop: { zh: '工程所', en: 'Breaker Works' },
};
