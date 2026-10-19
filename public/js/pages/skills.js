import { S, L, tr, api, refreshState, errorText } from '../core.js';
import { esc, icon, skillCardHTML, fmt, fmt1, modal, toast, emptyState } from '../ui.js';
import { showGacha } from './generals.js';

let rootEl = null;
let data = null;
let tab = 'owned';
let cleanupFns = [];

export async function render(root) {
  rootEl = root;
  await load();
  return () => { cleanupFns.forEach((f) => f()); cleanupFns = []; rootEl = null; };
}

async function load() {
  data = await api('/api/skills');
  draw();
}

function draw() {
  if (!rootEl || !data) return;
  const state = S.state;
  const costs = state.settings;
  const rates = costs.gachaRates || {};
  const list = tab === 'owned' ? data.owned : data.catalog;
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('skills.subtitle'))}</div><h2>${esc(tr('skills.title'))}</h2></div><span class="sub">${data.owned.length} / ${data.catalog.length} PROTOCOLS</span></div>
    <div class="gacha-banner" style="margin-bottom:18px">
      <div><div class="kicker">PROTOCOL POOL / UMBRA ONLY</div><h3>${esc(tr('generals.gachaSkill'))}</h3><p>${esc(tr('generals.gachaSkillDesc'))}</p>
        <div class="rates">${Object.entries(rates).map(([r, v]) => `<span class="rate" style="color:var(--rc)">${r} ${v}%</span>`).join('')}</div></div>
      <div class="col" style="gap:8px;min-width:220px">
        <button class="btn primary" data-sgacha="1" ${state.resources.umbra < costs.gachaSkill ? 'disabled' : ''}>${icon('skill')} ${esc(tr('generals.skillOne', { n: costs.gachaSkill }))}</button>
        <button class="btn magenta" data-sgacha="10" ${state.resources.umbra < costs.gachaSkillTen ? 'disabled' : ''}>${icon('skill')} ${esc(tr('generals.skillTen', { n: costs.gachaSkillTen }))}</button>
        <div class="mono tiny muted">${esc(tr('skills.innateNote'))}</div>
      </div>
    </div>
    <div class="tabs"><button class="${tab === 'owned' ? 'active' : ''}" data-tab="owned">${esc(tr('skills.owned'))}</button><button class="${tab === 'catalog' ? 'active' : ''}" data-tab="catalog">${esc(tr('skills.catalog'))}</button></div>
    ${list.length ? `<div class="research-grid">${list.map((s) => tab === 'owned' ? `<div data-psid="${s.playerSkillId}">${skillCardHTML(s)}</div>` : skillCardHTML(s)).join('')}</div>` : emptyState(tr('common.empty'))}`;
  bind();
}

function bind() {
  rootEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
  rootEl.querySelectorAll('[data-psid]').forEach((el) => el.addEventListener('click', () => {
    const s = data.owned.find((x) => x.playerSkillId === Number(el.dataset.psid));
    if (s) openDetail(s);
  }));
  rootEl.querySelectorAll('[data-sgacha]').forEach((b) => b.addEventListener('click', () => doGacha(Number(b.dataset.sgacha), b)));
}

async function doGacha(times, btn) {
  btn.disabled = true;
  try {
    const res = await api('/api/gacha/skill', { method: 'POST', body: { times } });
    showGacha(res, 'skill');
    await refreshState(); await load();
  } catch (e) { toast(errorText(e), 'error'); btn.disabled = false; }
}

function openDetail(s) {
  const canUpgrade = s.level < s.maxLevel && s.count > s.level;
  modal({
    title: L(s.name), tag: `${s.rare} · ${s.kind === 'active' ? tr('generals.active') : tr('generals.passive')}`, wide: false,
    body: `<div class="kicker">${esc(tr('element.' + s.element))}</div>
      <p style="color:#b9d7e2;font-size:12px;line-height:1.7">${esc(L(s.desc))}</p>
      <div class="tile-stats"><div class="tile-stat"><span>${esc(tr('common.level'))}</span><b>${s.level} / ${s.maxLevel}</b></div><div class="tile-stat"><span>${esc(tr('skills.count'))}</span><b>${s.count}</b></div></div>
      <div class="pips">${Array.from({ length: s.maxLevel }, (_, i) => `<i class="${i < s.level ? 'on' : ''}"></i>`).join('')}</div>
      <div class="notice cyan">${esc(tr('skills.levelCost', { need: s.level + 1, n: 20 * s.level }))}</div>
      ${s.equippedOn ? `<div class="mono tiny muted" style="margin-top:6px">${esc(tr('skills.equippedOn', { id: s.equippedOn }))}</div>` : ''}`,
    actions: [
      { label: tr('common.close'), class: 'ghost' },
      { label: tr('skills.equip'), class: 'primary', close: false, onClick: () => openEquip(s) },
      { label: tr('skills.levelUp'), class: canUpgrade ? 'magenta' : '', disabled: !canUpgrade, onClick: async () => {
        try { await api(`/api/skills/${s.playerSkillId}/levelup`, { method: 'POST' }); toast(tr('common.saved'), 'success'); await afterAction(); }
        catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function openEquip(s) {
  const collection = await api('/api/generals');
  const owned = collection.owned.filter((g) => g.location?.type !== 'army');
  modal({
    title: tr('skills.equip'), tag: L(s.name), wide: true,
    body: owned.length ? `<div class="list" style="border:1px solid var(--line)">${owned.map((g) => `<div class="list-row"><div class="lr-main"><div class="lr-title">${esc(L(g.name))} <span class="tag">${g.rarity}</span></div><div class="lr-sub">Lv.${g.level} · ${esc(tr('common.cost'))} ${fmt1(g.cost)}</div></div><button class="btn xs" data-eq="${g.id}" data-slot="1">${esc(tr('skills.slot', { n: 1 }))}</button><button class="btn xs" data-eq="${g.id}" data-slot="2">${esc(tr('skills.slot', { n: 2 }))}</button></div>`).join('')}</div>` : emptyState(tr('common.empty')),
    actions: [{ label: tr('common.close'), class: 'ghost' }],
    onMount: (m, close) => {
      m.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await api(`/api/general/${b.dataset.eq}/equip`, { method: 'POST', body: { playerSkillId: s.playerSkillId, slot: Number(b.dataset.slot) } });
          toast(tr('common.saved'), 'success'); close(); await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      }));
    },
  });
}

async function afterAction() {
  await refreshState();
  await load();
}
