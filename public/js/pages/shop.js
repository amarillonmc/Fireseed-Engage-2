import { S, L, tr, api, refreshState, errorText } from '../core.js';
import { esc, icon, fmt, modal, toast } from '../ui.js';

let rootEl = null;
let data = null;

export async function render(root) {
  rootEl = root;
  await load();
  return () => { rootEl = null; };
}

async function load() {
  data = await api('/api/shop');
  draw();
}

function draw() {
  if (!rootEl || !data) return;
  const user = S.state.user;
  rootEl.innerHTML = `<div class="section-title"><div><div class="kicker">${esc(tr('shop.subtitle'))}</div><h2>${esc(tr('shop.title'))}</h2></div><span class="sub">${esc(tr('resource.lumen'))} ${fmt(S.state.resources.lumen)} · ${esc(tr('resource.umbra'))} ${fmt(S.state.resources.umbra)} · ${esc(tr('hud.tapes'))} ${user.tapes}</span></div>
    <div class="notice cyan" style="margin-bottom:14px">${esc(tr('shop.note'))}</div>
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat-card"><div class="sc-label">${esc(tr('resource.lumen'))}</div><div class="sc-value">${fmt(S.state.resources.lumen)}</div><div class="sc-sub">${esc(tr('common.available'))}</div></div>
      <div class="stat-card accent"><div class="sc-label">${esc(tr('resource.umbra'))}</div><div class="sc-value">${fmt(S.state.resources.umbra)}</div><div class="sc-sub">${esc(tr('common.available'))}</div></div>
      <div class="stat-card"><div class="sc-label">${esc(tr('hud.tapes'))}</div><div class="sc-value">${user.tapes}</div><div class="sc-sub">CHRONO TAPE</div></div>
      <div class="stat-card"><div class="sc-label">${esc(tr('resource.circuit'))}</div><div class="sc-value">${S.state.resources.circuit}</div><div class="sc-sub">/ ${S.state.caps.circuit}</div></div>
    </div>
    <div class="shop-grid">${data.items.map((i) => `<div class="shop-item">
      <div class="row between"><h4>${esc(L(i.name))}</h4>${icon('shop')}</div>
      <p>${esc(L(i.desc))}</p>
      <div class="price">${Object.entries(i.price).map(([k, v]) => `<span>${fmt(v)} ${esc(tr('resource.' + k))}</span>`).join('')}</div>
      <button class="btn ${Object.keys(i.price).includes('umbra') ? 'magenta' : 'primary'} sm" data-buy="${i.id}">${esc(tr('shop.buy'))}</button>
    </div>`).join('')}</div>`;
  rootEl.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy, b)));
}

async function buy(id, btn) {
  btn.disabled = true;
  try {
    await api('/api/shop/buy', { method: 'POST', body: { itemId: id } });
    toast(tr('shop.success'), 'success');
    await refreshState();
    await load();
  } catch (e) { toast(errorText(e), 'error'); btn.disabled = false; }
}
