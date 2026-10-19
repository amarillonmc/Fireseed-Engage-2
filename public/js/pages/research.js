import { S, L, tr, api, refreshState, errorText } from '../core.js';
import { esc, icon, fmt, fmt1, fmtDuration, costHTML, progressBar, modal, toast, countdownHTML, timeLeft, emptyState } from '../ui.js';

let rootEl = null;
let data = null;
let tab = 'seasonal';
let cleanupFns = [];
let timer = null;

export async function render(root) {
  rootEl = root;
  await load();
  timer = setInterval(() => {
    if (data?.queue && timeLeft(data.queue.finishAt) <= 0) load();
  }, 3000);
  return () => { if (timer) clearInterval(timer); rootEl = null; };
}

async function load() {
  data = await api('/api/research');
  draw();
}

function effectText(t) {
  const pct = ['production_ember', 'production_cryo', 'production_bloom', 'production_radiance', 'production_lumen', 'production_umbra', 'production_all_pct', 'storage_pct', 'train_speed_pct', 'attack_pct', 'defense_pct', 'siege_pct', 'circuit_rate_pct', 'march_speed_pct', 'build_speed_pct', 'research_speed_pct', 'gacha_discount_pct'].includes(t.effect.key);
  if (pct) return `+${fmt1(t.effect.value * 100)}%`;
  if (t.effect.key === 'general_cost_cap') return `+${fmt1(t.effect.value)} COST`;
  if (t.effect.key === 'circuit_cap') return `+${Math.round(t.effect.value)} ${tr('resource.circuit')}`;
  if (t.effect.key === 'subbase_cap') return `+${Math.round(t.effect.value)} SUB-BASE`;
  if (t.effect.key === 'offline_cap_hours') return `+${Math.round(t.effect.value)}h`;
  return `+${fmt1(t.effect.value)}`;
}

function draw() {
  if (!rootEl || !data) return;
  const list = data.techs.filter((t) => t.scope === tab);
  const q = data.queue;
  const queueTech = q ? data.techs.find((t) => t.key === q.key) : null;
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('research.subtitle'))}</div><h2>${esc(tr('research.title'))}</h2></div>
    <span class="sub">${esc(tr('research.labLevel', { n: data.labLevel }))} · ${data.labLevel ? '' : esc(tr('research.noLab'))}</span></div>
    ${!data.labLevel ? `<div class="notice" style="margin-bottom:12px">${esc(tr('research.noLab'))}</div>` : ''}
    ${q ? `<div class="queue-bar ${q.key && data.techs.find((t) => t.key === q.key)?.scope === 'permanent' ? '' : 'cyan'}"><span class="mono small">${esc(tr('research.queue'))}</span><b>${esc(L(queueTech?.name || { zh: q.key, en: q.key }))} → Lv.${q.targetLevel}</b><div class="meter"><i style="width:${Math.max(0, Math.min(100, ((Date.now() - q.startedAt) / Math.max(1, q.finishAt - q.startedAt)) * 100))}%"></i></div>${countdownHTML(q.finishAt)}<button class="btn xs" data-instant ${S.state.user.tapes ? '' : 'disabled'}>${esc(tr('research.instant'))} (${S.state.user.tapes})</button></div>` : `<div class="queue-bar"><span class="mono small">${esc(tr('research.queue'))}</span><b>${esc(tr('research.noQueue'))}</b></div>`}
    <div class="tabs"><button class="${tab === 'seasonal' ? 'active' : ''}" data-tab="seasonal">${esc(tr('research.seasonal'))}</button><button class="${tab === 'permanent' ? 'active' : ''}" data-tab="permanent">${esc(tr('research.permanent'))}</button></div>
    <div class="notice ${tab === 'permanent' ? '' : 'cyan'}" style="margin-bottom:12px">${esc(tab === 'permanent' ? tr('research.permanentNote') : tr('research.seasonalNote'))}</div>
    <div class="research-grid">${list.map((t) => `<div class="tech-card">
      <div class="tc-head"><div><h4>${esc(L(t.name))}</h4><div class="mono tiny muted">${esc(tr('research.cat.' + t.category))} · ${esc(t.scope === 'seasonal' ? tr('research.seasonal') : tr('research.permanent'))}</div></div><span class="tag ${t.scope === 'permanent' ? 'amber' : 'cyan'}">Lv.${t.level}/${t.maxLevel}</span></div>
      <div class="tc-desc">${esc(L(t.desc))}</div>
      <div class="tc-effect">${esc(tr('research.effect'))}: ${esc(effectText(t))}</div>
      <div class="pips">${Array.from({ length: t.maxLevel }, (_, i) => `<i class="${i < t.level ? 'on' : ''}"></i>`).join('')}</div>
      <div class="cost-row">${costHTML(t.cost)}</div>
      <div class="tc-foot"><span class="mono tiny muted">${t.level >= t.maxAllowed ? (t.level >= t.maxLevel ? esc(tr('common.max')) : esc(tr('research.maxForLab'))) : `${fmtDuration(t.seconds * 1000)}`}</span>
        <button class="btn xs ${t.scope === 'permanent' ? 'magenta' : 'primary'}" data-research="${t.key}" ${t.canLevel ? '' : 'disabled'}>${icon('research')} ${esc(tr('research.research'))}</button></div>
    </div>`).join('')}</div>`;
  bind();
}

function bind() {
  rootEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
  rootEl.querySelectorAll('[data-research]').forEach((b) => b.addEventListener('click', () => start(b.dataset.research)));
  rootEl.querySelector('[data-instant]')?.addEventListener('click', instant);
}

async function start(key) {
  try {
    const res = await api('/api/research', { method: 'POST', body: { techKey: key } });
    toast(tr('research.startSuccess', { name: key }), 'success');
    await refreshState(); await load();
  } catch (e) { toast(errorText(e), 'error'); }
}

async function instant() {
  const city = S.state.cities?.[0];
  if (!city) return;
  try {
    await api(`/api/city/${city.id}/instant`, { method: 'POST' });
    toast(tr('common.saved'), 'success');
    await refreshState(); await load();
  } catch (e) { toast(errorText(e), 'error'); }
}
