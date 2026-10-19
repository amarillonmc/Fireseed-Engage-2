import { S, L, tr, api, refreshState, errorText } from '../core.js';
import {
  esc, icon, fmt, fmt1, fmtDuration, costHTML, modal, toast, countdownHTML, timeLeft, progressBar,
} from '../ui.js';

const COLORS = {
  lumen: '#ecfbff', ember: '#ff6b45', cryo: '#48baff', bloom: '#50e08c', radiance: '#ffd24a', umbra: '#a98bff',
  fort: '#c98a42', gateway: '#ff3d8b', hole: '#e8f4fa', empty: '#0a141c', city: '#39c6d8',
};
const OWNER_COLORS = ['#3ce7ff', '#ff6b9d', '#ffbd4a', '#7dff9f', '#b48bff', '#ff8b5c', '#6fd6ff', '#ff7bd5'];

let rootEl = null;
let canvas = null;
let ctx = null;
let data = null;
let selected = null;
let selectedTile = null;
let tileIndex = new Map();
let drag = null;
let loadSeq = 0;
let cleanupFns = [];

export async function render(root) {
  rootEl = root;
  if (!S.map.init) {
    const c = S.state.cities?.[0];
    if (c) { S.map.cx = c.x; S.map.cy = c.y; S.map.zoom = 8; }
    S.map.init = true;
  }
  root.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('map.subtitle', { w: S.boot.map.width, h: S.boot.map.height }))}</div><h2>${esc(tr('map.title'))}</h2></div>
      <span class="sub">${esc(tr('map.zoomHint'))}</span></div>
    <div class="map-layout">
      <div class="map-panel">
        <canvas id="map-canvas"></canvas>
        <div class="map-overlay">
          <div class="map-hud-top">
            <button class="btn sm" data-act="center">${icon('city')} ${esc(tr('nav.city'))}</button>
            <button class="btn sm ghost" data-act="reload">${icon('refresh')} ${esc(tr('common.refresh'))}</button>
          </div>
          <div class="map-coord" id="map-coord">${fmt(S.map.cx)}, ${fmt(S.map.cy)} · Z${fmt1(S.map.zoom)}</div>
          <div class="map-legend">
            <span><i style="--c:${COLORS.empty}"></i>${esc(tr('map.legend.empty'))}</span>
            <span><i style="--c:${COLORS.bloom}"></i>${esc(tr('map.legend.resource'))}</span>
            <span><i style="--c:${COLORS.fort}"></i>${esc(tr('map.legend.fort'))}</span>
            <span><i style="--c:${COLORS.gateway}"></i>${esc(tr('map.legend.gateway'))}</span>
            <span><i style="--c:${COLORS.hole}"></i>${esc(tr('map.legend.hole'))}</span>
            <span><i style="--c:${COLORS.city}"></i>${esc(tr('map.legend.own'))}</span>
          </div>
          <div class="map-zoom"><button data-zoom="1">+</button><button data-zoom="-1">−</button></div>
        </div>
      </div>
      <div class="col">
        <div id="tile-panel">${tilePanelHTML()}</div>
        <div class="panel"><div class="panel-head"><h3>${esc(tr('map.gateways'))}</h3><span class="tag">12</span></div><div class="gateway-list" id="gateway-list">${gatewayListHTML()}</div></div>
        <div class="panel"><div class="panel-head"><h3>${esc(tr('map.incoming'))}</h3><span class="tag ${S.state.movements?.incoming?.length ? 'magenta' : ''}">${S.state.movements?.incoming?.length || 0}</span></div>
          ${(S.state.movements?.incoming || []).length ? S.state.movements.incoming.map(incomingHTML).join('') : `<div class="empty-state">${esc(tr('map.noIncoming'))}</div>`}</div>
      </div>
    </div>`;

  await setupCanvas();
  bind(root);
  await loadMap();
  return () => {
    cleanupFns.forEach((f) => { try { f(); } catch { /* noop */ } });
    cleanupFns = [];
    rootEl = null;
  };
}

async function setupCanvas() {
  canvas = rootEl.querySelector('#map-canvas');
  ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(300, rect.width) * dpr;
  canvas.height = 640 * dpr;
  canvas.style.height = '640px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cleanupFns.push(() => { canvas = null; ctx = null; });
}

function bind(root) {
  root.querySelector('[data-act="center"]')?.addEventListener('click', () => {
    const c = S.state.cities?.[0];
    if (c) { S.map.cx = c.x; S.map.cy = c.y; S.map.zoom = 8; loadMap(); }
  });
  root.querySelector('[data-act="reload"]')?.addEventListener('click', () => loadMap());
  root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    S.map.zoom = clampZoom(S.map.zoom + Number(b.dataset.zoom));
    loadMap();
  }));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    S.map.zoom = clampZoom(S.map.zoom * factor);
    loadMap();
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: S.map.cx, cy: S.map.cy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        S.map.cx = drag.cx - dx / S.map.zoom;
        S.map.cy = drag.cy - dy / S.map.zoom;
        S.map.cx = Math.max(0, Math.min(S.boot.map.width - 1, S.map.cx));
        S.map.cy = Math.max(0, Math.min(S.boot.map.height - 1, S.map.cy));
        draw();
      }
      return;
    }
    hoverTile(e);
  });
  canvas.addEventListener('pointerup', async (e) => {
    if (drag && !drag.moved) {
      const p = screenToTile(e.offsetX, e.offsetY);
      if (p) await clickTile(p.x, p.y);
    }
    if (drag?.moved) loadMap();
    drag = null;
  });
  canvas.addEventListener('pointerleave', () => { const t = root.querySelector('.map-tooltip'); if (t) t.remove(); });
  root.querySelector('#gateway-list')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-gw]');
    if (!row) return;
    S.map.cx = Number(row.dataset.gx); S.map.cy = Number(row.dataset.gy);
    S.map.zoom = Math.max(5, S.map.zoom);
    await loadMap(); await clickTile(Number(row.dataset.gx), Number(row.dataset.gy));
  });
  cleanupFns.push(() => { drag = null; });
}

function clampZoom(z) { return Math.max(0.8, Math.min(14, z)); }

async function loadMap() {
  if (!S.user) return;
  const seq = ++loadSeq;
  const q = `cx=${S.map.cx}&cy=${S.map.cy}&zoom=${S.map.zoom}`;
  try {
    const res = await api(`/api/map?${q}`);
    if (seq !== loadSeq || !rootEl) return;
    data = res;
    tileIndex = new Map(res.tiles.map((t) => [`${t[0]},${t[1]}`, t]));
    rootEl.querySelector('#map-coord').textContent = `${Math.round(S.map.cx)}, ${Math.round(S.map.cy)} · Z${fmt1(S.map.zoom)}`;
    draw();
    updateGatewayList();
  } catch (e) {
    if (e.code !== 'login_required') toast(errorText(e), 'error');
  }
}

function draw() {
  if (!canvas || !ctx || !data) return;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = 640;
  const zoom = S.map.zoom;
  const offX = W / 2 - S.map.cx * zoom;
  const offY = H / 2 - S.map.cy * zoom;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#03070b';
  ctx.fillRect(0, 0, W, H);
  // sea texture
  ctx.strokeStyle = 'rgba(60,231,255,0.035)';
  ctx.lineWidth = 1;
  const gridStep = zoom >= 6 ? 8 : zoom >= 3 ? 16 : 32;
  for (let gx = (S.map.cx % gridStep); gx < W / zoom; gx += gridStep) {
    const sx = ((S.map.cx - (S.map.cx % gridStep)) + gx) * zoom + offX;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let gy = (S.map.cy % gridStep); gy < H / zoom; gy += gridStep) {
    const sy = ((S.map.cy - (S.map.cy % gridStep)) + gy) * zoom + offY;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }
  const maxTiles = 60000;
  const tiles = data.tiles;
  for (let i = 0; i < tiles.length && i < maxTiles; i++) {
    const [x, y, type, owner, level, dir, block, res] = tiles[i];
    const px = x * zoom + offX, py = y * zoom + offY;
    const size = Math.max(1, block * zoom + 0.25);
    if (px + size < 0 || py + size < 0 || px > W || py > H) continue;
    // base terrain: quiet by default, so territory reads first
    if (type === 'empty') {
      ctx.fillStyle = owner ? '#0a1a22' : '#071018';
      ctx.fillRect(px, py, size, size);
    } else if (type === 'resource') {
      const rc = res ? COLORS[Object.keys(res)[0]] || COLORS.bloom : COLORS.bloom;
      ctx.fillStyle = '#061017';
      ctx.fillRect(px, py, size, size);
      if (zoom >= 3.2 && size >= 3) {
        ctx.fillStyle = hexA(rc, owner ? 0.98 : 0.80);
        const d = Math.max(1.6, Math.min(3.2, size * 0.26));
        ctx.fillRect(px + (size - d) / 2, py + (size - d) / 2, d, d);
      }
    } else if (type === 'fort') {
      ctx.fillStyle = owner ? '#101a1f' : '#0d1216';
      ctx.fillRect(px, py, size, size);
      if (zoom >= 4 && zoom < 8.5 && size >= 4) {
        ctx.fillStyle = hexA(COLORS.fort, owner ? 0.30 : 0.22);
        const d = Math.max(1, size * 0.10);
        ctx.fillRect(px + (size - d) / 2, py + (size - d) / 2, d, d);
      }
      if (zoom >= 8.5) {
        ctx.strokeStyle = hexA(COLORS.fort, owner ? 0.5 : 0.55);
        ctx.lineWidth = Math.max(0.6, zoom * 0.08);
        const s = size * 0.22;
        ctx.beginPath();
        ctx.moveTo(px + size / 2, py + size / 2 - s);
        ctx.lineTo(px + size / 2 + s, py + size / 2);
        ctx.lineTo(px + size / 2, py + size / 2 + s);
        ctx.lineTo(px + size / 2 - s, py + size / 2);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (type === 'gateway') {
      ctx.fillStyle = '#150812';
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = owner ? '#ffb7d1' : 'rgba(255,61,139,0.8)';
      ctx.lineWidth = Math.max(1, zoom * 0.18);
      ctx.beginPath(); ctx.arc(px + size / 2, py + size / 2, Math.max(2, size * 0.62), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + size / 2, py + size / 2, Math.max(1, size * 0.28), 0, Math.PI * 2); ctx.stroke();
      const gw = data.gateways.find((g) => g.x === x && g.y === y);
      drawLabel(gw ? L({ zh: gw.name_zh, en: gw.name_en }) : '', px + size / 2, py - 4, '#ffb7d1', zoom);
    } else if (type === 'hole') {
      ctx.fillStyle = '#0b1216';
      ctx.fillRect(px, py, size, size);
      const t = Date.now() / 900;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(232,244,250,${0.6 - k * 0.15})`;
        ctx.lineWidth = Math.max(1, zoom * 0.22);
        ctx.beginPath();
        ctx.arc(px + size / 2, py + size / 2, Math.max(4, size * (0.8 + k * 0.45) + Math.sin(t + k) * 2), 0, Math.PI * 2);
        ctx.stroke();
      }
      drawLabel(tr('map.bore'), px + size / 2, py - 6, '#eafcff', zoom);
    } else if (type === 'city') {
      ctx.fillStyle = owner ? hexA(owner === S.user.id ? '#3ce7ff' : OWNER_COLORS[owner % OWNER_COLORS.length], 0.9) : COLORS.city;
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#041018';
      ctx.beginPath(); ctx.arc(px + size / 2, py + size / 2, Math.max(1.5, size * 0.22), 0, Math.PI * 2); ctx.fill();
    }
    if (owner) {
      const oc = owner === S.user.id ? '#3ce7ff' : OWNER_COLORS[owner % OWNER_COLORS.length];
      if (type !== 'city') {
        ctx.fillStyle = hexA(oc, owner === S.user.id ? 0.24 : 0.16);
        ctx.fillRect(px, py, size, size);
      }
      if (zoom >= 1.2) {
        ctx.strokeStyle = hexA(oc, owner === S.user.id ? 0.5 : 0.32);
        ctx.lineWidth = owner === S.user.id ? 0.8 : 0.5;
        ctx.strokeRect(px + 0.3, py + 0.3, Math.max(0.5, size - 0.6), Math.max(0.5, size - 0.6));
      }
    }
  }
  if (selected) {
    const size = Math.max(8, (data.block || 1) * zoom);
    const px = selected.x * zoom + offX, py = selected.y * zoom + offY;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(px - 1, py - 1, size + 2, size + 2);
  }
  // capital / city markers on top of the terrain
  for (const c of (S.state?.cities || [])) {
    if (c.x < S.map.cx - W / 2 / zoom || c.x > S.map.cx + W / 2 / zoom || c.y < S.map.cy - H / 2 / zoom || c.y > S.map.cy + H / 2 / zoom) continue;
    const px = c.x * zoom + offX + zoom / 2, py = c.y * zoom + offY + zoom / 2;
    ctx.strokeStyle = 'rgba(60,231,255,0.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, Math.max(5, zoom * 0.8), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(60,231,255,0.2)';
    ctx.beginPath(); ctx.arc(px, py, Math.max(8, zoom * 1.3), 0, Math.PI * 2); ctx.fill();
    drawLabel(L(c.name), px, py - Math.max(9, zoom * 1.4), '#dffcff', Math.max(zoom, 4.2));
  }
}

function drawLabel(text, x, y, color, zoom) {
  if (!text || zoom < 3) return;
  ctx.font = `${Math.max(8, Math.min(12, zoom * 1.2))}px "Cascadia Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(2,7,10,0.75)';
  const w = ctx.measureText(text).width;
  ctx.fillRect(x - w / 2 - 3, y - 10, w + 6, 12);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function hexA(hex, a) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function screenToTile(px, py) {
  if (!data) return null;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = 640;
  const zoom = S.map.zoom;
  const offX = W / 2 - S.map.cx * zoom;
  const offY = H / 2 - S.map.cy * zoom;
  const x = Math.floor((px - offX) / zoom);
  const y = Math.floor((py - offY) / zoom);
  if (x < 0 || y < 0 || x >= S.boot.map.width || y >= S.boot.map.height) return null;
  return { x, y };
}

function hoverTile(e) {
  if (!data || !rootEl) return;
  const p = screenToTile(e.offsetX, e.offsetY);
  const old = rootEl.querySelector('.map-tooltip');
  if (!p) { old?.remove(); return; }
  const tile = tileIndex.get(`${p.x},${p.y}`);
  if (!tile) { old?.remove(); return; }
  const el = old || document.createElement('div');
  el.className = 'map-tooltip';
  const [x, y, type, owner, level] = tile;
  el.innerHTML = `<b>${x},${y}</b> · ${esc(tr('map.type.' + type))}${owner ? ` · ${owner === S.user.id ? esc(tr('map.you')) : '#' + owner}` : ''}${type === 'fort' ? ` · Lv.${level}` : ''}`;
  el.style.left = `${e.offsetX}px`;
  el.style.top = `${e.offsetY}px`;
  if (!old) rootEl.querySelector('.map-panel').appendChild(el);
}

async function clickTile(x, y) {
  if ((data?.block || 1) > 1) { toast(tr('map.clickZoom'), 'warn'); return; }
  selected = { x, y };
  draw();
  try {
    const res = await api(`/api/tile/${x}/${y}`);
    selectedTile = res.tile;
    updateTilePanel();
  } catch (e) { toast(errorText(e), 'error'); }
}

function updateTilePanel() {
  const host = rootEl?.querySelector('#tile-panel');
  if (host) { host.innerHTML = tilePanelHTML(); bindTileActions(); }
}

function tilePanelHTML() {
  if (!selectedTile) {
    return `<div class="panel tile-panel"><div class="panel-head"><h3>${esc(tr('map.tile'))}</h3><span class="tag">GRID</span></div><div class="empty-state"><b>${esc(tr('map.title'))}</b>${esc(tr('map.zoomHint'))}</div></div>`;
  }
  const t = selectedTile;
  const typeLabel = t.city_id ? tr('map.type.city') : tr('map.type.' + t.type);
  const owner = t.owner_id ? (t.owner_id === S.user.id ? tr('map.you') : t.owner_name || '#' + t.owner_id) : tr('map.unclaimed');
  const resRows = t.res ? Object.entries(t.res).map(([k, v]) => `<span class="cost ${k}"><i></i>${v} ${esc(tr('resource.' + k))}</span>`).join('') : '';
  const canClaim = t.type === 'empty' && !t.owner_id && t.adjacent;
  const canAttack = t.owner_id !== S.user.id && (t.adjacent || t.type === 'hole');
  const isOwn = t.owner_id === S.user.id;
  const hold = t.type === 'hole' && S.state.season?.holeSince ? `<div class="tile-stat"><span>${esc(tr('map.holdTime'))}</span><b class="mono">${fmtDuration(Date.now() - S.state.season.holeSince)}</b></div>` : '';
  return `<div class="panel tile-panel">
    <div class="panel-head"><h3>${esc(tr('map.tile'))} ${t.x},${t.y}</h3><span class="tag ${t.type === 'hole' ? 'amber' : t.type === 'gateway' ? 'magenta' : 'cyan'}">${esc(typeLabel)}</span></div>
    <div class="facility-head"><div class="tile-type-icon">${icon(t.type === 'resource' ? 'spark' : t.type === 'fort' ? 'shield' : t.type === 'gateway' ? 'crown' : t.type === 'hole' ? 'globe' : t.city_id ? 'city' : 'grid')}</div>
      <div><h3>${esc(t.name_zh || t.name_en || `${tr('map.type.' + t.type)} ${t.x},${t.y}`)}</h3><div class="sub">${esc(owner)} · ${esc(tr('map.coords'))} ${t.x},${t.y}${t.level ? ` · LV.${t.level}` : ''}</div></div></div>
    <div class="tile-stats">
      <div class="tile-stat"><span>${esc(tr('map.durability'))}</span><b>${t.durability ? `${fmt(t.durability)} / ${fmt(t.max_durability)}` : '—'}</b></div>
      <div class="tile-stat"><span>${esc(tr('map.garrison'))}</span><b>${t.detailed ? fmt(t.garrisonCount || 0) : '???'}</b></div>
      ${hold}
    </div>
    ${resRows ? `<div class="cost-row">${resRows}</div>` : ''}
    ${t.detailed && t.garrison && Object.keys(t.garrison).length ? `<div class="list" style="margin-top:8px">${Object.entries(t.garrison).map(([u, v]) => `<div class="troop-row"><div class="tr-name">${icon('army')}<b>${esc(L(S.boot.meta.units[u]?.name))}</b><span class="tag">Lv.${v.level || 1}</span></div><span class="tr-count">${fmt(v.count)}</span></div>`).join('')}</div>` : ''}
    ${!t.detailed ? `<div class="notice" style="margin-top:8px">${esc(tr('map.garrisonUnknown'))}</div>` : ''}
    ${!isOwn && !t.adjacent && t.type !== 'hole' ? `<div class="notice" style="margin-top:8px">${esc(tr('map.notAdjacent'))}</div>` : ''}
    ${t.generals?.length ? `<div class="mono tiny muted" style="margin-top:6px">VANGUARDS: ${t.generals.map((g) => esc(L(g.name))).join(' · ')}</div>` : ''}
    <div class="divider"></div>
    <div class="row wrap">
      ${isOwn ? `<a class="btn sm ghost" href="#/city" data-goto-city="${t.city_id || ''}">${icon('city')} ${esc(tr('nav.city'))}</a>` : ''}
      ${canClaim ? `<button class="btn primary sm" data-act="claim">${icon('plus')} ${esc(tr('map.claimEmpty'))}</button>` : ''}
      ${isOwn && !t.city_id ? `<button class="btn sm" data-act="reinforce">${icon('army')} ${esc(tr('map.reinforce'))}</button>` : ''}
      ${isOwn && t.type === 'resource' && !t.city_id && (S.state.subbaseCount || 0) < (S.state.subbaseCap || 0) ? `<button class="btn sm" data-act="subbase">${icon('city')} ${esc(tr('map.subbase'))}</button>` : ''}
      ${isOwn && t.type === 'resource' && !t.city_id ? `<button class="btn sm ghost" data-act="abandon">${esc(tr('map.abandon'))}</button>` : ''}
      ${canAttack ? `<button class="btn magenta sm" data-act="attack">${icon('attack')} ${esc(tr('map.attack'))}</button>` : ''}
      ${canAttack ? `<button class="btn sm ghost" data-act="scout">${icon('scout')} ${esc(tr('map.scout'))}</button>` : ''}
      ${t.type === 'resource' ? `<span class="mono tiny muted">${esc(tr('map.circuitNeed', { n: S.state.settings?.resourceClaimCircuit ?? 3 }))}</span>` : ''}
    </div>
  </div>`;
}

function gatewayListHTML() {
  const gws = data?.gateways || [];
  return gws.map((g) => `<div class="gateway-row" data-gw data-gx="${g.x}" data-gy="${g.y}">
    <span class="dir">${String(g.gateway_dir ?? 0).padStart(2, '0')}</span>
    <span>${esc(L({ zh: g.name_zh, en: g.name_en }))}</span>
    <span class="own">${g.owner_id ? `#${g.owner_id}` : esc(tr('map.unclaimed'))}</span>
  </div>`).join('') || `<div class="empty-state">${esc(tr('common.loading'))}</div>`;
}

function updateGatewayList() {
  const host = rootEl?.querySelector('#gateway-list');
  if (host) host.innerHTML = gatewayListHTML();
}

function bindTileActions() {
  const host = rootEl?.querySelector('#tile-panel');
  if (!host) return;
  host.querySelector('[data-act="claim"]')?.addEventListener('click', claim);
  host.querySelector('[data-act="subbase"]')?.addEventListener('click', subbase);
  host.querySelector('[data-act="abandon"]')?.addEventListener('click', abandon);
  host.querySelector('[data-act="attack"]')?.addEventListener('click', openAttack);
  host.querySelector('[data-act="scout"]')?.addEventListener('click', openScout);
  host.querySelector('[data-act="reinforce"]')?.addEventListener('click', openReinforce);
  host.querySelector('[data-goto-city]')?.addEventListener('click', () => {
    const id = Number(host.querySelector('[data-goto-city]')?.dataset.gotoCity);
    if (id) S.cityId = id;
  });
}

async function subbase() {
  try {
    const r = await api('/api/map/subbase', { method: 'POST', body: { x: selected.x, y: selected.y } });
    toast(tr('map.subbaseSuccess'), 'success');
    await refreshState();
    S.cityId = r.cityId;
    await loadMap();
    await clickTile(selected.x, selected.y);
  } catch (e) { toast(errorText(e), 'error'); }
}

async function abandon() {
  try {
    const r = await api('/api/map/abandon', { method: 'POST', body: { x: selected.x, y: selected.y } });
    toast(tr('map.abandonSuccess', { n: r.refund }), 'success');
    await refreshState();
    await loadMap();
    await clickTile(selected.x, selected.y);
  } catch (e) { toast(errorText(e), 'error'); }
}

async function claim() {
  try {
    await api('/api/map/claim', { method: 'POST', body: { x: selected.x, y: selected.y } });
    toast(tr('map.claimSuccess'), 'success');
    await refreshState();
    await loadMap();
    await clickTile(selected.x, selected.y);
  } catch (e) { toast(errorText(e), 'error'); }
}

async function openScout() {
  const city = S.state.cities?.[0];
  if (!city) return;
  const c = (await api(`/api/city/${city.id}`)).city;
  const scouts = c.troops.scout?.count || 0;
  modal({
    title: tr('map.scoutTitle'), tag: `${selectedTile.x},${selectedTile.y}`, narrow: true,
    body: `<div class="field"><label>${esc(tr('map.scoutCount'))} <span>${esc(tr('common.available'))} ${scouts}</span></label><input class="input" id="scout-count" type="number" min="1" max="${Math.max(1, scouts)}" value="${Math.min(10, Math.max(1, scouts))}" ${scouts ? '' : 'disabled'}></div>
      ${scouts ? '' : `<div class="notice">${esc(tr('map.noTroops'))}</div>`}`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('map.scout'), class: 'primary', disabled: !scouts, onClick: async () => {
        try {
          await api('/api/map/scout', { method: 'POST', body: { x: selected.x, y: selected.y, count: Number(document.getElementById('scout-count').value || 1), cityId: city.id } });
          toast(tr('map.scoutSuccess'), 'success');
          await refreshState(); await loadMap();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function openReinforce() {
  const cities = S.state.cities || [];
  if (!cities.length) return;
  const cityId = S.cityId && cities.some((c) => c.id === S.cityId) ? S.cityId : cities[0].id;
  const city = (await api(`/api/city/${cityId}`)).city;
  const units = Object.keys(city.troops);
  modal({
    title: tr('map.reinforceTitle'), tag: `${selectedTile.x},${selectedTile.y}`, narrow: true,
    body: `<div class="field"><label>${esc(tr('map.selectCity'))}</label><select class="select" id="rf-city">${cities.map((c) => `<option value="${c.id}" ${c.id === cityId ? 'selected' : ''}>${esc(L(c.name))}</option>`).join('')}</select></div>
      <div class="attack-troops">${units.map((u) => `<div class="attack-troop"><label>${esc(L(S.boot.meta.units[u]?.name))} <span class="mono muted">/ ${city.troops[u].count}</span></label><input class="input" data-rf="${u}" type="number" min="0" max="${city.troops[u].count}" value="0"></div>`).join('')}</div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('map.reinforce'), class: 'primary', onClick: async () => {
        const troops = {};
        document.querySelectorAll('[data-rf]').forEach((inp) => { const n = Number(inp.value || 0); if (n > 0) troops[inp.dataset.rf] = { count: n, level: city.troops[inp.dataset.rf].level }; });
        try {
          await api('/api/map/reinforce', { method: 'POST', body: { x: selected.x, y: selected.y, cityId: Number(document.getElementById('rf-city').value), troops } });
          toast(tr('map.reinforceSuccess'), 'success');
          await refreshState(); await loadMap();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
  });
}

async function openAttack() {  const cities = S.state.cities || [];
  if (!cities.length) return;
  const gens = (await api('/api/generals')).owned.filter((g) => g.hp > 0 && g.location.type !== 'army');
  const cityId = S.cityId && cities.some((c) => c.id === S.cityId) ? S.cityId : cities[0].id;
  const city = (await api(`/api/city/${cityId}`)).city;
  const units = Object.keys(city.troops);
  const costCap = city.generalCostCap;
  const target = selectedTile;
  modal({
    title: tr('map.attackTitle', { name: target.name_zh || target.name_en || `${target.x},${target.y}` }),
    tag: `${target.x},${target.y}`, wide: true,
    body: `<div class="grid two" style="gap:16px">
      <div>
        <div class="field"><label>${esc(tr('map.selectCity'))}</label><select class="select" id="atk-city">${cities.map((c) => `<option value="${c.id}" ${c.id === cityId ? 'selected' : ''}>${esc(L(c.name))}</option>`).join('')}</select></div>
        <div class="field"><label>${esc(tr('map.selectGeneral'))} · ${esc(tr('generals.costCap'))} ${fmt1(costCap)}</label><select class="select" id="atk-general"><option value="">${esc(tr('map.noGeneral'))}</option>${gens.map((g) => `<option value="${g.id}" ${g.cost > costCap ? 'disabled' : ''}>${esc(L(g.name))} · ${g.rarity} · C${fmt1(g.cost)} · HP${g.hp}</option>`).join('')}</select></div>
        <div class="divider"></div>
        <div class="kicker">${esc(tr('map.troops'))}</div>
        <div class="attack-troops">${units.map((u) => `<div class="attack-troop"><label>${esc(L(S.boot.meta.units[u]?.name))} <span class="mono muted">/ ${city.troops[u].count}</span></label><input class="input" data-unit="${u}" type="number" min="0" max="${city.troops[u].count}" value="0"></div>`).join('')}</div>
        <div class="row"><button class="btn sm" id="atk-all">${esc(tr('common.max'))}</button><button class="btn sm ghost" id="atk-preview">${esc(tr('map.preview'))}</button></div>
      </div>
      <div>
        <div class="preview-box"><div><span>${esc(tr('map.attackPower'))}</span><b id="pv-atk">—</b></div><div><span>${esc(tr('map.defensePower'))}</span><b id="pv-def">—</b></div><div><span>${esc(tr('map.siegePower'))}</span><b id="pv-siege">—</b></div></div>
        <div class="mono tiny muted" id="pv-travel"></div>
        <div class="meter odds" style="margin-top:8px"><i id="pv-odds" style="width:0%"></i></div>
        <div class="mono tiny muted" id="pv-odds-text" style="margin-top:4px"></div>
        <div class="notice cyan" style="margin-top:12px">${esc(tr('map.travel'))} · ${esc(tr('map.preview'))}</div>
        ${target.type === 'hole' ? `<div class="notice" style="margin-top:8px">${esc(tr('map.needGateway'))}</div>` : ''}
      </div>
    </div>`,
    actions: [
      { label: tr('common.cancel'), class: 'ghost' },
      { label: tr('map.launch'), class: 'magenta', onClick: async () => {
        const troops = {};
        document.querySelectorAll('[data-unit]').forEach((inp) => { const n = Number(inp.value || 0); if (n > 0) troops[inp.dataset.unit] = { count: n, level: city.troops[inp.dataset.unit].level }; });
        try {
          await api('/api/map/attack', { method: 'POST', body: { x: target.x, y: target.y, generalId: Number(document.getElementById('atk-general').value) || null, cityId: Number(document.getElementById('atk-city').value), troops } });
          toast(tr('map.attackSuccess'), 'success');
          await refreshState();
          selected = null; selectedTile = null; updateTilePanel(); await loadMap();
        } catch (e) { toast(errorText(e), 'error'); }
      } },
    ],
    onMount: (m, close) => {
      const collect = () => {
        const troops = {};
        m.querySelectorAll('[data-unit]').forEach((inp) => { const n = Number(inp.value || 0); if (n > 0) troops[inp.dataset.unit] = { count: n, level: 1 }; });
        return { x: target.x, y: target.y, generalId: Number(m.querySelector('#atk-general').value) || null, cityId: Number(m.querySelector('#atk-city').value), troops };
      };
      m.querySelector('#atk-all')?.addEventListener('click', () => { m.querySelectorAll('[data-unit]').forEach((inp) => { inp.value = inp.max; }); doPreview(); });
      m.querySelector('#atk-preview')?.addEventListener('click', doPreview);
      m.querySelector('#atk-city')?.addEventListener('change', async (e) => {
        try {
          const c = (await api(`/api/city/${e.target.value}`)).city;
          m.querySelectorAll('[data-unit]').forEach((inp) => { const u = inp.dataset.unit; const v = c.troops[u]?.count || 0; inp.max = v; inp.value = Math.min(Number(inp.value || 0), v); });
        } catch { /* noop */ }
      });
      async function doPreview() {
        try {
          const p = await api('/api/map/preview', { method: 'POST', body: collect() });
          m.querySelector('#pv-atk').textContent = fmt(p.attack);
          m.querySelector('#pv-def').textContent = p.defense == null ? '?' : fmt(p.defense);
          m.querySelector('#pv-siege').textContent = fmt(p.siege);
          m.querySelector('#pv-travel').textContent = `${tr('map.travel')}: ${fmtDuration(p.travelSeconds * 1000)}`;
          m.querySelector('#pv-odds').style.width = `${Math.round((p.odds ?? 0) * 100)}%`;
          m.querySelector('#pv-odds-text').textContent = p.odds == null ? tr('map.garrisonUnknown') : `${tr('map.odds')} ${Math.round(p.odds * 100)}%`;
        } catch (e) { toast(errorText(e), 'error'); }
      }
      doPreview();
    },
  });
}

function incomingHTML(m) {
  return `<div class="troop-row"><div class="tr-name">${icon('attack', 'ico')}<div><b>${esc(m.attacker_name || '#' + m.user_id)}</b><div class="mono tiny muted">${esc(tr('map.coords'))} ${m.to_x},${m.to_y} · ${esc(tr('army.kind.' + m.kind))}</div></div></div><div class="right"><div class="mono tiny muted">${esc(tr('army.arrivesIn'))}</div>${countdownHTML(m.arrive_at)}</div></div>`;
}
