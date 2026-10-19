const PORT = process.env.CDP_PORT || 9336;
const expr = process.argv[2] || '1+1';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((p) => p.type === 'page' && p.url.includes('127.0.0.1:8080')) || list.find((p) => p.type === 'page');
if (!page) { console.error('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p(m); }
};
function send(method, params) {
  const i = ++id;
  return new Promise((resolve) => { pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
}
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
if (r.result?.exceptionDetails) console.error(r.result.exceptionDetails);
else console.log(JSON.stringify(r.result?.result?.value, null, 2));
process.exit(0);
