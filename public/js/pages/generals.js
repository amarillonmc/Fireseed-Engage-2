import { S, L, tr, api, refreshState, errorText } from '../core.js';
import {
  esc, icon, cardHTML, fmt, fmt1, fmtDuration, modal, toast, costHTML, emptyState,
} from '../ui.js';

let rootEl = null;
let data = null;
let tab = 'owned';
let filters = { element: '', rarity: '', ownedOnly: false, sort: 'rarity' };
let cleanupFns = [];

export async function render(root) {
  rootEl = root;
  await load();
  return () => { cleanupFns.forEach((f) => f()); cleanupFns = []; rootEl = null; };
}

async function load() {
  data = await api('/api/generals');
  draw();
}

function draw() {
  if (!rootEl || !data) return;
  const state = S.state;
  const rates = state.settings?.gachaRates || { B: 48, A: 30, S: 15, SS: 6, P: 1 };
  const pity = state.user.pity || 0;
  const pityMax = state.settings?.gachaPity || 80;
  const list = (tab === 'owned' ? data.owned : data.catalog).filter((g) => {
    if (filters.element && g.element !== filters.element) return false;
    if (filters.rarity && g.rarity !== filters.rarity) return false;
    if (tab === 'owned' && filters.ownedOnly === false) return true;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'power') return (b.power || 0) - (a.power || 0);
    if (filters.sort === 'level') return (b.level || 0) - (a.level || 0);
    return (b.cost || 0) - (a.cost || 0);
  });
  rootEl.innerHTML = `
    <div class="section-title"><div><div class="kicker">${esc(tr('generals.subtitle'))}</div><h2>${esc(tr('generals.title'))}</h2></div>
      <span class="sub">${esc(tr('generals.ownedCount', { n: data.owned.length, total: data.catalog.length }))} · ${esc(tr('generals.costCap'))} ${fmt1(data.costCap)}</span></div>

    <div class="gacha-banner" style="margin-bottom:18px">
      <div>
        <div class="kicker">RESONANCE POOL / LUMEN ONLY</div>
        <h3>${esc(tr('generals.gacha'))}</h3>
        <p>${esc(tr('generals.gachaDesc'))}</p>
        <div class="rates">${Object.entries(rates).map(([r, v]) => `<span class="rate rarity-${r}" style="color:var(--rc)">${r} ${v}%</span>`).join('')}
          <span class="rate">${esc(tr('generals.pity'))} ${pity}/${pityMax}</span></div>
      </div>
      <div class="col" style="gap:8px;min-width:220px">
        <button class="btn primary" data-gacha="1" ${state.resources.lumen < state.settings.gachaGeneral ? 'disabled' : ''}>${icon('spark')} ${esc(tr('generals.gachaOne', { n: state.settings.gachaGeneral }))}</button>
        <button class="btn magenta" data-gacha="10" ${state.resources.lumen < state.settings.gachaGeneralTen ? 'disabled' : ''}>${icon('spark')} ${esc(tr('generals.gachaTen', { n: state.settings.gachaGeneralTen }))}</button>
        <a class="btn ghost sm" href="#/skills">${icon('skill')} ${esc(tr('generals.gachaSkill'))}</a>
      </div>
    </div>

    <div class="tabs">
      <button class="${tab === 'owned' ? 'active' : ''}" data-tab="owned">${esc(tr('generals.collection'))}</button>
      <button class="${tab === 'catalog' ? 'active' : ''}" data-tab="catalog">${esc(tr('generals.catalog'))}</button>
    </div>
    <div class="card-toolbar">
      <span class="mono tiny muted">${esc(tr('generals.filterElement'))}</span>
      ${['', 'lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'].map((e) => `<button class="filter-btn ${filters.element === e ? 'active' : ''}" data-el="${e}">${e ? esc(tr('element.' + e)) : esc(tr('common.all'))}</button>`).join('')}
      <span style="width:10px"></span>
      ${['', 'B', 'A', 'S', 'SS', 'P'].map((r) => `<button class="filter-btn ${filters.rarity === r ? 'active' : ''}" data-rar="${r}">${r || esc(tr('common.all'))}</button>`).join('')}
      <span class="spacer"></span>
      <select class="select" id="sort" style="width:auto;min-width:140px">
        <option value="rarity" ${filters.sort === 'rarity' ? 'selected' : ''}>${esc(tr('generals.sortRarity'))}</option>
        <option value="power" ${filters.sort === 'power' ? 'selected' : ''}>${esc(tr('generals.sortPower'))}</option>
        <option value="level" ${filters.sort === 'level' ? 'selected' : ''}>${esc(tr('generals.sortLevel'))}</option>
      </select>
    </div>
    ${list.length ? `<div class="card-grid">${list.map((g) => tab === 'owned'
      ? `<div data-pgid="${g.id}">${cardHTML(g, { hp: g.hp })}</div>`
      : `<div data-gid="${g.id}" class="${g.owned ? '' : 'dim-card'}">${cardHTML(g)}</div>`).join('')}</div>`
      : emptyState(tr('common.empty'), '')}`;
  bind();
}

function bind() {
  rootEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
  rootEl.querySelectorAll('[data-el]').forEach((b) => b.addEventListener('click', () => { filters.element = b.dataset.el; draw(); }));
  rootEl.querySelectorAll('[data-rar]').forEach((b) => b.addEventListener('click', () => { filters.rarity = b.dataset.rar; draw(); }));
  rootEl.querySelector('#sort')?.addEventListener('change', (e) => { filters.sort = e.target.value; draw(); });
  rootEl.querySelectorAll('[data-pgid]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-flip]')) { e.stopPropagation(); el.querySelector('.vcard')?.classList.toggle('flipped'); return; }
    const g = data.owned.find((x) => x.id === Number(el.dataset.pgid));
    if (g) openDetail(g, true);
  }));
  rootEl.querySelectorAll('[data-gid]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-flip]')) { e.stopPropagation(); el.querySelector('.vcard')?.classList.toggle('flipped'); return; }
    const g = data.catalog.find((x) => x.id === Number(el.dataset.gid));
    if (g) openDetail(g, false);
  }));
  rootEl.querySelectorAll('[data-gacha]').forEach((b) => b.addEventListener('click', () => doGacha(Number(b.dataset.gacha), b)));
}

async function doGacha(times, btn) {
  btn.disabled = true;
  try {
    const res = await api('/api/gacha/general', { method: 'POST', body: { times } });
    showGacha(res, 'general');
    await refreshState();
    await load();
  } catch (e) { toast(errorText(e), 'error'); btn.disabled = false; }
}

export function showGacha(res, kind) {
  const results = res.results || [];
  const body = `<div class="kicker">${kind === 'skill' ? tr('skills.gacha') : tr('generals.gachaResult')} · -${res.cost} ${kind === 'skill' ? tr('resource.umbra') : tr('resource.lumen')}</div>
    <div class="card-grid" style="margin-top:10px">${results.map((r) => `<div class="vcard rarity-${r.rarity} el-${r.element}" style="cursor:default"><div class="vcard-face vcard-front">
      <div class="vc-art" style="background-image:url('${esc(r.artUrl || '')}')"></div>
      <div class="vc-top"><span class="vc-rarity">${esc(r.rarity)}</span>${r.duplicate ? `<span class="tag amber">${esc(tr('generals.dupe'))}</span>` : `<span class="tag green">${esc(tr('generals.new'))}</span>`}</div>
      <div class="vc-bottom"><div class="vc-name">${esc(L(r.name))}</div><div class="vc-title">${esc(L(r.title) || (kind === 'skill' ? tr('skills.title') : ''))}</div><div class="vc-meta"><span class="vc-element">${esc(tr('element.' + r.element))}</span><span class="vc-lv">${kind === 'skill' ? `Lv.${r.level || 1}` : `C${fmt1(r.cost)}`}</span></div></div>
    </div></div>`).join('')}</div>`;
  modal({ title: kind === 'skill' ? tr('generals.gachaSkill') : tr('generals.gacha'), body, wide: results.length > 4, actions: [{ label: tr('common.close'), class: 'ghost' }] });
}

function openDetail(g, owned) {
  const state = S.state;
  const canLevel = owned && g.level < g.maxLevel;
  const levelCost = g.levelCost;
  const stats = g.stats || g.baseStats || {};
  const slots = g.slots || [null, null];
  const innate = g.innate;
  const allSkills = [innate, ...slots.filter(Boolean)];
  const body = `<div class="gd-layout">
    <div>
      <div class="gd-art rarity-${g.rarity}"><img src="${esc(g.artUrl)}" alt=""><span class="vc-rarity gd-rarity">${esc(g.rarity)}</span></div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="tag ${g.element === 'lumen' ? 'cyan' : 'magenta'}">${esc(tr('element.' + g.element))}</span><span class="tag">C ${fmt1(g.cost)}</span><span class="tag">${esc(g.source)}</span></div>
      <p class="small muted" style="margin-top:10px">${esc(L(g.lore))}</p>
    </div>
    <div>
      <div class="kicker">${esc(tr('generals.subtitle'))}</div>
      <div class="gd-name">${esc(L(g.name))}</div>
      <div class="gd-title">${esc(L(g.title))}</div>
      <div class="gd-stats">
        <div class="gd-stat"><span>ATK</span><b>${stats.atk ?? '—'}</b></div>
        <div class="gd-stat"><span>DEF</span><b>${stats.def ?? '—'}</b></div>
        <div class="gd-stat"><span>SPD</span><b>${stats.spd ?? '—'}</b></div>
        <div class="gd-stat"><span>INT</span><b>${stats.int ?? '—'}</b></div>
      </div>
      <div class="row between"><span class="mono small muted">${esc(tr('common.hp'))}</span><span class="mono small">${owned ? `${g.hp} / 100` : '—'}</span></div>
      ${owned ? `<div class="meter hp" style="margin:4px 0 10px"><i style="width:${g.hp}%"></i></div>` : ''}
      <div class="row wrap" style="gap:8px">
        <span class="tag cyan">${esc(tr('generals.power'))} ${g.power ?? '—'}</span>
        <span class="tag">${esc(tr('common.level'))} ${g.level ?? 1} / ${g.maxLevel ?? '—'}</span>
        ${g.dupes ? `<span class="tag amber">${esc(tr('generals.dupes', { n: g.dupes }))}</span>` : ''}
        ${owned ? `<span class="tag">${esc(g.location.type === 'army' ? tr('generals.army') : g.location.type === 'city' ? tr('generals.city') : tr('generals.reserve'))}</span>` : `<span class="tag red">${esc(tr('common.locked'))}</span>`}
      </div>
      <div class="divider"></div>
      <div class="kicker">${esc(tr('generals.skillSlots'))}</div>
      ${innate ? skillBlock(innate, owned, g) : ''}
      ${slots.map((s, i) => s ? skillBlock({ ...s, slot: i + 1 }, owned, g) : `<div class="slot-empty" style="margin-bottom:6px">${esc(tr('generals.noSkill'))} · ${esc(tr('skills.slot', { n: i + 1 }))} ${owned ? `<button class="btn xs" data-equip-slot="${i + 1}" style="margin-left:8px">${esc(tr('generals.equip'))}</button>` : ''}</div>`).join('')}
      ${owned ? `<div class="row" style="margin-top:8px"><button class="btn xs" data-equip-slot="1">${esc(tr('skills.slot', { n: 1 }))}</button><button class="btn xs" data-equip-slot="2">${esc(tr('skills.slot', { n: 2 }))}</button></div>` : ''}
      <div class="divider"></div>
      <div class="row wrap">
        ${owned ? `<button class="btn primary sm" data-level ${canLevel && state.resources.lumen >= levelCost ? '' : 'disabled'}>${icon('up')} ${esc(tr('generals.levelUp'))} · ${fmt(levelCost)}</button>` : ''}
        ${owned && g.hp < 100 ? `<button class="btn sm" data-heal>${icon('plus')} ${esc(tr('generals.heal'))} · ${(100 - g.hp) * 2} ${esc(tr('resource.umbra'))}</button>` : ''}
        ${owned && g.location.type !== 'army' ? `<button class="btn sm ghost" data-assign>${icon('city')} ${esc(tr('generals.assign'))}</button>` : ''}
        ${owned && g.location.type === 'city' ? `<button class="btn sm ghost" data-unassign>${esc(tr('generals.unassign'))}</button>` : ''}
        ${!owned ? `<span class="mono small muted">${esc(tr('common.locked'))} · ${esc(tr('generals.gacha'))}</span>` : ''}
      </div>
    </div>
  </div>`;
  const m = modal({ title: L(g.name), tag: `${g.rarity} · ${tr('element.' + g.element)}`, body, wide: true, actions: [{ label: tr('common.close'), class: 'ghost' }] });
  const close = m.close;
  // Skill activation buttons
  m.el.querySelectorAll('[data-activate]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const res = await api(`/api/general/${g.id}/activate`, { method: 'POST', body: { skillKey: b.dataset.activate } });
      toast(tr('generals.activateSuccess', { name: L(g.name), skill: L(res.skill.name) }), 'success');
      close(); await afterAction();
    } catch (e) { toast(errorText(e), 'error'); }
  }));
  m.el.querySelectorAll('[data-equip-slot]').forEach((b) => b.addEventListener('click', () => openEquip(g, Number(b.dataset.equipSlot))));
  m.el.querySelectorAll('[data-unequip]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api(`/api/general/${g.id}/unequip`, { method: 'POST', body: { slot: Number(b.dataset.unequip) } });
      toast(tr('common.saved'), 'success'); close(); await afterAction();
    } catch (e) { toast(errorText(e), 'error'); }
  }));
  m.el.querySelector('[data-level]')?.addEventListener('click', async () => {
    try { await api(`/api/general/${g.id}/levelup`, { method: 'POST' }); toast(tr('common.saved'), 'success'); close(); await afterAction(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
  m.el.querySelector('[data-heal]')?.addEventListener('click', async () => {
    try { await api(`/api/general/${g.id}/heal`, { method: 'POST' }); toast(tr('generals.healSuccess', { name: L(g.name) }), 'success'); close(); await afterAction(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
  m.el.querySelector('[data-assign]')?.addEventListener('click', () => openAssign(g));
  m.el.querySelector('[data-unassign]')?.addEventListener('click', async () => {
    try { await api(`/api/city/${g.location.id}/unassign`, { method: 'POST', body: { playerGeneralId: g.id } }); toast(tr('common.saved'), 'success'); close(); await afterAction(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
}

function skillBlock(s, owned, g) {
  const active = s.kind === 'active';
  const cd = s.readyAt ? fmtDuration(s.readyAt - Date.now()) : null;
  return `<div class="gd-skill"><div class="gs-head"><b>${esc(L(s.name))}</b><span class="tag ${active ? 'magenta' : ''}">${esc(active ? tr('generals.active') : tr('generals.passive'))} · Lv.${s.level || 1}</span></div>
    <p>${esc(L(s.desc))}</p>
    <div class="row" style="margin-top:5px">${owned && active ? `<button class="btn xs" data-activate="${esc(s.key)}">${esc(tr('generals.activate'))}</button>` : ''}${owned && s.slot ? `<button class="btn xs ghost" data-unequip="${s.slot}">${esc(tr('generals.unequip'))}</button>` : ''}</div></div>`;
}

async function openEquip(g, slot) {
  const res = await api('/api/skills');
  const available = res.owned.filter((s) => !s.equippedOn || s.equippedOn === g.id);
  modal({
    title: tr('generals.equipTitle', { name: L(g.name) }), tag: tr('skills.slot', { n: slot }), wide: true,
    body: available.length ? `<div class="list" style="border:1px solid var(--line)">${available.map((s) => `<div class="list-row"><div class="lr-main"><div class="lr-title">${esc(L(s.name))}</div><div class="lr-sub">${esc(L(s.desc))}</div></div><span class="tag ${s.rare === 'P' ? 'amber' : 'cyan'}">${esc(s.rare)}</span><span class="mono tiny">Lv.${s.level} ×${s.count}</span><button class="btn xs" data-equip-skill="${s.playerSkillId}">${esc(tr('generals.equip'))}</button></div>`).join('')}</div>` : emptyState(tr('generals.noSkills')),
    actions: [{ label: tr('common.close'), class: 'ghost' }],
    onMount: (m, close) => {
      m.querySelectorAll('[data-equip-skill]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await api(`/api/general/${g.id}/equip`, { method: 'POST', body: { playerSkillId: Number(b.dataset.equipSkill), slot } });
          toast(tr('common.saved'), 'success'); close(); await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      }));
    },
  });
}

async function openAssign(g) {
  const cities = S.state.cities || [];
  modal({
    title: tr('generals.assign'), narrow: true,
    body: cities.map((c) => `<button class="btn wide ghost" data-city="${c.id}" style="justify-content:space-between;margin-bottom:6px">${esc(L(c.name))}<span class="mono tiny">${c.x},${c.y}</span></button>`).join(''),
    actions: [{ label: tr('common.cancel'), class: 'ghost' }],
    onMount: (m, close) => {
      m.querySelectorAll('[data-city]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await api(`/api/city/${b.dataset.city}/assign`, { method: 'POST', body: { playerGeneralId: g.id } });
          toast(tr('generals.assignSuccess', { name: L(g.name), city: '' }), 'success'); close(); await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      }));
    },
  });
}

async function afterAction() {
  await refreshState();
  await load();
}
