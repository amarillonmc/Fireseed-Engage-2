import { S, L, tr, api, refreshState, errorText } from '../core.js';
import {
  esc, icon, facilityIcon, fmt, fmt1, fmtDuration, costHTML, progressBar, modal, toast,
  countdownHTML, timeLeft, emptyState,
} from '../ui.js';

let rootEl = null;
let city = null;
let selected = null;
let refreshTimer = null;
let busy = false;

export async function render(root) {
  rootEl = root;
  if (!S.cityId && S.state?.cities?.length) S.cityId = S.state.cities[0].id;
  await load(true);
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    if (!rootEl || !document.body.contains(rootEl) || busy) return;
    const anyDone = city && (
      (city.construction && timeLeft(city.construction.buildEndsAt) <= 0) ||
      (city.training || []).some((t) => timeLeft(t.finishAt) <= 0)
    );
    if (anyDone) { try { await load(false); } catch { /* noop */ } }
  }, 3000);
  return () => { if (refreshTimer) clearInterval(refreshTimer); rootEl = null; };
}

async function load(resetSelected = false) {
  const res = await api(`/api/city/${S.cityId}`);
  city = res.city;
  if (resetSelected || !selected) selected = null;
  draw();
}

function draw() {
  if (!rootEl || !city) return;
  const state = S.state;
  const cities = state?.cities || [];
  const selectedFac = selected ? city.facilities.find((f) => f.gx === selected.gx && f.gy === selected.gy) : null;
  const isConstruction = city.construction;
  rootEl.innerHTML = `
    <div class="section-title"><div><div class="kicker">${esc(tr('city.subtitle'))}</div><h2>${esc(tr('city.title'))}</h2></div>
      <span class="sub">${cities.length > 1 ? `${cities.length} BASTIONS` : 'CAPITAL RIG'}</span></div>
    <div class="city-layout">
      <div>
        <div class="city-stage">
          <div class="city-stage-inner">
            <div class="city-bar">
              <div>
                <div class="city-name">${esc(L(city.name))}</div>
                <div class="city-coord">GRID ${city.x},${city.y} · GOVERNOR LV.${city.governorLevel} ${city.isCapital ? '· CAPITAL' : ''}</div>
              </div>
              <div class="spacer"></div>
              ${cities.length > 1 ? `<select class="select" id="city-switch" style="width:auto;min-width:160px">${cities.map((c) => `<option value="${c.id}" ${c.id === city.id ? 'selected' : ''}>${esc(L(c.name))}</option>`).join('')}</select>` : ''}
              <button class="btn sm ghost" data-act="rename">${icon('edit')} ${esc(tr('city.rename'))}</button>
            </div>
            <div class="city-grid" id="city-grid">
              ${city.grid.map((cell) => {
                const f = cell.type ? city.facilities.find((x) => x.gx === cell.gx && x.gy === cell.gy) : null;
                const sel = selected && selected.gx === cell.gx && selected.gy === cell.gy;
                return `<div class="cell ${f ? 'facility' : 'empty'} ${f?.type === 'governor' ? 'governor' : ''} ${f && f.status !== 'active' ? 'building' : ''} ${sel ? 'selected' : ''}" data-gx="${cell.gx}" data-gy="${cell.gy}" title="${f ? esc(L(f.name)) + ' Lv.' + f.level : esc(tr('city.emptyCell')) + ' ' + cell.gx + ',' + cell.gy}">
                  ${f ? facilityIcon(f.type) : ''}${f ? `<span class="lv">${f.level}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
            <div class="city-legend">
              <span><i style="--c:var(--lumen)"></i>${esc(tr('facility.extractor_lumen'))}</span>
              <span><i style="--c:var(--ember)"></i>${esc(tr('facility.extractor_ember'))}</span>
              <span><i style="--c:var(--cryo)"></i>${esc(tr('facility.extractor_cryo'))}</span>
              <span><i style="--c:var(--bloom)"></i>${esc(tr('facility.extractor_bloom'))}</span>
              <span><i style="--c:var(--radiance)"></i>${esc(tr('facility.extractor_radiance'))}</span>
              <span><i style="--c:var(--umbra)"></i>${esc(tr('facility.extractor_umbra'))}</span>
              <span class="dim">${esc(tr('city.selectCellHint'))}</span>
            </div>
          </div>
        </div>
        <div class="grid four" style="margin-top:14px">
          <div class="stat-card"><div class="sc-label">${esc(tr('city.durability'))}</div><div class="sc-value">${fmt(city.durability)}</div><div class="sc-sub">/ ${fmt(city.maxDurability)}</div>${progressBar(city.durability, city.maxDurability)}</div>
          <div class="stat-card"><div class="sc-label">${esc(tr('city.troopCap'))}</div><div class="sc-value">${fmt(city.troopCount)}</div><div class="sc-sub">/ ${fmt(city.troopCap)}</div>${progressBar(city.troopCount, city.troopCap, 'amber')}</div>
          <div class="stat-card"><div class="sc-label">${esc(tr('city.storage'))}</div><div class="sc-value">${fmt(city.storageCap)}</div><div class="sc-sub">${esc(tr('city.storage'))} · ${esc(tr('city.buildSpeed'))} ×${fmt1(city.buildSpeed)}</div></div>
          <div class="stat-card accent"><div class="sc-label">${esc(tr('resource.circuit'))}</div><div class="sc-value">${fmt(state.resources.circuit)}</div><div class="sc-sub">/ ${city.circuitCap} · ${esc(tr('generals.costCap'))} ${fmt1(city.generalCostCap)}</div></div>
        </div>
      </div>
      <div class="city-side" id="city-side">${sideHTML(selectedFac)}</div>
    </div>`;

  rootEl.querySelectorAll('.cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      selected = { gx: Number(cell.dataset.gx), gy: Number(cell.dataset.gy) };
      draw();
    });
  });
  rootEl.querySelector('#city-switch')?.addEventListener('change', async (e) => {
    S.cityId = Number(e.target.value);
    selected = null;
    await load(true);
  });
  bindSide();
}

function sideHTML(fac) {
  if (!fac && selected) {
    return `<div class="panel"><div class="panel-head"><h3>${esc(tr('city.buildCatalog'))}</h3><span class="tag">${selected.gx},${selected.gy}</span></div>
      <div class="build-list">${city.catalog.map((item) => buildCard(item, selected)).join('')}</div>
      <div class="notice cyan" style="margin-top:12px">${esc(tr('city.selectCellHint'))}</div></div>${troopPanel()}${generalPanel()}`;
  }
  if (fac) {
    const descKey = `facility.${fac.type}.desc`;
    const desc = tr(descKey) !== descKey ? tr(descKey) : tr('facility.extractor.desc');
    const isBuilding = fac.status !== 'active';
    return `<div class="panel">
      <div class="facility-head"><div class="big-ico">${facilityIcon(fac.type, 'fac-ico')}</div><div><h3>${esc(L(fac.name))}</h3><div class="sub">LV.${fac.level} / ${fac.maxLevel} · ${esc(isBuilding ? tr('city.upgrading') : tr('common.active'))}</div></div></div>
      <p class="small muted" style="margin-top:10px">${esc(desc)}</p>
      ${fac.type === 'governor' ? `<div class="tile-stats"><div class="tile-stat"><span>${esc(tr('resource.circuit'))}</span><b>1 / ${Math.max(1, Math.round(48 / (1 + 0.1 * (fac.level - 1))))}h</b></div><div class="tile-stat"><span>${esc(tr('generals.maxLevel'))}</span><b>${city.maxGeneralLevel}</b></div></div>` : ''}
      ${fac.type.startsWith('extractor_') ? `<div class="tile-stats"><div class="tile-stat"><span>${esc(tr('common.rate'))}</span><b>${fmt1((3600 / 3) * (1 + 0.5 * (fac.level - 1)) * (fac.type === 'extractor_lumen' || fac.type === 'extractor_umbra' ? 0.12 : 1))}${esc(tr('common.perHour'))}</b></div><div class="tile-stat"><span>${esc(tr('common.level'))}</span><b>${fac.level}</b></div></div>` : ''}
      ${isBuilding ? `<div class="queue-bar cyan"><span class="mono small">${esc(tr('city.completeIn'))}</span><b>${countdownHTML(fac.buildEndsAt)}</b><button class="btn xs" data-act="instant" ${S.state.user.tapes ? '' : 'disabled'}>${esc(tr('city.instant'))} (${S.state.user.tapes})</button></div>` : `
        <div class="divider"></div>
        <div class="row between"><span class="mono small muted">${esc(tr('city.upgrade'))} → LV.${fac.level + 1}</span><span class="mono small">${fmtDuration(fac.upgradeSeconds * 1000)}</span></div>
        <div class="cost-row">${costHTML(fac.upgradeCost)}</div>
        <div class="row">
          <button class="btn primary" data-act="upgrade" ${fac.level >= fac.maxLevel || city.construction ? 'disabled' : ''}>${icon('up')} ${esc(tr('city.upgrade'))}</button>
          <button class="btn danger sm" data-act="demolish" ${['governor'].includes(fac.type) ? 'disabled' : ''}>${esc(tr('city.demolish'))}</button>
        </div>`}
      ${trainHTML(fac)}
    </div>${troopPanel()}${generalPanel()}`;
  }
  return `<div class="panel"><div class="panel-head"><h3>${esc(tr('city.selectCell'))}</h3><span class="tag">24×24</span></div><div class="empty-state"><b>${esc(tr('city.title'))}</b>${esc(tr('city.selectCellHint'))}</div></div>
    ${city.construction ? `<div class="panel"><div class="panel-head"><h3>${esc(tr('city.construction'))}</h3><span class="tag amber">${esc(L(city.construction.name))}</span></div><div class="row between"><span class="mono small">LV.${city.construction.upgradeTo || city.construction.level}</span>${countdownHTML(city.construction.buildEndsAt)}</div></div>` : ''}
    ${troopPanel()}${generalPanel()}`;
}

function buildCard(item, cell) {
  const cost = item.cost;
  const afford = Object.entries(cost).every(([k, v]) => (S.state.resources[k] || 0) >= v);
  const disabled = !item.allowed || (item.unique && item.existing > 0) || !afford || city.construction;
  return `<button class="build-card ${disabled ? 'disabled' : ''}" data-build="${item.type}" ${disabled ? 'disabled' : ''}>
    <div class="bc-ico">${facilityIcon(item.type, 'bc-ico')}</div>
    <b>${esc(L(item.name))}</b>
    <span>${item.unique ? esc(tr('city.unique')) : `${item.existing} ${esc(tr('city.existing'))}`} · ${fmtDuration(item.seconds * 1000)}</span>
    <div class="cost-row">${costHTML(cost)}</div>
  </button>`;
}

function trainHTML(fac) {
  const units = unitOptions(fac.type);
  if (!units.length) return '';
  return `<div class="divider"></div><div class="panel-head" style="margin-bottom:8px"><h3>${esc(tr('city.train'))}</h3><span class="tag">${esc(L(fac.name))}</span></div>
    <div class="unit-grid">${units.map((u) => `<div class="unit-card"><b>${esc(L(u.name))}</b><p>${esc(L(u.desc))}</p><div class="uc-stats"><span>ATK ${u.atk}</span><span>DEF ${u.def}</span><span>SPD ${u.speed}s</span><span>SIEGE ${u.siege}</span></div><div class="cost-row">${costHTML(u.cost)}</div><button class="btn xs" data-train="${u.key}">${esc(tr('city.train'))}</button></div>`).join('')}</div>
    ${city.training.length ? `<div class="queue-bar" style="margin-top:10px"><span class="mono small">${esc(tr('city.trainQueue'))}</span><b>${city.training.map((t) => `${t.total}× ${esc(L(t.unitName))}`).join(', ')}</b><span class="spacer"></span>${countdownHTML(city.training[0].finishAt)}</div>` : `<div class="mono tiny muted" style="margin-top:8px">${esc(tr('city.noTrainQueue'))}</div>`}`;
}

function unitOptions(facType) {
  const units = S.boot.meta.units;
  const keys = facType === 'barracks' ? ['pawn', 'knight', 'rook', 'bishop'] : facType === 'workshop' ? ['golem'] : facType === 'watchtower' ? ['scout'] : [];
  return keys.map((k) => units[k]).filter(Boolean);
}

function troopPanel() {
  const entries = Object.entries(city.troops);
  return `<div class="panel"><div class="panel-head"><h3>${esc(tr('city.troops'))}</h3><span class="tag">${fmt(city.troopCount)} / ${fmt(city.troopCap)}</span></div>
    ${entries.length ? entries.map(([unit, v]) => `<div class="troop-row"><div class="tr-name">${icon('army', 'ico')}<b>${esc(L(S.boot.meta.units[unit]?.name))}</b><span class="tag">Lv.${v.level}</span></div><span class="tr-count">${fmt(v.count)}</span></div>`).join('') : `<div class="empty-state">${esc(tr('city.noTroops'))}</div>`}
    ${city.training.length ? `<div class="queue-bar" style="margin-top:8px"><span class="mono small">${esc(tr('city.trainQueue'))}</span><span class="spacer"></span>${countdownHTML(city.training[0].finishAt)}</div>` : ''}
  </div>`;
}

function generalPanel() {
  return `<div class="panel"><div class="panel-head"><h3>${esc(tr('city.generals'))}</h3><button class="btn xs" data-act="assign">${icon('plus')} ${esc(tr('city.assignGeneral'))}</button></div>
    ${city.generals.length ? city.generals.map((g) => `<div class="troop-row"><div class="tr-name"><span class="vc-rarity rarity-${g.rarity}" style="min-width:22px;height:20px;font-size:10px">${esc(g.rarity)}</span><div><b>${esc(L(g.name))}</b><div class="mono tiny muted">LV.${g.level} · ${esc(tr('common.power'))} ${g.power}</div></div></div><button class="btn xs ghost" data-unassign="${g.id}">${esc(tr('city.unassign'))}</button></div>`).join('') : `<div class="empty-state">${esc(tr('city.noGenerals'))}</div>`}
  </div>`;
}

function bindSide() {
  const side = rootEl.querySelector('#city-side');
  if (!side) return;
  side.querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => {
    const item = city.catalog.find((x) => x.type === b.dataset.build);
    if (item) openBuild(item);
  }));
  side.querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => {
    const fac = selected && city.facilities.find((f) => f.gx === selected.gx && f.gy === selected.gy);
    const unit = S.boot.meta.units[b.dataset.train];
    if (fac && unit) openTrain(fac, unit);
  }));
  side.querySelectorAll('[data-unassign]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/city/${city.id}/unassign`, { method: 'POST', body: { playerGeneralId: Number(b.dataset.unassign) } }); toast(tr('common.saved'), 'success'); await afterAction(); }
    catch (e) { toast(errorText(e), 'error'); }
  }));
  side.querySelector('[data-act="upgrade"]')?.addEventListener('click', () => upgradeSelected());
  side.querySelector('[data-act="demolish"]')?.addEventListener('click', () => demolishSelected());
  side.querySelector('[data-act="instant"]')?.addEventListener('click', () => instant());
  side.querySelector('[data-act="assign"]')?.addEventListener('click', () => openAssign());
  rootEl.querySelector('[data-act="rename"]')?.addEventListener('click', () => openRename());
}

async function afterAction() {
  busy = true;
  try {
    await load(false);
    await refreshState();
    const host = document.getElementById('resource-host');
    if (host && S.state) host.innerHTML = (await import('../ui.js')).resourceStrip(S.state);
  } finally { busy = false; }
}

function afford(cost) {
  return Object.entries(cost).every(([k, v]) => (S.state.resources[k] || 0) >= v);
}

function openBuild(item) {
  if (city.construction) { toast(tr('error.construction_busy'), 'warn'); return; }
  modal({
    title: tr('city.buildTitle', { name: L(item.name) }), tag: `${selected.gx},${selected.gy}`,
    body: `<div class="facility-head"><div class="big-ico">${facilityIcon(item.type, 'fac-ico')}</div><div><h3>${esc(L(item.name))}</h3><div class="sub">${esc(tr('common.level'))} 1 · ${fmtDuration(item.seconds * 1000)}</div></div></div>
      <p class="small muted">${esc(tr(`facility.${item.type}.desc`) !== `facility.${item.type}.desc` ? tr(`facility.${item.type}.desc`) : '')}</p>
      <div class="cost-row">${costHTML(item.cost)}</div>
      ${!afford(item.cost) ? `<div class="notice">${esc(tr('error.insufficient_resources'))}</div>` : ''}`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('city.build'), class: 'primary', disabled: !afford(item.cost), onClick: async (close) => {
        try {
          await api(`/api/city/${city.id}/build`, { method: 'POST', body: { type: item.type, ...selected } });
          toast(tr('city.buildSuccess', { name: L(item.name) }), 'success');
          await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function upgradeSelected() {
  const fac = city.facilities.find((f) => f.gx === selected.gx && f.gy === selected.gy);
  if (!fac) return;
  if (!afford(fac.upgradeCost)) { toast(tr('error.insufficient_resources'), 'warn'); return; }
  try {
    await api(`/api/city/${city.id}/upgrade`, { method: 'POST', body: { facilityId: fac.id } });
    toast(tr('city.upgradeSuccess', { name: L(fac.name) }), 'success');
    await afterAction();
  } catch (e) { toast(errorText(e), 'error'); }
}

async function demolishSelected() {
  const fac = city.facilities.find((f) => f.gx === selected.gx && f.gy === selected.gy);
  if (!fac) return;
  const ok = await (await import('../ui.js')).confirmDialog(tr('city.demolishConfirm', { name: L(fac.name) }), { danger: true });
  if (!ok) return;
  try {
    await api(`/api/city/${city.id}/demolish`, { method: 'POST', body: { facilityId: fac.id } });
    toast(tr('common.saved'), 'success'); selected = null; await afterAction();
  } catch (e) { toast(errorText(e), 'error'); }
}

async function instant() {
  try {
    await api(`/api/city/${city.id}/instant`, { method: 'POST' });
    toast(tr('common.saved'), 'success'); await afterAction();
  } catch (e) { toast(errorText(e), 'error'); }
}

function openTrain(fac, unit) {
  const remaining = Math.max(0, city.troopCap - city.troopCount);
  modal({
    title: tr('city.trainTitle', { name: L(unit.name) }), tag: L(fac.name), narrow: true,
    body: `<div class="field"><label>${esc(tr('city.trainCount'))} <span>${esc(tr('common.max'))} ${remaining}</span></label><input class="input" id="train-count" type="number" min="1" max="${Math.max(1, remaining)}" value="1"></div>
      <div class="row between"><span class="mono small">${esc(tr('city.trainTime'))}</span><b class="mono" id="train-time">—</b></div>
      <div class="cost-row" id="train-cost"></div>
      <div class="notice cyan" style="margin-top:8px">${esc(L(unit.desc))}</div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('city.train'), class: 'primary', onClick: async (close) => {
        const n = Math.max(1, Math.floor(Number(document.getElementById('train-count').value || 1)));
        try {
          const res = await api(`/api/city/${city.id}/train`, { method: 'POST', body: { unit: unit.key, count: n } });
          toast(tr('city.trainSuccess', { n, name: L(unit.name) }), 'success');
          await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
    onMount: (m) => {
      const input = m.querySelector('#train-count');
      const update = () => {
        const n = Math.max(1, Math.floor(Number(input.value || 1)));
        const cost = {};
        for (const [k, v] of Object.entries(unit.cost)) cost[k] = v * n;
        m.querySelector('#train-time').textContent = fmtDuration((n * unit.trainSeconds / 20) * 1000);
        m.querySelector('#train-cost').innerHTML = costHTML(cost);
      };
      input.addEventListener('input', update); update();
    },
  });
}

async function openAssign() {
  const data = await api('/api/generals');
  const eligible = data.owned.filter((g) => g.location.type !== 'army');
  modal({
    title: tr('city.assignGeneral'), tag: L(city.name), wide: true,
    body: eligible.length ? `<div class="card-grid">${eligible.map((g) => `<div data-assign-g="${g.id}">${requireCard(g)}</div>`).join('')}</div>` : `<div class="empty-state"><b>NO VANGUARDS</b></div>`,
    actions: [{ label: tr('common.close'), class: 'ghost' }],
    onMount: (m, close) => {
      m.querySelectorAll('[data-assign-g]').forEach((el) => el.addEventListener('click', async () => {
        try {
          await api(`/api/city/${city.id}/assign`, { method: 'POST', body: { playerGeneralId: Number(el.dataset.assignG) } });
          toast(tr('city.assignSuccess', { name: 'Vanguard' }), 'success');
          close(); await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      }));
    },
  });
}

function requireCard(g) {
  // Local import avoided: use the shared card markup through a tiny inline template.
  return `<div class="panel flat" style="padding:0"><div class="vcard rarity-${g.rarity} el-${g.element}" style="aspect-ratio:3/4">
    <div class="vcard-face vcard-front"><div class="vc-art" style="background-image:url('${esc(g.artUrl)}')"></div><div class="vc-top"><span class="vc-rarity">${esc(g.rarity)}</span><span class="vc-cost">C ${fmt1(g.cost)}</span></div>
    <div class="vc-bottom"><div class="vc-name">${esc(L(g.name))}</div><div class="vc-title">${esc(L(g.title))}</div><div class="vc-meta"><span class="vc-element">${esc(tr('common.level'))} ${g.level}</span><span class="vc-lv">HP ${g.hp}</span></div></div></div></div></div>`;
}

function openRename() {
  modal({
    title: tr('city.renameTitle'), narrow: true,
    body: `<div class="field"><label>${esc(tr('admin.generalNameZh'))}</label><input class="input" id="rn-zh" value="${esc(city.name.zh)}" maxlength="24"></div>
      <div class="field"><label>${esc(tr('admin.generalNameEn'))}</label><input class="input" id="rn-en" value="${esc(city.name.en)}" maxlength="36"></div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('common.save'), class: 'primary', onClick: async () => {
        try {
          await api(`/api/city/${city.id}/rename`, { method: 'POST', body: { nameZh: document.getElementById('rn-zh').value, nameEn: document.getElementById('rn-en').value } });
          toast(tr('city.renameSuccess'), 'success'); await afterAction();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}
