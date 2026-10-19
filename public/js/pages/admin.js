import { S, L, tr, api, errorText } from '../core.js';
import { esc, icon, fmt, fmt1, fmtDuration, modal, toast, emptyState, timeAgo, costHTML } from '../ui.js';

let rootEl = null;
let tab = 'overview';
let cache = {};

const TABS = [
  ['overview', 'admin.overview', 'grid'],
  ['users', 'admin.users', 'profile'],
  ['generals', 'admin.generals', 'general'],
  ['skills', 'admin.skills', 'skill'],
  ['season', 'admin.season', 'clock'],
  ['settings', 'admin.settings', 'gear'],
  ['announcements', 'admin.announcements', 'report'],
  ['audit', 'admin.audit', 'shield'],
  ['movements', 'admin.movements', 'army'],
];

export async function render(root, opts = {}) {
  rootEl = root;
  tab = opts.sub || S.adminTab || 'overview';
  rootEl.innerHTML = `<div class="admin-head"><div><div class="kicker">${esc(tr('admin.subtitle'))}</div><h1>${esc(tr('admin.title'))}</h1></div><a class="btn sm ghost" href="#/city">${icon('city')} ${esc(tr('admin.back'))}</a></div>
    <div class="admin-shell">
      <nav class="admin-nav">${TABS.map(([k, label, ic]) => `<a href="#/admin/${k}" class="${tab === k ? 'active' : ''}">${icon(ic)}<span>${esc(tr(label))}</span></a>`).join('')}</nav>
      <div id="admin-body"><div class="loading"><i></i>${esc(tr('common.loading'))}</div></div>
    </div>`;
  await drawTab();
  return () => { rootEl = null; };
}

async function drawTab() {
  const body = rootEl?.querySelector('#admin-body');
  if (!body) return;
  body.innerHTML = `<div class="loading"><i></i>${esc(tr('common.loading'))}</div>`;
  try {
    if (tab === 'overview') await drawOverview(body);
    else if (tab === 'users') await drawUsers(body);
    else if (tab === 'generals') await drawGenerals(body);
    else if (tab === 'skills') await drawSkills(body);
    else if (tab === 'season') await drawSeason(body);
    else if (tab === 'settings') await drawSettings(body);
    else if (tab === 'announcements') await drawAnnouncements(body);
    else if (tab === 'audit') await drawAudit(body);
    else if (tab === 'movements') await drawMovements(body);
  } catch (e) {
    body.innerHTML = `<div class="panel"><div class="empty-state"><b>ERROR</b>${esc(errorText(e))}</div></div>`;
  }
}

async function drawOverview(body) {
  const d = await api('/api/admin/overview');
  const maxCharter = Math.max(1, ...(d.charters || []).map((c) => c.c));
  body.innerHTML = `<div class="grid four">
    ${[['users', d.counts.users], ['online', d.counts.online], ['cities', d.counts.cities], ['tiles', d.counts.ownedTiles], ['movements', d.counts.movements], ['generals', d.counts.generals], ['battles', d.counts.battles], ['bots', d.counts.bots]].map(([k, v]) => `<div class="stat-card"><div class="sc-label">${esc(tr('admin.counts.' + k))}</div><div class="sc-value">${fmt(v)}</div></div>`).join('')}
  </div>
  <div class="grid two" style="margin-top:16px">
    <div class="panel"><div class="panel-head"><h3>${esc(tr('admin.seasonActive'))}</h3><span class="tag ${d.season?.status === 'active' ? 'green' : 'red'}">${esc(d.season?.status || '—')}</span></div>
      ${d.season ? `<div style="font-family:var(--font-display);font-size:22px">S${String(d.season.number).padStart(2, '0')} · ${esc(L({ zh: d.season.name_zh, en: d.season.name_en }))}</div><div class="mono tiny muted">START ${new Date(d.season.started_at).toLocaleString()}</div>` : `<div class="empty-state">NO ACTIVE SEASON</div>`}
      <div class="divider"></div><div class="row wrap"><a class="btn sm" href="#/admin/season">${icon('clock')} ${esc(tr('admin.season'))}</a></div>
    </div>
    <div class="panel"><div class="panel-head"><h3>${esc(tr('admin.charters'))}</h3><span class="tag">6</span></div><div class="chart-bars">${d.charters.map((c) => `<div class="chart-bar"><span>${esc(tr('charter.' + c.charter))}</span><div class="bar"><i style="width:${c.c / maxCharter * 100}%"></i></div><span>${c.c}</span></div>`).join('')}</div></div>
  </div>
  <div class="grid two" style="margin-top:16px">
    <div class="panel"><div class="panel-head"><h3>${esc(tr('admin.economy'))}</h3><span class="tag">TOTAL</span></div><div class="grid two">${Object.entries(d.economy).map(([k, v]) => `<div class="tile-stat"><span>${esc(tr('resource.' + k))}</span><b>${fmt(v)}</b></div>`).join('')}</div></div>
    <div class="panel"><div class="panel-head"><h3>${esc(tr('admin.top'))}</h3><span class="tag">POWER</span></div><table class="table"><tbody>${d.top.map((u) => `<tr><td class="pname"><span class="mini-avatar">${esc(u.display_name.slice(0, 1))}</span><b>${esc(u.display_name)}</b></td><td class="mono">${fmt(u.power)}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>${esc(tr('admin.recentAudit'))}</h3><a class="tag" href="#/admin/audit">${esc(tr('admin.auditLog'))}</a></div><table class="table"><tbody>${d.recentAudit.map((a) => `<tr><td class="mono tiny">${timeAgo(a.created_at)}</td><td class="mono tiny">${esc(a.admin_name || 'system')}</td><td>${esc(a.action)}</td><td class="mono tiny muted">${esc(a.target || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

async function drawUsers(body) {
  const d = await api('/api/admin/users');
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.users'))}</h3><div class="row"><input class="input sm" id="user-search" placeholder="${esc(tr('admin.searchUser'))}" style="width:240px"><button class="btn xs" id="user-search-btn">${esc(tr('common.search'))}</button></div></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>${esc(tr('common.name'))}</th><th>${esc(tr('admin.role'))}</th><th>${esc(tr('common.status'))}</th><th>${esc(tr('common.power'))}</th><th>${esc(tr('resource.lumen'))}</th><th>${esc(tr('resource.umbra'))}</th><th>${esc(tr('admin.lastLogin'))}</th><th>${esc(tr('common.actions'))}</th></tr></thead><tbody>
      ${d.users.map((u) => `<tr><td class="mono">${u.id}</td><td><div class="pname"><span class="mini-avatar">${esc(u.displayName.slice(0, 1))}</span><div><b>${esc(u.displayName)}</b><div class="mono tiny muted">@${esc(u.username)}</div></div>${u.isBot ? `<span class="tag">BOT</span>` : ''}</div></td><td><span class="tag ${u.role === 'admin' ? 'amber' : ''}">${esc(u.role)}</span></td><td><span class="tag ${u.status === 'active' ? 'green' : 'red'}">${esc(u.status)}</span></td><td class="mono">${fmt(u.power)}</td><td class="mono">${fmt(u.lumen)}</td><td class="mono">${fmt(u.umbra)}</td><td class="mono tiny">${u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</td><td><div class="actions"><button class="btn xs" data-user="${u.id}">${esc(tr('common.details'))}</button></div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const search = async () => {
    const q = body.querySelector('#user-search').value.trim();
    try { const r = await api(`/api/admin/users?q=${encodeURIComponent(q)}`); body.querySelector('tbody').innerHTML = r.users.map((u) => `<tr><td class="mono">${u.id}</td><td><div class="pname"><span class="mini-avatar">${esc(u.displayName.slice(0, 1))}</span><div><b>${esc(u.displayName)}</b><div class="mono tiny muted">@${esc(u.username)}</div></div>${u.isBot ? `<span class="tag">BOT</span>` : ''}</div></td><td>${esc(u.role)}</td><td>${esc(u.status)}</td><td class="mono">${fmt(u.power)}</td><td class="mono">${fmt(u.lumen)}</td><td class="mono">${fmt(u.umbra)}</td><td class="mono tiny">${u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</td><td><button class="btn xs" data-user="${u.id}">${esc(tr('common.details'))}</button></td></tr>`).join(''); bindUserButtons(body); } catch (e) { toast(errorText(e), 'error'); }
  };
  body.querySelector('#user-search-btn')?.addEventListener('click', search);
  body.querySelector('#user-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
  bindUserButtons(body);
}

function bindUserButtons(body) {
  body.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => openUser(Number(b.dataset.user))));
}

async function openUser(id) {
  const d = await api(`/api/admin/users/${id}`);
  const u = d.user;
  modal({
    title: `${u.display_name} · @${u.username}`, tag: `ID ${u.id}`, wide: true,
    body: `<div class="grid two" style="gap:16px">
      <div>
        <div class="admin-form">
          <div class="field"><label>${esc(tr('common.displayName'))}</label><input class="input" id="au-name" value="${esc(u.display_name)}"></div>
          <div class="field"><label>${esc(tr('admin.role'))}</label><select class="select" id="au-role"><option value="player" ${u.role === 'player' ? 'selected' : ''}>${esc(tr('admin.rolePlayer'))}</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>${esc(tr('admin.roleAdmin'))}</option></select></div>
          <div class="field"><label>${esc(tr('common.status'))}</label><select class="select" id="au-status"><option value="active" ${u.status === 'active' ? 'selected' : ''}>${esc(tr('admin.statusActive'))}</option><option value="banned" ${u.status === 'banned' ? 'selected' : ''}>${esc(tr('admin.statusBanned'))}</option></select></div>
          <div class="field"><label>${esc(tr('admin.newPassword'))}</label><input class="input" id="au-pass" placeholder="leave blank"></div>
          <div class="field full"><label>${esc(tr('admin.grant'))}</label><div class="row"><select class="select" id="au-currency" style="width:150px">${['lumen', 'umbra', 'circuit', 'ember', 'cryo', 'bloom', 'radiance', 'tapes'].map((k) => `<option value="${k}">${esc(tr('resource.' + k) === 'resource.' + k ? k : tr('resource.' + k))}</option>`).join('')}</select><input class="input" id="au-amount" type="number" value="100" style="width:120px"><button class="btn sm" id="au-grant">${esc(tr('admin.grant'))}</button></div></div>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn primary" id="au-save">${esc(tr('admin.saveUser'))}</button><button class="btn danger sm" id="au-ban">${esc(tr('admin.ban'))}</button><button class="btn ghost sm" id="au-reset">${esc(tr('admin.resetPassword'))}</button></div>
      </div>
      <div>
        <div class="tile-stats"><div class="tile-stat"><span>POWER</span><b>${fmt(d.power)}</b></div><div class="tile-stat"><span>${esc(tr('resource.lumen'))}</span><b>${fmt(u.lumen)}</b></div><div class="tile-stat"><span>${esc(tr('resource.umbra'))}</span><b>${fmt(u.umbra)}</b></div><div class="tile-stat"><span>${esc(tr('resource.circuit'))}</span><b>${u.circuit}</b></div></div>
        <div class="mono tiny muted">CITIES ${d.cities.length} · GENERALS ${d.generals.length} · TECHS ${d.techs.length}</div>
        <div class="divider"></div>
        <div class="kicker">CITIES</div>${d.cities.map((c) => `<div class="list-row"><div class="lr-main"><div class="lr-title">${esc(c.name_en)}</div><div class="lr-sub">${c.x},${c.y} · LV.${c.governor_level}</div></div></div>`).join('') || '<div class="mono tiny muted">—</div>'}
        <div class="divider"></div><div class="kicker">VANGUARDS</div><div class="row wrap">${d.generals.map((g) => `<span class="tag">${esc(g.name_en)} ${g.rarity}</span>`).join('') || '—'}</div>
      </div>
    </div>`,
    actions: [{ label: tr('common.close'), class: 'ghost' }],
    onMount: (m, close) => {
      m.querySelector('#au-save')?.addEventListener('click', async () => {
        try {
          await api(`/api/admin/users/${id}`, { method: 'POST', body: { displayName: m.querySelector('#au-name').value, role: m.querySelector('#au-role').value, status: m.querySelector('#au-status').value, password: m.querySelector('#au-pass').value || undefined } });
          toast(tr('admin.saved'), 'success'); close(); drawTab();
        } catch (e) { toast(errorText(e), 'error'); }
      });
      m.querySelector('#au-grant')?.addEventListener('click', async () => {
        try {
          await api(`/api/admin/users/${id}/grant`, { method: 'POST', body: { currency: m.querySelector('#au-currency').value, amount: Number(m.querySelector('#au-amount').value) } });
          toast(tr('admin.granted'), 'success');
        } catch (e) { toast(errorText(e), 'error'); }
      });
      m.querySelector('#au-ban')?.addEventListener('click', async () => {
        try { await api(`/api/admin/users/${id}`, { method: 'POST', body: { status: u.status === 'active' ? 'banned' : 'active' } }); toast(tr('admin.saved'), 'success'); close(); drawTab(); }
        catch (e) { toast(errorText(e), 'error'); }
      });
      m.querySelector('#au-reset')?.addEventListener('click', async () => {
        try { const r = await api(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: {} }); toast(tr('admin.resetDone', { password: r.password }), 'success'); }
        catch (e) { toast(errorText(e), 'error'); }
      });
    },
  });
}

async function drawGenerals(body) {
  const d = await api('/api/admin/generals');
  cache.generals = d;
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.generals'))}</h3><button class="btn sm primary" id="gen-new">${icon('plus')} ${esc(tr('admin.generalNew'))}</button></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>KEY</th><th>${esc(tr('common.name'))}</th><th>RAR</th><th>EL</th><th>COST</th><th>ATK/DEF/SPD/INT</th><th>POOL</th><th>${esc(tr('common.status'))}</th><th>${esc(tr('common.actions'))}</th></tr></thead><tbody>
      ${d.generals.map((g) => `<tr><td class="mono">${g.id}</td><td class="mono tiny">${esc(g.key)}</td><td><div class="lr-title">${esc(g.name_zh)} <span class="muted">/ ${esc(g.name_en)}</span></div><div class="mono tiny muted">${esc(g.title_en)}</div></td><td><span class="tag">${g.rarity}</span></td><td>${esc(g.element)}</td><td class="mono">${fmt1(g.cost)}</td><td class="mono tiny">${g.base_atk}/${g.base_def}/${g.base_spd}/${g.base_int}</td><td class="mono">${g.pool_weight}</td><td><span class="tag ${g.enabled ? 'green' : 'red'}">${g.enabled ? 'ON' : 'OFF'}</span></td><td><div class="actions"><button class="btn xs" data-gen="${g.id}">${esc(tr('common.edit'))}</button><button class="btn xs ghost" data-gclone="${g.id}">${esc(tr('common.clone'))}</button><button class="btn xs danger" data-gdel="${g.id}">${esc(tr('common.delete'))}</button></div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  body.querySelector('#gen-new')?.addEventListener('click', () => openGeneralForm(null));
  body.querySelectorAll('[data-gen]').forEach((b) => b.addEventListener('click', () => openGeneralForm(d.generals.find((g) => g.id === Number(b.dataset.gen)))));
  body.querySelectorAll('[data-gclone]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/admin/generals/${b.dataset.gclone}/clone`, { method: 'POST' }); toast(tr('admin.saved'), 'success'); drawTab(); }
    catch (e) { toast(errorText(e), 'error'); }
  }));
  body.querySelectorAll('[data-gdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(tr('admin.confirmDelete'))) return;
    try { await api(`/api/admin/generals/${b.dataset.gdel}/delete`, { method: 'POST' }); toast(tr('admin.saved'), 'success'); drawTab(); }
    catch (e) { toast(errorText(e), 'error'); }
  }));
}

function openGeneralForm(g) {
  const isNew = !g;
  const skills = cache.generals.skills;
  const d = g || { key: '', name_zh: '', name_en: '', title_zh: '', title_en: '', source: 'Custom', source_ref: '', rarity: 'S', cost: 3, element: 'lumen', base_atk: 50, base_def: 50, base_spd: 50, base_int: 50, art_url: '', innate_skill_id: null, pool_weight: 100, enabled: 1, lore_zh: '', lore_en: '' };
  modal({
    title: isNew ? tr('admin.generalNew') : `${tr('admin.generalEdit')} #${g.id}`, tag: isNew ? 'CREATE' : 'EDIT', wide: true,
    body: `<div class="admin-form">
      <div class="field"><label>${esc(tr('admin.generalKey'))}</label><input class="input" id="gf-key" value="${esc(d.key)}" ${isNew ? '' : 'disabled'}></div>
      <div class="field"><label>${esc(tr('admin.generalWeight'))}</label><input class="input" id="gf-weight" type="number" value="${d.pool_weight}"></div>
      <div class="field"><label>${esc(tr('admin.generalNameZh'))}</label><input class="input" id="gf-name-zh" value="${esc(d.name_zh)}"></div>
      <div class="field"><label>${esc(tr('admin.generalNameEn'))}</label><input class="input" id="gf-name-en" value="${esc(d.name_en)}"></div>
      <div class="field"><label>${esc(tr('admin.generalTitleZh'))}</label><input class="input" id="gf-title-zh" value="${esc(d.title_zh)}"></div>
      <div class="field"><label>${esc(tr('admin.generalTitleEn'))}</label><input class="input" id="gf-title-en" value="${esc(d.title_en)}"></div>
      <div class="field"><label>SOURCE</label><input class="input" id="gf-source" value="${esc(d.source || 'Custom')}"></div>
      <div class="field"><label>SOURCE REF</label><input class="input" id="gf-source-ref" value="${esc(d.source_ref || '')}"></div>
      <div class="field"><label>RARITY</label><select class="select" id="gf-rarity">${['B', 'A', 'S', 'SS', 'P'].map((r) => `<option ${d.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>ELEMENT</label><select class="select" id="gf-element">${['lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'].map((e) => `<option value="${e}" ${d.element === e ? 'selected' : ''}>${esc(tr('element.' + e))}</option>`).join('')}</select></div>
      <div class="field"><label>COST</label><input class="input" id="gf-cost" type="number" step="0.5" min="1" max="4" value="${d.cost}"></div>
      <div class="field"><label>ATK</label><input class="input" id="gf-atk" type="number" value="${d.base_atk}"></div>
      <div class="field"><label>DEF</label><input class="input" id="gf-def" type="number" value="${d.base_def}"></div>
      <div class="field"><label>SPD</label><input class="input" id="gf-spd" type="number" value="${d.base_spd}"></div>
      <div class="field"><label>INT</label><input class="input" id="gf-int" type="number" value="${d.base_int}"></div>
      <div class="field"><label>${esc(tr('admin.generalInnate'))}</label><select class="select" id="gf-skill"><option value="">—</option>${skills.map((s) => `<option value="${s.id}" ${d.innate_skill_id === s.id ? 'selected' : ''}>${esc(s.name_zh)} / ${esc(s.name_en)}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(tr('admin.generalArt'))}</label><div class="row"><input class="input" id="gf-art" value="${esc(d.art_url || '')}"><button class="btn xs" id="gf-upload">${esc(tr('admin.uploadArt'))}</button><input type="file" id="gf-file" accept="image/png,image/jpeg,image/webp" style="display:none"></div></div>
      <div class="field full"><label>${esc(tr('admin.generalLoreZh'))}</label><textarea class="textarea" id="gf-lore-zh">${esc(d.lore_zh || '')}</textarea></div>
      <div class="field full"><label>${esc(tr('admin.generalLoreEn'))}</label><textarea class="textarea" id="gf-lore-en">${esc(d.lore_en || '')}</textarea></div>
      <div class="field"><label>${esc(tr('admin.generalEnabled'))}</label><select class="select" id="gf-enabled"><option value="1" ${d.enabled ? 'selected' : ''}>ON</option><option value="0" ${!d.enabled ? 'selected' : ''}>OFF</option></select></div>
    </div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('common.save'), class: 'primary', onClick: async (close) => {
        const body = {
          key: document.getElementById('gf-key').value, name_zh: document.getElementById('gf-name-zh').value, name_en: document.getElementById('gf-name-en').value,
          title_zh: document.getElementById('gf-title-zh').value, title_en: document.getElementById('gf-title-en').value, source: document.getElementById('gf-source').value || 'Custom', source_ref: document.getElementById('gf-source-ref').value || '',
          rarity: document.getElementById('gf-rarity').value, cost: Number(document.getElementById('gf-cost').value), element: document.getElementById('gf-element').value,
          base_atk: Number(document.getElementById('gf-atk').value), base_def: Number(document.getElementById('gf-def').value), base_spd: Number(document.getElementById('gf-spd').value), base_int: Number(document.getElementById('gf-int').value),
          innate_skill_id: Number(document.getElementById('gf-skill').value) || null, art_url: document.getElementById('gf-art').value, pool_weight: Number(document.getElementById('gf-weight').value),
          enabled: document.getElementById('gf-enabled').value === '1', lore_zh: document.getElementById('gf-lore-zh').value, lore_en: document.getElementById('gf-lore-en').value,
        };
        try {
          await api(isNew ? '/api/admin/generals' : `/api/admin/generals/${g.id}`, { method: 'POST', body });
          toast(tr('admin.saved'), 'success'); close(); drawTab();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
    onMount: (m) => {
      m.querySelector('#gf-upload')?.addEventListener('click', () => m.querySelector('#gf-file').click());
      m.querySelector('#gf-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { toast(tr('admin.saved') + ' ≤3MB', 'warn'); return; }
        const reader = new FileReader();
        reader.onload = async () => {
          try { const r = await api('/api/admin/upload', { method: 'POST', body: { dataUrl: reader.result } }); m.querySelector('#gf-art').value = r.url; toast(tr('admin.saved'), 'success'); }
          catch (ex) { toast(errorText(ex), 'error'); }
        };
        reader.readAsDataURL(file);
      });
    },
  });
}

async function drawSkills(body) {
  const d = await api('/api/admin/skills');
  cache.skills = d.skills;
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.skills'))}</h3><button class="btn sm primary" id="skill-new">${icon('plus')} ${esc(tr('admin.skillNew'))}</button></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>KEY</th><th>${esc(tr('common.name'))}</th><th>KIND</th><th>EL</th><th>RARE</th><th>CD</th><th>MAX</th><th>${esc(tr('common.status'))}</th><th>${esc(tr('common.actions'))}</th></tr></thead><tbody>
      ${d.skills.map((s) => `<tr><td class="mono">${s.id}</td><td class="mono tiny">${esc(s.key)}</td><td><div class="lr-title">${esc(s.name_zh)} <span class="muted">/ ${esc(s.name_en)}</span></div><div class="mono tiny muted">${esc(s.desc_en)}</div></td><td>${esc(s.kind)}</td><td>${esc(s.element)}</td><td><span class="tag">${s.rare}</span></td><td class="mono">${s.base_cooldown}</td><td class="mono">${s.max_level}</td><td><span class="tag ${s.enabled ? 'green' : 'red'}">${s.enabled ? 'ON' : 'OFF'}</span></td><td><div class="actions"><button class="btn xs" data-skill="${s.id}">${esc(tr('common.edit'))}</button><button class="btn xs danger" data-sdel="${s.id}">${esc(tr('common.delete'))}</button></div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  body.querySelector('#skill-new')?.addEventListener('click', () => openSkillForm(null));
  body.querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', () => openSkillForm(d.skills.find((s) => s.id === Number(b.dataset.skill)))));
  body.querySelectorAll('[data-sdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(tr('admin.confirmDelete'))) return;
    try { await api(`/api/admin/skills/${b.dataset.sdel}/delete`, { method: 'POST' }); toast(tr('admin.saved'), 'success'); drawTab(); }
    catch (e) { toast(errorText(e), 'error'); }
  }));
}

function openSkillForm(s) {
  const isNew = !s;
  const d = s || { key: '', name_zh: '', name_en: '', desc_zh: '', desc_en: '', kind: 'passive', element: 'lumen', rare: 'A', max_level: 10, base_cooldown: 0, duration: 0, effects: '[]', pool_weight: 100, enabled: 1 };
  modal({
    title: isNew ? tr('admin.skillNew') : `${tr('admin.skillEdit')} #${s.id}`, tag: isNew ? 'CREATE' : 'EDIT', wide: true,
    body: `<div class="admin-form">
      <div class="field"><label>KEY</label><input class="input" id="sf-key" value="${esc(d.key)}" ${isNew ? '' : 'disabled'}></div>
      <div class="field"><label>${esc(tr('admin.skillKind'))}</label><select class="select" id="sf-kind">${['passive', 'active'].map((k) => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(tr('admin.generalNameZh'))}</label><input class="input" id="sf-name-zh" value="${esc(d.name_zh)}"></div>
      <div class="field"><label>${esc(tr('admin.generalNameEn'))}</label><input class="input" id="sf-name-en" value="${esc(d.name_en)}"></div>
      <div class="field"><label>ELEMENT</label><select class="select" id="sf-element">${['lumen', 'ember', 'cryo', 'bloom', 'radiance', 'umbra'].map((e) => `<option value="${e}" ${d.element === e ? 'selected' : ''}>${esc(tr('element.' + e))}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(tr('admin.skillRare'))}</label><select class="select" id="sf-rare">${['B', 'A', 'S', 'SS', 'P'].map((r) => `<option ${d.rare === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(tr('admin.skillCooldown'))}</label><input class="input" id="sf-cd" type="number" value="${d.base_cooldown}"></div>
      <div class="field"><label>${esc(tr('admin.skillDuration'))}</label><input class="input" id="sf-duration" type="number" value="${d.duration}"></div>
      <div class="field"><label>MAX LEVEL</label><input class="input" id="sf-max" type="number" value="${d.max_level}"></div>
      <div class="field"><label>${esc(tr('admin.skillWeight'))}</label><input class="input" id="sf-weight" type="number" value="${d.pool_weight}"></div>
      <div class="field full"><label>${esc(tr('admin.skillEffects'))}</label><textarea class="textarea" id="sf-effects" style="min-height:90px">${esc(typeof d.effects === 'string' ? d.effects : JSON.stringify(d.effects))}</textarea></div>
      <div class="field full"><label>DESC ZH</label><textarea class="textarea" id="sf-desc-zh">${esc(d.desc_zh)}</textarea></div>
      <div class="field full"><label>DESC EN</label><textarea class="textarea" id="sf-desc-en">${esc(d.desc_en)}</textarea></div>
      <div class="field"><label>${esc(tr('admin.generalEnabled'))}</label><select class="select" id="sf-enabled"><option value="1" ${d.enabled ? 'selected' : ''}>ON</option><option value="0" ${!d.enabled ? 'selected' : ''}>OFF</option></select></div>
    </div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('common.save'), class: 'primary', onClick: async (close) => {
        const body = {
          key: document.getElementById('sf-key').value, name_zh: document.getElementById('sf-name-zh').value, name_en: document.getElementById('sf-name-en').value,
          desc_zh: document.getElementById('sf-desc-zh').value, desc_en: document.getElementById('sf-desc-en').value,
          kind: document.getElementById('sf-kind').value, element: document.getElementById('sf-element').value, rare: document.getElementById('sf-rare').value,
          base_cooldown: Number(document.getElementById('sf-cd').value), duration: Number(document.getElementById('sf-duration').value),
          max_level: Number(document.getElementById('sf-max').value), pool_weight: Number(document.getElementById('sf-weight').value),
          effects: document.getElementById('sf-effects').value, enabled: document.getElementById('sf-enabled').value === '1',
        };
        try {
          await api(isNew ? '/api/admin/skills' : `/api/admin/skills/${s.id}`, { method: 'POST', body });
          toast(tr('admin.saved'), 'success'); close(); drawTab();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function drawSeason(body) {
  const d = await api('/api/admin/season');
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.seasonActive'))}</h3><span class="tag">${d.active?.status || '—'}</span></div>
    ${d.active ? `<div class="row between"><div><div style="font-family:var(--font-display);font-size:24px">S${String(d.active.number).padStart(2, '0')} · ${esc(d.active.name_zh)}</div><div class="mono tiny muted">${esc(d.active.name_en)}</div></div><div class="right"><div class="mono tiny muted">HOLD</div><div class="mono">${fmtDuration(d.active.victory_hold_seconds * 1000)}</div></div></div>` : emptyState('NO ACTIVE SEASON')}
    <div class="row" style="margin-top:10px"><div class="row"><input class="input" id="hold-days" type="number" step="0.01" value="${(d.active?.victory_hold_seconds || 0) / 86400}" style="width:120px"><button class="btn sm" id="hold-save">${esc(tr('admin.setHold'))}</button></div><button class="btn sm danger" id="season-end">${esc(tr('admin.endSeason'))}</button></div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>${esc(tr('admin.seasonList'))}</h3><span class="tag">${d.seasons.length}</span></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>#</th><th>NAME</th><th>STATUS</th><th>START</th><th>END</th><th>WINNER</th><th>HOLD</th></tr></thead><tbody>${d.seasons.map((s) => `<tr><td class="mono">${s.number}</td><td>${esc(s.name_zh)}<div class="mono tiny muted">${esc(s.name_en)}</div></td><td><span class="tag ${s.status === 'active' ? 'green' : ''}">${esc(s.status)}</span></td><td class="mono tiny">${s.started_at ? new Date(s.started_at).toLocaleString() : '—'}</td><td class="mono tiny">${s.ends_at ? new Date(s.ends_at).toLocaleString() : '—'}</td><td class="mono tiny">${esc(s.winner_name || '—')}</td><td class="mono">${fmtDuration(s.victory_hold_seconds * 1000)}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="panel danger-zone" style="margin-top:16px"><h4>${esc(tr('admin.seasonRebuild'))}</h4><p class="small" style="color:#d8b5b5">${esc(tr('admin.seasonRebuildNote'))}</p>
    <div class="admin-form"><div class="field"><label>${esc(tr('admin.seasonNameZh'))}</label><input class="input" id="rs-zh" placeholder="第 N 赛季 · 新生协议"></div>
      <div class="field"><label>${esc(tr('admin.seasonNameEn'))}</label><input class="input" id="rs-en" placeholder="Cycle N · Rebirth Protocol"></div>
      <div class="field"><label>${esc(tr('admin.holdDays'))}</label><input class="input" id="rs-hold" type="number" step="0.01" value="${d.settings.victoryHoldDays}"></div>
      <div class="field"><label>${esc(tr('admin.confirmRebuild'))}</label><input class="input" id="rs-confirm" placeholder="REBUILD"></div>
    </div>
    <button class="btn danger" id="rs-run" style="margin-top:10px">${esc(tr('admin.rebuild'))}</button>
  </div>`;
  body.querySelector('#hold-save')?.addEventListener('click', async () => {
    try { await api('/api/admin/season/hold', { method: 'POST', body: { holdDays: Number(body.querySelector('#hold-days').value) } }); toast(tr('admin.saved'), 'success'); drawTab(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
  body.querySelector('#season-end')?.addEventListener('click', async () => {
    if (!confirm(tr('admin.endSeasonConfirm'))) return;
    try { await api('/api/admin/season/end', { method: 'POST', body: {} }); toast(tr('admin.ended'), 'success'); drawTab(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
  body.querySelector('#rs-run')?.addEventListener('click', async () => {
    const confirmText = body.querySelector('#rs-confirm').value;
    if (confirmText !== 'REBUILD') { toast(tr('admin.confirmRebuild'), 'warn'); return; }
    const btn = body.querySelector('#rs-run'); btn.disabled = true; btn.textContent = tr('common.processing');
    try {
      await api('/api/admin/season/rebuild', { method: 'POST', body: { confirm: 'REBUILD', nameZh: body.querySelector('#rs-zh').value || undefined, nameEn: body.querySelector('#rs-en').value || undefined, holdDays: Number(body.querySelector('#rs-hold').value) } });
      toast(tr('admin.rebuilt'), 'success');
      await import('../core.js').then((m) => m.refreshState());
      drawTab();
    } catch (e) { toast(errorText(e), 'error'); btn.disabled = false; btn.textContent = tr('admin.rebuild'); }
  });
}

const SETTING_LABELS = {
  map_width: 'Map width', map_height: 'Map height', resource_tick_seconds: 'Resource tick (s)', circuit_hours: 'Circuit hours',
  storage_base: 'Base storage', circuit_base_cap: 'Circuit base cap', subbase_base_cap: 'Sub-base base cap', npc_strength: 'NPC strength', registration_open: 'Registration open',
  max_players: 'Max players', maintenance: 'Maintenance mode', starting_ember: 'Starting Ember', starting_cryo: 'Starting Cryo',
  starting_bloom: 'Starting Verdant', starting_radiance: 'Starting Radiance', starting_circuit: 'Starting Circuit',
  starting_bright: 'Starting Lumen', starting_night: 'Starting Umbra', season_start_bright: 'Season Lumen grant',
  season_start_night: 'Season Umbra grant', gacha_general_cost: 'General summon cost', gacha_general_ten_cost: 'General 10-pull cost',
  gacha_skill_cost: 'Skill summon cost', gacha_skill_ten_cost: 'Skill 10-pull cost', gacha_pity: 'Pity threshold',
  gacha_rates: 'Gacha rates JSON', build_speed: 'Build speed multiplier', research_speed: 'Research speed multiplier',
  training_speed: 'Training speed multiplier', march_speed: 'March speed multiplier', resource_yield: 'Resource yield multiplier',
  victory_hold_days: 'Victory hold days', offline_cap_hours: 'Offline cap hours', season_rebuild_delay_hours: 'Rebuild delay hours',
  resource_claim_circuit: 'Resource claim Circuit cost', server_name_zh: 'Server name ZH', server_name_en: 'Server name EN',
  maintenance_note_zh: 'Maintenance note ZH', maintenance_note_en: 'Maintenance note EN', raid_enabled: 'Raid enabled',
};

async function drawSettings(body) {
  const d = await api('/api/admin/settings');
  const keys = d.keys;
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.settings'))}</h3><span class="tag">${keys.length}</span></div>
    <div class="notice" style="margin-bottom:12px">${esc(tr('admin.settingsNote'))}</div>
    <div class="admin-form">${keys.map((k) => {
      const v = d.settings[k];
      const label = SETTING_LABELS[k] || k;
      if (typeof v === 'object') return `<div class="field full"><label>${esc(label)}</label><textarea class="textarea" data-set="${k}">${esc(JSON.stringify(v, null, 2))}</textarea></div>`;
      return `<div class="field"><label>${esc(label)}</label><input class="input" data-set="${k}" value="${esc(v)}" ${typeof v === 'number' ? 'type="number" step="any"' : ''}></div>`;
    }).join('')}</div>
    <button class="btn primary" id="settings-save" style="margin-top:12px">${esc(tr('admin.saveSettings'))}</button></div>`;
  body.querySelector('#settings-save')?.addEventListener('click', async () => {
    const payload = {};
    body.querySelectorAll('[data-set]').forEach((inp) => {
      const k = inp.dataset.set;
      const raw = inp.value;
      if (k === 'gacha_rates') { try { payload[k] = JSON.parse(raw); } catch { toast('Invalid JSON: gacha_rates', 'error'); } }
      else if (inp.type === 'number') payload[k] = Number(raw);
      else payload[k] = raw;
    });
    try { await api('/api/admin/settings', { method: 'POST', body: payload }); toast(tr('admin.saved'), 'success'); await refreshAll(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
}

async function drawAnnouncements(body) {
  const d = await api('/api/admin/announcements');
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.announcements'))}</h3><button class="btn sm primary" id="ann-new">${icon('plus')} ${esc(tr('admin.announcementNew'))}</button></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>TITLE</th><th>BODY</th><th>STATUS</th><th>${esc(tr('common.actions'))}</th></tr></thead><tbody>
      ${d.announcements.map((a) => `<tr><td class="mono">${a.id}</td><td>${esc(a.title_zh)}<div class="mono tiny muted">${esc(a.title_en)}</div></td><td class="mono tiny">${esc((a.body_en || '').slice(0, 80))}</td><td><span class="tag ${a.active ? 'green' : 'red'}">${a.active ? 'ON' : 'OFF'}</span></td><td><button class="btn xs" data-ann="${a.id}">${esc(tr('common.edit'))}</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  body.querySelector('#ann-new')?.addEventListener('click', () => openAnnouncement(null));
  body.querySelectorAll('[data-ann]').forEach((b) => b.addEventListener('click', () => openAnnouncement(d.announcements.find((a) => a.id === Number(b.dataset.ann)))));
}

function openAnnouncement(a) {
  const isNew = !a;
  const d = a || { title_zh: '', title_en: '', body_zh: '', body_en: '', active: 1 };
  modal({
    title: isNew ? tr('admin.announcementNew') : tr('admin.announcementEdit'), wide: true,
    body: `<div class="admin-form"><div class="field"><label>TITLE ZH</label><input class="input" id="an-tzh" value="${esc(d.title_zh)}"></div><div class="field"><label>TITLE EN</label><input class="input" id="an-ten" value="${esc(d.title_en)}"></div>
      <div class="field full"><label>BODY ZH</label><textarea class="textarea" id="an-bzh">${esc(d.body_zh)}</textarea></div><div class="field full"><label>BODY EN</label><textarea class="textarea" id="an-ben">${esc(d.body_en)}</textarea></div>
      <div class="field"><label>${esc(tr('admin.active'))}</label><select class="select" id="an-active"><option value="1" ${d.active ? 'selected' : ''}>ON</option><option value="0" ${!d.active ? 'selected' : ''}>OFF</option></select></div></div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('common.save'), class: 'primary', onClick: async (close) => {
        const body = { title_zh: document.getElementById('an-tzh').value, title_en: document.getElementById('an-ten').value, body_zh: document.getElementById('an-bzh').value, body_en: document.getElementById('an-ben').value, active: document.getElementById('an-active').value === '1' };
        try { await api(isNew ? '/api/admin/announcements' : `/api/admin/announcements/${a.id}`, { method: 'POST', body }); toast(tr('admin.saved'), 'success'); close(); drawTab(); }
        catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function drawAudit(body) {
  const d = await api('/api/admin/audit');
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.auditLog'))}</h3><span class="tag">${d.audit.length}</span></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>TIME</th><th>ADMIN</th><th>ACTION</th><th>TARGET</th><th>DETAILS</th></tr></thead><tbody>
      ${d.audit.map((a) => `<tr><td class="mono">${a.id}</td><td class="mono tiny">${new Date(a.created_at).toLocaleString()}</td><td>${esc(a.admin_name || '#' + a.admin_id)}</td><td class="mono">${esc(a.action)}</td><td class="mono tiny">${esc(a.target || '')}</td><td class="mono tiny muted">${esc((a.details || '').slice(0, 160))}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

async function drawMovements(body) {
  const d = await api('/api/admin/movements');
  body.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(tr('admin.movementsAll'))}</h3><span class="tag">${d.movements.length}</span></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>ATTACKER</th><th>KIND</th><th>FROM</th><th>TO</th><th>TROOPS</th><th>ARRIVE</th><th>STATUS</th></tr></thead><tbody>
      ${d.movements.map((m) => `<tr><td class="mono">${m.id}</td><td>${esc(m.attacker_name)}</td><td>${esc(m.kind)}</td><td class="mono">${m.from_x},${m.from_y}</td><td class="mono">${m.to_x},${m.to_y}</td><td class="mono tiny">${esc(JSON.stringify(m.troops))}</td><td class="mono tiny">${new Date(m.arrive_at).toLocaleTimeString()}</td><td><span class="tag">${esc(m.status)}</span></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>${esc(tr('admin.reportsAll'))}</h3><span class="tag">${d.reports.length}</span></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>USER</th><th>KIND</th><th>TITLE</th><th>TIME</th></tr></thead><tbody>
      ${d.reports.map((r) => `<tr><td class="mono">${r.id}</td><td>${esc(r.display_name)}</td><td>${esc(r.kind)}</td><td>${esc(r.title_en)}</td><td class="mono tiny">${new Date(r.created_at).toLocaleString()}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

async function refreshAll() {
  const { refreshState } = await import('../core.js');
  await refreshState();
  drawTab();
}
