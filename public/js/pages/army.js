import { S, L, tr, api, errorText } from '../core.js';
import { esc, icon, fmt, fmt1, fmtDuration, countdownHTML, progressBar, emptyState, toast } from '../ui.js';

let rootEl = null;
let cities = [];
let cleanupFns = [];
let timer = null;

export async function render(root) {
  rootEl = root;
  await load();
  timer = setInterval(() => { if (rootEl) load(true); }, 8000);
  return () => { if (timer) clearInterval(timer); rootEl = null; };
}

async function load(quiet = false) {
  try {
    const list = S.state.cities || [];
    const detailed = [];
    for (const c of list) {
      try { detailed.push((await api(`/api/city/${c.id}`)).city); } catch { /* noop */ }
    }
    cities = detailed;
    draw();
  } catch (e) { if (!quiet) toast(errorText(e), 'error'); }
}

function draw() {
  if (!rootEl) return;
  const state = S.state;
  const meta = S.boot.meta.units;
  const movements = state.movements || { outgoing: [], incoming: [] };
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('army.subtitle'))}</div><h2>${esc(tr('army.title'))}</h2></div><span class="sub">${esc(tr('army.capacity', { n: fmt(state.troopCount), cap: fmt(state.troopCap) }))}</span></div>
    <div class="grid two" style="margin-bottom:16px">
      ${cities.map((c) => `<div class="panel"><div class="panel-head"><h3>${esc(L(c.name))}</h3><span class="tag cyan">${c.x},${c.y}</span></div>
        <div class="row between"><span class="mono small muted">${esc(tr('army.capacity', { n: fmt(c.troopCount), cap: fmt(c.troopCap) }))}</span><span class="mono small">${fmt(c.troopCount)} / ${fmt(c.troopCap)}</span></div>${progressBar(c.troopCount, c.troopCap, 'amber')}
        <div style="margin-top:10px">${Object.keys(meta).map((k) => { const v = c.troops[k]; return v ? `<div class="troop-row"><div class="tr-name">${icon('army')}<b>${esc(L(meta[k].name))}</b><span class="tag">Lv.${v.level}</span></div><span class="tr-count">${fmt(v.count)}</span></div>` : ''; }).join('') || `<div class="empty-state">${esc(tr('city.noTroops'))}</div>`}</div>
        ${c.training.length ? `<div class="queue-bar" style="margin-top:8px"><span class="mono small">${esc(tr('army.training'))}</span><b>${c.training.map((t) => `${t.total}× ${esc(L(t.unitName))}`).join(', ')}</b><span class="spacer"></span>${countdownHTML(c.training[0].finishAt)}</div>` : ''}
        <div class="row" style="margin-top:10px"><a class="btn xs" href="#/city" data-city="${c.id}">${icon('city')} ${esc(tr('nav.city'))}</a></div>
      </div>`).join('')}
    </div>
    <div class="grid two">
      <div class="panel"><div class="panel-head"><h3>${esc(tr('army.movements'))}</h3><span class="tag">${movements.outgoing.length}</span></div>
        ${movements.outgoing.length ? movements.outgoing.map((m) => `<div class="troop-row"><div class="tr-name">${icon(m.kind === 'scout' ? 'scout' : 'attack')}<div><b>${esc(tr('army.kind.' + m.kind))} → ${m.to_x},${m.to_y}</b><div class="mono tiny muted">${esc(tr('army.marchTo', { x: m.to_x, y: m.to_y }))}</div></div></div><div class="right"><div class="mono tiny muted">${esc(tr('army.arrivesIn'))}</div>${countdownHTML(m.arrive_at)}</div></div>`).join('') : emptyState(tr('army.noMovements'))}
      </div>
      <div class="panel"><div class="panel-head"><h3>${esc(tr('army.incoming'))}</h3><span class="tag ${movements.incoming.length ? 'magenta' : ''}">${movements.incoming.length}</span></div>
        ${movements.incoming.length ? movements.incoming.map((m) => `<div class="troop-row"><div class="tr-name">${icon('attack')}<div><b>${esc(m.attacker_name)}</b><div class="mono tiny muted">${m.from_x},${m.from_y} → ${m.to_x},${m.to_y}</div></div></div><div class="right">${countdownHTML(m.arrive_at)}</div></div>`).join('') : emptyState(tr('army.noIncoming'))}
      </div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>${esc(tr('army.unit'))}</h3><span class="tag">${Object.keys(meta).length}</span></div>
      <div class="unit-grid">${Object.values(meta).map((u) => `<div class="unit-card"><b>${esc(L(u.name))}</b><p>${esc(L(u.desc))}</p><div class="uc-stats"><span>ATK ${u.atk}</span><span>DEF ${u.def}</span><span>SPD ${u.speed}s</span><span>SIEGE ${u.siege}</span></div><div class="cost-row">${Object.entries(u.cost).map(([k, v]) => `<span class="cost ${k}"><i></i>${v}</span>`).join('')}</div></div>`).join('')}</div>
    </div>`;
  rootEl.querySelectorAll('[data-city]').forEach((a) => a.addEventListener('click', () => { S.cityId = Number(a.dataset.city); }));
}
