import { S, L, tr, api, boot, setLang, errorText } from '../core.js';
import { esc, icon, modal, toast } from '../ui.js';

const CHARTER_KEYS = ['lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'];
const CHARTER_COLORS = { lumen: 'var(--lumen)', ember: 'var(--ember)', cryo: 'var(--cryo)', bloom: 'var(--bloom)', radiance: 'var(--radiance)', umbra: 'var(--umbra)' };

export function renderLanding(root) {
  const bootData = S.boot || {};
  const season = bootData.season;
  const open = bootData.settings?.registrationOpen !== 0;
  const lang = S.lang;
  root.innerHTML = `<div class="landing">
    <div class="landing-bg"></div><div class="landing-scan"></div>
    <div class="landing-inner">
      <div class="landing-top">
        <div class="landing-brand">
          <div class="brand-mark">FE<span style="color:var(--magenta)">//</span></div>
          <div class="brand-type"><b>FIRESEED</b> ENGAGE<small>${esc(tr('game.subtitle'))}</small></div>
        </div>
        <div class="row">
          <div class="lang-toggle"><button data-lang="zh" class="${lang === 'zh' ? 'active' : ''}">中文</button><button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button></div>
        </div>
      </div>

      <div class="landing-hero">
        <div class="landing-copy">
          <div class="kicker">DATA SEA / DRILLING LICENSE 02</div>
          <h1 class="landing-title"><span class="l1">FIRESEED</span><span class="l2">EN<em>GAGE</em></span></h1>
          <div class="landing-cn">${esc(tr('game.title'))}</div>
          <p class="landing-tag">${esc(tr('game.tagline'))}</p>
          <div class="landing-actions">
            ${S.user
              ? `<button class="btn primary" data-enter>${icon('down')} ${esc(tr('game.cta'))}</button>`
              : `<button class="btn primary" data-focus-auth>${icon('down')} ${esc(tr('game.cta'))}</button>`}
            <button class="btn ghost" data-lore>${icon('report')} ${esc(tr('game.archive'))}</button>
          </div>
          <div class="landing-stats">
            <div class="landing-stat"><b>${season ? String(season.number).padStart(2, '0') : '--'}</b><span>${esc(tr('hud.season'))}</span></div>
            <div class="landing-stat"><b>${bootData.online ?? 0}</b><span>${esc(tr('hud.online'))}</span></div>
            <div class="landing-stat"><b>12</b><span>GATEWAYS</span></div>
            <div class="landing-stat"><b>${season?.holeHolderName ? 'HELD' : 'OPEN'}</b><span>SILVER BORE</span></div>
          </div>
        </div>

        <div class="landing-side" id="auth-anchor">
          ${S.user ? loggedInCard() : `<div class="auth-panel" id="auth-panel">${authPanel(open)}</div>`}
        </div>
      </div>

      <div class="landing-foot">
        <span>${esc(tr('game.fan'))}</span>
        <span>JEWEL SAVIOR FREE · PROJECT K FAN ART · NO REAL-MONEY PAYMENTS</span>
        <span>v2.0 / BUILD 2026.10</span>
      </div>
    </div>
  </div>`;

  root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
    setLang(b.dataset.lang);
    if (S.user) api('/api/locale', { method: 'POST', body: { locale: S.lang } }).catch(() => {});
    renderLanding(root);
  }));
  root.querySelector('[data-enter]')?.addEventListener('click', () => { location.hash = '#/city'; });
  root.querySelector('[data-focus-auth]')?.addEventListener('click', () => {
    document.getElementById('auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector('#auth-panel input')?.focus();
  });
  root.querySelector('[data-lore]')?.addEventListener('click', () => loreModal());

  if (!S.user) bindAuth(root, open);
  else bindAuth(root, open);
}

function loggedInCard() {
  return `<div class="auth-panel">
    <div class="kicker">SESSION ACTIVE</div>
    <h3>${esc(S.user.displayName)}</h3>
    <div class="auth-sub">${esc(tr('charter.' + S.user.charter))} · ID ${S.user.id}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="tag cyan">${esc(tr('resource.lumen'))} ${S.user.lumen}</span>
      <span class="tag magenta">${esc(tr('resource.umbra'))} ${S.user.umbra}</span>
    </div>
    <div class="divider"></div>
    <button class="btn primary wide" data-enter2>${icon('city')} ${esc(tr('game.cta'))}</button>
    <button class="btn ghost wide" data-logout style="margin-top:8px">${icon('logout')} ${esc(tr('common.logout'))}</button>
  </div>`;
}

function authPanel(open) {
  return `<div class="auth-tabs">
      <button class="auth-tab active" data-mode="login">${esc(tr('common.login'))}</button>
      <button class="auth-tab" data-mode="register" ${open ? '' : 'disabled'}>${esc(tr('common.register'))}</button>
    </div>
    <div id="auth-form-area"></div>
    <div class="auth-foot"><span>${esc(tr('game.subtitle'))}</span><span class="mono">SECURE LINE / TLS</span></div>`;
}

function bindAuth(root, open) {
  const panel = root.querySelector('#auth-panel');
  if (!panel) {
    root.querySelector('[data-enter2]')?.addEventListener('click', () => { location.hash = '#/city'; });
    root.querySelector('[data-logout]')?.addEventListener('click', async () => {
      await api('/api/logout', { method: 'POST' }).catch(() => {});
      S.user = null; S.state = null; S.csrf = null;
      await boot(); renderLanding(root);
    });
    return;
  }
  let mode = 'login';
  let charter = 'lumen';
  const area = panel.querySelector('#auth-form-area');
  const draw = () => {
    panel.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    area.innerHTML = `
      <h3>${esc(mode === 'login' ? tr('auth.loginTitle') : tr('auth.registerTitle'))}</h3>
      <div class="auth-sub">${esc(mode === 'login' ? tr('auth.loginSub') : tr('auth.registerSub'))}</div>
      <form id="auth-form" autocomplete="on">
        <div class="field"><label>${esc(tr('common.username'))}</label><input class="input" name="username" required minlength="3" maxlength="20" autocomplete="username" placeholder="driller_${Math.floor(Math.random() * 900 + 100)}"></div>
        ${mode === 'register' ? `<div class="field"><label>${esc(tr('common.displayName'))}</label><input class="input" name="displayName" required minlength="2" maxlength="24" placeholder="CALLSIGN"></div>` : ''}
        <div class="field"><label>${esc(tr('common.password'))}</label><input class="input" name="password" type="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" placeholder="••••••••"></div>
        ${mode === 'register' ? `<div class="field"><label>${esc(tr('common.charter'))}</label>
          <div class="charter-grid" id="charter-grid">${CHARTER_KEYS.map((k) => `<button type="button" class="charter-option ${k === charter ? 'active' : ''}" data-charter="${k}" style="--el:${CHARTER_COLORS[k]}"><i></i><b>${esc(tr('charter.' + k))}</b><span>+6% ${esc(tr('element.' + k))}</span></button>`).join('')}</div>
          <div class="mono tiny muted">${esc(tr('auth.charterHint'))}</div></div>` : ''}
        <div class="auth-error" id="auth-error"></div>
        <button class="btn primary wide" type="submit">${icon('down')} ${esc(mode === 'login' ? tr('auth.enter') : tr('auth.create'))}</button>
      </form>
      <div class="auth-foot"><span>${esc(mode === 'login' ? tr('auth.noAccount') : tr('auth.hasAccount'))}</span><a href="#" data-switch>${esc(mode === 'login' ? tr('auth.switchRegister') : tr('auth.switchLogin'))}</a></div>`;
    area.querySelectorAll('[data-charter]').forEach((b) => b.addEventListener('click', () => {
      charter = b.dataset.charter;
      area.querySelectorAll('[data-charter]').forEach((x) => x.classList.toggle('active', x === b));
    }));
    area.querySelector('[data-switch]').addEventListener('click', (e) => {
      e.preventDefault();
      if (mode === 'login' && !open) { toast(tr('auth.registrationClosed'), 'warn'); return; }
      mode = mode === 'login' ? 'register' : 'login'; draw();
    });
    area.querySelector('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector('button[type=submit]');
      const err = area.querySelector('#auth-error');
      err.textContent = '';
      btn.disabled = true;
      try {
        const payload = mode === 'login'
          ? { username: fd.get('username'), password: fd.get('password') }
          : { username: fd.get('username'), displayName: fd.get('displayName'), password: fd.get('password'), charter, locale: S.lang };
        const res = await api(`/api/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: payload });
        S.csrf = res.csrf || S.csrf;
        await boot();
        S.user = S.boot.user;
        await import('../app.js').then((m) => m.startGame());
      } catch (ex) {
        err.textContent = errorText(ex);
        btn.disabled = false;
      }
    });
  };
  panel.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    mode = b.dataset.mode; draw();
  }));
  draw();
}

function loreModal() {
  const zh = S.lang === 'zh';
  modal({
    title: zh ? '世界档案' : 'World Archive',
    tag: 'DATA SEA / 2057',
    wide: true,
    body: `<div class="grid two" style="gap:18px">
      <div>
        <div class="kicker">${zh ? '背景' : 'PREMISE'}</div>
        <p style="color:#b8d6e1;font-size:13px;line-height:1.8">${zh
          ? '2057 年，旧互联网在自身档案的重量下坍缩。锈蚀的表层之下，是一片由压缩记忆、死协议与温热幽灵组成的黑色海洋——数据之海。你是“钻探者”，一名把城塞钻台钉入海床、汲取六色矿脉的回收工程师。你的武将是重铸的战斗人格：雇佣兵、机械圣徒、档案偶像。十二座企业埋葬城守着十二门；海的正中央，银白之孔仍在向旧世界的核心下钻。谁握住它，谁就书写下一张网络。'
          : 'In 2057 the old internet collapsed under the weight of its own archive. Beneath the rusted crust lies the Data Sea: a black ocean of compressed memory, dead protocols and warm ghosts. You are a Driller, a salvage engineer who sinks a bastion rig into the seabed and taps the six mineral currents. Your Vanguards are re-forged combat personas: mercenaries, machine saints, archive idols. Twelve corporate burial-cities keep the Twelve Gateways. At the centre, the Silver Bore still drills into the core of the old world. Whoever holds it writes the next network.'}</p>
        <div class="divider"></div>
        <div class="kicker">${zh ? '六色矿脉' : 'SIX CURRENTS'}</div>
        <p style="color:#9dbecb;font-size:12px;line-height:1.8">${zh
          ? '亮晶晶＝白噪数据结晶，跨赛季货币。暖洋洋＝地热余烬，训练突击单位。冷冰冰＝冷却剂凝晶，训练守备单位。郁萌萌＝有机数据苔，训练轰击单位。昼闪闪＝昼轨光尘，训练基础单位。夜静静＝深潜暗质，跨赛季货币。思考回路＝钻台计算出的战略带宽，用于占领资源点。'
          : 'Lumen = white-noise data crystal, a cross-season currency. Ember = geothermal residue, trains assault frames. Cryo = coolant crystal, trains guard frames. Verdant = organic data-moss, trains bombardment frames. Radiance = dayrail light dust, trains basic frames. Umbra = deep-dive dark matter, a cross-season currency. Circuit = strategic bandwidth computed by the rig, spent to annex resource nodes.'}</p>
      </div>
      <div>
        <div class="kicker">${zh ? '操作' : 'CONTROLS'}</div>
        <div class="list" style="border:1px solid var(--line)">
          ${[
            [zh ? '基地' : 'Base', zh ? '在 24×24 网格上建造设施、训练部队、升级采集井。' : 'Build on the 24×24 grid, train troops, upgrade taps.'],
            [zh ? '地图' : 'Map', zh ? '滚轮缩放、拖拽平移。占领空地，攻打资源点与前哨。' : 'Wheel zoom, drag pan. Claim empty ground, assault nodes and outposts.'],
            [zh ? '武将' : 'Vanguards', zh ? '消耗亮晶晶召唤；升级、装备技能、派驻城塞。' : 'Summon with Lumen; level up, equip protocols, station in bastions.'],
            [zh ? '技能' : 'Protocols', zh ? '消耗夜静静抽取；同名卡用于升级；每名武将两个自由槽。' : 'Draw with Umbra; duplicates upgrade; two free slots per Vanguard.'],
            [zh ? '内政' : 'Archive', zh ? '赛季科研用四色资源，永久科研用亮/夜，跨赛季保留。' : 'Seasonal research uses four resources; permanent research uses Lumen/Umbra and persists.'],
            [zh ? '银白之孔' : 'Silver Bore', zh ? '先占领至少一座十二门，再攻下中央银白之孔并持续占领。' : 'Hold at least one Gateway, then take the central Silver Bore and hold it.'],
          ].map(([a, b]) => `<div class="list-row"><div class="lr-main"><div class="lr-title">${esc(a)}</div><div class="lr-sub" style="white-space:normal">${esc(b)}</div></div></div>`).join('')}
        </div>
        <div class="divider"></div>
        <div class="kicker">${zh ? '素材与致谢' : 'CREDITS'}</div>
        <p style="font-size:11px;color:#8fadb9;line-height:1.7">${zh
          ? '武将素材来自 Jewel Savior FREE（ジュエルセイバーFREE，http://www.jewel-s.jp/，依其免费内容条款使用）与 ProjectK《动物朋友3》角色资料；ProjectK 角色卡图为生成式同人再绘，不使用游戏原始资产。原案《メガミエンゲイジ！》© G-MODE / ONE-UP / Marvelous 及各自权利方。本企划为非商业同人重制，与上述公司无关。'
          : 'Vanguard material uses Jewel Savior FREE (ジュエルセイバーFREE, http://www.jewel-s.jp/, under its free-content terms) and ProjectK Kemono Friends 3 character data. ProjectK card art is generative fan re-illustration, not reused game assets. Original concept メガミエンゲイジ！ © G-MODE / ONE-UP / Marvelous and respective rights holders. This is a non-commercial fan remake, not affiliated with them.'}</p>
      </div>
    </div>`,
    actions: [{ label: tr('common.close'), class: 'ghost' }],
  });
}
