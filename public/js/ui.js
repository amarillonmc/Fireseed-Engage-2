import { S, L, tr } from './core.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmt(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + 'k';
  return Math.round(v).toLocaleString('en-US');
}

export function fmt1(n) { return (Math.round(Number(n) * 10) / 10).toFixed(1); }

export function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function timeLeft(isoOrMs) {
  if (!isoOrMs) return 0;
  const v = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  return Math.max(0, v - Date.now());
}

export function timeAgo(ms) {
  if (!ms) return tr('common.unknown');
  const d = Date.now() - Number(ms);
  if (d < 60000) return `${Math.floor(d / 1000)}s`;
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
}

export function countdownHTML(until, cls = '') {
  const ms = timeLeft(until);
  const text = ms <= 0 ? tr('countdown.ready') : fmtDuration(ms);
  return `<span class="mono ${cls}" data-until="${until}">${text}</span>`;
}

export function tickCountdowns() {
  document.querySelectorAll('[data-until]').forEach((el) => {
    const ms = timeLeft(Number(el.dataset.until));
    el.textContent = ms <= 0 ? tr('countdown.ready') : fmtDuration(ms);
    if (ms <= 0) el.classList.add('done');
  });
}

export function costHTML(cost) {
  if (!cost) return '';
  return Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `<span class="cost ${k}"><i></i>${fmt(v)}</span>`).join('');
}

const RES_ORDER = ['lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'];

export function resourceStrip(state) {
  if (!state) return '';
  const r = state.resources;
  const rates = state.rates?.perHour || {};
  const caps = state.caps || {};
  const SHORT = { lumen: '亮', ember: '暖', cryo: '冷', bloom: '郁', radiance: '昼', umbra: '夜' };
  const SHORT_EN = { lumen: 'LUM', ember: 'EMB', cryo: 'CRY', bloom: 'VRD', radiance: 'RAD', umbra: 'UMB' };
  const chips = RES_ORDER.map((k) => {
    const cap = caps[k];
    const capTxt = cap && cap < 1e8 ? `/${fmt(cap)}` : '';
    return `<div class="res ${k}" title="${esc(tr('resource.' + k))} +${fmt(rates[k] || 0)}${tr('common.perHour')}">
      <i></i><b>${fmt(r[k])}</b><small>${S.lang === 'zh' ? SHORT[k] : SHORT_EN[k]}</small><small class="cap">${capTxt}</small>
    </div>`;
  }).join('');
  const circuitCap = state.caps?.circuit ?? 20;
  return `<div class="resource-strip"><div class="wrap">${chips}
    <div class="res circuit" title="${esc(tr('resource.circuit'))}"><i></i><b>${state.resources.circuit}</b><small>${esc(tr('hud.circuit'))}</small><small>/${circuitCap}</small></div>
    <div class="res circuit" title="${esc(tr('hud.tapes'))}"><i style="background:var(--amber);box-shadow:0 0 8px var(--amber)"></i><b>${state.user.tapes}</b><small>${esc(tr('hud.tapes'))}</small></div>
    <div class="alerts">${state.movements?.incoming?.length ? `<span class="alert-chip">⚠ ${esc(tr('hud.incoming'))} ${state.movements.incoming.length}</span>` : ''}
      <a href="#/profile" class="alert-chip" style="border-color:var(--line);color:var(--muted)">${esc(tr('hud.reports'))} ${state.reportsUnread || 0}</a></div>
  </div></div>`;
}

const ICONS = {
  city: '<path d="M3 21h18M5 21V8l5-3 5 3v13M15 21V11l4-2 2 2v10M8 11h2M8 15h2M8 18h2M17 14h1M17 17h1"/>',
  map: '<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2ZM9 3v16M15 5v16"/>',
  general: '<path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-5"/>',
  skill: '<path d="M12 2 4 7v6c0 5 3 7 8 9 5-2 8-4 8-9V7l-8-5Z"/><path d="m12 7 1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5L12 7Z"/>',
  research: '<path d="M9 3h6M10 3v6L4 20h16L14 9V3"/><path d="M6 16h12"/>',
  army: '<path d="m14 4 6 6-9 9H5v-6l9-9Z"/><path d="m12 6 6 6M5 19l4-4"/>',
  rank: '<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
  alliance: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 14c2.8 0 5 2.2 5 5"/>',
  shop: '<path d="M3 7h18l-2 13H5L3 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  admin: '<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6l-9-4Z"/><path d="M12 8v5M12 16h.01"/>',
  circuit: '<path d="M4 12h4l2-6 4 12 2-6h4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z"/>',
  sword: '<path d="m14 4 6 6-9 9H5v-6l9-9Z"/><path d="m12 6 6 6"/>',
  flask: '<path d="M9 3h6M10 3v6L4 20h16L14 9V3"/><path d="M6 16h12"/>',
  dorm: '<path d="M3 18v-6h18v6M3 18v2M21 18v2M5 12V8h6v4M11 12V8h8v4"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1"/>',
  watch: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  crown: '<path d="m3 8 4 3 5-7 5 7 4-3-2 11H5L3 8Z"/><path d="M5 19h14"/>',
  tap: '<path d="M12 3v8M8 7h8M12 11c-3 0-5 2-5 5v5h10v-5c0-3-2-5-5-5Z"/>',
  scout: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M11 7v4l3 2"/>',
  attack: '<path d="M4 20 20 4M14 4h6v6M6 14l4 4"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  report: '<path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-13-3 3-3 6-3 8-2-1-3-3-3-3-1 3-3 5-3 8 0 4 3 7 7 7Z"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18M8 4l4 4 4-4M8 20l4-4 4 4"/>',
  leaf: '<path d="M20 4C10 4 4 9 4 16c0 2 1 4 1 4s2-8 15-11c-3 4-7 7-12 8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  star: '<path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2-5.6-3.1-5.6 3.1 1.3-6.2L3 9.5l6.3-.7L12 3Z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  chat: '<path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 8h8M8 12h5"/>',
  logout: '<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/>',
};

export function icon(name, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.dot}</svg>`;
}

const FAC_ICON = {
  governor: 'crown', barracks: 'sword', lab: 'flask', dorm: 'dorm', storage: 'vault',
  watchtower: 'watch', workshop: 'gear',
  extractor_lumen: 'spark', extractor_ember: 'flame', extractor_cryo: 'snow',
  extractor_bloom: 'leaf', extractor_radiance: 'sun', extractor_umbra: 'moon',
};
export function facilityIcon(type, cls = 'fac-ico') {
  return icon(FAC_ICON[type] || 'gear', cls);
}

export function elementName(el) { return tr('element.' + el); }

export function rarityLabel(r) { return r; }

export function elementDot(el) { return `<span class="element-dot el-${el}"></span>`; }

export function statsLine(stats) {
  return `<span class="mono">${tr('common.atk')} ${stats.atk}</span><span class="mono">${tr('common.def')} ${stats.def}</span><span class="mono">${tr('common.spd')} ${stats.spd}</span><span class="mono">${tr('common.int')} ${stats.int}</span>`;
}

export function cardHTML(g, opts = {}) {
  const stats = g.stats || g.baseStats || { atk: g.base_atk, def: g.base_def, spd: g.base_spd, int: g.base_int };
  const name = esc(L(g.name));
  const title = esc(L(g.title));
  const art = g.artUrl || g.art_url || '/assets/generals/placeholder.svg';
  const level = g.level ?? null;
  const innate = g.innate;
  const skills = (g.skills || []).filter(Boolean);
  const duplicates = g.dupes ? `<span class="vc-dup">✦ ${g.dupes}</span>` : '';
  return `<div class="vcard rarity-${g.rarity} el-${g.element} ${opts.flipped ? 'flipped' : ''}" data-general-id="${g.id}" data-player-general-id="${g.playerGeneralId || g.id || ''}">
    <div class="vcard-inner">
      <div class="vcard-face vcard-front">
        <div class="vc-art" style="background-image:url('${esc(art)}')"></div>
        <div class="holo"></div>
        <div class="vc-top"><span class="vc-rarity">${esc(g.rarity)}</span><span class="vc-cost">C ${fmt1(g.cost)}</span></div>
        <button class="vc-flip" data-flip title="flip">⇄</button>
        <div class="vc-bottom">
          <div class="vc-name">${name}</div>
          <div class="vc-title">${title || esc(tr('common.unknown'))}</div>
          <div class="vc-meta"><span class="vc-element">${elementDot(g.element)} ${esc(elementName(g.element))}</span>${level != null ? `<span class="vc-lv">LV ${level}${opts.hp ? ` · HP ${opts.hp}` : ''}</span>` : `<span class="vc-lv">${esc(g.source || '')}</span>`}</div>
        </div>
        ${duplicates}
      </div>
      <div class="vcard-face vcard-back">
        <div class="b-head"><b>${name}</b><span class="tag ${g.rarity === 'P' ? 'amber' : 'cyan'}">${esc(g.rarity)}</span></div>
        <div class="vc-stats">
          <div class="vc-stat"><span>ATK</span><b>${stats.atk}</b></div>
          <div class="vc-stat"><span>DEF</span><b>${stats.def}</b></div>
          <div class="vc-stat"><span>SPD</span><b>${stats.spd}</b></div>
          <div class="vc-stat"><span>INT</span><b>${stats.int}</b></div>
        </div>
        <div class="vc-skills">
          ${innate ? `<div class="vc-skill" style="--sc:var(--cyan)">◆ ${esc(L(innate.name))}</div>` : ''}
          ${skills.map((s) => `<div class="vc-skill" style="--sc:var(--${s.element})">◇ ${esc(L(s.name))} Lv.${s.level}</div>`).join('')}
          ${!innate && !skills.length ? `<div class="vc-skill dim">${esc(tr('generals.noSkill'))}</div>` : ''}
        </div>
        <div class="vc-meta" style="margin-top:8px"><span class="vc-element">${esc(tr('common.power'))} ${g.power ?? '-'}</span><span class="vc-lv">${esc(tr('common.cost'))} ${fmt1(g.cost)}</span></div>
      </div>
    </div>
  </div>`;
}

export function skillCardHTML(s) {
  const equipped = s.equippedOn ? `<span class="tag magenta">${tr('skills.equippedOn', { id: s.equippedOn })}</span>` : `<span class="tag">${tr('skills.notEquipped')}</span>`;
  return `<div class="tech-card" data-skill-id="${s.playerSkillId || s.id}">
    <div class="tc-head"><div><h4>${esc(L(s.name))}</h4><div class="lr-sub">${esc(s.kind === 'active' ? tr('generals.active') : tr('generals.passive'))} · ${esc(L(s.desc) || '')}</div></div><span class="tag ${s.rare === 'P' ? 'amber' : 'cyan'}">${esc(s.rare)}</span></div>
    <div class="tc-desc">${esc(L(s.desc))}</div>
    <div class="pips">${Array.from({ length: s.maxLevel || 10 }, (_, i) => `<i class="${i < (s.level || 1) ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tc-foot">${equipped}<span class="mono small">Lv.${s.level || 1} · ${esc(tr('skills.count', { n: s.count || 1 }))}</span></div>
  </div>`;
}

export function emptyState(title, sub = '') {
  return `<div class="empty-state"><b>${esc(title)}</b>${esc(sub)}</div>`;
}

export function toast(message, type = 'info', title = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${title ? `<b>${esc(title)}</b>` : ''}${esc(message)}`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 3800);
}

export function modal({ title, tag = '', body, actions = [], wide = false, narrow = false, onMount, dismissible = true }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  root.classList.add('open');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  const m = document.createElement('div');
  m.className = `modal ${wide ? 'wide' : ''} ${narrow ? 'narrow' : ''}`;
  m.innerHTML = `<div class="modal-head"><div><h3>${esc(title)}</h3>${tag ? `<span class="tag cyan">${esc(tag)}</span>` : ''}</div><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">${body || ''}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.class || ''}" data-action-index="${i}" ${a.disabled ? 'disabled' : ''}>${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}`;
  root.appendChild(wrap);
  root.appendChild(m);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    root.classList.remove('open'); root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', () => { if (dismissible) close(); });
  m.querySelector('[data-close]').addEventListener('click', close);
  m.querySelectorAll('[data-action-index]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const a = actions[Number(btn.dataset.actionIndex)];
      if (!a) return;
      if (a.onClick) {
        btn.disabled = true;
        try { await a.onClick(close, btn); } finally { btn.disabled = false; }
      }
      if (a.close !== false) close();
    });
  });
  if (onMount) onMount(m, close);
  return { el: m, close };
}

export function confirmDialog(message, { title, danger = false, okLabel } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const { close } = modal({
      title: title || tr('common.confirm'), narrow: true,
      body: `<div class="notice ${danger ? '' : 'cyan'}" style="${danger ? 'border-color:rgba(255,92,92,.4);color:#ffb3b3' : ''}">${esc(message)}</div>`,
      actions: [
        { label: tr('common.cancel'), class: 'ghost', onClick: () => { settled = true; resolve(false); } },
        { label: okLabel || tr('common.confirm'), class: danger ? 'danger' : 'primary', onClick: () => { settled = true; resolve(true); } },
      ],
      onMount: (m, close) => {
        const orig = close;
        m.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.classList.contains('modal-backdrop')) { if (!settled) { settled = true; resolve(false); } } });
      },
    });
  });
}

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="mono">${esc(label || tr('common.processing'))}</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.old) btn.innerHTML = btn.dataset.old;
  }
}

export function bindActions(root, handlers) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
}

export function resourceName(key) { return tr('resource.' + key); }
export function charterName(key) { return tr('charter.' + key); }

export function progressBar(value, max, cls = '') {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return `<div class="meter ${cls}"><i style="width:${pct}%"></i></div>`;
}

export function safeArt(url) {
  return url || '/assets/generals/placeholder.svg';
}
