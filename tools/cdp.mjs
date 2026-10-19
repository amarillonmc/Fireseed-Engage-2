import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = Number(process.env.CDP_PORT || 9336);
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const OUT = process.env.OUT || 'refshots';
const userData = path.join(os.tmpdir(), 'fs-edge-profile-' + Date.now());
fs.mkdirSync(userData, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

let proc = null;
async function ensureBrowser() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) { console.log('reusing browser on', PORT); return; }
  } catch { /* launch */ }
  proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + userData, '--window-size=1600,1000', 'about:blank',
  ], { stdio: 'ignore' });
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch { /* noop */ }
    await sleep(250);
  }
  throw new Error('CDP not ready');
}

let ws;
let seq = 0;
const pending = new Map();
const events = new Map();
function send(method, params = {}, sessionId) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
function onEvent(name, fn) {
  if (!events.has(name)) events.set(name, []);
  events.get(name).push(fn);
}

async function evalJs(expression, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + (r.exceptionDetails.exception?.description || ''));
  return r.result?.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('shot', file, fs.statSync(file).size);
}

async function click(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function main() {
  await ensureBrowser();
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + '/')}`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    } else if (msg.method && events.has(msg.method)) {
      for (const fn of events.get(msg.method)) fn(msg.params);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Network.clearBrowserCookies');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  onEvent('Runtime.exceptionThrown', (p) => console.error('PAGE EXCEPTION', p.exceptionDetails?.exception?.description || p.exceptionDetails?.text));
  onEvent('Log.entryAdded', (p) => { if (p.entry?.level === 'error') console.error('PAGE LOG', p.entry.text); });

  await send('Page.navigate', { url: BASE + '/' });
  await sleep(2200);
  await evalJs(`localStorage.setItem('fs_lang','zh')`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(2200);
  await shot('00-landing');

  const login = await evalJs(`(async()=>{
    const r = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'fireseed'})});
    const j = await r.json();
    return {status:r.status, ok:j.ok, csrf:j.csrf, name:j.user?.displayName};
  })()`);
  console.log('login', login);
  await send('Page.navigate', { url: BASE + '/#/city' });
  await sleep(400);
  await send('Page.reload', { ignoreCache: true });
  await sleep(3200);
  await shot('01-city');

  // city build panel
  const clicked = await evalJs(`(()=>{const el=document.querySelector('.cell[data-gx="6"][data-gy="6"]'); if(!el) return false; el.click(); return true;})()`);
  await sleep(400);
  console.log('clicked cell', clicked);
  await shot('08-city-build');
  await evalJs(`document.querySelector('.build-card:not(.disabled)')?.click()`);
  await sleep(400);
  await shot('08b-build-modal');
  await evalJs(`document.querySelector('.modal-close')?.click()`);
  await sleep(200);

  // general detail
  await send('Page.navigate', { url: BASE + '/#/generals' });
  await sleep(2200);
  await shot('03-generals');
  const gclick = await evalJs(`(()=>{const el=document.querySelector('[data-pgid]'); if(!el) return false; el.click(); return true;})()`);
  await sleep(500);
  console.log('clicked general', gclick);
  await shot('09-general-detail');
  await evalJs(`document.querySelector('.modal-close')?.click()`);
  await sleep(200);
  await send('Page.navigate', { url: BASE + '/#/map' });
  await sleep(2600);
  await shot('02-map');
  await click(599, 633);
  await sleep(800);
  await shot('10-map-tile');
  const hasAttack = await evalJs(`!!document.querySelector('[data-act="attack"]')`);
  console.log('has attack button', hasAttack);
  if (hasAttack) {
    await evalJs(`document.querySelector('[data-act="attack"]')?.click()`);
    await sleep(900);
    await shot('10b-attack-modal');
    await evalJs(`document.querySelector('.modal-close')?.click()`);
    await sleep(200);
  }

  // admin
  await send('Page.navigate', { url: BASE + '/#/admin' });
  await sleep(1800);
  await shot('05-admin');
  await send('Page.navigate', { url: BASE + '/#/admin/users' });
  await sleep(1800);
  await shot('11-admin-users');
  await send('Page.navigate', { url: BASE + '/#/admin/generals' });
  await sleep(1600);
  await shot('12-admin-generals');
  await evalJs(`document.querySelector('#gen-new')?.click()`);
  await sleep(700);
  await shot('12b-general-form');
  await evalJs(`document.querySelector('.modal-close')?.click()`);
  await sleep(200);
  await send('Page.navigate', { url: BASE + '/#/admin/settings' });
  await sleep(1600);
  await shot('12c-admin-settings');

  // English
  await evalJs(`document.querySelector('[data-lang="en"]')?.click()`);
  await sleep(1200);
  await send('Page.navigate', { url: BASE + '/#/city' });
  await sleep(1500);
  await shot('13-en-city');
  await send('Page.navigate', { url: BASE + '/#/generals' });
  await sleep(1500);
  await shot('14-en-generals');
  await send('Page.navigate', { url: BASE + '/#/admin' });
  await sleep(1500);
  await shot('15-en-admin');

  if (proc) proc.kill();
  process.exit(0);
}
main().catch((e) => { console.error(e); if (proc) proc.kill(); process.exit(1); });
