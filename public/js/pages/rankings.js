import { S, L, tr, api, errorText } from '../core.js';
import { esc, icon, fmt, fmt1, emptyState, toast } from '../ui.js';

let rootEl = null;
let data = null;
let type = 'power';
let cleanupFns = [];

const TYPES = ['power', 'territory', 'gateway', 'generals'];

export async function render(root) {
  rootEl = root;
  await load();
  return () => { rootEl = null; };
}

async function load() {
  data = await api(`/api/rankings?type=${type}`);
  draw();
}

function draw() {
  if (!rootEl || !data) return;
  const rows = data.rows || [];
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('rankings.subtitle'))}</div><h2>${esc(tr('rankings.title'))}</h2></div><span class="sub">${esc(tr('hud.season'))} ${S.state.season ? 'S' + String(S.state.season.number).padStart(2, '0') : '—'}</span></div>
    <div class="tabs">${TYPES.map((t) => `<button class="${type === t ? 'active' : ''}" data-type="${t}">${esc(tr('rankings.' + t))}</button>`).join('')}</div>
    <div class="grid three" style="margin-bottom:16px">
      ${top.map((r, i) => `<div class="panel ${i === 0 ? 'magenta' : ''}"><div class="row between"><span class="tag ${i === 0 ? 'amber' : 'cyan'}">#${r.rank}</span><span class="mono tiny muted">${r.isBot ? 'NPC' : r.alliance || ''}</span></div>
        <div style="font-family:var(--font-display);font-size:22px;letter-spacing:.04em;margin-top:8px">${esc(r.name)}</div>
        <div class="mono tiny muted">${esc(tr('charter.' + r.charter))}</div>
        <div class="divider"></div><div class="row between"><span class="mono small muted">${esc(tr('rankings.power'))}</span><b class="mono">${fmt(r.power)}</b></div>
        <div class="row between"><span class="mono small muted">${esc(tr('rankings.tiles'))}</span><b class="mono">${fmt(r.tiles)}</b></div>
        <div class="row between"><span class="mono small muted">${esc(tr('rankings.gateway'))}</span><b class="mono">${r.gateways}</b></div>
      </div>`).join('') || emptyState(tr('common.empty'))}
    </div>
    <div class="panel pad-0"><div class="table-wrap" style="overflow:auto"><table class="table">
      <thead><tr><th>${esc(tr('rankings.rank'))}</th><th>${esc(tr('rankings.driller'))}</th><th>${esc(tr('rankings.charter'))}</th><th>${esc(tr('rankings.power'))}</th><th>${esc(tr('rankings.tiles'))}</th><th>${esc(tr('rankings.gateway'))}</th><th>${esc(tr('rankings.generals'))}</th><th>${esc(tr('rankings.alliance'))}</th></tr></thead>
      <tbody>${rest.map((r) => `<tr class="${r.self ? 'self' : ''}"><td class="rank">${r.rank}</td><td><div class="pname"><span class="mini-avatar">${esc(r.name.slice(0, 1))}</span><b>${esc(r.name)}</b>${r.isBot ? `<span class="tag">${esc(tr('rankings.bots'))}</span>` : ''}${r.self ? `<span class="tag cyan">${esc(tr('rankings.you'))}</span>` : ''}</div></td><td class="mono tiny">${esc(tr('charter.' + r.charter))}</td><td class="mono">${fmt(r.power)}</td><td class="mono">${fmt(r.tiles)}</td><td class="mono">${r.gateways}</td><td class="mono">${r.generals}</td><td class="mono tiny">${esc(r.alliance || '—')}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
  rootEl.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', async () => { type = b.dataset.type; await load(); }));
}
