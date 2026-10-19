const PORT = Number(process.env.CDP_PORT || 9336);
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const route = process.argv[2] || 'city';
const out = process.argv[3] || `refshots/${route}.png`;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((p) => p.type === 'page' && p.url.includes('127.0.0.1:8080')) || list.find((p) => p.type === 'page');
if (!page) { console.error('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p(m); }
};
const send = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${BASE}/#/${route}` });
await new Promise((r) => setTimeout(r, 800));
await send('Page.reload', { ignoreCache: true });
await new Promise((r) => setTimeout(r, 2800));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const fs = await import('node:fs');
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
process.exit(0);
