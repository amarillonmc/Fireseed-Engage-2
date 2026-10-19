// Vanguard roster. Jewel Savior FREE characters are used under the Jewel Savior FREE
// royalty-free terms; ProjectK characters are re-illustrated as original fan art.

const PROFILE = {
  lumen: { atk: 0.55, def: 1.15, spd: 0.75, int: 1.25 },
  ember: { atk: 1.30, def: 0.55, spd: 1.15, int: 0.80 },
  cryo: { atk: 0.80, def: 1.35, spd: 0.55, int: 0.90 },
  bloom: { atk: 1.30, def: 0.55, spd: 1.10, int: 0.85 },
  radiance: { atk: 0.55, def: 0.80, spd: 1.15, int: 1.30 },
  umbra: { atk: 0.55, def: 1.10, spd: 0.80, int: 1.30 },
};
const BUDGET = { B: 130, A: 180, S: 240, SS: 300, P: 370 };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function statsFor(key, rarity, cost, element) {
  const p = PROFILE[element];
  const sum = p.atk + p.def + p.spd + p.int;
  const variance = 0.94 + hash(key) * 0.12;
  const budget = BUDGET[rarity] * (0.75 + cost * 0.10) * variance;
  const raw = {
    atk: budget * 0.30 * (p.atk / sum) * 4,
    def: budget * 0.30 * (p.def / sum) * 4,
    spd: budget * 0.18 * (p.spd / sum) * 4,
    int: budget * 0.22 * (p.int / sum) * 4,
  };
  const clamp = (n) => Math.max(10, Math.min(160, Math.round(n)));
  return {
    base_hp: 100,
    base_atk: clamp(raw.atk),
    base_def: clamp(raw.def),
    base_spd: clamp(raw.spd),
    base_int: clamp(raw.int),
  };
}

const jewel = [
  {
    key: 'js_189', card: 189, image: 'f124', name_zh: '黑伏 曜子', name_en: 'Yoko Kurobushi',
    title_zh: '暗刃', title_en: 'Umbral Reaper', rarity: 'P', cost: 4.0, element: 'umbra', skill: 'silver_pulse',
    lore_zh: '她把整座废弃监控塔改造成一把刀。没有人知道她刻在塔壁上的名字属于谁。',
    lore_en: 'She rebuilt a dead surveillance tower into a blade. No one knows whose names she carved into its walls.',
  },
  {
    key: 'js_240', card: 240, image: 'f364', name_zh: '虹逆 世界', name_en: 'Sekai Nijisaka',
    title_zh: '狂澜', title_en: 'Frenzy Tide', rarity: 'P', cost: 4.0, element: 'ember', skill: 'combat_surge',
    lore_zh: '她的机体每次过载都会改变颜色。她管这叫“心情”，工程部管这叫“灾难”。',
    lore_en: 'Her chassis changes colour with every overload. She calls it a mood; Engineering calls it a disaster.',
  },
  {
    key: 'js_275', card: 275, image: 'f068', name_zh: '莉希娅·科波拉', name_en: 'Lithia Coppola',
    title_zh: '雷拳', title_en: 'Thunderfist', rarity: 'P', cost: 4.0, element: 'lumen', skill: 'lumen_surge',
    lore_zh: '白噪商会最后的公证人。她出拳之前会先念完一整页合同。',
    lore_en: 'The White Noise Syndicate’s last notary. She reads an entire contract before throwing a punch.',
  },
  {
    key: 'js_256', card: 256, image: 'f335', name_zh: '国代 伊依', name_en: 'Iyori Kunishiro',
    title_zh: '苍穹', title_en: 'Open Sky', rarity: 'P', cost: 4.0, element: 'cryo', skill: 'iron_wall',
    lore_zh: '她负责把沉没城市的天空重新投影出来。人们说那天空太蓝了，蓝得像谎言。',
    lore_en: 'She reprojects the skies of drowned cities. People say the blue is too pure — like a beautiful lie.',
  },
  {
    key: 'js_200', card: 200, image: 'f228', name_zh: '朱莲 J. 门上', name_en: 'Shuren J. Kadokami',
    title_zh: '莲弹', title_en: 'Lotus Ballistics', rarity: 'SS', cost: 3.5, element: 'ember', skill: 'assault_protocol',
    lore_zh: '她的弹壳会在落地时开花。捡到花瓣的人最好立刻离开那条街。',
    lore_en: 'Her spent casings bloom on impact. Anyone who picks a petal should leave the street immediately.',
  },
  {
    key: 'js_205', card: 205, image: 'f090', name_zh: '御伽 美夜子', name_en: 'Miyako Otogi',
    title_zh: '羽化', title_en: 'Emergence', rarity: 'SS', cost: 3.5, element: 'umbra', skill: 'umbra_veil',
    lore_zh: '她声称自己是从一段被删掉的睡前故事里长出来的。档案部无法证明她在说谎。',
    lore_en: 'She claims she grew out of a deleted bedtime story. The Archive cannot prove she is lying.',
  },
  {
    key: 'js_308', card: 308, image: 'f214', name_zh: '帕拉贝伦修女', name_en: 'Sister Parabellum',
    title_zh: '战华', title_en: 'War Blossom', rarity: 'SS', cost: 3.5, element: 'radiance', skill: 'radiance_burst',
    lore_zh: '她为每一发子弹做临终祷告。子弹通常比她更有耐心。',
    lore_en: 'She gives last rites to every bullet. The bullets are usually more patient than she is.',
  },
  {
    key: 'js_223', card: 223, image: 'f134', name_zh: '顶 晴花', name_en: 'Haruka Itadaki',
    title_zh: '顶点', title_en: 'Apex', rarity: 'SS', cost: 3.5, element: 'bloom', skill: 'bloom_overclock',
    lore_zh: '她在温室废墟里种出了第一株会发光的苔。整座城的电路都开始朝它生长。',
    lore_en: 'She grew the first glowing moss in a ruined greenhouse. The city’s circuits began growing toward it.',
  },
  {
    key: 'js_316', card: 316, image: 'f370', name_zh: '雪目 苏库里', name_en: 'Sukuri Yukime',
    title_zh: '冻刃', title_en: 'Frost Edge', rarity: 'SS', cost: 3.5, element: 'cryo', skill: 'cryo_aegis',
    lore_zh: '她的刀锋温度低于数据海的凝点。被她切断的线路会先结霜，再忘记自己曾经通电。',
    lore_en: 'Her edge runs colder than the Data Sea’s freezing point. Cut circuits frost over, then forget they were ever live.',
  },
  {
    key: 'js_387', card: 387, image: 'f122', name_zh: '弓月 玲那', name_en: 'Rena Yuzuki',
    title_zh: '夜冕', title_en: 'Night Regent', rarity: 'SS', cost: 3.5, element: 'radiance', skill: 'flash_march',
    lore_zh: '十二门之间的夜航都由她调度。她从不睡觉，也从不承认自己需要 sleep 这个词。',
    lore_en: 'She routes every night flight between the Twelve Gateways. She never sleeps, and refuses to acknowledge the word.',
  },
  {
    key: 'js_274', card: 274, image: 'f067', name_zh: '莉希娅·科波拉（回声）', name_en: 'Lithia Coppola (Echo)',
    title_zh: '雷拳·回声', title_en: 'Thunderfist Echo', rarity: 'S', cost: 3.0, element: 'lumen', skill: 'lumen_edge',
    lore_zh: '一段没能通过公证的备份人格。她坚持自己才是原件，而原件欠她一笔违约金。',
    lore_en: 'A backup persona that failed certification. She insists she is the original — and that the original owes her damages.',
  },
  {
    key: 'js_292', card: 292, image: 'f125', name_zh: '帆村 明', name_en: 'Akari Homura',
    title_zh: '掠海者', title_en: 'Sea Reaver', rarity: 'S', cost: 3.0, element: 'cryo', skill: 'march_haste',
    lore_zh: '她把数据海上的废弃浮标串成舰队。每艘船上都挂着一盏不属于任何港口的灯。',
    lore_en: 'She lashed abandoned data-sea buoys into a fleet. Every hull carries a lamp belonging to no port.',
  },
  {
    key: 'js_294', card: 294, image: 'f101', name_zh: '樱珠 真鱼', name_en: 'Mana Sakuraju',
    title_zh: '渊姬', title_en: 'Abyss Princess', rarity: 'S', cost: 3.0, element: 'lumen', skill: 'storage_lattice',
    lore_zh: '她住在最深的一层缓存里，用沉船里的记忆喂养一群透明的鱼。',
    lore_en: 'She lives in the deepest cache layer, feeding a school of transparent fish on memories salvaged from wrecks.',
  },
  {
    key: 'js_307', card: 307, image: 'f213', name_zh: '帕拉贝伦修女（回声）', name_en: 'Sister Parabellum (Echo)',
    title_zh: '战华·回声', title_en: 'War Blossom Echo', rarity: 'S', cost: 3.0, element: 'radiance', skill: 'foundry_rhythm',
    lore_zh: '一段被留在旧礼拜堂里的告解记录。她仍然每天为不存在的信徒敲钟。',
    lore_en: 'A confession log left in an abandoned chapel. She still rings the bell for congregants who are no longer there.',
  },
  {
    key: 'js_341', card: 341, image: 'f211', name_zh: '樱 结衣', name_en: 'Yui Sakura',
    title_zh: '天顶', title_en: 'Zenith', rarity: 'S', cost: 3.0, element: 'bloom', skill: 'build_autonomy',
    lore_zh: '她能在十二小时内把一片废墟变成可以居住的街区。代价是她会忘记自己住在哪里。',
    lore_en: 'She can turn a ruin into a livable block in twelve hours. The cost is forgetting where she lives.',
  },
  {
    key: 'js_132', card: 132, image: 'f128', name_zh: '石神 珠子', name_en: 'Tamako Ishigami',
    title_zh: '石神', title_en: 'Stonewright', rarity: 'S', cost: 3.0, element: 'bloom', skill: 'siege_calibration',
    lore_zh: '她相信每一堵墙都有灵魂，因此拆墙之前总会先道歉。',
    lore_en: 'She believes every wall has a soul, so she apologises before demolishing one.',
  },
  {
    key: 'js_401', card: 401, image: 'f242', name_zh: '结发 日向', name_en: 'Hinata Yuigami',
    title_zh: '织结', title_en: 'Knotweaver', rarity: 'S', cost: 3.0, element: 'bloom', skill: 'research_echo',
    lore_zh: '她用光纤编发，也在光纤里藏地图。你永远不知道她哪一根头发通向哪里。',
    lore_en: 'She braids fibre optics and hides maps inside them. You never know where a strand will lead.',
  },
  {
    key: 'js_394', card: 394, image: 'f245', name_zh: '鸟谷 茜', name_en: 'Akane Toriya',
    title_zh: '凤凰', title_en: 'Phoenix', rarity: 'S', cost: 3.0, element: 'ember', skill: 'ember_drive',
    lore_zh: '她的座机每隔一段时间就会自燃，然后从灰里长出一架新的。她管这叫“例行保养”。',
    lore_en: 'Her craft spontaneously combusts every so often, then grows a new one from the ash. She calls it routine maintenance.',
  },
  {
    key: 'js_140', card: 140, image: 'f178', name_zh: '抚月 怜', name_en: 'Ren Nagetsu',
    title_zh: '阴翳', title_en: 'Umbra', rarity: 'A', cost: 2.5, element: 'umbra', skill: 'recon_boost',
    lore_zh: '她替人删除记忆，也替人保管那些删不掉的部分。收费按克计算。',
    lore_en: 'She deletes memories for a fee, and keeps the parts that refuse deletion. She charges by the gram.',
  },
  {
    key: 'js_151', card: 151, image: 'f078', name_zh: '姬乃 蜜柑', name_en: 'Mikan Himeno',
    title_zh: '蜜柑', title_en: 'Mikan', rarity: 'A', cost: 2.5, element: 'ember', skill: 'repair_cycle',
    lore_zh: '她开着一辆改装的移动诊所，车头挂着一颗永远不会腐烂的橘子。',
    lore_en: 'She drives a converted mobile clinic with a never-rotting orange tied to its hood.',
  },
  {
    key: 'js_192', card: 192, image: 'f150', name_zh: '夏野 向日葵', name_en: 'Himawari Natsuno',
    title_zh: '夏野', title_en: 'Sunfield', rarity: 'A', cost: 2.5, element: 'radiance', skill: 'self_repair',
    lore_zh: '她收集旧世界的太阳能板，把它们拼成一片会跟着人转动的花田。',
    lore_en: 'She collects old-world solar panels and assembles them into a field that turns to follow people.',
  },
  {
    key: 'js_202', card: 202, image: 'f303', name_zh: '无色衣 诗音', name_en: 'Shion Mujikii',
    title_zh: '无色衣', title_en: 'Colourless', rarity: 'A', cost: 2.5, element: 'bloom', skill: 'data_bloom',
    lore_zh: '她穿的衣服不会反射任何颜色。有人说她本人也是某种尚未被命名的颜色。',
    lore_en: 'Her clothes reflect no colour. Some say she herself is a colour that has not been named yet.',
  },
  {
    key: 'js_326', card: 326, image: 'f004', name_zh: '司马 萌香', name_en: 'Momoka Shiba',
    title_zh: '萌香', title_en: 'Momoka', rarity: 'A', cost: 2.5, element: 'ember', skill: 'lumen_surge',
    lore_zh: '她曾是偶像组合的替补，现在负责在战场上播放足以震碎混凝土的低音。',
    lore_en: 'Once an idol understudy, she now deploys basslines capable of cracking concrete.',
  },
  {
    key: 'js_287', card: 287, image: 'f086', name_zh: '水代 香莲', name_en: 'Karen Mizushiro',
    title_zh: '水际', title_en: 'Hydro', rarity: 'A', cost: 2.5, element: 'cryo', skill: 'bulwark_protocol',
    lore_zh: '她负责维护数据海的冷却管道。假期对她来说，只是换一条管道继续工作。',
    lore_en: 'She maintains the Data Sea’s coolant lines. A holiday, to her, means working on a different pipe.',
  },
  {
    key: 'kf_2', card: '2', image: '2', name_zh: '薮猫', name_en: 'Serval',
    title_zh: '静电潜行者', title_en: 'Static Prowler', rarity: 'SS', cost: 3.5, element: 'ember', skill: 'assault_protocol',
    lore_zh: '她把废弃霓虹管当作尾巴上的装饰。开战前会先问对方要不要一起听歌。',
    lore_en: 'She decorates her tail with dead neon tubes. Before a fight she asks whether you want to listen to music first.',
  },
  {
    key: 'kf_53', card: '53', image: '53', name_zh: '鲸头鹳', name_en: 'Shoebill',
    title_zh: '静默铳鹤', title_en: 'Silent Fusilier', rarity: 'SS', cost: 3.5, element: 'cryo', skill: 'iron_wall',
    lore_zh: '她可以保持同一个姿势静止十四个小时。敌方无人机通常会先忍不住。',
    lore_en: 'She can hold a firing stance for fourteen hours. Enemy drones usually break first.',
  },
  {
    key: 'kf_3', card: '3', image: '3', name_zh: '耳廓狐', name_en: 'Fennec',
    title_zh: '沙频哨兵', title_en: 'Dune Signal', rarity: 'S', cost: 2.5, element: 'radiance', skill: 'recon_boost',
    lore_zh: '她的耳朵能接收到三公里外一台老旧路由器的求救信号。',
    lore_en: 'Her ears can pick up the distress signal of a dying router three kilometres away.',
  },
  {
    key: 'kf_7', card: '7', image: '7', name_zh: '美洲豹', name_en: 'Jaguar',
    title_zh: '霓虹猎豹', title_en: 'Neon Prowler', rarity: 'S', cost: 3.0, element: 'bloom', skill: 'siege_calibration',
    lore_zh: '她喜欢在夜间狩猎，因为旧城的霓虹会把她的斑点映成电路图。',
    lore_en: 'She hunts at night, when old-city neon turns her spots into circuit diagrams.',
  },
  {
    key: 'kf_9', card: '9', image: '9', name_zh: '狮子', name_en: 'Lion',
    title_zh: '黄金鬃冠', title_en: 'Gilded Mane', rarity: 'S', cost: 3.0, element: 'ember', skill: 'ember_drive',
    lore_zh: '她领导着一支由废弃广告牌组成的仪仗队。她的鬃毛上永远闪着金箔般的噪声。',
    lore_en: 'She commands a honour guard assembled from dead billboards. Her mane always glitters with gold-leaf static.',
  },
  {
    key: 'kf_14', card: '14', image: '14', name_zh: '银狐', name_en: 'Silver Fox',
    title_zh: '银霜信使', title_en: 'Silver Courier', rarity: 'S', cost: 2.5, element: 'lumen', skill: 'lumen_edge',
    lore_zh: '她运送的是那些无法被压缩、也无法被删除的口信。',
    lore_en: 'She carries messages that cannot be compressed, and refuse to be deleted.',
  },
  {
    key: 'kf_25', card: '25', image: '25', name_zh: '帝企鹅', name_en: 'Emperor Penguin',
    title_zh: '帝国群落', title_en: 'Imperial Colony', rarity: 'A', cost: 2.5, element: 'cryo', skill: 'bulwark_protocol',
    lore_zh: '她管理着一座移动冷却塔，塔里住着三百只吵闹的机械幼崽。',
    lore_en: 'She runs a mobile coolant tower housing three hundred noisy mechanical chicks.',
  },
  {
    key: 'kf_8', card: '8', image: '8', name_zh: '苏利羊驼', name_en: 'Alpaca Suri',
    title_zh: '绒线术士', title_en: 'Fleece Weaver', rarity: 'A', cost: 2.0, element: 'lumen', skill: 'storage_lattice',
    lore_zh: '她把数据编成毛线，再把毛线织成防火墙。摸起来比看起来更危险。',
    lore_en: 'She spins data into yarn, then knits the yarn into firewalls. Softer to the touch than it looks — and far more dangerous.',
  },
  {
    key: 'kf_4', card: '4', image: '4', name_zh: '浣熊', name_en: 'Common Raccoon',
    title_zh: '废料浣熊', title_en: 'Scrap Bandit', rarity: 'A', cost: 2.0, element: 'umbra', skill: 'recon_boost',
    lore_zh: '她坚信所有没上锁的服务器都是公共财产，所有上了锁的也是。',
    lore_en: 'She believes every unlocked server is public property. Also every locked one.',
  },
  {
    key: 'kf_16', card: '16', image: '16', name_zh: '棕熊', name_en: 'Brown Bear',
    title_zh: '重装棕熊', title_en: 'Heavy Pelt', rarity: 'B', cost: 1.5, element: 'bloom', skill: 'self_repair',
    lore_zh: '她负责扛走队友拆不动的服务器机柜，通常连地板一起。',
    lore_en: 'She carries server racks her teammates cannot move — usually including the floor.',
  },
  {
    key: 'kf_13', card: '13', image: '13', name_zh: '北狐', name_en: 'Ezo Red Fox',
    title_zh: '北境赤狐', title_en: 'Northlight Fox', rarity: 'B', cost: 1.5, element: 'radiance', skill: 'march_haste',
    lore_zh: '她在数据海的冷层里送快递，从不迟到，也从不解释路线。',
    lore_en: 'She delivers through the Data Sea’s cold layer. Never late. Never explains the route.',
  },
  {
    key: 'kf_24', card: '24', image: '24', name_zh: '皇家企鹅', name_en: 'Royal Penguin',
    title_zh: '皇家企鹅', title_en: 'Royal Cohort', rarity: 'B', cost: 1.0, element: 'cryo', skill: 'repair_cycle',
    lore_zh: '她坚持每次出征前进行队列检查，即使队列里只有她一个。',
    lore_en: 'She insists on a formation check before every deployment — even when the formation is only her.',
  },
];

export const ROSTER = jewel.map((g) => {
  const [atk, def, spd, int] = (() => {
    const s = statsFor(g.key, g.rarity, g.cost, g.element);
    return [s.base_atk, s.base_def, s.base_spd, s.base_int];
  })();
  const source = g.key.startsWith('js_') ? 'Jewel Savior FREE' : 'Project K';
  const art = g.key.startsWith('js_') ? `/assets/generals/jewel_${g.card}.webp` : `/assets/generals/kf_${g.image}.webp`;
  return {
    ...g,
    source,
    source_ref: String(g.card),
    base_hp: 100,
    base_atk: atk,
    base_def: def,
    base_spd: spd,
    base_int: int,
    art_url: art,
    pool_weight: { B: 100, A: 90, S: 70, SS: 40, P: 12 }[g.rarity],
    enabled: 1,
  };
});

export const ROSTER_COUNT = ROSTER.length;
