import { S, L, tr, boot, refreshState, setLang, api, isLoggedIn, hasAdmin } from './core.js';
import { icon, resourceStrip, toast, esc, tickCountdowns } from './ui.js';
import { renderLanding } from './pages/landing.js';

const PAGES = {
  city: () => import('./pages/city.js'),
  map: () => import('./pages/map.js'),
  generals: () => import('./pages/generals.js'),
  skills: () => import('./pages/skills.js'),
  research: () => import('./pages/research.js'),
  army: () => import('./pages/army.js'),
  rankings: () => import('./pages/rankings.js'),
  syndicate: () => import('./pages/syndicate.js'),
  shop: () => import('./pages/shop.js'),
  profile: () => import('./pages/profile.js'),
  admin: () => import('./pages/admin.js'),
};

const NAV = [
  ['city', 'city', 'nav.city'],
  ['map', 'map', 'nav.map'],
  ['generals', 'general', 'nav.generals'],
  ['skills', 'skill', 'nav.skills'],
  ['research', 'research', 'nav.research'],
  ['army', 'army', 'nav.army'],
  ['rankings', 'rank', 'nav.rankings'],
  ['syndicate', 'alliance', 'nav.syndicate'],
  ['shop', 'shop', 'nav.shop'],
  ['profile', 'profile', 'nav.profile'],
];

let pollTimer = null;
let tickTimer = null;
let currentCleanup = null;
let routeSeq = 0;

function parseRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  if (!h) return { page: 'city', sub: null };
  const [page, sub] = h.split('/');
  if (page === 'admin') {
    S.adminTab = sub || 'overview';
    return { page: 'admin', sub: S.adminTab };
  }
  return { page: PAGES[page] ? page : 'city', sub: null };
}

export async function startGame() {
  if (!S.user) {
    await boot();
    if (!S.user) { renderLanding(document.getElementById('app')); return; }
  }
  if (!S.state) await refreshState();
  renderShell();
  await renderRoute();
  startTimers();
}

function needBoot() {
  return !S.boot;
}

export function renderShell() {
  const app = document.getElementById('app');
  const state = S.state;
  if (!state) {
    app.innerHTML = `<div class="app"><div class="loading"><i></i>${esc(tr('common.loading'))}</div></div>`;
    return;
  }
  const { page } = parseRoute();
  const season = state.season;
  const announcement = S.boot?.announcements?.[0];
  app.innerHTML = `<div class="app">
    <header class="hud">
      <div class="wrap">
        <div class="hud-top">
          <a class="hud-brand" href="#/city">
            <div class="brand-mark">FE<span style="color:var(--magenta)">//</span></div>
            <div class="brand-type"><b>FIRESEED</b> ENGAGE<small>${esc(tr('game.title'))}</small></div>
          </a>
          <div class="season-chip">
            <span class="dot"></span>
            <b>${season ? `S${String(season.number).padStart(2, '0')} · ${esc(L(season.name))}` : esc(tr('hud.cycleEnded'))}</b>
            <span>${season ? `${esc(tr('hud.holeHeld'))}: ${season.holeHolderName ? esc(season.holeHolderName) : '—'}` : ''}</span>
          </div>
          <div class="hud-right">
            <div class="lang-toggle"><button data-lang="zh" class="${S.lang === 'zh' ? 'active' : ''}">中文</button><button data-lang="en" class="${S.lang === 'en' ? 'active' : ''}">EN</button></div>
            <a class="icon-btn" href="#/profile" title="${esc(tr('nav.reports'))}">${icon('report')}${state.reportsUnread ? `<span class="badge" style="position:absolute;transform:translate(12px,-12px)">${state.reportsUnread}</span>` : ''}</a>
            <div class="hud-user">
              <div class="avatar">${esc((state.user.displayName || '?').slice(0, 1).toUpperCase())}</div>
              <div><b>${esc(state.user.displayName)}</b><span>${esc(tr('charter.' + state.user.charter))}</span></div>
            </div>
            ${hasAdmin() ? `<a class="icon-btn" href="#/admin" title="${esc(tr('nav.admin'))}">${icon('admin')}</a>` : ''}
            <button class="icon-btn" data-logout title="${esc(tr('hud.logout'))}">${icon('logout')}</button>
          </div>
        </div>
        <nav class="hud-nav">
          ${NAV.map(([key, ic, label]) => `<a href="#/${key}" class="${page === key ? 'active' : ''}">${icon(ic)}<span>${esc(tr(label))}</span></a>`).join('')}
          ${hasAdmin() ? `<a href="#/admin" class="${page === 'admin' ? 'active' : ''}">${icon('admin')}<span>${esc(tr('nav.admin'))}</span><span class="nb">OPS</span></a>` : ''}
        </nav>
      </div>
    </header>
    <div id="resource-host">${resourceStrip(state)}</div>
    ${announcement ? `<div class="wrap" style="padding-top:10px"><div class="notice-strip"><span class="dot"></span><b>NOTICE</b><span>${esc(L(announcement.title))} — ${esc(L(announcement.body))}</span></div></div>` : ''}
    <main class="app-main"><div class="wrap" id="page-root"><div class="loading"><i></i>${esc(tr('common.loading'))}</div></div></main>
    <footer class="app-foot"><div class="wrap row between"><span>${esc(tr('game.fan'))}</span><span>JEWEL SAVIOR FREE · PROJECT K FAN ART · v2.0</span></div></footer>
  </div>`;

  app.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
    setLang(b.dataset.lang);
    if (S.user) api('/api/locale', { method: 'POST', body: { locale: S.lang } }).catch(() => {});
    renderShell();
    await renderRoute();
  }));
  app.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    S.user = null; S.state = null; S.csrf = null; S.boot = null;
    stopTimers();
    location.hash = '';
    await boot();
    renderLanding(document.getElementById('app'));
  });
}

export async function renderRoute() {
  const seq = ++routeSeq;
  const { page, sub } = parseRoute();
  S.page = page;
  const root = document.getElementById('page-root');
  if (!root) return;
  if (currentCleanup) { try { currentCleanup(); } catch { /* noop */ } currentCleanup = null; }
  root.innerHTML = `<div class="loading"><i></i>${esc(tr('common.loading'))}</div>`;
  try {
    if (page === 'admin' && !hasAdmin()) {
      toast(tr('error.admin_required'), 'error');
      location.hash = '#/city';
      return;
    }
    if (!S.state) await refreshState();
    if (seq !== routeSeq) return;
    const mod = await PAGES[page]();
    if (seq !== routeSeq) return;
    root.innerHTML = '';
    currentCleanup = await mod.render(root, { sub }) || null;
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (e) {
    console.error(e);
    if (seq === routeSeq) root.innerHTML = `<div class="panel"><div class="empty-state"><b>ERROR</b>${esc(e.message || '')}</div></div>`;
  }
}

function startTimers() {
  stopTimers();
  tickTimer = setInterval(tickCountdowns, 1000);
  pollTimer = setInterval(async () => {
    const prev = S.state;
    const next = await refreshState();
    if (!next) return;
    const host = document.getElementById('resource-host');
    if (host) host.innerHTML = resourceStrip(next);
    const hudSeason = document.querySelector('.season-chip b');
    if (hudSeason && next.season) hudSeason.textContent = `S${String(next.season.number).padStart(2, '0')} · ${L(next.season.name)}`;
  }, 6000);
}
function stopTimers() {
  if (pollTimer) clearInterval(pollTimer);
  if (tickTimer) clearInterval(tickTimer);
  pollTimer = null; tickTimer = null;
}

document.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-CN';
  try {
    await boot();
  } catch (e) {
    console.error('boot failed', e);
  }
  const bootEl = document.getElementById('boot-screen');
  setTimeout(() => bootEl?.classList.add('done'), 350);
  if (S.user) {
    if (!location.hash) location.hash = '#/city';
    await startGame();
  } else {
    renderLanding(document.getElementById('app'));
  }
});

window.addEventListener('hashchange', async () => {
  if (!S.user) { renderLanding(document.getElementById('app')); return; }
  renderShell();
  await renderRoute();
});

window.addEventListener('fs:unauthorized', () => {
  stopTimers();
  S.user = null; S.state = null; S.boot = null;
  renderLanding(document.getElementById('app'));
});

window.addEventListener('fs:maintenance', () => {
  toast(tr('error.maintenance'), 'warn');
});

window.addEventListener('fs:lang', () => {
  // Full re-render is triggered by the controls; this keeps standalone pages honest.
});
