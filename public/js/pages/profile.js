import { S, L, tr, api, refreshState, setLang, errorText } from '../core.js';
import { esc, icon, fmt, modal, toast, emptyState, timeAgo, countdownHTML } from '../ui.js';

let rootEl = null;
let profile = null;
let reports = [];
let cleanupFns = [];

export async function render(root) {
  rootEl = root;
  await load();
  return () => { rootEl = null; };
}

async function load() {
  profile = await api('/api/profile');
  reports = (await api('/api/reports')).reports;
  draw();
}

function draw() {
  if (!rootEl || !profile) return;
  const p = profile;
  const quests = S.state.quests || [];
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('profile.subtitle'))}</div><h2>${esc(tr('profile.title'))}</h2></div><span class="sub">ID ${p.user.id} · ${esc(tr('profile.joined'))} ${new Date(p.joinedAt).toLocaleDateString()}</span></div>
    <div class="grid side">
      <div class="col">
        <div class="panel">
          <div class="row" style="gap:14px"><div class="avatar" style="width:58px;height:58px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--magenta));color:#041018;font-family:var(--font-display);font-size:24px;font-weight:700">${esc(p.user.displayName.slice(0, 1).toUpperCase())}</div>
            <div><div style="font-family:var(--font-display);font-size:24px;letter-spacing:.04em">${esc(p.user.displayName)}</div><div class="mono tiny muted">${esc(tr('profile.charter'))}: ${esc(tr('charter.' + p.charter.key))} · ${esc(tr('charter.perk'))}</div></div></div>
          <div class="divider"></div>
          <div class="gd-stats" style="grid-template-columns:repeat(4,1fr)">
            <div class="gd-stat"><span>${esc(tr('common.power'))}</span><b>${fmt(p.stats.power)}</b></div>
            <div class="gd-stat"><span>${esc(tr('profile.generals'))}</span><b>${p.stats.generals}</b></div>
            <div class="gd-stat"><span>${esc(tr('profile.tiles'))}</span><b>${p.stats.tiles}</b></div>
            <div class="gd-stat"><span>${esc(tr('profile.cities'))}</span><b>${p.stats.cities}</b></div>
          </div>
          <div class="row between small"><span class="muted">${esc(tr('profile.wins'))} / ${esc(tr('profile.losses'))}</span><span class="mono">${p.stats.wins} / ${p.stats.losses}</span></div>
          <div class="row between small"><span class="muted">${esc(tr('profile.research'))}</span><span class="mono">${p.stats.research}</span></div>
          ${S.state.vassal ? `<div class="notice" style="margin-top:10px">${esc(tr('profile.vassal'))}: ${esc(tr('profile.liege'))} ${esc(S.state.vassal.liegeName)}</div>` : ''}
        </div>
        <div class="panel"><div class="panel-head"><h3>${esc(tr('profile.best'))}</h3><span class="tag">TOP 3</span></div>
          <div class="card-grid">${p.best.map((g) => `<div class="vcard rarity-${g.rarity}" style="cursor:default"><div class="vcard-face vcard-front"><div class="vc-art" style="background-image:url('${esc(g.artUrl)}')"></div><div class="vc-bottom"><div class="vc-name">${esc(L(g.name))}</div><div class="vc-title">POWER ${g.power}</div></div></div></div>`).join('') || emptyState(tr('common.empty'))}</div>
        </div>
        <div class="panel"><div class="panel-head"><h3>${esc(tr('profile.settings'))}</h3><span class="tag">CONFIG</span></div>
          <div class="row between"><span class="small muted">${esc(tr('profile.language'))}</span><div class="lang-toggle"><button data-plang="zh" class="${S.lang === 'zh' ? 'active' : ''}">中文</button><button data-plang="en" class="${S.lang === 'en' ? 'active' : ''}">EN</button></div></div>
          <div class="divider"></div>
          <div class="row wrap"><a class="btn sm ghost" href="#/profile">${icon('report')} ${esc(tr('nav.reports'))}</a>${S.user.role === 'admin' ? `<a class="btn sm" href="#/admin">${icon('admin')} ${esc(tr('nav.admin'))}</a>` : ''}</div>
        </div>
      </div>
      <div class="col">
        <div class="panel"><div class="panel-head"><h3>${esc(tr('profile.quests'))}</h3><span class="tag cyan">${quests.filter((q) => q.claimable).length} ${esc(tr('common.claim'))}</span></div>
          ${quests.map((q) => `<div class="quest-row ${q.claimed ? 'done' : ''}"><div class="qr-main"><div class="qr-title">${esc(L(q.name))}</div><div class="qr-desc">${esc(L(q.desc))}</div></div><div class="qr-progress">${q.progress}/${q.target}</div>${q.claimed ? `<span class="tag">${esc(tr('common.claimed'))}</span>` : q.claimable ? `<button class="btn xs primary" data-quest="${q.key}">${esc(tr('common.claim'))}</button>` : `<span class="tag">${Math.round(q.progress / q.target * 100)}%</span>`}</div>`).join('') || emptyState(tr('common.empty'))}
        </div>
        <div class="panel"><div class="panel-head"><h3>${esc(tr('profile.reports'))}</h3><button class="btn xs ghost" data-readall>${esc(tr('profile.markRead'))}</button></div>
          <div class="panel-scroll">${reports.length ? reports.map((r) => `<div class="report-row ${r.read ? '' : 'unread'}" data-report="${r.id}"><div class="row between"><div class="rr-title">${esc(L(r.title))}</div><span class="mono tiny muted">${timeAgo(r.createdAt)}</span></div><div class="rr-body">${esc(L(r.body))}</div></div>`).join('') : emptyState(tr('profile.noReports'))}</div>
        </div>
      </div>
    </div>`;
  rootEl.querySelectorAll('[data-plang]').forEach((b) => b.addEventListener('click', async () => {
    setLang(b.dataset.plang);
    api('/api/locale', { method: 'POST', body: { locale: S.lang } }).catch(() => {});
    await import('../app.js').then((m) => { m.renderShell(); m.renderRoute(); });
  }));
  rootEl.querySelectorAll('[data-quest]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/quests/${b.dataset.quest}/claim`, { method: 'POST' }); toast(tr('quest.claimSuccess'), 'success'); await refreshState(); await load(); }
    catch (e) { toast(errorText(e), 'error'); }
  }));
  rootEl.querySelector('[data-readall]')?.addEventListener('click', async () => {
    try { await api('/api/reports/read', { method: 'POST', body: {} }); await refreshState(); await load(); }
    catch (e) { toast(errorText(e), 'error'); }
  });
  rootEl.querySelectorAll('[data-report]').forEach((el) => el.addEventListener('click', () => openReport(reports.find((r) => r.id === Number(el.dataset.report)))));
}

function openReport(r) {
  if (!r) return;
  api('/api/reports/read', { method: 'POST', body: { ids: [r.id] } }).then(() => { r.read = true; }).catch(() => {});
  modal({ title: L(r.title), tag: r.kind.toUpperCase(), body: `<p style="color:#b9d7e2;font-size:12px;line-height:1.8">${esc(L(r.body))}</p>`, actions: [{ label: tr('common.close'), class: 'ghost' }] });
}
